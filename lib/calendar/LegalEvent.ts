export type LegalRisk = "Düşük" | "Orta" | "Yüksek" | "Kritik" | string;

export type LegalEvent = {
  id: string;
  title: string;
  description: string;
  date: string;
  source: "gmail" | "manual" | "system" | string;
  sourceId?: string;
  risk?: LegalRisk;
  court?: string;
  fileNo?: string;
  institution?: string;
  actions?: string[];
  raw?: unknown;
};

export type CalendarReminder = {
  id: string;
  calendarEventId: string;
  remindAt: string;
  type: "popup" | "email" | "system";
  message: string;
  status: "pending" | "sent" | "cancelled";
};

export type CalendarEvent = {
  id: string;
  legalEventId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  risk?: LegalRisk;
  source: string;
  sourceId?: string;
  reminders: CalendarReminder[];
  raw?: unknown;
};
