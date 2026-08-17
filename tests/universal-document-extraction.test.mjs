import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PDFDocument,
  StandardFonts,
} from "pdf-lib";
import {
  createCanvas,
} from "@napi-rs/canvas";

import {
  classifyLegalDocument,
  LEGAL_DOCUMENT_TYPE_LABELS,
  resolveDocumentExtractionProfile,
} from "../lib/legal/documentType.ts";
import {
  createLegalPdfPagePlan,
  extractLegalPdfText,
} from "../lib/legal/ocr.ts";
import {
  extractUetsAddresseeCourt,
  extractUetsCaseValueFields,
  extractUetsDocumentDate,
  extractUetsExplicitDeadlines,
  extractUetsHearingFields,
  extractUetsInterimMeasureRequested,
  extractUetsLawyers,
  extractUetsPartiesAndSubject,
  extractUetsPaymentFields,
  extractUetsResultAndRequest,
} from "../lib/legal/uetsPdfFields.ts";

async function createTextPdf(
  pageTexts
) {
  const pdf =
    await PDFDocument.create();
  const font =
    await pdf.embedFont(
      StandardFonts.Helvetica
    );

  for (const text of pageTexts) {
    const page = pdf.addPage([
      595,
      842,
    ]);
    page.drawText(text, {
      x: 40,
      y: 790,
      size: 10,
      font,
      maxWidth: 510,
      lineHeight: 14,
    });
  }

  return Buffer.from(
    await pdf.save()
  );
}

function createOcrImage(
  text
) {
  const canvas =
    createCanvas(1600, 1000);
  const context =
    canvas.getContext("2d");

  context.fillStyle = "white";
  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );
  context.fillStyle = "black";
  context.font = "bold 64px Arial";
  context.fillText(
    text,
    90,
    260
  );
  context.font = "42px Arial";
  context.fillText(
    "This page requires optical character recognition.",
    90,
    350
  );

  return canvas.toBuffer("image/png");
}

async function createImagePdf({
  includeTextPage = false,
} = {}) {
  const pdf =
    await PDFDocument.create();

  if (includeTextPage) {
    const font =
      await pdf.embedFont(
        StandardFonts.Helvetica
      );
    const page = pdf.addPage([
      595,
      842,
    ]);
    page.drawText(
      "SELECTABLE LEGAL TEXT PAGE WITH ENOUGH CONTENT TO SKIP OCR COMPLETELY.",
      {
        x: 40,
        y: 790,
        size: 10,
        font,
        maxWidth: 510,
      }
    );
  }

  const image = await pdf.embedPng(
    createOcrImage(
      "SCANNED LEGAL PAGE"
    )
  );
  const scannedPage = pdf.addPage([
    595,
    842,
  ]);
  scannedPage.drawImage(image, {
    x: 20,
    y: 230,
    width: 555,
    height: 347,
  });

  return Buffer.from(
    await pdf.save()
  );
}

const petitionText = `
ANKARA NÖBETÇİ AİLE MAHKEMESİ SAYIN HAKİMLİĞİ'NE
DAVACI: Sebahat KELEBEK
DAVALI: Soner KELEBEK
VEKİLİ: Av. Rahman AKINCI
KONU: Mal rejiminin tasfiyesi talebidir.
DAVA DEĞERİ: 30.050 TL
AÇIKLAMALAR
Ankara 23. Aile Mahkemesi 2024/272 E. sayılı dosyadan söz edilmiştir.
Bilirkişi incelemesi yapılmasını ve 10.000 TL alacağın tahsilini talep ederiz.
SONUÇ VE İSTEM:
Davanın kabulüne karar verilmesini talep ederiz.
`;

test("1, 3 and 10+ page text-layer PDFs preserve ordered page sources", async () => {
  for (const pageCount of [
    1,
    3,
    12,
  ]) {
    const pageTexts =
      Array.from(
        { length: pageCount },
        (_, index) =>
          `PAGE_${index + 1} legal document text with enough content for deterministic text layer extraction.`
      );
    const result =
      await extractLegalPdfText(
        await createTextPdf(
          pageTexts
        )
      );

    assert.equal(
      result.engine,
      "pdf-text"
    );

    for (
      let index = 0;
      index < pageCount;
      index += 1
    ) {
      assert.match(
        result.text,
        new RegExp(
          `--- SAYFA ${index + 1} ---[\\s\\S]*?PAGE_${index + 1}`
        )
      );
    }
  }
});

test("mixed PDF plan OCRs only pages without a useful text layer", () => {
  const plan =
    createLegalPdfPagePlan([
      "First page contains a complete selectable legal text layer.",
      "",
      "Third page also contains selectable text and must skip OCR.",
    ]);

  assert.deepEqual(
    plan.map((item) => ({
      pageNumber: item.pageNumber,
      requiresOcr: item.requiresOcr,
    })),
    [
      {
        pageNumber: 1,
        requiresOcr: false,
      },
      {
        pageNumber: 2,
        requiresOcr: true,
      },
      {
        pageNumber: 3,
        requiresOcr: false,
      },
    ]
  );
});

