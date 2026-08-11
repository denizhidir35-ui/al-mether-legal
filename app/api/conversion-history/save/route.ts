import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

function cleanName(
  value: string
) {
  return value
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
    const {
      appUser,
      error,
    } =
      await getOrCreateAppUser();

    if (
      error ||
      !appUser
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error ||
            "Oturum bulunamadı.",
        },
        {
          status: 401,
        }
      );
    }

    const formData =
      await request.formData();

    const file =
      formData.get(
        "file"
      );

    const sourceName =
      String(
        formData.get(
          "sourceName"
        ) || ""
      ).trim();

    const conversionType =
      String(
        formData.get(
          "conversionType"
        ) || ""
      ).trim();

    if (
      !(file instanceof File)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dönüştürülmüş dosya bulunamadı.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !sourceName ||
      !conversionType
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dönüşüm bilgileri eksik.",
        },
        {
          status: 400,
        }
      );
    }

    const outputName =
      cleanName(
        file.name
      );

    const now =
      new Date();

    /*
     * Storage key kullanıcı dosya adından bağımsızdır.
     * Türkçe karakter, boşluk ve özel karakter problemi oluşmaz.
     * Gerçek dosya adı conversion_history.output_name içinde korunur.
     */
    const extensionMatch =
      outputName.match(
        /\.([a-zA-Z0-9]{1,10})$/
      );

    const extension =
      extensionMatch
        ? `.${extensionMatch[1].toLowerCase()}`
        : "";

    const storageFileName =
      `${crypto.randomUUID()}${extension}`;

    const storagePath =
      `${appUser.id}/${now.getFullYear()}/${String(
        now.getMonth() + 1
      ).padStart(
        2,
        "0"
      )}/${storageFileName}`;

    const bytes =
      Buffer.from(
        await file.arrayBuffer()
      );

    const supabase =
      getSupabaseAdmin();

    const upload =
      await supabase
        .storage
        .from(
          "legal-conversions"
        )
        .upload(
          storagePath,
          bytes,
          {
            contentType:
              file.type ||
              "application/octet-stream",

            upsert: false,
          }
        );

    if (
      upload.error
    ) {
      console.error(
        "CONVERSION STORAGE UPLOAD ERROR:",
        upload.error
      );
      return NextResponse.json(
        {
          ok: false,
          error:
            upload.error.message,
        },
        {
          status: 500,
        }
      );
    }

    const insert =
      await supabase
        .from(
          "conversion_history"
        )
        .insert({
          user_id:
            appUser.id,

          source_name:
            sourceName,

          output_name:
            outputName,

          conversion_type:
            conversionType,

          storage_path:
            storagePath,

          file_size:
            file.size,
        })
        .select(
          "id,source_name,output_name,conversion_type,storage_path,file_size,created_at"
        )
        .single();

    if (
      insert.error
    ) {
      console.error(
        "CONVERSION HISTORY INSERT ERROR:",
        insert.error,
        {
          userId:
            appUser.id,
          outputName,
          conversionType,
          storagePath,
          fileSize:
            file.size,
        }
      );
      await supabase
        .storage
        .from(
          "legal-conversions"
        )
        .remove([
          storagePath,
        ]);

      return NextResponse.json(
        {
          ok: false,
          error:
            insert.error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      item:
        insert.data,
    });
  } catch (
    error: unknown
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Dönüşüm geçmişi kaydedilemedi.",
      },
      {
        status: 500,
      }
    );
  }
}


