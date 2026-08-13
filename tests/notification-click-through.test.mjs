import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  resolveNotificationTarget,
} from "../lib/notifications/clickThrough.ts";

const read = (path) =>
  readFile(new URL(path, import.meta.url), "utf8");

const [
  notifierSource,
  registrationSource,
  workerSource,
  calendarSource,
  casesSource,
  calendarRouteSource,
] = await Promise.all([
  read("../components/LegalAlarmNotifier.tsx"),
  read("../components/LegalPushRegistration.tsx"),
  read("../public/legal-push-sw.js"),
  read("../app/calendar/page.tsx"),
  read("../app/cases/page.tsx"),
  read("../app/api/calendar-events/route.ts"),
]);

test("notification targets allow only owned app routes and safe ids", () => {
  assert.equal(
    resolveNotificationTarget("/calendar?event=event-123"),
    "/calendar?event=event-123"
  );
  assert.equal(
    resolveNotificationTarget("/cases?case=case_123"),
    "/cases?case=case_123"
  );
  assert.equal(
    resolveNotificationTarget("https://evil.example/cases?case=x"),
    "/inbox"
  );
  assert.equal(resolveNotificationTarget("/unknown?token=secret"), "/inbox");
});

test("open notification posts to native shell and navigates same window", () => {
  assert.match(notifierSource, /openNotificationTarget\(/);
  assert.match(registrationSource, /METHER_NOTIFICATION_OPEN/);
  assert.match(registrationSource, /serviceWorker[\s\S]*addEventListener\([\s\S]*"message"/);
});

test("service worker focuses an open client and forwards activation", () => {
  assert.match(workerSource, /client\.postMessage\(\{[\s\S]*METHER_NOTIFICATION_OPEN/);
  assert.match(workerSource, /client[\s\S]*\.focus\(\)[\s\S]*client\.navigate/);
  assert.match(workerSource, /clients[\s\S]*\.openWindow\([\s\S]*targetUrl/);
});

test("calendar notification locates and selects the exact event", () => {
  assert.match(calendarSource, /get\("event"\)/);
  assert.match(calendarSource, /calendar-events\?eventId=/);
  assert.match(calendarSource, /setSelectedEventId\(eventId\)/);
  assert.match(calendarRouteSource, /\.eq\(\s*"user_id",\s*appUser\.id\s*\)/);
  assert.match(calendarRouteSource, /\.eq\(\s*"id",\s*eventId\s*\)/);
});

test("case notification opens only an existing owned case", () => {
  assert.match(casesSource, /get\("case"\)/);
  assert.match(casesSource, /cases\.some\(\(item\) => item\.id === caseId\)/);
  assert.match(casesSource, /setOpenCaseId\(caseId\)/);
});
