export type ManualReminderCaseContext = {
  caseNumber?: string | null;
  court?: string | null;
  subject?: string | null;
  fallbackSubject?: string | null;
  plaintiff?: string | null;
  defendant?: string | null;
  caseNote?: string | null;
};

const SUBJECT_LIMIT = 80;

function cleanText(
  value?: string | null
): string {
  return value
    ?.normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ") || "";
}

function shortenText(
  value: string,
  limit: number
): string {
  if (value.length <= limit) {
    return value;
  }

  const candidate =
    value.slice(0, limit - 1);
  const lastSpace =
    candidate.lastIndexOf(" ");
  const end =
    lastSpace >= limit * 0.6
      ? candidate.slice(0, lastSpace)
      : candidate;

  return `${end.trimEnd()}…`;
}

function extractParty(
  note: string,
  label: "Davacı" | "Davalı"
): string {
  const normalized = note
    .normalize("NFKC")
    .replace(/\r/g, "")
    .replace(/Taraflar\s*:\s*/giu, "");
  const nextLabel =
    label === "Davacı"
      ? "Davalı"
      : "Davacı";
  const match = normalized.match(
    new RegExp(
      `${label}\\s*:\\s*(.+?)(?=\\s+(?:${nextLabel}|Vekili|Mahkeme|Konu|Karar No|Barkod|Dava Değeri|Sonuç ve İstem|Süre metni|Kaynak belge)\\s*:|\\n|$)`,
      "iu"
    )
  );

  return cleanText(match?.[1]);
}

export function buildManualReminderNote(
  context: ManualReminderCaseContext
): string {
  const caseNumber =
    cleanText(context.caseNumber);
  const court =
    cleanText(context.court);
  const subjectText =
    cleanText(context.subject) ||
    cleanText(context.fallbackSubject) ||
    "Dava";
  const shortSubject =
    shortenText(
      subjectText,
      SUBJECT_LIMIT
    );
  const reminderSubject =
    /hatırlat/iu.test(shortSubject)
      ? shortSubject
      : `${shortSubject} hatırlatması`;

  if (caseNumber) {
    return [
      caseNumber,
      court,
      reminderSubject,
    ]
      .filter(Boolean)
      .join(" — ");
  }

  const caseNote =
    context.caseNote || "";
  const plaintiff =
    cleanText(context.plaintiff) ||
    extractParty(caseNote, "Davacı");
  const defendant =
    cleanText(context.defendant) ||
    extractParty(caseNote, "Davalı");
  const parties = [
    plaintiff,
    defendant,
  ]
    .filter(Boolean)
    .join(" / ");

  return [
    parties,
    court,
    reminderSubject,
  ]
    .filter(Boolean)
    .join(" — ");
}
