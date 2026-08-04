export type UetsExtractionResult = {
  found: boolean;
  institution: "PTT UETS" | "";
  noticeType: "electronic_notification" | "unknown";

  arrivalDate: string;
  arrivalTime: string;
  arrivalDateTime: string;
  deemedServiceDate: string;

  court: string;
  fileNo: string;
  barcodeNo: string;
  recipient: string;
  subject: string;

  sourceText: string;
  normalizedText: string;

  confidence: number;
  warnings: string[];
};

type DateMatch = {
  date: string;
  time: string;
  sourceText: string;
  score: number;
};

const EMPTY_RESULT: UetsExtractionResult = {
  found: false,
  institution: "",
  noticeType: "unknown",

  arrivalDate: "",
  arrivalTime: "",
  arrivalDateTime: "",
  deemedServiceDate: "",

  court: "",
  fileNo: "",
  barcodeNo: "",
  recipient: "",
  subject: "",

  sourceText: "",
  normalizedText: "",

  confidence: 0,
  warnings: [],
};

const TURKISH_MONTHS: Record<string, string> = {
  ocak: "01",
  oca: "01",

  subat: "02",
  sub: "02",
  şubat: "02",

  mart: "03",
  mar: "03",

  nisan: "04",
  nis: "04",

  mayis: "05",
  mayıs: "05",
  may: "05",

  haziran: "06",
  haz: "06",

  temmuz: "07",
  tem: "07",

  agustos: "08",
  ağustos: "08",
  agu: "08",
  ağu: "08",

  eylul: "09",
  eylül: "09",
  eyl: "09",

  ekim: "10",
  eki: "10",

  kasim: "11",
  kasım: "11",
  kas: "11",

  aralik: "12",
  aralık: "12",
  ara: "12",
};

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const number = Number(code);

      if (!Number.isFinite(number)) return "";

      try {
        return String.fromCodePoint(number);
      } catch {
        return "";
      }
    });
}

function repairCommonMojibake(value: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/Ä°/g, "İ"],
    [/Ä±/g, "ı"],
    [/Åž/g, "Ş"],
    [/ÅŸ/g, "ş"],
    [/Äž/g, "Ğ"],
    [/ÄŸ/g, "ğ"],
    [/Ãœ/g, "Ü"],
    [/Ã¼/g, "ü"],
    [/Ã–/g, "Ö"],
    [/Ã¶/g, "ö"],
    [/Ã‡/g, "Ç"],
    [/Ã§/g, "ç"],
    [/â€™/g, "'"],
    [/â€œ/g, '"'],
    [/â€/g, '"'],
    [/â€“/g, "-"],
    [/â€”/g, "-"],
    [/Â·/g, "·"],
    [/Â/g, ""],
  ];

  return replacements.reduce(
    (result, [pattern, replacement]) =>
      result.replace(pattern, replacement),
    value
  );
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ");
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeMailText(value: string): string {
  const decoded = decodeHtmlEntities(safeString(value));
  const repaired = repairCommonMojibake(decoded);
  const withoutHtml = stripHtml(repaired);

  return normalizeWhitespace(withoutHtml);
}

function normalizeMonthKey(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/\./g, "")
    .trim();
}

function isValidIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toIsoDate(day: string, month: string, year: string): string {
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

  return isValidIsoDate(iso) ? iso : "";
}

function parseDateValue(value: string): string {
  const trimmed = value.trim();

  const isoMatch = trimmed.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);

  if (isoMatch) {
    return toIsoDate(isoMatch[3], isoMatch[2], isoMatch[1]);
  }

  const dottedMatch = trimmed.match(
    /\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/
  );

  if (dottedMatch) {
    return toIsoDate(dottedMatch[1], dottedMatch[2], dottedMatch[3]);
  }

  const turkishMatch = trimmed.match(
    /\b(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(20\d{2})\b/i
  );

  if (turkishMatch) {
    const month =
      TURKISH_MONTHS[normalizeMonthKey(turkishMatch[2])] || "";

    if (month) {
      return toIsoDate(turkishMatch[1], month, turkishMatch[3]);
    }
  }

  return "";
}

