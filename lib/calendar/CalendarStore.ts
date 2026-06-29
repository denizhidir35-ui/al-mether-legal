import { supabase } from "@/lib/supabase";
import type { CalendarEvent } from "./LegalEvent";

export class CalendarStore {
  static async save(calendarEvent: CalendarEvent) {
    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        id: calendarEvent.id,
        legal_event_id: calendarEvent.legalEventId,
        title: calendarEvent.title,
        description: calendarEvent.description,
        start_date: calendarEvent.startDate,
        end_date: calendarEvent.endDate,
        all_day: calendarEvent.allDay,
        risk: calendarEvent.risk || null,
        source: calendarEvent.source,
        source_id: calendarEvent.sourceId || null,
        raw: calendarEvent.raw || null,
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
      data,
      calendarEvent,
    };
  }
}
