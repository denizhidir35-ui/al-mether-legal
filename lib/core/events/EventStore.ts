import { supabase } from "@/lib/supabase";
import type { CoreEvent, CoreEventResult } from "./types";

export class EventStore {
  static async save(event: CoreEvent): Promise<CoreEventResult> {
    try {
      const { error } = await supabase.from("core_events").insert({
        id: event.id,
        type: event.type,
        source: event.source,
        payload: event.payload,
        product: event.product || null,
        user_id: event.userId || null,
        correlation_id: event.correlationId || null,
        created_at: event.createdAt,
      });

      if (error) {
        return {
          ok: false,
          event,
          error: error.message,
        };
      }

      return {
        ok: true,
        event,
      };
    } catch (error: any) {
      return {
        ok: false,
        event,
        error: error?.message || "EventStore kayıt hatası.",
      };
    }
  }
}
