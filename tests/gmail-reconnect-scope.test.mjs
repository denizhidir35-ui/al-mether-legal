import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GMAIL_FULL_ACCESS_SCOPE,
  getGmailScopeStatus,
  mergeGoogleOAuthScopes,
} from "../lib/mail/googleScopes.ts";

test("old Gmail scope requires reconnect", () => {
  assert.deepEqual(
    getGmailScopeStatus([
      "openid",
      "https://www.googleapis.com/auth/gmail.readonly",
    ]),
    {
      trashReady: false,
      reconnectRequired: true,
    }
  );
});

test("full Gmail scope enables trash without warning", () => {
  assert.deepEqual(
    getGmailScopeStatus(
      `openid email ${GMAIL_FULL_ACCESS_SCOPE}`
    ),
    {
      trashReady: true,
      reconnectRequired: false,
    }
  );
});

test("reconnect records granted scopes without losing existing settings", () => {
  assert.deepEqual(
    mergeGoogleOAuthScopes(
      { locale: "tr" },
      `openid ${GMAIL_FULL_ACCESS_SCOPE}`
    ),
    {
      locale: "tr",
      oauthScopes: [
        "openid",
        GMAIL_FULL_ACCESS_SCOPE,
      ],
    }
  );
});

test("UI warns only flagged Gmail connections and offers reconnect", async () => {
  const source = await readFile(
    new URL(
      "../app/mail-connect/page.tsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    source,
    /connection\.provider === "google"[\s\S]*?connection\.gmailReconnectRequired/
  );
  assert.match(
    source,
    /Gmail bağlantınızı yeni izinler için yeniden bağlamanız gerekiyor\./
  );
  assert.match(
    source,
    /Gmail&apos;i Yeniden Bağla/
  );
});

test("OAuth callback updates the same provider and email before inserting", async () => {
  const source = await readFile(
    new URL(
      "../lib/auth.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    source,
    /\.eq\(\s*"provider",\s*mailProvider\s*\)[\s\S]*?\.eq\(\s*"email",\s*email\s*\)[\s\S]*?\.maybeSingle\(\)/
  );
  assert.match(
    source,
    /previous\.data\?\.id[\s\S]*?\.update\(values\)[\s\S]*?:[\s\S]*?\.insert\(values\)/
  );
  assert.match(
    source,
    /mergeGoogleOAuthScopes\([\s\S]*?account\?\.scope/
  );
});

test("connection endpoint keeps owner isolation and exposes readiness only", async () => {
  const source = await readFile(
    new URL(
      "../app/api/mail-connection/route.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    source,
    /\.eq\(\s*"user_id",\s*appUser\.id\s*\)/
  );
  assert.match(
    source,
    /gmailTrashReady:[\s\S]*?scopeStatus[\s\S]*?\.trashReady/
  );
  assert.doesNotMatch(
    source,
    /access_token:\s*connection|refresh_token:\s*connection/
  );
});
