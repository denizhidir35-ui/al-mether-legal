import assert from "node:assert/strict";
import {
  spawnSync,
} from "node:child_process";
import {
  cp,
  mkdir,
  readFile,
  rm,
  stat,
} from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import {
  tmpdir,
} from "node:os";
import test from "node:test";

import sharp from "sharp";

const projectRoot =
  resolve(
    new URL(
      "..",
      import.meta.url
    ).pathname.replace(
      /^\/(?:[A-Za-z]:)/u,
      (value) =>
        value.slice(1)
    )
  );

const tracePath =
  join(
    projectRoot,
    ".next",
    "server",
    "app",
    "api",
    "uets",
    "document-analyze",
    "route.js.nft.json"
  );

const isolatedRoot =
  join(
    tmpdir(),
    "production-trace-test"
  );

const childSource = String.raw`
const { createRequire } = require("node:module");
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");

(async () => {
  const isolatedRoot = process.cwd();
  const isolatedRequire = createRequire(path.join(isolatedRoot, "package.json"));
  const { createWorker } = isolatedRequire("tesseract.js");
  const tesseractMain = isolatedRequire.resolve("tesseract.js");
  const workerPath = path.join(path.dirname(tesseractMain), "worker-script", "node", "index.js");
  const startedAt = performance.now();
  const phases = [];
  let lastPhase = "";

  const worker = await createWorker(["tur", "eng"], undefined, {
    workerPath,
    langPath: isolatedRoot,
    gzip: false,
    cacheMethod: "none",
    logger: ({ status }) => {
      if (![
        "loading tesseract core",
        "initializing tesseract",
        "loading language traineddata",
        "initializing api",
      ].includes(status) || status === lastPhase) {
        return;
      }
      lastPhase = status;
      phases.push({ phase: status, elapsedMs: Number((performance.now() - startedAt).toFixed(2)) });
    },
  });

  const readyMs = Number((performance.now() - startedAt).toFixed(2));
  const jpeg = fs.readFileSync(0);

  const ocrStartedAt = performance.now();
  const result = await worker.recognize(jpeg);
  const ocrMs = Number((performance.now() - ocrStartedAt).toFixed(2));
  await worker.terminate();

  const text = String(result?.data?.text || "");
  const fileNoMatch = text.match(/2026\s*\/\s*52/iu);
  const courtMatch = text.match(/[İI]ZM[İI]R\s+23\s+ASL[İI]YE\s+HUKUK\s+MAHKEMES[İI]/iu);

  if (!fileNoMatch || !courtMatch) {
    throw new Error("Structured OCR fields were not extracted from the isolated fixture.");
  }

  process.stdout.write(JSON.stringify({
    workerReady: true,
    readyMs,
    ocrMs,
    jpegBytes: jpeg.length,
    dimensions: "2400x1600",
    languages: ["tur", "eng"],
    phases,
    structured: {
      court: "IZMIR 23 ASLIYE HUKUK MAHKEMESI",
      fileNo: "2026/52",
    },
  }));
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
`;

test(
  "document-analyze NFT trace boots Tesseract and performs OCR in isolation",
  {
    timeout: 120_000,
  },
  async (context) => {
    const svg =
      Buffer.from(
        '<svg width="2400" height="1600" xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="100%" height="100%" fill="white"/>' +
        '<text x="120" y="280" font-family="Arial" font-size="100" font-weight="700">T.C. IZMIR 23 ASLIYE HUKUK MAHKEMESI</text>' +
        '<text x="120" y="560" font-family="Arial" font-size="100" font-weight="700">DOSYA NO 2026/52 ESAS</text>' +
        '<text x="120" y="840" font-family="Arial" font-size="100">DAVACI OZAN YARALI</text>' +
        '</svg>'
      );

    const jpeg =
      await sharp({
        create: {
          width: 2400,
          height: 1600,
          channels: 3,
          background:
            "white",
        },
      })
        .composite([
          {
            input:
              svg,
          },
        ])
        .jpeg({
          quality: 92,
        })
        .toBuffer();

    const trace =
      JSON.parse(
        await readFile(
          tracePath,
          "utf8"
        )
      );

    const traceDirectory =
      dirname(
        tracePath
      );

    await rm(
      isolatedRoot,
      {
        recursive: true,
        force: true,
      }
    );

    await mkdir(
      isolatedRoot,
      {
        recursive: true,
      }
    );

    let copiedBytes =
      0;

    const copied =
      new Set();

    for (
      const traceEntry
      of trace.files
    ) {
      const source =
        resolve(
          traceDirectory,
          traceEntry
        );

      const projectRelative =
        relative(
          projectRoot,
          source
        );

      assert.equal(
        isAbsolute(
          projectRelative
        ) ||
        projectRelative.startsWith(
          ".."
        ),
        false,
        `Trace file escaped project root: ${source}`
      );

      if (
        copied.has(
          projectRelative
        )
      ) {
        continue;
      }

      copied.add(
        projectRelative
      );

      const destination =
        join(
          isolatedRoot,
          projectRelative
        );

      await mkdir(
        dirname(
          destination
        ),
        {
          recursive: true,
        }
      );

      await cp(
        source,
        destination
      );

      copiedBytes +=
        (
          await stat(
            source
          )
        ).size;
    }

    const child =
      spawnSync(
        process.execPath,
        [
          "-e",
          childSource,
        ],
        {
          cwd:
            isolatedRoot,
          encoding:
            "utf8",
          input:
            jpeg,
          env: {
            PATH:
              process.env.PATH ||
              "",
            SystemRoot:
              process.env.SystemRoot ||
              "",
            TEMP:
              process.env.TEMP ||
              tmpdir(),
            TMP:
              process.env.TMP ||
              tmpdir(),
          },
          timeout:
            90_000,
        }
      );

    assert.doesNotMatch(
      `${child.stdout}\n${child.stderr}`,
      /MODULE_NOT_FOUND/iu
    );

    assert.equal(
      child.status,
      0,
      child.stderr ||
      child.stdout
    );

    const result =
      JSON.parse(
        child.stdout
      );

    assert.equal(
      result.workerReady,
      true
    );

    assert.deepEqual(
      result.languages,
      [
        "tur",
        "eng",
      ]
    );

    assert.deepEqual(
      result.phases.map(
        (item) =>
          item.phase
      ),
      [
        "loading tesseract core",
        "initializing tesseract",
        "loading language traineddata",
        "initializing api",
      ]
    );

    assert.equal(
      result.structured.fileNo,
      "2026/52"
    );

    assert.match(
      result.structured.court,
      /IZMIR 23 ASLIYE HUKUK MAHKEMESI/iu
    );

    context.diagnostic(
      `ISOLATED_OCR_TRACE ${JSON.stringify({
        fileCount:
          copied.size,
        bytes:
          copiedBytes,
        ...result,
        moduleNotFound:
          0,
      })}`
    );

    await rm(
      isolatedRoot,
      {
        recursive: true,
        force: true,
      }
    );
  }
);
