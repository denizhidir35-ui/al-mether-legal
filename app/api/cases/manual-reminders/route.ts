import type {
  SupabaseClient,
} from "@supabase/supabase-js";
import {
  NextResponse,
} from "next/server";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";
import {
  createOwnedManualReminder,
  listOwnedManualReminders,
  MANUAL_REMINDER_EVENT_TYPE,
  ManualReminderValidationError,
  type ManualReminderPlan,
  type ManualReminderRecord,
  type ManualReminderStore,
} from "@/lib/legal/manualReminder";
import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

function createStore(
  supabase: SupabaseClient
): ManualReminderStore {
  async function findExisting(
    userId: string,
    plan: ManualReminderPlan
  ) {
    const eventResult =
      await supabase
        .from("calendar_events")
        .select("id")
        .eq("user_id", userId)
        .eq("case_id", plan.caseId)
        .eq(
          "event_type",
          MANUAL_REMINDER_EVENT_TYPE
        )
        .eq(
          "source_mail_id",
          plan.dedupeKey
        )
        .maybeSingle();

    if (eventResult.error) {
      throw new Error(
        eventResult.error.message
      );
    }

    if (!eventResult.data) {
      return null;
    }

    const alarmResult =
      await supabase
        .from("alarms")
        .select(
          "id,case_id,calendar_event_id,alarm_time,alarm_type,message,status"
        )
        .eq("user_id", userId)
        .eq("case_id", plan.caseId)
        .eq(
          "calendar_event_id",
          eventResult.data.id
        )
        .eq(
          "alarm_type",
          MANUAL_REMINDER_EVENT_TYPE
        )
        .maybeSingle();

    if (alarmResult.error) {
      throw new Error(
        alarmResult.error.message
      );
    }

    return (
      alarmResult.data as
        ManualReminderRecord | null
    );
  }

  return {
    async findOwnedCase(
      userId,
      caseId
    ) {
      const result =
        await supabase
          .from("legal_cases")
          .select("id,case_title")
          .eq("id", caseId)
          .eq("user_id", userId)
          .maybeSingle();

      if (result.error) {
        throw new Error(
          result.error.message
        );
      }

      return result.data;
    },

    findExisting,

    async create(
      userId,
      caseTitle,
      plan
    ) {
      const eventId =
        crypto.randomUUID();
      const eventResult =
        await supabase
          .from("calendar_events")
          .insert({
            id: eventId,
            user_id: userId,
            case_id: plan.caseId,
            title:
              `${caseTitle} — Manuel hatırlatma`,
            description:
              plan.note || null,
            event_type:
              plan.eventType,
            start_date: plan.date,
            end_date: plan.date,
            due_date: plan.date,
            status: "active",
            priority: "normal",
            source: plan.source,
            source_mail_id:
              plan.dedupeKey,
            raw: {
              manualReminder: true,
              reminderAt:
                plan.alarmAt,
              userEnteredDate:
                plan.date,
              userEnteredTime:
                plan.time,
              note: plan.note,
            },
          })
          .select("id")
          .single();

      if (
        eventResult.error ||
        !eventResult.data
      ) {
        if (
          eventResult.error?.code ===
          "23505"
        ) {
          const raced =
            await findExisting(
              userId,
              plan
            );

          if (raced) {
            return raced;
          }
        }

        throw new Error(
          eventResult.error?.message ||
          "Hatırlatma takvim kaydı oluşturulamadı."
        );
      }

      const alarmResult =
        await supabase
          .from("alarms")
          .insert({
            id: crypto.randomUUID(),
            user_id: userId,
            case_id: plan.caseId,
            calendar_event_id:
              eventResult.data.id,
            legal_deadline_id: null,
            alarm_time:
              plan.alarmAt,
            alarm_type:
              MANUAL_REMINDER_EVENT_TYPE,
            message:
              plan.note ||
              "Manuel hatırlatma",
            status: "pending",
          })
          .select(
            "id,case_id,calendar_event_id,alarm_time,alarm_type,message,status"
          )
          .single();

      if (
        alarmResult.error ||
        !alarmResult.data
      ) {
        await supabase
          .from("calendar_events")
          .delete()
          .eq("id", eventId)
          .eq("user_id", userId)
          .eq("case_id", plan.caseId);

        throw new Error(
          alarmResult.error?.message ||
          "Hatırlatma alarmı oluşturulamadı."
        );
      }

      return alarmResult.data as
        ManualReminderRecord;
    },

    async list(
      userId,
      caseId
    ) {
      const result =
        await supabase
          .from("alarms")
          .select(
            "id,case_id,calendar_event_id,alarm_time,alarm_type,message,status"
          )
          .eq("user_id", userId)
          .eq("case_id", caseId)
          .eq(
            "alarm_type",
            MANUAL_REMINDER_EVENT_TYPE
          )
          .order("alarm_time", {
            ascending: true,
          });

      if (result.error) {
        throw new Error(
          result.error.message
        );
      }

      return (result.data || []) as
        ManualReminderRecord[];
    },
  };
}

async function requireUser() {
  const { appUser, error } =
    await getOrCreateAppUser();

  if (error || !appUser) {
    return {
      appUser: null,
      response: NextResponse.json(
        {
          ok: false,
          error:
            "Kullanıcı oturumu bulunamadı.",
        },
        { status: 401 }
      ),
    };
  }

  return {
    appUser,
    response: null,
  };
}

export async function GET(
  request: Request
) {
  try {
    const auth =
      await requireUser();

    if (
      auth.response ||
      !auth.appUser
    ) {
      return auth.response;
    }

    const caseId =
      new URL(request.url)
        .searchParams
        .get("caseId")
        ?.trim() || "";
    const store =
      createStore(
        getSupabaseAdmin()
      );
    const reminders =
      await listOwnedManualReminders(
        store,
        auth.appUser.id,
        caseId
      );

    if (!reminders) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dava bulunamadı.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      reminders,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Hatırlatmalar alınamadı.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const auth =
      await requireUser();

    if (
      auth.response ||
      !auth.appUser
    ) {
      return auth.response;
    }

    const body =
      await request.json();
    const store =
      createStore(
        getSupabaseAdmin()
      );
    const result =
      await createOwnedManualReminder(
        store,
        auth.appUser.id,
        {
          caseId: body.caseId,
          date: body.date,
          time: body.time,
          note: body.note,
        }
      );

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dava bulunamadı.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      duplicate:
        result.duplicate,
      message:
        result.duplicate
          ? "Bu hatırlatma zaten kayıtlı."
          : "Manuel hatırlatma kaydedildi.",
      reminder:
        result.reminder,
    });
  } catch (error) {
    if (
      error instanceof
        ManualReminderValidationError
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          "Hatırlatma kaydedilemedi. Lütfen tekrar deneyin.",
      },
      { status: 500 }
    );
  }
}
