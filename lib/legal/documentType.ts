export const LEGAL_DOCUMENT_TYPES = [
  "petition",
  "uets_notification",
  "hearing_minutes",
  "reasoned_decision",
  "interim_order",
  "expert_report",
  "enforcement_payment_order",
  "unknown",
] as const;

export type LegalDocumentType =
  (typeof LEGAL_DOCUMENT_TYPES)[number];

export type DocumentExtractionProfile =
  | "petition"
  | "uets"
  | "generic";

export type LegalDocumentClassification = {
  documentType: LegalDocumentType;
  documentTypeConfidence: number;
};

export const LEGAL_DOCUMENT_TYPE_LABELS:
  Record<LegalDocumentType, string> = {
    petition: "Dava Dilekçesi",
    uets_notification:
      "Elektronik Tebligat / UETS",
    hearing_minutes:
      "Duruşma Tutanağı",
    reasoned_decision:
      "Gerekçeli Karar",
    interim_order:
      "Tensip / Ara Karar",
    expert_report:
      "Bilirkişi Raporu",
    enforcement_payment_order:
      "İcra / Ödeme Emri",
    unknown:
      "Diğer Hukuki Belge",
  };

const CLASSIFICATION_THRESHOLD = 7;

function normalizeDocumentText(
  value: string
) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .toLocaleUpperCase("tr-TR");
}

function has(
  text: string,
  pattern: RegExp
) {
  return pattern.test(text);
}

function roundConfidence(
  value: number
) {
  return Math.round(
    Math.max(0, Math.min(1, value)) * 100
  ) / 100;
}

export function classifyLegalDocument(
  rawText: string
): LegalDocumentClassification {
  const text =
    normalizeDocumentText(rawText);
  const scores = new Map<
    Exclude<LegalDocumentType, "unknown">,
    number
  >();

  const add = (
    type: Exclude<LegalDocumentType, "unknown">,
    points: number,
    pattern: RegExp
  ) => {
    if (has(text, pattern)) {
      scores.set(
        type,
        (scores.get(type) || 0) + points
      );
    }
  };

  const petitionSignals = {
    plaintiff: has(
      text,
      /(?:^|\n)\s*DAVACI(?:LAR)?\s*[:\n]/u
    ),
    defendant: has(
      text,
      /(?:^|\n)\s*DAVALI(?:LAR)?\s*[:\n]/u
    ),
    subject: has(
      text,
      /(?:^|\n)\s*KONU\s*[:\n]/u
    ),
    request: has(
      text,
      /(?:^|\n)\s*(?:SONUÇ VE İSTEM|SONUÇ VE TALEP|NETİCE VE TALEP)\s*:?/u
    ),
  };

  for (const present of Object.values(
    petitionSignals
  )) {
    if (present) {
      scores.set(
        "petition",
        (scores.get("petition") || 0) + 2
      );
    }
  }

  add(
    "petition",
    4,
    /(?:^|\n)\s*[^\n]{0,100}MAHKEMESİ(?: SAYIN HAKİMLİĞİ)?['’]?NE\s*(?:$|\n)/u
  );
  add(
    "petition",
    2,
    /(?:^|\n)\s*(?:DAVA DEĞERİ|HARCA ESAS DEĞER|AÇIKLAMALAR|HUKUKİ SEBEPLER|DELİLLER)\s*:?/u
  );
  if (
    petitionSignals.plaintiff &&
    petitionSignals.defendant &&
    petitionSignals.subject &&
    petitionSignals.request
  ) {
    scores.set(
      "petition",
      (scores.get("petition") || 0) + 8
    );
  }

  add(
    "uets_notification",
    12,
    /ULUSAL ELEKTRONİK TEBLİGAT SİSTEMİ|ELEKTRONİK TEBLİGAT MAZBATASI/u
  );
  add(
    "uets_notification",
    8,
    /PTT\s+UETS|ELEKTRONİK\s+TEBLİGAT|E-?TEBLİGAT/u
  );
  add(
    "uets_notification",
    4,
    /TEBLİĞ EDİLMİŞ SAYILMA/u
  );
  add(
    "uets_notification",
    3,
    /(?:^|[^A-ZÇĞİÖŞÜ])UETS(?:[^A-ZÇĞİÖŞÜ]|$)/u
  );

  add(
    "hearing_minutes",
    12,
    /(?:^|\n)\s*DURUŞMA TUTANAĞI\s*(?:$|\n|:)/u
  );
  add(
    "hearing_minutes",
    4,
    /(?:^|\n)\s*CELSE\s*(?:NO|:|\n)/u
  );
  add(
    "hearing_minutes",
    3,
    /HAZIR BULUNAN|DURUŞMAYA DEVAM OLUNDU/u
  );

  add(
    "reasoned_decision",
    12,
    /(?:^|\n)\s*GEREKÇELİ KARAR\s*(?:$|\n|:)/u
  );
  add(
    "reasoned_decision",
    4,
    /(?:^|\n)\s*HÜKÜM\s*:?/u
  );
  add(
    "reasoned_decision",
    4,
    /GEREĞİ DÜŞÜNÜLDÜ/u
  );

  add(
    "interim_order",
    12,
    /(?:^|\n)\s*(?:TENSİP ZAPTI|TENSİP TUTANAĞI|ARA KARAR)\s*(?:$|\n|:)/u
  );

  add(
    "expert_report",
    12,
    /(?:^|\n)\s*BİLİRKİŞİ RAPORU\s*(?:$|\n|:)/u
  );
  add(
    "expert_report",
    5,
    /BİLİRKİŞİ KURULU/u
  );
  add(
    "expert_report",
    3,
    /(?:^|\n)\s*İNCELEME VE DEĞERLENDİRME\s*(?:$|\n|:)/u
  );

  add(
    "enforcement_payment_order",
    12,
    /(?:^|\n)\s*ÖDEME EMRİ\s*(?:$|\n|:)/u
  );
  add(
    "enforcement_payment_order",
    6,
    /İCRA DAİRESİ/u
  );
  add(
    "enforcement_payment_order",
    5,
    /(?:^|\n)\s*TAKİP TALEBİ\s*(?:$|\n|:)/u
  );
  add(
    "enforcement_payment_order",
    4,
    /TAKİP DOSYA NO/u
  );
  add(
    "enforcement_payment_order",
    2,
    /(?:^|\n)\s*BORÇLU\s*[:\n]/u
  );
  add(
    "enforcement_payment_order",
    2,
    /(?:^|\n)\s*ALACAKLI\s*[:\n]/u
  );

  const ranked =
    [...scores.entries()]
      .sort((left, right) =>
        right[1] - left[1]
      );
  const winner = ranked[0];

  if (
    !winner ||
    winner[1] < CLASSIFICATION_THRESHOLD
  ) {
    return {
      documentType: "unknown",
      documentTypeConfidence: 0,
    };
  }

  const runnerUpScore =
    ranked[1]?.[1] || 0;
  const scoreStrength =
    Math.min(1, winner[1] / 18);
  const separation =
    (winner[1] - runnerUpScore) /
    winner[1];

  return {
    documentType: winner[0],
    documentTypeConfidence:
      roundConfidence(
        0.55 +
        scoreStrength * 0.3 +
        separation * 0.14
      ),
  };
}

export function resolveDocumentExtractionProfile(
  documentType: LegalDocumentType
): DocumentExtractionProfile {
  if (documentType === "petition") {
    return "petition";
  }

  if (
    documentType ===
      "uets_notification"
  ) {
    return "uets";
  }

  return "generic";
}
