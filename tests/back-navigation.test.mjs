import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  hasSafeAppHistory,
} from "../lib/navigation/backNavigation.ts";

const read = (path) =>
  readFile(new URL(path, import.meta.url), "utf8");

test("safe app history is preferred and unsafe history falls back", () => {
  assert.equal(
    hasSafeAppHistory(
      "/file-viewer",
      "https://legal.test/cases",
      2,
      "",
      "https://legal.test"
    ),
    true
  );

  assert.equal(
    hasSafeAppHistory(
      "/mail-connect",
      "",
      2,
      "/mail-connect",
      "https://legal.test"
    ),
    true
  );

  assert.equal(
    hasSafeAppHistory(
      "/file-viewer",
      "https://outside.test/page",
      2,
      "",
      "https://legal.test"
    ),
    false
  );

  assert.equal(
    hasSafeAppHistory(
      "/file-viewer",
      "https://legal.test/cases",
      1,
      "/file-viewer",
      "https://legal.test"
    ),
    false
  );
});

test("document and file flows use the case fallback", async () => {
  const cases = await read("../app/cases/page.tsx");
  const viewer = await read("../app/file-viewer/page.tsx");

  assert.match(cases, /fallback="\/cases"/);
  assert.match(cases, /onBack=\{closeCasePanel\}/);
  assert.match(cases, /router\.push\(destination\)/);
  assert.match(viewer, /fallback="\/cases"/);
  assert.match(viewer, /@media \(max-width: 620px\)/);
});

test("mail and note detail close locally", async () => {
  const inbox = await read("../app/inbox/page.tsx");
  const cases = await read("../app/cases/page.tsx");

  assert.match(inbox, /fallback="\/inbox"/);
  assert.match(inbox, /onBack=\{\s*closeMailDetail\s*\}/);
  assert.match(inbox, /setSelectedSummary\(null\)/);
  assert.match(inbox, /setSelectedMail\(null\)/);
  assert.match(cases, /openCaseTab === "note"/);
  assert.match(cases, /onBack=\{closeCasePanel\}/);
});

test("calendar detail closes locally and settings detail falls back", async () => {
  const calendar = await read("../app/calendar/page.tsx");
  const mailConnect = await read("../app/mail-connect/page.tsx");

  assert.match(calendar, /fallback="\/calendar"/);
  assert.match(calendar, /setCalendarDetailOpen\(false\)/);
  assert.match(calendar, /setCalendarDetailOpen\(true\)/);
  assert.match(mailConnect, /fallback="\/settings"/);
});

test("main settings page has no back button", async () => {
  const settings = await read("../app/settings/page.tsx");

  assert.doesNotMatch(settings, /<LegalBackButton/);
  assert.match(
    settings,
    /markSafeAppNavigation\("\/mail-connect"\)/
  );
});
