export type UetsRecordInput = {
  barcodeNo?: string;
  fileNo?: string;
  court?: string;
  institution?: string;

  arrivalDate?: string;
  arrivalTime?: string;
  deemedServiceDate?: string;

  subject?: string;
  sender?: string;

  gmailMessageId?: string;
  gmailThreadId?: string;

  sourceText?: string;
};

export type UetsIdentityStrength =
  | "strong"
  | "medium"
  | "weak"
  | "insufficient";

export type UetsComparisonStatus =
  | "new"
  | "duplicate"
  | "updated"
  | "conflict";

export type UetsRecordIdentity = {
  identityKey: string;
  fingerprint: string;

  strength: UetsIdentityStrength;

  normalized: {
    barcodeNo: string;
    fileNo: string;
    court: string;
    institution: string;

    arrivalDate: string;
    arrivalTime: string;
    deemedServiceDate: string;

    subject: string;
    sender: string;

    gmailMessageId: string;
    gmailThreadId: string;
  };

  components: string[];
  warnings: string[];
};

export type UetsRecordComparison = {
  status: UetsComparisonStatus;

  sameIdentity: boolean;
  sameFingerprint: boolean;

  changedFields: string[];
  conflictingFields: string[];

  existing: UetsRecordIdentity;
  incoming: UetsRecordIdentity;

  explanation: string;
};

function safeText(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeTurkishText(value: unknown): string {
  return safeText(value)
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompactText(value: unknown): string {
  return normalizeTurkishText(value)
    .replace(/[^a-z0-9çğıöşü]+/gi, "")
    .trim();
}

function normalizeBarcode(value: unknown): string {
  return safeText(value)
    .replace(/\D+/g, "")
    .trim();
}

function normalizeFileNo(value: unknown): string {
  const text = safeText(value);

  const match = text.match(
    /\b(20\d{2})\s*\/\s*(\d{1,12})\b/
  );

  if (!match) {
    return normalizeCompactText(text);
  }

  return `${match[1]}/${match[2]}`;
}

function normalizeIsoDate(value: unknown): string {
  const text = safeText(value);

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(text)
  ) {
    return text;
  }

  const dotted = text.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](20\d{2})$/
  );

  if (!dotted) {
    return "";
  }

  return [
    dotted[3],
    dotted[2].padStart(2, "0"),
    dotted[1].padStart(2, "0"),
  ].join("-");
}

