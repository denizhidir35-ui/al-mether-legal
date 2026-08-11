import {
  BusinessCalendarEngine,
  createTurkishBusinessCalendar,
} from "./BusinessCalendarEngine";

export type LegalAlarmKind =
  | "advance"
  | "same_day"
  | "overdue";

export type LegalAlarmStatus =
  | "pending"
  | "sent"
  | "seen"
  | "dismissed"
  | "failed"
  | "cancelled";

export type LegalAlarmChannel =
  | "in_app"
  | "push"
  | "email";

export type LegalAlarmPriority =
  | "normal"
  | "important"
  | "critical";

export type LegalAlarmDefinition = {
  id: string;

  userId: string;
  deadlineId: string;
  calendarEventId: string;
  caseId: string;

  title: string;
  message: string;

  deadlineDate: string;
  triggerAt: string;

  kind: LegalAlarmKind;
  status: LegalAlarmStatus;
  priority: LegalAlarmPriority;

  daysBefore: number | null;
  channels: LegalAlarmChannel[];

  metadata: Record<string, unknown>;
};

export type LegalAlarmPlanInput = {
  userId: string;
  deadlineId: string;
  calendarEventId: string;
  caseId?: string;

  title: string;
  deadlineDate: string;

  court?: string;
  fileNo?: string;
  eventType?: string;

  timezone?: string;
  notificationHour?: number;
  notificationMinute?: number;

  reminderDays?: number[];

  channels?: LegalAlarmChannel[];

  includeSameDay?: boolean;
  includeOverdue?: boolean;

  skipPastAdvanceAlarms?: boolean;

  now?: string;
};

export type LegalAlarmPlanResult = {
  deadlineDate: string;
  generatedAt: string;

  alarms: LegalAlarmDefinition[];
  skipped: Array<{
    daysBefore: number;
    reason: string;
  }>;

  summary: {
    total: number;
    advance: number;
    sameDay: number;
    overdue: number;
  };
};

const DEFAULT_REMINDER_DAYS = [
  7,
  3,
  1,
];

const DEFAULT_CHANNELS: LegalAlarmChannel[] = [
  "in_app",
  "push",
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isValidIsoDate(
  value: string
): boolean {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12,
      0,
      0
    )
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function parseIsoDate(
  value: string
): Date {
  if (!isValidIsoDate(value)) {
    throw new Error(
      `Geçersiz tarih: ${value}. YYYY-MM-DD bekleniyor.`
    );
  }

  const [
    year,
    month,
    day,
  ] = value.split("-").map(Number);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      12,
      0,
      0
    )
  );
}

function toIsoDate(
  date: Date
): string {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join("-");
}

function addDays(
  value: string,
  amount: number
): string {
  const date = parseIsoDate(value);

  date.setUTCDate(
    date.getUTCDate() + amount
  );

  return toIsoDate(date);
}

function normalizeReminderDays(
  values: number[]
): number[] {
  return Array.from(
    new Set(
      values.filter(
        (value) =>
          Number.isInteger(value) &&
          value > 0 &&
          value <= 365
      )
    )
  ).sort(
    (left, right) =>
      right - left
  );
}

function normalizeHour(
  value: number | undefined
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 23
  ) {
    return 9;
  }

  return value;
}

function normalizeMinute(
  value: number | undefined
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 59
  ) {
    return 0;
  }

  return value;
}

function normalizeChannels(
  channels: LegalAlarmChannel[] | undefined
): LegalAlarmChannel[] {
  const allowed =
    new Set<LegalAlarmChannel>([
      "in_app",
      "push",
      "email",
    ]);

  const normalized =
    Array.from(
      new Set(
        (channels || DEFAULT_CHANNELS)
          .filter(
            (channel) =>
              allowed.has(channel)
          )
      )
    );

  return normalized.length > 0
    ? normalized
    : ["in_app"];
}

function createTriggerAt(
  date: string,
  hour: number,
  minute: number
): string {
  if (!isValidIsoDate(date)) {
    throw new Error(
      `Alarm tarihi geçersiz: ${date}.`
    );
  }

  return `${date}T${pad(hour)}:${pad(
    minute
  )}:00`;
}

function createStableId(
  parts: string[]
): string {
  const text = parts
    .join("|")
    .toLocaleLowerCase("tr-TR")
    .replace(
      /[^a-z0-9çğıöşü|_-]+/gi,
      "-"
    )
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  let hash = 0;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    hash =
      (hash * 31 +
        text.charCodeAt(index)) |
      0;
  }

  return `alarm-${Math.abs(hash)}-${text.slice(
    0,
    48
  )}`;
}

