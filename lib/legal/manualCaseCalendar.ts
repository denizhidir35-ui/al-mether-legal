export type ManualCaseCalendarInput = {
  caseId: string;
  title: string;
  court?: string;
  caseNumber?: string;
  hearingAt?: string;
  manualDeadline?: string;
  note?: string;
};

export type ManualCalendarPlan = {
  kind:
    | "hearing"
    | "manual_deadline";
  eventType: string;
  title: string;
  date: string;
  hearingAt: string;
  dedupeKey: string;
  description: string;
  userVerified: true;
};

function cleanText(
  value: unknown
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export function isValidManualDate(
  value: string
) {
  const match =
    value.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!match) {
    return false;
  }

  const year =
    Number(match[1]);
  const month =
    Number(match[2]);
  const day =
    Number(match[3]);

  const parsed =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        12
      )
    );

  return (
    parsed.getUTCFullYear() ===
      year &&
    parsed.getUTCMonth() + 1 ===
      month &&
    parsed.getUTCDate() === day
  );
}

export function normalizeHearingAt(
  value: unknown
) {
  const clean =
    cleanText(value);

  const match =
    clean.match(
      /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/
    );

  if (
    !match ||
    !isValidManualDate(
      match[1]
    )
  ) {
    return "";
  }

  const hour =
    Number(match[2]);
  const minute =
    Number(match[3]);

  if (
    hour > 23 ||
    minute > 59
  ) {
    return "";
  }

  return `${match[1]}T${match[2]}:${match[3]}`;
}

export function createManualCaseCalendarPlans(
  input: ManualCaseCalendarInput
) {
  const caseId =
    cleanText(input.caseId);
  const caseTitle =
    cleanText(input.title) ||
    cleanText(
      input.caseNumber
    ) ||
    "Dava";
  const hearingAt =
    normalizeHearingAt(
      input.hearingAt
    );
  const manualDeadline =
    cleanText(
      input.manualDeadline
    );

  if (!caseId) {
    throw new Error(
      "caseId zorunludur."
    );
  }

  if (
    input.hearingAt &&
    !hearingAt
  ) {
    throw new Error(
      "Duruşma tarihi ve saati geçersiz."
    );
  }

  if (
    manualDeadline &&
    !isValidManualDate(
      manualDeadline
    )
  ) {
    throw new Error(
      "Manuel son tarih geçersiz."
    );
  }

  const details = [
    cleanText(input.court)
      ? `Mahkeme: ${cleanText(
          input.court
        )}`
      : "",
    cleanText(
      input.caseNumber
    )
      ? `Dosya No: ${cleanText(
          input.caseNumber
        )}`
      : "",
    cleanText(input.note),
  ]
    .filter(Boolean)
    .join("\n");

  const plans:
    ManualCalendarPlan[] = [];

  if (hearingAt) {
    plans.push({
      kind: "hearing",
      eventType: "hearing",
      title:
        `${caseTitle} — Duruşma`,
      date:
        hearingAt.slice(0, 10),
      hearingAt,
      dedupeKey:
        `manual-case:${caseId}:hearing:${hearingAt}`,
      description: details,
      userVerified: true,
    });
  }

  if (manualDeadline) {
    plans.push({
      kind:
        "manual_deadline",
      eventType:
        "manual_deadline",
      title:
        `${caseTitle} — Manuel son tarih`,
      date: manualDeadline,
      hearingAt: "",
      dedupeKey:
        `manual-case:${caseId}:deadline:${manualDeadline}`,
      description: details,
      userVerified: true,
    });
  }

  return plans;
}

export function canAddManualCaseToCalendar(
  hearingAt: string,
  manualDeadline: string
) {
  return Boolean(
    normalizeHearingAt(
      hearingAt
    ) ||
    isValidManualDate(
      manualDeadline
    )
  );
}
