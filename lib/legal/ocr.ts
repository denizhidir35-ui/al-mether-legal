import "server-only";

import {
  GoogleGenAI,
} from "@google/genai";

export type LegalOcrResult = {
  text: string;

  engine:
    | "gemini-flash-lite"
    | "tesseract";
};

const GEMINI_MODEL =
  process.env.GEMINI_OCR_MODEL ||
  "gemini-2.5-flash-lite";

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,

    new Promise<T>(
      (
        _resolve,
        reject
      ) => {
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
          temperature: 0,

          thinkingConfig: {
            thinkingBudget: 0,
          },

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
  } catch (
    error
  ) {
    console.error(
      "LEGAL GEMINI IMAGE OCR:",
      error
    );

    /*
     * Production'da Tesseract fallback YOK.
     * Serverless RAM/CPU ve uzun bekleme yaratmasını istemiyoruz.
     */
    if (
      process.env
        .NODE_ENV ===
      "production"
    ) {
      throw error;
    }
  }

  /*
   * Sadece localhost geliştirme fallback.
   */
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

    const text =
      result.data.text
        ?.trim() ||
      "";

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

      30000
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
