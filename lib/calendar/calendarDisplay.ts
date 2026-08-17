type CalendarDisplayEvent = {
  startDate?: string;
  title?: string;
  description?: string;
  eventType?: string;
  source?: string;
  raw?: unknown;
};

export type ManualReminderPresentation = {
  caseTitle: string;
  date: string;
  time: string;
  note: string;
  typeLabel: "Manuel Hatırlatma";
  sourceLabel: "Kullanıcı hatırlatması";
};

function asRawRecord(
  value: unknown
): Record<string, unknown> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function rawText(
  raw: Record<string, unknown>,
  key: string
): string {
  return typeof raw[key] === "string"
    ? raw[key].trim()
    : "";
}

export function getManualReminderPresentation(
  event: CalendarDisplayEvent
): ManualReminderPresentation | null {
  const raw = asRawRecord(event.raw);
  const isManualReminder =
    event.eventType === "manual_reminder" ||
    event.source === "user_entered" ||
    raw.manualReminder === true;

  if (!isManualReminder) {
    return null;
  }

  const reminderAt = rawText(
    raw,
    "reminderAt"
  );
  const enteredTime = rawText(
    raw,
    "userEnteredTime"
  );
  const timeMatch =
    enteredTime.match(/^(\d{2}:\d{2})/) ||
    reminderAt.match(/T(\d{2}:\d{2})/);
  const title = event.title?.trim() || "Dava";

  return {
    caseTitle:
      title.replace(
        /\s+[—-]\s+Manuel hatırlatma$/iu,
        ""
      ) || "Dava",
    date:
      rawText(raw, "userEnteredDate") ||
      event.startDate ||
      "",
    time: timeMatch?.[1] || "",
    note:
      rawText(raw, "note") ||
      event.description?.trim() ||
      "Manuel hatırlatma",
    typeLabel: "Manuel Hatırlatma",
    sourceLabel: "Kullanıcı hatırlatması",
  };
}

function explicitEventTime(
  event: CalendarDisplayEvent
): number | null {
  const raw = asRawRecord(event.raw);

  const arrivalDate =
    typeof raw.arrivalDate === "string"
      ? raw.arrivalDate
      : "";
  const arrivalTime =
    typeof raw.arrivalTime === "string"
      ? raw.arrivalTime
      : "";

  const candidates = [
    typeof raw.reminderAt === "string"
      ? raw.reminderAt
      : "",
    typeof raw.receivedAt === "string"
      ? raw.receivedAt
      : "",
    arrivalDate && arrivalTime
      ? `${arrivalDate}T${arrivalTime}`
      : "",
    event.startDate?.match(
      /(?:T|\s)\d{2}:\d{2}/
    )
      ? event.startDate
      : "",
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    const timestamp =
      new Date(candidate).getTime();

    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  return null;
}

export function sortCalendarEventsForDisplay<
  T extends CalendarDisplayEvent,
>(events: T[]): T[] {
  return events
    .map((event, index) => ({
      event,
      index,
      timestamp:
        explicitEventTime(event),
    }))
    .sort((left, right) => {
      if (
        left.timestamp !== null &&
        right.timestamp !== null
      ) {
        return (
          left.timestamp -
            right.timestamp ||
          left.index - right.index
        );
      }

      if (left.timestamp !== null) return -1;
      if (right.timestamp !== null) return 1;

      return left.index - right.index;
    })
    .map(({ event }) => event);
}
