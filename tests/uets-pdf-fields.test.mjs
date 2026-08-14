import assert from "node:assert/strict";
import test from "node:test";

import {
  extractUetsBarcodeNo,
  extractUetsDateInformation,
  extractUetsDecisionNo,
  extractUetsExplicitDeadlines,
  extractUetsHearingFields,
  extractUetsPartiesAndSubject,
  extractUetsPaymentFields,
} from "../lib/legal/uetsPdfFields.ts";
import { extractUetsNotice } from "../lib/legal/uetsExtractor.ts";

test("extracts payment amount, currency, explicit due date and source", () => {
  const result = extractUetsPaymentFields(
    `Gider avansı olarak 12.450,75 TL yatırılması gerekmektedir.
     Son ödeme tarihi: 24.08.2026`,
    "Odeme-Emri.pdf"
  );

  assert.equal(result.paymentAmount, 12450.75);
  assert.equal(result.paymentCurrency, "TRY");
  assert.equal(result.paymentDueDate, "2026-08-24");
  assert.equal(result.paymentPeriodText, "");
  assert.equal(result.sourceDocument, "Odeme-Emri.pdf");
});

test("keeps a relative payment period without inventing a due date", () => {
  const result = extractUetsPaymentFields(
    "750,00 TL harcın 7 gün içinde yatırılması gerekmektedir.",
    "Harç Bildirimi.pdf"
  );

  assert.equal(result.paymentAmount, 750);
  assert.equal(result.paymentCurrency, "TRY");
  assert.equal(result.paymentPeriodText, "7 gün içinde");
  assert.equal(result.paymentDueDate, "");
});

test("extracts labelled parties and subject", () => {
  const result = extractUetsPartiesAndSubject(
    "Taraflar: A Kişisi / B Şirketi\nKonu: Alacak talebi"
  );

  assert.equal(result.parties, "A Kişisi / B Şirketi");
  assert.equal(result.subject, "Alacak talebi");
});

test("preserves labelled PDF date evidence", () => {
  const result = extractUetsDateInformation(
    "Tebligat tarihi: 13.08.2026\nSon işlem günü: 24.08.2026"
  );

  assert.deepEqual(
    result.map((item) => item.date),
    ["2026-08-13", "2026-08-24"]
  );
});

test("extracts the real UETS PDF payment period without inventing a due date", () => {
  const text = `
    İzmir 23. Asliye Hukuk Mahkemesi
    Esas No: 2026/52
    Karar No: 2026/255
    İstinaf avansı 1.500,00 TL'nin iki haftalık süre içerisinde yatırılması gerekir.
  `;
  const payment = extractUetsPaymentFields(text, "ustyazi (21).pdf");

  assert.equal(extractUetsDecisionNo(text), "2026/255");
  assert.equal(payment.paymentAmount, 1500);
  assert.equal(payment.paymentCurrency, "TRY");
  assert.equal(payment.paymentDescription, "İstinaf avansı");
  assert.equal(payment.paymentPeriodText, "iki haftalık süre içerisinde");
  assert.equal(payment.paymentDueDate, "");
  assert.equal(payment.sourceDocument, "ustyazi (21).pdf");
});

test("separates hearing, UETS, general deadline and payment date contexts", () => {
  const text = `
    PTT UETS Elektronik Tebligat
    E-Tebligat Barkod No: 5003009126745
    Kurum: İzmir 12. İş Mahkemesi
    Dosya No: 2026/427
    Karar No: 2026/693

    UETS teslim tarihi: 17.08.2026 09:12
    UETS açılma tarihi: 18.08.2026 10:06
    Tebliğ edilmiş sayılma tarihi: 22.08.2026 23:59

    Duruşması 15.10.2026 günü saat 10:30 yapılacaktır.
    Açık/kesin son tarih: 07.09.2026

    Gider Avansı: 3.250,00 TL
    Son ödeme tarihi: 10.09.2026
    Gider avansının tebliğ edilmiş sayılma tarihinden itibaren iki haftalık süre içerisinde yatırılması gerekir.
  `;

  const notice = extractUetsNotice(text);
  const hearing = extractUetsHearingFields(text);
  const deadlines = extractUetsExplicitDeadlines(text);
  const payment = extractUetsPaymentFields(text, "uets-multi-date.pdf");

  assert.equal(notice.court, "İzmir 12. İş Mahkemesi");
  assert.equal(notice.fileNo, "2026/427");
  assert.equal(extractUetsDecisionNo(text), "2026/693");
  assert.equal(extractUetsBarcodeNo(text), "5003009126745");
  assert.equal(hearing.date, "2026-10-15");
  assert.equal(hearing.time, "10:30");
  assert.notEqual(hearing.date, "2026-08-17");
  assert.deepEqual(
    deadlines.filter((item) => item.isExplicitFinalDate).map((item) => item.explicitDate),
    ["2026-09-07"]
  );
  assert.notEqual(deadlines[0]?.explicitDate, "2026-08-22");
  assert.equal(payment.paymentAmount, 3250);
  assert.equal(payment.paymentCurrency, "TRY");
  assert.equal(payment.paymentDescription, "Gider Avansı");
  assert.equal(payment.paymentDueDate, "2026-09-10");
  assert.match(
    payment.paymentPeriodText,
    /tebliğ edilmiş sayılma tarihinden itibaren iki haftalık süre içerisinde/iu
  );
});

