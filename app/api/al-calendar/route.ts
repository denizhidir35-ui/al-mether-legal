import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateAppUser } from "@/lib/alUser";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { appUser, error } = await getOrCreateAppUser();

  if (error || !appUser) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { data, error: dbError } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", appUser.id)
    .order("due_date", { ascending: true });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ events: data || [] });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  const { appUser, error } = await getOrCreateAppUser();

  if (error || !appUser) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const body = await request.json();

  const title = body.title?.toString()?.trim();
  const dueDate = body.due_date?.toString()?.trim();

  if (!title || !dueDate) {
    return NextResponse.json(
      { error: "Başlık ve son tarih zorunludur." },
      { status: 400 }
    );
  }

  const { data, error: dbError } = await supabase
    .from("calendar_events")
    .insert({
      user_id: appUser.id,
      title,
      description: body.description || null,
      event_type: body.event_type || "deadline",
      start_date: body.start_date || dueDate,
      end_date: body.end_date || dueDate,
      due_date: dueDate,
      status: "active",
      priority: body.priority || "normal",
      source: body.source || "manual",
      source_mail_id: body.source_mail_id || null,
    })
    .select("*")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const defaultAlarmDays = [7, 3, 1];

  const alarms = defaultAlarmDays.map((daysBefore) => {
    const alarmDate = new Date(`${dueDate}T09:00:00`);
    alarmDate.setDate(alarmDate.getDate() - daysBefore);

    return {
      user_id: appUser.id,
      calendar_event_id: data.id,
      alarm_time: alarmDate.toISOString(),
      alarm_type: `${daysBefore}_days_before`,
      message: `${title} için son güne ${daysBefore} gün kaldı.`,
      status: "pending",
    };
  });

  await supabase.from("alarms").insert(alarms);

  return NextResponse.json({ event: data });
}
