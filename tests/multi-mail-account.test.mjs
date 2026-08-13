import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  addSourceAccount,
  findOwnedConnectedAccount,
  resolveComposerAccountId,
  toMailAccountDTO,
} from "../lib/mail/accountModel.ts";

import {
  createMailLinkToken,
  verifyMailLinkToken,
} from "../lib/mail/linkContext.ts";

process.env.NEXTAUTH_SECRET =
  "multi-mail-test-secret";

const connections = [
  {
    id: "account-google",
    user_id: "user-1",
    provider: "google",
    email: "avukat@gmail.com",
    display_name: "Avukat Gmail",
    status: "connected",
    access_token: "must-not-leak",
  },
  {
    id: "account-office",
    user_id: "user-1",
    provider: "imap",
    email: "info@hukukburosu.com",
    display_name: "Büro Bilgi",
    status: "connected",
    secret_encrypted: "must-not-leak",
  },
];

test("one user can retain two distinct connected accounts", () => {
  assert.equal(
    connections.filter(
      (connection) =>
        connection.user_id ===
        "user-1"
    ).length,
    2
  );

  assert.deepEqual(
    connections.map(
      (connection) =>
        toMailAccountDTO(
          connection
        ).emailAddress
    ),
    [
      "avukat@gmail.com",
      "info@hukukburosu.com",
    ]
  );
});

test("safe account DTO exposes identity and status but no secrets", () => {
  const dto =
    toMailAccountDTO(
      connections[0]
    );

  assert.equal(
    dto.accountId,
    "account-google"
  );
  assert.equal(
    dto.displayName,
    "Avukat Gmail"
  );
  assert.equal(
    dto.connectionStatus,
    "connected"
  );
  assert.equal(
    "access_token" in dto,
    false
  );
});

test("inbox message carries its source account", () => {
  const message =
    addSourceAccount(
      {
        id: "message-1",
        subject: "Duruşma",
      },
      connections[1]
    );

  assert.equal(
    message.sourceAccount
      .emailAddress,
    "info@hukukburosu.com"
  );
});

test("composer routes through the explicitly selected account", () => {
  const accountId =
    resolveComposerAccountId(
      connections,
      "account-office",
      "account-google"
    );

  const sender =
    findOwnedConnectedAccount(
      connections,
      "user-1",
      accountId
    );

  assert.equal(
    sender?.provider,
    "imap"
  );
  assert.equal(
    sender?.email,
    "info@hukukburosu.com"
  );
});

test("login identity stays independent from linked mailbox identity", () => {
  const loginEmail =
    "avukat@almether-account.com";
  const mailboxEmail =
    connections[0].email;

  const token =
    createMailLinkToken(
      "user-1",
      "google",
      1_000
    );

  const context =
    verifyMailLinkToken(
      token,
      "google",
      1_001
    );

  assert.notEqual(
    loginEmail,
    mailboxEmail
  );
  assert.equal(
    context?.userId,
    "user-1"
  );
});

test("cross-user account selection is rejected", () => {
  assert.equal(
    findOwnedConnectedAccount(
      connections,
      "user-2",
      "account-google"
    ),
    null
  );
});

test("OAuth link context rejects provider mismatch and tampering", () => {
  const token =
    createMailLinkToken(
      "user-1",
      "google",
      1_000
    );

  assert.equal(
    verifyMailLinkToken(
      token,
      "microsoft",
      1_001
    ),
    null
  );

  assert.equal(
    verifyMailLinkToken(
      `${token}x`,
      "google",
      1_001
    ),
    null
  );
});

test("compose UI and send route use the selected connection id", async () => {
  const inboxSource =
    await readFile(
      new URL(
        "../app/inbox/page.tsx",
        import.meta.url
      ),
      "utf8"
    );

  const sendSource =
    await readFile(
      new URL(
        "../app/api/mail/send/route.ts",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    inboxSource,
    /aria-label="Gönderen posta hesabı"/
  );
  assert.match(
    inboxSource,
    /form\.set\(\s*["']connectionId["']\s*,\s*composerConnectionId\s*\)/
  );
  assert.match(
    sendSource,
    /request\.formData\(\)/
  );
  assert.match(
    sendSource,
    /connectionId:\s*field\(\s*["']connectionId["']\s*\)/
  );
  assert.match(
    sendSource,
    /getOwnedMailConnection\(\s*connectionId\s*\)/
  );
});
