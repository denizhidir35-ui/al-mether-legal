import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

export const runtime =
  "nodejs";

function text(
  value: unknown,
  max = 500000
) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function clean(
  value: string
) {
  return value
    .replace(/\r/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isoDate(
  value: string
) {
  let match =
    value.match(
      /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/
    );

  if (match) {
    return `${match[3]}-${match[2].padStart(
      2,
      "0"
    )}-${match[1].padStart(
      2,
      "0"
    )}`;
  }

  match =
    value.match(
      /\b(\d{4})-(\d{2})-(\d{2})\b/
    );

  return match?.[0] || "";
}

function addCalendarDays(
  iso: string,
  days: number
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      iso
    )
  ) {
    return "";
  }

  const [
    year,
    month,
    day,
  ] =
    iso
      .split("-")
      .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  date.setUTCDate(
    date.getUTCDate() +
      days
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function extractCourt(
  source: string
) {
  const patterns = [
    /\b((?:İstanbul|İzmir|Ankara|Bursa|Antalya|Adana|Konya|Aydın|Manisa|Muğla|Denizli)?\s*\d{1,3}\.\s*(?:İş|Asliye Hukuk|Sulh Hukuk|İcra Hukuk|Ağır Ceza|Asliye Ceza|Aile|Tüketici|Ticaret|İdare|Vergi)\s+Mahkemesi)\b/iu,

    /\b([A-ZÇĞİÖŞÜ][^\n]{2,100}\s+Mahkemesi)\b/iu,
  ];

  for (
    const pattern
    of patterns
  ) {
    const match =
      source.match(
        pattern
      );

    if (match) {
      return clean(
        match[1] ||
        match[0]
      );
    }
  }

  return "";
}

function extractFileNo(
  source: string
) {
  const patterns = [
    /(?:dosya\s*(?:no|numarası)|esas\s*(?:no|numarası))\s*[:\-]?\s*(\d{4}\s*\/\s*\d+)/iu,

    /\[(\d{4}\/\d+)\]/u,

    /\b(\d{4}\/\d+)\s*(?:esas|e\.)\b/iu,
  ];

  for (
    const pattern
    of patterns
  ) {
    const match =
      source.match(
        pattern
      );

    if (match?.[1]) {
      return match[1]
        .replace(/\s/g, "");
    }
  }

  return "";
}

function extractArrival(
  source: string
) {
  const patterns = [
    /(?:ulaşma\s*tarihi|adresine)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})(?:\s+(\d{1,2}:\d{2}))?/iu,

    /(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s+(\d{1,2}:\d{2})\s*tarihinde/iu,
  ];

  for (
    const pattern
    of patterns
  ) {
    const match =
      source.match(
        pattern
      );

    if (match) {
      return {
        date:
          isoDate(
            match[1] || ""
          ),

        time:
          match[2] ||
          "",
      };
    }
  }

  return {
    date: "",
    time: "",
  };
}

function extractBarcode(
  source: string
) {
  return (
    source.match(
      /(\d{12,30})\s*barkod/iu
    )?.[1] ||
    source.match(
      /barkod\s*(?:no|numarası)?\s*[:\-]?\s*(\d{12,30})/iu
    )?.[1] ||
    ""
  );
}

function extractHearing(
  source: string
) {
  const patterns = [
    /(?:duruşma\s*(?:tarihi|günü)?|duruşmanın)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})(?:[^\n]{0,80}?(?:saat|saati)\s*[:\-]?\s*(\d{1,2}:\d{2}))?/iu,

    /(?:duruşma|celse)[^\n]{0,120}?(\d{1,2}[./-]\d{1,2}[./-]\d{4})[^\n]{0,80}?(\d{1,2}:\d{2})/iu,
  ];

  for (
    const pattern
    of patterns
  ) {
    const match =
      source.match(
        pattern
      );

    if (match) {
      return {
        found: true,

        date:
          isoDate(
            match[1] || ""
          ),

        time:
          match[2] ||
          "",

        evidence:
          clean(
            match[0]
          ),
      };
    }
  }

  return {
    found: false,
    date: "",
    time: "",
    evidence: "",
  };
}

