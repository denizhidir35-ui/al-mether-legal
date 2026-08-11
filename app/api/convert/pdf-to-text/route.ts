import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  extractLegalPdfText,
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
            "PDF dosyası bulunamadı.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !file.name
        .toLowerCase()
        .endsWith(
          ".pdf"
        )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Yalnızca PDF destekleniyor.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      file.size >
      20 *
        1024 *
        1024
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dosya 20 MB sınırını aşıyor.",
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

    const result =
      await extractLegalPdfText(
        bytes
      );

    return NextResponse.json({
      ok: true,

      text:
        result.text,

      engine:
        result.engine,
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
            : "PDF metni çıkarılamadı.",
      },
      {
        status: 500,
      }
    );
  }
}
