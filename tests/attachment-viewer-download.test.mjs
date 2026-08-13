import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) =>
  readFile(
    new URL(path, import.meta.url),
    "utf8"
  );

test("mail attachment open uses the app viewer instead of a raw popup", async () => {
  const inbox =
    await read("../app/inbox/page.tsx");
  const viewer =
    await read("../app/file-viewer/page.tsx");

  assert.match(
    inbox,
    /return `\/file-viewer\?\$\{params\.toString\(\)\}`/
  );
  assert.match(inbox, /source:\s*"mail"/);
  assert.doesNotMatch(
    inbox.slice(
      inbox.indexOf("className=\"attachment-actions\""),
      inbox.indexOf("className=\"mail-action-bar\"")
    ),
    /target="_blank"/
  );
  assert.match(viewer, /mimeType\.startsWith\(\s*"image\/"/);
  assert.match(viewer, /className="image-viewer"/);
  assert.match(viewer, /<iframe/);
  assert.match(viewer, /\? "\/inbox"\s*: "\/cases"/);
});

test("mail attachment download preserves authenticated binary and filename", async () => {
  const inbox =
    await read("../app/inbox/page.tsx");
  const route =
    await read("../app/api/mail/attachment/route.ts");

  assert.match(inbox, /credentials:\s*"same-origin"/);
  assert.match(inbox, /await response\.blob\(\)/);
  assert.match(inbox, /anchor\.download\s*=/);
  assert.match(inbox, /content-disposition/);
  assert.match(inbox, /createObjectURL\(blob\)/);

  assert.match(route, /getOwnedMailConnection\(\s*connectionId\s*\)/);
  assert.match(route, /"Content-Type":\s*mimeType/);
  assert.match(route, /contentDisposition\(\s*filename,\s*open\s*\)/);
  assert.match(route, /new Uint8Array\(\s*result\.buffer\s*\)/);
  assert.match(route, /"X-Content-Type-Options":\s*"nosniff"/);
});

test("composer removes the floating dock hit area", async () => {
  const inbox =
    await read("../app/inbox/page.tsx");

  assert.match(
    inbox,
    /\{!composerOpen && \(\s*<LegalDock \/>\s*\)\}/
  );
  assert.match(inbox, /className="attachment-picker"/);
  assert.match(inbox, /className="send-button"/);
});