test("scanned and mixed PDFs use full or page-selective OCR", async () => {
  const scanned =
    await extractLegalPdfText(
      await createImagePdf()
    );
  assert.equal(
    scanned.engine,
    "tesseract"
  );
  assert.match(
    scanned.text,
    /SCANNED LEGAL PAGE/iu
  );

  const mixed =
    await extractLegalPdfText(
      await createImagePdf({
        includeTextPage: true,
      })
    );
  assert.equal(
    mixed.engine,
    "pdf-hybrid"
  );
  assert.match(
    mixed.text,
    /--- SAYFA 1 ---[\s\S]*?SELECTABLE LEGAL TEXT/iu
  );
  assert.match(
    mixed.text,
    /--- SAYFA 2 ---[\s\S]*?SCANNED LEGAL PAGE/iu
  );
});

test("multi-page result/request context continues across page boundaries", () => {
  const text = `
    SONUÇ VE İSTEM:
    Yukarıda açıklanan nedenlerle davanın kabulüne,
    --- SAYFA 10 ---
    yargılama giderleri ile vekalet ücretinin karşı tarafa yükletilmesine
    karar verilmesini talep ederiz.
    DAVACI VEKİLİ
  `;
  const result =
    extractUetsResultAndRequest(text);

  assert.match(
    result,
    /davanın kabulüne/iu
  );
  assert.match(
    result,
    /yargılama giderleri/iu
  );
  assert.doesNotMatch(
    result,
    /DAVACI VEKİLİ/iu
  );
});

test("Rahman 7-page petition keeps exact fields without invented case/payment/date", async () => {
  const bytes = await readFile(
    new URL(
      "./fixtures/rahman-real-petition.pdf",
      import.meta.url
    )
  );
  const extraction =
    await extractLegalPdfText(bytes);
  const classification =
    classifyLegalDocument(
      extraction.text
    );
  const parties =
    extractUetsPartiesAndSubject(
      extraction.text
    );
  const payment =
    extractUetsPaymentFields(
      extraction.text,
      "rahman-real-petition.pdf"
    );

  assert.match(
    extraction.text,
    /--- SAYFA 7 ---/u
  );
  assert.equal(
    classification.documentType,
    "petition"
  );
  assert.ok(
    classification.documentTypeConfidence >=
      0.8
  );
  assert.equal(
    extractUetsAddresseeCourt(
      extraction.text
    ),
    "Ankara Nöbetçi Aile Mahkemesi"
  );
  assert.equal(
    parties.plaintiff,
    "Sebahat KELEBEK"
  );
  assert.equal(
    parties.defendant,
    "Soner KELEBEK"
  );
  assert.deepEqual(
    extractUetsLawyers(
      extraction.text
    ),
    [
      "Av. Muhammed AVCI",
      "Av. Rahman AKINCI",
    ]
  );
  assert.deepEqual(
    extractUetsCaseValueFields(
      extraction.text
    ),
    {
      caseValue: 30050,
      caseValueCurrency: "TRY",
    }
  );
  assert.equal(
    extractUetsDocumentDate(
      extraction.text
    ),
    "2024-05-15"
  );
  assert.equal(
    extractUetsInterimMeasureRequested(
      extraction.text
    ),
    true
  );
  assert.ok(
    extractUetsResultAndRequest(
      extraction.text
    )
  );
  assert.equal(
    payment.paymentAmount,
    null
  );
  assert.equal(
    payment.paymentDueDate,
    ""
  );
  assert.equal(
    extractUetsHearingFields(
      extraction.text
    ).found,
    false
  );
  assert.deepEqual(
    extractUetsExplicitDeadlines(
      extraction.text
    ),
    []
  );
});

