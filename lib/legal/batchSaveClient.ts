import type {
  BatchAnalyzeResult,
} from "./batchAnalyzeClient";

import type {
  BatchDocumentCandidate,
  BatchDocumentGroup,
} from "./batchDocuments";

export type BatchSaveProgress = {
  completedCases: number;
  totalCases: number;

  completedDocuments: number;
  totalDocuments: number;

  currentCase: string;
  currentFile: string;
};

export type BatchSaveFailure = {
  scope:
    | "case"
    | "metadata"
    | "document";

  groupKey: string;

  /*
   * Belge retry kimliği.
   * Dosya adı güvenli kimlik değildir.
   */
  candidateId?: string;
  documentIdentity?: string;

  fileName?: string;

  error: string;
};

export type BatchSaveResult = {
  createdCases: number;
  matchedCases: number;

  savedDocuments: number;
  duplicateDocuments: number;

  skippedReviewCases: number;
  inputDuplicateDocuments: number;

  failures: BatchSaveFailure[];
};

export type BatchSaveOptions = {
  status?:
    | "active"
    | "archived";

  /*
   * Dava kaydı başarısız olduysa
   * grubun tamamı yeniden denenir.
   */
  retryGroupKeys?: ReadonlySet<string>;

  /*
   * Belge kaydı başarısız olduysa
   * yalnız ilgili candidate yeniden denenir.
   */
  retryDocumentIds?: ReadonlySet<string>;
};

function documentsForGroup(
  group: BatchDocumentGroup,
  options?: BatchSaveOptions
) {
  const hasRetryFilter =
    Boolean(
      options?.retryGroupKeys
        ?.size ||
      options?.retryDocumentIds
        ?.size
    );

  if (!hasRetryFilter) {
    return group.documents;
  }

  if (
    options?.retryGroupKeys?.has(
      group.key
    )
  ) {
    return group.documents;
  }

  const retryDocumentIds =
    options?.retryDocumentIds;

  if (
    !retryDocumentIds ||
    retryDocumentIds.size === 0
  ) {
    return [];
  }

  return group.documents.filter(
    (document) =>
      retryDocumentIds.has(
        document.id
      )
  );
}

function isDocumentIdentity(
  value: string | undefined
) {
  return Boolean(
    value &&
    /^[a-f0-9]{64}$/i.test(
      value.trim()
    )
  );
}


async function readResponse(
  response: Response
): Promise<
  Record<string, unknown>
> {
  const raw =
    await response.text();

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as
      Record<string, unknown>;
  } catch {
    return {
      error: raw,
    };
  }
}

function getErrorMessage(
  data: Record<
    string,
    unknown
  >,
  fallback: string
) {
  return typeof data.error ===
    "string" &&
    data.error.trim()
    ? data.error
    : fallback;
}

function buildCaseTitle(
  group: BatchDocumentGroup
) {
  return group.summary
    .subject.trim();
}

