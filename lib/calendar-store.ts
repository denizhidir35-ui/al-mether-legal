import { supabase } from "./supabase";
import { LegalEvent } from "./legal-event";
import { calendarMapper } from "./calendar-mapper";

const TABLE = "calendar_events";

export class CalendarStore {

  async create(
    event: LegalEvent
  ) {

    const payload =
      calendarMapper.toDatabase(
        event
      );

    const { data, error } =
      await supabase
        .from(TABLE)
        .insert(payload)
        .select()
        .single();

    if (error)
      throw error;

    return calendarMapper.fromDatabase(
      data
    );

  }

  async update(
    event: LegalEvent
  ) {

    const payload =
      calendarMapper.toDatabase(
        event
      );

    const { data, error } =
      await supabase
        .from(TABLE)
        .update(payload)
        .eq("id", event.id)
        .select()
        .single();

    if (error)
      throw error;

    return calendarMapper.fromDatabase(
      data
    );

  }

  async delete(
    id: string
  ) {

    const { error } =
      await supabase
        .from(TABLE)
        .delete()
        .eq("id", id);

    if (error)
      throw error;

    return true;

  }

  async get(
    id: string
  ) {

    const { data, error } =
      await supabase
        .from(TABLE)
        .select("*")
        .eq("id", id)
        .single();

    if (error)
      throw error;

    return calendarMapper.fromDatabase(
      data
    );

  }

  async getAll() {

    const { data, error } =
      await supabase
        .from(TABLE)
        .select("*")
        .order(
          "start_date",
          {
            ascending: true,
          }
        );

    if (error)
      throw error;

    return (data ?? []).map(
      calendarMapper.fromDatabase
    );

  }

}

export const calendarStore =
  new CalendarStore();
