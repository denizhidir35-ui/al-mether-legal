import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  deleteOwnedCase,
} from "../lib/legal/caseDeletion.ts";

function createFixture() {
  const data = {
    cases: [
      { id: "case-own", user_id: "user-1" },
      { id: "case-other", user_id: "user-2" },
    ],
    events: [
      { id: "event-own", case_id: "case-own", user_id: "user-1" },
      { id: "event-other", case_id: "case-other", user_id: "user-2" },
    ],
    deadlines: [
      { id: "deadline-own", case_id: "case-own", user_id: "user-1" },
      { id: "deadline-other", case_id: "case-other", user_id: "user-2" },
    ],
    alarms: [
      {
        id: "alarm-own-case",
        case_id: "case-own",
        calendar_event_id: null,
        legal_deadline_id: null,
        user_id: "user-1",
      },
      {
        id: "alarm-own-event",
        case_id: null,
        calendar_event_id: "event-own",
        legal_deadline_id: null,
        user_id: "user-1",
      },
      {
        id: "alarm-own-deadline",
        case_id: null,
        calendar_event_id: null,
        legal_deadline_id: "deadline-own",
        user_id: "user-1",
      },
      {
        id: "alarm-other",
        case_id: "case-other",
        calendar_event_id: "event-other",
        legal_deadline_id: "deadline-other",
        user_id: "user-2",
      },
    ],
    attachments: [
      {
        id: "attachment-own",
        case_id: "case-own",
        calendar_event_id: null,
        storage_path: "user-1/case/case-own/file.pdf",
        user_id: "user-1",
      },
      {
        id: "attachment-own-event",
        case_id: null,
        calendar_event_id: "event-own",
        storage_path: "user-1/calendar/event-own/mail.pdf",
        user_id: "user-1",
      },
      {
        id: "attachment-other",
        case_id: "case-other",
        calendar_event_id: "event-other",
        storage_path: "user-2/case/case-other/file.pdf",
        user_id: "user-2",
      },
    ],
    caseMails: [
      {
        id: "case-mail-own",
        case_id: "case-own",
        user_id: "user-1",
        provider_message_id: "gmail-source-1",
      },
      {
        id: "case-mail-other",
        case_id: "case-other",
        user_id: "user-2",
        provider_message_id: "gmail-source-2",
      },
    ],
    notes: [
      { id: "note-own", case_id: "case-own", user_id: "user-1" },
      { id: "note-other", case_id: "case-other", user_id: "user-2" },
    ],
    storage: [
      "user-1/case/case-own/file.pdf",
      "user-1/calendar/event-own/mail.pdf",
      "user-2/case/case-other/file.pdf",
    ],
    gmailSource: [
      "gmail-source-1",
      "gmail-source-2",
    ],
  };

  const removeWhere = (
    key,
    predicate
  ) => {
    data[key] = data[key].filter(
      (row) => !predicate(row)
    );
  };

  const store = {
    async findOwnedCase(userId, caseId) {
      return data.cases.some(
        (row) =>
          row.id === caseId &&
          row.user_id === userId
      );
    },
    async listCalendarEventIds(userId, caseId) {
      return data.events
        .filter(
          (row) =>
            row.user_id === userId &&
            row.case_id === caseId
        )
        .map((row) => row.id);
    },
    async listDeadlineIds(userId, caseId) {
      return data.deadlines
        .filter(
          (row) =>
            row.user_id === userId &&
            row.case_id === caseId
        )
        .map((row) => row.id);
    },
    async listAttachments(userId, caseId, eventIds) {
      return data.attachments.filter(
        (row) =>
          row.user_id === userId &&
          (row.case_id === caseId ||
            eventIds.includes(
              row.calendar_event_id
            ))
      );
    },
    async removeAttachmentFiles(paths) {
      data.storage = data.storage.filter(
        (path) => !paths.includes(path)
      );
    },
    async deleteAlarms(userId, caseId, eventIds, deadlineIds) {
      removeWhere(
        "alarms",
        (row) =>
          row.user_id === userId &&
          (row.case_id === caseId ||
            eventIds.includes(
              row.calendar_event_id
            ) ||
            deadlineIds.includes(
              row.legal_deadline_id
            ))
      );
    },
    async deleteAttachments(userId, caseId, eventIds) {
      removeWhere(
        "attachments",
        (row) =>
          row.user_id === userId &&
          (row.case_id === caseId ||
            eventIds.includes(
              row.calendar_event_id
            ))
      );
    },
    async deleteDeadlines(userId, caseId) {
      removeWhere(
        "deadlines",
        (row) =>
          row.user_id === userId &&
          row.case_id === caseId
      );
    },
    async deleteCalendarEvents(userId, caseId) {
      removeWhere(
        "events",
        (row) =>
          row.user_id === userId &&
          row.case_id === caseId
      );
    },
    async deleteCaseMails(userId, caseId) {
      removeWhere(
        "caseMails",
        (row) =>
          row.user_id === userId &&
          row.case_id === caseId
      );
    },
    async deleteCaseNotes(userId, caseId) {
      removeWhere(
        "notes",
        (row) =>
          row.user_id === userId &&
          row.case_id === caseId
      );
    },
    async deleteCase(userId, caseId) {
      const before = data.cases.length;
      removeWhere(
        "cases",
        (row) =>
          row.user_id === userId &&
          row.id === caseId
      );
      return data.cases.length < before;
    },
  };

  return { data, store };
}

