import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  extractLegalImageText,
} from "@/lib/legal/ocr";

export const runtime =
  "nodejs";

export const maxDuration =
  60;

export async function POST(
  request: NextRequest
) {
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
      15 *
        1024 *
        1024
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

    const startedAt =
      Date.now();

    const bytes =
      Buffer.from(
        await file.arrayBuffer()
      );

    const result =
      await extractLegalImageText(
        bytes,
        file.type
      );

    if (!result.text) {
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

      text:
        result.text,

      engine:
        result.engine,

      durationMs:
        Date.now() -
        startedAt,
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
  }
}
