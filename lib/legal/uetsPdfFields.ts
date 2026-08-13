export type UetsPaymentFields = {
  paymentAmount: number | null;
  paymentCurrency: string;
  paymentDescription: string;
  paymentDueDate: string;
  paymentPeriodText: string;
  sourceDocument: string;
};

function cleanSpace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toIsoDate(value: string) {
  const match = value.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);

  if (!match) {
    return "";
  }

  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function parseTurkishAmount(value: string) {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

function normalizeCurrency(value: string) {
  const currency = value.toLocaleUpperCase("tr-TR");

  if (currency === "₺" || currency === "TL" || currency === "TRY") {
    return "TRY";
  }

  if (currency === "€" || currency === "EUR") {
    return "EUR";
  }

  if (currency === "$" || currency === "USD") {
    return "USD";
  }

  return currency;
}

function contextAround(text: string, index: number, length: number) {
  return cleanSpace(text.slice(Math.max(0, index - 140), index + length + 180)).slice(0, 500);
}

export function extractUetsPaymentFields(
  text: string,
  sourceDocument: string
): UetsPaymentFields {
  const paymentContext =
    /(?:öde(?:me|nmesi|yiniz)|yatır(?:ma|ılması|ınız)|harç|gider\s+avansı|masraf|bakiye|tutar)/iu;
  const amountPattern =
    /(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(TRY|TL|₺|EUR|€|USD|\$)(?=\s|[.,;)]|$)/giu;

  let amount: number | null = null;
  let currency = "";
  let description = "";

  for (const match of text.matchAll(amountPattern)) {
    const context = contextAround(text, match.index ?? 0, match[0].length);

    if (!paymentContext.test(context)) {
      continue;
    }

    amount = parseTurkishAmount(match[1]);
    currency = normalizeCurrency(match[2]);
    description = context;
    break;
  }

  const explicitDatePatterns = [
    /(?:son\s+ödeme|ödeme\s+son|yatırma\s+son|son\s+tarih|en\s+geç)(?:\s+tarihi)?\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/iu,
    /(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s+tarihine\s+kadar[^\n]{0,140}(?:öde|yatır)/iu,
  ];
  let paymentDueDate = "";

  for (const pattern of explicitDatePatterns) {
    const match = text.match(pattern);

    if (match) {
      paymentDueDate = toIsoDate(match[1]);
      if (!description) {
        description = contextAround(text, match.index ?? 0, match[0].length);
      }
      break;
    }
  }

  let paymentPeriodText = "";
  const periodPattern = /\b(\d+\s*(?:gün|hafta|ay)\s*(?:içinde|içerisinde|süre\s+içinde))\b/giu;

  for (const match of text.matchAll(periodPattern)) {
    const context = contextAround(text, match.index ?? 0, match[0].length);

    if (!paymentContext.test(context)) {
      continue;
    }

    paymentPeriodText = cleanSpace(match[1]);
    if (!description) {
      description = context;
    }
    break;
  }

  return {
    paymentAmount: amount,
    paymentCurrency: currency,
    paymentDescription: description,
    paymentDueDate,
    paymentPeriodText,
    sourceDocument: cleanSpace(sourceDocument).slice(0, 500),
  };
}

export function extractUetsPartiesAndSubject(text: string) {
  const parties = text.match(
    /(?:Taraf(?:lar)?|Davacı\s*\/\s*Davalı|Muhatap)\s*[:\-]\s*([^\r\n]{3,300})/iu
  );
  const subject = text.match(/(?:Konu|Tebligat\s+Konusu)\s*[:\-]\s*([^\r\n]{3,500})/iu);

  return {
    parties: parties ? cleanSpace(parties[1]) : "",
    subject: subject ? cleanSpace(subject[1]) : "",
  };
}

export function extractUetsDateInformation(text: string) {
  const pattern =
    /([^\r\n:]{2,80}(?:tarih|gün)[^\r\n:]{0,40})\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/giu;
  const dates: Array<{ label: string; date: string; evidence: string }> = [];

  for (const match of text.matchAll(pattern)) {
    const date = toIsoDate(match[2]);
    const evidence = cleanSpace(match[0]).slice(0, 300);

    if (!date || dates.some((item) => item.date === date && item.evidence === evidence)) {
      continue;
    }

    dates.push({
      label: cleanSpace(match[1]).slice(0, 120),
      date,
      evidence,
    });
  }

  return dates.slice(0, 20);
}