test("own case delete removes the owned case", async () => {
  const fixture = createFixture();
  const result = await deleteOwnedCase(
    fixture.store,
    "user-1",
    "case-own"
  );

  assert.equal(result.deleted, true);
  assert.deepEqual(
    fixture.data.cases.map((row) => row.id),
    ["case-other"]
  );
});

test("ownership guard returns not found and changes nothing", async () => {
  const fixture = createFixture();
  const snapshot = structuredClone(
    fixture.data
  );
  const result = await deleteOwnedCase(
    fixture.store,
    "user-2",
    "case-own"
  );

  assert.deepEqual(result, {
    deleted: false,
    reason: "not_found",
  });
  assert.deepEqual(
    fixture.data,
    snapshot
  );
});

test("calendar events, legal deadlines and alarms are cleaned", async () => {
  const fixture = createFixture();
  await deleteOwnedCase(
    fixture.store,
    "user-1",
    "case-own"
  );

  assert.deepEqual(
    fixture.data.events.map((row) => row.id),
    ["event-other"]
  );
  assert.deepEqual(
    fixture.data.deadlines.map((row) => row.id),
    ["deadline-other"]
  );
  assert.deepEqual(
    fixture.data.alarms.map((row) => row.id),
    ["alarm-other"]
  );
});

test("case documents are removed while other case records remain", async () => {
  const fixture = createFixture();
  const result = await deleteOwnedCase(
    fixture.store,
    "user-1",
    "case-own"
  );

  assert.equal(
    result.removedAttachmentCount,
    2
  );
  assert.deepEqual(
    fixture.data.attachments.map((row) => row.id),
    ["attachment-other"]
  );
  assert.deepEqual(fixture.data.storage, [
    "user-2/case/case-other/file.pdf",
  ]);
  assert.deepEqual(
    fixture.data.notes.map((row) => row.id),
    ["note-other"]
  );
});

test("mail link is cleaned without deleting the provider mail source", async () => {
  const fixture = createFixture();
  await deleteOwnedCase(
    fixture.store,
    "user-1",
    "case-own"
  );

  assert.deepEqual(
    fixture.data.caseMails.map((row) => row.id),
    ["case-mail-other"]
  );
  assert.deepEqual(
    fixture.data.gmailSource,
    ["gmail-source-1", "gmail-source-2"]
  );
});

test("delete API applies ownership to the case and every cleanup query", async () => {
  const routeSource = await readFile(
    new URL(
      "../app/api/cases/[caseId]/route.ts",
      import.meta.url
    ),
    "utf8"
  );
  const serviceSource = await readFile(
    new URL(
      "../lib/legal/caseDeletion.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    routeSource,
    /deleteOwnedCase\([\s\S]*?appUser\.id,[\s\S]*?caseId/
  );
  assert.match(
    serviceSource,
    /from\("legal_cases"\)[\s\S]*?\.eq\("id", caseId\)[\s\S]*?\.eq\("user_id", userId\)/
  );
  assert.match(
    serviceSource,
    /\.delete\(\)[\s\S]*?\.eq\("user_id", userId\)[\s\S]*?\.eq\("case_id", caseId\)/
  );
  assert.doesNotMatch(
    serviceSource,
    /gmailapis|outlook|messages\.delete|mail_connections/
  );
});

test("desktop and mobile UI require an explicit confirmation", async () => {
  const source = await readFile(
    new URL(
      "../app/cases/page.tsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    source,
    /requestCaseDeletion\([\s\S]*?>\s*Sil\s*</
  );
  assert.match(
    source,
    /className="case-panel-actions"[\s\S]*?requestCaseDeletion\([\s\S]*?>\s*Sil\s*</
  );
  assert.match(
    source,
    /function requestCaseDeletion\([\s\S]*?setDeleteCandidate\(item\)[\s\S]*?\{deleteCandidate && \([\s\S]*?role="dialog"/
  );
  assert.match(
    source,
    /Davayı silmek istediğinize emin misiniz\?/
  );
  assert.match(
    source,
    /Vazgeç[\s\S]*?Davayı Sil/
  );
  assert.match(
    source,
    /role="dialog"[\s\S]*?aria-modal="true"/
  );
  assert.match(
    source,
    /setCases\(\(current\)[\s\S]*?item\.id !== caseId/
  );
  assert.match(
    source,
    /clearDeletedCaseState\([\s\S]*?setOpenCaseId\(""\)[\s\S]*?setCaseDocuments\(\[\]\)/
  );
  assert.match(
    source,
    /@media \(max-width: 520px\)[\s\S]*?\.case-delete-actions[\s\S]*?grid-template-columns:/
  );
  assert.match(
    source,
    /\.case-delete-dialog[\s\S]*?width: min\(420px, 100%\)/
  );
});