function normalizeTime(value: unknown): string {
  const text = safeText(value);

  const match = text.match(
    /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/
  );

  if (!match) {
    return "";
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function stableHash(value: string): string {
  let hashOne = 2166136261;
  let hashTwo = 0x811c9dc5;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    const code =
      value.charCodeAt(index);

    hashOne ^= code;
    hashOne = Math.imul(
      hashOne,
      16777619
    );

    hashTwo += code;
    hashTwo = Math.imul(
      hashTwo ^ (hashTwo >>> 13),
      2246822519
    );
  }

  const first =
    (hashOne >>> 0)
      .toString(16)
      .padStart(8, "0");

  const second =
    (hashTwo >>> 0)
      .toString(16)
      .padStart(8, "0");

  return `${first}${second}`;
}

function createIdentityKey(
  components: string[]
): string {
  return `uets-${stableHash(
    components.join("|")
  )}`;
}

function getStrength(params: {
  barcodeNo: string;
  fileNo: string;
  arrivalDate: string;
  court: string;
  institution: string;
}): UetsIdentityStrength {
  if (
    params.barcodeNo &&
    params.arrivalDate
  ) {
    return "strong";
  }

  if (
    params.fileNo &&
    params.arrivalDate &&
    params.court
  ) {
    return "strong";
  }

  if (
    params.fileNo &&
    params.arrivalDate
  ) {
    return "medium";
  }

  if (
    params.arrivalDate &&
    params.court &&
    params.institution
  ) {
    return "medium";
  }

  if (
    params.arrivalDate ||
    params.fileNo ||
    params.barcodeNo
  ) {
    return "weak";
  }

  return "insufficient";
}

function createComponents(params: {
  barcodeNo: string;
  fileNo: string;
  court: string;
  institution: string;
  arrivalDate: string;
}): string[] {
  if (
    params.barcodeNo &&
    params.arrivalDate
  ) {
    return [
      "barcode",
      params.barcodeNo,
      params.arrivalDate,
    ];
  }

  if (
    params.fileNo &&
    params.arrivalDate &&
    params.court
  ) {
    return [
      "case",
      params.fileNo,
      params.arrivalDate,
      params.court,
    ];
  }

  if (
    params.fileNo &&
    params.arrivalDate
  ) {
    return [
      "case-date",
      params.fileNo,
      params.arrivalDate,
      params.institution,
    ];
  }

  return [
    "fallback",
    params.arrivalDate,
    params.court,
    params.institution,
  ].filter(Boolean);
}

export function createUetsRecordIdentity(
  input: UetsRecordInput
): UetsRecordIdentity {
  const normalized = {
    barcodeNo:
      normalizeBarcode(
        input.barcodeNo
      ),

    fileNo:
      normalizeFileNo(
        input.fileNo
      ),

    court:
      normalizeTurkishText(
        input.court
      ),

    institution:
      normalizeTurkishText(
        input.institution
      ),

    arrivalDate:
      normalizeIsoDate(
        input.arrivalDate
      ),

    arrivalTime:
      normalizeTime(
        input.arrivalTime
      ),

    deemedServiceDate:
      normalizeIsoDate(
        input.deemedServiceDate
      ),

    subject:
      normalizeTurkishText(
        input.subject
      ),

    sender:
      normalizeTurkishText(
        input.sender
      ),

    gmailMessageId:
      safeText(
        input.gmailMessageId
      ),

    gmailThreadId:
      safeText(
        input.gmailThreadId
      ),
  };

  const strength =
    getStrength({
      barcodeNo:
        normalized.barcodeNo,

      fileNo:
        normalized.fileNo,

      arrivalDate:
        normalized.arrivalDate,

      court:
        normalized.court,

      institution:
        normalized.institution,
    });

  const components =
    createComponents({
      barcodeNo:
        normalized.barcodeNo,

      fileNo:
        normalized.fileNo,

      court:
        normalized.court,

      institution:
        normalized.institution,

      arrivalDate:
        normalized.arrivalDate,
    });

  const warnings: string[] = [];

  if (!normalized.barcodeNo) {
    warnings.push(
      "UETS barkod numarası bulunamadı."
    );
  }

  if (!normalized.fileNo) {
    warnings.push(
      "Dosya numarası bulunamadı."
    );
  }

  if (!normalized.arrivalDate) {
    warnings.push(
      "Ulaşma tarihi bulunamadı."
    );
  }

  if (
    strength === "insufficient"
  ) {
    warnings.push(
      "Tebligatı güvenilir biçimde tekilleştirecek yeterli veri bulunamadı."
    );
  }

  const fingerprintPayload = [
    normalized.barcodeNo,
    normalized.fileNo,
    normalized.court,
    normalized.institution,
    normalized.arrivalDate,
    normalized.arrivalTime,
    normalized.deemedServiceDate,
    normalized.subject,
    normalized.sender,
  ].join("|");

  return {
    identityKey:
      createIdentityKey(
        components
      ),

    fingerprint:
      stableHash(
        fingerprintPayload
      ),

    strength,

    normalized,

    components,

    warnings,
  };
}

function compareField(
  fieldName: string,
  existingValue: string,
  incomingValue: string,
  changedFields: string[],
  conflictingFields: string[],
  conflictWhenDifferent = false
): void {
  if (
    existingValue === incomingValue
  ) {
    return;
  }

  if (
    !existingValue &&
    incomingValue
  ) {
    changedFields.push(
      fieldName
    );

    return;
  }

  if (
    existingValue &&
    !incomingValue
  ) {
    return;
  }

  if (
    existingValue &&
    incomingValue &&
    existingValue !== incomingValue
  ) {
    if (conflictWhenDifferent) {
      conflictingFields.push(
        fieldName
      );
    } else {
      changedFields.push(
        fieldName
      );
    }
  }
}

export function compareUetsRecords(
  existingInput: UetsRecordInput,
  incomingInput: UetsRecordInput
): UetsRecordComparison {
  const existing =
    createUetsRecordIdentity(
      existingInput
    );

  const incoming =
    createUetsRecordIdentity(
      incomingInput
    );

  const sameIdentity =
    existing.identityKey ===
    incoming.identityKey;

  const sameFingerprint =
    existing.fingerprint ===
    incoming.fingerprint;

  const changedFields: string[] = [];
  const conflictingFields: string[] = [];

  compareField(
    "barcodeNo",
    existing.normalized.barcodeNo,
    incoming.normalized.barcodeNo,
    changedFields,
    conflictingFields,
    true
  );

  compareField(
    "fileNo",
    existing.normalized.fileNo,
    incoming.normalized.fileNo,
    changedFields,
    conflictingFields,
    true
  );

  compareField(
    "arrivalDate",
    existing.normalized.arrivalDate,
    incoming.normalized.arrivalDate,
    changedFields,
    conflictingFields,
    true
  );

  compareField(
    "deemedServiceDate",
    existing.normalized.deemedServiceDate,
    incoming.normalized.deemedServiceDate,
    changedFields,
    conflictingFields,
    true
  );

  compareField(
    "court",
    existing.normalized.court,
    incoming.normalized.court,
    changedFields,
    conflictingFields
  );

  compareField(
    "institution",
    existing.normalized.institution,
    incoming.normalized.institution,
    changedFields,
    conflictingFields
  );

  compareField(
    "arrivalTime",
    existing.normalized.arrivalTime,
    incoming.normalized.arrivalTime,
    changedFields,
    conflictingFields
  );

  let status:
    UetsComparisonStatus;

  let explanation: string;

  if (!sameIdentity) {
    status = "new";

    explanation =
      "Gelen tebligat mevcut kayıtla aynı kimliğe sahip değil; yeni kayıt olarak değerlendirilmelidir.";
  } else if (
    conflictingFields.length > 0
  ) {
    status = "conflict";

    explanation =
      `Aynı tebligat kimliğinde çelişen alanlar bulundu: ${conflictingFields.join(
        ", "
      )}. Otomatik güncelleme yapılmamalıdır.`;
  } else if (
    sameFingerprint &&
    changedFields.length === 0
  ) {
    status = "duplicate";

    explanation =
      "Aynı tebligat daha önce işlenmiş; yeni takvim veya alarm kaydı oluşturulmamalıdır.";
  } else {
    status = "updated";

    explanation =
      changedFields.length > 0
        ? `Aynı tebligata ait yeni bilgiler bulundu: ${changedFields.join(
            ", "
          )}. Mevcut kayıt güncellenebilir.`
        : "Aynı tebligatın içerik parmak izi değişmiş; mevcut kayıt kontrollü biçimde güncellenebilir.";
  }

  return {
    status,

    sameIdentity,
    sameFingerprint,

    changedFields,
    conflictingFields,

    existing,
    incoming,

    explanation,
  };
}

export function isReliableUetsIdentity(
  identity: UetsRecordIdentity
): boolean {
  return (
    identity.strength === "strong" ||
    identity.strength === "medium"
  );
}
