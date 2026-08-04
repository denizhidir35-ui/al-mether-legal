import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

import { AIGateway } from "@/lib/core/ai";
import { CoreEvents } from "@/lib/core/events";
import { CalendarEngine } from "@/lib/calendar/CalendarEngine";
import { CalendarStore } from "@/lib/calendar/CalendarStore";
import { ReminderEngine } from "@/lib/calendar/ReminderEngine";
import type { LegalEvent } from "@/lib/calendar/LegalEvent";

import {
  extractUetsNotice,
  type UetsExtractionResult,
} from "@/lib/legal/uetsExtractor";

type AIAnalysis = {
  davaTuru: string;
  mahkeme: string;
  dosyaNo: string;
  kurum: string;
  risk: string;
  sonTarih: string;
  confidence: number;
  ozet: string;
  yapilacaklar: string[];
};

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeConfidence(value: unknown): number {
  const number = Number(value);

  if (!Number.isFinite(number)) return 0;

  if (number > 0 && number <= 1) {
    return Math.round(number * 100);
  }

  return Math.max(0, Math.min(100, Math.round(number)));
}

function toIsoDate(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function addDaysToIso(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00`);

  if (Number.isNaN(base.getTime())) return "";

  base.setDate(base.getDate() + days);

  return base.toISOString().slice(0, 10);
}

function turkishMonthToNumber(value: string): string {
  const key = value
    .toLocaleLowerCase("tr-TR")
    .replace(/\./g, "")
    .trim();

  const months: Record<string, string> = {
    ocak: "01",
    oca: "01",
    şubat: "02",
    subat: "02",
    şub: "02",
    sub: "02",
    mart: "03",
    mar: "03",
    nisan: "04",
    nis: "04",
    mayıs: "05",
    mayis: "05",
    may: "05",
    haziran: "06",
    haz: "06",
    temmuz: "07",
    tem: "07",
    ağustos: "08",
    agustos: "08",
    ağu: "08",
    agu: "08",
    eylül: "09",
    eylul: "09",
    eyl: "09",
    ekim: "10",
    eki: "10",
    kasım: "11",
    kasim: "11",
    kas: "11",
    aralık: "12",
    aralik: "12",
    ara: "12",
  };

  return months[key] || "";
}

function cleanDate(value: unknown): string {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();

  if (!trimmed || trimmed === "-") return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const dotted = trimmed.match(
    /^(\d{1,2})\.(\d{1,2})\.(20\d{2})$/
  );

  if (dotted) {
    return toIsoDate(dotted[1], dotted[2], dotted[3]);
  }

  const slashed = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/
  );

  if (slashed) {
    return toIsoDate(slashed[1], slashed[2], slashed[3]);
  }

  const turkish = trimmed.match(
    /^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü.]+)\s+(20\d{2})$/i
  );

  if (turkish) {
    const month = turkishMonthToNumber(turkish[2]);

    if (month) {
      return toIsoDate(turkish[1], month, turkish[3]);
    }
  }

  return "";
}

function extractJson(text: string): string | null {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return cleaned.slice(start, end + 1);
}

function extractCourt(text: string): string {
  const patterns = [
    /([A-ZÇĞİÖŞÜa-zçğıöşü\s]+\s+\d+\.\s*(?:İş|Asliye|Sulh|İcra|Ağır Ceza|Ceza|Ticaret|Aile|İdare|Vergi)\s+Mahkemesi)/i,
    /([A-ZÇĞİÖŞÜa-zçğıöşü\s]+\s+\d+\.\s*İcra\s+(?:Müdürlüğü|Dairesi))/i,
    /([A-ZÇĞİÖŞÜa-zçğıöşü\s]+ Mahkemesi)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].replace(/\s+/g, " ").trim();
    }
  }

  return "";
}

function extractFileNo(text: string): string {
  const patterns = [
    /\[\s*(20\d{2}\/\d{1,8})\s*\]/,
    /\b(?:dosya|esas)\s*(?:no|numarası|sayısı)?\s*[:#-]?\s*(20\d{2}\/\d{1,8})\b/i,
    /\b(20\d{2}\/\d{1,8})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function extractReceivedDate(text: string): string {
  const normalized = text.replace(/\s+/g, " ");

  const patterns = [
    /(\d{1,2}\.\d{1,2}\.20\d{2})\s+\d{1,2}:\d{2}\s+tarihinde/i,
    /(\d{1,2}\/\d{1,2}\/20\d{2})\s+\d{1,2}:\d{2}\s+tarihinde/i,
    /date:\s*(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü.]+\s+20\d{2})/i,
    /tarih(?:i|inde)?\s*[:\-]?\s*(\d{1,2}\.\d{1,2}\.20\d{2})/i,
    /tarih(?:i|inde)?\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/20\d{2})/i,
    /tarih(?:i|inde)?\s*[:\-]?\s*(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü.]+\s+20\d{2})/i,
    /(\d{1,2}\.\d{1,2}\.20\d{2})/i,
    /(\d{1,2}\/\d{1,2}\/20\d{2})/i,
    /(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü.]+\s+20\d{2})/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const parsed = cleanDate(match?.[1] || "");

    if (parsed) {
      return parsed;
    }
  }

  return "";
}

function deterministicLegalExtract(
  subject: string,
  text: string
): AIAnalysis {
  const fullText = `${subject}\n${text}`;

  const mahkeme = extractCourt(fullText);
  const dosyaNo = extractFileNo(fullText);
  const receivedDate = extractReceivedDate(fullText);

  const isTebligat =
    /tebligat|e-tebligat|elektronik tebligat|uyap|uets|ptt|adalet bakanlığı/i.test(
      fullText
    );

  const sonTarih =
    isTebligat && receivedDate
      ? addDaysToIso(receivedDate, 5)
      : "";

  return {
    davaTuru: isTebligat ? "Elektronik Tebligat" : "",
    mahkeme,
    dosyaNo,
    kurum: /ptt|uets/i.test(fullText)
      ? "PTT UETS"
      : /adalet bakanlığı/i.test(fullText)
        ? "Adalet Bakanlığı"
        : "",
    risk: "",
    sonTarih,
    confidence: isTebligat ? 70 : 0,
    ozet: isTebligat
      ? [
          "Elektronik tebligat bildirimi tespit edildi.",
          receivedDate
            ? `Ulaşma tarihi: ${receivedDate}.`
            : "",
          sonTarih
            ? `Tebliğ edilmiş sayılma tarihi: ${sonTarih}.`
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      : "",
    yapilacaklar: [],
  };
}

function analysisFromUets(
  extraction: UetsExtractionResult
): AIAnalysis {
  const details = [
    extraction.court
      ? `Yargı birimi: ${extraction.court}.`
      : "",
    extraction.fileNo
      ? `Dosya numarası: ${extraction.fileNo}.`
      : "",
    extraction.arrivalDate
      ? `Elektronik tebligatın ulaşma tarihi: ${extraction.arrivalDate}${
          extraction.arrivalTime
            ? ` ${extraction.arrivalTime}`
            : ""
        }.`
      : "",
    extraction.deemedServiceDate
      ? `Tebliğ edilmiş sayılma tarihi: ${extraction.deemedServiceDate}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    davaTuru: "Elektronik Tebligat",
    mahkeme: extraction.court,
    dosyaNo: extraction.fileNo,
    kurum: extraction.institution || "PTT UETS",
    risk: "",
    sonTarih: extraction.deemedServiceDate,
    confidence: extraction.confidence,
    ozet:
      details ||
      "PTT UETS elektronik tebligat bildirimi tespit edildi.",
    yapilacaklar: [],
  };
}

