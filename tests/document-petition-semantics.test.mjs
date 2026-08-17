import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

async function readPdfTextLayer(path) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = await readFile(path);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
  });
  const pdf = await loadingTask.promise;
  const pages = [];

  try {
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const parts = [];

      for (const item of content.items) {
        if (!("str" in item)) {
          continue;
        }

        if (item.str) {
          parts.push(String(item.str));
        }

        parts.push(item.hasEOL ? "\n" : " ");
      }

      pages.push(
        parts
          .join("")
          .replace(/\r/g, "")
          .replace(/[ \t]+/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim()
      );
    }
  } finally {
    await loadingTask.destroy();
  }

  return pages.join("\n\n--- SAYFA ---\n\n");
}

const petition = `
ANKARA 4. İŞ MAHKEMESİNE
DAVA DEĞERİ: 80.000,00 TL
KONU: Fazlaya ilişkin haklarımız saklı kalmak kaydıyla şimdilik 10.000 TL alacak talebidir.

AÇIKLAMALAR
Davalının eylemi nedeniyle 15.000 TL maddi ve 65.000 TL manevi tazminat talep edilmektedir.

SONUÇ VE İSTEM
Yukarıda açıklanan nedenlerle şimdilik 10.000 TL alacağın faiziyle davalıdan tahsiline,
yargılama giderleri ve vekalet ücretinin davalıya yükletilmesine karar verilmesini talep ederiz.

DAVACI VEKİLİ
`;

test("petition monetary claims are not payment obligations", () => {
  const payment = extractUetsPaymentFields(petition, "dava-dilekcesi.pdf");

  assert.equal(payment.paymentAmount, null);
  assert.equal(payment.paymentCurrency, "");
  assert.equal(payment.paymentDescription, "");
  assert.equal(payment.paymentDueDate, "");
  assert.equal(payment.paymentPeriodText, "");
});

test("a later real fee does not turn an earlier claim amount into payment", () => {
  const payment = extractUetsPaymentFields(
    `KONU: Şimdilik 10.000 TL alacak talebidir.\nGider avansı: 750,00 TL\nSon ödeme tarihi: 24.08.2026`,
    "tensip.pdf"
  );

  assert.equal(payment.paymentAmount, 750);
  assert.equal(payment.paymentDescription, "Gider avansı");
  assert.equal(payment.paymentDueDate, "2026-08-24");
});

test("extracts only explicitly labelled case value", () => {
  assert.deepEqual(extractUetsCaseValueFields(petition), {
    caseValue: 80000,
    caseValueCurrency: "TRY",
  });

  assert.deepEqual(
    extractUetsCaseValueFields("Talep edilen alacak şimdilik 10.000 TL'dir."),
    { caseValue: null, caseValueCurrency: "" }
  );
});

test("extracts result and request separately from payment description", () => {
  const resultAndRequest = extractUetsResultAndRequest(petition);
  const payment = extractUetsPaymentFields(petition, "dava-dilekcesi.pdf");

  assert.match(resultAndRequest, /şimdilik 10\.000 TL alacağın/iu);
  assert.match(resultAndRequest, /yargılama giderleri/iu);
  assert.doesNotMatch(resultAndRequest, /DAVACI VEKİLİ/iu);
  assert.notEqual(resultAndRequest, payment.paymentDescription);
});

test("supports every requested result/request heading variant", () => {
  for (const heading of [
    "SONUÇ VE İSTEM",
    "SONUÇ VE TALEP",
    "NETİCE VE TALEP",
  ]) {
    assert.equal(
      extractUetsResultAndRequest(`${heading}\nDavanın kabulüne karar verilmesini talep ederiz.`),
      "Davanın kabulüne karar verilmesini talep ederiz."
    );
  }
});

test("court addressee variants outrank related case references", () => {
  assert.equal(
    extractUetsAddresseeCourt(
      "İZMİR 4. İŞ MAHKEMESİ'NE\nAnkara 23. Aile Mahkemesi 2024/272 E."
    ),
    "İzmir 4. İş Mahkemesi"
  );
});

