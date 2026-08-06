import "server-only";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { CalendarEvent } from "./LegalEvent";

export type CalendarStoreSaveResult =
  | {
      ok: true;
      data: Record<string, unknown>;
      calendarEvent: CalendarEvent;
    }
  | {
      ok: false;
      error: string;
      calendarEvent: CalendarEvent;
    };

export class CalendarStore {
  static async save(
    calendarEvent: CalendarEvent
  ): Promise<CalendarStoreSaveResult> {
    try {
      const supabase =
        getSupabaseAdmin();

      const payload = {
        id: calendarEvent.id,
        legal_event_id:
          calendarEvent.legalEventId,
        title: calendarEvent.title,
        description:
          calendarEvent.description || null,
        start_date:
          calendarEvent.startDate,
        end_date:
          calendarEvent.endDate,
        all_day:
          calendarEvent.allDay,
        risk:
          calendarEvent.risk || null,
        source:
          calendarEvent.source,
        source_id:
          calendarEvent.sourceId || null,
        raw:
          calendarEvent.raw || null,
      };

      const { data, error } = await supabase
        .from("calendar_events")
        .upsert(payload, {
          onConflict: "id",
        })
        .select()
        .single();

      if (error) {
        return {
          ok: false,
          error: error.message,
          calendarEvent,
        };
      }

      return {
        ok: true,
        data:
          (data as Record<
            string,
            unknown
          >) || {},
        calendarEvent,
      };
    } catch (error: unknown) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "CalendarStore kaydı sırasında hata oluştu.",
        calendarEvent,
      };
    }
  }
}