function normalizeAnalysis(
  raw: Record<string, unknown>,
  fallback: AIAnalysis
): AIAnalysis {
  const rawTodos =
    safeStringArray(raw?.yapilacaklar).length > 0
      ? safeStringArray(raw?.yapilacaklar)
      : safeStringArray(raw?.todos);

  return {
    davaTuru:
      safeString(raw?.davaTuru) ||
      safeString(raw?.caseType) ||
      fallback.davaTuru,
    mahkeme:
      safeString(raw?.mahkeme) ||
      safeString(raw?.court) ||
      fallback.mahkeme,
    dosyaNo:
      safeString(raw?.dosyaNo) ||
      safeString(raw?.fileNo) ||
      fallback.dosyaNo,
    kurum:
      safeString(raw?.kurum) ||
      safeString(raw?.institution) ||
      fallback.kurum,
    risk:
      safeString(raw?.risk) ||
      safeString(raw?.riskLevel) ||
      fallback.risk,
    sonTarih:
      cleanDate(raw?.sonTarih) ||
      cleanDate(raw?.son_tarih) ||
      cleanDate(raw?.deadline) ||
      cleanDate(raw?.legalDeadline) ||
      fallback.sonTarih,
    confidence:
      safeConfidence(raw?.confidence) ||
      safeConfidence(raw?.score) ||
      fallback.confidence,
    ozet:
      safeString(raw?.ozet) ||
      safeString(raw?.summary) ||
      fallback.ozet,
    yapilacaklar:
      rawTodos.length > 0
        ? rawTodos
        : fallback.yapilacaklar,
  };
}

