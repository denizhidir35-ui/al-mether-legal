import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

import { AIGateway } from "@/lib/core/ai";
import { CoreEvents } from "@/lib/core/events";
import { CalendarEngine } from "@/lib/calendar/CalendarEngine";
import { CalendarStore } from "@/lib/calendar/CalendarStore";
import { ReminderEngine } from "@/lib/calendar/ReminderEngine";
import type { LegalEvent } from "@/lib/calendar/LegalEvent";

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

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

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

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string").map((item) => item.trim());
}

function safeConfidence(value: unknown) {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

function extractJson(text: string) {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error("AI JSON çıktısı bulunamadı.");
  }

  return cleaned.slice(start, end + 1);
}

function normalizeAnalysis(raw: any): AIAnalysis {
  return {
    davaTuru: safeString(raw?.davaTuru),
    mahkeme: safeString(raw?.mahkeme),
    dosyaNo: safeString(raw?.dosyaNo),
    kurum: safeString(raw?.kurum),
    risk: safeString(raw?.risk || "Orta"),
    sonTarih: cleanDate(raw?.sonTarih),
    confidence: safeConfidence(raw?.confidence),
    ozet: safeString(raw?.ozet),
    yapilacaklar: safeStringArray(raw?.yapilacaklar),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const subject = safeString(body?.subject);
    const from = safeString(body?.from);
    const date = safeString(body?.date);
    const text = safeString(body?.text || body?.body || body?.content);
    const emailId = safeString(body?.emailId || body?.messageId);
    const correlationId = crypto.randomUUID();

    if (!text && !subject) {
      return NextResponse.json(
        { error: "Analiz için mail içeriği bulunamadı." },
        { status: 400 }
      );
    }

    const prompt = `
Sen AL METHER LEGAL için çalışan profesyonel bir hukuk mail analiz motorusun.

Görevin:
- Mail içeriğini analiz et
- Dava türünü belirle
- Mahkeme / kurum / dosya no bilgilerini çıkar
- Hukuki risk seviyesini belirle
- Son tarih varsa YYYY-MM-DD formatında çıkar
- Son tarih yoksa boş string döndür
- Avukatın yapması gerekenleri maddeler halinde yaz

Sadece geçerli JSON döndür.

JSON şeması:
{
  "davaTuru": "",
  "mahkeme": "",
  "dosyaNo": "",
  "kurum": "",
  "risk": "Düşük | Orta | Yüksek | Kritik",
  "sonTarih": "YYYY-MM-DD",
  "confidence": 0,
  "ozet": "",
  "yapilacaklar": []
}

MAIL BİLGİLERİ:
Konu: ${subject}
Gönderen: ${from}
Tarih: ${date}

MAIL İÇERİĞİ:
${text}
`;

    const aiResponse = await AIGateway.generate({
      provider: "gemini",
      model: "gemini-2.5-flash",
      product: "legal",
      task: "mail-analysis",
      jsonMode: true,
      messages: [
        {
          role: "system",
          content: "Sen AL METHER LEGAL için çalışan hukuk mail analiz motorusun.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      metadata: {
        subject,
        from,
        date,
        emailId,
      },
    });

    if (!aiResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: aiResponse.error || "AI Gateway hata verdi.",
        },
        { status: 500 }
      );
    }

    const jsonText = extractJson(aiResponse.text);
    const parsed = JSON.parse(jsonText);
    const analysis = normalizeAnalysis(parsed);

    await CoreEvents.publish({
      type: "legal.ai.analysis.completed",
      source: "legal",
      product: "legal",
      correlationId,
      payload: {
        subject,
        from,
        date,
        emailId,
        analysis,
      },
    });

    let deadlineRecord = null;

    if (analysis.sonTarih) {
      const { data, error } = await supabase
        .from("deadlines")
        .insert({
          email_id: emailId || null,
          subject: subject || null,
          sender: from || null,
          dava_turu: analysis.davaTuru || null,
          mahkeme: analysis.mahkeme || null,
          dosya_no: analysis.dosyaNo || null,
          kurum: analysis.kurum || null,
          risk: analysis.risk || null,
          son_tarih: analysis.sonTarih,
          ozet: analysis.ozet || null,
          yapilacaklar: analysis.yapilacaklar,
          confidence: analysis.confidence,
          status: "active",
        })
        .select()
        .single();

      if (!error) {
        deadlineRecord = data;

        await CoreEvents.publish({
          type: "legal.deadline.created",
          source: "legal",
          product: "legal",
          correlationId,
          payload: {
            deadline: deadlineRecord,
            analysis,
            emailId,
          },
        });
      }
    }

    let calendarEvent = null;
    let storedCalendarEvent = null;
    let reminders = null;

    if (analysis.sonTarih) {
      const legalEvent: LegalEvent = {
        id: deadlineRecord?.id || emailId || crypto.randomUUID(),
        title: subject || analysis.davaTuru || "Hukuki Süre",
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
          analysis,
          deadlineRecord,
        },
      };

      calendarEvent = await CalendarEngine.createLegalEvent(legalEvent);
      storedCalendarEvent = await CalendarStore.save(calendarEvent);
      reminders = await ReminderEngine.createReminders(calendarEvent);

      await CoreEvents.publish({
        type: "calendar.event.created",
        source: "calendar",
        product: "legal",
        correlationId,
        payload: {
          calendarEvent,
          storedCalendarEvent,
          reminders,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      analysis,
      deadline: deadlineRecord,
      calendarEvent,
      storedCalendarEvent,
      reminders,
      aiProvider: aiResponse.provider,
      aiModel: aiResponse.model,
      correlationId,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "AI analiz sırasında hata oluştu.",
      },
      { status: 500 }
    );
  }
}
