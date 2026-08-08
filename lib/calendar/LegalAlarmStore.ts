import "server-only";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

import type {
  LegalAlarmDefinition,
  LegalAlarmPlanResult,
} from "./LegalAlarmEngine";

export type StoredLegalAlarm = {
  id: string;

  user_id: string;
  case_id: string | null;
  calendar_event_id: string;
  legal_deadline_id: string;

  alarm_time: string;
  alarm_type: string;
  message: string;
  status: string;

  created_at?: string;
  updated_at?: string;
};

export type LegalAlarmStoreResult = {
  ok: boolean;

  inserted: number;
  deleted: number;

  alarms: StoredLegalAlarm[];
  error: string | null;
};

function safeText(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function toDatabaseAlarmType(
  alarm: LegalAlarmDefinition
): string {
  if (alarm.kind === "same_day") {
    return "same_day";
  }

  if (alarm.kind === "overdue") {
    return "overdue";
  }

  if (
    alarm.kind === "advance" &&
    typeof alarm.daysBefore === "number"
  ) {
    return `${alarm.daysBefore}_days_before`;
  }

  return "reminder";
}

function toDatabaseRow(
  alarm: LegalAlarmDefinition
) {
  return {
    user_id: safeText(alarm.userId),

    case_id:
      safeText(alarm.caseId) || null,

    calendar_event_id:
      safeText(alarm.calendarEventId),

    legal_deadline_id:
      safeText(alarm.deadlineId),

    alarm_time:
      safeText(alarm.triggerAt),

    alarm_type:
      toDatabaseAlarmType(alarm),

    message:
      safeText(alarm.message),

    status:
      safeText(alarm.status) || "pending",
  };
}

function validateAlarm(
  alarm: LegalAlarmDefinition
): string[] {
  const errors: string[] = [];

  if (!safeText(alarm.userId)) {
    errors.push("userId eksik.");
  }

  if (!safeText(alarm.deadlineId)) {
    errors.push("deadlineId eksik.");
  }

  if (!safeText(alarm.calendarEventId)) {
    errors.push("calendarEventId eksik.");
  }

  if (!safeText(alarm.triggerAt)) {
    errors.push("triggerAt eksik.");
  }

  if (!safeText(alarm.message)) {
    errors.push("message eksik.");
  }

  const triggerDate =
    new Date(alarm.triggerAt);

  if (
    safeText(alarm.triggerAt) &&
    Number.isNaN(triggerDate.getTime())
  ) {
    errors.push(
      `Geçersiz triggerAt: ${alarm.triggerAt}.`
    );
  }

  return errors;
}

function uniqueAlarms(
  alarms: LegalAlarmDefinition[]
): LegalAlarmDefinition[] {
  const uniqueMap =
    new Map<
      string,
      LegalAlarmDefinition
    >();

  for (const alarm of alarms) {
    const key = [
      alarm.userId,
      alarm.calendarEventId,
      alarm.deadlineId,
      alarm.triggerAt,
      alarm.kind,
      alarm.daysBefore ?? "none",
    ].join("|");

    uniqueMap.set(key, alarm);
  }

  return Array.from(
    uniqueMap.values()
  ).sort(
    (left, right) =>
      left.triggerAt.localeCompare(
        right.triggerAt
      )
  );
}

export class LegalAlarmStore {
  static async replacePlan(
    plan: LegalAlarmPlanResult
  ): Promise<LegalAlarmStoreResult> {
    try {
      const alarms =
        uniqueAlarms(plan.alarms);

      if (alarms.length === 0) {
        return {
          ok: true,
          inserted: 0,
          deleted: 0,
          alarms: [],
          error: null,
        };
      }

      const validationErrors =
        alarms.flatMap(
          (alarm, index) =>
            validateAlarm(alarm).map(
              (error) =>
                `Alarm ${index + 1}: ${error}`
            )
        );

      if (
        validationErrors.length > 0
      ) {
        return {
          ok: false,
          inserted: 0,
          deleted: 0,
          alarms: [],
          error:
            validationErrors.join(" "),
        };
      }

      const firstAlarm =
        alarms[0];

      const userId =
        safeText(firstAlarm.userId);

      const calendarEventId =
        safeText(
          firstAlarm.calendarEventId
        );

      const deadlineId =
        safeText(
          firstAlarm.deadlineId
        );

      const containsDifferentOwner =
        alarms.some(
          (alarm) =>
            safeText(alarm.userId) !==
              userId ||
            safeText(
              alarm.calendarEventId
            ) !== calendarEventId ||
            safeText(
              alarm.deadlineId
            ) !== deadlineId
        );

      if (containsDifferentOwner) {
        return {
          ok: false,
          inserted: 0,
          deleted: 0,
          alarms: [],
          error:
            "Tek alarm planında farklı kullanıcı, takvim kaydı veya deadline bulunamaz.",
        };
      }

      const supabase =
        getSupabaseAdmin();

      const deleteResult =
        await supabase
          .from("alarms")
          .delete()
          .eq("user_id", userId)
          .eq(
            "calendar_event_id",
            calendarEventId
          )
          .eq(
            "legal_deadline_id",
            deadlineId
          )
          .eq("status", "pending")
          .select("id");

      if (deleteResult.error) {
        return {
          ok: false,
          inserted: 0,
          deleted: 0,
          alarms: [],
          error:
            deleteResult.error.message,
        };
      }

      const rows =
        alarms.map(
          toDatabaseRow
        );

      const insertResult =
        await supabase
          .from("alarms")
          .insert(rows)
          .select("*");

      if (insertResult.error) {
        return {
          ok: false,
          inserted: 0,
          deleted:
            deleteResult.data?.length ||
            0,
          alarms: [],
          error:
            insertResult.error.message,
        };
      }

      const storedAlarms =
        (insertResult.data ||
          []) as StoredLegalAlarm[];

      return {
        ok: true,

        inserted:
          storedAlarms.length,

        deleted:
          deleteResult.data?.length ||
          0,

        alarms:
          storedAlarms,

        error: null,
      };
    } catch (error: unknown) {
      return {
        ok: false,
        inserted: 0,
        deleted: 0,
        alarms: [],
        error:
          error instanceof Error
            ? error.message
            : "Alarm planı kaydedilemedi.",
      };
    }
  }

  static async getPendingForUser(
    userId: string,
    until?: string
  ): Promise<LegalAlarmStoreResult> {
    try {
      const cleanUserId =
        safeText(userId);

      if (!cleanUserId) {
        return {
          ok: false,
          inserted: 0,
          deleted: 0,
          alarms: [],
          error:
            "Alarm sorgusu için userId zorunludur.",
        };
      }

      const supabase =
        getSupabaseAdmin();

      let query = supabase
        .from("alarms")
        .select("*")
        .eq(
          "user_id",
          cleanUserId
        )
        .eq("status", "pending")
        .order("alarm_time", {
          ascending: true,
        });

      if (until) {
        const parsed =
          new Date(until);

        if (
          Number.isNaN(
            parsed.getTime()
          )
        ) {
          return {
            ok: false,
            inserted: 0,
            deleted: 0,
            alarms: [],
            error:
              "until değeri geçerli bir tarih-saat olmalıdır.",
          };
        }

        query = query.lte(
          "alarm_time",
          until
        );
      }

      const result =
        await query;

      if (result.error) {
        return {
          ok: false,
          inserted: 0,
          deleted: 0,
          alarms: [],
          error:
            result.error.message,
        };
      }

      return {
        ok: true,
        inserted: 0,
        deleted: 0,
        alarms:
          (result.data ||
            []) as StoredLegalAlarm[],
        error: null,
      };
    } catch (error: unknown) {
      return {
        ok: false,
        inserted: 0,
        deleted: 0,
        alarms: [],
        error:
          error instanceof Error
            ? error.message
            : "Bekleyen alarmlar okunamadı.",
      };
    }
  }

  static async updateStatus(
    alarmId: string,
    userId: string,
    status:
      | "sent"
      | "seen"
      | "dismissed"
      | "failed"
      | "cancelled"
  ): Promise<LegalAlarmStoreResult> {
    try {
      const cleanAlarmId =
        safeText(alarmId);

      const cleanUserId =
        safeText(userId);

      if (
        !cleanAlarmId ||
        !cleanUserId
      ) {
        return {
          ok: false,
          inserted: 0,
          deleted: 0,
          alarms: [],
          error:
            "alarmId ve userId zorunludur.",
        };
      }

      const supabase =
        getSupabaseAdmin();

      const result =
        await supabase
          .from("alarms")
          .update({
            status,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", cleanAlarmId)
          .eq(
            "user_id",
            cleanUserId
          )
          .select("*")
          .single();

      if (result.error) {
        return {
          ok: false,
          inserted: 0,
          deleted: 0,
          alarms: [],
          error:
            result.error.message,
        };
      }

      return {
        ok: true,
        inserted: 0,
        deleted: 0,
        alarms: [
          result.data as StoredLegalAlarm,
        ],
        error: null,
      };
    } catch (error: unknown) {
      return {
        ok: false,
        inserted: 0,
        deleted: 0,
        alarms: [],
        error:
          error instanceof Error
            ? error.message
            : "Alarm durumu güncellenemedi.",
      };
    }
  }
}