function buildPrompt(
  subject: string,
  from: string,
  date: string,
  text: string
): string {
  return `
Sen AL METHER LAWYER için çalışan hukuk mail analiz motorusun.

Bu istek PTT UETS Extractor tarafından kesin olarak çözülemeyen bir mail içindir.

Görevin:
Mail içeriğinden hukuki alanları çıkar ve yalnızca geçerli JSON döndür.

Kurallar:
- Elektronik tebligat, UETS, PTT, UYAP veya Adalet Bakanlığı ifadelerini değerlendir.
- Mahkeme veya ilgili yargı birimini çıkar.
- Dosya numarasını çıkar.
- Açık bir ulaşma tarihi varsa tarih değerini YYYY-MM-DD biçiminde döndür.
- Elektronik tebligatın ulaşma tarihi açıkça belirlenmişse sonTarih alanına 5 gün eklenmiş tarihi yaz.
- Tarih kesin değilse sonTarih boş string olsun.
- JSON dışında açıklama yazma.
- Markdown kullanma.

JSON:
{
  "davaTuru": "",
  "mahkeme": "",
  "dosyaNo": "",
  "kurum": "",
  "risk": "",
  "sonTarih": "YYYY-MM-DD",
  "confidence": 0,
  "ozet": "",
  "yapilacaklar": []
}

MAIL:
Konu: ${subject}
Gönderen: ${from}
Mail Tarihi: ${date}

İçerik:
${text}
`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const subject = safeString(body?.subject);
    const from = safeString(body?.from || body?.sender);
    const date = safeString(body?.date);

    const text = safeString(
      body?.text ||
        body?.body ||
        body?.content ||
        body?.mailBody
    );

    const emailId = safeString(
      body?.emailId ||
        body?.messageId ||
        body?.mailId
    );

    const correlationId = crypto.randomUUID();

    if (!text && !subject) {
      return NextResponse.json(
        {
          ok: false,
          error: "Analiz için mail içeriği bulunamadı.",
        },
        { status: 400 }
      );
    }

    const fullMailText = `${subject}\n${from}\n${date}\n${text}`;

    const uetsExtraction = extractUetsNotice(fullMailText);

    let analysis: AIAnalysis;
    let aiProvider = "uets-extractor";
    let aiModel = "deterministic-v1";
    let extractionMode:
      | "uets-extractor"
      | "ai-fallback";

    if (
      uetsExtraction.found &&
      uetsExtraction.deemedServiceDate
    ) {
      analysis = analysisFromUets(uetsExtraction);
      extractionMode = "uets-extractor";
    } else {
      extractionMode = "ai-fallback";

      const fallback = deterministicLegalExtract(
        subject,
        text
      );

      let parsed: Record<string, unknown> = {};

      try {
        const aiResponse = await AIGateway.generate({
          provider: "gemini",
          model: "gemini-2.5-flash",
          product: "legal",
          task: "mail-analysis",
          jsonMode: true,
          messages: [
            {
              role: "system",
              content:
                "Sen AL METHER LAWYER hukuk mail analiz motorusun. Yalnızca geçerli JSON döndür.",
            },
            {
              role: "user",
              content: buildPrompt(
                subject,
                from,
                date,
                text
              ),
            },
          ],
          metadata: {
            subject,
            from,
            date,
            emailId,
            uetsWarnings: uetsExtraction.warnings,
          },
        });

        aiProvider = aiResponse.provider || "gemini";
        aiModel = aiResponse.model || "gemini-2.5-flash";

        if (aiResponse.ok && aiResponse.text) {
          const jsonText = extractJson(aiResponse.text);

          if (jsonText) {
            try {
              parsed = JSON.parse(jsonText) as Record<
                string,
                unknown
              >;
            } catch {
              parsed = {};
            }
          }
        }
      } catch {
        aiProvider = "deterministic-fallback";
        aiModel = "legal-date-parser-v1";
      }

      analysis = normalizeAnalysis(parsed, fallback);
    }

    await CoreEvents.publish({
      type: "legal.mail.analysis.completed",
      source: "legal",
      product: "lawyer",
      correlationId,
      payload: {
        subject,
        from,
        date,
        emailId,
        extractionMode,
        uetsExtraction,
        analysis,
        aiProvider,
        aiModel,
      },
    });

    let deadlineRecord: Record<string, unknown> | null =
      null;

    if (analysis.sonTarih) {
      const deadlineInsert = await supabase
        .from("deadlines")
        .insert({
          email_id: emailId || null,
          subject:
            uetsExtraction.subject ||
            subject ||
            null,
          sender: from || null,
          dava_turu:
            analysis.davaTuru || null,
          mahkeme:
            analysis.mahkeme || null,
          dosya_no:
            analysis.dosyaNo || null,
          kurum:
            analysis.kurum || null,
          risk:
            analysis.risk || null,
          son_tarih: analysis.sonTarih,
          ozet:
            analysis.ozet || null,
          yapilacaklar:
            analysis.yapilacaklar,
          confidence:
            analysis.confidence,
          status: "active",
        })
        .select()
        .single();

      if (!deadlineInsert.error) {
        deadlineRecord =
          deadlineInsert.data as Record<
            string,
            unknown
          >;

        await CoreEvents.publish({
          type: "legal.deadline.created",
          source: "legal",
          product: "lawyer",
          correlationId,
          payload: {
            deadline: deadlineRecord,
            analysis,
            emailId,
            extractionMode,
          },
        });
      }
    }

    let calendarEvent:
      | Awaited<
          ReturnType<
            typeof CalendarEngine.createLegalEvent
          >
        >
      | null = null;

    let storedCalendarEvent:
      | Awaited<
          ReturnType<
            typeof CalendarStore.save
          >
        >
      | null = null;

    let reminders:
      | Awaited<
          ReturnType<
            typeof ReminderEngine.createReminders
          >
        >
      | null = null;

    if (analysis.sonTarih) {
      const recordId =
        typeof deadlineRecord?.id === "string"
          ? deadlineRecord.id
          : "";

      const legalEvent: LegalEvent = {
        id:
          recordId ||
          emailId ||
          crypto.randomUUID(),
        title:
          uetsExtraction.subject ||
          subject ||
          analysis.davaTuru ||
          "Elektronik Tebligat",
        description: analysis.ozet,
        date: analysis.sonTarih,
        source: "gmail",
        sourceId: emailId || "",
        risk: analysis.risk,
        court: analysis.mahkeme,
        fileNo: analysis.dosyaNo,
        institution: analysis.kurum,
        actions: analysis.yapilacaklar,
        raw: {
          subject,
          from,
          date,
          emailId,
          extractionMode,
          uetsExtraction,
          analysis,
          deadlineRecord,
        },
      };

      calendarEvent =
        await CalendarEngine.createLegalEvent(
          legalEvent
        );

      storedCalendarEvent =
        await CalendarStore.save(
          calendarEvent
        );

      reminders =
        await ReminderEngine.createReminders(
          calendarEvent
        );

      await CoreEvents.publish({
        type: "calendar.event.created",
        source: "calendar",
        product: "lawyer",
        correlationId,
        payload: {
          extractionMode,
          calendarEvent,
          storedCalendarEvent,
          reminders,
        },
      });
    }

    return NextResponse.json({
      ok: true,

      data: {
        analysis,
        extractionMode,
        uetsExtraction,
        deadline: deadlineRecord,
        calendarEvent,
        storedCalendarEvent,
        reminders,
      },

      analysis,
      extractionMode,
      uetsExtraction,
      deadline: deadlineRecord,
      calendarEvent,
      storedCalendarEvent,
      reminders,

      aiProvider,
      aiModel,
      correlationId,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Mail analizi sırasında hata oluştu.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}


