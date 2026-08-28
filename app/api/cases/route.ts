import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateAppUser } from "@/lib/alUser";
import { isTestOrDevRecord } from "@/lib/testRecordVisibility";
import { isValidManualDate } from "@/lib/legal/manualCaseCalendar";

function normalizeCaseIdentityCourt(
  value: string
) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9]+/g,
      ""
    )
    .trim();
}

function normalizeCaseIdentityNumber(
  value: string
) {
  const match =
    value
      .replace(/\s+/g, "")
      .match(
        /(\d{4}\/\d+)/
      );

  return match?.[1] || "";
}

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
    return NextResponse.json(
      {
        error:
          dbError.message,
      },
      { status: 500 }
    );
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

  const caseTitle =
    body.case_title
      ?.toString()
      ?.trim() || "";

  const isDocumentUpload =
    body.source ===
      "document_upload";

  if (
    !caseTitle &&
    !isDocumentUpload
  ) {
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
  const normalizedCaseIdentityNumber =
    normalizeCaseIdentityNumber(
      caseNumber
    );

  const normalizedCaseIdentityCourt =
    normalizeCaseIdentityCourt(
      courtName
    );

  const documentIdentity =
    body.document_identity
      ?.toString()
      .trim()
      .toLocaleLowerCase("tr-TR") ||
    "";

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
    const existingDocumentRecord =
      await supabase
        .from(
          "case_document_records"
        )
        .select("case_id")
        .eq(
          "user_id",
          appUser.id
        )
        .eq(
          "document_identity",
          documentIdentity
        )
        .limit(1)
        .maybeSingle();

    if (
      existingDocumentRecord.error
    ) {
      return NextResponse.json(
        {
          error:
            existingDocumentRecord
              .error.message,
        },
        { status: 500 }
      );
    }

    if (
      existingDocumentRecord.data
    ) {
      const recordedCase =
        await supabase
          .from("legal_cases")
          .select("*")
          .eq(
            "id",
            existingDocumentRecord
              .data.case_id
          )
          .eq(
            "user_id",
            appUser.id
          )
          .maybeSingle();

      if (recordedCase.error) {
        return NextResponse.json(
          {
            error:
              recordedCase.error
                .message,
          },
          { status: 500 }
        );
      }

      if (recordedCase.data) {
        return NextResponse.json({
          case:
            recordedCase.data,
          duplicate: true,
          duplicateReason:
            "document_record_identity",
          enriched: false,
        });
      }
    }

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
      const existing =
        existingDocument.data;

      const existingTitle =
        existing.case_title
          ?.toString()
          .trim() || "";

      const existingType =
        existing.case_type
          ?.toString()
          .trim() || "";

      const incomingTitle =
        caseTitle.trim();

      const incomingType =
        body.case_type
          ?.toString()
          .trim() || "";

      const normalizedExistingTitle =
        existingTitle
          .toLocaleLowerCase(
            "tr-TR"
          );

      const weakExistingTitle =
        !existingTitle ||
        existingTitle ===
          caseNumber ||
        [
          "hukuki dava",
          "tebligat",
          "elektronik tebligat",
        ].includes(
          normalizedExistingTitle
        );

      const bestIncomingTitle =
        incomingTitle &&
        incomingTitle !==
          caseNumber
          ? incomingTitle
          : incomingType;

      const updates:
        Record<
          string,
          string
        > = {};

      if (
        weakExistingTitle &&
        bestIncomingTitle &&
        bestIncomingTitle !==
          caseNumber
      ) {
        updates.case_title =
          bestIncomingTitle;
      }

      const normalizedExistingType =
        existingType
          .toLocaleLowerCase(
            "tr-TR"
          );

      if (
        incomingType &&
        (
          !existingType ||
          normalizedExistingType ===
            "tebligat" ||
          normalizedExistingType ===
            "hukuki dava"
        )
      ) {
        updates.case_type =
          incomingType;
      }

      let resolvedCase =
        existing;

      if (
        Object.keys(
          updates
        ).length > 0
      ) {
        const enrichedDocumentCase =
          await supabase
            .from(
              "legal_cases"
            )
            .update(
              updates
            )
            .eq(
              "id",
              existing.id
            )
            .eq(
              "user_id",
              appUser.id
            )
            .select("*")
            .single();

        if (
          enrichedDocumentCase.error
        ) {
          return NextResponse.json(
            {
              error:
                enrichedDocumentCase
                  .error
                  .message,
            },
            {
              status: 500,
            }
          );
        }

        resolvedCase =
          enrichedDocumentCase.data;
      }

      return NextResponse.json({
        case:
          resolvedCase,
        duplicate: true,
        duplicateReason:
          "document_identity",
        enriched:
          Object.keys(
            updates
          ).length > 0,
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
          "normalized_case_number",
          normalizedCaseIdentityNumber
        )
        .eq(
          "normalized_court",
          normalizedCaseIdentityCourt
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
      const existing =
        existingCase.data;

      const existingTitle =
        existing.case_title
          ?.toString()
          .trim() || "";

      const existingType =
        existing.case_type
          ?.toString()
          .trim() || "";

      const incomingTitle =
        caseTitle.trim();

      const incomingType =
        body.case_type
          ?.toString()
          .trim() || "";

      const normalizedExistingTitle =
        existingTitle
          .toLocaleLowerCase(
            "tr-TR"
          );

      /*
       * Mevcut davayı yalnızca zayıf /
       * otomatik alanlar için zenginleştir.
       *
       * Kullanıcının elle yazdığı güçlü
       * başlıkların üzerine yazılmaz.
       */
      const weakExistingTitle =
        !existingTitle ||
        existingTitle ===
          caseNumber ||
        [
          "hukuki dava",
          "tebligat",
          "elektronik tebligat",
        ].includes(
          normalizedExistingTitle
        );

      const bestIncomingTitle =
        incomingTitle &&
        incomingTitle !==
          caseNumber
          ? incomingTitle
          : incomingType;

      const updates:
        Record<
          string,
          string
        > = {};

      if (
        weakExistingTitle &&
        bestIncomingTitle &&
        bestIncomingTitle !==
          caseNumber
      ) {
        updates.case_title =
          bestIncomingTitle;
      }

      const normalizedExistingType =
        existingType
          .toLocaleLowerCase(
            "tr-TR"
          );

      if (
        incomingType &&
        (
          !existingType ||
          normalizedExistingType ===
            "tebligat" ||
          normalizedExistingType ===
            "hukuki dava"
        )
      ) {
        updates.case_type =
          incomingType;
      }

      let resolvedCase =
        existing;

      if (
        Object.keys(
          updates
        ).length > 0
      ) {
        const enrichedCase =
          await supabase
            .from(
              "legal_cases"
            )
            .update(
              updates
            )
            .eq(
              "id",
              existing.id
            )
            .eq(
              "user_id",
              appUser.id
            )
            .select("*")
            .single();

        if (
          enrichedCase.error
        ) {
          return NextResponse.json(
            {
              error:
                enrichedCase
                  .error
                  .message,
            },
            {
              status: 500,
            }
          );
        }

        resolvedCase =
          enrichedCase.data;
      }

      return NextResponse.json({
        case:
          resolvedCase,
        duplicate: true,
        duplicateReason:
          "case_identity",
        enriched:
          Object.keys(
            updates
          ).length > 0,
      });
    }
  }

  const { data, error: dbError } = await supabase
    .from("legal_cases")
    .insert({
      user_id: appUser.id,
      case_number: caseNumber || null,
      court_name: body.court_name || null,
      case_title:
        caseTitle || null,
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
    /*
     * PostgreSQL 23505:
     *
     * İki istek aynı davayı aynı anda oluşturmaya çalışmış olabilir.
     * DB unique index ikinci insert'i reddeder.
     *
     * Bu durumda hata üretmek yerine DB'de kazanan kaydı döndür.
     */
    if (
      dbError.code === "23505" &&
      normalizedCaseIdentityNumber &&
      normalizedCaseIdentityCourt
    ) {
      const racedCase =
        await supabase
          .from("legal_cases")
          .select("*")
          .eq(
            "user_id",
            appUser.id
          )
          .eq(
            "normalized_case_number",
            normalizedCaseIdentityNumber
          )
          .eq(
            "normalized_court",
            normalizedCaseIdentityCourt
          )
          .limit(1)
          .maybeSingle();

      if (racedCase.error) {
        return NextResponse.json(
          {
            error:
              racedCase.error.message,
          },
          { status: 500 }
        );
      }

      if (racedCase.data) {
        return NextResponse.json({
          case:
            racedCase.data,
          duplicate: true,
          duplicateReason:
            "case_identity_race",
          enriched: false,
        });
      }
    }

    return NextResponse.json(
      {
        error:
          dbError.message,
      },
      { status: 500 }
    );
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
