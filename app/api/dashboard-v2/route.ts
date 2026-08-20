import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/alUser";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isTestOrDevRecord } from "@/lib/testRecordVisibility";

type DashboardEvent = {
  id: string;
  case_id: string | null;
  title: string;
  description: string | null;
  start_date: string;
  due_date: string | null;
  priority: string | null;
  event_type: string | null;
  status: string | null;
  source: string | null;
  raw: unknown;
  created_at: string;
};

const DEADLINE_TYPES = new Set([
  "legal_deadline",
  "manual_deadline",
  "payment_deadline",
]);

function dateOnly(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function eventTime(event: DashboardEvent) {
  const raw = record(event.raw);
  const candidates = [
    raw.hearingTime,
    raw.notificationTime,
    raw.startTime,
    raw.time,
  ];

  for (const candidate of candidates) {
    const value = text(candidate);
    const match = value.match(/(?:^|\s)([01]\d|2[0-3]):[0-5]\d(?:\s|$)/);
    if (match) return match[1];
  }

  const match = `${event.title} ${event.description || ""}`.match(
    /(?:^|\s)([01]\d|2[0-3]):[0-5]\d(?:\s|$)/
  );

  return match?.[1] || "";
}

function eventCategory(event: DashboardEvent) {
  const type = (event.event_type || "").toLocaleLowerCase("tr-TR");
  const label = `${event.title} ${event.description || ""}`.toLocaleLowerCase(
    "tr-TR"
  );

  if (type === "hearing" || label.includes("duruşma")) return "hearing";
  if (label.includes("bilirkişi")) return "expert";
  if (label.includes("dilekçe")) return "petition";
  if (type === "deemed_service" || type === "mail_received") return "notice";
  if (DEADLINE_TYPES.has(type) || label.includes("son gün")) return "deadline";
  return "task";
}

function serializeEvent(event: DashboardEvent, readAtBySourceId: Map<string, string>) {
  return {
    id: event.id,
    caseId: event.case_id || "",
    title: event.title,
    description: event.description || "",
    date: event.due_date || event.start_date,
    time: eventTime(event),
    priority: event.priority || "normal",
    eventType: event.event_type || "",
    category: eventCategory(event),
    source: event.source || "",
    readAt: readAtBySourceId.get(event.id) || "",
  };
}

function notificationReadReceiptId(userId: string, notificationId: string) {
  const hash = createHash("sha256")
    .update(`legal:notification-read:${userId}:${notificationId}`)
    .digest("hex");
  const variant = ((Number.parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);

  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function GET() {
  try {
    const { appUser, error: authError } = await getOrCreateAppUser();

    if (authError || !appUser) {
      return NextResponse.json(
        { ok: false, error: authError || "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();
    const now = new Date();
    const today = dateOnly(now);
    const weekEndDate = new Date(now);
    weekEndDate.setDate(weekEndDate.getDate() + 7);
    const weekEnd = dateOnly(weekEndDate);

    const [cases, criticalCases, events, incoming, documents, notificationReads] =
      await Promise.all([
        supabase
          .from("legal_cases")
          .select("id", { count: "exact", head: true })
          .eq("user_id", appUser.id)
          .eq("status", "active"),
        supabase
          .from("legal_cases")
          .select("id", { count: "exact", head: true })
          .eq("user_id", appUser.id)
          .in("risk_level", ["critical", "high"]),
        supabase
          .from("calendar_events")
          .select(
            "id,case_id,title,description,start_date,due_date,priority,event_type,status,source,raw,created_at"
          )
          .eq("user_id", appUser.id)
          .eq("status", "active")
          .gte("due_date", today)
          .lte("due_date", weekEnd)
          .order("due_date", { ascending: true })
          .limit(60),
        supabase
          .from("calendar_events")
          .select(
            "id,case_id,title,description,start_date,due_date,priority,event_type,status,source,raw,created_at"
          )
          .eq("user_id", appUser.id)
          .in("event_type", [
            "deemed_service",
            "mail_received",
            "notification_review",
          ])
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("case_document_records")
          .select("id,case_id,file_name,document_type,created_at")
          .eq("user_id", appUser.id)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("core_notifications")
          .select("source_id,status,metadata,created_at")
          .eq("user_id", appUser.id)
          .eq("status", "read")
          .not("source_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

    const firstError =
      cases.error ||
      criticalCases.error ||
      events.error ||
      incoming.error ||
      notificationReads.error;

    if (firstError) {
      return NextResponse.json(
        { ok: false, error: firstError.message },
        { status: 500 }
      );
    }

    const visibleEvents = ((events.data || []) as DashboardEvent[]).filter(
      (event) =>
        !isTestOrDevRecord({
          source: event.source,
          title: event.title,
          raw: event.raw,
        })
    );
    const visibleIncoming = ((incoming.data || []) as DashboardEvent[]).filter(
      (event) =>
        !isTestOrDevRecord({
          source: event.source,
          title: event.title,
          raw: event.raw,
        })
    );
    const readAtBySourceId = new Map<string, string>();

    for (const notification of notificationReads.data || []) {
      const sourceId = text(notification.source_id);
      const metadata = record(notification.metadata);
      const readAt = text(metadata.readAt) || text(notification.created_at);

      if (sourceId && !readAtBySourceId.has(sourceId)) {
        readAtBySourceId.set(sourceId, readAt);
      }
    }
    const todayEvents = visibleEvents
      .filter((event) => (event.due_date || event.start_date) === today)
      .sort((left, right) =>
        `${eventTime(left) || "99:99"}-${left.title}`.localeCompare(
          `${eventTime(right) || "99:99"}-${right.title}`,
          "tr"
        )
      );

    const todayDeadlines = todayEvents.filter((event) =>
      DEADLINE_TYPES.has(event.event_type || "")
    ).length;
    const todayHearings = todayEvents.filter(
      (event) => eventCategory(event) === "hearing"
    ).length;
    const upcomingDeadlines = visibleEvents.filter((event) =>
      DEADLINE_TYPES.has(event.event_type || "")
    ).length;
    const criticalToday = todayEvents.filter((event) =>
      ["critical", "high", "important"].includes(event.priority || "")
    ).length;

    return NextResponse.json({
      ok: true,
      stats: {
        activeCases: cases.count || 0,
        criticalCases: criticalCases.count || 0,
        criticalToday,
        todayDeadlines,
        todayHearings,
        upcomingDeadlines,
        newNotices: visibleIncoming.length,
      },
      dailyPlan: todayEvents.map((event) => serializeEvent(event, readAtBySourceId)),
      timeline: visibleEvents
        .slice(0, 8)
        .map((event) => serializeEvent(event, readAtBySourceId)),
      incoming: visibleIncoming
        .slice(0, 5)
        .map((event) => serializeEvent(event, readAtBySourceId)),
      documents: documents.error
        ? []
        : (documents.data || []).map((document) => ({
            id: document.id,
            caseId: document.case_id,
            fileName: document.file_name,
            documentType: document.document_type || "Belge",
            createdAt: document.created_at,
          })),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Dashboard verileri okunamadı.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { appUser, error: authError } = await getOrCreateAppUser();

    if (authError || !appUser) {
      return NextResponse.json(
        { ok: false, error: authError || "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    const payload = (await request.json().catch(() => null)) as
      | { notificationId?: unknown }
      | null;
    const notificationId = text(payload?.notificationId);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(notificationId)) {
      return NextResponse.json(
        { ok: false, error: "Geçerli bildirim kimliği gerekiyor." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const event = await supabase
      .from("calendar_events")
      .select("id,title,description")
      .eq("id", notificationId)
      .eq("user_id", appUser.id)
      .maybeSingle();

    if (event.error) {
      return NextResponse.json(
        { ok: false, error: event.error.message },
        { status: 500 }
      );
    }

    if (!event.data) {
      return NextResponse.json(
        { ok: false, error: "Bildirim bulunamadı." },
        { status: 404 }
      );
    }

    const readAt = new Date().toISOString();
    const existingNotifications = await supabase
      .from("core_notifications")
      .select("id")
      .eq("user_id", appUser.id)
      .eq("source_id", notificationId);

    if (existingNotifications.error) {
      return NextResponse.json(
        { ok: false, error: existingNotifications.error.message },
        { status: 500 }
      );
    }

    const existingIds = (existingNotifications.data || []).map((item) => item.id);
    const persisted = existingIds.length > 0
      ? await supabase
          .from("core_notifications")
          .update({ status: "read" })
          .eq("user_id", appUser.id)
          .in("id", existingIds)
          .select("id")
      : await supabase
          .from("core_notifications")
          .upsert(
            {
              id: notificationReadReceiptId(appUser.id, notificationId),
              title: event.data.title,
              message: event.data.description || event.data.title,
              channel: "in-app",
              status: "read",
              product: "legal",
              user_id: appUser.id,
              source: "calendar-event",
              source_id: notificationId,
              metadata: {
                readAt,
                target: `/calendar?event=${notificationId}`,
              },
            },
            { onConflict: "id" }
          )
          .select("id");

    if (persisted.error || !persisted.data?.length) {
      return NextResponse.json(
        { ok: false, error: persisted.error?.message || "Bildirim güncellenemedi." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: notificationId, readAt });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Bildirim güncellenemedi.",
      },
      { status: 500 }
    );
  }
}
