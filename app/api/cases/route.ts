import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateAppUser } from "@/lib/alUser";
import { isTestOrDevRecord } from "@/lib/testRecordVisibility";
import { isValidManualDate } from "@/lib/legal/manualCaseCalendar";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { appUser, error } = await getOrCreateAppUser();

  if (error || !appUser) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { data, error: dbError } = await supabase
    .from("legal_cases")
    .select(`
      *,
      legal_deadlines (
        id,
        title,
        calculated_due_date,
        status,
        ai_confidence,
        calendar_event_id
      ),
      case_mails (
        id,
        subject,
        sender,
        received_at,
        gmail_message_id
      )
    `)
    .eq("user_id", appUser.id)
    .order("created_at", { ascending: false });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const { data: caseCalendarEvents, error: caseCalendarError } =
    await supabase
      .from("calendar_events")
      .select("id,case_id,title,event_type,start_date,due_date,raw")
      .eq("user_id", appUser.id)
      .in("event_type", [
        "deemed_service",
        "payment_deadline",
        "hearing",
        "manual_deadline",
        "mail_received",
      ]);

  if (caseCalendarError) {
    return NextResponse.json(
      { error: caseCalendarError.message },
      { status: 500 }
    );
  }

  const cases = (data || [])
    .filter(
      (legalCase) =>
        !isTestOrDevRecord({
          source: legalCase.source,
          title: legalCase.case_title,
        }) &&
        !legalCase.case_mails?.some((mail: { subject?: string | null }) =>
          isTestOrDevRecord({ subject: mail.subject })
        )
    )
    .map((legalCase) => {
      const caseEvents =
        (caseCalendarEvents || []).filter(
          (event) => event.case_id === legalCase.id
        );
      const paymentRecords =
        new Map<string, Record<string, unknown>>();
      const mailReceivedRecords =
        new Map<string, Record<string, unknown>>();

      for (const event of caseEvents) {
        const raw =
          event.raw && typeof event.raw === "object"
            ? event.raw as Record<string, unknown>
            : null;
        const payment =
          raw?.payment && typeof raw.payment === "object"
            ? raw.payment as Record<string, unknown>
            : null;

        if (!payment) {
          if (
            event.event_type ===
              "mail_received" &&
            raw
          ) {
            const providerMessageId =
              typeof raw.providerMessageId ===
                "string"
                ? raw.providerMessageId
                : "";

            if (providerMessageId) {
              mailReceivedRecords.set(
                providerMessageId,
                raw
              );
            }
          }

          continue;
        }

        const key =
          typeof raw?.paymentDedupeKey === "string"
            ? raw.paymentDedupeKey
            : event.id;

        paymentRecords.set(key, {
          ...payment,
          calendarEventId:
            event.event_type === "payment_deadline"
              ? event.id
              : null,
        });
      }

      return {
        ...legalCase,
        case_mails:
          (legalCase.case_mails || [])
            .map((mail: Record<string, unknown>) => {
              const messageId =
                typeof mail.gmail_message_id ===
                  "string"
                  ? mail.gmail_message_id
                  : "";
              const received =
                mailReceivedRecords.get(
                  messageId
                );
              const sourceAccount =
                received?.sourceAccount &&
                typeof received.sourceAccount ===
                  "object"
                  ? received.sourceAccount as Record<string, unknown>
                  : null;

              return {
                ...mail,
                received_at:
                  typeof received?.receivedAt ===
                    "string"
                    ? received.receivedAt
                    : mail.received_at,
                mail_account_id:
                  typeof sourceAccount?.accountId ===
                    "string"
                    ? sourceAccount.accountId
                    : null,
                mail_account_email:
                  typeof sourceAccount?.emailAddress ===
                    "string"
                    ? sourceAccount.emailAddress
                    : null,
                mail_provider:
                  typeof sourceAccount?.provider ===
                    "string"
                    ? sourceAccount.provider
                    : null,
              };
            }),
        deemed_service_events: caseEvents.filter(
          (event) => event.event_type === "deemed_service"
        ),
        payment_reminders:
          Array.from(paymentRecords.values()),
        manual_calendar_events:
          caseEvents.filter(
            (event) =>
              event.event_type ===
                "hearing" ||
              event.event_type ===
                "manual_deadline"
          ),
        mail_received_events:
          caseEvents.filter(
            (event) =>
              event.event_type ===
              "mail_received"
          ),
      };
    });

  return NextResponse.json({ cases });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  const { appUser, error } = await getOrCreateAppUser();

  if (error || !appUser) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const body = await request.json();

  const caseTitle = body.case_title?.toString()?.trim();

  if (!caseTitle) {
    return NextResponse.json(
      { error: "Dosya başlığı zorunludur." },
      { status: 400 }
    );
  }

  const caseRecordDate =
    body.case_record_date
      ?.toString()
      .trim() || "";

  if (
    caseRecordDate &&
    !isValidManualDate(
      caseRecordDate
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Dava kayıt tarihi geçersiz.",
      },
      { status: 400 }
    );
  }

  const note =
    body.note
      ?.toString()
      .trim() || "";

  const caseNumber =
    body.case_number
      ?.toString()
      .trim() || "";

  const courtName =
    body.court_name
      ?.toString()
      .trim() || "";

  const documentIdentity =
    body.document_identity
      ?.toString()
      .trim()
      .toLocaleLowerCase("tr-TR") ||
    "";

  const isDocumentUpload =
    body.source ===
      "document_upload";

  if (
    isDocumentUpload &&
    documentIdentity &&
    !/^[a-f0-9]{64}$/.test(
      documentIdentity
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Belge kimliği geçersiz.",
      },
      { status: 400 }
    );
  }

  /*
   * 1) Aynı fiziksel belge daha önce
   * işlendi mi?
   */
  if (
    isDocumentUpload &&
    documentIdentity
  ) {
    const existingDocument =
      await supabase
        .from("legal_cases")
        .select("*")
        .eq(
          "user_id",
          appUser.id
        )
        .eq(
          "source",
          `document_upload:${documentIdentity}`
        )
        .limit(1)
        .maybeSingle();

    if (existingDocument.error) {
      return NextResponse.json(
        {
          error:
            existingDocument
              .error.message,
        },
        { status: 500 }
      );
    }

    if (existingDocument.data) {
      return NextResponse.json({
        case:
          existingDocument.data,
        duplicate: true,
        duplicateReason:
          "document_identity",
      });
    }
  }

  /*
   * 2) Aynı dava zaten mevcut mu?
   *
   * Esas no tek başına yeterli değil.
   * Farklı mahkemelerde aynı esas no
   * bulunabilir.
   *
   * Bu nedenle otomatik eşleşme için
   * Mahkeme + Esas No birlikte şart.
   */
  if (
    isDocumentUpload &&
    caseNumber &&
    courtName
  ) {
    const existingCase =
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
        .ilike(
          "court_name",
          courtName
        )
        .limit(1)
        .maybeSingle();

    if (existingCase.error) {
      return NextResponse.json(
        {
          error:
            existingCase
              .error.message,
        },
        { status: 500 }
      );
    }

    if (existingCase.data) {
      return NextResponse.json({
        case:
          existingCase.data,
        duplicate: true,
        duplicateReason:
          "case_identity",
      });
    }
  }

  const { data, error: dbError } = await supabase
    .from("legal_cases")
    .insert({
      user_id: appUser.id,
      case_number: caseNumber || null,
      court_name: body.court_name || null,
      case_title: caseTitle,
      case_type: body.case_type || null,
      status: body.status || "active",
      risk_level: body.risk_level || "normal",
      source:
        isDocumentUpload &&
        documentIdentity
          ? `document_upload:${documentIdentity}`
          : body.source || "manual",
      ...(caseRecordDate
        ? {
            created_at:
              new Date(
                `${caseRecordDate}T12:00:00+03:00`
              ).toISOString(),
          }
        : {}),
    })
    .select("*")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (note) {
    const noteResult =
      await supabase
        .from("case_notes")
        .upsert(
          {
            user_id:
              appUser.id,
            case_id: data.id,
            note_text: note,
            updated_at:
              new Date()
                .toISOString(),
          },
          {
            onConflict:
              "user_id,case_id",
          }
        );

    if (noteResult.error) {
      return NextResponse.json(
        {
          error:
            noteResult.error
              .message,
          case: data,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    case: data,
    duplicate: false,
  });
}
