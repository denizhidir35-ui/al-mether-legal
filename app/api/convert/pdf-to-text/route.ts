import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  extractLegalPdfText,
} from "@/lib/legal/ocr";

import {
  ConversionInputError,
  readPdfConversionInput,
  type PdfConversionInput,
} from "@/lib/legal/conversionInput";

export const runtime =
  "nodejs";

export const maxDuration =
  60;

export async function POST(
  request: NextRequest
) {
  let source:
    PdfConversionInput |
    null =
      null;

  try {
    source =
      await readPdfConversionInput(
        request
      );

    const result =
      await extractLegalPdfText(
        source.bytes
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
        status:
          error instanceof
          ConversionInputError
            ? error.status
            : 500,
      }
    );
  } finally {
    if (source) {
      await source
        .cleanup();
    }
  }
}
