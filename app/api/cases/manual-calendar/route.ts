import {
  createHash,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

import {
  createLegalAlarmEngine,
} from "@/lib/calendar/LegalAlarmEngine";

import {
  LegalAlarmStore,
} from "@/lib/calendar/LegalAlarmStore";

import {
  createManualCaseCalendarPlans,
  type ManualCalendarPlan,
} from "@/lib/legal/manualCaseCalendar";
import {
  DATE_ONLY_LEGAL_ALARM_HOUR,
} from "@/lib/legal/alarmTimeRules";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

function stableUuid(
  ...values: string[]
) {
  const hex =
    createHash("sha256")
      .update(
        values.join("\u0000")
      )
      .digest("hex");

  const variant =
    (
      parseInt(hex[16], 16) &
      0x3 |
      0x8
    ).toString(16);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function hearingAlarmRows(
  userId: string,
  caseId: string,
  eventId: string,
  plan: ManualCalendarPlan
) {
  const hearingTime =
    new Date(
      `${plan.hearingAt}:00+03:00`
    );

  return [7, 3, 1]
    .map((daysBefore) => {
      const alarmTime =
        new Date(
          hearingTime
        );

      alarmTime.setDate(
        alarmTime.getDate() -
          daysBefore
      );

      return {
        id: stableUuid(
          userId,
          eventId,
          String(daysBefore),
          alarmTime.toISOString()
        ),
        user_id: userId,
        case_id: caseId,
        calendar_event_id:
          eventId,
        alarm_time:
          alarmTime.toISOString(),
        alarm_type:
          `${daysBefore}_days_before`,
        message:
          `${plan.title} için ${daysBefore} gün kaldı.`,
        status: "pending",
      };
    })
    .filter(
      (alarm) =>
        new Date(
          alarm.alarm_time
        ).getTime() > Date.now()
    );
}

export async function POST(
  request: Request
) {
  try {
    const {
      appUser,
      error,
    } = await getOrCreateAppUser();

    if (
      error ||
      !appUser
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error ||
            "Oturum bulunamadı.",
        },
        { status: 401 }
      );
    }

    const body =
      await request.json();

    const caseId =
      body.caseId
        ?.toString()
        .trim() || "";

    const supabase =
      getSupabaseAdmin();

    const ownedCase =
      await supabase
        .from("legal_cases")
        .select(
          "id,case_title,case_number,court_name"
        )
        .eq("id", caseId)
        .eq(
          "user_id",
          appUser.id
        )
        .maybeSingle();

    if (
      ownedCase.error ||
      !ownedCase.data
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            ownedCase.error
              ?.message ||
            "Dava bulunamadı.",
        },
        {
          status:
            ownedCase.error
              ? 500
              : 404,
        }
      );
    }

    const plans =
      createManualCaseCalendarPlans({
        caseId,
        title:
          ownedCase.data
            .case_title || "",
        court:
          ownedCase.data
            .court_name || "",
        caseNumber:
          ownedCase.data
            .case_number || "",
        hearingAt:
          body.hearingAt,
        manualDeadline:
          body.manualDeadline,
        note: body.note,
      });

    if (plans.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Takvime eklenecek tarih bulunamadı.",
        },
        { status: 400 }
      );
    }

    let createdCount = 0;
    let duplicateCount = 0;
    const events: unknown[] = [];

    for (const plan of plans) {
      const stableEventId =
        stableUuid(
          appUser.id,
          plan.dedupeKey,
          "calendar-event"
        );

      const existingEvent =
        await supabase
          .from(
            "calendar_events"
          )
          .select("*")
          .eq(
            "user_id",
            appUser.id
          )
          .eq("case_id", caseId)
          .eq(
            "event_type",
            plan.eventType
          )
          .eq(
            "source_mail_id",
            plan.dedupeKey
          )
          .maybeSingle();

      if (existingEvent.error) {
        throw new Error(
          existingEvent.error
            .message
        );
      }

      let event =
        existingEvent.data;

      if (event) {
        duplicateCount++;
      } else {
        const insertedEvent =
          await supabase
            .from(
              "calendar_events"
            )
            .insert({
              id: stableEventId,
              user_id:
                appUser.id,
              case_id: caseId,
              title: plan.title,
              description:
                plan.description ||
                null,
              event_type:
                plan.eventType,
              start_date:
                plan.date,
              end_date:
                plan.date,
              due_date:
                plan.date,
              status: "active",
              priority:
                plan.kind ===
                "manual_deadline"
                  ? "high"
                  : "normal",
              source:
                "manual_verified",
              source_mail_id:
                plan.dedupeKey,
              raw: {
                manualCase: true,
                manualKind:
                  plan.kind,
                userVerified:
                  true,
                hearingAt:
                  plan.hearingAt ||
                  null,
                manualDeadline:
                  plan.kind ===
                  "manual_deadline"
                    ? plan.date
                    : null,
                note:
                  body.note
                    ?.toString() ||
                  "",
              },
            })
            .select("*")
            .single();

        if (
          insertedEvent.error ||
          !insertedEvent.data
        ) {
          if (
            insertedEvent.error
              ?.code === "23505"
          ) {
            const racedEvent =
              await supabase
                .from(
                  "calendar_events"
                )
                .select("*")
                .eq(
                  "id",
                  stableEventId
                )
                .eq(
                  "user_id",
                  appUser.id
                )
                .maybeSingle();

            if (
              racedEvent.error ||
              !racedEvent.data
            ) {
              throw new Error(
                racedEvent.error
                  ?.message ||
                "Takvim kaydı okunamadı."
              );
            }

            event =
              racedEvent.data;
            duplicateCount++;
          } else {
            throw new Error(
              insertedEvent.error
                ?.message ||
              "Takvim kaydı oluşturulamadı."
            );
          }
        } else {
          event =
            insertedEvent.data;
          createdCount++;
        }
      }

      events.push(event);

      if (
        plan.kind === "hearing"
      ) {
        const existingAlarms =
          await supabase
            .from("alarms")
            .select("id")
            .eq(
              "user_id",
              appUser.id
            )
            .eq(
              "calendar_event_id",
              event.id
            )
            .limit(1);

        if (existingAlarms.error) {
          throw new Error(
            existingAlarms.error
              .message
          );
        }

        if (
          !existingAlarms.data
            ?.length
        ) {
          const alarms =
            hearingAlarmRows(
              appUser.id,
              caseId,
              event.id,
              plan
            );

          if (alarms.length > 0) {
            const alarmInsert =
              await supabase
                .from("alarms")
                .insert(alarms);

            if (
              alarmInsert.error &&
              alarmInsert.error
                .code !== "23505"
            ) {
              throw new Error(
                alarmInsert.error
                  .message
              );
            }
          }
        }

        continue;
      }

      const existingDeadline =
        await supabase
          .from(
            "legal_deadlines"
          )
          .select("*")
          .eq(
            "user_id",
            appUser.id
          )
          .eq("case_id", caseId)
          .eq(
            "calendar_event_id",
            event.id
          )
          .maybeSingle();

      if (existingDeadline.error) {
        throw new Error(
          existingDeadline.error
            .message
        );
      }

      let deadline =
        existingDeadline.data;

      if (!deadline) {
        const stableDeadlineId =
          stableUuid(
            appUser.id,
            event.id,
            "manual-deadline"
          );

        const insertedDeadline =
          await supabase
            .from(
              "legal_deadlines"
            )
            .insert({
              id:
                stableDeadlineId,
              user_id:
                appUser.id,
              case_id: caseId,
              title: plan.title,
              start_date: null,
              calculated_due_date:
                plan.date,
              deadline_type:
                "manual_verified",
              rule_used:
                "user_entered_date",
              ai_confidence: 1,
              calendar_event_id:
                event.id,
              status: "open",
            })
            .select("*")
            .single();

        if (
          insertedDeadline.error ||
          !insertedDeadline.data
        ) {
          if (
            insertedDeadline.error
              ?.code === "23505"
          ) {
            const racedDeadline =
              await supabase
                .from(
                  "legal_deadlines"
                )
                .select("*")
                .eq(
                  "id",
                  stableDeadlineId
                )
                .eq(
                  "user_id",
                  appUser.id
                )
                .maybeSingle();

            if (
              racedDeadline.error ||
              !racedDeadline.data
            ) {
              throw new Error(
                racedDeadline.error
                  ?.message ||
                "Manuel son tarih okunamadı."
              );
            }

            deadline =
              racedDeadline.data;
          } else {
            throw new Error(
              insertedDeadline.error
                ?.message ||
              "Manuel son tarih kaydedilemedi."
            );
          }
        } else {
          deadline =
            insertedDeadline.data;
        }
      }

      const alarmPlan =
        createLegalAlarmEngine()
          .createPlan({
            userId:
              appUser.id,
            deadlineId:
              deadline.id,
            calendarEventId:
              event.id,
            caseId,
            title: plan.title,
            deadlineDate:
              plan.date,
            court:
              ownedCase.data
                .court_name ||
              "",
            fileNo:
              ownedCase.data
                .case_number ||
              "",
            eventType:
              "manual_deadline",
            reminderDays: [
              7,
              3,
              1,
            ],
            channels: [
              "in_app",
              "push",
            ],
            includeSameDay:
              true,
            includeOverdue:
              false,
            notificationHour:
              DATE_ONLY_LEGAL_ALARM_HOUR,
            notificationMinute:
              0,
            skipPastAdvanceAlarms:
              true,
          });

      const alarmResult =
        await LegalAlarmStore
          .replacePlan(
            alarmPlan
          );

      if (!alarmResult.ok) {
        throw new Error(
          alarmResult.error ||
          "Alarm planı kaydedilemedi."
        );
      }
    }

    return NextResponse.json({
      ok: true,
      duplicate:
        createdCount === 0,
      message:
        createdCount === 0
          ? "Zaten takvimde"
          : "Takvime eklendi",
      createdCount,
      duplicateCount,
      events,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Takvim kaydı oluşturulamadı.",
      },
      { status: 500 }
    );
  }
}
