import "server-only";

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateAppUser } from "@/lib/alUser";

function clean(value: unknown) {
  return String(value || "").trim();
}

function normalizeSearchText(value: unknown) {
  return clean(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function istanbulDateOnly() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dateAlias(value: unknown, today: string) {
  const date = clean(value).slice(0, 10);
  return date === today ? "bugün bugun today" : "";
}

function relevance(query: string, fields: unknown[]) {
  const normalizedQuery = normalizeSearchText(query);
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const normalizedFields = fields.map(normalizeSearchText).filter(Boolean);
  const haystack = normalizedFields.join(" ");
  const compactQuery = normalizedQuery.replace(/[^a-z0-9]/g, "");
  const compactHaystack = haystack.replace(/[^a-z0-9]/g, "");

  if (
    tokens.length === 0 ||
    (!tokens.every((token) => haystack.includes(token)) &&
      !(compactQuery && compactHaystack.includes(compactQuery)))
  ) {
    return -1;
  }

  let score = 0;
  for (const field of normalizedFields) {
    if (field === normalizedQuery) score = Math.max(score, 140);
    else if (field.startsWith(normalizedQuery)) score = Math.max(score, 100);
    else if (field.includes(normalizedQuery)) score = Math.max(score, 75);
  }

  score += tokens.reduce(
    (total, token) => total + normalizedFields.filter((field) => field.includes(token)).length * 8,
    0
  );

  if (compactQuery && compactHaystack.includes(compactQuery)) score += 45;
  return score;
}

function ranked<T>(rows: T[], query: string, fields: (row: T) => unknown[]) {
  return rows
    .map((row) => ({ row, score: relevance(query, fields(row)) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 10)
    .map((item) => item.row);
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
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
      documents: [],
      events: [],
      alarms: [],
    });
  }

  const [casesRes, mailsRes, documentsRes, eventsRes, alarmsRes, partiesRes] =
    await Promise.all([
      supabase
        .from("legal_cases")
        .select("id,case_number,court_name,case_title,case_type,risk_level,status,created_at")
        .eq("user_id", appUser.id)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("case_mails")
        .select("id,case_id,subject,sender,received_at,snippet,ai_summary,created_at")
        .eq("user_id", appUser.id)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("case_document_records")
        .select("id,case_id,file_name,document_type,created_at")
        .eq("user_id", appUser.id)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("calendar_events")
        .select("id,case_id,title,description,event_type,start_date,due_date,priority,status,source,created_at")
        .eq("user_id", appUser.id)
        .order("due_date", { ascending: true })
        .limit(1000),
      supabase
        .from("alarms")
        .select("id,case_id,calendar_event_id,legal_deadline_id,alarm_time,alarm_type,message,status,created_at")
        .eq("user_id", appUser.id)
        .order("alarm_time", { ascending: true })
        .limit(1000),
      supabase
        .from("case_parties")
        .select("case_id,name,role")
        .eq("user_id", appUser.id)
        .limit(1000),
    ]);

  const firstError =
    casesRes.error ||
    mailsRes.error ||
    documentsRes.error ||
    eventsRes.error ||
    alarmsRes.error ||
    partiesRes.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const today = istanbulDateOnly();
  const partyNamesByCase = new Map<string, string[]>();

  for (const party of partiesRes.data || []) {
    const names = partyNamesByCase.get(party.case_id) || [];
    names.push(`${party.name || ""} ${party.role || ""}`);
    partyNamesByCase.set(party.case_id, names);
  }

  return NextResponse.json({
    query: q,
    cases: ranked(casesRes.data || [], q, (item) => [
      item.case_number,
      item.court_name,
      item.case_title,
      item.case_type,
      ...(partyNamesByCase.get(item.id) || []),
    ]),
    mails: ranked(mailsRes.data || [], q, (item) => [
      item.subject,
      item.sender,
      item.snippet,
      item.ai_summary,
      dateAlias(item.received_at || item.created_at, today),
    ]),
    documents: ranked(documentsRes.data || [], q, (item) => [
      item.file_name,
      item.document_type,
      dateAlias(item.created_at, today),
    ]),
    events: ranked(eventsRes.data || [], q, (item) => [
      item.title,
      item.description,
      item.event_type,
      item.priority,
      item.status,
      item.source,
      item.start_date,
      item.due_date,
      dateAlias(item.due_date || item.start_date, today),
    ]),
    alarms: ranked(alarmsRes.data || [], q, (item) => [
      item.message,
      item.alarm_type,
      item.status,
      item.alarm_time,
      dateAlias(item.alarm_time, today),
    ]),
  });
}