function normalizeTime(value: string): string {
  const match = value.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);

  if (!match) return "";

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function addCalendarDays(isoDate: string, days: number): string {
  if (!isValidIsoDate(isoDate)) return "";

  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function findUetsAnchors(text: string): number[] {
  const patterns = [
    /PTT\s*UETS/gi,
    /Ulusal Elektronik Tebligat Sistemi/gi,
    /uets@bilgi\.ptt\.gov\.tr/gi,
    /elektronik tebligat adresinize/gi,
    /bir e-?tebligat gönderildi/gi,
    /tebligat adresine ulaştığı tarihi izleyen beşinci gün/gi,
  ];

  const indexes: number[] = [];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      indexes.push(match.index);

      if (match.index === pattern.lastIndex) {
        pattern.lastIndex += 1;
      }
    }
  }

  return [...new Set(indexes)].sort((a, b) => a - b);
}

function extractRelevantUetsBlock(text: string): string {
  const anchors = findUetsAnchors(text);

  if (anchors.length === 0) {
    return text;
  }

  let bestBlock = "";
  let bestScore = -1;

  for (const index of anchors) {
    const start = Math.max(0, index - 1500);
    const end = Math.min(text.length, index + 4500);
    const block = text.slice(start, end);

    let score = 0;

    if (/PTT\s*UETS/i.test(block)) score += 20;
    if (/uets@bilgi\.ptt\.gov\.tr/i.test(block)) score += 20;
    if (/elektronik tebligat adresinize/i.test(block)) score += 25;
    if (/bir e-?tebligat gönderildi/i.test(block)) score += 25;
    if (/barkod numaralı/i.test(block)) score += 15;
    if (/Mahkemesi|Müdürlüğü|Dairesi/i.test(block)) score += 15;
    if (/\b20\d{2}\/\d+\b/.test(block)) score += 10;
    if (
      /ulaştığı tarihi izleyen beşinci günün sonunda yapılmış sayılır/i.test(
        block
      )
    ) {
      score += 30;
    }

    if (score > bestScore) {
      bestScore = score;
      bestBlock = block;
    }
  }

  return bestBlock || text;
}

function extractDateCandidates(text: string): DateMatch[] {
  const candidates: DateMatch[] = [];

  const contextualPatterns: Array<{
    pattern: RegExp;
    score: number;
  }> = [
    {
      pattern:
        /tebligat adresinize\s+(\d{1,2}[./-]\d{1,2}[./-]20\d{2})\s+([0-2]?\d[:.][0-5]\d)\s+tarihinde/gi,
      score: 100,
    },
    {
      pattern:
        /adresinize\s+(\d{1,2}[./-]\d{1,2}[./-]20\d{2})\s+([0-2]?\d[:.][0-5]\d)\s+tarihinde/gi,
      score: 95,
    },
    {
      pattern:
        /(\d{1,2}[./-]\d{1,2}[./-]20\d{2})\s+([0-2]?\d[:.][0-5]\d)\s+tarihinde\s+(?:ADALET BAKANLIĞI|Adalet Bakanlığı)/gi,
      score: 95,
    },
    {
      pattern:
        /Date:\s*(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+20\d{2})[^,\n]*(?:,|\s)\s*([0-2]?\d[:.][0-5]\d)/gi,
      score: 75,
    },
    {
      pattern:
        /Tarih:\s*(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+20\d{2})[^,\n]*(?:,|\s+saat\s+)\s*([0-2]?\d[:.][0-5]\d)/gi,
      score: 65,
    },
  ];

  for (const item of contextualPatterns) {
    let match: RegExpExecArray | null;

    while ((match = item.pattern.exec(text)) !== null) {
      const date = parseDateValue(match[1]);
      const time = normalizeTime(match[2]);

      if (date) {
        candidates.push({
          date,
          time,
          sourceText: match[0],
          score: item.score,
        });
      }

      if (match.index === item.pattern.lastIndex) {
        item.pattern.lastIndex += 1;
      }
    }
  }

  const fallbackPatterns = [
    /\b(\d{1,2}[./-]\d{1,2}[./-]20\d{2})\s+([0-2]?\d[:.][0-5]\d)\b/g,
    /\b(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+20\d{2})[^,\n]*(?:,|\s+saat\s+)\s*([0-2]?\d[:.][0-5]\d)\b/gi,
  ];

  for (const pattern of fallbackPatterns) {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const date = parseDateValue(match[1]);
      const time = normalizeTime(match[2]);

      if (date) {
        candidates.push({
          date,
          time,
          sourceText: match[0],
          score: 40,
        });
      }

      if (match.index === pattern.lastIndex) {
        pattern.lastIndex += 1;
      }
    }
  }

  return candidates
    .filter(
      (candidate, index, array) =>
        array.findIndex(
          (item) =>
            item.date === candidate.date &&
            item.time === candidate.time &&
            item.sourceText === candidate.sourceText
        ) === index
    )
    .sort((a, b) => b.score - a.score);
}

