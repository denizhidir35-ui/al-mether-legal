import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
} from "node:crypto";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";
import {
  extractLegalImageText,
  extractLegalPdfText,
} from "@/lib/legal/ocr";
import {
  LegalImageNormalizationError,
  normalizeLegalImageForOcr,
  resolveLegalImageMimeType,
} from "@/lib/legal/imageNormalization";
import {
  extractUetsBarcodeNo,
  extractUetsCaseValueFields,
  extractUetsDateInformation,
  extractUetsDecisionNo,
  extractUetsExplicitDeadlines,
  extractUetsHearingFields,
  extractUetsPartiesAndSubject,
  extractUetsPaymentFields,
  extractUetsResultAndRequest,
} from "@/lib/legal/uetsPdfFields";
import { extractUetsNotice } from "@/lib/legal/uetsExtractor";
import {
  decodeUetsPdf,
  validateUetsPdfBytes,
} from "@/lib/legal/uetsPdfValidation";

export const runtime = "nodejs";

export const maxDuration = 60;

function safeText(
  value: unknown,
  max = 1_500_000
) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function cleanSpace(
  value: string
) {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toIsoDate(
  value: string
) {
  const text =
    value.trim();

  let match =
    text.match(
      /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/
    );

  if (match) {
    const day =
      match[1].padStart(
        2,
        "0"
      );

    const month =
      match[2].padStart(
        2,
        "0"
      );

    return `${match[3]}-${month}-${day}`;
  }

  match =
    text.match(
      /\b(\d{4})-(\d{2})-(\d{2})\b/
    );

  return match
    ? match[0]
    : "";
}

function findEvidence(
  text: string,
  patterns: RegExp[]
) {
  for (
    const pattern
    of patterns
  ) {
    const match =
      text.match(pattern);

    if (match?.[0]) {
      return {
        match,
        evidence:
          cleanSpace(
            match[0]
          ).slice(
            0,
            1500
          ),
      };
    }
  }

  return null;
}

function extractCourt(
  text: string
) {
  /*
   * Önce "Mahkeme:" / "Yargı birimi:" etiketli alanı yakala.
   * Böylece "İzmir 20. İş Mahkemesi" içindeki şehir kaybolmaz.
   */
  const labelled =
    text.match(
      /(?:Mahkeme|Yargı\s*birimi)\s*[:\-]?\s*(?:\r?\n\s*)?([^\r\n]{3,180}?Mahkemesi)\b/iu
    );

  if (
    labelled?.[1]
  ) {
    return cleanSpace(
      labelled[1]
    );
  }

  const patterns = [
    /(?<![A-Za-zÇĞİÖŞÜçğıöşü])((?:İstanbul|İzmir|Ankara|Bursa|Antalya|Adana|Konya|Gaziantep|Kocaeli|Aydın|Manisa|Muğla|Denizli|Balıkesir|Samsun|Trabzon|Eskişehir|Kayseri)\s+\d{1,3}\.\s*(?:İş|Asliye Hukuk|Sulh Hukuk|İcra Hukuk|Ağır Ceza|Asliye Ceza|Tüketici|Aile|İdare|Vergi|Ticaret)\s+Mahkemesi)\b/iu,

    /\b(\d{1,3}\.\s*(?:İş|Asliye Hukuk|Sulh Hukuk|İcra Hukuk|Ağır Ceza|Asliye Ceza|Tüketici|Aile|İdare|Vergi|Ticaret)\s+Mahkemesi)\b/iu,

    /(?<![A-Za-zÇĞİÖŞÜçğıöşü])([A-ZÇĞİÖŞÜ][^\r\n]{2,120}\s+Mahkemesi)\b/iu,
  ];

  for (
    const pattern
    of patterns
  ) {
    const match =
      text.match(
        pattern
      );

    if (
      match?.[1]
    ) {
      return cleanSpace(
        match[1]
      );
    }
  }

  return "";
}
function extractFileNo(
  text: string
) {
  const patterns = [
    /(?:Dosya\s*(?:No|Numarası)|Esas\s*(?:No|Numarası))\s*[:\-]?\s*(\d{4}\s*\/\s*\d+)/iu,

    /\b(\d{4}\/\d+)\s*(?:Esas|E\.)\b/iu,

    /\[(\d{4}\/\d+)\]/u,
  ];

  const result =
    findEvidence(
      text,
      patterns
    );

  return result
    ? cleanSpace(
        result.match[1] ||
        ""
      ).replace(
        /\s+/g,
        ""
      )
    : "";
}

function extractHearing(
  text: string
) {
  /*
   * Tarih ve saat aynı satırda olmak zorunda değil.
   *
   * Örnek:
   *
   * Duruşma tarihi:
   * 20.08.2026
   *
   * Duruşma saati:
   * 10:30
   */

  const datePatterns = [
    /(?:duruşma\s*(?:tarihi|günü)?|duruşmanın\s+tarihi)\s*[:\-]?\s*(?:\r?\n\s*)?(\d{1,2}[./-]\d{1,2}[./-]\d{4})/iu,

    /(?:duruşma|celse)[\s\S]{0,180}?(\d{1,2}[./-]\d{1,2}[./-]\d{4})/iu,

    /(\d{1,2}[./-]\d{1,2}[./-]\d{4})[\s\S]{0,120}?\b(?:duruşma|celse)\b/iu,
  ];

  let dateMatch:
    RegExpMatchArray |
    null =
    null;

  for (
    const pattern
    of datePatterns
  ) {
    const match =
      text.match(
        pattern
      );

    if (
      match?.[1]
    ) {
      dateMatch =
        match;

      break;
    }
  }

  if (!dateMatch) {
    return {
      found: false,
      date: "",
      time: "",
      location: "",
      evidence: "",
    };
  }

  const date =
    toIsoDate(
      dateMatch[1]
    );

  if (!date) {
    return {
      found: false,
      date: "",
      time: "",
      location: "",
      evidence:
        cleanSpace(
          dateMatch[0]
        ),
    };
  }

  /*
   * Saat ayrıca aranır.
   * Sadece duruşma/celse bağlamındaki saat kabul edilir.
   */
  const timePatterns = [
    /(?:duruşma\s*saati|duruşma\s*saat|celse\s*saati)\s*[:\-]?\s*(?:\r?\n\s*)?([01]?\d|2[0-3]):([0-5]\d)/iu,

    /(?:duruşma|celse)[\s\S]{0,220}?(?:saat|saati)\s*[:\-]?\s*(?:\r?\n\s*)?([01]?\d|2[0-3]):([0-5]\d)/iu,
  ];

  let time =
    "";

  let timeEvidence =
    "";

  for (
    const pattern
    of timePatterns
  ) {
    const match =
      text.match(
        pattern
      );

    if (match) {
      time =
        `${String(
          match[1]
        ).padStart(
          2,
          "0"
        )}:${match[2]}`;

      timeEvidence =
        cleanSpace(
          match[0]
        );

      break;
    }
  }

  const evidence =
    [
      cleanSpace(
        dateMatch[0]
      ),

      timeEvidence,
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(
        0,
        1500
      );

  return {
    found: true,
    date,
    time,
    location: "",
    evidence,
  };
}

function extractExplicitDeadlines(
  text: string
) {
  const results:
    Array<{
      label: string;
      explicitDate: string;
      durationText: string;
      startBasis: string;
      evidence: string;
      isExplicitFinalDate: boolean;
    }> = [];

  const explicitPatterns = [
    /(?:son\s*gün|son\s*tarih|süre\s*sonu|en\s*geç)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})[^\n]*/giu,

    /(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s*tarihine\s*kadar[^\n]*/giu,
  ];

  for (
    const pattern
    of explicitPatterns
  ) {
    for (
      const match
      of text.matchAll(
        pattern
      )
    ) {
      const date =
        toIsoDate(
          match[1] ||
          match[0]
        );

      if (!date) {
        continue;
      }

      results.push({
        label:
          "Açıkça belirtilen son tarih",

        explicitDate:
          date,

        durationText: "",

        startBasis: "",

        evidence:
          cleanSpace(
            match[0]
          ).slice(
            0,
            1500
          ),

        isExplicitFinalDate:
          true,
      });
    }
  }

  const relativePattern =
    /(?:kesin\s+süre|süre)\s*(?:olarak)?\s*[:\-]?\s*(\d+\s*(?:gün|hafta|ay))[^\n]*/giu;

  for (
    const match
    of text.matchAll(
      relativePattern
    )
  ) {
    results.push({
      label:
        "Göreli hukuki süre",

      explicitDate: "",

      durationText:
        cleanSpace(
          match[1] ||
          ""
        ),

      startBasis:
        /tebliğ/iu.test(
          match[0]
        )
          ? "Tebliğ"
          : "",

      evidence:
        cleanSpace(
          match[0]
        ).slice(
          0,
          1500
        ),

      isExplicitFinalDate:
        false,
    });
  }

  return results.slice(
    0,
    12
  );
}

function extractTasks(
  text: string
) {
  const patterns = [
    /[^\n]{0,160}\b(?:sunulmasına|sunmanız|ibraz edilmesine|ibraz etmeniz|beyan vermeniz|cevap vermeniz|hazır bulunmanız|katılmanız|duruşmada hazır bulunmanız)\b[^\n]{0,200}/giu,
  ];

  const found:
    Array<{
      text: string;
      evidence: string;
    }> = [];

  for (
    const pattern
    of patterns
  ) {
    for (
      const match
      of text.matchAll(
        pattern
      )
    ) {
      const evidence =
        cleanSpace(
          match[0]
        );

      if (
        !evidence
      ) {
        continue;
      }

      found.push({
        text:
          evidence,

        evidence,
      });
    }
  }

  return found.slice(
    0,
    20
  );
}

function extractUets(
  text: string
) {
  const arrival =
    findEvidence(
      text,
      [
        /(?:ulaşma\s*tarihi|adresine)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})(?:\s+(\d{1,2}:\d{2}))?/iu,

        /(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s+(\d{1,2}:\d{2})\s*tarihinde/iu,
      ]
    );

  const deemed =
    findEvidence(
      text,
      [
        /tebliğ\s*edilmiş\s*sayılma\s*tarihi\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/iu,
      ]
    );

  const barcode =
    findEvidence(
      text,
      [
        /(\d{12,30})\s*barkod/iu,
        /barkod\s*(?:no|numarası)?\s*[:\-]?\s*(\d{12,30})/iu,
      ]
    );

  const noticeNo =
    findEvidence(
      text,
      [
        /tebligat\s*(?:no|numarası)\s*[:\-]?\s*([A-Z0-9\-/]{6,40})/iu,
      ]
    );

  return {
    arrivalDate:
      arrival
        ? toIsoDate(
            arrival
              .match[1] ||
            ""
          )
        : "",

    arrivalTime:
      arrival
        ?.match[2] ||
      "",

    deemedServiceDate:
      deemed
        ? toIsoDate(
            deemed
              .match[1] ||
            ""
          )
        : "",

    barcodeNo:
      barcode
        ?.match[1] ||
      "",

    noticeNo:
      noticeNo
        ?.match[1] ||
      "",
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

    const contentType =
      request.headers.get(
        "content-type"
      ) || "";

    let htmlText = "";
    let title = "UETS Tebligatı";
    let sourceUrl = "";
    let sourceDocument = "";
    let pdfBytes: Buffer | null = null;
    let uploadEngine = "";
    let documentIdentity = "";
    let sourceType =
      "uets_browser_bridge";

    if (
      contentType.includes(
        "multipart/form-data"
      )
    ) {
      const formData =
        await request.formData();
      const file =
        formData.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Analiz edilecek belge bulunamadı.",
          },
          { status: 400 }
        );
      }

      sourceDocument =
        safeText(file.name, 500);
      title =
        sourceDocument ||
        "Hukuki Belge";
      sourceType =
        "case_document_upload";

      const bytes =
        Buffer.from(
          await file.arrayBuffer()
        );

      documentIdentity =
        createHash("sha256")
          .update(bytes)
          .digest("hex");

      if (
        file.type ===
          "application/pdf" ||
        sourceDocument
          .toLocaleLowerCase("tr-TR")
          .endsWith(".pdf")
      ) {
        pdfBytes =
          validateUetsPdfBytes(
            bytes
          );
        htmlText =
          "Kullanıcı tarafından yüklenen hukuki PDF belgesi analizidir.";
      } else {
        const imageMimeType =
          resolveLegalImageMimeType(
            file.type,
            sourceDocument
          );

        if (!imageMimeType) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "PDF, JPG, PNG, WEBP, HEIC veya HEIF destekleniyor.",
            },
            { status: 400 }
          );
        }

        if (
          file.size >
          15 * 1024 * 1024
        ) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Fotoğraf 15 MB sınırını aşıyor.",
            },
            { status: 400 }
          );
        }

        let normalizedImage;

        try {
          normalizedImage =
            await normalizeLegalImageForOcr(
              bytes,
              imageMimeType
            );
        } catch (error) {
          if (
            error instanceof
              LegalImageNormalizationError
          ) {
            return NextResponse.json(
              {
                ok: false,
                error:
                  error.message,
              },
              { status: 422 }
            );
          }

          throw error;
        }

        const imageResult =
          await extractLegalImageText(
            normalizedImage.bytes,
            normalizedImage.mimeType
          );

        htmlText =
          safeText(
            imageResult.text
          );
        uploadEngine =
          imageResult.engine;
      }
    } else {
      const input =
        await request.json();

      htmlText =
        safeText(input?.text);
      title =
        safeText(
          input?.title,
          500
        ) ||
        "UETS Tebligatı";
      sourceUrl =
        safeText(
          input?.url,
          3000
        );
      sourceDocument =
        safeText(
          input?.sourceDocument,
          500
        );
      pdfBytes =
        decodeUetsPdf(
          input?.pdfBase64
        );
    }

    if (
      htmlText.length <
      30
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Tebligat metni okunamadı.",
        },
        {
          status: 400,
        }
      );
    }

    let pdfText = "";
    let pdfEngine = "";

    if (pdfBytes) {
      const pdfResult =
        await extractLegalPdfText(
          pdfBytes
        );

      pdfText =
        safeText(
          pdfResult.text
        );
      pdfEngine =
        pdfResult.engine;

      if (pdfText.length < 30) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "PDF metni okunamadı.",
          },
          {
            status: 422,
          }
        );
      }
    }

    const text =
      pdfText
        ? `${htmlText}\n\n--- UETS PDF: ${sourceDocument || "Ek Belge"} ---\n${pdfText}`
        : htmlText;

    const isTestDocument =
      /METHER UETS BRIDGE TEST|GERÇEK TEBLİGAT DEĞİLDİR|HUKUKİ DEĞERİ YOKTUR/i
        .test(text);

    const extractedUets =
      extractUetsNotice(text);

    const court =
      extractCourt(text) ||
      extractedUets.court;

    const fileNo =
      extractFileNo(text) ||
      extractedUets.fileNo;

    const decisionNo =
      extractUetsDecisionNo(
        text
      );

    const hearing =
      extractUetsHearingFields(
        text
      );

    const deadlines =
      extractUetsExplicitDeadlines(
        text
      );

    const tasks =
      extractTasks(
        text
      );

    const parsedUets =
      extractUets(text);

    const partyAndSubject =
      extractUetsPartiesAndSubject(
        text
      );

    const payment =
      extractUetsPaymentFields(
        text,
        sourceDocument
      );

    const caseValue =
      extractUetsCaseValueFields(
        text
      );

    const resultAndRequest =
      extractUetsResultAndRequest(
        text
      );

    const dateInformation =
      extractUetsDateInformation(
        text
      );

    const uets = {
      arrivalDate:
        parsedUets.arrivalDate ||
        extractedUets.arrivalDate,

      arrivalTime:
        parsedUets.arrivalTime ||
        extractedUets.arrivalTime,

      deemedServiceDate:
        parsedUets.deemedServiceDate ||
        extractedUets.deemedServiceDate,

      barcodeNo:
        extractUetsBarcodeNo(text) ||
        parsedUets.barcodeNo ||
        extractedUets.barcodeNo,

      noticeNo:
        parsedUets.noticeNo,
    };

    const hasDeemedService =
      Boolean(
        uets.arrivalDate &&
          uets.deemedServiceDate
      );

    const hasLegalAction =
      hearing.found ||
      deadlines.some(
        (item) =>
          item
            .isExplicitFinalDate
      );

    const needsHumanReview =
      !isTestDocument &&
      (
        !court ||
        !fileNo ||
        (
          !hearing.found &&
          deadlines.length === 0 &&
          !hasDeemedService
        )
      );

    const document = {
      documentType:
        /elektronik\s+tebligat|uets/iu
          .test(text)
          ? "Elektronik Tebligat"
          : "Hukuki Belge",

      court,
      fileNo,
      decisionNo,

      summary:
        [
          court
            ? `Mahkeme: ${court}.`
            : "",

          fileNo
            ? `Dosya: ${fileNo}.`
            : "",

          hearing.found
            ? `Duruşma: ${hearing.date}${
                hearing.time
                  ? ` ${hearing.time}`
                  : ""
              }.`
            : "",
        ]
          .filter(Boolean)
          .join(" "),

      hearing,

      deadlines,

      tasks,

      parties:
        partyAndSubject.parties,

      subject:
        partyAndSubject.subject,

      caseValue:
        caseValue.caseValue,

      caseValueCurrency:
        caseValue.caseValueCurrency,

      resultAndRequest,

      payment,

      dateInformation,

      uets,

      needsHumanReview,

      calendarSafe:
        !isTestDocument &&
        (hasLegalAction ||
          hasDeemedService) &&
        !needsHumanReview,
    };

    return NextResponse.json({
      ok: true,

      engine:
        pdfEngine
          ? `mether_rules_v1+${pdfEngine}`
          : uploadEngine
            ? `mether_rules_v1+${uploadEngine}`
            : "mether_rules_v1",

      source: {
        type:
          sourceType,

        title,

        url:
          sourceUrl,

        sourceDocument,

        pdfCaptured:
          Boolean(pdfBytes),

        isTestDocument,

        documentIdentity,
      },

      document,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof
          Error
            ? error.message
            : "Tebligat belge analizi başarısız.",
      },
      {
        status: 500,
      }
    );
  }
}
