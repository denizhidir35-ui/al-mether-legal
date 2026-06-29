export type NotificationChannel = "in-app" | "email" | "push" | "sms" | string;

export type NotificationStatus = "pending" | "sent" | "failed" | "cancelled";

export type CoreNotification = {
  id: string;
  title: string;
  message: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  product?: string;
  userId?: string;
  source?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  scheduledAt?: string;
  sentAt?: string;
};

export type CreateNotificationInput = {
  title: string;
  message: string;
  channel?: NotificationChannel;
  product?: string;
  userId?: string;
  source?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  scheduledAt?: string;
};

export type NotificationResult<T> = {
  ok: boolean;
  data: T;
  error?: string;
};
