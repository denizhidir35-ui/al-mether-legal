import "server-only";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateAppUser } from "@/lib/alUser";
import { isTestOrDevRecord } from "@/lib/testRecordVisibility";

type CalendarEventRow = {
  id: string;
  legal_event_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  all_day: boolean;
  risk: string | null;
  source: string;
  source_id: string | null;
  raw: unknown;
  created_at: string;
  updated_at: string;
};

function cleanDate(
  value: string | null
): string {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      trimmed
    )
  ) {
    return "";
  }

  return trimmed;
}

export async function GET(
  req: NextRequest
) {
  try {
    const { appUser, error: authError } = await getOrCreateAppUser();

    if (authError || !appUser) {
      return NextResponse.json(
        {
          ok: false,
          error: authError || "Oturum bulunamadı.",
          events: [],
        },
        { status: 401 }
      );
    }

    const supabase =
      getSupabaseAdmin();

    const { searchParams } =
      new URL(req.url);

    const from = cleanDate(
      searchParams.get("from")
    );

    const to = cleanDate(
      searchParams.get("to")
    );

    const risk =
      searchParams
        .get("risk")
        ?.trim() || "";

    const source =
      searchParams
        .get("source")
        ?.trim() || "";

    let query = supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", appUser.id)
      .order("start_date", {
        ascending: true,
      });

    if (from) {
      query = query.gte(
        "start_date",
        from
      );
    }

    if (to) {
      query = query.lte(
        "start_date",
        to
      );
    }

    if (risk) {
      query = query.eq(
        "risk",
        risk
      );
    }

    if (source) {
      query = query.eq(
        "source",
        source
      );
    }

    const { data, error } =
      await query;

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          events: [],
        },
        { status: 500 }
      );
    }

    const events = (
      (data || []) as CalendarEventRow[]
    )
      .filter(
        (event) =>
          !isTestOrDevRecord({
            source: event.source,
            title: event.title,
            raw: event.raw,
          })
      )
      .map((event) => ({
        id: event.id,
        legalEventId:
          event.legal_event_id,
        title: event.title,
        description:
          event.description || "",
        startDate:
          event.start_date,
        endDate:
          event.end_date,
        allDay:
          event.all_day,
        risk:
          event.risk || "",
        source:
          event.source,
        sourceId:
          event.source_id || "",
        raw:
          event.raw,
        createdAt:
          event.created_at,
        updatedAt:
          event.updated_at,
      }));

    return NextResponse.json({
      ok: true,
      count: events.length,
      events,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Calendar events okunurken hata oluştu.",
        events: [],
      },
      { status: 500 }
    );
  }
}
