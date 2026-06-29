import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { getOrCreateAppUser } from "@/lib/alUser";

function clean(value: unknown) {
  return String(value || "").trim();
}

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { appUser, error } = await getOrCreateAppUser();

  if (error || !appUser) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = clean(url.searchParams.get("q"));

  if (!q || q.length < 2) {
    return NextResponse.json({
      query: q,
      cases: [],
      mails: [],
      events: [],
      alarms: [],
    });
  }

  const like = `%${q}%`;

  const [casesRes, mailsRes, eventsRes, alarmsRes] = await Promise.all([
    supabase
      .from("legal_cases")
      .select("id, case_number, court_name, case_title, case_type, risk_level, status, created_at")
      .eq("user_id", appUser.id)
      .or(`case_number.ilike.${like},court_name.ilike.${like},case_title.ilike.${like},case_type.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(10),

    supabase
      .from("case_mails")
      .select("id, case_id, subject, sender, received_at, snippet, ai_summary, created_at")
      .eq("user_id", appUser.id)
      .or(`subject.ilike.${like},sender.ilike.${like},snippet.ilike.${like},ai_summary.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(10),

    supabase
      .from("calendar_events")
      .select("id, case_id, title, description, event_type, due_date, priority, status, source, created_at")
      .eq("user_id", appUser.id)
      .or(`title.ilike.${like},description.ilike.${like},event_type.ilike.${like},priority.ilike.${like}`)
      .order("due_date", { ascending: true })
      .limit(10),

    supabase
      .from("alarms")
      .select("id, case_id, calendar_event_id, legal_deadline_id, alarm_time, alarm_type, message, status, created_at")
      .eq("user_id", appUser.id)
      .or(`alarm_type.ilike.${like},message.ilike.${like},status.ilike.${like}`)
      .order("alarm_time", { ascending: true })
      .limit(10),
  ]);

  const firstError =
    casesRes.error || mailsRes.error || eventsRes.error || alarmsRes.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  return NextResponse.json({
    query: q,
    cases: casesRes.data || [],
    mails: mailsRes.data || [],
    events: eventsRes.data || [],
    alarms: alarmsRes.data || [],
  });
}
