import { LegalEvent } from "./legal-event";

export interface Reminder {

  id: string;

  eventId: string;

  title: string;

  notifyAt: Date;

  offsetMinutes: number;

  sent: boolean;

}

export class ReminderEngine {

  generate(
    event: LegalEvent
  ): Reminder[] {

    if (
      !event.reminderPlan.enabled
    ) {

      return [];

    }

    return event.reminderPlan.offsets.map(
      (offset) => {

        const notifyAt =
          new Date(
            event.startDate
          );

        notifyAt.setMinutes(
          notifyAt.getMinutes() -
            offset
        );

        return {

          id: crypto.randomUUID(),

          eventId:
            event.id,

          title:
            event.title,

          notifyAt,

          offsetMinutes:
            offset,

          sent: false,

        };

      }
    );

  }

  pending(
    reminders: Reminder[]
  ) {

    const now =
      new Date();

    return reminders.filter(
      (r) =>
        !r.sent &&
        r.notifyAt <= now
    );

  }

  markAsSent(
    reminder: Reminder
  ) {

    return {

      ...reminder,

      sent: true,

    };

  }

}

export const reminderEngine =
  new ReminderEngine();
