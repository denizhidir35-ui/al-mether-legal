import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import test from "node:test";

import sharp from "sharp";

import {
  LegalImageNormalizationError,
  normalizeLegalImageForOcr,
  OCR_IMAGE_MAX_DIMENSION,
  resolveLegalImageMimeType,
} from "../lib/legal/imageNormalization.ts";
import {
  extractLegalImageText,
  getLegalImageOcrDiagnostics,
  resetLegalImageOcrWorkerForTests,
} from "../lib/legal/ocr.ts";
import {
  extractUetsNotice,
} from "../lib/legal/uetsExtractor.ts";

const casesSource =
  await readFile(
    new URL(
      "../app/cases/page.tsx",
      import.meta.url
    ),
    "utf8"
  );

const analysisRoute =
  await readFile(
    new URL(
      "../app/api/uets/document-analyze/route.ts",
      import.meta.url
    ),
    "utf8"
  );

const clientOptimizationSource =
  await readFile(
    new URL(
      "../lib/legal/clientImageOptimization.ts",
      import.meta.url
    ),
    "utf8"
  );

const ocrSource =
  await readFile(
    new URL(
      "../lib/legal/ocr.ts",
      import.meta.url
    ),
    "utf8"
  );

const nextConfigSource =
  await readFile(
    new URL(
      "../next.config.ts",
      import.meta.url
    ),
    "utf8"
  );

