import type { CalendarEvent, CalendarReminder, LegalEvent } from "./LegalEvent";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function createReminder(
  calendarEventId: string,
  deadline: string,
  daysBefore: number,
  message: string
): CalendarReminder {
  const remindDate = addDays(new Date(`${deadline}T09:00:00`), -daysBefore);

  return {
    id: crypto.randomUUID(),
    calendarEventId,
    remindAt: remindDate.toISOString(),
    type: "system",
    message,
    status: "pending",
  };
}

export class CalendarEngine {
  static async createLegalEvent(legalEvent: LegalEvent): Promise<CalendarEvent> {
    const calendarEventId = crypto.randomUUID();

    const title = legalEvent.title || "Hukuki Süre";

    const description = [
      legalEvent.description,
      legalEvent.court ? `Mahkeme: ${legalEvent.court}` : "",
      legalEvent.institution ? `Kurum: ${legalEvent.institution}` : "",
      legalEvent.fileNo ? `Dosya No: ${legalEvent.fileNo}` : "",
      legalEvent.risk ? `Risk: ${legalEvent.risk}` : "",
      legalEvent.actions?.length
        ? `Yapılacaklar:\n${legalEvent.actions.map((x) => `- ${x}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      id: calendarEventId,
      legalEventId: legalEvent.id,
      title,
      description,
      startDate: legalEvent.date,
      endDate: legalEvent.date,
      allDay: true,
      risk: legalEvent.risk,
      source: legalEvent.source,
      sourceId: legalEvent.sourceId,
      raw: legalEvent.raw,
      reminders: [
        createReminder(calendarEventId, legalEvent.date, 7, `${title} için 7 gün kaldı.`),
        createReminder(calendarEventId, legalEvent.date, 3, `${title} için 3 gün kaldı.`),
        createReminder(calendarEventId, legalEvent.date, 1, `${title} için son 1 gün.`),
        createReminder(calendarEventId, legalEvent.date, 0, `${title} bugün son gün.`),
      ],
    };
  }
}
