import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } =
      await supabase
        .from("deadlines")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      throw error;
    }

    return Response.json(data);
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error:
          error.message ||
          "Veriler alınamadı",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request
) {
  try {
    const {
      title,
      risk,
      deadline,
      sourceMail,
    } = await req.json();

    const { data, error } =
      await supabase
        .from("deadlines")
        .insert([
          {
            title,
            risk,
            deadline_date:
              deadline || null,
            source_mail:
              sourceMail || null,
          },
        ])
        .select();

    if (error) {
      throw error;
    }

    return Response.json({
      success: true,
      data,
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        error:
          error.message ||
          "Kayıt oluşturulamadı",
      },
      { status: 500 }
    );
  }
}
