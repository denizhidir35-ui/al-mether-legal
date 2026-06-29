import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { getOrCreateAppUser } from "@/lib/alUser";

function normalizeRisk(risk?: string | null) {
  const value = (risk || "").toLowerCase();

  if (value.includes("kritik") || value.includes("critical")) return "critical";
  if (value.includes("yüksek") || value.includes("high")) return "high";
  if (value.includes("düşük") || value.includes("low")) return "low";

  return "normal";
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { appUser, error } = await getOrCreateAppUser();

  if (error || !appUser) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const body = await request.json();

  const caseNumber = body.case_number || body.dosya_no || null;
  const courtName = body.court_name || body.mahkeme || null;
  const title =
    body.case_title ||
    body.title ||
    body.subject ||
    caseNumber ||
    "Tebligat Dosyası";

  const dueDate =
    body.calculated_due_date ||
    body.deadline_date ||
    body.son_tarih ||
    null;

  const riskLevel = normalizeRisk(body.risk || body.risk_level);

  let legalCase = null;

  if (caseNumber) {
    const found = await supabase
      .from("legal_cases")
      .select("*")
      .eq("user_id", appUser.id)
      .eq("case_number", caseNumber)
      .maybeSingle();

    legalCase = found.data;
  }

  if (!legalCase) {
    const created = await supabase
      .from("legal_cases")
      .insert({
        user_id: appUser.id,
        case_number: caseNumber,
        court_name: courtName,
        case_title: title,
        case_type: body.case_type || body.dava_turu || "Tebligat",
        status: "active",
        risk_level: riskLevel,
        source: "gmail_ai",
      })
      .select("*")
      .single();

    if (created.error) {
      return NextResponse.json({ error: created.error.message }, { status: 500 });
    }

    legalCase = created.data;
  }

  if (body.gmail_message_id || body.subject) {
    await supabase.from("case_mails").insert({
      user_id: appUser.id,
      case_id: legalCase.id,
      gmail_message_id: body.gmail_message_id || null,
      subject: body.subject || title,
      sender: body.sender || null,
      received_at: body.received_at || null,
      snippet: body.snippet || null,
      body: body.mail_body || null,
      ai_summary: body.ai_summary || body.summary || null,
    });
  }

  let deadline: any = null;

  if (dueDate) {
    const createdDeadline = await supabase
      .from("legal_deadlines")
      .insert({
        user_id: appUser.id,
        case_id: legalCase.id,
        title,
        notification_date: body.notification_date || body.teblig_tarihi || null,
        start_date: body.start_date || body.baslangic_tarihi || null,
        calculated_due_date: dueDate,
        legal_basis: body.legal_basis || body.kanuni_dayanak || null,
        deadline_days: body.deadline_days || body.sure_gun || null,
        deadline_type: body.deadline_type || body.sure_tipi || null,
        rule_used: body.rule_used || null,
        ai_confidence: body.ai_confidence || body.confidence || null,
        status: "open",
      })
      .select("*")
      .single();

    deadline = createdDeadline.data;

    const createdEvent = await supabase
      .from("calendar_events")
      .insert({
        user_id: appUser.id,
        case_id: legalCase.id,
        title,
        description: body.ai_summary || body.summary || null,
        event_type: "legal_deadline",
        start_date: dueDate,
        end_date: dueDate,
        due_date: dueDate,
        status: "active",
        priority: riskLevel,
        source: "gmail_ai",
        source_mail_id: body.gmail_message_id || null,
      })
      .select("*")
      .single();

    if (createdEvent.data && deadline?.id) {
      await supabase
        .from("legal_deadlines")
        .update({ calendar_event_id: createdEvent.data.id })
        .eq("id", deadline.id);

      const alarmDays = [7, 3, 1, 0];

      const alarms = alarmDays.map((daysBefore) => {
        const alarmDate = new Date(`${dueDate}T09:00:00`);
        alarmDate.setDate(alarmDate.getDate() - daysBefore);

        return {
          user_id: appUser.id,
          case_id: legalCase.id,
          calendar_event_id: createdEvent.data.id,
          legal_deadline_id: deadline.id,
          alarm_time: alarmDate.toISOString(),
          alarm_type: daysBefore === 0 ? "same_day" : `${daysBefore}_days_before`,
          message:
            daysBefore === 0
              ? `${title} için bugün son gün.`
              : `${title} için son güne ${daysBefore} gün kaldı.`,
          status: "pending",
        };
      });

      await supabase.from("alarms").insert(alarms);
    }
  }

  return NextResponse.json({
    ok: true,
    case: legalCase,
    deadline,
  });
}
