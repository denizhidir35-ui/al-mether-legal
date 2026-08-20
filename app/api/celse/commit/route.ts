import { NextRequest, NextResponse } from "next/server";

import { getOrCreateAppUser } from "@/lib/alUser";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type DatabaseRow = Record<string, any>;

function safeText(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeCaseNumber(value: string) {
  return value.replace(/\s+/g, "").match(/\d{4}\/\d+/)?.[0] || "";
}

function normalizeCourt(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "");
}

function isRealIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  );

  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3])
  );
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isUyapSource(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "avukat.uyap.gov.tr" &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function createSourceKey(input: {
  court: string;
  fileNo: string;
  date: string;
  time: string;
}) {
  return [
    "celse-hearing-v1",
    normalizeCourt(input.court),
    normalizeCaseNumber(input.fileNo),
    input.date,
    input.time,
  ].join("|");
}

async function resolveCase(input: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  court: string;
  fileNo: string;
}) {
  const normalizedCourt = normalizeCourt(input.court);
  const normalizedCaseNumber = normalizeCaseNumber(input.fileNo);

  const found = await input.supabase
    .from("legal_cases")
    .select("*")
    .eq("user_id", input.userId)
    .eq("normalized_court", normalizedCourt)
    .eq("normalized_case_number", normalizedCaseNumber)
    .limit(2);

  if (found.error) throw new Error(found.error.message);
  if ((found.data || []).length > 1) {
    throw new Error(
      "Aynı mahkeme ve esas numarası için birden fazla dava bulundu."
    );
  }
  if (found.data?.[0]) {
    return { legalCase: found.data[0] as DatabaseRow, created: false };
  }

  const title = `${input.court} — ${normalizedCaseNumber}`;
  const created = await input.supabase
    .from("legal_cases")
    .insert({
      user_id: input.userId,
      case_number: normalizedCaseNumber,
      court_name: input.court,
      case_title: title,
      case_type: "UYAP Dava Dosyası",
      status: "active",
      risk_level: "normal",
      source: "celse_bridge",
    })
    .select("*")
    .single();

  if (!created.error && created.data) {
    return { legalCase: created.data as DatabaseRow, created: true };
  }

  if (created.error?.code === "23505") {
    const raced = await input.supabase
      .from("legal_cases")
      .select("*")
      .eq("user_id", input.userId)
      .eq("normalized_court", normalizedCourt)
      .eq("normalized_case_number", normalizedCaseNumber)
      .limit(1)
      .maybeSingle();

    if (raced.error) throw new Error(raced.error.message);
    if (raced.data) {
      return { legalCase: raced.data as DatabaseRow, created: false };
    }
  }

  throw new Error(created.error?.message || "Dava kaydı oluşturulamadı.");
}

export async function POST(request: NextRequest) {
  try {
    const { appUser, error } = await getOrCreateAppUser();
    if (error || !appUser) {
      return NextResponse.json(
        { ok: false, error: error || "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const court = safeText(body.court, 500);
    const fileNo = normalizeCaseNumber(safeText(body.fileNo, 200));
    const date = safeText(body.date, 20);
    const time = safeText(body.time, 10);
    const evidence = safeText(body.evidence, 2000);
    const sourceUrl = safeText(body.sourceUrl, 3000);

    if (!isUyapSource(sourceUrl)) {
      return NextResponse.json(
        { ok: false, error: "Geçersiz UYAP Avukat Portal kaynağı." },
        { status: 400 }
      );
    }

    if (
      !court ||
      !fileNo ||
      !isRealIsoDate(date) ||
      !isValidTime(time) ||
      !evidence
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dava ve duruşma bilgileri otomatik kayıt için yeterli değil.",
        },
        { status: 400 }
      );
    }

    const evidenceLower = evidence.toLocaleLowerCase("tr-TR");
    const dateParts = date.split("-").reverse();
    const evidenceDates = [
      date,
      dateParts.join("."),
      dateParts.join("/"),
      dateParts.join("-"),
    ];
    if (
      (!evidenceLower.includes("duruşma") &&
        !evidenceLower.includes("celse")) ||
      !evidenceDates.some((candidate) => evidence.includes(candidate))
    ) {
      return NextResponse.json(
        { ok: false, error: "Duruşma kanıt metni doğrulanamadı." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { legalCase, created: caseCreated } = await resolveCase({
      supabase,
      userId: appUser.id,
      court,
      fileNo,
    });
    const sourceKey = createSourceKey({ court, fileNo, date, time });

    const existingCandidates = await supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", appUser.id)
      .eq("event_type", "hearing")
      .eq("start_date", date);

    if (existingCandidates.error) {
      throw new Error(existingCandidates.error.message);
    }

    const existing = (existingCandidates.data || []).find((event) => {
      const raw =
        event.raw && typeof event.raw === "object"
          ? (event.raw as Record<string, unknown>)
          : {};
      const sameRawIdentity =
        normalizeCourt(safeText(raw.court)) === normalizeCourt(court) &&
        normalizeCaseNumber(safeText(raw.caseNumber)) === fileNo &&
        safeText(raw.hearingTime) === time;

      return (
        event.source_mail_id === sourceKey ||
        (event.case_id === legalCase.id && sameRawIdentity) ||
        sameRawIdentity
      );
    });

    if (existing) {
      let calendarEvent = existing as DatabaseRow;
      if (!calendarEvent.case_id) {
        const linked = await supabase
          .from("calendar_events")
          .update({ case_id: legalCase.id })
          .eq("id", calendarEvent.id)
          .eq("user_id", appUser.id)
          .select("*")
          .single();
        if (linked.error) throw new Error(linked.error.message);
        calendarEvent = linked.data as DatabaseRow;
      }

      return NextResponse.json({
        ok: true,
        duplicate: true,
        caseCreated,
        case: legalCase,
        calendarEvent,
        message: `${date} ${time} duruşması bu davanın takviminde zaten var.`,
      });
    }

    const created = await supabase
      .from("calendar_events")
      .insert({
        user_id: appUser.id,
        case_id: legalCase.id,
        title: `Duruşma — ${court} — ${fileNo}`,
        description: `${court} ${fileNo} dosyası duruşması: ${date} ${time}.`,
        event_type: "hearing",
        start_date: date,
        end_date: date,
        due_date: date,
        status: "active",
        priority: "important",
        source: "celse_bridge",
        source_mail_id: sourceKey,
        raw: {
          court,
          caseNumber: fileNo,
          hearingDate: date,
          hearingTime: time,
          evidence,
          source: "UYAP Avukat Portal",
          importedBy: "mether_celse_bridge",
        },
      })
      .select("*")
      .single();

    if (created.error || !created.data) {
      throw new Error(created.error?.message || "Takvim kaydı oluşturulamadı.");
    }

    return NextResponse.json({
      ok: true,
      duplicate: false,
      caseCreated,
      case: legalCase,
      calendarEvent: created.data,
      calendarWrite: { type: "hearing", date, time, court, fileNo },
      message: `${date} ${time} duruşması davaya bağlanarak takvime eklendi.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "UYAP duruşması kaydedilemedi.",
      },
      { status: 500 }
    );
  }
}
