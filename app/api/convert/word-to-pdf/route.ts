import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  execFile,
} from "child_process";

import {
  promisify,
} from "util";

import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from "fs/promises";

import {
  join,
} from "path";

import {
  tmpdir,
} from "os";

const execFileAsync =
  promisify(execFile);

const SOFFICE =
  process.env.LIBREOFFICE_PATH ||
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe";

const WORD_CONVERTER_URL =
  process.env.WORD_CONVERTER_URL ||
  "";

const WORD_CONVERTER_SECRET =
  process.env.WORD_CONVERTER_SECRET ||
  "";

function sanitizeFileName(
  value: string
) {
  return value
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      "_"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

export async function POST(
  request: NextRequest
) {
  const workDir =
    join(
      tmpdir(),
      `al-mether-word-${crypto.randomUUID()}`
    );

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
            "Word dosyası bulunamadı.",
        },
        {
          status: 400,
        }
      );
    }

    const lowerName =
      file.name
        .toLowerCase();

    if (
      !lowerName.endsWith(
        ".docx"
      ) &&
      !lowerName.endsWith(
        ".doc"
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Yalnızca DOC ve DOCX destekleniyor.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      file.size >
      20 * 1024 * 1024
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dosya boyutu 20 MB sınırını aşıyor.",
        },
        {
          status: 400,
        }
      );
    }

    await mkdir(
      workDir,
      {
        recursive: true,
      }
    );

    const safeName =
      sanitizeFileName(
        file.name
      );

    const inputPath =
      join(
        workDir,
        safeName
      );

    const bytes =
      Buffer.from(
        await file.arrayBuffer()
      );

    await writeFile(
      inputPath,
      bytes
    );

    if (
      WORD_CONVERTER_URL
    ) {
      const remoteForm =
        new FormData();

      remoteForm.append(
        "file",
        new Blob(
          [bytes],
          {
            type:
              file.type ||
              "application/octet-stream",
          }
        ),
        safeName
      );

      const remoteResponse =
        await fetch(
          WORD_CONVERTER_URL,
          {
            method: "POST",

            headers:
              WORD_CONVERTER_SECRET
                ? {
                    "x-worker-secret":
                      WORD_CONVERTER_SECRET,
                  }
                : undefined,

            body:
              remoteForm,
          }
        );

      if (
        !remoteResponse.ok
      ) {
        let remoteError =
          "Word conversion worker başarısız.";

        try {
          const data =
            await remoteResponse.json();

          remoteError =
            data?.error ||
            remoteError;
        } catch {}

        throw new Error(
          remoteError
        );
      }

      const remotePdf =
        Buffer.from(
          await remoteResponse.arrayBuffer()
        );

      return new NextResponse(
        remotePdf,
        {
          status: 200,

          headers: {
            "Content-Type":
              "application/pdf",

            "Content-Disposition":
              `attachment; filename="${safeName.replace(
                /\.(docx|doc)$/i,
                ""
              )}.pdf"`,

            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    if (
      process.env.NODE_ENV ===
        "production" &&
      !WORD_CONVERTER_URL
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "Word → PDF production dönüştürme servisi henüz bağlı değil.",
        },
        {
          status: 503,
        }
      );
    }

    await execFileAsync(
      SOFFICE,
      [
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        workDir,
        inputPath,
      ],
      {
        windowsHide:
          true,
        timeout:
          120000,
      }
    );

    const baseName =
      safeName.replace(
        /\.(docx|doc)$/i,
        ""
      );

    const outputPath =
      join(
        workDir,
        `${baseName}.pdf`
      );

    const pdf =
      await readFile(
        outputPath
      );

    return new NextResponse(
      pdf,
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="${baseName}.pdf"`,

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
            : "Word → PDF dönüşümü başarısız.",
      },
      {
        status: 500,
      }
    );
  } finally {
    await rm(
      workDir,
      {
        recursive: true,
        force: true,
      }
    ).catch(
      () => {}
    );
  }
}



