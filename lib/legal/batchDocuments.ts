export type BatchDocumentCandidate = {
  id: string;
  fileName: string;
  documentIdentity?: string;

  documentType?: string;
  documentTypeLabel?: string;
  documentTypeConfidence?: number;

  court?: string;
  fileNo?: string;
  decisionNo?: string;

  subject?: string;
  caseType?: string;

  caseValue?: number | null;
  caseValueCurrency?: string;
  resultAndRequest?: string;
  interimMeasureRequested?: boolean;

  parties?: string;
  plaintiff?: string;
  defendant?: string;
  lawyers?: string[];

  documentDate?: string;

  hearingDate?: string;
  hearingTime?: string;

  explicitDeadline?: string;
  relativePeriodText?: string;

  paymentAmount?: number | null;
  paymentCurrency?: string;
  paymentDescription?: string;
  paymentDueDate?: string;
  paymentPeriodText?: string;

  barcodeNo?: string;

  needsHumanReview?: boolean;
};

export type BatchCaseSummary = {
  documentTypeConfidence: number | null;

  court: string;
  fileNo: string;
  decisionNo: string;

  subject: string;
  caseType: string;

  caseValue: number | null;
  caseValueCurrency: string;
  resultAndRequest: string;
  interimMeasureRequested: boolean;

  parties: string;
  plaintiff: string;
  defendant: string;
  lawyers: string[];

  documentDate: string;

  hearingDate: string;
  hearingTime: string;

  explicitDeadline: string;
  relativePeriodText: string;

  paymentAmount: number | null;
  paymentCurrency: string;
  paymentDescription: string;
  paymentDueDate: string;
  paymentPeriodText: string;

  barcodeNo: string;

  documentTypes: string[];
};

export type BatchDocumentGroup = {
  key: string;
  court: string;
  fileNo: string;

  needsReview: boolean;

  documents: BatchDocumentCandidate[];

  summary: BatchCaseSummary;
};

