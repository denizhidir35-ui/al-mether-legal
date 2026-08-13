const CLIENT_OCR_MAX_DIMENSION =
  2400;

const CLIENT_IMAGE_MIME_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

function calculateTargetSize(
  width: number,
  height: number
) {
  const scale =
    Math.min(
      1,
      CLIENT_OCR_MAX_DIMENSION /
        Math.max(width, height)
    );

  return {
    width:
      Math.max(
        1,
        Math.round(width * scale)
      ),
    height:
      Math.max(
        1,
        Math.round(height * scale)
      ),
  };
}

export async function optimizeCaseImageForAnalysis(
  file: File
) {
  if (
    !CLIENT_IMAGE_MIME_TYPES.has(
      file.type.toLowerCase()
    )
  ) {
    return file;
  }

  let bitmap:
    ImageBitmap | null = null;
  let image:
    HTMLImageElement | null = null;
  let objectUrl = "";

  try {
    if (
      typeof createImageBitmap ===
      "function"
    ) {
      bitmap =
        await createImageBitmap(file, {
          imageOrientation: "from-image",
        });
    } else {
      objectUrl =
        URL.createObjectURL(file);
      image =
        new Image();
      image.decoding = "async";

      await new Promise<void>(
        (resolve, reject) => {
          image!.onload =
            () => resolve();
          image!.onerror =
            () => reject(
              new Error(
                "Fotoğraf tarayıcıda açılamadı."
              )
            );
          image!.src =
            objectUrl;
        }
      );
    }

    const source =
      bitmap || image;
    const sourceWidth =
      bitmap?.width ||
      image?.naturalWidth ||
      0;
    const sourceHeight =
      bitmap?.height ||
      image?.naturalHeight ||
      0;

    if (
      !source ||
      !sourceWidth ||
      !sourceHeight
    ) {
      return file;
    }

    const target =
      calculateTargetSize(
        sourceWidth,
        sourceHeight
      );

    if (
      target.width === sourceWidth &&
      target.height === sourceHeight &&
      file.size <= 4 * 1024 * 1024
    ) {
      return file;
    }

    const canvas =
      document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;

    const context =
      canvas.getContext("2d", {
        alpha: false,
      });

    if (!context) {
      return file;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(
      0,
      0,
      target.width,
      target.height
    );
    context.drawImage(
      source,
      0,
      0,
      target.width,
      target.height
    );

    const blob =
      await new Promise<Blob | null>(
        (resolve) =>
          canvas.toBlob(
            resolve,
            "image/jpeg",
            0.9
          )
      );

    return blob
      ? new File(
          [blob],
          file.name,
          {
            type: "image/jpeg",
            lastModified:
              file.lastModified,
          }
        )
      : file;
  } catch {
    // HEIC veya tarayıcı decode sorunu varsa server fallback kullanılır.
    return file;
  } finally {
    bitmap?.close();
    if (objectUrl) {
      URL.revokeObjectURL(
        objectUrl
      );
    }
  }
}
