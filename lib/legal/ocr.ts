import "server-only";

import {
  GoogleGenAI,
} from "@google/genai";

import {
  createWorker,
} from "tesseract.js";

export type LegalOcrResult = {
  text: string;
  engine:
    | "gemini"
    | "tesseract";
};

export async function extractLegalImageText(
  bytes: Buffer,
  mimeType: string
): Promise<LegalOcrResult> {
  const apiKey =
    process.env
      .GEMINI_API_KEY ||
    "";

  if (apiKey) {
    try {
      const ai =
        new GoogleGenAI({
          apiKey,
        });

      const response =
        await ai.models
          .generateContent({
            model:
              "gemini-2.5-flash",

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
                  [
                    "Bu bir hukuk ofisi OCR işlemidir.",
                    "Görselde gerçekten görünen tüm metni eksiksiz çıkar.",
                    "Türkçe karakterleri koru.",
                    "Mahkeme adı, dosya numarası, esas numarası, karar numarası, tarihler, kişi ve şirket adlarını aynen koru.",
                    "Satır yapısını mümkün olduğunca koru.",
                    "Özetleme yapma.",
                    "Yorum ekleme.",
                    "Markdown kullanma.",
                    "Sadece görseldeki metni döndür.",
                  ].join(" "),
              },
            ],

            config: {
              temperature: 0,
            },
          });

      const text =
        response.text
          ?.trim() ||
        "";

      if (text) {
        return {
          text,
          engine:
            "gemini",
        };
      }
    } catch (
      error
    ) {
      console.error(
        "LEGAL GEMINI OCR:",
        error
      );
    }
  }

  /*
   * Gemini başarısız olursa
   * yerel fallback.
   */
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
