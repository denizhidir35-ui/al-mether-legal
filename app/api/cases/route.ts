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
    .from("legal_cases")
    .select(`
      *,
      legal_deadlines (
        id,
        title,
        calculated_due_date,
        status,
        ai_confidence
      ),
      case_mails (
        id,
        subject,
        sender,
        received_at
      )
    `)
    .eq("user_id", appUser.id)
    .order("created_at", { ascending: false });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ cases: data || [] });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  const { appUser, error } = await getOrCreateAppUser();

  if (error || !appUser) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const body = await request.json();

  const caseTitle = body.case_title?.toString()?.trim();

  if (!caseTitle) {
    return NextResponse.json(
      { error: "Dosya başlığı zorunludur." },
      { status: 400 }
    );
  }

  const { data, error: dbError } = await supabase
    .from("legal_cases")
    .insert({
      user_id: appUser.id,
      case_number: body.case_number || null,
      court_name: body.court_name || null,
      case_title: caseTitle,
      case_type: body.case_type || null,
      status: body.status || "active",
      risk_level: body.risk_level || "normal",
      source: body.source || "manual",
    })
    .select("*")
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ case: data });
}