test("keeps the existing 2026/318 hearing and deadline context", () => {
  const text = `
    PTT UETS
    Kurum: Ankara 7. İş Mahkemesi
    Dosya No: 2026/318
    Barkod No: 5003003180001
    Teslim tarihi: 13.08.2026 08:45
    Duruşma tarihi: 20.08.2026
    Duruşma saati: 10:30
    Son tarih: 24.08.2026
  `;

  const notice = extractUetsNotice(text);
  const hearing = extractUetsHearingFields(text);
  const deadlines = extractUetsExplicitDeadlines(text);

  assert.equal(notice.fileNo, "2026/318");
  assert.equal(hearing.date, "2026-08-20");
  assert.equal(hearing.time, "10:30");
  assert.equal(deadlines[0]?.explicitDate, "2026-08-24");
});

test("extracts Antalya 2026/742 labelled hearing, parties and case type", () => {
  const text = `
    PTT UETS Elektronik Tebligat
    E-Tebligat Barkod No: 5003007421901
    Kurum: Antalya 4. Sulh Hukuk Mahkemesi
    Dosya No: 2026/742
    Karar No: 2026/981

    UETS teslim tarihi: 17.08.2026 09:12
    UETS açılma tarihi: 18.08.2026 10:06
    Tebliğ edilmiş sayılma tarihi: 22.08.2026 23:59

    Duruşmasının 19.11.2026 günü saat 13:30'da yapılmasına karar verilmiştir.
    Açık/kesin son tarih: 07.09.2026

    DAVACI
    Selin Yalçın
    DAVALI
    Akdeniz Gayrimenkul Yönetim A.Ş.
    DAVA TÜRÜ / KONU
    Kira ilişkisinden kaynaklanan alacak ve tahliye istemi

    Gider Avansı: 3.250,00 TL
    Son ödeme tarihi: 10.09.2026
    Gider avansının tebliğ edilmiş sayılma tarihinden itibaren iki haftalık süre içerisinde yatırılması gerekir.
  `;

  const notice = extractUetsNotice(text);
  const hearing = extractUetsHearingFields(text);
  const partiesAndSubject = extractUetsPartiesAndSubject(text);
  const deadlines = extractUetsExplicitDeadlines(text);
  const payment = extractUetsPaymentFields(text, "antalya-2026-742.pdf");

  assert.equal(notice.court, "Antalya 4. Sulh Hukuk Mahkemesi");
  assert.equal(notice.fileNo, "2026/742");
  assert.equal(extractUetsDecisionNo(text), "2026/981");
  assert.equal(extractUetsBarcodeNo(text), "5003007421901");
  assert.equal(hearing.date, "2026-11-19");
  assert.equal(hearing.time, "13:30");
  assert.equal(
    partiesAndSubject.parties,
    "Davacı: Selin Yalçın\nDavalı: Akdeniz Gayrimenkul Yönetim A.Ş."
  );
  assert.equal(
    partiesAndSubject.subject,
    "Kira ilişkisinden kaynaklanan alacak ve tahliye istemi"
  );
  assert.deepEqual(
    deadlines.filter((item) => item.isExplicitFinalDate).map((item) => item.explicitDate),
    ["2026-09-07"]
  );
  assert.equal(payment.paymentAmount, 3250);
  assert.equal(payment.paymentDescription, "Gider Avansı");
  assert.equal(payment.paymentDueDate, "2026-09-10");
  assert.match(payment.paymentPeriodText, /iki haftalık süre içerisinde/iu);
});

test("accepts labelled hearing time sentence variants", () => {
  for (const text of [
    "Duruşma tarihi: 19.11.2026 günü saat 13:30'da yapılacaktır.",
    "Duruşma günü: 19.11.2026 günü saat 13:30 yapılacaktır.",
    "Duruşmasının 19.11.2026 günü saat 13:30'da yapılmasına karar verilmiştir.",
  ]) {
    const hearing = extractUetsHearingFields(text);

    assert.equal(hearing.date, "2026-11-19");
    assert.equal(hearing.time, "13:30");
  }
});
