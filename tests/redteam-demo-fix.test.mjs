import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [partiesEditor, partiesRoute, casesPage, calendarPage, toast] =
  await Promise.all([
    readFile(new URL("../components/cases/CasePartiesEditor.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cases/[caseId]/parties/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/cases/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/calendar/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ActionToast.tsx", import.meta.url), "utf8"),
  ]);

test("case parties use the existing persistent CRUD contract", () => {
  assert.match(partiesRoute, /\.from\("case_parties"\)/);
  assert.match(partiesRoute, /export async function GET/);
  assert.match(partiesRoute, /export async function POST/);
  assert.match(partiesRoute, /export async function PATCH/);
  assert.match(partiesRoute, /export async function DELETE/);
  assert.match(partiesRoute, /\.eq\("case_id", caseId\)/);
  assert.match(partiesRoute, /\.eq\("user_id", appUser\.id\)/);
  assert.match(partiesEditor, /cache: "no-store"/);
  assert.match(partiesEditor, /method: draft\.id \? "PATCH" : "POST"/);
  assert.match(partiesEditor, /method: "DELETE"/);
});

test("party editor exposes only the requested fields and roles", () => {
  for (const label of [
    "Ad / Ünvan",
    "Müvekkil",
    "Karşı Taraf",
    "Vekil",
    "Kurum",
    "Telefon (opsiyonel)",
    "E-posta (opsiyonel)",
  ]) {
    assert.match(partiesEditor, new RegExp(label.replace(/[()]/g, "\\$&")));
  }

  assert.match(partiesEditor, /setParties\(\(current\) =>/);
  assert.match(partiesEditor, /current\.filter\(\(item\) => item\.id !== party\.id\)/);
});

test("calendar case action is linked by caseId and unlinked events get the relation CTA", () => {
  assert.match(calendarPage, /selectedEvent\.caseId \? \(/);
  assert.match(calendarPage, /href=\{`\/cases\?case=\$\{encodeURIComponent\(selectedEvent\.caseId\)\}`\}/);
  assert.match(calendarPage, /Davayı Aç/);
  assert.match(calendarPage, /Davayla ilişkilendir/);
  assert.match(casesPage, /\.get\("case"\)/);
  assert.match(casesPage, /setOpenCaseId\(caseId\)/);
});

test("visible case and risk enums use Turkish labels", () => {
  assert.match(casesPage, /active: "Aktif"/);
  assert.match(casesPage, /normal: "Normal Risk"/);
  assert.match(casesPage, /enumLabel\(CASE_STATUS_LABELS/);
  assert.match(casesPage, /enumLabel\(RISK_LABELS/);
  assert.match(calendarPage, /getRiskLabel\(selectedEvent\.risk\)/);
  assert.doesNotMatch(casesPage, /\{item\.status \|\| "active"\}\s*<\/span>/);
  assert.doesNotMatch(casesPage, /\{item\.risk_level \|\| "normal"\}\s*<\/span>/);
});

test("successful saves show accessible, responsive feedback", () => {
  assert.match(casesPage, /setSaveFeedback\("Dava güncellendi"\)/);
  assert.match(partiesEditor, /"Taraf eklendi"/);
  assert.match(calendarPage, /setSaveFeedback\("Takvim kaydı güncellendi"\)/);
  assert.match(toast, /role="status"/);
  assert.match(toast, /aria-live="polite"/);
  assert.match(toast, /@media \(max-width: 640px\)/);
});
