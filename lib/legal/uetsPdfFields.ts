export type UetsPaymentFields = {
  paymentAmount: number | null;
  paymentCurrency: string;
  paymentDescription: string;
  paymentDueDate: string;
  paymentPeriodText: string;
  sourceDocument: string;
};

export type UetsCaseValueFields = {
  caseValue: number | null;
  caseValueCurrency: string;
};

export type UetsHearingFields = {
  found: boolean;
  date: string;
  time: string;
  location: string;
  evidence: string;
};

export type UetsDeadlineField = {
  label: string;
  explicitDate: string;
  durationText: string;
  startBasis: string;
  evidence: string;
  isExplicitFinalDate: boolean;
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

function toTurkishTitleCase(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(
      /(^|[\s(/-])(\p{L})/gu,
      (_, prefix: string, letter: string) =>
        `${prefix}${letter.toLocaleUpperCase("tr-TR")}`
    );
}

export function extractUetsAddresseeCourt(text: string) {
  const upperText = text.toLocaleUpperCase("tr-TR");
  const match = upperText.match(
    /(?<![A-ZÇĞİÖŞÜ])((?:(?:[A-ZÇĞİÖŞÜ]+|\d{1,3}\.)\s+){1,4}(?:AİLE|İŞ|ASLİYE\s+HUKUK|SULH\s+HUKUK|İCRA\s+HUKUK|AĞIR\s+CEZA|ASLİYE\s+CEZA|TÜKETİCİ|İDARE|VERGİ|TİCARET)\s+MAHKEMESİ)(?:\s+(?:SAYIN\s+)?HAKİMLİĞİ\s*['’]?\s*NE|\s*['’]?\s*NE)\b/u
  );

  return match?.[1]
    ? toTurkishTitleCase(cleanSpace(match[1]))
    : "";
}

export function extractUetsLawyers(text: string) {
  const lawyerPattern =
    /\bAv\.?\s*(\p{Lu}[\p{L}'’-]*(?:[ \t]+\p{Lu}[\p{L}'’-]*){0,2}?[ \t]+\p{Lu}[\p{Lu}'’-]{1,})\b/gu;
  const lawyers: string[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(lawyerPattern)) {
    const name = cleanSpace(match[1]);
    const identity = name.toLocaleLowerCase("tr-TR");

    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    lawyers.push(`Av. ${name}`);
  }

  return lawyers.slice(0, 12);
}

export function extractUetsDocumentDate(text: string) {
  const tail = text.slice(Math.max(0, Math.floor(text.length * 0.6)));
  const signatureDatePattern =
    /(\d{1,2}[./-]\d{1,2}[./-]\d{4})(?=[\s\S]{0,180}\b(?:DAVACI\s+VEKİLİ|DAVALI\s+VEKİLİ|VEKİLİ|İMZA|EKLER)\b)/giu;
  const matches = Array.from(tail.matchAll(signatureDatePattern));
  const value = matches.at(-1)?.[1] || "";

  return value ? toIsoDate(value) : "";
}

export function extractUetsInterimMeasureRequested(text: string) {
  return /\b(?:TEDBİR\s+TALEPLİDİR|İHTİYATİ\s+TEDBİR\s+TALEBİMİZ)\b/iu.test(
    text
  );
}

function contextAround(text: string, index: number, length: number) {
  return cleanSpace(text.slice(Math.max(0, index - 140), index + length + 180)).slice(0, 500);
}

function paymentContextAround(text: string, index: number, length: number) {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  const nextLineBreak = text.indexOf("\n", index + length);
  const lineEnd = nextLineBreak < 0 ? text.length : nextLineBreak;
  const currentLine = text.slice(lineStart, lineEnd);

  if (hasPaymentObligation(currentLine)) {
    return cleanSpace(currentLine).slice(0, 500);
  }

  const previousLineBreak = lineStart > 0
    ? text.lastIndexOf("\n", lineStart - 2)
    : -1;
  const previousLine = text.slice(previousLineBreak + 1, Math.max(0, lineStart - 1));
  const followingLineEnd = nextLineBreak < 0
    ? text.length
    : text.indexOf("\n", nextLineBreak + 1);
  const nextLine = nextLineBreak < 0
    ? ""
    : text.slice(
        nextLineBreak + 1,
        followingLineEnd < 0 ? text.length : followingLineEnd
      );

  if (
    /(?:avans|harç|masraf|ödeme)(?:\s+tutar[ıi]|\s+bedeli)?\s*[:\-]?\s*$/iu.test(previousLine) ||
    /^(?:\s*(?:mahkeme\s+veznesine\s+)?(?:yatır|öden))/iu.test(nextLine)
  ) {
    return cleanSpace([previousLine, currentLine, nextLine].join(" ")).slice(0, 500);
  }

  return cleanSpace(currentLine).slice(0, 500);
}

const paymentObligationPattern =
  /(?:gider|bilirkişi|istinaf|temyiz|başvuru|posta|tebligat)\s+avans[ıi]?|(?:mahkeme\s+veznesine\s+)?yatır(?:ma|ılması|ılacak|manız|ınız|ılması\s+gerekmektedir)|ödenmesi|ödeme\s+(?:yapılması|yapılacak|tutar[ıi]|bedeli)|(?:harç|avans|masraf)\s*(?:tutar[ıi]|bedeli)?\s*[:\-]/iu;

function hasPaymentObligation(value: string) {
  return paymentObligationPattern.test(value);
}

export function extractUetsCaseValueFields(
  text: string
): UetsCaseValueFields {
  const labelledValuePattern =
    /(?:^|\n)\s*(?:Dava\s+Değer[İIıi]|Harca\s+Esas\s+(?:Dava\s+)?Değer|Harca\s+Esas\s+Miktar)\s*[:\-]\s*(\d{1,3}(?:[.\u00a0 \t]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(TRY|TL|₺|EUR|€|USD|\$)(?=\s|[.,;)'’]|$)/imu;
  const match = text.match(labelledValuePattern);

  return {
    caseValue: match?.[1]
      ? parseTurkishAmount(match[1])
      : null,
    caseValueCurrency: match?.[2]
      ? normalizeCurrency(match[2])
      : "",
  };
}

export function extractUetsResultAndRequest(
  text: string
) {
  const normalized = text.replace(/\r/g, "");
  const heading = normalized.match(
    /\b(?:SONUÇ\s+VE\s+(?:İSTEM|TALEP)|NETİCE\s+VE\s+TALEP)\s*:?\s*/iu
  );

  if (!heading || heading.index === undefined) {
    return "";
  }

  const remainder = normalized.slice(heading.index + heading[0].length);
  const ending = remainder.toLocaleUpperCase("tr-TR").match(
    /(?:DAVACI\s+VEKİLİ|DAVALI\s+VEKİLİ|VEKİLİ|İMZA)|EKLER\s*:/u
  );
  const section = remainder
    .slice(0, ending?.index ?? remainder.length)
    .replace(/\s*\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\s*$/u, "");

  return section
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 12_000);
}

export function extractUetsHearingFields(text: string): UetsHearingFields {
  const patterns = [
    /(?:duruşma(?:sı|sının|nın)?|celse)(?:\s+(?:tarihi|günü))?\s*[:\-]?\s*[^\d\r\n]{0,80}(\d{1,2}[./-]\d{1,2}[./-]\d{4})(?:\s+günü)?(?:\s+(?:saat|saati)\s*[:\-]?\s*([01]?\d|2[0-3])[:.]([0-5]\d)(?:['’](?:da|de))?)?/iu,
    /(?:duruşma\s+tarihi|duruşma\s+günü|celse\s+tarihi)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/iu,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const date = match?.[1] ? toIsoDate(match[1]) : "";

    if (!match || !date) {
      continue;
    }

    let time = match[2] && match[3]
      ? `${match[2].padStart(2, "0")}:${match[3]}`
      : "";
    let timeEvidence = "";

    if (!time) {
      const dateIndex = match.index ?? 0;
      const hearingWindow = text.slice(
        Math.max(0, dateIndex - 80),
        Math.min(text.length, dateIndex + match[0].length + 140)
      );
      const timeMatch = hearingWindow.match(
        /(?:duruşma\s*saati|duruşma\s*saat|celse\s*saati|saat|saati)\s*[:\-]?\s*([01]?\d|2[0-3])[:.]([0-5]\d)/iu
      );

      if (timeMatch) {
        time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`;
        timeEvidence = cleanSpace(timeMatch[0]);
      }
    }

    return {
      found: true,
      date,
      time,
      location: "",
      evidence: [cleanSpace(match[0]), timeEvidence]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 1500),
    };
  }

  return {
    found: false,
    date: "",
    time: "",
    location: "",
    evidence: "",
  };
}

export function extractUetsExplicitDeadlines(text: string): UetsDeadlineField[] {
  const results: UetsDeadlineField[] = [];
  const patterns = [
    /(?:açık(?:\s*\/\s*kesin)?\s+son\s+tarih|kesin\s+son\s+tarih|son\s+gün|son\s+tarih|süre\s+sonu|en\s+geç)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})[^\n]*/giu,
    /(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s+tarihine\s+kadar[^\n]*/giu,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const date = toIsoDate(match[1] || match[0]);
      if (!date || hasPaymentObligation(match[0])) {
        continue;
      }

      if (results.some((item) => item.explicitDate === date)) {
        continue;
      }

      results.push({
        label: "Açıkça belirtilen son tarih",
        explicitDate: date,
        durationText: "",
        startBasis: "",
        evidence: cleanSpace(match[0]).slice(0, 1500),
        isExplicitFinalDate: true,
      });
    }
  }

  const relativePattern =
    /(?:kesin\s+süre|süre)\s*(?:olarak)?\s*[:\-]?\s*(\d+\s*(?:gün|hafta|ay))[^\n]*/giu;

  for (const match of text.matchAll(relativePattern)) {
    results.push({
      label: "Göreli hukuki süre",
      explicitDate: "",
      durationText: cleanSpace(match[1] || ""),
      startBasis: /tebliğ/iu.test(match[0]) ? "Tebliğ" : "",
      evidence: cleanSpace(match[0]).slice(0, 1500),
      isExplicitFinalDate: false,
    });
  }

  return results.slice(0, 12);
}

export function extractUetsBarcodeNo(text: string): string {
  const patterns = [
    /\b(?:barkod|e[\s-]*tebligat|elektronik\s+tebligat(?:\s+belge)?)\s*(?:no|numarası)?\s*[:#-]?\s*(\d{12,30})\b/iu,
    /\b(\d{12,30})\s+(?:barkod|e[\s-]*tebligat)\s*(?:no|numarası|numaralı)?\b/iu,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return "";
}

export function extractUetsPaymentFields(
  text: string,
  sourceDocument: string
): UetsPaymentFields {
  const paymentDescriptionPattern =
    /((?:[İi]stinaf|temyiz|başvuru|gider|posta|tebligat|bilirkişi)\s+avans[ıi]|(?:harç|masraf|bakiye|ödeme)\s+(?:tutar[ıi]|bedeli))/iu;
  const amountPattern =
    /(\d{1,3}(?:[.\u00a0 \t]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(TRY|TL|₺|EUR|€|USD|\$)(?=\s|[.,;)'’]|$)/giu;

  let amount: number | null = null;
  let currency = "";
  let description = "";

  for (const match of text.matchAll(amountPattern)) {
    const context = paymentContextAround(text, match.index ?? 0, match[0].length);

    if (!hasPaymentObligation(context)) {
      continue;
    }

    amount = parseTurkishAmount(match[1]);
    currency = normalizeCurrency(match[2]);
    const matchedDescription =
      context.match(
        paymentDescriptionPattern
      )?.[1];
    description = matchedDescription
      ? matchedDescription
          .charAt(0)
          .toLocaleUpperCase("tr-TR") +
        matchedDescription.slice(1)
      : context;
    break;
  }

  const explicitDatePatterns = [
    /(?:son\s+ödeme|ödeme\s+son|yatırma\s+son)(?:\s+tarihi)?\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/iu,
    /(?:ödeme|gider|harç|avans|masraf)[^\n]{0,100}?(?:son\s+tarih|en\s+geç)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/iu,
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
  const periodPattern =
    /\b((?:tebliğ\s+edilmiş\s+sayılma\s+tarihinden\s+itibaren\s+)?(?:\d+\s*(?:gün|hafta|ay)|(?:bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on)\s+(?:günlük|haftalık|aylık))\s*(?:süre\s+)?(?:içinde|içerisinde))\b/giu;

  for (const match of text.matchAll(periodPattern)) {
    const context = paymentContextAround(text, match.index ?? 0, match[0].length);

    if (!hasPaymentObligation(context)) {
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
  const claimant = text.match(
    /(?:^|\n)\s*DAVACI\s*[:\-]?\s*(?:\r?\n\s*)?([^\r\n]{3,300})/imu
  );
  const defendant = text.match(
    /(?:^|\n)\s*DAVALI\s*[:\-]?\s*(?:\r?\n\s*)?([^\r\n]{3,300})/imu
  );
  const caseType =
    text.match(
      /(?:^|\n)\s*DAVA\s*TÜRÜ\s*(?:\/\s*KONU)?\s*[:\-]?\s*(?:\r?\n\s*)?([^\r\n]{3,500})/imu
    );
  const subject =
    text.match(
      /(?:^|\n)\s*(?:KONU|TEBLİGAT\s+KONUSU)\s*[:\-]\s*(?:\r?\n\s*)?([^\r\n]{3,500})/imu
    ) ||
    caseType;

  const cleanPartyName = (
    value: string
  ) =>
    cleanSpace(value)
      .replace(
        /\s*\(\s*T\.?\s*C\.?\s*[:\-]?\s*\d{11}\s*\)\s*$/iu,
        ""
      )
      .trim();

  const plaintiff = claimant?.[1]
    ? cleanPartyName(claimant[1])
    : "";
  const defendantName = defendant?.[1]
    ? cleanPartyName(defendant[1])
    : "";

  const labelledParties = [
    plaintiff ? `Davacı: ${plaintiff}` : "",
    defendantName ? `Davalı: ${defendantName}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    parties: labelledParties || (parties ? cleanSpace(parties[1]) : ""),
    plaintiff,
    defendant: defendantName,
    caseType: caseType ? cleanSpace(caseType[1]) : "",
    subject: subject ? cleanSpace(subject[1]) : "",
  };
}

export function extractUetsDecisionNo(text: string) {
  const match = text.match(
    /(?:Karar\s*(?:No|Numarası)?|K\.)\s*[:\-]?\s*(\d{4}\s*\/\s*\d+)/iu
  );

  return match ? cleanSpace(match[1]).replace(/\s+/g, "") : "";
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
