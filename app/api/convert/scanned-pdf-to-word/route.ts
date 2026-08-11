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
  getDocument,
} from "pdfjs-dist/legacy/build/pdf.mjs";

import {
  createCanvas,
} from "canvas";

import {
  extractLegalImageText,
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

    const startedAt =
      Date.now();

    const bytes =
      new Uint8Array(
        await file.arrayBuffer()
      );

    const pdf =
      await getDocument({
        data: bytes,
      }).promise;

    /*
     * Serverless ortamını korumak için
     * tek işlemde sınırsız OCR yapmıyoruz.
     */
    if (
      pdf.numPages >
      30
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Taranmış PDF OCR işlemi tek seferde en fazla 30 sayfa destekliyor.",
        },
        {
          status: 400,
        }
      );
    }

    const pageTexts:
      string[] = [];

    const engines =
      new Set<string>();

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

      /*
       * 1.55 scale:
       * Eski 2x render'a göre
       * RAM ve CPU daha düşük,
       * OCR için yeterli kalite.
       */
      const viewport =
        page.getViewport({
          scale: 1.55,
        });

      const canvas =
        createCanvas(
          Math.ceil(
            viewport.width
          ),
          Math.ceil(
            viewport.height
          )
        );

      const context =
        canvas.getContext(
          "2d"
        );

      await page.render({
        canvas:
          canvas as any,

        canvasContext:
          context as any,

        viewport,
      }).promise;

      /*
       * PNG yerine JPEG:
       * Gemini upload boyutu ve RAM kullanımı düşer.
       */
      const imageBuffer =
        canvas.toBuffer(
          "image/jpeg",
          {
            quality: 0.86,
          }
        );

      const recognized =
        await extractLegalImageText(
          imageBuffer,
          "image/jpeg"
        );

      engines.add(
        recognized.engine
      );

      pageTexts.push(
        recognized.text
          ? `SAYFA ${pageNo}\n\n${recognized.text}`
          : `SAYFA ${pageNo}\n\n[Metin okunamadı]`
      );
    }

    const fullText =
      pageTexts
        .join(
          "\n\n--------------------\n\n"
        )
        .trim();

    if (
      !fullText
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Taranmış PDF'den metin çıkarılamadı.",
        },
        {
          status: 422,
        }
      );
    }

    const paragraphs =
      fullText
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
                  70,
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
            `attachment; filename="${baseName}.docx"`,

          "X-OCR-Engine":
            Array.from(
              engines
            ).join(
              ","
            ),

          "X-OCR-Duration":
            String(
              Date.now() -
              startedAt
            ),

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
            : "Taranmış PDF OCR işlemi başarısız.",
      },
      {
        status: 500,
      }
    );
  }
}
