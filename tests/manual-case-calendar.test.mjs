import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  canAddManualCaseToCalendar,
  createManualCaseCalendarPlans,
} from "../lib/legal/manualCaseCalendar.ts";

const base = {
  caseId: "case-1",
  title: "Örnek Dava",
  court: "Ankara 1. Asliye",
  caseNumber: "2026/10",
};

test("manual case without a date creates no calendar plan", () => {
  assert.deepEqual(
    createManualCaseCalendarPlans(
      base
    ),
    []
  );

  assert.equal(
    canAddManualCaseToCalendar(
      "",
      ""
    ),
    false
  );
});

test("hearing date creates one hearing event", () => {
  const plans =
    createManualCaseCalendarPlans({
      ...base,
      hearingAt:
        "2026-10-15T14:30",
    });

  assert.equal(plans.length, 1);
  assert.equal(
    plans[0].kind,
    "hearing"
  );
  assert.equal(
    plans[0].eventType,
    "hearing"
  );
  assert.equal(
    plans[0].hearingAt,
    "2026-10-15T14:30"
  );
});

test("manual user-verified deadline creates one deadline event", () => {
  const plans =
    createManualCaseCalendarPlans({
      ...base,
      manualDeadline:
        "2026-10-20",
    });

  assert.equal(plans.length, 1);
  assert.equal(
    plans[0].kind,
    "manual_deadline"
  );
  assert.equal(
    plans[0].userVerified,
    true
  );
});

test("hearing and manual deadline create two separate events", () => {
  const plans =
    createManualCaseCalendarPlans({
      ...base,
      hearingAt:
        "2026-10-15T14:30",
      manualDeadline:
        "2026-10-20",
    });

  assert.deepEqual(
    plans.map(
      (plan) => plan.kind
    ),
    [
      "hearing",
      "manual_deadline",
    ]
  );
});

test("same case and date produce stable duplicate keys", () => {
  const input = {
    ...base,
    hearingAt:
      "2026-10-15T14:30",
    manualDeadline:
      "2026-10-20",
  };

  assert.deepEqual(
    createManualCaseCalendarPlans(
      input
    ).map(
      (plan) =>
        plan.dedupeKey
    ),
    createManualCaseCalendarPlans(
      input
    ).map(
      (plan) =>
        plan.dedupeKey
    )
  );
});

test("calendar action enables only for a valid user-entered date", () => {
  assert.equal(
    canAddManualCaseToCalendar(
      "2026-10-15T14:30",
      ""
    ),
    true
  );
  assert.equal(
    canAddManualCaseToCalendar(
      "",
      "2026-10-20"
    ),
    true
  );
  assert.equal(
    canAddManualCaseToCalendar(
      "geçersiz",
      ""
    ),
    false
  );
});

test("API wires duplicate protection and existing alarm infrastructure", async () => {
  const source =
    await readFile(
      new URL(
        "../app/api/cases/manual-calendar/route.ts",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /source_mail_id[\s\S]*plan\.dedupeKey/
  );
  assert.match(
    source,
    /createLegalAlarmEngine\(\)/
  );
  assert.match(
    source,
    /LegalAlarmStore[\s\S]*replacePlan/
  );
  assert.match(
    source,
    /from\("alarms"\)/
  );
  assert.match(
    source,
    /"Zaten takvimde"/
  );
});

test("manual form has responsive mobile layout and disabled calendar rule", async () => {
  const source =
    await readFile(
      new URL(
        "../app/cases/page.tsx",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /type="datetime-local"/
  );
  assert.match(
    source,
    /!canAddManualCaseToCalendar\(/
  );
  assert.match(
    source,
    /@media \(max-width: 760px\)/
  );
  assert.match(
    source,
    /\.manual-form-actions[\s\S]*grid-template-columns:/
  );
});
