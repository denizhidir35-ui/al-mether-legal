import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MAX_UETS_PDF_BYTES,
  validateUetsPdfBytes,
} from "../lib/legal/uetsPdfValidation.ts";
import {
  extractLegalPdfText,
  PdfTextLayerRuntimeError,
} from "../lib/legal/ocr.ts";

const casesSource = await readFile(
  new URL(
    "../app/cases/page.tsx",
    import.meta.url
  ),
  "utf8"
);

const analysisRoute = await readFile(
  new URL(
    "../app/api/uets/document-analyze/route.ts",
    import.meta.url
  ),
  "utf8"
);

const imageNormalizationSource =
  await readFile(
    new URL(
      "../lib/legal/imageNormalization.ts",
      import.meta.url
    ),
    "utf8"
  );

const casesRoute = await readFile(
  new URL(
    "../app/api/cases/route.ts",
    import.meta.url
  ),
  "utf8"
);

const fromAnalysisRoute = await readFile(
  new URL(
    "../app/api/cases/from-analysis/route.ts",
    import.meta.url
  ),
  "utf8"
);

test("multipart text-layer PDF uses the existing large PDF parser", () => {
  const bytes = Buffer.from(
    "%PDF-1.7\nlegal fixture"
  );

  assert.equal(
    validateUetsPdfBytes(bytes),
    bytes
  );
  assert.equal(
    MAX_UETS_PDF_BYTES,
    100_000_000
  );
  assert.match(
    analysisRoute,
    /validateUetsPdfBytes\([\s\S]*?extractLegalPdfText\(/
  );
});

test("scanned PDF keeps the existing OCR fallback", async () => {
  const ocrSource = await readFile(
    new URL(
      "../lib/legal/ocr.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    ocrSource,
    /extractEmbeddedPdfText\([\s\S]*?ocrPdfPages\(/
  );
  assert.match(
    ocrSource,
    /engine:\s*"tesseract"/
  );
  assert.match(
    ocrSource,
    /pdfjs-dist\/legacy\/build\/pdf\.worker\.mjs/
  );
  assert.doesNotMatch(
    ocrSource,
    /GlobalWorkerOptions\.workerSrc/
  );
});

test("PDF.js runtime errors do not fall through to OCR", async () => {
  await assert.rejects(
    extractLegalPdfText(
      Buffer.from(
        "%PDF-1.7\ninvalid xref",
        "ascii"
      )
    ),
    (error) => {
      assert.ok(
        error instanceof
          PdfTextLayerRuntimeError
      );
      assert.equal(
        error.message,
        "PDF metin katmanı sunucuda okunamadı. Lütfen dosyayı yeniden deneyin."
      );
      return true;
    }
  );
});

test("document analysis runtime failures remain JSON responses", () => {
  assert.match(
    analysisRoute,
    /catch \(error\)[\s\S]*?NextResponse\.json\([\s\S]*?status:\s*500/
  );
});

test("image upload uses the existing OCR engine", () => {
  assert.match(
    imageNormalizationSource,
    /image\/jpeg[\s\S]*?image\/png[\s\S]*?image\/webp/
  );
  assert.match(
    analysisRoute,
    /normalizeLegalImageForOcr\(\s*bytes,\s*imageMimeType\s*\)[\s\S]*?extractLegalImageText\(\s*normalizedImage\.bytes,\s*normalizedImage\.mimeType\s*\)/
  );
});

test("mobile camera and gallery inputs remain wired", () => {
  assert.match(
    casesSource,
    /accept="image\/\*"[\s\S]*?capture="environment"/
  );
  assert.match(
    casesSource,
    /Mobilden Fotoğraf Çek/
  );
  assert.match(
    casesSource,
    /Fotoğraf Seç/
  );
});

test("analysis is editable before either create action", () => {
  for (const field of [
    "court",
    "fileNo",
    "decisionNo",
    "parties",
    "lawyers",
    "subject",
    "hearingDate",
    "explicitDeadline",
    "caseValue",
    "caseValueCurrency",
    "resultAndRequest",
    "documentDate",
    "interimMeasureRequested",
    "paymentAmount",
    "paymentDescription",
    "paymentPeriodText",
    "sourceDocument",
  ]) {
    assert.match(
      casesSource,
      new RegExp(
        `updateDocumentPreview\\(\\s*"${field}"`
      )
    );
  }

  assert.match(
    casesSource,
    /Davayı Kaydet/
  );
  assert.match(
    casesSource,
    /Davayı Kaydet ve Takvime Ekle/
  );
  assert.match(
    analysisRoute,
    /lawyers,[\s\S]*?documentDate,[\s\S]*?interimMeasureRequested,/
  );
});

test("case, hearing, verified deadline and payment reminder use existing APIs", () => {
  assert.match(
    casesSource,
    /fetch\("\/api\/cases"/
  );
  assert.match(
    casesSource,
    /"\/api\/cases\/manual-calendar"/
  );
  assert.match(
    casesSource,
    /"\/api\/cases\/from-analysis"[\s\S]*?record_mode:[\s\S]*?"payment_deadline"/
  );
});

test("period-only evidence never creates an inferred deadline", () => {
  assert.match(
    casesSource,
    /paymentPeriodText &&[\s\S]*?!documentPreview\.paymentDueDate[\s\S]*?başlangıç tarihi doğrulanamadığı için son tarih oluşturulmadı/
  );
  assert.doesNotMatch(
    casesSource,
    /paymentPeriodText[\s\S]{0,180}new Date\(/
  );
});

test("document identity dedupe and case ownership are enforced", () => {
  assert.match(
    casesRoute,
    /document_upload:\$\{documentIdentity\}/
  );
  assert.match(
    casesRoute,
    /\.eq\(\s*"user_id",\s*appUser\.id\s*\)/
  );
  assert.match(
    fromAnalysisRoute,
    /requestedCaseId[\s\S]*?\.eq\(\s*"id",\s*requestedCaseId\s*\)[\s\S]*?\.eq\(\s*"user_id",\s*appUser\.id\s*\)/
  );
});

test("document preview collapses to one column on mobile", () => {
  assert.match(
    casesSource,
    /@media \(max-width: 760px\)[\s\S]*?\.document-preview-grid\s*\{[\s\S]*?grid-template-columns:\s*1fr/
  );
});

test("document preview Back closes to the case list without navigation or writes", () => {
  assert.match(
    casesSource,
    /documentPreview && \([\s\S]*?<LegalBackButton[\s\S]*?onBack=\{closeDocumentPreview\}/
  );
  assert.match(
    casesSource,
    /function closeDocumentPreview\(\)[\s\S]*?setDocumentOpen\(false\)[\s\S]*?setDocumentPreview\(null\)[\s\S]*?setDocumentFile\(null\)[\s\S]*?setDocumentAnalyzing\(false\)[\s\S]*?setDocumentFeedback\(""\)[\s\S]*?setError\(""\)/
  );

  const closeFunction =
    casesSource.match(
      /function closeDocumentPreview\(\) \{([\s\S]*?)\n  \}/
    )?.[1] || "";

  assert.doesNotMatch(
    closeFunction,
    /fetch\(|router\.|createDocumentCase|calendar|alarm/
  );
  assert.match(
    casesSource,
    /@media \(max-width: 760px\)[\s\S]*?\.document-preview-toolbar[\s\S]*?\.legal-back-button[\s\S]*?width: 100%/
  );
});
