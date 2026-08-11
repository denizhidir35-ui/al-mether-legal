import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createWorker,
} from "tesseract.js";

export const runtime =
  "nodejs";

export async function POST(
  request: NextRequest
) {
  let worker:
    Awaited<
      ReturnType<
        typeof createWorker
      >
    > | null = null;

  try {
    const formData =
      await request.formData();

    const file =
      formData.get(
        "file"
      );

    if (
      !(file instanceof File)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Görsel bulunamadı.",
        },
        {
          status: 400,
        }
      );
    }

    const allowed =
      new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
      ]);

    if (
      !allowed.has(
        file.type
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "JPG, PNG veya WEBP destekleniyor.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      file.size >
      15 * 1024 * 1024
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dosya 15 MB sınırını aşıyor.",
        },
        {
          status: 400,
        }
      );
    }

    const bytes =
      Buffer.from(
        await file.arrayBuffer()
      );

    /*
     * Türkçe + İngilizce.
     * Hukuki belgelerde sayı,
     * dosya no ve Latin karakterler
     * birlikte bulunabiliyor.
     */
    worker =
      await createWorker(
        "tur+eng"
      );

    const result =
      await worker.recognize(
        bytes
      );

    const text =
      result.data.text
        ?.trim() ||
      "";

    if (!text) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Görselden okunabilir metin çıkarılamadı.",
        },
        {
          status: 422,
        }
      );
    }

    return NextResponse.json({
      ok: true,

      text,

      confidence:
        Math.round(
          result.data
            .confidence || 0
        ),
    });
  } catch (
    error: unknown
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "OCR işlemi başarısız.",
      },
      {
        status: 500,
      }
    );
  } finally {
    if (worker) {
      await worker
        .terminate()
        .catch(
          () => {}
        );
    }
  }
}
