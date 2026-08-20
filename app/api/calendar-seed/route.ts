import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateAppUser } from "@/lib/alUser";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        ok: false,
        error: "Demo takvim verisi production ortamında devre dışıdır.",
      },
      { status: 410 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { appUser, error } = await getOrCreateAppUser();

  if (error || !appUser) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();

  const demoEvents = [
    {
      user_id: appUser.id,
      title: "İstinaf Son Günü",
      description: "2026/145 dosyası için kritik son gün.",
      event_type: "legal_deadline",
      due_date: new Date(y, m, 3).toISOString().slice(0, 10),
      start_date: new Date(y, m, 3).toISOString().slice(0, 10),
      end_date: new Date(y, m, 3).toISOString().slice(0, 10),
      priority: "critical",
      status: "active",
      source: "demo",
    },
    {
      user_id: appUser.id,
      title: "Tebligat Kontrolü",
      description: "Yeni elektronik tebligat için süre kontrolü.",
      event_type: "notification_review",
      due_date: new Date(y, m, 8).toISOString().slice(0, 10),
      start_date: new Date(y, m, 8).toISOString().slice(0, 10),
      end_date: new Date(y, m, 8).toISOString().slice(0, 10),
      priority: "high",
      status: "active",
      source: "demo",
    },
    {
      user_id: appUser.id,
      title: "Duruşma",
      description: "İzmir 21. İş Mahkemesi.",
      event_type: "hearing",
      due_date: new Date(y, m, 15).toISOString().slice(0, 10),
      start_date: new Date(y, m, 15).toISOString().slice(0, 10),
      end_date: new Date(y, m, 15).toISOString().slice(0, 10),
      priority: "normal",
      status: "active",
      source: "demo",
    },
  ];

  const { error: dbError } = await supabase.from("calendar_events").insert(demoEvents);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
