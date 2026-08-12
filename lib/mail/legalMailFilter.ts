export type LegalMailCandidate = {
  sender?: string | null;
  subject?: string | null;
  snippet?: string | null;
  body?: string | null;
};

export const GMAIL_LEGAL_QUERY = [
  "uets",
  '"ptt uets"',
  '"elektronik tebligat"',
  "tebligat",
  "mahkeme",
  "adliye",
  "dava",
  "duruşma",
  '"dosya no"',
  '"esas no"',
  '"karar no"',
  "icra",
  "arabuluculuk",
  "bilirkişi",
  "savcılık",
  "asliye",
  "sulh",
  '"iş mahkemesi"',
  '"hukuk mahkemesi"',
  '"idare mahkemesi"',
  '"bölge adliye"',
  "istinaf",
  "yargıtay",
].join(" OR ");

const LEGAL_PATTERNS = [
  /\buets\b/,
  /\betebligat\b/,
  /\btebligat/,
  /\bmahkeme/,
  /\badliye\b/,
  /\bdava/,
  /\bdurusma/,
  /\bdosya\s+(?:no|numara)/,
  /\besas\s+(?:no|numara)/,
  /\bkarar\s+(?:no|numara)/,
  /\bicra\b/,
  /\barabulucu/,
  /\bbilirkisi\b/,
  /\bsavcilik\b/,
  /\basliye\b/,
  /\bsulh\b/,
  /\bis\s+mahkemesi\b/,
  /\bhukuk\s+mahkemesi\b/,
  /\bidare\s+mahkemesi\b/,
  /\bbolge\s+adliye\b/,
  /\bistinaf\b/,
  /\byargitay\b/,
];

const FILE_NUMBER_PATTERN =
  /\b(?:19|20)\d{2}\s*\/\s*\d{1,12}\b/;

function normalizeLegalText(
  value: unknown
): string {
  return typeof value === "string"
    ? value
        .normalize("NFKD")
        .replace(/[ıİ]/g, "i")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9/]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

export function isLegalMail(
  mail: LegalMailCandidate
): boolean {
  const text = normalizeLegalText(
    [
      mail.sender,
      mail.subject,
      mail.snippet,
      mail.body,
    ]
      .filter(Boolean)
      .join("\n")
  );

  if (!text) {
    return false;
  }

  return (
    FILE_NUMBER_PATTERN.test(text) ||
    LEGAL_PATTERNS.some((pattern) =>
      pattern.test(text)
    )
  );
}
