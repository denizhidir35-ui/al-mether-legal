import "server-only";

import {
  createRequire,
} from "node:module";

import {
  constants as fsConstants,
} from "node:fs";

import {
  access,
  stat,
} from "node:fs/promises";

import {
  dirname,
  join,
} from "node:path";

import {
  performance,
} from "node:perf_hooks";

const nodeRequire =
  createRequire(
    join(
      process.cwd(),
      "package.json"
    )
  );

export type LegalOcrResult = {
  text: string;

  engine:
    | "pdf-text"
    | "pdf-hybrid"
    | "tesseract";
};

const MIN_USEFUL_PDF_PAGE_CHARS =
  30;

function hasUsefulPdfPageText(
  pageText: string
) {
  return pageText
    .replace(/\s+/g, "")
    .length >=
    MIN_USEFUL_PDF_PAGE_CHARS;
}

export function createLegalPdfPagePlan(
  pages: string[]
) {
  return pages.map(
    (text, index) => ({
      pageNumber: index + 1,
      text,
      requiresOcr:
        !hasUsefulPdfPageText(
          text
        ),
    })
  );
}

function formatPdfPages(
  pages: string[]
) {
  return pages
    .map((pageText, index) =>
      pageText
        ? `--- SAYFA ${index + 1} ---\n${pageText}`
        : ""
    )
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export class PdfTextLayerRuntimeError extends Error {
  constructor(options?: ErrorOptions) {
    super(
      "PDF metin katmanı sunucuda okunamadı. Lütfen dosyayı yeniden deneyin.",
      options
    );

    this.name =
      "PdfTextLayerRuntimeError";
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message:
    string =
    "OCR işlemi zaman aşımına uğradı."
): Promise<T> {
  return new Promise<T>(
    (resolve, reject) => {
      const timeout =
        setTimeout(
          () =>
            reject(
              new Error(
                message
              )
            ),
          timeoutMs
        );

      promise.then(
        (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      );
    }
  );
}

function cleanOcrText(
  value: string
) {
  return String(
    value || ""
  )
    .replace(
      /\r/g,
      ""
    )
    .replace(
      /[ \t]+\n/g,
      "\n"
    )
    .replace(
      /[ \t]{2,}/g,
      " "
    )
    .replace(
      /\n{4,}/g,
      "\n\n"
    )
    .trim();
}

async function loadPdfJs() {
  /*
   * PDF.js 6.x Node'da Web Worker açmaz. WorkerMessageHandler'ı
   * aynı process içindeki fake-worker portuna bağlar.
   * Literal import, Vercel trace'inin worker modülünü pakete
   * dahil etmesini de garanti eder.
   */
  const worker =
    await import(
      "pdfjs-dist/legacy/build/pdf.worker.mjs"
    );

  const pdfjsWorkerGlobal =
    globalThis as typeof globalThis & {
      pdfjsWorker?: {
        WorkerMessageHandler:
          typeof worker.WorkerMessageHandler;
      };
    };

  pdfjsWorkerGlobal.pdfjsWorker = {
    WorkerMessageHandler:
      worker.WorkerMessageHandler,
  };

  return import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );
}

async function extractEmbeddedPdfText(
  bytes: Buffer
) {
  const {
    getDocument,
  } =
    await loadPdfJs();

  const loadingTask =
    getDocument({
      data:
        new Uint8Array(
          bytes
        ),
    });

  const pdf =
    await loadingTask.promise;

  try {
    const pages:
      string[] = [];

    let pagesWithText =
      0;

    for (
      let pageNo = 1;
      pageNo <=
      pdf.numPages;
      pageNo += 1
    ) {
      const page =
        await pdf.getPage(
          pageNo
        );

      const content =
        await page
          .getTextContent();

      const parts:
        string[] = [];

      for (
        const item
        of content.items
      ) {
        if (
          !(
            "str" in
            item
          )
        ) {
          continue;
        }

        const value =
          String(
            item.str ||
            ""
          );

        if (value) {
          parts.push(
            value
          );
        }

        if (
          "hasEOL" in
            item &&
          item.hasEOL
        ) {
          parts.push(
            "\n"
          );
        }
        else {
          parts.push(
            " "
          );
        }
      }

      const pageText =
        cleanOcrText(
          parts.join("")
        );

      if (
        hasUsefulPdfPageText(
          pageText
        )
      ) {
        pagesWithText +=
          1;
      }

      pages.push(
        pageText
      );

      try {
        page.cleanup();
      } catch {}
    }

    return {
      text:
        formatPdfPages(
          pages
        ),

      pageCount:
        pdf.numPages,

      pagesWithText,

      pages,
    };
  } finally {
    await loadingTask
      .destroy()
      .catch(
        () => {}
      );
  }
}

async function createLegalOcrWorker(
  timeoutMs?: number
) {
  const {
    createWorker,
  } =
    await import(
      "tesseract.js"
    );

  /*
   * Next/Turbopack'in worker dosyasını chunk içine
   * taşımasını engelle.
   *
   * Tesseract'ın gerçek Node worker-script dosyasını kullan.
   */
  const tesseractMain =
    nodeRequire.resolve(
      "tesseract.js"
    );

  const workerPath =
    join(
      dirname(
        tesseractMain
      ),
      "worker-script",
      "node",
      "index.js"
    );

  const workerPromise =
    createWorker(
    [
      "tur",
      "eng",
    ],

    undefined,

    {
      workerPath,
    }
  );

  if (!timeoutMs) {
    return workerPromise;
  }

  try {
    return await withTimeout(
      workerPromise,
      timeoutMs,
      "OCR motoru hazırlanırken zaman aşımına uğradı."
    );
  } catch (error) {
    void workerPromise
      .then((worker) =>
        worker.terminate()
      )
      .catch(() => {});
    throw error;
  }
}

type ImageOcrWorkerDiagnostics = {
  coldStarts: number;
  warmHits: number;
  lastInitMs: number;
  lastInitPhase: string;
  languages: string[];
  languageSource: "local-bundle";
};

const imageOcrDiagnostics:
  ImageOcrWorkerDiagnostics = {
    coldStarts: 0,
    warmHits: 0,
    lastInitMs: 0,
    lastInitPhase: "not-started",
    languages: [
      "tur",
      "eng",
    ],
    languageSource:
      "local-bundle",
  };

let imageOcrWorkerPromise:
  Promise<any> |
  null = null;

let imageOcrQueue:
  Promise<void> =
  Promise.resolve();

type ImageOcrRuntimeAsset = {
  asset:
    | "eng.traineddata"
    | "tur.traineddata"
    | "tesseract-worker"
    | "tesseract-core-js"
    | "tesseract-core-wasm";
  resolvedPath: string;
  exists: boolean;
  size: number | null;
  readable: boolean;
};

async function inspectImageOcrRuntimeAsset(
  asset: ImageOcrRuntimeAsset["asset"],
  resolvedPath: string
): Promise<ImageOcrRuntimeAsset> {
  let exists =
    false;

  let size:
    number |
    null =
    null;

  let readable =
    false;

  try {
    const fileStat =
      await stat(
        resolvedPath
      );

    exists =
      fileStat.isFile();

    size =
      exists
        ? fileStat.size
        : null;
  } catch {}

  try {
    await access(
      resolvedPath,
      fsConstants.R_OK
    );

    readable =
      true;
  } catch {}

  return {
    asset,
    resolvedPath,
    exists,
    size,
    readable,
  };
}

function safeImageOcrError(
  error: unknown
) {
  const type =
    error instanceof Error
      ? error.name ||
        "Error"
      : typeof error;

  const message =
    (
      error instanceof Error
        ? error.message
        : String(
            error ||
            "Unknown error"
          )
    )
      .replace(
        /[\r\n\t]+/g,
        " "
      )
      .replace(
        /\s{2,}/g,
        " "
      )
      .slice(
        0,
        240
      );

  return {
    type,
    message,
  };
}

async function resolveImageOcrRuntimeAssets(
  workerPath: string,
  langPath: string
) {
  const {
    simd,
    relaxedSimd,
  } =
    nodeRequire(
      "wasm-feature-detect"
    ) as {
      simd: () => Promise<boolean>;
      relaxedSimd: () => Promise<boolean>;
    };

  const [
    simdSupported,
    relaxedSimdSupported,
  ] =
    await Promise.all([
      simd(),
      relaxedSimd(),
    ]);

  const coreModule =
    relaxedSimdSupported
      ? "tesseract.js-core/tesseract-core-relaxedsimd-lstm"
      : simdSupported
        ? "tesseract.js-core/tesseract-core-simd-lstm"
        : "tesseract.js-core/tesseract-core-lstm";

  const coreJsPath =
    nodeRequire.resolve(
      coreModule
    );

  const coreWasmPath =
    coreJsPath.replace(
      /\.js$/u,
      ".wasm"
    );

  return Promise.all([
    inspectImageOcrRuntimeAsset(
      "eng.traineddata",
      join(
        langPath,
        "eng.traineddata"
      )
    ),
    inspectImageOcrRuntimeAsset(
      "tur.traineddata",
      join(
        langPath,
        "tur.traineddata"
      )
    ),
    inspectImageOcrRuntimeAsset(
      "tesseract-worker",
      workerPath
    ),
    inspectImageOcrRuntimeAsset(
      "tesseract-core-js",
      coreJsPath
    ),
    inspectImageOcrRuntimeAsset(
      "tesseract-core-wasm",
      coreWasmPath
    ),
  ]);
}

async function createLegalImageOcrWorker() {
  if (imageOcrWorkerPromise) {
    imageOcrDiagnostics.warmHits +=
      1;

    return imageOcrWorkerPromise;
  }

  imageOcrDiagnostics.coldStarts +=
    1;

  const startedAt =
    performance.now();

  const {
    createWorker,
  } =
    await import(
      "tesseract.js"
    );

  const tesseractMain =
    nodeRequire.resolve(
      "tesseract.js"
    );

  const workerPath =
    join(
      dirname(
        tesseractMain
      ),
      "worker-script",
      "node",
      "index.js"
    );

  const langPath =
    process.cwd();

  console.info(
    "[legal-image-ocr] init start",
    {
      cwd:
        process.cwd(),
      elapsedMs:
        Number(
          (
            performance.now() -
            startedAt
          ).toFixed(2)
        ),
    }
  );

  let runtimeAssets:
    ImageOcrRuntimeAsset[] =
    [];

  try {
    runtimeAssets =
      await resolveImageOcrRuntimeAssets(
        workerPath,
        langPath
      );
  } catch (error) {
    console.error(
      "[legal-image-ocr] asset inspection error",
      safeImageOcrError(
        error
      )
    );
  }

  for (
    const runtimeAsset
    of runtimeAssets
  ) {
    console.info(
      "[legal-image-ocr] runtime asset",
      runtimeAsset
    );
  }

  const phases =
    new Map<
      string,
      {
        firstMs: number;
        lastMs: number;
      }
    >();

  let loggedPhase =
    "";

  console.info(
    "[legal-image-ocr] init phase",
    {
      phase:
        "create worker",
      elapsedMs:
        Number(
          (
            performance.now() -
            startedAt
          ).toFixed(2)
        ),
    }
  );

  const workerPromise =
    createWorker(
      imageOcrDiagnostics.languages,
      undefined,
      {
        workerPath,
        langPath,
        gzip: false,
        cacheMethod:
          "none",
        errorHandler: (
          error: unknown
        ) => {
          console.error(
            "[legal-image-ocr] worker error",
            safeImageOcrError(
              error
            )
          );
        },
        logger: ({
          status,
        }: {
          status: string;
        }) => {
          if (
            ![
              "loading tesseract core",
              "initializing tesseract",
              "loading language traineddata",
              "initializing api",
            ].includes(
              status
            )
          ) {
            return;
          }

          const elapsedMs =
            performance.now() -
            startedAt;

          const phase =
            phases.get(
              status
            );

          phases.set(
            status,
            phase
              ? {
                  ...phase,
                  lastMs:
                    elapsedMs,
                }
              : {
                  firstMs:
                    elapsedMs,
                  lastMs:
                    elapsedMs,
                }
          );

          imageOcrDiagnostics.lastInitPhase =
            status;

          if (
            loggedPhase !==
            status
          ) {
            loggedPhase =
              status;

            console.info(
              "[legal-image-ocr] init phase",
              {
                phase:
                  status,
                elapsedMs:
                  Number(
                    elapsedMs.toFixed(
                      2
                    )
                  ),
              }
            );
          }
        },
      }
    );

  imageOcrWorkerPromise =
    withTimeout(
      workerPromise,
      12_000,
      "OCR motoru hazırlanırken zaman aşımına uğradı."
    )
      .then((worker) => {
        imageOcrDiagnostics.lastInitMs =
          Number(
            (
              performance.now() -
              startedAt
            ).toFixed(2)
          );

        imageOcrDiagnostics.lastInitPhase =
          "ready";

        (
          worker as typeof worker & {
            worker?: {
              unref?: () => void;
            };
          }
        ).worker?.unref?.();

        console.info(
          "[legal-image-ocr] worker ready",
          {
            durationMs:
              imageOcrDiagnostics.lastInitMs,
            phases:
              Object.fromEntries(
                Array.from(
                  phases.entries()
                ).map(
                  ([
                    phase,
                    timing,
                  ]) => [
                    phase,
                    {
                      firstMs:
                        Number(
                          timing.firstMs.toFixed(
                            2
                          )
                        ),
                      lastMs:
                        Number(
                          timing.lastMs.toFixed(
                            2
                          )
                        ),
                    },
                  ]
                )
              ),
          }
        );

        return worker;
      })
      .catch((error) => {
        const elapsedMs =
          Number(
            (
              performance.now() -
              startedAt
            ).toFixed(2)
          );

        if (
          error instanceof Error &&
          error.message ===
            "OCR motoru hazırlanırken zaman aşımına uğradı."
        ) {
          console.error(
            "[legal-image-ocr] init timeout",
            {
              lastInitPhase:
                imageOcrDiagnostics.lastInitPhase,
              elapsedMs,
            }
          );
        }

        imageOcrWorkerPromise =
          null;

        void workerPromise
          .then((worker) =>
            worker.terminate()
          )
          .catch(() => {});

        throw error;
      });

  return imageOcrWorkerPromise;
}

async function invalidateLegalImageOcrWorker(
  worker?: any
) {
  const current =
    imageOcrWorkerPromise;

  imageOcrWorkerPromise =
    null;

  const resolvedWorker =
    worker ||
    await current?.catch(
      () => null
    );

  await resolvedWorker
    ?.terminate()
    .catch(
      () => {}
    );
}

async function withLegalImageOcrWorker<T>(
  action: (
    worker: any
  ) => Promise<T>
) {
  const previous =
    imageOcrQueue;

  let release:
    () => void =
    () => {};

  imageOcrQueue =
    new Promise<void>(
      (resolve) => {
        release =
          resolve;
      }
    );

  await previous.catch(
    () => {}
  );

  let worker:
    any;

  try {
    worker =
      await createLegalImageOcrWorker();

    return await action(
      worker
    );
  } catch (error) {
    await invalidateLegalImageOcrWorker(
      worker
    );

    throw error;
  } finally {
    release();
  }
}

export function getLegalImageOcrDiagnostics() {
  return {
    ...imageOcrDiagnostics,
    languages: [
      ...imageOcrDiagnostics.languages,
    ],
  };
}

export async function resetLegalImageOcrWorkerForTests() {
  await invalidateLegalImageOcrWorker();

  imageOcrQueue =
    Promise.resolve();

  imageOcrDiagnostics.coldStarts =
    0;
  imageOcrDiagnostics.warmHits =
    0;
  imageOcrDiagnostics.lastInitMs =
    0;
  imageOcrDiagnostics.lastInitPhase =
    "not-started";
}

async function recognizeImage(
  worker: any,
  bytes: Buffer,
  timeoutMs = 45000
) {
  const result: any =
    await withTimeout<any>(
      worker.recognize(
        bytes
      ),

      timeoutMs,

      "Görsel OCR işlemi zaman aşımına uğradı."
    );

  return cleanOcrText(
    result?.data?.text ||
    ""
  );
}

async function renderPdfPageToPng(
  page: any
): Promise<Buffer> {
  const {
    createCanvas,
  } =
    await import(
      "@napi-rs/canvas"
    );

  /*
   * ~200 DPI civarı.
   * Hukuki belgede küçük yazılar için
   * 1.8 scale yeterli denge sağlar.
   */
  const viewport =
    page.getViewport({
      scale: 1.8,
    });

  const width =
    Math.max(
      1,
      Math.ceil(
        viewport.width
      )
    );

  const height =
    Math.max(
      1,
      Math.ceil(
        viewport.height
      )
    );

  const canvas =
    createCanvas(
      width,
      height
    );

  const context =
    canvas.getContext(
      "2d"
    );

  const renderTask =
    page.render({
      canvasContext:
        context as any,

      viewport,
    } as any);

  await withTimeout(
    renderTask.promise,

    30000,

    "PDF sayfası görüntüye çevrilemedi."
  );

  return Buffer.from(
    canvas.toBuffer(
      "image/png"
    )
  );
}

async function ocrPdfPages(
  bytes: Buffer,
  embeddedPages: string[] = []
) {
  const {
    getDocument,
  } =
    await loadPdfJs();

  const loadingTask =
    getDocument({
      data:
        new Uint8Array(
          bytes
        ),
    });

  const pdf =
    await loadingTask.promise;

  const pagePlan =
    createLegalPdfPagePlan(
      Array.from(
        { length: pdf.numPages },
        (_, index) =>
          embeddedPages[index] || ""
      )
    );
  const needsOcr =
    pagePlan.some(
      (item) =>
        item.requiresOcr
    );
  const worker =
    needsOcr
      ? await createLegalOcrWorker()
      : null;

  try {
    const pages:
      string[] = pagePlan.map(
        (item) => item.text
      );

    for (
      let pageNo = 1;
      pageNo <=
      pdf.numPages;
      pageNo += 1
    ) {
      const page =
        await pdf.getPage(
          pageNo
        );

      try {
        if (
          !pagePlan[pageNo - 1]
            .requiresOcr
        ) {
          continue;
        }

        const png =
          await renderPdfPageToPng(
            page
          );

        const pageText =
          await recognizeImage(
            worker,
            png,
            50000
          );

        pages[pageNo - 1] =
          pageText;
      } finally {
        try {
          page.cleanup();
        } catch {}
      }
    }

    return {
      text:
        formatPdfPages(
          pages
        ),
      ocrPageCount:
        pagePlan.filter(
          (item) =>
            item.requiresOcr
        ).length,
    };
  } finally {
    if (worker) {
      await worker
        .terminate()
        .catch(
          () => {}
        );
    }

    await loadingTask
      .destroy()
      .catch(
        () => {}
      );
  }
}

export async function extractLegalImageText(
  bytes: Buffer,
  mimeType: string
): Promise<LegalOcrResult> {
  void mimeType;

  if (
    !bytes ||
    bytes.length === 0
  ) {
    throw new Error(
      "OCR için görsel verisi bulunamadı."
    );
  }

  return withLegalImageOcrWorker(
    async (worker) => {
    const text =
      await recognizeImage(
        worker,
        bytes,
        30_000
      );

    if (!text) {
      throw new Error(
        "Görsel içerisinden okunabilir metin çıkarılamadı."
      );
    }

    return {
      text,

      engine:
        "tesseract",
    };
    }
  );
}

export async function extractLegalPdfText(
  bytes: Buffer
): Promise<LegalOcrResult> {
  if (
    !bytes ||
    bytes.length === 0
  ) {
    throw new Error(
      "PDF verisi bulunamadı."
    );
  }

  /*
   * 1) ÖNCE PDF TEXT LAYER
   *
   * Normal dijital PDF ise OCR yok.
   * En hızlı yol budur.
   */
  let embedded:
    Awaited<
      ReturnType<
        typeof extractEmbeddedPdfText
      >
    >;

  try {
    embedded =
      await extractEmbeddedPdfText(
        bytes
      );
  } catch (error) {
    /*
     * Parser/runtime/module hatası taranmış PDF kanıtı değildir.
     * Pahalı OCR'a geçmeden kontrollü hata dönülür.
     */
    throw new PdfTextLayerRuntimeError({
      cause: error,
    });
  }

  const compactLength =
    embedded.text
      .replace(
        /\s+/g,
        ""
      )
      .length;

  if (
    compactLength >= 80 &&
    embedded.pagesWithText ===
      embedded.pageCount
  ) {
    return {
      text:
        embedded.text,

      engine:
        "pdf-text",
    };
  }

  /*
   * 2) TARANMIŞ / MIXED PDF
   *
   * Yalnız text-layer bulunmayan sayfaları PNG'ye render edip OCR yap.
   * Text bulunan sayfalar sırası ve sayfa numarası korunarak doğrudan kullanılır.
   */
  const hybridResult =
    await ocrPdfPages(
      bytes,
      embedded.pages
    );

  if (!hybridResult.text) {
    throw new Error(
      "PDF içerisinden okunabilir metin çıkarılamadı."
    );
  }

  return {
    text:
      hybridResult.text,

    engine:
      embedded.pagesWithText > 0
        ? "pdf-hybrid"
        : "tesseract",
  };
}
