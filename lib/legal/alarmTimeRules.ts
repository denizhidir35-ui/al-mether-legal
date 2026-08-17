export const DEFAULT_MANUAL_REMINDER_TIME =
  "09:00";

export const DATE_ONLY_LEGAL_ALARM_HOUR =
  12;

function isValidDate(
  value: string
) {
  const match =
    value.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12
    )
  );

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

export function isValidClockTime(
  value: string
) {
  const match =
    value.match(
      /^(\d{2}):(\d{2})$/
    );

  if (!match) {
    return false;
  }

  return (
    Number(match[1]) <= 23 &&
    Number(match[2]) <= 59
  );
}

export function resolveDocumentHearingAt(
  date: string,
  time: string
) {
  if (
    !isValidDate(date) ||
    !isValidClockTime(time)
  ) {
    return "";
  }

  return `${date}T${time}`;
}

export function toIstanbulReminderTime(
  date: string,
  time: string
) {
  if (
    !isValidDate(date) ||
    !isValidClockTime(time)
  ) {
    throw new Error(
      "Hatırlatma tarihi veya saati geçersiz."
    );
  }

  return `${date}T${time}:00+03:00`;
}

export function dateOnlyLegalAlarmTime(
  date: string
) {
  if (!isValidDate(date)) {
    throw new Error(
      "Hukuki alarm tarihi geçersiz."
    );
  }

  return `${date}T${String(
    DATE_ONLY_LEGAL_ALARM_HOUR
  ).padStart(2, "0")}:00:00`;
}