test("document type is deterministic but never gates the common field pass", async () => {
  const route = await readFile(
    new URL(
      "../app/api/uets/document-analyze/route.ts",
      import.meta.url
    ),
    "utf8"
  );
  const classification =
    classifyLegalDocument(
      petitionText
    );

  assert.equal(
    classification.documentType,
    "petition"
  );
  assert.equal(
    resolveDocumentExtractionProfile(
      classification.documentType
    ),
    "petition"
  );
  assert.match(
    route,
    /classifyLegalDocument\(text\)[\s\S]*?extractUetsNotice\(text\)[\s\S]*?extractUetsHearingFields\([\s\S]*?extractUetsPaymentFields\([\s\S]*?extractUetsCaseValueFields\(/
  );
  assert.doesNotMatch(
    route,
    /extractUetsNotice\(\s*extractionProfile\s*===/
  );
  assert.match(
    route,
    /extractFileNo\(\s*text,\s*extractionProfile !== "petition"\s*\)/
  );
});

test("UETS fixtures retain type, hearing, deadline and payment date roles", () => {
  for (const fileNo of [
    "2026/52",
    "2026/318",
    "2026/427",
    "2026/742",
    "2026/1337",
  ]) {
    const text = `
      PTT UETS ELEKTRONİK TEBLİGAT
      Dosya No: ${fileNo}
      Barkod No: 5003009126745
      UETS teslim tarihi: 17.08.2026 09:12
      Tebliğ edilmiş sayılma tarihi: 22.08.2026 23:59
      Duruşma tarihi: 15.10.2026
      Duruşma saati: 10:30
      Açık/kesin son tarih: 07.09.2026
      Gider Avansı: 3.250,00 TL
      Son ödeme tarihi: 10.09.2026
    `;
    const classification =
      classifyLegalDocument(text);
    const hearing =
      extractUetsHearingFields(text);
    const deadlines =
      extractUetsExplicitDeadlines(text);
    const payment =
      extractUetsPaymentFields(
        text,
        `${fileNo}.pdf`
      );

    assert.equal(
      classification.documentType,
      "uets_notification",
      fileNo
    );
    assert.equal(
      hearing.date,
      "2026-10-15",
      fileNo
    );
    assert.equal(
      hearing.time,
      "10:30",
      fileNo
    );
    assert.equal(
      deadlines[0]?.explicitDate,
      "2026-09-07",
      fileNo
    );
    assert.equal(
      payment.paymentDueDate,
      "2026-09-10",
      fileNo
    );
  }
});

test("ambiguous money and expert words do not override petition or create payment", () => {
  const classification =
    classifyLegalDocument(
      petitionText
    );
  const payment =
    extractUetsPaymentFields(
      petitionText,
      "petition.pdf"
    );

  assert.equal(
    classification.documentType,
    "petition"
  );
  assert.notEqual(
    classification.documentType,
    "expert_report"
  );
  assert.notEqual(
    classification.documentType,
    "enforcement_payment_order"
  );
  assert.equal(
    payment.paymentAmount,
    null
  );
  assert.deepEqual(
    classifyLegalDocument(
      "Dosyada bilirkişi incelemesi yapılması ve ödeme değerlendirilmesi talep edilmiştir."
    ),
    {
      documentType: "unknown",
      documentTypeConfidence: 0,
    }
  );
});

test("all explicit supported structures and unknown fallback have labels", () => {
  const fixtures = [
    [
      "DURUŞMA TUTANAĞI\nCELSE NO: 2\nHAZIR BULUNAN taraflar",
      "hearing_minutes",
    ],
    [
      "GEREKÇELİ KARAR\nGEREĞİ DÜŞÜNÜLDÜ\nHÜKÜM:",
      "reasoned_decision",
    ],
    [
      "TENSİP TUTANAĞI\nARA KARAR:",
      "interim_order",
    ],
    [
      "BİLİRKİŞİ RAPORU\nBİLİRKİŞİ KURULU\nİNCELEME VE DEĞERLENDİRME",
      "expert_report",
    ],
    [
      "ÖDEME EMRİ\nANKARA İCRA DAİRESİ\nALACAKLI: A\nBORÇLU: B",
      "enforcement_payment_order",
    ],
    [
      "Genel hukuki belge metni ve açıklamalar.",
      "unknown",
    ],
  ];

  for (const [text, expected] of fixtures) {
    const result =
      classifyLegalDocument(text);
    assert.equal(
      result.documentType,
      expected
    );
    assert.ok(
      LEGAL_DOCUMENT_TYPE_LABELS[
        result.documentType
      ]
    );
  }
});

test("payload aliases and grouped editable preview expose universal fields", async () => {
  const route = await readFile(
    new URL(
      "../app/api/uets/document-analyze/route.ts",
      import.meta.url
    ),
    "utf8"
  );
  const cases = await readFile(
    new URL(
      "../app/cases/page.tsx",
      import.meta.url
    ),
    "utf8"
  );

  for (const field of [
    "documentType",
    "documentTypeConfidence",
    "caseNumber",
    "plaintiff",
    "defendant",
    "hearingDate",
    "hearingTime",
    "explicitDeadline",
    "paymentAmount",
    "paymentDueDate",
    "periodText",
    "deliveryDate",
    "deemedServiceDate",
    "sourceDocument",
  ]) {
    assert.match(
      route,
      new RegExp(`${field}:`)
    );
  }

  assert.match(
    cases,
    /document-type-badge[\s\S]*?Belge Türü:/
  );
  assert.match(
    cases,
    /DAVA \/ BELGE BİLGİLERİ[\s\S]*?TAKVİM \/ KRİTİK İŞLEMLER/
  );
  assert.match(
    cases,
    /paymentPeriodText &&[\s\S]*?!documentPreview\.paymentDueDate[\s\S]*?son tarih oluşturulmadı/
  );
});
