import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DATE_ONLY_LEGAL_ALARM_HOUR,
  DEFAULT_MANUAL_REMINDER_TIME,
  dateOnlyLegalAlarmTime,
  resolveDocumentHearingAt,
} from "../lib/legal/alarmTimeRules.ts";
import {
  createOwnedManualReminder,
  createManualReminderPlan,
  MANUAL_REMINDER_EVENT_TYPE,
  MANUAL_REMINDER_SOURCE,
} from "../lib/legal/manualReminder.ts";

function createFixtureStore() {
  const state = {
    cases: [
      {
        id: "case-own",
        user_id: "user-1",
        case_title: "Örnek Dava",
      },
      {
        id: "case-other",
        user_id: "user-2",
        case_title: "Başka Dava",
      },
    ],
    reminders: [],
    legalDeadlines: [],
  };

  const store = {
    async findOwnedCase(userId, caseId) {
      return state.cases.find(
        (item) =>
          item.id === caseId &&
          item.user_id === userId
      ) || null;
    },
    async findExisting(userId, plan) {
      return state.reminders.find(
        (item) =>
          item.user_id === userId &&
          item.dedupe_key ===
            plan.dedupeKey
      ) || null;
    },
    async create(userId, _caseTitle, plan) {
      const reminder = {
        id:
          `reminder-${state.reminders.length + 1}`,
        user_id: userId,
        case_id: plan.caseId,
        calendar_event_id:
          `event-${state.reminders.length + 1}`,
        alarm_time: plan.alarmAt,
        alarm_type:
          MANUAL_REMINDER_EVENT_TYPE,
        message:
          plan.note ||
          "Manuel hatırlatma",
        status: "pending",
        source:
          MANUAL_REMINDER_SOURCE,
        event_type:
          MANUAL_REMINDER_EVENT_TYPE,
        dedupe_key:
          plan.dedupeKey,
      };

      state.reminders.push(
        reminder
      );
      return reminder;
    },
    async list(userId, caseId) {
      return state.reminders.filter(
        (item) =>
          item.user_id === userId &&
          item.case_id === caseId
      );
    },
  };

  return { state, store };
}

test("own case manual alarm is created without a legal deadline", async () => {
  const fixture =
    createFixtureStore();
  const result =
    await createOwnedManualReminder(
      fixture.store,
      "user-1",
      {
        caseId: "case-own",
        date: "2026-08-23",
        time: "09:00",
        note: "Dosyayı kontrol et",
      }
    );

  assert.equal(result.ok, true);
  assert.equal(
    result.reminder.alarm_type,
    "manual_reminder"
  );
  assert.equal(
    fixture.state.reminders[0].source,
    "user_entered"
  );
  assert.deepEqual(
    fixture.state.legalDeadlines,
    []
  );
});

test("manual reminder ownership guard hides another user's case", async () => {
  const fixture =
    createFixtureStore();
  const result =
    await createOwnedManualReminder(
      fixture.store,
      "user-2",
      {
        caseId: "case-own",
        date: "2026-08-23",
        time: "09:00",
        note: "Yetkisiz",
      }
    );

  assert.deepEqual(result, {
    ok: false,
    reason: "not_found",
  });
  assert.equal(
    fixture.state.reminders.length,
    0
  );
});

test("manual date and user-changed time are preserved exactly", () => {
  const plan =
    createManualReminderPlan({
      caseId: "case-own",
      date: "2026-08-23",
      time: "14:45",
      note: "Ara",
    });

  assert.equal(
    plan.alarmAt,
    "2026-08-23T14:45:00+03:00"
  );
  assert.equal(plan.time, "14:45");
});

test("Sunday manual reminder remains Sunday", () => {
  const plan =
    createManualReminderPlan({
      caseId: "case-own",
      date: "2026-08-23",
      time: "09:00",
      note: "Pazar hatırlatması",
    });

  assert.equal(plan.date, "2026-08-23");
  assert.equal(
    new Date(plan.alarmAt).getUTCDay(),
    0
  );
});

