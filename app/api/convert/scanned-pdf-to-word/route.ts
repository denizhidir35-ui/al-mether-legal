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
            "PDF 20 MB sınırını aşıyor.",
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

    const recognized =
      await extractLegalPdfText(
        bytes
      );

    const paragraphs =
      recognized.text
        .replace(
          /\r\n/g,
          "\n"
        )
        .replace(
          /\r/g,
          "\n"
        )
        .split(
          "\n"
        )
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
              paragraphs,
          },
        ],
      });

    const output =
      await Packer.toBuffer(
        document
      );

    const baseName =
      cleanName(
        file.name
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
            `attachment; filename="${baseName}-ocr.docx"`,

          "X-OCR-Engine":
            recognized.engine,

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
            : "Taranmış PDF → Word dönüşümü başarısız.",
      },
      {
        status: 500,
      }
    );
  }
}
