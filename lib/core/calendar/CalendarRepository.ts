import { supabase } from "@/lib/supabase";
import type { CoreCalendarEvent, CoreCalendarResult } from "./types";
import { normalizeCalendarError } from "./errors";

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
  raw: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function mapRowToCoreEvent(row: CalendarEventRow): CoreCalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    startDate: row.start_date,
    endDate: row.end_date,
    allDay: row.all_day,
    source: row.source,
    sourceId: row.source_id || "",
    risk: row.risk || "",
    product: "legal",
    metadata: row.raw || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CalendarRepository {
  static async listEvents(): Promise<CoreCalendarResult<CoreCalendarEvent[]>> {
    try {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .order("start_date", { ascending: true });

      if (error) {
        return {
          ok: false,
          data: [],
          error: error.message,
        };
      }

      return {
        ok: true,
        data: ((data || []) as CalendarEventRow[]).map(mapRowToCoreEvent),
      };
    } catch (error) {
      return {
        ok: false,
        data: [],
        error: normalizeCalendarError(error),
      };
    }
  }
}
