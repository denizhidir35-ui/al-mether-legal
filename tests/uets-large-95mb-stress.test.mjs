import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { performance } from "node:perf_hooks";
import test from "node:test";

import {
  decodeUetsPdf,
  MAX_UETS_PDF_BYTES,
} from "../lib/legal/uetsPdfValidation.ts";
import {
  extractUetsDecisionNo,
  extractUetsPartiesAndSubject,
  extractUetsPaymentFields,
} from "../lib/legal/uetsPdfFields.ts";
import { extractUetsNotice } from "../lib/legal/uetsExtractor.ts";
import { extractLegalPdfText } from "../lib/legal/ocr.ts";

const fixtureUrl = new URL(
  "./fixtures/uets-large-95mb.pdf",
  import.meta.url
);

test(
  "95 MB UETS PDF validation, text extraction and structured analysis",
  { timeout: 120_000 },
  async (context) => {
    const readStarted = performance.now();
    const fileBytes = await readFile(fixtureUrl);
    const readMs = performance.now() - readStarted;

    assert.equal(
      fileBytes.subarray(0, 5).toString(),
      "%PDF-"
    );
    assert.ok(fileBytes.length < MAX_UETS_PDF_BYTES);
    assert.ok(fileBytes.length >= 94_000_000);
    assert.ok(fileBytes.length <= 96_000_000);

    const validationStarted = performance.now();
    const decoded = decodeUetsPdf(
      fileBytes.toString("base64")
    );
    const validationMs =
      performance.now() - validationStarted;

    assert.ok(decoded);
    assert.equal(decoded.length, fileBytes.length);

    const extractionStarted = performance.now();
    const extraction =
      await extractLegalPdfText(decoded);
    const extractionMs =
      performance.now() - extractionStarted;

    assert.equal(extraction.engine, "pdf-text");
    assert.ok(extraction.text.trim().length > 30);
    assert.match(
      extraction.text,
      /23\. ASLİYE HUKUK MAHKEMESİ/iu
    );
    assert.match(
      extraction.text,
      /1\.500,00 TL istinaf avansının/iu
    );

    const analysisStarted = performance.now();
    const notice = extractUetsNotice(extraction.text);
    const decisionNo =
      extractUetsDecisionNo(extraction.text);
    const partyAndSubject =
      extractUetsPartiesAndSubject(extraction.text);
    const payment = extractUetsPaymentFields(
      extraction.text,
      basename(fixtureUrl.pathname)
    );
    const analysisMs =
      performance.now() - analysisStarted;

    assert.equal(
      notice.court,
      "İzmir 23. Asliye Hukuk Mahkemesi"
    );
    assert.equal(notice.fileNo, "2026/52");
    assert.equal(decisionNo, "2026/255");
    assert.equal(notice.barcodeNo, "5003003284830");
    assert.match(
      partyAndSubject.parties,
      /OZAN YARALI/iu
    );
    assert.equal(payment.paymentAmount, 1500);
    assert.equal(payment.paymentCurrency, "TRY");
    assert.match(
      payment.paymentDescription,
      /İstinaf avansı/iu
    );
    assert.equal(
      payment.paymentPeriodText,
      "iki haftalık süre içerisinde"
    );
    assert.equal(
      payment.sourceDocument,
      "uets-large-95mb.pdf"
    );
    assert.equal(payment.paymentDueDate, "");

    context.diagnostic(
      `UETS_STRUCTURED ${JSON.stringify({
        court: notice.court,
        fileNo: notice.fileNo,
        decisionNo,
        parties: partyAndSubject.parties,
        subject: partyAndSubject.subject,
        barcodeNo: notice.barcodeNo,
        ...payment,
      })}`
    );

    const metrics = {
      exactBytes: fileBytes.length,
      readMs: Number(readMs.toFixed(2)),
      validationMs: Number(validationMs.toFixed(2)),
      extractionMs: Number(extractionMs.toFixed(2)),
      analysisMs: Number(analysisMs.toFixed(2)),
      engine: extraction.engine,
      textLength: extraction.text.length,
      rssMb: Number(
        (
          process.memoryUsage().rss /
          1024 /
          1024
        ).toFixed(2)
      ),
    };

    context.diagnostic(
      `UETS_LARGE_METRICS ${JSON.stringify(metrics)}`
    );
  }
);

test(
  "exactly 100 MB remains valid at the UETS boundary",
  { timeout: 120_000 },
  () => {
    const boundary =
      Buffer.alloc(MAX_UETS_PDF_BYTES);
    boundary.write("%PDF-1.7", 0, "ascii");

    const decoded = decodeUetsPdf(
      boundary.toString("base64")
    );

    assert.ok(decoded);
    assert.equal(
      decoded.length,
      MAX_UETS_PDF_BYTES
    );
  }
);