function explicitDeadline(
  source: string
) {
  const patterns = [
    /(?:son\s*gün|son\s*tarih|süre\s*sonu|en\s*geç)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})[^\n]*/iu,

    /(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s*tarihine\s*kadar[^\n]*/iu,
  ];

  for (
    const pattern
    of patterns
  ) {
    const match =
      source.match(
        pattern
      );

    if (match) {
      return {
        date:
          isoDate(
            match[1] || ""
          ),

        evidence:
          clean(
            match[0]
          ),
      };
    }
  }

  return {
    date: "",
    evidence: "",
  };
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

    const subject =
      text(
        body?.subject,
        1000
      );

    const sender =
      text(
        body?.sender,
        1000
      );

    const mailBody =
      text(
        body?.body
      );

    const source =
      clean(
        `${subject}\n${sender}\n${mailBody}`
      );

    const court =
      extractCourt(
        source
      );

    const fileNo =
      extractFileNo(
        source
      );

    const arrival =
      extractArrival(
        source
      );

    const barcodeNo =
      extractBarcode(
        source
      );

    const hearing =
      extractHearing(
        source
      );

    const deadline =
      explicitDeadline(
        source
      );

    const isUets =
      /uets|elektronik\s+tebligat|tebligat\s+adresine/iu
        .test(source);

    const deemedServiceDate =
      isUets &&
      arrival.date
        ? addCalendarDays(
            arrival.date,
            5
          )
        : "";

    /*
     * LEGAL SAFETY:
     *
     * UETS +5 sadece tebliğ edilmiş
     * sayılma bilgisidir.
     *
     * analysis.sonTarih alanına
     * otomatik yazılmaz.
     *
     * Sadece belgede açıkça
     * "son gün / son tarih" varsa
     * sonTarih döndürülür.
     */

    const summaryParts = [
      court
        ? `Yargı birimi: ${court}.`
        : "",

      fileNo
        ? `Dosya: ${fileNo}.`
        : "",

      arrival.date
        ? `UETS ulaşma: ${arrival.date}${
            arrival.time
              ? ` ${arrival.time}`
              : ""
          }.`
        : "",

      hearing.found
        ? `Duruşma: ${hearing.date}${
            hearing.time
              ? ` ${hearing.time}`
              : ""
          }.`
        : "",

      deadline.date
        ? `Belgede açık son tarih: ${deadline.date}.`
        : "",
    ].filter(Boolean);

    return NextResponse.json({
      ok: true,

      engine:
        "mether_rules_v1",

      extractionMode:
        isUets
          ? "uets_rule_engine"
          : "legal_mail_rule_engine",

      uetsExtraction: {
        found:
          isUets,

        institution:
          isUets
            ? "PTT UETS"
            : "",

        noticeType:
          isUets
            ? "electronic_notification"
            : "",

        arrivalDate:
          arrival.date,

        arrivalTime:
          arrival.time,

        arrivalDateTime:
          arrival.date
            ? `${arrival.date}${
                arrival.time
                  ? `T${arrival.time}:00`
                  : ""
              }`
            : "",

        deemedServiceDate,

        court,

        fileNo,

        barcodeNo,

        recipient: "",

        subject,

        confidence:
          isUets
            ? 100
            : 0,

        warnings: [],
      },

      analysis: {
        davaTuru:
          isUets
            ? "Elektronik Tebligat"
            : hearing.found
              ? "Duruşma Bildirimi"
              : "Mail",

        mahkeme:
          court,

        dosyaNo:
          fileNo,

        kurum:
          isUets
            ? "PTT UETS"
            : "",

        risk: "",

        /*
         * Sadece açık son tarih.
         * UETS +5 buraya GİRMEZ.
         */
        sonTarih:
          deadline.date,

        confidence:
          deadline.date ||
          hearing.found ||
          isUets
            ? 100
            : 0,

        ozet:
          summaryParts.join(
            " "
          ),

        yapilacaklar:
          hearing.found
            ? [
                `Duruşma: ${hearing.date}${
                  hearing.time
                    ? ` ${hearing.time}`
                    : ""
                }`,
              ]
            : [],
      },

      document: {
        hearing,

        explicitDeadline:
          deadline,
      },

      deadline:
        null,

      calendarEvent:
        null,

      storedCalendarEvent:
        null,

      reminders:
        null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof
          Error
            ? error.message
            : "METHER mail analizi başarısız.",
      },
      {
        status: 500,
      }
    );
  }
}