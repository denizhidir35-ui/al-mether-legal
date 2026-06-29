import { LegalEvent } from "./legal-event";

export type DeadlineLevel =
  | "normal"
  | "warning"
  | "critical"
  | "expired";

export interface DeadlineResult {

  remainingDays: number;

  level: DeadlineLevel;

  expired: boolean;

}

export class DeadlineEngine {

  calculate(
    event: LegalEvent
  ): DeadlineResult {

    const now = new Date();

    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const target = new Date(
      event.startDate.getFullYear(),
      event.startDate.getMonth(),
      event.startDate.getDate()
    );

    const diff =
      target.getTime() -
      today.getTime();

    const remainingDays =
      Math.ceil(
        diff /
        (1000 * 60 * 60 * 24)
      );

    let level: DeadlineLevel =
      "normal";

    if (remainingDays <= 7)
      level = "warning";

    if (remainingDays <= 3)
      level = "critical";

    if (remainingDays < 0)
      level = "expired";

    return {

      remainingDays,

      level,

      expired:
        remainingDays < 0,

    };

  }

  isWeekend(
    date: Date
  ) {

    const day =
      date.getDay();

    return (
      day === 0 ||
      day === 6
    );

  }

  // Sprint 7
  isOfficialHoliday(
    date: Date
  ) {

    return false;

  }

  // Sprint 7
  moveToBusinessDay(
    date: Date
  ) {

    const result =
      new Date(date);

    while (
      this.isWeekend(
        result
      )
    ) {

      result.setDate(
        result.getDate() +
          1
      );

    }

    return result;

  }

}

export const deadlineEngine =
  new DeadlineEngine();
