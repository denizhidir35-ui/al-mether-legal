import "server-only";

import {
  GoogleGenAI,
} from "@google/genai";

export type LegalOcrResult = {
  text: string;

  engine:
    | "pdf-text"
    | "gemini-flash-lite"
    | "tesseract";
};

const GEMINI_MODEL =
  process.env.GEMINI_OCR_MODEL ||
  "gemini-3.5-flash-lite";

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
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
                  "OCR servisi zaman aşımına uğradı."
                )
              );
            },
            timeoutMs
          );
      }
    ),
  ]);
}

function getAi() {
  const apiKey =
    process.env
      .GEMINI_API_KEY ||
    "";

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY tanımlı değil."
    );
  }

  return new GoogleGenAI({
    apiKey,
  });
}

async function geminiExtract(
  bytes: Buffer,
  mimeType: string,
  prompt: string,
  timeoutMs = 25000
) {
  const ai =
    getAi();

  const response =
    await withTimeout(
      ai.models.generateContent({
        model:
          GEMINI_MODEL,

        contents: [
          {
            inlineData: {
              mimeType,

              data:
                bytes.toString(
                  "base64"
                ),
            },
          },

          {
            text:
              prompt,
          },
        ],

        config: {
          maxOutputTokens:
            32768,
        },
      }),

      timeoutMs
    );

  return (
    response.text
      ?.trim() ||
    ""
  );
}

async function extractEmbeddedPdfText(
  bytes: Buffer
) {
  const {
    getDocument,
  } =
    await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );

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
          "hasEOL" in item &&
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
        parts
          .join("")
          .replace(
            /[ \t]+\n/g,
            "\n"
          )
          .replace(
            /\n{3,}/g,
            "\n\n"
          )
          .trim();

      if (
        pageText
          .replace(
            /\s+/g,
            ""
          )
          .length >= 30
      ) {
        pagesWithText += 1;
      }

      pages.push(
        pageText
      );
    }

    const text =
      pages
        .filter(Boolean)
        .join(
          "\n\n--- SAYFA ---\n\n"
        )
        .trim();

    return {
      text,

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

export async function extractLegalImageText(
  bytes: Buffer,
  mimeType: string
): Promise<LegalOcrResult> {
  try {
    const text =
      await geminiExtract(
        bytes,

        mimeType,

        [
          "Bu bir hukuk ofisi OCR işlemidir.",
          "Görselde gerçekten görünen tüm metni eksiksiz çıkar.",
          "Türkçe karakterleri aynen koru.",
          "Mahkeme adı, dosya numarası, esas numarası, karar numarası, tarihler, T.C. kimlik numarası, kişi ve şirket adlarını değiştirme.",
          "Satır yapısını mümkün olduğunca koru.",
          "Özetleme yapma.",
          "Yorum ekleme.",
          "Markdown kullanma.",
          "Sadece belgede gerçekten görünen metni döndür.",
        ].join(" "),

        20000
      );

    if (text) {
      return {
        text,

        engine:
          "gemini-flash-lite",
      };
    }
  } catch (error) {
    console.error(
      "LEGAL GEMINI IMAGE OCR:",
      error
    );

    if (
      process.env
        .NODE_ENV ===
      "production"
    ) {
      throw error;
    }
  }

  const {
    createWorker,
  } =
    await import(
      "tesseract.js"
    );

  const worker =
    await createWorker(
      "tur+eng"
    );

  try {
    const result =
      await worker.recognize(
        bytes
      );

    return {
      text:
        result.data.text
          ?.trim() ||
        "",

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

  /*
   * 1) ÖNCE PDF'İN KENDİ TEXT LAYER'I
   * AI çağrısı yok -> hızlı + ucuz.
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
      error
    );
  }

  /*
   * 2) TEXT LAYER YOKSA GERÇEK OCR
   */
  const text =
    await geminiExtract(
      bytes,

      "application/pdf",

      [
        "Bu bir hukuk ofisi belge okuma işlemidir.",
        "PDF içindeki tüm okunabilir metni eksiksiz çıkar.",
        "PDF taranmış görüntülerden oluşuyorsa OCR uygula.",
        "Türkçe karakterleri aynen koru.",
        "Mahkeme adı, dosya numarası, esas ve karar numaraları, tarihler, taraf adları ve diğer hukuki bilgileri değiştirme.",
        "Sayfa sırasını ve paragraf yapısını mümkün olduğunca koru.",
        "Özetleme yapma.",
        "Yorum veya açıklama ekleme.",
        "Markdown kullanma.",
        "Sadece belgede bulunan metni döndür.",
      ].join(" "),

      50000
    );

  if (!text) {
    throw new Error(
      "PDF içerisinden okunabilir metin çıkarılamadı."
    );
  }

  return {
    text,

    engine:
      "gemini-flash-lite",
  };
}

