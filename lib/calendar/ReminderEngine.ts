import { supabase } from "@/lib/supabase";
import type { CalendarEvent } from "./LegalEvent";

export class ReminderEngine {
  static async createReminders(calendarEvent: CalendarEvent) {
    if (!calendarEvent.reminders.length) {
      return {
        ok: true,
        data: [],
      };
    }

    const rows = calendarEvent.reminders.map((reminder) => ({
      id: reminder.id,
      calendar_event_id: reminder.calendarEventId,
      remind_at: reminder.remindAt,
      type: reminder.type,
      message: reminder.message,
      status: reminder.status,
    }));

    const { data, error } = await supabase
      .from("calendar_reminders")
      .insert(rows)
      .select();

    if (error) {
      return {
        ok: false,
        error: error.message,
        reminders: calendarEvent.reminders,
      };
    }

    return {
      ok: true,
      data,
    };
  }
}
