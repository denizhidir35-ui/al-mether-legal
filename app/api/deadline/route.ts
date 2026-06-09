import { supabase } from "@/lib/supabase";

type DeadlineBody = {
  title?: string;
  risk?: string;
  deadline?: string;
  deadlineDate?: string;
  deadline_date?: string;
  sourceMail?: string;
  source_mail?: string;
  confidence?: number;
};

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("deadlines")
      .select("*")
      .order("deadline_date", {
        ascending: true,
        nullsFirst: false,
      });

    if (error) {
      console.error("DEADLINE GET ERROR:", error);
      throw error;
    }

    return Response.json(data || [], {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Veriler alınamadı";

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DeadlineBody;

    const deadlineDate =
      body.deadline ||
      body.deadlineDate ||
      body.deadline_date ||
      null;

    const sourceMail =
      body.sourceMail ||
      body.source_mail ||
      null;

    const { data, error } = await supabase
      .from("deadlines")
      .insert([
        {
          title: body.title || "AL Mether Deadline",
          risk: body.risk || "Orta",
          deadline_date: deadlineDate,
          source_mail: sourceMail,
          confidence: body.confidence || 0,
          calendar_created: false,
          reminder_created: false,
          status: "pending",
        },
      ])
      .select();

    if (error) {
      console.error("DEADLINE POST ERROR:", error);
      throw error;
    }

    return Response.json({
      success: true,
      data,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Kayıt oluşturulamadı";

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}