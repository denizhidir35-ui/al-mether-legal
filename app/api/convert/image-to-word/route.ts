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

export const runtime =
  "nodejs";

function cleanName(
  value: string
) {
  return value
    .replace(
      /\.[^.]+$/,
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

    const bytes =
      Buffer.from(
        await file.arrayBuffer()
      );

    worker =
      await createWorker(
        "tur+eng"
      );

    const recognized =
      await worker.recognize(
        bytes
      );

    const text =
      recognized.data.text
        ?.trim() ||
      "";

    if (!text) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Görselden metin çıkarılamadı.",
        },
        {
          status: 422,
        }
      );
    }

    const paragraphs =
      text
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
            `attachment; filename="${baseName}.docx"`,

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
            : "Görsel → Word dönüşümü başarısız.",
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
