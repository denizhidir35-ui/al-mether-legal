import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  extractUetsCaseValueFields,
  extractUetsPaymentFields,
  extractUetsResultAndRequest,
} from "../lib/legal/uetsPdfFields.ts";

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
});
