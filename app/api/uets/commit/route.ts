import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

export const runtime =
  "nodejs";

function safeText(
  value: unknown,
  max = 5000
) {
  return typeof value ===
    "string"
    ? value
        .trim()
        .slice(
          0,
          max
        )
    : "";
}

function validIsoDate(
  value: string
) {
  return /^\d{4}-\d{2}-\d{2}$/
    .test(value);
}

function validTime(
  value: string
) {
  return /^([01]\d|2[0-3]):[0-5]\d$/
    .test(value);
}

function createSourceKey(
  input: {
    url: string;
    court: string;
    fileNo: string;
    date: string;
    time: string;
  }
) {
  return [
    "uets-hearing",
    input.url,
    input.court,
    input.fileNo,
    input.date,
    input.time,
  ]
    .filter(Boolean)
    .join("|")
    .slice(
      0,
      2000
    );
}

export async function POST(
  request: NextRequest
) {
  try {
    const {
      appUser,
      error,
    } =
      await getOrCreateAppUser();

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
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    /*
     * CLIENT'TAN GELEN calendarSafe DEĞERİNE
     * TEK BAŞINA GÜVENMİYORUZ.
     */

    const isTest =
      body?.isTest === true;

    const court =
      safeText(
        body?.court,
        500
      );

    const fileNo =
      safeText(
        body?.fileNo,
        200
      );

    const date =
      safeText(
        body?.date,
        20
      );

    const time =
      safeText(
        body?.time,
        10
      );

    const evidence =
      safeText(
        body?.evidence,
        2000
      );

    const sourceUrl =
      safeText(
        body?.sourceUrl,
        3000
      );

    const capturedText =
      safeText(
        body?.capturedText,
        100000
      );

    if (isTest) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason:
          "test_document",
        calendarEvent: null,
        message:
          "Test belgesi takvime kaydedilmedi.",
      });
    }

    /*
     * UETS dışı kaynak kabul edilmez.
     */
    if (
      !sourceUrl.startsWith(
        "https://ptt.etebligat.gov.tr/"
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Geçersiz UETS kaynağı.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Belgede açık duruşma bilgisi şart.
     */
    if (
      !court ||
      !fileNo ||
      !validIsoDate(
        date
      ) ||
      !validTime(
        time
      ) ||
      !evidence
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Duruşma bilgisi otomatik takvim kaydı için yeterince açık değil.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Evidence içerisinde hem tarih hem de
     * duruşma/celse bağlamı bulunmalı.
     */
    const evidenceLower =
      evidence.toLocaleLowerCase(
        "tr-TR"
      );

    if (
      !evidenceLower.includes(
        "duruşma"
      ) &&
      !evidenceLower.includes(
        "celse"
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Duruşma kanıt metni doğrulanamadı.",
        },
        {
          status: 400,
        }
      );
    }

    const sourceKey =
      createSourceKey({
        url:
          sourceUrl,
        court,
        fileNo,
        date,
        time,
      });

    const supabase =
      getSupabaseAdmin();

    /*
     * AYNI TEBLİGAT AYNI DURUŞMAYI
     * İKİ KEZ EKLEMESİN.
     */
    const existing =
      await supabase
        .from(
          "calendar_events"
        )
        .select("*")
        .eq(
          "user_id",
          appUser.id
        )
        .eq(
          "source_mail_id",
          sourceKey
        )
        .eq(
          "event_type",
          "hearing"
        )
        .maybeSingle();

    if (existing.error) {
      throw new Error(
        existing.error.message
      );
    }

    if (existing.data) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        calendarEvent:
          existing.data,

        message:
          `${date} ${time} duruşması zaten takvimde.`,
      });
    }

    const title =
      `Duruşma — ${court} — ${fileNo}`;

    const description =
      `${court} ${fileNo} dosyası duruşması. ` +
      `Belgeden açıkça tespit edilen tarih ve saat: ${date} ${time}.`;

    const created =
      await supabase
        .from(
          "calendar_events"
        )
        .insert({
          user_id:
            appUser.id,

          case_id:
            null,

          title,

          description,

          event_type:
            "hearing",

          start_date:
            date,

          end_date:
            date,

          due_date:
            date,

          status:
            "active",

          priority:
            "important",

          source:
            "uets_bridge",

          source_mail_id:
            sourceKey,

          raw: {
            court,
            caseNumber:
              fileNo,

            hearingDate:
              date,

            hearingTime:
              time,

            evidence,

            sourceUrl,

            capturedText:
              capturedText.slice(
                0,
                30000
              ),

            importedBy:
              "mether_uets_bridge",
          },
        })
        .select("*")
        .single();

    if (
      created.error ||
      !created.data
    ) {
      throw new Error(
        created.error
          ?.message ||
        "Takvim kaydı oluşturulamadı."
      );
    }

    return NextResponse.json({
      ok: true,
      duplicate: false,

      calendarEvent:
        created.data,

      calendarWrite: {
        type:
          "hearing",

        date,

        time,

        court,

        fileNo,
      },

      message:
        `${date} ${time} — ${court} duruşması takvime eklendi.`,
    });
  }
  catch (error) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof
          Error
            ? error.message
            : "UETS duruşması takvime kaydedilemedi.",
      },
      {
        status: 500,
      }
    );
  }
}