test("real Rahman petition extracts only the five missing fields", async () => {
  const text = await readPdfTextLayer(
    new URL("./fixtures/rahman-real-petition.pdf", import.meta.url)
  );
  const parties = extractUetsPartiesAndSubject(text);
  const payment = extractUetsPaymentFields(
    text,
    "rahman-real-petition.pdf"
  );
  const resultAndRequest = extractUetsResultAndRequest(text);

  assert.equal(
    extractUetsAddresseeCourt(text),
    "Ankara Nöbetçi Aile Mahkemesi"
  );
  assert.deepEqual(extractUetsLawyers(text), [
    "Av. Muhammed AVCI",
    "Av. Rahman AKINCI",
  ]);
  assert.equal(extractUetsDocumentDate(text), "2024-05-15");
  assert.equal(extractUetsInterimMeasureRequested(text), true);
  assert.match(resultAndRequest, /Yukarıda arz ve izah edilen/iu);
  assert.match(resultAndRequest, /Yargılama\s+giderleri/iu);
  assert.doesNotMatch(resultAndRequest, /DAVACI\s+VEKİLİ/iu);
  assert.doesNotMatch(resultAndRequest, /15\/05\/2024/u);

  assert.match(parties.parties, /Davacı:\s*Sebahat KELEBEK/iu);
  assert.match(parties.parties, /Davalı:\s*Soner KELEBEK/iu);
  assert.deepEqual(extractUetsCaseValueFields(text), {
    caseValue: 30050,
    caseValueCurrency: "TRY",
  });
  assert.equal(payment.paymentAmount, null);
  assert.equal(payment.paymentDueDate, "");
  assert.notEqual(resultAndRequest, payment.paymentDescription);
  assert.equal(extractUetsHearingFields(text).found, false);
  assert.deepEqual(extractUetsExplicitDeadlines(text), []);
  assert.match(text, /Ankara 23\. Aile Mahkemesi 2024\/272 E\./iu);
});

test("existing UETS payment contexts remain intact", () => {
  const fixtures = [
    ["2026/52", "İstinaf avansı 1.500,00 TL'nin iki haftalık süre içerisinde yatırılması gerekir.", 1500],
    ["2026/318", "Duruşma tarihi: 20.08.2026. Son tarih: 24.08.2026.", null],
    ["2026/427", "Gider Avansı: 3.250,00 TL\nSon ödeme tarihi: 10.09.2026", 3250],
    ["2026/742", "750,00 TL harcın 7 gün içinde yatırılması gerekmektedir.", 750],
    ["2026/1337", "Bilirkişi avansı 5.000,00 TL'nin mahkeme veznesine yatırılması gerekmektedir.", 5000],
  ];

  for (const [fileNo, body, expectedAmount] of fixtures) {
    const payment = extractUetsPaymentFields(
      `Dosya No: ${fileNo}\n${body}`,
      `${fileNo.replace("/", "-")}.pdf`
    );

    assert.equal(payment.paymentAmount, expectedAmount, fileNo);
  }
});

test("case value and result/request never participate in calendar conditions", async () => {
  const casesSource = await readFile(
    new URL("../app/cases/page.tsx", import.meta.url),
    "utf8"
  );
  const calendarLabelIndex = casesSource.indexOf(
    "Davayı Oluştur ve Takvime Ekle"
  );
  const calendarButtonIndex = casesSource.lastIndexOf(
    "<button",
    calendarLabelIndex
  );
  const calendarCondition = casesSource.slice(
    calendarButtonIndex,
    calendarLabelIndex
  );

  assert.ok(calendarCondition);
  assert.doesNotMatch(calendarCondition, /caseValue|resultAndRequest/);
  assert.doesNotMatch(
    calendarCondition,
    /lawyers|documentDate|interimMeasureRequested/
  );
});
