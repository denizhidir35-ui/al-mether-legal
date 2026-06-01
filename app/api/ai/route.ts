import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/lib/supabase";

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY!
);

export async function POST(
  req: Request
) {
  try {
    const {
      subject,
      body,
    } = await req.json();

    if (!body) {
      return Response.json(
        {
          error:
            "Mail içeriği bulunamadı",
        },
        { status: 400 }
      );
    }

    const model =
      genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
      });

    const prompt = `
Sen AL Mether Legal isimli profesyonel hukuk operasyon yapay zekasısın.

Aşağıdaki maili analiz et.

SADECE JSON döndür.

{
  "davaTuru":"",
  "risk":"",
  "sonTarih":"",
  "confidence":0,
  "ozet":"",
  "yapilacaklar":[]
}

Kurallar:

- confidence 0-100 arası sayı olmalı
- risk mutlaka Düşük / Orta / Yüksek olmalı
- davaTuru boş bırakma
- sonTarih bulunamazsa boş bırak
- JSON dışında hiçbir şey yazma

MAIL KONUSU:
${subject}

MAIL ICERIGI:
${body}
`;

    const result =
      await model.generateContent(
        prompt
      );

    let response =
      result.response.text();

    response = response
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let analysis;

    try {
      analysis =
        JSON.parse(response);
    } catch {
      return Response.json(
        {
          error:
            "JSON parse hatası",
          raw: response,
        },
        { status: 500 }
      );
    }

    // UETS 5 GÜN KURALI

    const { error } =
   await supabase
    .from("deadlines")
    .insert([
      {
        title:
          subject ||
          analysis.davaTuru,

        risk:
          analysis.risk,

        deadline_date:
          analysis.sonTarih || null,

        source_mail:
          subject,

        confidence:
          analysis.confidence || 0,

        calendar_created:
          false,

        reminder_created:
          false,

        status:
          "pending",
      },
    ]);

if (error) {
  console.error(
    "SUPABASE HATASI:",
    error
  );
}

    return Response.json(
      analysis
    );
  } catch (error: any) {
    console.error(
      "AI HATASI:",
      error
    );

    return Response.json(
      {
        error:
          error.message ||
          "AI analizi başarısız",
      },
      { status: 500 }
    );
  }
}
