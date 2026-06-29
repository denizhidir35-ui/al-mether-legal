// =======================================
// AL METHER LEGAL
// LEGAL EVENT CORE MODEL
// =======================================

export type LegalEventType =
  | "deadline"
  | "hearing"
  | "notification"
  | "appeal"
  | "objection"
  | "execution"
  | "meeting"
  | "task"
  | "custom";

export type EventPriority =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type EventStatus =
  | "pending"
  | "completed"
  | "cancelled"
  | "expired";

export type EventSource =
  | "gmail"
  | "manual"
  | "ai"
  | "calendar"
  | "system";

export interface ReminderPlan {

  enabled: boolean;

  offsets: number[];

}

export interface LegalEvent {

  id: string;

  title: string;

  description?: string;

  type: LegalEventType;

  priority: EventPriority;

  status: EventStatus;

  source: EventSource;

  sourceId?: string;

  caseId?: string;

  mailId?: string;

  court?: string;

  fileNumber?: string;

  client?: string;

  location?: string;

  startDate: Date;

  endDate?: Date;

  allDay: boolean;

  reminderPlan: ReminderPlan;

  metadata?: Record<string, unknown>;

  createdAt: Date;

  updatedAt: Date;

}
