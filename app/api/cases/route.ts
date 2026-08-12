import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateAppUser } from "@/lib/alUser";
import { isTestOrDevRecord } from "@/lib/testRecordVisibility";

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
        ai_confidence,
        calendar_event_id
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

  const { data: deemedServiceEvents, error: deemedServiceError } =
    await supabase
      .from("calendar_events")
      .select("id,case_id,event_type,start_date,due_date")
      .eq("user_id", appUser.id)
      .eq("event_type", "deemed_service");

  if (deemedServiceError) {
    return NextResponse.json(
      { error: deemedServiceError.message },
      { status: 500 }
    );
  }

  const cases = (data || [])
    .filter(
      (legalCase) =>
        !isTestOrDevRecord({
          source: legalCase.source,
          title: legalCase.case_title,
        }) &&
        !legalCase.case_mails?.some((mail: { subject?: string | null }) =>
          isTestOrDevRecord({ subject: mail.subject })
        )
    )
    .map((legalCase) => ({
      ...legalCase,
      deemed_service_events: (deemedServiceEvents || []).filter(
        (event) => event.case_id === legalCase.id
      ),
    }));

  return NextResponse.json({ cases });
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

