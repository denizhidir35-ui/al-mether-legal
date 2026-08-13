import "server-only";

export const OCR_IMAGE_MAX_DIMENSION =
  2400;

const NORMALIZATION_TIMEOUT_MS =
  10_000;

const IMAGE_MIME_BY_EXTENSION:
  Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
  };

const SUPPORTED_IMAGE_MIME_TYPES =
  new Set(
    Object.values(
      IMAGE_MIME_BY_EXTENSION
    )
  );

export type NormalizedLegalImage = {
  bytes: Buffer;
  mimeType: "image/jpeg";
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  orientation: number | null;
};

export class LegalImageNormalizationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name =
      "LegalImageNormalizationError";
  }
}

export function resolveLegalImageMimeType(
  declaredMimeType: string,
  fileName: string
) {
  const declared =
    String(declaredMimeType || "")
      .trim()
      .toLowerCase();

  if (
    SUPPORTED_IMAGE_MIME_TYPES.has(
      declared
    )
  ) {
    return declared;
  }

  const extension =
    String(fileName || "")
      .trim()
      .toLowerCase()
      .match(/\.[^.]+$/)
      ?.[0] || "";

  return (
    IMAGE_MIME_BY_EXTENSION[
      extension
    ] || ""
  );
}

function normalizationTimeout<T>(
  promise: Promise<T>
) {
  return new Promise<T>(
    (resolve, reject) => {
      const timeout =
        setTimeout(() => {
          reject(
            new LegalImageNormalizationError(
              "Fotoğraf OCR için hazırlanırken zaman aşımına uğradı."
            )
          );
        }, NORMALIZATION_TIMEOUT_MS);

      promise.then(
        (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      );
    }
  );
}

export async function normalizeLegalImageForOcr(
  bytes: Buffer,
  mimeType: string
): Promise<NormalizedLegalImage> {
  if (!bytes?.length) {
    throw new LegalImageNormalizationError(
      "Fotoğraf verisi bulunamadı."
    );
  }

  try {
    const sharp =
      (await import("sharp")).default;

    const image =
      sharp(bytes, {
        failOn: "error",
        limitInputPixels:
          100_000_000,
      });

    const metadata =
      await normalizationTimeout(
        image.metadata()
      );

    if (
      !metadata.width ||
      !metadata.height
    ) {
      throw new LegalImageNormalizationError(
        "Fotoğraf ölçüleri okunamadı."
      );
    }

    const normalized =
      await normalizationTimeout(
        image
          .rotate()
          .resize({
            width:
              OCR_IMAGE_MAX_DIMENSION,
            height:
              OCR_IMAGE_MAX_DIMENSION,
            fit: "inside",
            withoutEnlargement: true,
          })
          .flatten({
            background: "#ffffff",
          })
          .toColourspace("srgb")
          .jpeg({
            quality: 90,
            chromaSubsampling: "4:4:4",
          })
          .toBuffer({
            resolveWithObject: true,
          })
      );

    return {
      bytes:
        normalized.data,
      mimeType:
        "image/jpeg",
      originalWidth:
        metadata.width,
      originalHeight:
        metadata.height,
      width:
        normalized.info.width,
      height:
        normalized.info.height,
      orientation:
        metadata.orientation || null,
    };
  } catch (error) {
    if (
      error instanceof
        LegalImageNormalizationError
    ) {
      throw error;
    }

    const isHeic =
      mimeType === "image/heic" ||
      mimeType === "image/heif";

    throw new LegalImageNormalizationError(
      isHeic
        ? "HEIC/HEIF fotoğraf bu sunucuda dönüştürülemedi. Lütfen iPhone kamera ayarından En Uyumlu biçimini seçin veya fotoğrafı JPEG olarak yükleyin."
        : "Fotoğraf OCR için hazırlanamadı. Lütfen JPEG, PNG veya WebP biçiminde yeniden deneyin.",
      { cause: error }
    );
  }
}
