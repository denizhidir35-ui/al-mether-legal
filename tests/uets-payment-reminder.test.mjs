import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

import { planUetsPaymentReminder } from "../lib/legal/uetsPaymentReminder.ts";

async function loadLegalAlarmEngine() {
  const transpile = (source) =>
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText;
  const businessSource = await readFile(
    new URL("../lib/calendar/BusinessCalendarEngine.ts", import.meta.url),
    "utf8"
  );
  const businessUrl = `data:text/javascript;base64,${Buffer.from(
    transpile(businessSource)
  ).toString("base64")}`;
  const alarmSource = await readFile(
    new URL("../lib/calendar/LegalAlarmEngine.ts", import.meta.url),
    "utf8"
  );
  const alarmModule = transpile(alarmSource).replace(
    'from "./BusinessCalendarEngine"',
    `from "${businessUrl}"`
  );

  return import(
    `data:text/javascript;base64,${Buffer.from(alarmModule).toString("base64")}`
  );
}

const explicitPayment = {
  paymentAmount: 1500,
  paymentCurrency: "TRY",
  paymentDescription: "İstinaf avansı",
  paymentDueDate: "2026-08-24",
  paymentPeriodText: "iki haftalık süre içerisinde",
  sourceDocument: "ustyazi (21).pdf",
};

const context = {
  sourceUrl: "https://ptt.etebligat.gov.tr/uets/123",
  court: "İzmir 23. Asliye Hukuk Mahkemesi",
  fileNo: "2026/52",
  barcodeNo: "123456789012",
};

test("explicit payment due date creates a calendar-ready reminder title", () => {
  const plan = planUetsPaymentReminder(explicitPayment, context);

  assert.equal(plan.shouldCreateCalendar, true);
  assert.equal(plan.dueDate, "2026-08-24");
  assert.equal(plan.title, "1.500 TL İstinaf Avansı");
  assert.match(plan.description, /Kaynak PDF: ustyazi \(21\)\.pdf/);
});

test("explicit payment produces a LegalAlarmEngine plan", async () => {
  const { createLegalAlarmEngine } = await loadLegalAlarmEngine();
  const paymentPlan = planUetsPaymentReminder(explicitPayment, context);
  const alarmPlan = createLegalAlarmEngine().createPlan({
    userId: "user-1",
    deadlineId: "deadline-1",
    calendarEventId: "event-1",
    caseId: "case-1",
    title: paymentPlan.title,
    deadlineDate: paymentPlan.dueDate,
    eventType: "payment_deadline",
    reminderDays: [7, 3, 1],
    includeSameDay: true,
    now: "2026-08-13T09:00:00+03:00",
  });

  assert.ok(alarmPlan.alarms.length > 0);
  assert.equal(alarmPlan.alarms[0].metadata.eventType, "payment_deadline");
});

test("business-day shifts keep only the highest-priority same-time alarm", async () => {
  const { createLegalAlarmEngine } = await loadLegalAlarmEngine();
  const alarmPlan = createLegalAlarmEngine().createPlan({
    userId: "user-1",
    deadlineId: "deadline-1",
    calendarEventId: "event-1",
    caseId: "case-1",
    title: "7.850 TL Gider Avansı",
    deadlineDate: "2026-10-12",
    eventType: "payment_deadline",
    reminderDays: [7, 3, 1],
    includeSameDay: true,
    includeOverdue: false,
    now: "2026-08-14T09:00:00+03:00",
  });

  assert.deepEqual(
    alarmPlan.alarms.map((alarm) => alarm.triggerAt),
    [
      "2026-10-05T09:00:00",
      "2026-10-09T09:00:00",
      "2026-10-12T09:00:00",
    ]
  );
  assert.equal(alarmPlan.summary.total, 3);

  const shiftedAlarm = alarmPlan.alarms.find(
    (alarm) => alarm.triggerAt === "2026-10-09T09:00:00"
  );

  assert.equal(shiftedAlarm?.daysBefore, 1);
  assert.equal(shiftedAlarm?.kind, "advance");
});

test("non-colliding alarm plans keep every reminder", async () => {
  const { createLegalAlarmEngine } = await loadLegalAlarmEngine();
  const alarmPlan = createLegalAlarmEngine().createPlan({
    userId: "user-1",
    deadlineId: "deadline-2",
    calendarEventId: "event-2",
    title: "Normal Son Tarih",
    deadlineDate: "2026-10-15",
    eventType: "legal_deadline",
    reminderDays: [7, 3, 1],
    includeSameDay: true,
    includeOverdue: false,
    now: "2026-08-14T09:00:00+03:00",
  });

  assert.deepEqual(
    alarmPlan.alarms.map((alarm) => alarm.triggerAt),
    [
      "2026-10-08T09:00:00",
      "2026-10-12T09:00:00",
      "2026-10-14T09:00:00",
      "2026-10-15T09:00:00",
    ]
  );
});

test("manual deadline alarm plans remain unchanged when times do not collide", async () => {
  const { createLegalAlarmEngine } = await loadLegalAlarmEngine();
  const alarmPlan = createLegalAlarmEngine().createPlan({
    userId: "user-1",
    deadlineId: "deadline-3",
    calendarEventId: "event-3",
    title: "Manuel Son Tarih",
    deadlineDate: "2026-10-08",
    eventType: "manual_deadline",
    reminderDays: [7, 3, 1],
    includeSameDay: true,
    includeOverdue: false,
    now: "2026-08-14T09:00:00+03:00",
  });

  assert.deepEqual(
    alarmPlan.alarms.map((alarm) => alarm.triggerAt),
    [
      "2026-10-01T09:00:00",
      "2026-10-05T09:00:00",
      "2026-10-07T09:00:00",
      "2026-10-08T09:00:00",
    ]
  );
  assert.ok(
    alarmPlan.alarms.every(
      (alarm) => alarm.metadata.eventType === "manual_deadline"
    )
  );
});

test("period-only payment never invents a date from deemed service", () => {
  const plan = planUetsPaymentReminder(
    {
      ...explicitPayment,
      paymentDueDate: "",
    },
    {
      ...context,
      deemedServiceDate: "2026-08-20",
    }
  );

  assert.equal(plan.shouldCreateCalendar, false);
  assert.equal(plan.dueDate, "");
  assert.match(plan.warning, /başlangıç tarihi doğrulanamadığı için/);
});

test("same PDF payment gets the same duplicate key", () => {
  const first = planUetsPaymentReminder(explicitPayment, context);
  const second = planUetsPaymentReminder(explicitPayment, context);

  assert.equal(first.dedupeKey, second.dedupeKey);
});
