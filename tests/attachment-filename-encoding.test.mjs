import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  decodeAttachmentFilename,
} from "../lib/mail/filenameEncoding.ts";

test("UTF-8 and Turkish attachment filenames remain readable", () => {
  assert.equal(
    decodeAttachmentFilename("İzmir İş Mahkemesi.pdf"),
    "İzmir İş Mahkemesi.pdf"
  );
});

test("RFC 2047 attachment filename is decoded", () => {
  assert.equal(
    decodeAttachmentFilename(
      "=?UTF-8?B?w4dhbMSxxZ9tYSBEYXZhc8SxLnBkZg==?="
    ),
    "Çalışma Davası.pdf"
  );
});

test("UTF-8 decoded as Latin-1 mojibake is repaired", () => {
  assert.equal(
    decodeAttachmentFilename("Ä°zmir Ä°ÅŸ Mahkemesi.pdf"),
    "İzmir İş Mahkemesi.pdf"
  );
  assert.equal(
    decodeAttachmentFilename("Kararâ€™Ä±n eki.pdf"),
    "Karar’ın eki.pdf"
  );
});

test("open and download routes keep the normalized filename", async () => {
  const [messageRoute, attachmentRoute, inbox] = await Promise.all([
    readFile(new URL("../app/api/mail/message/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/mail/attachment/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/inbox/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(messageRoute, /decodeAttachmentFilename/);
  assert.match(attachmentRoute, /filename\*=UTF-8''\$\{encodeURIComponent/);
  assert.match(inbox, />\s*Aç\s*</);
  assert.match(inbox, />\s*İndir\s*</);
});