function buildCaseNote(
  group: BatchDocumentGroup
) {
  const summary =
    group.summary;

  const sourceDocuments =
    group.documents
      .map(
        (document) =>
          document.fileName.trim()
      )
      .filter(Boolean);

  return [
    summary.decisionNo
      ? `Karar No: ${summary.decisionNo}`
      : "",

    summary.parties
      ? `Taraflar: ${summary.parties}`
      : "",

    summary.barcodeNo
      ? `Barkod/Tebligat No: ${summary.barcodeNo}`
      : "",

    summary.caseValue !== null
      ? `Dava Değeri: ${summary.caseValue}${
          summary.caseValueCurrency
            ? ` ${summary.caseValueCurrency}`
            : ""
        }`
      : "",

    summary.resultAndRequest
      ? `Sonuç ve İstem: ${summary.resultAndRequest}`
      : "",

    summary.relativePeriodText
      ? `Göreli Süre: ${summary.relativePeriodText}`
      : "",

    summary.paymentPeriodText
      ? `Ödeme Süresi: ${summary.paymentPeriodText}`
      : "",

    sourceDocuments.length
      ? `Kaynak Belgeler: ${sourceDocuments.join(
          ", "
        )}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function saveDocumentRecord(
  caseId: string,
  document: BatchDocumentCandidate
) {
  const response =
    await fetch(
      `/api/cases/${encodeURIComponent(
        caseId
      )}/document-records`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          documentIdentity:
            document.documentIdentity,

          fileName:
            document.fileName,

          documentType:
            document.documentType ||
            null,

          /*
           * Batch candidate mevcut
           * parser alanlarının tamamını
           * structured JSON olarak taşır.
           */
          parserData: {
            ...document,
          },
        }),
      }
    );

  const data =
    await readResponse(
      response
    );

  if (
    !response.ok ||
    data.ok !== true
  ) {
    throw new Error(
      getErrorMessage(
        data,
        "Parser kaydı oluşturulamadı."
      )
    );
  }

  return {
    duplicate:
      data.duplicate === true,
  };
}

async function saveAttachment(
  caseId: string,
  document: BatchDocumentCandidate,
  file: File
) {
  const documentIdentity =
    document.documentIdentity
      ?.trim()
      .toLowerCase() || "";

  const formData =
    new FormData();

  formData.append(
    "caseId",
    caseId
  );

  formData.append(
    "file",
    file
  );

  formData.append(
    "documentIdentity",
    documentIdentity
  );

  const response =
    await fetch(
      "/api/attachments",
      {
        method: "POST",
        body: formData,
      }
    );

  const data =
    await readResponse(
      response
    );

  if (
    !response.ok ||
    data.ok !== true
  ) {
    throw new Error(
      getErrorMessage(
        data,
        "Belge dosyası kaydedilemedi."
      )
    );
  }

  return {
    duplicate:
      data.duplicate === true,
  };
}

async function resolveCase(
  group: BatchDocumentGroup,
  status:
    | "active"
    | "archived"
) {
  const firstDocumentIdentity =
    group.documents
      .map(
        (document) =>
          document
            .documentIdentity
            ?.trim()
            .toLowerCase()
      )
      .find(
        (identity) =>
          isDocumentIdentity(
            identity
          )
      ) || "";

  const response =
    await fetch(
      "/api/cases",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          case_title:
            buildCaseTitle(
              group
            ),

          case_number:
            group.fileNo ||
            null,

          court_name:
            group.court ||
            null,

          case_type:
            group.summary
              .caseType ||
            null,

          status:
            status,

          risk_level:
            "normal",

          note:
            buildCaseNote(
              group
            ) ||
            null,

          source:
            "document_upload",

          document_identity:
            firstDocumentIdentity ||
            null,
        }),
      }
    );

  const data =
    await readResponse(
      response
    );

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
        "Dava oluşturulamadı."
      )
    );
  }

  const legalCase =
    data.case;

  if (
    !legalCase ||
    typeof legalCase !==
      "object"
  ) {
    throw new Error(
      "Dava kimliği alınamadı."
    );
  }

  const caseId =
    (
      legalCase as
        Record<
          string,
          unknown
        >
    ).id;

  if (
    typeof caseId !==
      "string" ||
    !caseId.trim()
  ) {
    throw new Error(
      "Dava kimliği alınamadı."
    );
  }

  return {
    caseId,

    duplicate:
      data.duplicate === true,
  };
}

function normalizePartyIdentity(
  value: string
) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLabeledParty(
  parties: string,
  label:
    | "Müvekkil"
    | "Davacı"
    | "Davalı"
) {
  const escapedLabel =
    label.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
  const match =
    parties.match(
      new RegExp(
        `(?:^|[\\n;])\\s*${escapedLabel}\\s*:\\s*(.+?)(?=(?:[\\n;]\\s*(?:Müvekkil|Davacı|Davalı|Vekil)\\s*:)|$)`,
        "iu"
      )
    );

  return match?.[1]?.trim() || "";
}

async function saveCaseParties(
  caseId: string,
  group: BatchDocumentGroup
) {
  const labeledClient =
    extractLabeledParty(
      group.summary.parties,
      "Müvekkil"
    );
  const labeledPlaintiff =
    extractLabeledParty(
      group.summary.parties,
      "Davacı"
    );
  const labeledDefendant =
    extractLabeledParty(
      group.summary.parties,
      "Davalı"
    );

  const candidates = [
    labeledClient
      ? {
          role: "muvekkil",
          name: labeledClient,
          isClient: true,
        }
      : null,
    (
      group.summary.plaintiff ||
      labeledPlaintiff
    )
      ? {
          role: "davaci",
          name:
            group.summary.plaintiff ||
            labeledPlaintiff,
          isClient: false,
        }
      : null,
    (
      group.summary.defendant ||
      labeledDefendant
    )
      ? {
          role: "davali",
          name:
            group.summary.defendant ||
            labeledDefendant,
          isClient: false,
        }
      : null,
    ...group.summary.lawyers.map(
      (name) => ({
        role: "vekil",
        name,
        isClient: false,
      })
    ),
  ].filter(
    (
      item
    ): item is {
      role: string;
      name: string;
      isClient: boolean;
    } => Boolean(item?.name.trim())
  );

  if (candidates.length === 0) {
    return;
  }

  const endpoint =
    `/api/cases/${encodeURIComponent(
      caseId
    )}/parties`;

  const existingResponse =
    await fetch(endpoint, {
      cache: "no-store",
    });

  const existingData =
    await readResponse(
      existingResponse
    );

  if (!existingResponse.ok) {
    throw new Error(
      getErrorMessage(
        existingData,
        "Taraf kayıtları alınamadı."
      )
    );
  }

  const existingParties =
    Array.isArray(
      existingData.parties
    )
      ? existingData.parties
      : [];

  const identities =
    new Set(
      existingParties.flatMap(
        (party) => {
          if (
            !party ||
            typeof party !==
              "object"
          ) {
            return [];
          }

          const record =
            party as Record<
              string,
              unknown
            >;
          const role =
            typeof record.role ===
              "string"
              ? record.role
              : "";
          const name =
            typeof record.name ===
              "string"
              ? record.name
              : "";

          return [
            role + ":" +
              normalizePartyIdentity(
                name
              ),
          ];
        }
      )
    );

  for (const party of candidates) {
    const identity =
      party.role + ":" +
      normalizePartyIdentity(
        party.name
      );

    if (identities.has(identity)) {
      continue;
    }

    const response =
      await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          role: party.role,
          party_type: "person",
          name: party.name,
          is_client:
            party.isClient,
        }),
      });

    const data =
      await readResponse(response);

    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          data,
          `${party.name} taraf kaydı oluşturulamadı.`
        )
      );
    }

    identities.add(identity);
  }
}

async function saveCaseDates(
  caseId: string,
  group: BatchDocumentGroup
) {
  const hearingAt =
    group.summary.hearingDate &&
    group.summary.hearingTime
      ? `${group.summary.hearingDate}T${group.summary.hearingTime}`
      : "";

  const manualDeadline =
    group.summary.explicitDeadline ||
    "";

  if (!hearingAt && !manualDeadline) {
    return;
  }

  const response =
    await fetch(
      "/api/cases/manual-calendar",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          caseId,
          hearingAt:
            hearingAt || null,
          manualDeadline:
            manualDeadline || null,
          note:
            buildCaseNote(group) ||
            null,
        }),
      }
    );

  const data =
    await readResponse(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
        "Duruşma / son tarih kaydedilemedi."
      )
    );
  }
}

async function saveCaseAutofill(
  caseId: string,
  group: BatchDocumentGroup
) {
  const failures: string[] = [];

  try {
    await saveCaseParties(
      caseId,
      group
    );
  } catch (error) {
    failures.push(
      error instanceof Error
        ? error.message
        : "Taraflar kaydedilemedi."
    );
  }

  try {
    await saveCaseDates(
      caseId,
      group
    );
  } catch (error) {
    failures.push(
      error instanceof Error
        ? error.message
        : "Duruşma / son tarih kaydedilemedi."
    );
  }

  return failures;
}

export async function saveLegalBatch(
  batch: BatchAnalyzeResult,

  onProgress?: (
    progress:
      BatchSaveProgress
  ) => void,

  options?: BatchSaveOptions
): Promise<BatchSaveResult> {
  const eligibleGroups =
    batch.grouped.groups.filter(
      (group) =>
        !group.needsReview
    );

  /*
   * Kontrol gerektiren gruplar ile
   * retry filtresini birbirine karıştırma.
   */
  const skippedReviewCases =
    batch.grouped.groups.length -
    eligibleGroups.length;

  const safeGroups =
    eligibleGroups.filter(
      (group) =>
        documentsForGroup(
          group,
          options
        ).length > 0
    );

  const totalDocuments =
    safeGroups.reduce(
      (
        total,
        group
      ) =>
        total +
        documentsForGroup(
          group,
          options
        ).length,
      0
    );

  let completedCases = 0;
  let completedDocuments = 0;

  let createdCases = 0;
  let matchedCases = 0;

  let savedDocuments = 0;
  let duplicateDocuments = 0;

  const failures:
    BatchSaveFailure[] =
    [];

  const notify = (
    currentCase: string,
    currentFile: string
  ) => {
    onProgress?.({
      completedCases,
      totalCases:
        safeGroups.length,

      completedDocuments,
      totalDocuments,

      currentCase,
      currentFile,
    });
  };

  for (
    const group
    of safeGroups
  ) {
    const currentCase =
      [
        group.fileNo,
        group.court,
      ]
        .filter(Boolean)
        .join(" · ");

    const groupDocuments =
      documentsForGroup(
        group,
        options
      );

    let caseId = "";

    try {
      const caseResult =
        await resolveCase(
          group,
          options?.status ||
            "active"
        );

      caseId =
        caseResult.caseId;

      if (
        caseResult.duplicate
      ) {
        matchedCases += 1;
      } else {
        createdCases += 1;
      }

      const autofillFailures =
        await saveCaseAutofill(
          caseId,
          group
        );

      if (
        autofillFailures.length > 0
      ) {
        failures.push({
          scope: "metadata",
          groupKey: group.key,
          error:
            autofillFailures.join(
              " "
            ),
        });
      }
    } catch (error) {
      failures.push({
        scope: "case",

        groupKey:
          group.key,

        error:
          error instanceof
            Error
            ? error.message
            : "Dava kaydedilemedi.",
      });

      completedCases += 1;

      completedDocuments +=
        groupDocuments.length;

      notify(
        currentCase,
        ""
      );

      continue;
    }

    for (
      const document
      of groupDocuments
    ) {
      const file =
        batch.filesById.get(
          document.id
        );

      try {

        if (
          !isDocumentIdentity(
            document
              .documentIdentity
          )
        ) {
          throw new Error(
            "Belge SHA-256 kimliği bulunamadı."
          );
        }

        if (!file) {
          throw new Error(
            "Orijinal dosya nesnesi bulunamadı."
          );
        }

        /*
         * Önce structured parser
         * metadata yazılır.
         *
         * Attachment başarısız olursa
         * sonraki denemede metadata
         * duplicate dönerek güvenli
         * biçimde devam eder.
         */
        const recordResult =
          await saveDocumentRecord(
            caseId,
            document
          );

        const attachmentResult =
          await saveAttachment(
            caseId,
            document,
            file
          );

        if (
          recordResult.duplicate &&
          attachmentResult.duplicate
        ) {
          duplicateDocuments += 1;
        } else {
          savedDocuments += 1;
        }
      } catch (error) {
        failures.push({
          scope:
            "document",

          groupKey:
            group.key,

          candidateId:
            document.id,

          documentIdentity:
            document.documentIdentity
              ?.trim()
              .toLowerCase(),

          fileName:
            document.fileName,

          error:
            error instanceof
              Error
              ? error.message
              : "Belge kaydedilemedi.",
        });
      } finally {
        completedDocuments += 1;

        notify(
          currentCase,
          document.fileName
        );
      }
    }

    completedCases += 1;

    notify(
      currentCase,
      ""
    );
  }

  return {
    createdCases,
    matchedCases,

    savedDocuments,
    duplicateDocuments,

    skippedReviewCases,

    inputDuplicateDocuments:
      options?.retryGroupKeys
        ?.size ||
      options?.retryDocumentIds
        ?.size
        ? 0
        : batch.grouped
            .duplicateDocuments,

    failures,
  };
}