async function createTextFixture(
  width,
  height,
  format = "jpeg"
) {
  const fontSize =
    Math.max(
      72,
      Math.round(width / 24)
    );
  const svg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white" />
      <text x="5%" y="15%" font-family="Arial" font-size="${fontSize}" font-weight="700" fill="black">PTT UETS ELEKTRONIK TEBLIGAT</text>
      <text x="5%" y="35%" font-family="Arial" font-size="${fontSize}" font-weight="700" fill="black">IZMIR 23 ASLIYE HUKUK MAHKEMESI</text>
      <text x="5%" y="55%" font-family="Arial" font-size="${fontSize}" font-weight="700" fill="black">DOSYA NO 2026/52 ESAS</text>
      <text x="5%" y="75%" font-family="Arial" font-size="${fontSize}" fill="black">DAVACI OZAN YARALI</text>
    </svg>
  `);

  const pipeline =
    sharp({
      create: {
        width,
        height,
        channels: 3,
        background: "white",
      },
    }).composite([{ input: svg }]);

  return format === "png"
    ? pipeline.png().toBuffer()
    : pipeline.jpeg({ quality: 94 }).toBuffer();
}

test("4000+ px JPEG is orientation-safe and reduced for OCR", async () => {
  const fixture =
    await createTextFixture(
      4200,
      2800
    );
  const result =
    await normalizeLegalImageForOcr(
      fixture,
      "image/jpeg"
    );

  assert.equal(
    result.originalWidth,
    4200
  );
  assert.equal(
    result.originalHeight,
    2800
  );
  assert.equal(result.width, 2400);
  assert.equal(result.height, 1600);
  assert.equal(
    Math.max(result.width, result.height),
    OCR_IMAGE_MAX_DIMENSION
  );
  assert.equal(
    result.mimeType,
    "image/jpeg"
  );
  assert.ok(
    result.bytes.length < fixture.length
  );
});

test("PNG is converted to an OCR-compatible RGB JPEG", async () => {
  const fixture =
    await createTextFixture(
      3000,
      1800,
      "png"
    );
  const result =
    await normalizeLegalImageForOcr(
      fixture,
      "image/png"
    );
  const metadata =
    await sharp(result.bytes).metadata();

  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.space, "srgb");
  assert.equal(metadata.channels, 3);
  assert.equal(result.width, 2400);
  assert.equal(result.height, 1440);
});

test("EXIF orientation is applied before resize", async () => {
  const fixture =
    await sharp({
      create: {
        width: 4000,
        height: 2000,
        channels: 3,
        background: "white",
      },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
  const result =
    await normalizeLegalImageForOcr(
      fixture,
      "image/jpeg"
    );

  assert.equal(result.orientation, 6);
  assert.equal(result.width, 1200);
  assert.equal(result.height, 2400);
});

test("HEIC/HEIF is inferred and unsupported input gets a clear error", async () => {
  assert.equal(
    resolveLegalImageMimeType(
      "",
      "iphone-photo.HEIC"
    ),
    "image/heic"
  );

  await assert.rejects(
    normalizeLegalImageForOcr(
      Buffer.from("unsupported-heic"),
      "image/heic"
    ),
    (error) => {
      assert.ok(
        error instanceof
          LegalImageNormalizationError
      );
      assert.match(
        error.message,
        /HEIC\/HEIF.*JPEG/iu
      );
      return true;
    }
  );
});

test(
  "normalized camera JPEG completes OCR and structured extraction",
  { timeout: 60_000 },
  async (context) => {
    await resetLegalImageOcrWorkerForTests();

    const fixture =
      await createTextFixture(
        4200,
        2800
      );
    const normalized =
      await normalizeLegalImageForOcr(
        fixture,
        "image/jpeg"
      );
    const started =
      performance.now();
    const ocr =
      await extractLegalImageText(
        normalized.bytes,
        normalized.mimeType
      );
    const durationMs =
      performance.now() - started;
    const structured =
      extractUetsNotice(ocr.text);

    const warmStarted =
      performance.now();
    const warmOcr =
      await extractLegalImageText(
        normalized.bytes,
        normalized.mimeType
      );
    const warmDurationMs =
      performance.now() -
      warmStarted;
    const diagnostics =
      getLegalImageOcrDiagnostics();

    assert.equal(ocr.engine, "tesseract");
    assert.match(ocr.text, /2026\s*\/\s*52/iu);
    assert.equal(
      structured.fileNo,
      "2026/52",
      ocr.text
    );
    assert.ok(durationMs < 45_000);
    assert.match(
      warmOcr.text,
      /2026\s*\/\s*52/iu
    );
    assert.equal(
      diagnostics.coldStarts,
      1
    );
    assert.equal(
      diagnostics.warmHits,
      1
    );
    assert.deepEqual(
      diagnostics.languages,
      ["tur", "eng"]
    );
    assert.equal(
      diagnostics.languageSource,
      "local-bundle"
    );
    assert.equal(
      diagnostics.lastInitPhase,
      "ready"
    );
    assert.ok(
      diagnostics.lastInitMs <
        12_000
    );

    context.diagnostic(
      `MOBILE_OCR_METRICS ${JSON.stringify({
        inputBytes: fixture.length,
        normalizedBytes:
          normalized.bytes.length,
        inputDimensions: "4200x2800",
        normalizedDimensions:
          `${normalized.width}x${normalized.height}`,
        ocrMs:
          Number(durationMs.toFixed(2)),
        warmOcrMs:
          Number(warmDurationMs.toFixed(2)),
        coldInitMs:
          diagnostics.lastInitMs,
      })}`
    );

    await resetLegalImageOcrWorkerForTests();
  }
);

test("image OCR assets and JSON error boundary are production-wired", async () => {
  const [
    englishData,
    turkishData,
  ] =
    await Promise.all([
      readFile(
        new URL(
          "../eng.traineddata",
          import.meta.url
        )
      ),
      readFile(
        new URL(
          "../tur.traineddata",
          import.meta.url
        )
      ),
    ]);

  assert.ok(
    englishData.length >
      1_000_000
  );
  assert.ok(
    turkishData.length >
      1_000_000
  );
  assert.match(
    ocrSource,
    /langPath[\s\S]*?gzip:\s*false[\s\S]*?cacheMethod:\s*"none"/
  );
  assert.match(
    ocrSource,
    /OCR motoru hazırlanırken zaman aşımına uğradı\./
  );
  assert.match(
    ocrSource,
    /Görsel OCR işlemi zaman aşımına uğradı\./
  );
  assert.match(
    nextConfigSource,
    /"\/api\/uets\/document-analyze"[\s\S]*?eng\.traineddata[\s\S]*?tur\.traineddata[\s\S]*?tesseract\.js-core/
  );
  assert.match(
    analysisRoute,
    /catch\s*\(error\)[\s\S]*?NextResponse\.json\([\s\S]*?status:\s*500/
  );
});

test("camera inputs and same-file reselect reset remain wired", () => {
  assert.match(
    casesSource,
    /accept="image\/\*"[\s\S]*?capture="environment"/
  );
  assert.match(
    casesSource,
    /files\?\.\[0\][\s\S]*?event\.currentTarget\.value\s*=\s*""[\s\S]*?analyzeCaseDocument/
  );
  assert.match(
    casesSource,
    /optimizeCaseImageForAnalysis/
  );
  assert.match(
    clientOptimizationSource,
    /createImageBitmap[\s\S]*?new Image\(\)[\s\S]*?URL\.revokeObjectURL/
  );
});

test("mobile image failures return JSON before the 60 second gateway limit", () => {
  assert.match(
    analysisRoute,
    /normalizeLegalImageForOcr\([\s\S]*?NextResponse\.json\([\s\S]*?status:\s*422/
  );
  assert.match(
    analysisRoute,
    /export const maxDuration = 60/
  );
  assert.match(
    casesSource,
    /readJsonResponse\(\s*response\s*\)/
  );
});
