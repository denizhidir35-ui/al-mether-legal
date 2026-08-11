import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createWorker,
} from "tesseract.js";

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

export const runtime =
  "nodejs";

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
        .endsWith(".pdf")
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

    const bytes =
      new Uint8Array(
        await file.arrayBuffer()
      );

    const pdf =
      await getDocument({
        data: bytes,
      }).promise;

    worker =
      await createWorker(
        "tur+eng"
      );

    const pageTexts:
      string[] = [];

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

      const viewport =
        page.getViewport({
          scale: 2,
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

      const imageBuffer =
        canvas.toBuffer(
          "image/png"
        );

      const recognized =
        await worker.recognize(
          imageBuffer
        );

      const text =
        recognized.data.text
          ?.trim() ||
        "";

      pageTexts.push(
        text
      );
    }

    const fullText =
      pageTexts
        .filter(Boolean)
        .join(
          "\n\n--- SAYFA ---\n\n"
        )
        .trim();

    if (!fullText) {
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
        .split("\n")
        .map(
          (line) =>
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  font:
                    "Arial",
                  size:
                    22,
                }),
              ],

              spacing: {
                after: 80,
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
                  top: 1134,
                  right: 1134,
                  bottom: 1134,
                  left: 1134,
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

