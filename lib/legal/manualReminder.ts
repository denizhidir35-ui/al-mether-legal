export const MANUAL_REMINDER_EVENT_TYPE =
  "manual_reminder";

export const MANUAL_REMINDER_SOURCE =
  "user_entered";

export type ManualReminderRecord = {
  id: string;
  case_id: string;
  calendar_event_id: string;
  alarm_time: string;
  alarm_type: "manual_reminder";
  message: string;
  status: string;
};

export type ManualReminderPlan = {
  caseId: string;
  date: string;
  time: string;
  note: string;
  alarmAt: string;
  dedupeKey: string;
  eventType: "manual_reminder";
  source: "user_entered";
};

export type ManualReminderStore = {
  findOwnedCase(
    userId: string,
    caseId: string
  ): Promise<{
    id: string;
    case_title?: string | null;
  } | null>;
  findExisting(
    userId: string,
    plan: ManualReminderPlan
  ): Promise<ManualReminderRecord | null>;
  create(
    userId: string,
    caseTitle: string,
    plan: ManualReminderPlan
  ): Promise<ManualReminderRecord>;
  list(
    userId: string,
    caseId: string
  ): Promise<ManualReminderRecord[]>;
};

export type CreateManualReminderResult =
  | {
      ok: false;
      reason: "not_found";
    }
  | {
      ok: true;
      duplicate: boolean;
      reminder: ManualReminderRecord;
    };

export class ManualReminderValidationError
  extends Error {}

function normalizedNote(
  value: unknown
) {
  return typeof value === "string"
    ? value
        .normalize("NFKC")
        .trim()
        .replace(/\s+/g, " ")
    : "";
}

function toIstanbulReminderTime(
  date: string,
  time: string
) {
  const dateMatch =
    date.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );
  const timeMatch =
    time.match(
      /^(\d{2}):(\d{2})$/
    );

  if (!dateMatch || !timeMatch) {
    throw new Error(
      "Hatırlatma tarihi veya saati geçersiz."
    );
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const parsed = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12
    )
  );
  const validDate =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day;
  const validTime =
    Number(timeMatch[1]) <= 23 &&
    Number(timeMatch[2]) <= 59;

  if (!validDate || !validTime) {
    throw new Error(
      "Hatırlatma tarihi veya saati geçersiz."
    );
  }

  return `${date}T${time}:00+03:00`;
}

function stableTextHash(
  value: string
) {
  let first = 2166136261;
  let second = 2246822519;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    const code =
      value.charCodeAt(index);

    first = Math.imul(
      first ^ code,
      16777619
    );
    second = Math.imul(
      second ^ code,
      3266489917
    );
  }

  return [
    first >>> 0,
    second >>> 0,
  ]
    .map((part) =>
      part.toString(16)
        .padStart(8, "0")
    )
    .join("");
}

export function createManualReminderPlan(
  input: {
    caseId: unknown;
    date: unknown;
    time: unknown;
    note?: unknown;
  }
): ManualReminderPlan {
  const caseId =
    typeof input.caseId === "string"
      ? input.caseId.trim()
      : "";
  const date =
    typeof input.date === "string"
      ? input.date.trim()
      : "";
  const time =
    typeof input.time === "string"
      ? input.time.trim()
      : "";
  const note =
    normalizedNote(input.note);

  if (!caseId) {
    throw new ManualReminderValidationError(
      "Dava bilgisi zorunludur."
    );
  }

  if (note.length > 500) {
    throw new ManualReminderValidationError(
      "Hatırlatma notu en fazla 500 karakter olabilir."
    );
  }

  let alarmAt = "";

  try {
    alarmAt =
      toIstanbulReminderTime(
        date,
        time
      );
  } catch {
    throw new ManualReminderValidationError(
      "Hatırlatma tarihi veya saati geçersiz."
    );
  }
  const dedupeText = [
    caseId,
    date,
    time,
    note.toLocaleLowerCase("tr-TR"),
  ].join("\u0000");

  return {
    caseId,
    date,
    time,
    note,
    alarmAt,
    dedupeKey:
      `manual-reminder:${stableTextHash(
        dedupeText
      )}`,
    eventType:
      MANUAL_REMINDER_EVENT_TYPE,
    source:
      MANUAL_REMINDER_SOURCE,
  };
}

export async function createOwnedManualReminder(
  store: ManualReminderStore,
  userId: string,
  input: Parameters<
    typeof createManualReminderPlan
  >[0]
): Promise<CreateManualReminderResult> {
  const plan =
    createManualReminderPlan(input);
  const ownedCase =
    await store.findOwnedCase(
      userId,
      plan.caseId
    );

  if (!ownedCase) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  const existing =
    await store.findExisting(
      userId,
      plan
    );

  if (existing) {
    return {
      ok: true,
      duplicate: true,
      reminder: existing,
    };
  }

  const reminder =
    await store.create(
      userId,
      ownedCase.case_title ||
        "Dava",
      plan
    );

  return {
    ok: true,
    duplicate: false,
    reminder,
  };
}

export async function listOwnedManualReminders(
  store: ManualReminderStore,
  userId: string,
  caseId: string
) {
  const ownedCase =
    await store.findOwnedCase(
      userId,
      caseId
    );

  if (!ownedCase) {
    return null;
  }

  return store.list(
    userId,
    caseId
  );
}