test("same case, date, time and normalized note is deduplicated", async () => {
  const fixture =
    createFixtureStore();
  const first =
    await createOwnedManualReminder(
      fixture.store,
      "user-1",
      {
        caseId: "case-own",
        date: "2026-08-24",
        time: "11:20",
        note: "  Dosyayı   ara  ",
      }
    );
  const second =
    await createOwnedManualReminder(
      fixture.store,
      "user-1",
      {
        caseId: "case-own",
        date: "2026-08-24",
        time: "11:20",
        note: "dosyayı ara",
      }
    );

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(
    fixture.state.reminders.length,
    1
  );
});

test("hearing date without time invents nothing and exact time is preserved", () => {
  assert.equal(
    resolveDocumentHearingAt(
      "2026-09-10",
      ""
    ),
    ""
  );
  assert.equal(
    resolveDocumentHearingAt(
      "2026-09-10",
      "13:40"
    ),
    "2026-09-10T13:40"
  );
});

test("general and payment date-only alarms use 12:00", () => {
  assert.equal(
    DATE_ONLY_LEGAL_ALARM_HOUR,
    12
  );

  assert.equal(
    dateOnlyLegalAlarmTime(
      "2026-09-14"
    ),
    "2026-09-14T12:00:00"
  );
});

test("manual reminder route enforces ownership and does not use legal engines", async () => {
  const source = await readFile(
    new URL(
      "../app/api/cases/manual-reminders/route.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    source,
    /from\("legal_cases"\)[\s\S]*?\.eq\("id", caseId\)[\s\S]*?\.eq\("user_id", userId\)/
  );
  assert.match(
    source,
    /event_type:[\s\S]*?plan\.eventType[\s\S]*?source: plan\.source/
  );
  assert.match(
    source,
    /legal_deadline_id: null/
  );
  assert.doesNotMatch(
    source,
    /LegalAlarmEngine|BusinessCalendarEngine|legal_deadlines/
  );
});

test("automatic date-only fallback is scoped without changing UETS default", async () => {
  const casesSource = await readFile(
    new URL(
      "../app/cases/page.tsx",
      import.meta.url
    ),
    "utf8"
  );
  const manualCalendarSource =
    await readFile(
      new URL(
        "../app/api/cases/manual-calendar/route.ts",
        import.meta.url
      ),
      "utf8"
    );
  const fromAnalysisSource =
    await readFile(
      new URL(
        "../app/api/cases/from-analysis/route.ts",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    casesSource,
    /notification_hour:[\s\S]*?DATE_ONLY_LEGAL_ALARM_HOUR/
  );
  assert.match(
    manualCalendarSource,
    /notificationHour:[\s\S]*?DATE_ONLY_LEGAL_ALARM_HOUR/
  );
  assert.match(
    fromAnalysisSource,
    /requestedNotificationHour[\s\S]*?: 9;/
  );
});

test("manual reminder UI has 09:00 default and responsive desktop/mobile layout", async () => {
  const source = await readFile(
    new URL(
      "../app/cases/page.tsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.equal(
    DEFAULT_MANUAL_REMINDER_TIME,
    "09:00"
  );
  assert.match(
    source,
    /Alarm Ekle/
  );
  assert.match(
    source,
    /Manuel Hatırlatma[\s\S]*?type="date"[\s\S]*?type="time"[\s\S]*?Not \/ Açıklama/
  );
  assert.match(
    source,
    /value=\{manualReminderTime\}/
  );
  assert.match(
    source,
    /Vazgeç[\s\S]*?Alarmı Kaydet/
  );
  assert.match(
    source,
    /Manuel hatırlatmalar[\s\S]*?formatReminderDate\([\s\S]*?formatTime\([\s\S]*?reminder\.message/
  );
  assert.match(
    source,
    /\.manual-reminder-dialog[\s\S]*?width: min\(480px, 100%\)/
  );
  assert.match(
    source,
    /@media \(max-width: 520px\)[\s\S]*?\.manual-reminder-form[\s\S]*?grid-template-columns: 1fr/
  );
});
