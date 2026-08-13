import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ALARM_LOAD_ERROR_MESSAGE,
  readAlarmApiResponse,
} from "../lib/calendar/alarmApiResponse.ts";

const jsonResponse = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

const read = (path) =>
  readFile(new URL(path, import.meta.url), "utf8");

test("alarm response returns existing alarms", async () => {
  const result = await readAlarmApiResponse(
    jsonResponse({
      ok: true,
      alarms: [{ id: "alarm-1" }],
    })
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.data?.alarms, [
    { id: "alarm-1" },
  ]);
});

test("empty 200 and 204 become a clean empty result", async () => {
  const empty200 = await readAlarmApiResponse(
    new Response("", { status: 200 })
  );
  const noContent = await readAlarmApiResponse(
    new Response(null, { status: 204 })
  );

  assert.deepEqual(empty200, {
    ok: true,
    data: null,
  });
  assert.deepEqual(noContent, {
    ok: true,
    data: null,
  });
});

test("4xx, 5xx and malformed bodies return one safe message", async () => {
  const responses = [
    new Response("", { status: 401 }),
    jsonResponse(
      { ok: false, error: "database secret detail" },
      500
    ),
    new Response("not-json", {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    }),
    new Response("gateway page", {
      status: 502,
      headers: {
        "content-type": "text/html",
      },
    }),
  ];

  for (const response of responses) {
    const result = await readAlarmApiResponse(response);
    assert.deepEqual(result, {
      ok: false,
      error: ALARM_LOAD_ERROR_MESSAGE,
    });
    assert.doesNotMatch(
      result.error,
      /Unexpected end of JSON|database secret/
    );
  }
});

test("alarm load aborts stale date or tab requests", async () => {
  const calendar = await read("../app/calendar/page.tsx");

  assert.match(calendar, /new AbortController\(\)/);
  assert.match(calendar, /signal: controller\.signal/);
  assert.match(calendar, /controller\.abort\(\)/);
  assert.match(
    calendar,
    /\[activeDetailTab, selectedEvent\?\.id\]/
  );
  assert.match(calendar, /Planlanmış alarm bulunmuyor\./);
  assert.doesNotMatch(
    calendar.slice(
      calendar.indexOf("async function loadAlarms"),
      calendar.indexOf("async function changeAlarmStatus")
    ),
    /response\.json\(\)/
  );
});

test("cases header keeps session controls in flow and wraps by container width", async () => {
  const cases = await read("../app/cases/page.tsx");

  assert.match(
    cases,
    /container-type:\s*inline-size/
  );
  assert.match(
    cases,
    /grid-template-areas:\s*"title actions session"/
  );
  assert.match(cases, /@container \(max-width: 1050px\)/);
  assert.match(
    cases,
    /"title session"\s*"actions actions"/
  );
  assert.match(
    cases,
    /\.cases-header\s*\.legal-session-control\s*\{[\s\S]*?position:\s*static !important/
  );
  assert.doesNotMatch(cases, /padding-right:\s*(?:170|90)px/);
});

test("back navigation remains present in cases and calendar", async () => {
  const cases = await read("../app/cases/page.tsx");
  const calendar = await read("../app/calendar/page.tsx");

  assert.match(cases, /fallback="\/cases"/);
  assert.match(cases, /onBack=\{closeCasePanel\}/);
  assert.match(calendar, /fallback="\/calendar"/);
  assert.match(calendar, /setCalendarDetailOpen\(false\)/);
});
