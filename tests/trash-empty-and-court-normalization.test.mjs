import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  extractUetsNotice,
} from "../lib/legal/uetsExtractor.ts";

const inboxSource =
  await readFile(
    new URL(
      "../app/inbox/page.tsx",
      import.meta.url
    ),
    "utf8"
  );

const trashRouteSource =
  await readFile(
    new URL(
      "../app/api/mail/trash/route.ts",
      import.meta.url
    ),
    "utf8"
  );

const analyzeRouteSource =
  await readFile(
    new URL(
      "../app/api/uets/document-analyze/route.ts",
      import.meta.url
    ),
    "utf8"
  );

const authSource =
  await readFile(
    new URL(
      "../lib/auth.ts",
      import.meta.url
    ),
    "utf8"
  );

test("trash UI confirms, blocks empty state, refreshes and reports success", () => {
  assert.match(
    inboxSource,
    /Çöpü Boşalt/
  );
  assert.match(
    inboxSource,
    /Çöp kutusundaki tüm iletiler kalıcı olarak silinecek\. Devam edilsin mi\?/
  );
  assert.match(
    inboxSource,
    /messages\.length\s*===\s*0/
  );
  assert.match(
    inboxSource,
    /await loadMessages\(false\)/
  );
  assert.match(
    inboxSource,
    /Çöp kutusu boşaltıldı\./
  );
});

test("trash request sends only the selected connection id", () => {
  assert.match(
    inboxSource,
    /body:\s*JSON\.stringify\(\{\s*connectionId:\s*selectedConnectionId,?\s*\}\)/s
  );
  assert.doesNotMatch(
    inboxSource,
    /connections\.map\([^)]*\/api\/mail\/trash/s
  );

  assert.match(
    trashRouteSource,
    /getOwnedMailConnection\(\s*connectionId\s*\)/
  );
});

test("trash route uses each existing provider architecture", () => {
  assert.match(
    trashRouteSource,
    /gmail\.users\.messages\.list\(\{[\s\S]*?labelIds: \["TRASH"\]/
  );
  assert.match(
    trashRouteSource,
    /gmail\.users\.messages\.batchDelete\(\{[\s\S]*?ids: messageIds\.slice\(/
  );
  assert.match(
    authSource,
    /const googleMailProvider[\s\S]*?https:\/\/mail\.google\.com\//
  );
  assert.match(
    trashRouteSource,
    /mailFolders\/deleteditems\/messages\/\$\{encodeURIComponent\([\s\S]*?\)\}\/permanentDelete/
  );
  assert.match(
    trashRouteSource,
    /resolveImapMailbox\(\s*client,\s*"trash"\s*\)/
  );
  assert.match(
    trashRouteSource,
    /client\.messageDelete\(\s*"1:\*"\s*\)/
  );
});

for (const [input, expected] of [
  [
    "İzmir 20. İş Mahkemesi",
    "İzmir 20. İş Mahkemesi",
  ],
  [
    "İstanbul 12. Asliye Hukuk Mahkemesi",
    "İstanbul 12. Asliye Hukuk Mahkemesi",
  ],
  [
    "Ankara 5. Aile Mahkemesi",
    "Ankara 5. Aile Mahkemesi",
  ],
]) {
  test(`court normalization preserves ${expected}`, () => {
    const result =
      extractUetsNotice(
        `PTT UETS\n${input}`
      );

    assert.equal(
      result.court,
      expected
    );
  });
}

test("document analysis uses a Turkish-aware leading boundary", () => {
  assert.match(
    analyzeRouteSource,
    /\(\?<!\[A-Za-zÇĞİÖŞÜçğıöşü\]\)\(\(\?:İstanbul\|İzmir\|Ankara/
  );
  assert.doesNotMatch(
    analyzeRouteSource,
    /\\b\(\(\?:İstanbul\|İzmir\|Ankara/
  );
});
