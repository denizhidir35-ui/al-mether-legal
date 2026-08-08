import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateAppUser } from "@/lib/alUser";

import {
  createUetsRecordIdentity,
  isReliableUetsIdentity,
} from "@/lib/legal/UetsRecordIdentity";

import { createLegalAlarmEngine } from "@/lib/calendar/LegalAlarmEngine";
import { LegalAlarmStore } from "@/lib/calendar/LegalAlarmStore";

type RecordMode =
  | "deemed_service"
  | "verified_deadline"
  | "manual_date";

function safeText(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function safeBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function normalizeRisk(
  risk?: string | null
): string {
  const value = (risk || "")
    .toLocaleLowerCase("tr-TR");

  if (
    value.includes("kritik") ||
    value.includes("critical")
  ) {
    return "critical";
  }

  if (
    value.includes("yüksek") ||
    value.includes("high")
  ) {
    return "high";
  }

  if (
    value.includes("düşük") ||
    value.includes("low")
  ) {
    return "low";
  }

  return "normal";
}

function isIsoDate(value: string): boolean {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12,
      0,
      0
    )
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function resolveRecordMode(
  body: Record<string, unknown>
): RecordMode {
  const explicitMode =
    safeText(body.record_mode);

  if (
    explicitMode === "deemed_service" ||
    explicitMode === "verified_deadline" ||
    explicitMode === "manual_date"
  ) {
    return explicitMode;
  }

  const deadlineVerified =
    safeBoolean(body.deadline_verified);

  if (deadlineVerified) {
    return "verified_deadline";
  }

  const hasUetsEvidence = Boolean(
    safeText(body.barcode_no) ||
      safeText(body.arrival_date) ||
      safeText(body.teblig_tarihi)
  );

  if (hasUetsEvidence) {
    return "deemed_service";
  }

  return "manual_date";
}

function createFallbackDedupeKey(
  gmailMessageId: string
): string {
  if (gmailMessageId) {
    return `gmail-${gmailMessageId}`;
  }

  return `request-${crypto.randomUUID()}`;
}

export async function POST(
  request: Request
) {
  try {
    const supabase =
      getSupabaseAdmin();

    const {
      appUser,
      error: userError,
    } = await getOrCreateAppUser();

    if (userError || !appUser) {
      return NextResponse.json(
        {
          ok: false,
          error:
            userError ||
            "Kullanıcı oturumu bulunamadı.",
        },
        { status: 401 }
      );
    }

    const body =
      (await request.json()) as Record<
        string,
        unknown
      >;

    const caseNumber =
      safeText(body.case_number) ||
      safeText(body.dosya_no);

    const courtName =
      safeText(body.court_name) ||
      safeText(body.mahkeme);

    const subject =
      safeText(body.subject);

    const cleanCaseLabel = [
      "Elektronik Tebligat",
      courtName,
      caseNumber,
    ]
      .filter(Boolean)
      .join(" — ");

    const title =
      safeText(body.case_title) ||
      safeText(body.title) ||
      cleanCaseLabel ||
      "Elektronik Tebligat";

    const sender =
      safeText(body.sender);

    const gmailMessageId =
      safeText(body.gmail_message_id) ||
      safeText(body.email_id) ||
      safeText(body.message_id);

    const gmailThreadId =
      safeText(body.gmail_thread_id) ||
      safeText(body.thread_id);

    const arrivalDate =
      safeText(body.arrival_date) ||
      safeText(body.notification_date) ||
      safeText(body.teblig_tarihi);

    const arrivalTime =
      safeText(body.arrival_time);

    const barcodeNo =
      safeText(body.barcode_no);

    const institution =
      safeText(body.institution) ||
      safeText(body.kurum) ||
      "PTT UETS";

    const calculatedDate =
      safeText(body.calculated_due_date) ||
      safeText(body.deadline_date) ||
      safeText(body.son_tarih) ||
      safeText(body.deemed_service_date);

    const recordMode =
      resolveRecordMode(body);

    if (
      calculatedDate &&
      !isIsoDate(calculatedDate)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Takvim tarihi YYYY-MM-DD biçiminde olmalıdır.",
        },
        { status: 400 }
      );
    }

    const riskLevel =
      normalizeRisk(
        safeText(body.risk) ||
          safeText(body.risk_level)
      );

    const identity =
      createUetsRecordIdentity({
        barcodeNo,
        fileNo: caseNumber,
        court: courtName,
        institution,

        arrivalDate,
        arrivalTime,

        deemedServiceDate:
          recordMode ===
          "deemed_service"
            ? calculatedDate
            : "",

        subject,
        sender,

        gmailMessageId,
        gmailThreadId,

        sourceText:
          safeText(body.mail_body),
      });

    const reliableIdentity =
      isReliableUetsIdentity(identity);

    const dedupeKey =
      reliableIdentity
        ? identity.identityKey
        : createFallbackDedupeKey(
            gmailMessageId
          );

    const eventType =
      recordMode === "deemed_service"
        ? "deemed_service"
        : recordMode ===
            "verified_deadline"
          ? "legal_deadline"
          : "manual_date";

    /*
     * Aynı UETS tebligatı daha önce işlendi mi?
     *
     * source_mail_id alanına Gmail mesaj kimliği yerine
     * sabit UETS kimliği yazıyoruz. Böylece aynı tebligat
     * yüzlerce kez forward edilse bile ikinci kayıt oluşmaz.
     */
    const existingEventResult =
      await supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", appUser.id)
        .eq("source_mail_id", dedupeKey)
        .eq("event_type", eventType)
        .maybeSingle();

    if (existingEventResult.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            existingEventResult.error
              .message,
        },
        { status: 500 }
      );
    }

    if (existingEventResult.data) {
      let resolvedExistingEvent =
        existingEventResult.data;

      if (!resolvedExistingEvent.raw) {
        const updatedEventResult =
          await supabase
            .from("calendar_events")
            .update({
              raw: {
                gmailMessageId,
                gmailThreadId,
                subject,
                sender,
                receivedAt:
                  safeText(
                    body.received_at
                  ),
                snippet:
                  safeText(
                    body.snippet
                  ),
                mailBody:
                  safeText(
                    body.mail_body
                  ),
                aiSummary:
                  safeText(
                    body.ai_summary
                  ) ||
                  safeText(
                    body.summary
                  ),
                court:
                  courtName,
                caseNumber,
                institution,
                barcodeNo,
                arrivalDate,
                arrivalTime,
                deemedServiceDate:
                  recordMode ===
                  "deemed_service"
                    ? calculatedDate
                    : "",
              },
            })
            .eq(
              "id",
              resolvedExistingEvent.id
            )
            .select("*")
            .single();

        if (updatedEventResult.error) {
          return NextResponse.json(
            {
              ok: false,
              error:
                updatedEventResult.error.message,
            },
            { status: 500 }
          );
        }

        resolvedExistingEvent =
          updatedEventResult.data;
      }

      const existingDeadlineResult =
        await supabase
          .from("legal_deadlines")
          .select("*")
          .eq(
            "calendar_event_id",
            resolvedExistingEvent.id
          )
          .maybeSingle();

      return NextResponse.json({
        ok: true,
        duplicate: true,
        recordMode,

        message:
          "Bu tebligat daha önce işlendi. Yeni takvim veya alarm kaydı oluşturulmadı.",

        identity: {
          identityKey:
            identity.identityKey,
          fingerprint:
            identity.fingerprint,
          strength:
            identity.strength,
          warnings:
            identity.warnings,
        },

        case: null,
        deadline:
          existingDeadlineResult.data ||
          null,

        calendarEvent:
          resolvedExistingEvent,

        alarms: null,
      });
    }

    let legalCase:
      | Record<string, any>
      | null = null;

    if (caseNumber) {
      const foundCase =
        await supabase
          .from("legal_cases")
          .select("*")
          .eq(
            "user_id",
            appUser.id
          )
          .eq(
            "case_number",
            caseNumber
          )
          .maybeSingle();

      if (foundCase.error) {
        return NextResponse.json(
          {
            ok: false,
            error:
              foundCase.error.message,
          },
          { status: 500 }
        );
      }

      legalCase =
        foundCase.data;
    }

    if (!legalCase) {
      const createdCase =
        await supabase
          .from("legal_cases")
          .insert({
            user_id:
              appUser.id,

            case_number:
              caseNumber || null,

            court_name:
              courtName || null,

            case_title:
              title,

            case_type:
              safeText(
                body.case_type
              ) ||
              safeText(
                body.dava_turu
              ) ||
              "Tebligat",

            status: "active",

            risk_level:
              riskLevel,

            source:
              recordMode ===
              "deemed_service"
                ? "gmail_uets"
                : "manual",
          })
          .select("*")
          .single();

      if (createdCase.error) {
        return NextResponse.json(
          {
            ok: false,
            error:
              createdCase.error
                .message,
          },
          { status: 500 }
        );
      }

      legalCase =
        createdCase.data;
    }

    if (!legalCase) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Tebligat için dosya kaydı oluşturulamadı.",
        },
        { status: 500 }
      );
    }

    const resolvedLegalCase = legalCase;

    /*
     * Aynı Gmail mesajını da tekrar case_mails tablosuna
     * yazmıyoruz. Forward edilmiş farklı Gmail mesajları
     * arşivlenebilir; ancak takvim kaydı yine tek kalır.
     */
    if (
      gmailMessageId ||
      subject
    ) {
      let mailAlreadyExists = false;

      if (gmailMessageId) {
        const foundMail =
          await supabase
            .from("case_mails")
            .select("id")
            .eq(
              "user_id",
              appUser.id
            )
            .eq(
              "gmail_message_id",
              gmailMessageId
            )
            .maybeSingle();

        if (foundMail.error) {
          return NextResponse.json(
            {
              ok: false,
              error:
                foundMail.error
                  .message,
            },
            { status: 500 }
          );
        }

        mailAlreadyExists =
          Boolean(foundMail.data);
      }

      if (!mailAlreadyExists) {
        const mailInsert =
          await supabase
            .from("case_mails")
            .insert({
              user_id:
                appUser.id,

              case_id:
                resolvedLegalCase.id,

              gmail_message_id:
                gmailMessageId ||
                null,

              subject:
                subject || title,

              sender:
                sender || null,

              received_at:
                safeText(
                  body.received_at
                ) || null,

              snippet:
                safeText(
                  body.snippet
                ) || null,

              body:
                safeText(
                  body.mail_body
                ) || null,

              ai_summary:
                safeText(
                  body.ai_summary
                ) ||
                safeText(
                  body.summary
                ) ||
                null,
            });

        if (mailInsert.error) {
          return NextResponse.json(
            {
              ok: false,
              error:
                mailInsert.error
                  .message,
            },
            { status: 500 }
          );
        }
      }
    }

    if (!calculatedDate) {
      return NextResponse.json({
        ok: true,
        duplicate: false,
        recordMode,

        message:
          "Tebligat kaydı oluşturuldu ancak takvime yazılacak kesin bir tarih bulunamadı.",

        identity: {
          identityKey:
            identity.identityKey,
          fingerprint:
            identity.fingerprint,
          strength:
            identity.strength,
          warnings:
            identity.warnings,
        },

        case: resolvedLegalCase,
        deadline: null,
        calendarEvent: null,
        alarms: null,
      });
    }

    const calendarTitle =
      recordMode === "deemed_service"
        ? `${title} — Tebliğ edilmiş sayılma`
        : title;

    const createdEvent =
      await supabase
        .from("calendar_events")
        .insert({
          user_id:
            appUser.id,

          case_id:
            resolvedLegalCase.id,

          title:
            calendarTitle,

          description:
            safeText(
              body.ai_summary
            ) ||
            safeText(
              body.summary
            ) ||
            (recordMode ===
            "deemed_service"
              ? "Elektronik tebligatın tebliğ edilmiş sayılma tarihidir. Hukuki cevap veya itiraz süresinin son günü değildir."
              : null),

          event_type:
            eventType,

          start_date:
            calculatedDate,

          end_date:
            calculatedDate,

          due_date:
            calculatedDate,

          status:
            "active",

          priority:
            riskLevel,

          source:
            recordMode ===
            "deemed_service"
              ? "gmail_uets"
              : "verified_rule",

          source_mail_id:
            dedupeKey,

          raw: {
            gmailMessageId,
            gmailThreadId,
            subject,
            sender,
            receivedAt:
              safeText(
                body.received_at
              ),
            snippet:
              safeText(
                body.snippet
              ),
            mailBody:
              safeText(
                body.mail_body
              ),
            aiSummary:
              safeText(
                body.ai_summary
              ) ||
              safeText(
                body.summary
              ),
            court:
              courtName,
            caseNumber,
            institution,
            barcodeNo,
            arrivalDate,
            arrivalTime,
            deemedServiceDate:
              recordMode ===
              "deemed_service"
                ? calculatedDate
                : "",
          },
        })
        .select("*")
        .single();

    if (createdEvent.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            createdEvent.error
              .message,
        },
        { status: 500 }
      );
    }

    /*
     * UETS +5 sonucu yalnızca tebliğ edilmiş sayılma
     * tarihidir. Bu yüzden burada legal_deadline ve
     * “son güne X gün kaldı” alarmı oluşturulmaz.
     */
    if (
      recordMode !==
      "verified_deadline"
    ) {
      return NextResponse.json({
        ok: true,
        duplicate: false,
        recordMode,

        message:
          recordMode ===
          "deemed_service"
            ? "Tebliğ edilmiş sayılma tarihi kendi takviminize kaydedildi. Hukuki son gün hesabı yapılmadı."
            : "Tarih kendi takviminize kaydedildi.",

        identity: {
          identityKey:
            identity.identityKey,
          fingerprint:
            identity.fingerprint,
          strength:
            identity.strength,
          warnings:
            identity.warnings,
        },

        case: resolvedLegalCase,
        deadline: null,

        calendarEvent:
          createdEvent.data,

        alarms: null,
      });
    }

    /*
     * Bu bölüm yalnızca dışarıdan doğrulanmış bir hukuk
     * kuralı ile deadline_verified=true gönderildiğinde
     * çalışır.
     */
    const createdDeadline =
      await supabase
        .from("legal_deadlines")
        .insert({
          user_id:
            appUser.id,

          case_id:
            resolvedLegalCase.id,

          title,

          notification_date:
            safeText(
              body.notification_date
            ) ||
            arrivalDate ||
            null,

          start_date:
            safeText(
              body.start_date
            ) ||
            safeText(
              body.baslangic_tarihi
            ) ||
            null,

          calculated_due_date:
            calculatedDate,

          legal_basis:
            safeText(
              body.legal_basis
            ) ||
            safeText(
              body.kanuni_dayanak
            ) ||
            null,

          deadline_days:
            body.deadline_days ||
            body.sure_gun ||
            null,

          deadline_type:
            safeText(
              body.deadline_type
            ) ||
            safeText(
              body.sure_tipi
            ) ||
            null,

          rule_used:
            safeText(
              body.rule_used
            ) ||
            null,

          ai_confidence:
            body.ai_confidence ||
            body.confidence ||
            null,

          calendar_event_id:
            createdEvent.data.id,

          status:
            "open",
        })
        .select("*")
        .single();

    if (createdDeadline.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            createdDeadline.error
              .message,
        },
        { status: 500 }
      );
    }

    const alarmEngine =
      createLegalAlarmEngine();

    const alarmPlan =
      alarmEngine.createPlan({
        userId:
          appUser.id,

        deadlineId:
          createdDeadline.data.id,

        calendarEventId:
          createdEvent.data.id,

        caseId:
          resolvedLegalCase.id,

        title,

        deadlineDate:
          calculatedDate,

        court:
          courtName,

        fileNo:
          caseNumber,

        eventType:
          eventType,

        reminderDays: [
          14,
          7,
          5,
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
          true,

        skipPastAdvanceAlarms:
          true,
      });

    const alarmStoreResult =
      await LegalAlarmStore.replacePlan(
        alarmPlan
      );

    if (!alarmStoreResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            alarmStoreResult.error ||
            "Alarm planı kaydedilemedi.",

          case: resolvedLegalCase,
          deadline:
            createdDeadline.data,

          calendarEvent:
            createdEvent.data,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      duplicate: false,
      recordMode,

      message:
        "Doğrulanmış hukuki son tarih ve alarm planı kendi takviminize kaydedildi.",

      identity: {
        identityKey:
          identity.identityKey,
        fingerprint:
          identity.fingerprint,
        strength:
          identity.strength,
        warnings:
          identity.warnings,
      },

      case:
        legalCase,

      deadline:
        createdDeadline.data,

      calendarEvent:
        createdEvent.data,

      alarms: {
        plan:
          alarmPlan.summary,

        inserted:
          alarmStoreResult.inserted,

        deleted:
          alarmStoreResult.deleted,

        records:
          alarmStoreResult.alarms,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Tebligat kaydı oluşturulamadı.",
      },
      { status: 500 }
    );
  }
}




