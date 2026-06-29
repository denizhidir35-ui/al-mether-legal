import { LegalEvent } from "./legal-event";

export class CalendarEngine {

  createEvent(event: LegalEvent) {

    return {

      ...event,

      createdAt: new Date(),

      updatedAt: new Date(),

    };

  }

  updateEvent(
    event: LegalEvent
  ) {

    return {

      ...event,

      updatedAt: new Date(),

    };

  }

  deleteEvent(
    id: string
  ) {

    return {

      success: true,

      id,

    };

  }

  completeEvent(
    event: LegalEvent
  ) {

    return {

      ...event,

      status: "completed",

      updatedAt: new Date(),

    };

  }

  getToday(
    events: LegalEvent[]
  ) {

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    return events.filter(
      (event) => {

        const date =
          new Date(
            event.startDate
          );

        date.setHours(
          0,
          0,
          0,
          0
        );

        return (
          date.getTime() ===
          today.getTime()
        );

      }
    );

  }

  getUpcoming(
    events: LegalEvent[]
  ) {

    const now =
      new Date();

    return events.filter(
      (event) =>
        event.startDate >=
        now
    );

  }

  getCritical(
    events: LegalEvent[]
  ) {

    return events.filter(
      (event) =>
        event.priority ===
        "critical"
    );

  }

}

export const
calendarEngine =
new CalendarEngine();

/*
----------------------------------------
GERİYE DÖNÜK UYUMLULUK
----------------------------------------
*/

export function createCalendarEvent(
  title: string,
  days: number
) {

  const now =
    new Date();

  const deadline =
    new Date();

  deadline.setDate(
    now.getDate() +
      days
  );

  return {

    title,

    deadline,

  };

}
