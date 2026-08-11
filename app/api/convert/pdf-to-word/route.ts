import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

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

function cleanName(
  value: string
) {
  return value
    .replace(
      /\.pdf$/i,
      ""
    )
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      "_"
    )
    .trim();
}

function createParagraphs(
  text: string
) {
  return text
    .replace(
      /\r\n/g,
      "\n"
    )
    .replace(
      /\r/g,
      "\n"
    )
    .split("\n")
    .map(
      (
        line
      ) =>
        new Paragraph({
          children: [
            new TextRun({
              text:
                line,

              font:
                "Arial",

              size:
                22,
            }),
          ],

          spacing: {
            after:
              80,
          },
        })
    );
}

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

    const extracted =
      await extractLegalPdfText(
        source.bytes
      );

    const document =
      new Document({
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top:
                    1134,

                  right:
                    1134,

                  bottom:
                    1134,

                  left:
                    1134,
                },
              },
            },

            children:
              createParagraphs(
                extracted.text
              ),
          },
        ],
      });

    const output =
      await Packer
        .toBuffer(
          document
        );

    const baseName =
      cleanName(
        source.fileName
      );

    return new NextResponse(
      new Uint8Array(
        output
      ),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

          "Content-Disposition":
            `attachment; filename="${baseName}.docx"`,

          "X-OCR-Engine":
            extracted.engine,

          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (
    error: unknown
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "PDF → Word dönüşümü başarısız.",
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