function getPriority(
  daysBefore: number | null,
  kind: LegalAlarmKind
): LegalAlarmPriority {
  if (
    kind === "same_day" ||
    kind === "overdue"
  ) {
    return "critical";
  }

  if (
    daysBefore !== null &&
    daysBefore <= 3
  ) {
    return "important";
  }

  return "normal";
}

function buildContextText(
  input: LegalAlarmPlanInput
): string {
  const values = [
    input.court?.trim() || "",
    input.fileNo?.trim()
      ? `Dosya ${input.fileNo.trim()}`
      : "",
  ].filter(Boolean);

  return values.length > 0
    ? ` ${values.join(" · ")}.`
    : "";
}

function buildMessage(
  input: LegalAlarmPlanInput,
  kind: LegalAlarmKind,
  daysBefore: number | null
): string {
  const context =
    buildContextText(input);

  if (kind === "same_day") {
    return `${input.title} için bugün son gün.${context}`;
  }

  if (kind === "overdue") {
    return `${input.title} için kayıtlı hukuki süre geçti.${context}`;
  }

  return `${input.title} için son güne ${daysBefore} gün kaldı.${context}`;
}

function toComparableTime(
  value: string
): number {
  const parsed = new Date(value);

  if (
    Number.isNaN(parsed.getTime())
  ) {
    throw new Error(
      `Geçersiz tarih-saat: ${value}.`
    );
  }

  return parsed.getTime();
}

export class LegalAlarmEngine {
  private readonly calendar:
    BusinessCalendarEngine;

  constructor(
    calendar:
      BusinessCalendarEngine =
        createTurkishBusinessCalendar()
  ) {
    this.calendar = calendar;
  }

