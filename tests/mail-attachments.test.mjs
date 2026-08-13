import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  attachmentLimitError,
  attachmentTotalSize,
  MAIL_ATTACHMENT_LIMIT_MESSAGE,
  MAX_MAIL_ATTACHMENT_BYTES,
  removeAttachmentAt,
} from "../lib/mail/attachments.ts";

import {
  buildMimeMessage,
  nodemailerOptions,
} from "../lib/mail/outgoingMessage.ts";

import {
  simpleParser,
} from "mailparser";

function attachment(
  filename,
  content
) {
  const buffer =
    Buffer.from(content);

  return {
    filename,
    contentType:
      "text/plain",
    size: buffer.length,
    content: buffer,
  };
}

function message(
  attachments
) {
  return {
    from:
      "info@hukukburosu.com",
    to: ["alici@example.com"],
    cc: [],
    bcc: [],
    subject: "Ek testi",
    text: "İleti gövdesi",
    attachments,
  };
}

test("single attachment is embedded in MIME", async () => {
  const raw =
    await buildMimeMessage(
      message([
        attachment(
          "dilekce.txt",
          "tek ek"
        ),
      ])
    );

  const parsed =
    await simpleParser(raw);

  assert.equal(
    parsed.attachments.length,
    1
  );
  assert.equal(
    parsed.attachments[0]
      .filename,
    "dilekce.txt"
  );
  assert.equal(
    parsed.attachments[0]
      .content.toString(),
    "tek ek"
  );
});

test("multiple attachments are embedded in MIME", async () => {
  const raw =
    await buildMimeMessage(
      message([
        attachment(
          "bir.txt",
          "bir"
        ),
        attachment(
          "iki.txt",
          "iki"
        ),
      ])
    );

  const parsed =
    await simpleParser(raw);

  assert.deepEqual(
    parsed.attachments.map(
      (item) =>
        item.filename
    ),
    ["bir.txt", "iki.txt"]
  );
});

test("attachment total at 25 MB is allowed", () => {
  const files = [
    {
      size:
        MAX_MAIL_ATTACHMENT_BYTES -
        1,
    },
    { size: 1 },
  ];

  assert.equal(
    attachmentTotalSize(files),
    MAX_MAIL_ATTACHMENT_BYTES
  );
  assert.equal(
    attachmentLimitError(files),
    ""
  );
});

test("attachment total over 25 MB is blocked", () => {
  assert.equal(
    attachmentLimitError([
      {
        size:
          MAX_MAIL_ATTACHMENT_BYTES +
          1,
      },
    ]),
    MAIL_ATTACHMENT_LIMIT_MESSAGE
  );
});

test("selected attachment can be removed", () => {
  assert.deepEqual(
    removeAttachmentAt(
      ["bir", "iki", "uc"],
      1
    ),
    ["bir", "uc"]
  );
});

test("SMTP options contain attachment bytes", () => {
  const file =
    attachment(
      "kurumsal.txt",
      "smtp eki"
    );

  const options =
    nodemailerOptions(
      message([file])
    );

  assert.equal(
    options.from,
    "info@hukukburosu.com"
  );
  assert.equal(
    options.attachments[0]
      .filename,
    "kurumsal.txt"
  );
  assert.deepEqual(
    options.attachments[0]
      .content,
    file.content
  );
});

test("UI multipart send preserves selected sender routing", async () => {
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
    /form\.set\(\s*"connectionId",\s*composerConnectionId/
  );
  assert.match(
    inboxSource,
    /form\.append\(\s*"attachments"/
  );
  assert.match(
    sendSource,
    /getOwnedMailConnection\(\s*connectionId\s*\)/
  );
});

test("Gmail and Microsoft provider branches send real attachment payloads", async () => {
  const source =
    await readFile(
      new URL(
        "../app/api/mail/send/route.ts",
        import.meta.url
      ),
      "utf8"
    );

  assert.match(
    source,
    /await buildMimeMessage\(/
  );
  assert.match(
    source,
    /attachments\/createUploadSession/
  );
  assert.match(
    source,
    /contentBytes:/
  );
});
