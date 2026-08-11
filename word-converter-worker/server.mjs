import express from "express";
import multer from "multer";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, timingSafeEqual } from "node:crypto";

const execFileAsync = promisify(execFile);

const app = express();

const PORT = Number(
  process.env.PORT || 10000
);

const WORKER_SECRET =
  process.env.WORD_CONVERTER_SECRET || "";

const LIBREOFFICE =
  process.env.LIBREOFFICE_PATH ||
  "/usr/bin/libreoffice";

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
  },
});

function safeEqual(left, right) {
  if (!left || !right) {
    return false;
  }

  const a = Buffer.from(left);
  const b = Buffer.from(right);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

function authorize(req, res, next) {
  if (!WORKER_SECRET) {
    return res.status(503).json({
      ok: false,
      error: "Worker secret yapılandırılmadı.",
    });
  }

  const supplied = String(
    req.headers["x-worker-secret"] || ""
  );

  if (!safeEqual(supplied, WORKER_SECRET)) {
    return res.status(401).json({
      ok: false,
      error: "Yetkisiz worker isteği.",
    });
  }

  next();
}

function cleanBaseName(value) {
  const result = String(value || "belge")
    .replace(/\.(docx|doc)$/i, "")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);

  return result || "belge";
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "al-mether-word-converter",
  });
});

app.post(
  "/convert",
  authorize,
  upload.single("file"),
  async (req, res) => {
    const id = randomUUID();

    const workDir = join(
      tmpdir(),
      `al-mether-word-${id}`
    );

    const profileDir = join(
      tmpdir(),
      `lo-profile-${id}`
    );

    try {
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          ok: false,
          error: "Word dosyası bulunamadı.",
        });
      }

      if (!file.size) {
        return res.status(400).json({
          ok: false,
          error: "Word dosyası boş.",
        });
      }

      const original = String(
        file.originalname || ""
      );

      const lower = original.toLowerCase();

      if (
        !lower.endsWith(".doc") &&
        !lower.endsWith(".docx")
      ) {
        return res.status(400).json({
          ok: false,
          error: "Yalnızca DOC ve DOCX destekleniyor.",
        });
      }

      await mkdir(workDir, {
        recursive: true,
      });

      await mkdir(profileDir, {
        recursive: true,
      });

      const extension =
        lower.endsWith(".docx")
          ? ".docx"
          : ".doc";

      const baseName =
        cleanBaseName(original);

      const inputPath = join(
        workDir,
        `${baseName}${extension}`
      );

      await writeFile(
        inputPath,
        file.buffer
      );

      const profileUrl =
        `file://${profileDir.replace(/\\/g, "/")}`;

      await execFileAsync(
        LIBREOFFICE,
        [
          "--headless",
          "--nologo",
          "--nodefault",
          "--nolockcheck",
          "--nofirststartwizard",
          `-env:UserInstallation=${profileUrl}`,
          "--convert-to",
          "pdf",
          "--outdir",
          workDir,
          inputPath,
        ],
        {
          timeout: 90000,
          maxBuffer: 5 * 1024 * 1024,
        }
      );

      const outputPath = join(
        workDir,
        `${baseName}.pdf`
      );

      const pdf =
        await readFile(outputPath);

      if (!pdf.length) {
        throw new Error(
          "LibreOffice boş PDF oluşturdu."
        );
      }

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${baseName}.pdf"`
      );

      res.setHeader(
        "Cache-Control",
        "no-store"
      );

      return res.status(200).send(pdf);

    } catch (error) {
      console.error(
        "WORD CONVERTER ERROR:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Word → PDF dönüşümü başarısız.",
      });

    } finally {
      await rm(workDir, {
        recursive: true,
        force: true,
      }).catch(() => {});

      await rm(profileDir, {
        recursive: true,
        force: true,
      }).catch(() => {});
    }
  }
);

app.use((error, _req, res, _next) => {
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      ok: false,
      error: "Word dosyası 20 MB sınırını aşıyor.",
    });
  }

  console.error(
    "WORKER ERROR:",
    error
  );

  return res.status(500).json({
    ok: false,
    error: "Worker isteği başarısız.",
  });
});

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `AL METHER Word Converter :${PORT}`
    );
  }
);
