export type CoreEventSource =
  | "legal"
  | "workforce"
  | "field"
  | "cfo"
  | "system"
  | "gmail"
  | "calendar"
  | "reminder"
  | string;

export type CoreEventType =
  | "legal.ai.analysis.completed"
  | "legal.deadline.created"
  | "calendar.event.created"
  | "reminder.created"
  | "notification.created"
  | "system.error"
  | string;

export type CoreEventPayload = Record<string, unknown>;

export type CoreEvent = {
  id: string;
  type: CoreEventType;
  source: CoreEventSource;
  payload: CoreEventPayload;
  createdAt: string;
  correlationId?: string;
  userId?: string;
  product?: string;
};

export type CoreEventHandler = (event: CoreEvent) => Promise<void> | void;

export type CoreEventResult = {
  ok: boolean;
  event?: CoreEvent;
  error?: string;
};
