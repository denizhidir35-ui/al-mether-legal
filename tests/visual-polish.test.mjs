import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  sortCalendarEventsForDisplay,
} from "../lib/calendar/calendarDisplay.ts";

const read = (path) =>
  readFile(new URL(path, import.meta.url), "utf8");

test("inbox uses the existing unread state in dark and light styles", async () => {
  const inbox = await read("../app/inbox/page.tsx");

  assert.match(inbox, /mail\.unread\s*\? "unread"/);
  assert.match(inbox, /\.mail-row\.unread\s*\{/);
  assert.match(inbox, /\.mail-row:not\(\.unread\)/);
  assert.match(inbox, /var\(--legal-gold\)/);
  assert.match(inbox, /:global\(html\.dark\)/);
  assert.match(
    inbox,
    /:global\(html\[data-legal-theme="dark"\]\)/
  );
});

test("ambient image visibility is five percent light and twelve percent dark", async () => {
  const globals = await read("../app/globals.css");

  assert.match(
    globals,
    /rgba\(246, 243, 236, 0\.95\)/
  );
  assert.match(globals, /rgba\(5, 9, 17, 0\.88\)/);
  assert.match(
    globals,
    /url\("\/brand\/legal-login-background\.webp"\)/
  );
});

test("same-day display order is chronological when time exists", () => {
  const events = [
    {
      id: "late",
      startDate: "2026-08-15",
      raw: { receivedAt: "2026-08-15T15:30:00+03:00" },
    },
    {
      id: "no-time-1",
      startDate: "2026-08-15",
    },
    {
      id: "early",
      startDate: "2026-08-15",
      raw: { receivedAt: "2026-08-15T09:00:00+03:00" },
    },
    {
      id: "no-time-2",
      startDate: "2026-08-15",
    },
  ];

  assert.deepEqual(
    sortCalendarEventsForDisplay(events).map(
      (event) => event.id
    ),
    ["early", "late", "no-time-1", "no-time-2"]
  );
});

test("calendar shows one or two chips and a five-plus overflow count", async () => {
  const calendar = await read("../app/calendar/page.tsx");

  assert.match(calendar, /\.slice\(0, 2\)/);
  assert.match(calendar, /dayEvents\.length > 2/);
  assert.match(calendar, /dayEvents\.length - 2/);
  assert.match(
    calendar,
    /className={`event-chip \$\{getEventKind\(/
  );
});

test("selected-day records are vertical, clickable and mobile-safe", async () => {
  const calendar = await read("../app/calendar/page.tsx");

  assert.match(
    calendar,
    /\.event-selector-list\s*\{[\s\S]*?display: grid;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/
  );
  assert.match(
    calendar,
    /setSelectedEventId\(\s*event\.id\s*\)/
  );
  assert.match(calendar, /@media \(max-width: 520px\)/);
  assert.match(calendar, /min-height: 44px/);
});
