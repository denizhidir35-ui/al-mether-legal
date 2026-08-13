import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeAuthEmail,
} from "../lib/auth/normalizeEmail.ts";

test("forgot-password email normalization is exact and deterministic", () => {
  assert.equal(
    normalizeAuthEmail(
      "  DENIZHIDIR35＠GMAIL.COM\u200B  "
    ),
    "denizhidir35@gmail.com"
  );
});

test("forgot-password keeps generic response and exact recovery redirect", async () => {
  const source = await readFile(
    new URL(
      "../app/auth/forgot-password/page.tsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    source,
    /normalizeAuthEmail\(email\)/
  );
  assert.match(
    source,
    /resetPasswordForEmail\(\s*normalizedEmail,/s
  );
  assert.match(
    source,
    /redirectTo:\s*"https:\/\/legal\.almether\.com\/auth\/reset-password"/
  );
  assert.match(
    source,
    /E-posta sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderildi\./
  );
});
