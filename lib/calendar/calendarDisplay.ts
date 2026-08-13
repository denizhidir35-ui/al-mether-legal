type CalendarDisplayEvent = {
  startDate?: string;
  raw?: unknown;
};

function explicitEventTime(
  event: CalendarDisplayEvent
): number | null {
  const raw =
    event.raw &&
    typeof event.raw === "object" &&
    !Array.isArray(event.raw)
      ? (event.raw as Record<string, unknown>)
      : {};

  const arrivalDate =
    typeof raw.arrivalDate === "string"
      ? raw.arrivalDate
      : "";
  const arrivalTime =
    typeof raw.arrivalTime === "string"
      ? raw.arrivalTime
      : "";

  const candidates = [
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
