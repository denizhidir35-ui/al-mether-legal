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

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split(".");
    return `${year}-${month}-${day}`;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split("/");
    return `${year}-${month}-${day}`;
  }

  const date = new Date(trimmed);

  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return "";
}

function normalizeConfidence(value: unknown) {
  const num = Number(value || 0);

  if (Number.isNaN(num)) return 0;

  if (num <= 1) {
    return Math.round(num * 100);
  }

  return Math.round(num);
}

function extractDateFromText(text: string) {
  if (!text) return "";

  const allDates: string[] = [];

  const isoMatches = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
  for (const date of isoMatches) {
    allDates.push(date);
  }

  const dotMatches = text.match(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g) || [];
  for (const raw of dotMatches) {
    const [day, month, year] = raw.split(".");
    const cleanDay = day.padStart(2, "0");
    const cleanMonth = month.padStart(2, "0");
    allDates.push(`${year}-${cleanMonth}-${cleanDay}`);
  }

  const slashMatches = text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g) || [];
  for (const raw of slashMatches) {
    const [day, month, year] = raw.split("/");
    const cleanDay = day.padStart(2, "0");
    const cleanMonth = month.padStart(2, "0");
    allDates.push(`${year}-${cleanMonth}-${cleanDay}`);
  }

  const validDates = allDates
    .map((date) => ({
      raw: date,
      time: new Date(`${date}T00:00:00`).getTime(),
    }))
    .filter((item) => !Number.isNaN(item.time))
    .sort((a, b) => b.time - a.time);

  return validDates[0]?.raw || "";
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
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
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

Aşağıdaki mailden mümkün olan HER bilgiyi çıkart.

Özellikle:
- Mahkeme adı
- Dosya numarası
- Dava türü
- Tebligat bilgisi
- Kurum
- Son tarih
- Risk seviyesi
- Yapılması gereken işlemler

ÇOK ÖNEMLİ TARİH KURALI:
- sonTarih kesinlikle YYYY-MM-DD formatında olmalı.
- Mailde "tebliğ edilmiş sayılacaktır", "son gün", "son tarih", "süre sonu", "cevap süresi" gibi tarih varsa bunu sonTarih alanına yaz.
- Örnek: 2026-06-15
- Tarih bulunamazsa sonTarih boş string olsun: ""
- "15 gün içinde", "2 hafta içinde" gibi ifade varsa bugünden hesaplama yap.
- Bugünün tarihi: ${today}

Kurallar:
- Sadece JSON döndür.
- Açıklama yazma.
- Markdown yazma.
- Risk sadece şunlardan biri olsun:
Düşük
Orta
Yüksek

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

      return Response.json(
        fallbackAnalysis(
          "AI servisi şu anda yoğun veya geçici olarak kullanılamıyor."
        )
      );
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

    const combinedText = `
${analysis.sonTarih || ""}
${analysis.ozet || ""}
${subject || ""}
${body || ""}
`;

    const detectedDate =
      cleanDate(analysis.sonTarih) || extractDateFromText(combinedText);

    analysis = {
      davaTuru: analysis.davaTuru || "-",
      mahkeme: analysis.mahkeme || "-",
      dosyaNo: analysis.dosyaNo || "-",
      kurum: analysis.kurum || "-",
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