import "server-only";

import {
  createRequire,
} from "node:module";

import {
  dirname,
  join,
} from "node:path";

import {
  pathToFileURL,
} from "node:url";

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
    | "tesseract";
};

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message:
    string =
    "OCR işlemi zaman aşımına uğradı."
): Promise<T> {
  return Promise.race([
    promise,

    new Promise<T>(
      (_resolve, reject) => {
        const timeout =
          setTimeout(
            () => {
              clearTimeout(
                timeout
              );

              reject(
                new Error(
                  message
                )
              );
            },
            timeoutMs
          );
      }
    ),
  ]);
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
  const pdfjs =
    await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );

  /*
   * Next/Turbopack bundle içindeki sahte worker yerine
   * node_modules içindeki gerçek PDF.js worker kullanılır.
   */
  const pdfMain =
    nodeRequire.resolve(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );

  const workerPath =
    join(
      dirname(
        pdfMain
      ),
      "pdf.worker.mjs"
    );

  pdfjs.GlobalWorkerOptions.workerSrc =
    pathToFileURL(
      workerPath
    ).href;

  return pdfjs;
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
        pageText
          .replace(
            /\s+/g,
            ""
          )
          .length >= 30
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
        pages
          .filter(Boolean)
          .join(
            "\n\n--- SAYFA ---\n\n"
          )
          .trim(),

      pageCount:
        pdf.numPages,

      pagesWithText,
    };
  } finally {
    await loadingTask
      .destroy()
      .catch(
        () => {}
      );
  }
}

async function createLegalOcrWorker() {
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

  return createWorker(
    [
      "tur",
      "eng",
    ],

    undefined,

    {
      workerPath,
    }
  );
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

  const worker =
    await createLegalOcrWorker();

  try {
    const pages:
      string[] = [];

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

        pages.push(
          pageText
        );
      } finally {
        try {
          page.cleanup();
        } catch {}
      }
    }

    return cleanOcrText(
      pages
        .map(
          (
            pageText,
            index
          ) =>
            pageText
              ? `--- SAYFA ${index + 1} ---\n${pageText}`
              : ""
        )
        .filter(Boolean)
        .join(
          "\n\n"
        )
    );
  } finally {
    await worker
      .terminate()
      .catch(
        () => {}
      );

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

  const worker =
    await createLegalOcrWorker();

  try {
    const text =
      await recognizeImage(
        worker,
        bytes
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
  } finally {
    await worker
      .terminate()
      .catch(
        () => {}
      );
  }
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
  try {
    const embedded =
      await extractEmbeddedPdfText(
        bytes
      );

    const compactLength =
      embedded.text
        .replace(
          /\s+/g,
          ""
        )
        .length;

    const requiredPages =
      Math.max(
        1,

        Math.ceil(
          embedded.pageCount *
          0.8
        )
      );

    if (
      compactLength >= 80 &&
      embedded.pagesWithText >=
        requiredPages
    ) {
      return {
        text:
          embedded.text,

        engine:
          "pdf-text",
      };
    }
  } catch (error) {
    console.error(
      "LEGAL PDF TEXT LAYER:",
      error instanceof
        Error
        ? error.message
        : "Text layer okunamadı."
    );
  }

  /*
   * 2) TARANMIŞ PDF
   *
   * PDF sayfalarını PNG'ye render et.
   * Aynı Tesseract worker ile sırayla OCR yap.
   *
   * Ücretli API YOK.
   */
  const text =
    await ocrPdfPages(
      bytes
    );

  if (!text) {
    throw new Error(
      "PDF içerisinden okunabilir metin çıkarılamadı."
    );
  }

  return {
    text,

    engine:
      "tesseract",
  };
}