import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/lib/supabase";

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

function cleanDate(value: unknown) {
  if (!value || typeof value !== "string") return "";

  const trimmed = value.trim();

  if (!trimmed || trimmed === "-") return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split(".");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return "";
}

function normalizeConfidence(value: unknown) {
  const num = Number(value || 0);

  if (Number.isNaN(num)) return 0;

  if (num <= 1) return Math.round(num * 100);

  return Math.round(num);
}

function extractDateFromText(text: string) {
  if (!text) return "";

  const dates: string[] = [];

  const normalized = text
    .replace(/\*/g, " ")
    .replace(/>/g, " ")
    .replace(/</g, " ")
    .replace(/\s+/g, " ");

  const isoMatches =
    normalized.match(/\b\d{4}-\d{1,2}-\d{1,2}\b/g) || [];

  for (const raw of isoMatches) {
    const [year, month, day] = raw.split("-");
    dates.push(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
  }

  const dotMatches =
    normalized.match(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g) || [];

  for (const raw of dotMatches) {
    const [day, month, year] = raw.split(".");
    dates.push(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
  }

  const slashMatches =
    normalized.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g) || [];

  for (const raw of slashMatches) {
    const [day, month, year] = raw.split("/");
    dates.push(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
  }

  const uniqueValidDates = Array.from(new Set(dates))
    .map((date) => ({
      date,
      time: new Date(`${date}T00:00:00`).getTime(),
    }))
    .filter((item) => !Number.isNaN(item.time))
    .sort((a, b) => b.time - a.time);

  return uniqueValidDates[0]?.date || "";
}

function fallbackAnalysis(message: string): AIAnalysis {
  return {
    davaTuru: "Tespit Edilemedi",
    mahkeme: "Tespit Edilemedi",
    dosyaNo: "Tespit Edilemedi",
    kurum: "Tespit Edilemedi",
    risk: "Orta",
    sonTarih: "",
    confidence: 0,
    ozet: message,
    yapilacaklar: [
      "AI servisi geçici olarak yanıt vermedi.",
      "Lütfen birkaç dakika sonra tekrar analiz edin.",
    ],
  };
}

async function generateWithFallback(
  genAI: GoogleGenerativeAI,
  prompt: string
) {
  const models = [
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
  ];

  let lastError: unknown = null;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
      });

      const result = await model.generateContent(prompt);

      return result.response.text();
    } catch (error) {
      console.error(`GEMINI MODEL HATASI (${modelName}):`, error);
      lastError = error;
    }
  }

  throw lastError;
}

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        {
          error: "GEMINI_API_KEY bulunamadı",
        },
        { status: 500 }
      );
    }

    const { subject, body } = await req.json();

    if (!body) {
      return Response.json(
        {
          error: "Mail içeriği bulunamadı",
        },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const today = new Date().toISOString().slice(0, 10);

    const prompt = `
Sen AL Mether Legal isimli hukuk operasyon yapay zekasısın.

Aşağıdaki mailden hukuki bilgileri çıkar.

ÖNEMLİ:
- sonTarih alanı MUTLAKA YYYY-MM-DD formatında olmalı.
- Mailde "tebliğ edilmiş sayılır", "tebliğ edilmiş sayılacaktır", "son gün", "süre sonu", "cevap süresi", "itiraz süresi" gibi bir tarih varsa bunu sonTarih yap.
- Örnek: 06.06.2026 görürsen "2026-06-06" döndür.
- Tarih bulunamazsa sonTarih boş string olsun: "".
- Bugünün tarihi: ${today}

Kurallar:
- Sadece JSON döndür.
- Markdown yazma.
- Açıklama yazma.
- Risk sadece: Düşük, Orta, Yüksek

JSON ŞEMASI:
{
  "davaTuru":"",
  "mahkeme":"",
  "dosyaNo":"",
  "kurum":"",
  "risk":"",
  "sonTarih":"",
  "confidence":0,
  "ozet":"",
  "yapilacaklar":[]
}

MAIL KONUSU:
${subject || ""}

MAIL:
${body}
`;

    let response: string;

    try {
      response = await generateWithFallback(genAI, prompt);
    } catch (error) {
      console.error("AI TÜM MODELLER BAŞARISIZ:", error);

      const fallbackDate = extractDateFromText(`${subject || ""} ${body || ""}`);

      return Response.json({
        ...fallbackAnalysis(
          "AI servisi şu anda yoğun veya geçici olarak kullanılamıyor."
        ),
        sonTarih: fallbackDate,
      });
    }

    response = response
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let analysis: AIAnalysis;

    try {
      analysis = JSON.parse(response);
    } catch {
      console.error("JSON PARSE:", response);

      analysis = fallbackAnalysis(
        "AI yanıtı JSON formatında çözümlenemedi."
      );
    }

    const detectedDate =
      cleanDate(analysis.sonTarih) ||
      extractDateFromText(
        `${analysis.ozet || ""} ${subject || ""} ${body || ""}`
      );

    analysis = {
      davaTuru: analysis.davaTuru || "Tespit Edilemedi",
      mahkeme: analysis.mahkeme || "Tespit Edilemedi",
      dosyaNo: analysis.dosyaNo || "Tespit Edilemedi",
      kurum: analysis.kurum || "Tespit Edilemedi",
      risk: analysis.risk || "Orta",
      sonTarih: detectedDate,
      confidence: normalizeConfidence(analysis.confidence),
      ozet: analysis.ozet || "-",
      yapilacaklar: Array.isArray(analysis.yapilacaklar)
        ? analysis.yapilacaklar
        : [],
    };

    const { error } = await supabase.from("deadlines").insert([
      {
        title: subject || analysis.davaTuru,
        risk: analysis.risk,
        deadline_date: analysis.sonTarih || null,
        source_mail: subject || null,
        confidence: analysis.confidence,
        calendar_created: false,
        reminder_created: false,
        status: "pending",
      },
    ]);

    if (error) {
      console.error("SUPABASE:", error);
    }

    return Response.json(analysis);
  } catch (error: unknown) {
    console.error("AI HATASI:", error);

    const message =
      error instanceof Error ? error.message : "AI analizi başarısız";

    return Response.json(fallbackAnalysis(message), { status: 200 });
  }
}