export type CoreCalendarRisk = "low" | "medium" | "high" | "critical" | string;

export type CoreCalendarSource =
  | "legal"
  | "workforce"
  | "field"
  | "cfo"
  | "gmail"
  | "manual"
  | "system"
  | string;

export type CoreCalendarEvent = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  source: CoreCalendarSource;
  sourceId?: string;
  risk?: CoreCalendarRisk;
  product?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type CoreCalendarReminder = {
  id: string;
  eventId: string;
  remindAt: string;
  type: "system" | "email" | "push" | "popup";
  message: string;
  status: "pending" | "sent" | "cancelled";
};

export type CoreCalendarResult<T> = {
  ok: boolean;
  data: T;
  error?: string;
};