function extractCourt(text: string): string {
  const patterns = [
    /(?:barkod numaralı\s+ve\s+)([A-ZÇĞİÖŞÜa-zçğıöşü0-9.\s]+?(?:Mahkemesi|Müdürlüğü|Dairesi))\s*\[/i,
    /\b([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğıöşü\s.-]*?\d+\.\s*(?:İş|Aile|Asliye Hukuk|Asliye Ceza|Ağır Ceza|Sulh Hukuk|Sulh Ceza|Ticaret|İdare|Vergi)\s+Mahkemesi)\b/i,
    /\b([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğıöşü\s.-]*?\d+\.\s*İcra\s+(?:Müdürlüğü|Dairesi))\b/i,
    /\[([^\[\]]+?(?:Mahkemesi|Müdürlüğü|Dairesi))[^\[\]]*\]/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1]
        .replace(/\s+/g, " ")
        .replace(/^\W+|\W+$/g, "")
        .trim();
    }
  }

  return "";
}

function extractFileNo(text: string): string {
  const patterns = [
    /\[\s*(20\d{2}\/\d{1,8})\s*\]/,
    /\b(?:dosya|esas)\s*(?:no|numarası|sayısı)?\s*[:#-]?\s*(20\d{2}\/\d{1,8})\b/i,
    /\b(20\d{2}\/\d{1,8})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function extractBarcodeNo(text: string): string {
  const contextual =
    text.match(/\b(\d{10,20})\s+barkod numaralı\b/i) ||
    text.match(/\bbarkod(?:\s+no|\s+numarası)?\s*[:#-]?\s*(\d{10,20})\b/i);

  if (contextual?.[1]) return contextual[1];

  const standalone = text.match(/\b\d{12,16}\b/g) || [];

  return (
    standalone.find(
      (value) =>
        !/^16963/.test(value) &&
        !/^0+$/.test(value)
    ) || ""
  );
}

function extractRecipient(text: string): string {
  const patterns = [
    /Sayın\s+([A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\s.'-]{2,80}),/i,
    /To:\s*([^<\n]+)</i,
    /Alıcı:\s*([^<\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].replace(/\s+/g, " ").trim();
    }
  }

  return "";
}

function extractSubject(text: string): string {
  const patterns = [
    /Subject:\s*([^\n]+)/i,
    /Konu:\s*([^\n]+)/i,
  ];

  for (const pattern of patterns) {
    const matches = [...text.matchAll(new RegExp(pattern.source, "gi"))];

    const preferred = matches.find((match) =>
      /elektronik tebligat|e-?tebligat|uets/i.test(match[1] || "")
    );

    const value =
      preferred?.[1] ||
      matches.at(-1)?.[1] ||
      matches[0]?.[1] ||
      "";

    if (value) {
      return value
        .replace(/^(?:fwd?|re)\s*:\s*/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  return "";
}

function calculateConfidence(params: {
  detected: boolean;
  arrivalDate: string;
  court: string;
  fileNo: string;
  barcodeNo: string;
  hasLegalSentence: boolean;
}): number {
  let score = 0;

  if (params.detected) score += 30;
  if (params.arrivalDate) score += 30;
  if (params.court) score += 15;
  if (params.fileNo) score += 10;
  if (params.barcodeNo) score += 10;
  if (params.hasLegalSentence) score += 5;

  return Math.min(100, score);
}

export function extractUetsNotice(
  rawMail: string
): UetsExtractionResult {
  const normalizedText = normalizeMailText(rawMail);

  if (!normalizedText) {
    return {
      ...EMPTY_RESULT,
      warnings: ["Mail içeriği boş."],
    };
  }

  const uetsDetected =
    /PTT\s*UETS|Ulusal Elektronik Tebligat Sistemi|uets@bilgi\.ptt\.gov\.tr|elektronik tebligat adresinize|bir e-?tebligat gönderildi/i.test(
      normalizedText
    );

  if (!uetsDetected) {
    return {
      ...EMPTY_RESULT,
      normalizedText,
      warnings: ["PTT UETS tebligat işareti bulunamadı."],
    };
  }

  const sourceText = extractRelevantUetsBlock(normalizedText);
  const dateCandidates = extractDateCandidates(sourceText);

  const bestDate =
    dateCandidates.find((candidate) => candidate.score >= 90) ||
    dateCandidates[0];

  const arrivalDate = bestDate?.date || "";
  const arrivalTime = bestDate?.time || "";

  const arrivalDateTime =
    arrivalDate && arrivalTime
      ? `${arrivalDate}T${arrivalTime}:00`
      : arrivalDate;

  const deemedServiceDate = arrivalDate
    ? addCalendarDays(arrivalDate, 5)
    : "";

  const court = extractCourt(sourceText);
  const fileNo = extractFileNo(sourceText);
  const barcodeNo = extractBarcodeNo(sourceText);
  const recipient = extractRecipient(sourceText);
  const subject = extractSubject(normalizedText);

  const hasLegalSentence =
    /elektronik yolla tebligat[\s\S]*ulaştığı tarihi izleyen beşinci günün sonunda yapılmış sayılır/i.test(
      sourceText
    );

  const warnings: string[] = [];

  if (!arrivalDate) {
    warnings.push("Tebligatın ulaşma tarihi bulunamadı.");
  }

  if (!arrivalTime) {
    warnings.push("Tebligatın ulaşma saati bulunamadı.");
  }

  if (!court) {
    warnings.push("Mahkeme veya ilgili yargı birimi bulunamadı.");
  }

  if (!fileNo) {
    warnings.push("Dosya numarası bulunamadı.");
  }

  if (!barcodeNo) {
    warnings.push("Barkod numarası bulunamadı.");
  }

  const confidence = calculateConfidence({
    detected: uetsDetected,
    arrivalDate,
    court,
    fileNo,
    barcodeNo,
    hasLegalSentence,
  });

  return {
    found: Boolean(uetsDetected && arrivalDate),
    institution: "PTT UETS",
    noticeType: "electronic_notification",

    arrivalDate,
    arrivalTime,
    arrivalDateTime,
    deemedServiceDate,

    court,
    fileNo,
    barcodeNo,
    recipient,
    subject,

    sourceText,
    normalizedText,

    confidence,
    warnings,
  };
}

export function isUetsMail(rawMail: string): boolean {
  const normalized = normalizeMailText(rawMail);

  return /PTT\s*UETS|Ulusal Elektronik Tebligat Sistemi|uets@bilgi\.ptt\.gov\.tr|elektronik tebligat adresinize|bir e-?tebligat gönderildi/i.test(
    normalized
  );
}

export function calculateUetsDeemedServiceDate(
  arrivalDate: string
): string {
  return addCalendarDays(arrivalDate, 5);
}

