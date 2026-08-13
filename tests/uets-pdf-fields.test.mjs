import assert from "node:assert/strict";
import test from "node:test";

import {
  extractUetsDateInformation,
  extractUetsPartiesAndSubject,
  extractUetsPaymentFields,
} from "../lib/legal/uetsPdfFields.ts";

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
