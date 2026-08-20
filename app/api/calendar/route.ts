import { google } from "googleapis";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CalendarBody = {
  title?: string;
  date?: string;
  client?: string;
  description?: string;
  caseType?: string;
  risk?: string;
  court?: string;
  fileNo?: string;
  confidence?: number;
};

function parseDate(input?: string) {
  if (!input || input.trim() === "" || input.trim() === "-") {
    throw new Error("Geçersiz tarih formatı: tarih boş geldi");
  }

  const cleanInput = input.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanInput)) {
    return new Date(`${cleanInput}T09:00:00+03:00`);
  }

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(cleanInput)) {
    const [day, month, year] = cleanInput.split(".");
    return new Date(`${year}-${month}-${day}T09:00:00+03:00`);
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanInput)) {
    const [day, month, year] = cleanInput.split("/");
    return new Date(`${year}-${month}-${day}T09:00:00+03:00`);
  }

  const date = new Date(cleanInput);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Geçersiz tarih formatı: ${cleanInput}`);
  }

  return date;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      {
        success: false,
        error: "Bu eski takvim entegrasyonu production ortamında devre dışıdır.",
      },
      { status: 410 }
    );
  }

  try {
    const body = (await req.json()) as CalendarBody;
    const supabase = getSupabaseAdmin();

    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error("GOOGLE_CLIENT_ID eksik");
    }

    if (!process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error("GOOGLE_CLIENT_SECRET eksik");
    }

    if (!process.env.GOOGLE_REFRESH_TOKEN) {
      throw new Error("GOOGLE_REFRESH_TOKEN eksik");
    }

    const startDate = parseDate(body.date);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL
        ? `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
        : "http://localhost:3000/api/auth/callback/google"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const calendar = google.calendar({
      version: "v3",
      auth: oauth2Client,
    });

    const summary = body.title || "AL Mether Deadline";
    const deadlineDate = toDateOnly(startDate);

    const description = `
AL Mether Legal tarafından oluşturuldu.

Müvekkil / Gönderen:
${body.client || "-"}

Dava Türü:
${body.caseType || "-"}

Risk:
${body.risk || "-"}

Mahkeme:
${body.court || "-"}

Dosya No:
${body.fileNo || "-"}

Açıklama:
${body.description || "-"}
`.trim();

    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary,
        description,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: "Europe/Istanbul",
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: "Europe/Istanbul",
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 7 * 24 * 60 },
            { method: "popup", minutes: 3 * 24 * 60 },
            { method: "popup", minutes: 24 * 60 },
            { method: "popup", minutes: 60 },
          ],
        },
      },
    });

    const calendarEventId = event.data.id || null;
    const calendarEventLink = event.data.htmlLink || null;

    const { data: existingDeadline } = await supabase
      .from("deadlines")
      .select("id")
      .eq("title", summary)
      .eq("deadline_date", deadlineDate)
      .maybeSingle();

    if (existingDeadline?.id) {
      const { error: updateError } = await supabase
        .from("deadlines")
        .update({
          risk: body.risk || "Orta",
          source_mail: body.client || null,
          confidence: body.confidence || 0,
          calendar_created: true,
          reminder_created: true,
          status: "pending",
          calendar_event_id: calendarEventId,
          calendar_event_link: calendarEventLink,
        })
        .eq("id", existingDeadline.id);

      if (updateError) {
        console.error("SUPABASE CALENDAR UPDATE:", updateError);
      }
    } else {
      const { error: insertError } = await supabase
        .from("deadlines")
        .insert([
          {
            title: summary,
            risk: body.risk || "Orta",
            deadline_date: deadlineDate,
            source_mail: body.client || null,
            confidence: body.confidence || 0,
            calendar_created: true,
            reminder_created: true,
            status: "pending",
            calendar_event_id: calendarEventId,
            calendar_event_link: calendarEventLink,
          },
        ]);

      if (insertError) {
        console.error("SUPABASE CALENDAR INSERT:", insertError);
      }
    }

    return Response.json({
      success: true,
      eventId: calendarEventId,
      eventLink: calendarEventLink,
      deadlineDate,
    });
  } catch (error: unknown) {
    console.error("CALENDAR ERROR:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Takvim oluşturulamadı";

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
