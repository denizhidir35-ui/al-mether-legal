import "server-only";

import type {
  NextRequest,
} from "next/server";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

const BUCKET =
  "legal-conversions";

export class ConversionInputError
  extends Error {
  status: number;

  constructor(
    message: string,
    status = 400
  ) {
    super(message);

    this.name =
      "ConversionInputError";

    this.status =
      status;
  }
}

export type PdfConversionInput = {
  bytes: Buffer;
  fileName: string;
  cleanup:
    () => Promise<void>;
};

export async function readPdfConversionInput(
  request: NextRequest
): Promise<PdfConversionInput> {
  const {
    appUser,
    error,
  } =
    await getOrCreateAppUser();

  if (
    error ||
    !appUser
  ) {
    throw new ConversionInputError(
      error ||
        "Oturum bulunamadı.",
      401
    );
  }

  const contentType =
    request.headers.get(
      "content-type"
    ) || "";

  /*
   * Büyük dosya yolu:
   * Browser -> Supabase Storage
   * API'ye sadece storagePath gelir.
   */
  if (
    contentType.includes(
      "application/json"
    )
  ) {
    const body =
      (await request.json()) as {
        storagePath?: string;
        originalName?: string;
      };

    const storagePath =
      String(
        body.storagePath ||
        ""
      ).trim();

    const originalName =
      String(
        body.originalName ||
        ""
      ).trim();

    const allowedPrefix =
      `tmp/${appUser.id}/`;

    if (
      !storagePath ||
      !storagePath.startsWith(
        allowedPrefix
      )
    ) {
      throw new ConversionInputError(
        "Geçersiz geçici dosya yolu.",
        403
      );
    }

    if (
      !originalName
        .toLowerCase()
        .endsWith(
          ".pdf"
        )
    ) {
      throw new ConversionInputError(
        "Yalnızca PDF destekleniyor."
      );
    }

    const supabase =
      getSupabaseAdmin();

    const downloaded =
      await supabase
        .storage
        .from(
          BUCKET
        )
        .download(
          storagePath
        );

    if (
      downloaded.error ||
      !downloaded.data
    ) {
      throw new ConversionInputError(
        downloaded.error
          ?.message ||
          "Geçici PDF alınamadı.",
        500
      );
    }

    const bytes =
      Buffer.from(
        await downloaded
          .data
          .arrayBuffer()
      );

    if (
      bytes.length >
      45 *
        1024 *
        1024
    ) {
      await supabase
        .storage
        .from(
          BUCKET
        )
        .remove([
          storagePath,
        ])
        .catch(
          () => {}
        );

      throw new ConversionInputError(
        "PDF en fazla 45 MB olabilir."
      );
    }

    return {
      bytes,

      fileName:
        originalName,

      cleanup:
        async () => {
          await supabase
            .storage
            .from(
              BUCKET
            )
            .remove([
              storagePath,
            ])
            .catch(
              () => {}
            );
        },
    };
  }

  /*
   * Küçük dosya yolu.
   */
  const formData =
    await request.formData();

  const file =
    formData.get(
      "file"
    );

  if (
    !(file instanceof File)
  ) {
    throw new ConversionInputError(
      "PDF dosyası bulunamadı."
    );
  }

  if (
    !file.name
      .toLowerCase()
      .endsWith(
        ".pdf"
      )
  ) {
    throw new ConversionInputError(
      "Yalnızca PDF destekleniyor."
    );
  }

  if (
    file.size >
    45 *
      1024 *
      1024
  ) {
    throw new ConversionInputError(
      "PDF en fazla 45 MB olabilir."
    );
  }

  return {
    bytes:
      Buffer.from(
        await file
          .arrayBuffer()
      ),

    fileName:
      file.name,

    cleanup:
      async () => {},
  };
}