function normalizeValue(
  value: string
) {
  return value
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLocaleLowerCase(
      "tr-TR"
    )
    .replace(
      /[^a-z0-9çğıöşü/]+/giu,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

export function normalizeCaseFileNo(
  value: string
) {
  const normalized =
    value
      .replace(/\s+/g, "")
      .toLocaleUpperCase(
        "tr-TR"
      );

  const match =
    normalized.match(
      /(\d{4}\/\d+)/
    );

  return match?.[1] || "";
}

export function buildCaseGroupKey(
  court: string,
  fileNo: string
) {
  const normalizedCourt =
    normalizeValue(court);

  const normalizedFileNo =
    normalizeCaseFileNo(
      fileNo
    );

  if (
    !normalizedCourt ||
    !normalizedFileNo
  ) {
    return "";
  }

  return [
    "case",
    normalizedCourt,
    normalizedFileNo,
  ].join(":");
}

function firstText(
  documents: BatchDocumentCandidate[],
  getter: (
    document: BatchDocumentCandidate
  ) => string | undefined
) {
  for (
    const document
    of documents
  ) {
    const value =
      getter(document)?.trim();

    if (value) {
      return value;
    }
  }

  return "";
}

function firstNumber(
  documents: BatchDocumentCandidate[],
  getter: (
    document: BatchDocumentCandidate
  ) => number | null | undefined
) {
  for (
    const document
    of documents
  ) {
    const value =
      getter(document);

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return null;
}

function bestCaseType(
  documents: BatchDocumentCandidate[]
) {
  const candidates =
    uniqueTexts(
      documents.flatMap(
        (document) => [
          document.caseType,
          document.subject,
          document.documentTypeLabel,
        ]
      )
    );

  const generic =
    new Set([
      "hukuki belge",
      "diger hukuki belge",
      "diğer hukuki belge",
      "unknown",
      "bilinmeyen",
    ]);

  return (
    candidates.find(
      (value) =>
        !generic.has(
          normalizeValue(value)
        )
    ) ||
    candidates[0] ||
    ""
  );
}

function uniqueTexts(
  values: Array<
    string | undefined
  >
) {
  const seen =
    new Set<string>();

  const result: string[] = [];

  for (
    const raw
    of values
  ) {
    const value =
      raw?.trim();

    if (!value) {
      continue;
    }

    const identity =
      normalizeValue(value);

    if (
      !identity ||
      seen.has(identity)
    ) {
      continue;
    }

    seen.add(identity);
    result.push(value);
  }

  return result;
}

function buildSummary(
  documents: BatchDocumentCandidate[]
): BatchCaseSummary {
  const lawyers =
    uniqueTexts(
      documents.flatMap(
        (document) =>
          document.lawyers || []
      )
    );

  const documentTypes =
    uniqueTexts(
      documents.map(
        (document) =>
          document.documentTypeLabel ||
          document.documentType
      )
    );

  return {
    documentTypeConfidence:
      firstNumber(
        documents,
        (document) =>
          document.documentTypeConfidence
      ),

    court:
      firstText(
        documents,
        (document) =>
          document.court
      ),

    fileNo:
      normalizeCaseFileNo(
        firstText(
          documents,
          (document) =>
            document.fileNo
        )
      ),

    decisionNo:
      firstText(
        documents,
        (document) =>
          document.decisionNo
      ),

    subject:
      firstText(
        documents,
        (document) =>
          document.subject
      ),

    caseType:
      bestCaseType(
        documents
      ),

    caseValue:
      firstNumber(
        documents,
        (document) =>
          document.caseValue
      ),

    caseValueCurrency:
      firstText(
        documents,
        (document) =>
          document.caseValueCurrency
      ),

    resultAndRequest:
      firstText(
        documents,
        (document) =>
          document.resultAndRequest
      ),

    interimMeasureRequested:
      documents.some(
        (document) =>
          document
            .interimMeasureRequested ===
          true
      ),

    parties:
      firstText(
        documents,
        (document) =>
          document.parties
      ),

    plaintiff:
      firstText(
        documents,
        (document) =>
          document.plaintiff
      ),

    defendant:
      firstText(
        documents,
        (document) =>
          document.defendant
      ),

    lawyers,

    documentDate:
      firstText(
        documents,
        (document) =>
          document.documentDate
      ),

    hearingDate:
      firstText(
        documents,
        (document) =>
          document.hearingDate
      ),

    hearingTime:
      firstText(
        documents,
        (document) =>
          document.hearingTime
      ),

    explicitDeadline:
      firstText(
        documents,
        (document) =>
          document.explicitDeadline
      ),

    relativePeriodText:
      firstText(
        documents,
        (document) =>
          document.relativePeriodText
      ),

    paymentAmount:
      firstNumber(
        documents,
        (document) =>
          document.paymentAmount
      ),

    paymentCurrency:
      firstText(
        documents,
        (document) =>
          document.paymentCurrency
      ),

    paymentDescription:
      firstText(
        documents,
        (document) =>
          document.paymentDescription
      ),

    paymentDueDate:
      firstText(
        documents,
        (document) =>
          document.paymentDueDate
      ),

    paymentPeriodText:
      firstText(
        documents,
        (document) =>
          document.paymentPeriodText
      ),

    barcodeNo:
      firstText(
        documents,
        (document) =>
          document.barcodeNo
      ),

    documentTypes,
  };
}

function removeIdentityDuplicates(
  documents: BatchDocumentCandidate[]
) {
  const seen =
    new Set<string>();

  return documents.filter(
    (document) => {
      const identity =
        document
          .documentIdentity
          ?.trim();

      if (!identity) {
        return true;
      }

      if (
        seen.has(identity)
      ) {
        return false;
      }

      seen.add(identity);

      return true;
    }
  );
}

export function groupBatchDocuments(
  input: BatchDocumentCandidate[]
) {
  const documents =
    removeIdentityDuplicates(
      input
    );

  const grouped =
    new Map<
      string,
      BatchDocumentCandidate[]
    >();

  for (
    const document
    of documents
  ) {
    const court =
      document.court?.trim() ||
      "";

    const fileNo =
      normalizeCaseFileNo(
        document.fileNo || ""
      );

    /*
     * Güvenli otomatik eşleştirme:
     *
     * Mahkeme + Esas No ikisi de
     * bulunmadan başka bir belgeyle
     * aynı dava kabul etmiyoruz.
     */
    const safeCaseKey =
      buildCaseGroupKey(
        court,
        fileNo
      );

    const key =
      safeCaseKey ||
      `review:${document.id}`;

    const current =
      grouped.get(key);

    if (current) {
      current.push(document);
    } else {
      grouped.set(
        key,
        [document]
      );
    }
  }

  const groups:
    BatchDocumentGroup[] =
    Array.from(
      grouped.entries()
    ).map(
      ([key, groupDocuments]) => {
        const summary =
          buildSummary(
            groupDocuments
          );

        const parserNeedsReview =
          groupDocuments.some(
            (document) =>
              document
                .needsHumanReview ===
              true
          );

        const identityComplete =
          Boolean(
            summary.court &&
            summary.fileNo
          );

        return {
          key,

          court:
            summary.court,

          fileNo:
            summary.fileNo,

          needsReview:
            !identityComplete ||
            parserNeedsReview,

          documents:
            groupDocuments,

          summary,
        };
      }
    );

  return {
    groups,

    totalDocuments:
      input.length,

    uniqueDocuments:
      documents.length,

    duplicateDocuments:
      input.length -
      documents.length,

    totalCases:
      groups.filter(
        (group) =>
          Boolean(
            group.court &&
            group.fileNo
          )
      ).length,

    reviewRequired:
      groups.filter(
        (group) =>
          group.needsReview
      ).length,
  };
}