  createPlan(
    input: LegalAlarmPlanInput
  ): LegalAlarmPlanResult {
    if (!input.userId?.trim()) {
      throw new Error(
        "Alarm planı için userId zorunludur."
      );
    }

    if (!input.deadlineId?.trim()) {
      throw new Error(
        "Alarm planı için deadlineId zorunludur."
      );
    }

    if (
      !input.calendarEventId?.trim()
    ) {
      throw new Error(
        "Alarm planı için calendarEventId zorunludur."
      );
    }

    if (!input.title?.trim()) {
      throw new Error(
        "Alarm başlığı zorunludur."
      );
    }

    if (
      !isValidIsoDate(
        input.deadlineDate
      )
    ) {
      throw new Error(
        "Geçerli deadlineDate zorunludur."
      );
    }

    const notificationHour =
      normalizeHour(
        input.notificationHour
      );

    const notificationMinute =
      normalizeMinute(
        input.notificationMinute
      );

    const channels =
      normalizeChannels(
        input.channels
      );

    const reminderDays =
      normalizeReminderDays(
        input.reminderDays ||
          DEFAULT_REMINDER_DAYS
      );

    const includeSameDay =
      input.includeSameDay !== false;

    const includeOverdue =
      input.includeOverdue !== false;

    const skipPastAdvanceAlarms =
      input.skipPastAdvanceAlarms !== false;

    const now =
      input.now ||
      new Date().toISOString();

    const nowTime =
      toComparableTime(now);

    const alarms:
      LegalAlarmDefinition[] = [];

    const skipped: Array<{
      daysBefore: number;
      reason: string;
    }> = [];

    for (
      const daysBefore of reminderDays
    ) {
      const requestedDate =
        addDays(
          input.deadlineDate,
          -daysBefore
        );

      const requestedStatus =
        this.calendar.getDayStatus(
          requestedDate
        );

      const triggerDate =
        requestedStatus.isBusinessDay
          ? requestedDate
          : this.calendar.previousBusinessDay(
              requestedDate,
              false
            );

      const triggerAt =
        createTriggerAt(
          triggerDate,
          notificationHour,
          notificationMinute
        );

      if (
        skipPastAdvanceAlarms &&
        toComparableTime(triggerAt) <=
          nowTime
      ) {
        skipped.push({
          daysBefore,
          reason:
            "Alarm zamanı geçmiş olduğu için oluşturulmadı.",
        });

        continue;
      }

      const alarm: LegalAlarmDefinition = {
        id: createStableId([
          input.userId,
          input.deadlineId,
          input.calendarEventId,
          String(daysBefore),
          triggerAt,
        ]),

        userId:
          input.userId.trim(),

        deadlineId:
          input.deadlineId.trim(),

        calendarEventId:
          input.calendarEventId.trim(),

        caseId:
          input.caseId?.trim() || "",

        title:
          input.title.trim(),

        message:
          buildMessage(
            input,
            "advance",
            daysBefore
          ),

        deadlineDate:
          input.deadlineDate,

        triggerAt,

        kind: "advance",
        status: "pending",

        priority:
          getPriority(
            daysBefore,
            "advance"
          ),

        daysBefore,
        channels,

        metadata: {
          eventType:
            input.eventType || "",
          court:
            input.court || "",
          fileNo:
            input.fileNo || "",
          requestedTriggerDate:
            requestedDate,
          finalTriggerDate:
            triggerDate,
          shiftedForNonBusinessDay:
            requestedDate !==
            triggerDate,
          requestedDayStatus:
            requestedStatus,
          timezone:
            input.timezone ||
            "Europe/Istanbul",
        },
      };

      alarms.push(alarm);
    }

    if (includeSameDay) {
      const triggerAt =
        createTriggerAt(
          input.deadlineDate,
          notificationHour,
          notificationMinute
        );

      alarms.push({
        id: createStableId([
          input.userId,
          input.deadlineId,
          input.calendarEventId,
          "same-day",
          triggerAt,
        ]),

        userId:
          input.userId.trim(),

        deadlineId:
          input.deadlineId.trim(),

        calendarEventId:
          input.calendarEventId.trim(),

        caseId:
          input.caseId?.trim() || "",

        title:
          input.title.trim(),

        message:
          buildMessage(
            input,
            "same_day",
            0
          ),

        deadlineDate:
          input.deadlineDate,

        triggerAt,

        kind: "same_day",
        status: "pending",
        priority: "critical",

        daysBefore: 0,
        channels,

        metadata: {
          eventType:
            input.eventType || "",
          court:
            input.court || "",
          fileNo:
            input.fileNo || "",
          timezone:
            input.timezone ||
            "Europe/Istanbul",
        },
      });
    }

    if (includeOverdue) {
      const overdueDate =
        addDays(
          input.deadlineDate,
          1
        );

      const triggerAt =
        createTriggerAt(
          overdueDate,
          notificationHour,
          notificationMinute
        );

      alarms.push({
        id: createStableId([
          input.userId,
          input.deadlineId,
          input.calendarEventId,
          "overdue",
          triggerAt,
        ]),

        userId:
          input.userId.trim(),

        deadlineId:
          input.deadlineId.trim(),

        calendarEventId:
          input.calendarEventId.trim(),

        caseId:
          input.caseId?.trim() || "",

        title:
          input.title.trim(),

        message:
          buildMessage(
            input,
            "overdue",
            null
          ),

        deadlineDate:
          input.deadlineDate,

        triggerAt,

        kind: "overdue",
        status: "pending",
        priority: "critical",

        daysBefore: null,
        channels,

        metadata: {
          eventType:
            input.eventType || "",
          court:
            input.court || "",
          fileNo:
            input.fileNo || "",
          timezone:
            input.timezone ||
            "Europe/Istanbul",
        },
      });
    }

    const uniqueMap =
      new Map<
        string,
        LegalAlarmDefinition
      >();

    for (const alarm of alarms) {
      uniqueMap.set(
        alarm.id,
        alarm
      );
    }

    const uniqueAlarms =
      Array.from(
        uniqueMap.values()
      ).sort(
        (left, right) =>
          left.triggerAt.localeCompare(
            right.triggerAt
          )
      );

    return {
      deadlineDate:
        input.deadlineDate,

      generatedAt:
        new Date().toISOString(),

      alarms:
        uniqueAlarms,

      skipped,

      summary: {
        total:
          uniqueAlarms.length,

        advance:
          uniqueAlarms.filter(
            (alarm) =>
              alarm.kind === "advance"
          ).length,

        sameDay:
          uniqueAlarms.filter(
            (alarm) =>
              alarm.kind ===
              "same_day"
          ).length,

        overdue:
          uniqueAlarms.filter(
            (alarm) =>
              alarm.kind === "overdue"
          ).length,
      },
    };
  }

  getDueAlarms(
    alarms: LegalAlarmDefinition[],
    now = new Date().toISOString()
  ): LegalAlarmDefinition[] {
    const nowTime =
      toComparableTime(now);

    return alarms
      .filter(
        (alarm) =>
          alarm.status === "pending" &&
          toComparableTime(
            alarm.triggerAt
          ) <= nowTime
      )
      .sort(
        (left, right) =>
          left.triggerAt.localeCompare(
            right.triggerAt
          )
      );
  }

  markStatus(
    alarm: LegalAlarmDefinition,
    status: LegalAlarmStatus
  ): LegalAlarmDefinition {
    return {
      ...alarm,
      status,
      metadata: {
        ...alarm.metadata,
        statusChangedAt:
          new Date().toISOString(),
      },
    };
  }
}

export function createLegalAlarmEngine(
  calendar?:
    BusinessCalendarEngine
): LegalAlarmEngine {
  return new LegalAlarmEngine(
    calendar ||
      createTurkishBusinessCalendar()
  );
}

