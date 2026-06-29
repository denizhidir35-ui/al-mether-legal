import { supabase } from "@/lib/supabase";
import type {
  CoreNotification,
  CreateNotificationInput,
  NotificationResult,
} from "./types";
import { CoreEvents } from "@/lib/core/events";

function createNotification(input: CreateNotificationInput): CoreNotification {
  return {
    id: crypto.randomUUID(),
    title: input.title,
    message: input.message,
    channel: input.channel || "in-app",
    status: "pending",
    product: input.product,
    userId: input.userId,
    source: input.source,
    sourceId: input.sourceId,
    metadata: input.metadata || {},
    createdAt: new Date().toISOString(),
    scheduledAt: input.scheduledAt,
  };
}

export class NotificationEngine {
  static async create(
    input: CreateNotificationInput
  ): Promise<NotificationResult<CoreNotification | null>> {
    try {
      const notification = createNotification(input);

      const { error } = await supabase.from("core_notifications").insert({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        channel: notification.channel,
        status: notification.status,
        product: notification.product || null,
        user_id: notification.userId || null,
        source: notification.source || null,
        source_id: notification.sourceId || null,
        metadata: notification.metadata || {},
        created_at: notification.createdAt,
        scheduled_at: notification.scheduledAt || null,
        sent_at: notification.sentAt || null,
      });

      if (error) {
        return {
          ok: false,
          data: notification,
          error: error.message,
        };
      }

      await CoreEvents.publish({
        type: "notification.created",
        source: "notification",
        product: notification.product || "core",
        payload: {
          notification,
        },
      });

      return {
        ok: true,
        data: notification,
      };
    } catch (error: any) {
      return {
        ok: false,
        data: null,
        error: error?.message || "NotificationEngine hata verdi.",
      };
    }
  }
}
