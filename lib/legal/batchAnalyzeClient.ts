import {
  groupBatchDocuments,
  type BatchDocumentCandidate,
} from "@/lib/legal/batchDocuments";

export type BatchAnalyzeProgress = {
  completed: number;
  total: number;
  currentFile: string;
};

export type BatchAnalyzeFailure = {
  fileName: string;
  error: string;
};

export type BatchAnalyzeResult = {
  candidates: BatchDocumentCandidate[];
  failures: BatchAnalyzeFailure[];

  filesById: Map<
    string,
    File
  >;

  grouped: ReturnType<
    typeof groupBatchDocuments
  >;
};

type AnalyzeResponse = {
  ok?: boolean;

  error?: string;

  source?: {
    sourceDocument?: string;
    documentIdentity?: string;
  };

  document?: {
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
    plaintiff?: string | null;
    defendant?: string | null;
    lawyers?: string[];

    documentDate?: string;

    hearing?: {
      date?: string;
      time?: string;
    };

    deadlines?: Array<{
      isExplicitFinalDate?: boolean;
      explicitDate?: string;
      durationText?: string;
    }>;

    payment?: {
      paymentAmount?: number | null;
      paymentCurrency?: string;
      paymentDescription?: string;
      paymentDueDate?: string;
      paymentPeriodText?: string;
    };

    uets?: {
      barcodeNo?: string;
    };

    needsHumanReview?: boolean;
  };
};

function supportedBatchFile(
  file: File
) {
  const name =
    file.name
      .toLocaleLowerCase(
        "tr-TR"
      );

  return (
    name.endsWith(".pdf") ||
    name.endsWith(".udf") ||
    name.endsWith(".odt") ||
    name.endsWith(".odf")
  );
}

async function readJsonResponseSafe(
  response: Response
) {
  const text =
    await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(
      text
    ) as AnalyzeResponse;
  } catch {
    return {
      ok: false,
      error:
        "Analiz sunucusundan geçersiz yanıt alındı.",
    } satisfies AnalyzeResponse;
  }
}

export async function analyzeBatchDocumentFile(
  file: File,
  id: string
): Promise<BatchDocumentCandidate> {
  if (
    !supportedBatchFile(
      file
    )
  ) {
    throw new Error(
      "Bu toplu aktarım sürümünde PDF, UDF, ODT ve ODF destekleniyor."
    );
  }

  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );

  const response =
    await fetch(
      "/api/uets/document-analyze",
      {
        method: "POST",
        body: formData,
      }
    );

  const data =
    await readJsonResponseSafe(
      response
    );

  if (
    !response.ok ||
    data.ok !== true ||
    !data.document
  ) {
    throw new Error(
      data.error ||
        "Belge analiz edilemedi."
    );
  }

  const document =
    data.document;

  const deadlines =
    Array.isArray(
      document.deadlines
    )
      ? document.deadlines
      : [];

  const explicitDeadline =
    deadlines.find(
      (item) =>
        item
          ?.isExplicitFinalDate ===
          true &&
        Boolean(
          item.explicitDate
        )
    )?.explicitDate || "";

  const relativePeriodText =
    deadlines.find(
      (item) =>
        item
          ?.isExplicitFinalDate !==
          true &&
        Boolean(
          item.durationText
        )
    )?.durationText || "";

  const payment =
    document.payment || {};

  const hearing =
    document.hearing || {};

  return {
    id,

    fileName:
      data.source
        ?.sourceDocument ||
      file.name,

    documentIdentity:
      data.source
        ?.documentIdentity ||
      "",

    documentType:
      document.documentType ||
      "",

    documentTypeLabel:
      document
        .documentTypeLabel ||
      "",

    documentTypeConfidence:
      typeof document
        .documentTypeConfidence ===
        "number"
        ? document
            .documentTypeConfidence
        : 0,

    court:
      document.court ||
      "",

    fileNo:
      document.fileNo ||
      "",

    decisionNo:
      document.decisionNo ||
      "",

    subject:
      document.subject ||
      "",

    caseType:
      document.caseType ||
      document.subject ||
      document
        .documentTypeLabel ||
      "",

    caseValue:
      typeof document.caseValue ===
        "number"
        ? document.caseValue
        : null,

    caseValueCurrency:
      document
        .caseValueCurrency ||
      "",

    resultAndRequest:
      document
        .resultAndRequest ||
      "",

    interimMeasureRequested:
      document
        .interimMeasureRequested ===
      true,

    parties:
      document.parties ||
      "",

    plaintiff:
      document.plaintiff ||
      "",

    defendant:
      document.defendant ||
      "",

    lawyers:
      Array.isArray(
        document.lawyers
      )
        ? document.lawyers
        : [],

    documentDate:
      document.documentDate ||
      "",

    hearingDate:
      hearing.date ||
      "",

    hearingTime:
      hearing.time ||
      "",

    explicitDeadline,

    relativePeriodText:
      relativePeriodText ||
      "",

    paymentAmount:
      typeof payment
        .paymentAmount ===
        "number"
        ? payment.paymentAmount
        : null,

    paymentCurrency:
      payment
        .paymentCurrency ||
      "",

    paymentDescription:
      payment
        .paymentDescription ||
      "",

    paymentDueDate:
      payment
        .paymentDueDate ||
      "",

    paymentPeriodText:
      payment
        .paymentPeriodText ||
      "",

    barcodeNo:
      document.uets
        ?.barcodeNo ||
      "",

    needsHumanReview:
      document
        .needsHumanReview ===
      true,
  };
}

export async function analyzeLegalBatchFiles(
  files: File[],
  onProgress?: (
    progress: BatchAnalyzeProgress
  ) => void
): Promise<BatchAnalyzeResult> {
  const candidates:
    BatchDocumentCandidate[] =
    [];

  const failures:
    BatchAnalyzeFailure[] =
    [];

  const filesById =
    new Map<
      string,
      File
    >();

  let completed = 0;

  /*
   * Aynı anda sadece iki ağır
   * belge analizi çalıştırıyoruz.
   *
   * Böylece çoklu PDF/UDF seçiminde
   * tarayıcı ve API boğulmuyor.
   */
  const concurrency = 2;

  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index =
        nextIndex++;

      if (
        index >=
        files.length
      ) {
        return;
      }

      const file =
        files[index];

      try {
        const candidateId =
          index +
          "-" +
          file.name +
          "-" +
          file.size +
          "-" +
          file.lastModified;

        filesById.set(
          candidateId,
          file
        );

        const candidate =
          await analyzeBatchDocumentFile(
            file,
            candidateId
          );

        candidates.push(
          candidate
        );
      } catch (error) {
        failures.push({
          fileName:
            file.name,

          error:
            error instanceof
              Error
              ? error.message
              : "Belge analiz edilemedi.",
        });
      } finally {
        completed += 1;

        onProgress?.({
          completed,
          total:
            files.length,
          currentFile:
            file.name,
        });
      }
    }
  }

  await Promise.all(
    Array.from(
      {
        length:
          Math.min(
            concurrency,
            Math.max(
              files.length,
              1
            )
          ),
      },
      () => worker()
    )
  );

  return {
    candidates,

    failures,

    filesById,

    grouped:
      groupBatchDocuments(
        candidates
      ),
  };
}
