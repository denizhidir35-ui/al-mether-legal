export type UetsPaymentInput = {
  paymentAmount?: number | null;
  paymentCurrency?: string;
  paymentDescription?: string;
  paymentDueDate?: string;
  paymentPeriodText?: string;
  sourceDocument?: string;
};

export type UetsPaymentContext = {
  sourceUrl?: string;
  court?: string;
  fileNo?: string;
  barcodeNo?: string;
  deemedServiceDate?: string;
};

function safeText(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return false;
  }

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  );

  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3])
  );
}

function stableHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((word) =>
      word
        ? `${word[0].toLocaleUpperCase("tr-TR")}${word.slice(1)}`
        : ""
    )
    .join(" ");
}

export function formatUetsPaymentAmount(
  amount: number | null,
  currency: string
) {
  if (amount === null) {
    return "";
  }

  const currencyLabel = currency === "TRY" ? "TL" : currency;

  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)}${currencyLabel ? ` ${currencyLabel}` : ""}`;
}

export function planUetsPaymentReminder(
  input: UetsPaymentInput,
  context: UetsPaymentContext = {}
) {
  const amount =
    typeof input.paymentAmount === "number" &&
    Number.isFinite(input.paymentAmount)
      ? input.paymentAmount
      : null;
  const currency = safeText(input.paymentCurrency, 20).toLocaleUpperCase("tr-TR");
  const description = safeText(input.paymentDescription, 500);
  const dueDate = safeText(input.paymentDueDate, 20);
  const periodText = safeText(input.paymentPeriodText, 500);
  const sourceDocument = safeText(input.sourceDocument, 500);
  const hasExplicitDueDate = isIsoDate(dueDate);
  const hasPayment = Boolean(
    amount !== null || description || dueDate || periodText
  );
  const amountText = formatUetsPaymentAmount(amount, currency);
  const title =
    [amountText, titleCase(description)].filter(Boolean).join(" ") ||
    "UETS PDF Ödemesi";
  const descriptionLines = [
    description ? `Ödeme açıklaması: ${description}` : "",
    amountText ? `Tutar: ${amountText}` : "",
    sourceDocument ? `Kaynak PDF: ${sourceDocument}` : "",
    periodText ? `Süre metni: ${periodText}` : "",
  ].filter(Boolean);
  const dedupePayload = [
    safeText(context.sourceUrl, 3000),
    safeText(context.court, 500),
    safeText(context.fileNo, 200),
    safeText(context.barcodeNo, 200),
    sourceDocument,
    amount === null ? "" : String(amount),
    currency,
    description,
    dueDate,
    periodText,
  ].join("|");

  return {
    hasPayment,
    hasExplicitDueDate,
    shouldCreateCalendar: hasPayment && hasExplicitDueDate,
    dueDate: hasExplicitDueDate ? dueDate : "",
    title,
    description: descriptionLines.join("\n"),
    warning:
      hasPayment && !hasExplicitDueDate && periodText
        ? "Süre metni bulundu; başlangıç tarihi doğrulanamadığı için son tarih oluşturulmadı."
        : "",
    dedupeKey: `uets-payment-${stableHash(dedupePayload)}`,
    payment: {
      paymentAmount: amount,
      paymentCurrency: currency,
      paymentDescription: description,
      paymentDueDate: hasExplicitDueDate ? dueDate : "",
      paymentPeriodText: periodText,
      sourceDocument,
    },
  };
}
