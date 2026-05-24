// services/legalDeadlines.ts

export const legalDurations: any =
  {
    tahliye: 14,

    işe_iade: 14,

    icra_itiraz: 7,

    tüketici: 14,

    kira: 14,

    ceza_itiraz: 7,

    istinaf: 14,

    temyiz: 15,
  };

// RESMİ TATİLLER

const holidays = [
  "2026-01-01",

  "2026-04-23",

  "2026-05-01",

  "2026-05-19",

  "2026-07-15",

  "2026-08-30",

  "2026-10-29",
];

// WEEKEND

function isWeekend(
  date: Date
) {
  const day =
    date.getDay();

  return (
    day === 0 || day === 6
  );
}

// HOLIDAY

function isHoliday(
  date: Date
) {
  const formatted =
    date
      .toISOString()
      .split("T")[0];

  return holidays.includes(
    formatted
  );
}

// NEXT WORK DAY

export function moveToWorkDay(
  date: Date
) {
  const newDate =
    new Date(date);

  while (
    isWeekend(
      newDate
    ) ||
    isHoliday(newDate)
  ) {
    newDate.setDate(
      newDate.getDate() +
        1
    );
  }

  return newDate;
}

// MAIN ENGINE

export function calculateDeadline(
  caseType: string,
  createdAt?: string
) {
  const duration =
    legalDurations[
      caseType
        ?.toLowerCase()
        ?.replaceAll(" ", "_")
    ] || 14;

  const start =
    createdAt
      ? new Date(createdAt)
      : new Date();

  const deadline =
    new Date(start);

  deadline.setDate(
    deadline.getDate() +
      duration
  );

  const finalDate =
    moveToWorkDay(
      deadline
    );

  const diff =
    Math.ceil(
      (finalDate.getTime() -
        Date.now()) /
        (1000 *
          60 *
          60 *
          24)
    );

  return {
    duration,

    deadline:
      finalDate,

    daysLeft: diff,

    isCritical:
      diff <= 3,

    isWarning:
      diff <= 7,
  };
}