import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateAppUser } from "@/lib/alUser";

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { appUser, error } = await getOrCreateAppUser();

  if (error || !appUser) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const today = new Date();
  const todayStr = toDateOnly(today);

  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const weekEndStr = toDateOnly(weekEnd);

  const [casesRes, todayRes, weekRes, criticalRes, timelineRes] =
    await Promise.all([
      supabase
        .from("legal_cases")
        .select("id", { count: "exact", head: true })
        .eq("user_id", appUser.id)
        .eq("status", "active"),

      supabase
        .from("calendar_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", appUser.id)
        .eq("due_date", todayStr)
        .eq("status", "active"),

      supabase
        .from("calendar_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", appUser.id)
        .gte("due_date", todayStr)
        .lte("due_date", weekEndStr)
        .eq("status", "active"),

      supabase
        .from("legal_cases")
        .select("id", { count: "exact", head: true })
        .eq("user_id", appUser.id)
        .in("risk_level", ["critical", "high"]),

      supabase
        .from("calendar_events")
        .select("id, title, due_date, priority, event_type, status")
        .eq("user_id", appUser.id)
        .gte("due_date", todayStr)
        .lte("due_date", weekEndStr)
        .order("due_date", { ascending: true })
        .limit(8),
    ]);

  const firstError =
    casesRes.error ||
    todayRes.error ||
    weekRes.error ||
    criticalRes.error ||
    timelineRes.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  return NextResponse.json({
    stats: {
      activeCases: casesRes.count || 0,
      todayDeadlines: todayRes.count || 0,
      weekDeadlines: weekRes.count || 0,
      criticalCases: criticalRes.count || 0,
    },
    timeline: timelineRes.data || [],
  });
}
