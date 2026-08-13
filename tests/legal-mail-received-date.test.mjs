import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createMailReceivedDedupeKey,
  createMailReceivedEventTitle,
  resolveProviderReceivedAt,
} from "../lib/mail/receivedDate.ts";

test("Gmail internalDate is used as the real received date", () => {
  assert.equal(
    resolveProviderReceivedAt({
      provider: "google",
      internalDate:
        "1789123456000",
      headerDate:
        "Mon, 01 Jan 2001 10:00:00 +0300",
    }),
    new Date(
      1789123456000
    ).toISOString()
  );
});

test("provider date wins and sync time is never invented", () => {
  const header =
    "Mon, 01 Jan 2001 10:00:00 +0300";

  assert.equal(
    resolveProviderReceivedAt({
      provider: "google",
      internalDate: null,
      headerDate: header,
    }),
    new Date(header)
      .toISOString()
  );

  assert.equal(
    resolveProviderReceivedAt({
      provider: "google",
    }),
    ""
  );
});

test("IMAP internalDate and Microsoft receivedDateTime are supported", () => {
  const imapDate =
    "2026-08-13T08:15:00.000Z";
  const microsoftDate =
    "2026-08-13T09:20:00.000Z";

  assert.equal(
    resolveProviderReceivedAt({
      provider: "imap",
      internalDate: imapDate,
    }),
    imapDate
  );
  assert.equal(
    resolveProviderReceivedAt({
      provider: "microsoft",
      receivedDateTime:
        microsoftDate,
    }),
    microsoftDate
  );
});

test("mail received event title is informational", () => {
  assert.equal(
    createMailReceivedEventTitle(
      "İzmir 23. Asliye Hukuk",
      "Dava bildirimi"
    ),
    "E-posta alındı — İzmir 23. Asliye Hukuk"
  );
});

test("same account and provider message produce a stable duplicate key", () => {
  const first =
    createMailReceivedDedupeKey(
      "account-1",
      "google",
      "message-1"
    );

  assert.equal(
    first,
    createMailReceivedDedupeKey(
      "account-1",
      "google",
      "message-1"
    )
  );
  assert.notEqual(
    first,
    createMailReceivedDedupeKey(
      "account-2",
      "google",
      "message-1"
    )
  );
});

test("sync creates one mail_received info event without alarms", async () => {
  const source =
    await readFile(
      new URL(
        "../app/api/mail-sync/route.ts",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /detail\.data[\s\S]*\.internalDate/
  );
  assert.match(
    source,
    /event_type:\s*"mail_received"/
  );
  assert.match(
    source,
    /source_mail_id:\s*dedupeKey/
  );
  assert.match(
    source,
    /informational:\s*true/
  );
  assert.doesNotMatch(
    source,
    /from\("alarms"\)/
  );
  assert.doesNotMatch(
    source,
    /legal_deadlines/
  );
});

test("case timeline shows sender subject source account and real timestamp", async () => {
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
    /E-posta alındı/
  );
  assert.match(source, /Gönderen:/);
  assert.match(source, /Konu:/);
  assert.match(source, /Hesap:/);
  assert.match(
    source,
    /formatDateTime\(\s*mail\.received_at/
  );
});

test("source account is preserved in calendar event raw data", async () => {
  const source =
    await readFile(
      new URL(
        "../app/api/mail-sync/route.ts",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /sourceAccount:\s*\{[\s\S]*accountId:[\s\S]*emailAddress:[\s\S]*provider:/
  );
});
