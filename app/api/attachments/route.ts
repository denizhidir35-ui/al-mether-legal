import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateAppUser } from "@/lib/alUser";

const BUCKET_NAME = "legal-attachments";

function sanitizeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_");
}

export async function GET(
  request: NextRequest
) {
  try {
    const { appUser, error } =
      await getOrCreateAppUser();

    if (error || !appUser) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error ||
            "Kullanıcı oturumu bulunamadı.",
          attachments: [],
        },
        { status: 401 }
      );
    }

    const searchParams =
      new URL(request.url).searchParams;

    const attachmentId =
      searchParams
        .get("attachmentId")
        ?.trim() || "";

    const calendarEventId =
      searchParams
        .get("calendarEventId")
        ?.trim() || "";

    const caseId =
      searchParams
        .get("caseId")
        ?.trim() || "";

    const source =
      searchParams
        .get("source")
        ?.trim() || "";

    const supabase =
      getSupabaseAdmin();

    if (attachmentId) {
      const attachmentResult =
        await supabase
          .from("calendar_attachments")
          .select("*")
          .eq("id", attachmentId)
          .eq("user_id", appUser.id)
          .maybeSingle();

      if (
        attachmentResult.error ||
        !attachmentResult.data
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              attachmentResult.error?.message ||
              "Dosya bulunamadı.",
          },
          { status: 404 }
        );
      }

      const signedUrlResult =
        await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(
            attachmentResult.data.storage_path,
            300
          );

      if (signedUrlResult.error) {
        return NextResponse.json(
          {
            ok: false,
            error:
              signedUrlResult.error.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        attachment:
          attachmentResult.data,
        signedUrl:
          signedUrlResult.data.signedUrl,
        expiresIn:
          300,
      });
    }

    if (
      !calendarEventId &&
      !caseId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "calendarEventId, caseId veya attachmentId zorunludur.",
          attachments: [],
        },
        { status: 400 }
      );
    }

    let query =
      supabase
        .from("calendar_attachments")
        .select("*")
        .eq(
          "user_id",
          appUser.id
        );

    if (caseId) {
      query =
        query.eq(
          "case_id",
          caseId
        );
    } else {
      query =
        query.eq(
          "calendar_event_id",
          calendarEventId
        );
    }

    if (source) {
      query =
        query.eq(
          "source",
          source
        );
    }

    const result =
      await query.order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error.message,
          attachments: [],
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      attachments:
        result.data || [],
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ekler alınamadı.",
        attachments: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const { appUser, error } =
      await getOrCreateAppUser();

    if (error || !appUser) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error ||
            "Kullanıcı oturumu bulunamadı.",
        },
        { status: 401 }
      );
    }

    const formData =
      await request.formData();

    const calendarEventId =
      String(
        formData.get("calendarEventId") || ""
      ).trim();

    const caseId =
      String(
        formData.get("caseId") || ""
      ).trim();

const requestedSource =
  String(
    formData.get("source") || "manual"
  ).trim();

const attachmentSource =
  requestedSource === "mail"
    ? "mail"
    : "manual";

    const uploadedFile =
      formData.get("file");

    if (
      !calendarEventId &&
      !caseId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "calendarEventId veya caseId zorunludur.",
        },
        { status: 400 }
      );
    }

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Yüklenecek dosya bulunamadı.",
        },
        { status: 400 }
      );
    }

    if (uploadedFile.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dosya boyutu 20 MB sınırını aşıyor.",
        },
        { status: 400 }
      );
    }

    const allowedTypes =
      new Set([
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/png",
        "image/webp",
      ]);

    const isUdf =
      uploadedFile.name
        .toLocaleLowerCase("tr-TR")
        .endsWith(".udf");

    if (
      !allowedTypes.has(uploadedFile.type) &&
      !isUdf
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Bu dosya türü desteklenmiyor.",
        },
        { status: 400 }
      );
    }

    const safeName =
      sanitizeFileName(
        uploadedFile.name
      );

    const ownerPath =
      caseId
        ? `case/${caseId}`
        : `calendar/${calendarEventId}`;

    const storagePath =
      `${appUser.id}/${ownerPath}/${crypto.randomUUID()}-${safeName}`;

    const supabase =
      getSupabaseAdmin();

    const storageResult =
      await supabase.storage
        .from(BUCKET_NAME)
        .upload(
          storagePath,
          uploadedFile,
          {
            contentType:
              uploadedFile.type,
            upsert: false,
          }
        );

    if (storageResult.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            storageResult.error.message,
        },
        { status: 500 }
      );
    }

    const insertResult =
      await supabase
        .from("calendar_attachments")
        .insert({
          user_id:
            appUser.id,

          calendar_event_id:
            calendarEventId ||
            null,

          case_id:
            caseId ||
            null,

          file_name:
            uploadedFile.name,

          file_type:
            uploadedFile.type,

          file_size:
            uploadedFile.size,

          storage_path:
            storagePath,

          source: attachmentSource,
        })
        .select("*")
        .single();

    if (insertResult.error) {
      await supabase.storage
        .from(BUCKET_NAME)
        .remove([storagePath]);

      return NextResponse.json(
        {
          ok: false,
          error:
            insertResult.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      attachment:
        insertResult.data,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Dosya yüklenemedi.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest
) {
  try {
    const { appUser, error } =
      await getOrCreateAppUser();

    if (error || !appUser) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error ||
            "Kullanıcı oturumu bulunamadı.",
        },
        { status: 401 }
      );
    }

    const attachmentId =
      new URL(request.url)
        .searchParams
        .get("attachmentId")
        ?.trim() || "";

    if (!attachmentId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "attachmentId zorunludur.",
        },
        { status: 400 }
      );
    }

    const supabase =
      getSupabaseAdmin();

    const attachmentResult =
      await supabase
        .from("calendar_attachments")
        .select("*")
        .eq("id", attachmentId)
        .eq("user_id", appUser.id)
        .maybeSingle();

    if (
      attachmentResult.error ||
      !attachmentResult.data
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            attachmentResult.error?.message ||
            "Ek bulunamadı.",
        },
        { status: 404 }
      );
    }

    const storageResult =
      await supabase.storage
        .from(BUCKET_NAME)
        .remove([
          attachmentResult.data.storage_path,
        ]);

    if (storageResult.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            storageResult.error.message,
        },
        { status: 500 }
      );
    }

    const deleteResult =
      await supabase
        .from("calendar_attachments")
        .delete()
        .eq("id", attachmentId)
        .eq("user_id", appUser.id);

    if (deleteResult.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            deleteResult.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ek silinemedi.",
      },
      { status: 500 }
    );
  }
}


export async function PATCH(
  request: NextRequest
) {
  try {
    const { appUser, error } =
      await getOrCreateAppUser();

    if (error || !appUser) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error ||
            "Kullanıcı oturumu bulunamadı.",
        },
        { status: 401 }
      );
    }

    const body =
      (await request.json()) as {
        attachmentId?: string;
        fileName?: string;
      };

    const attachmentId =
      body.attachmentId?.trim() || "";

    const fileName =
      body.fileName?.trim() || "";

    if (!attachmentId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "attachmentId zorunludur.",
        },
        { status: 400 }
      );
    }

    if (!fileName) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dosya adı boş olamaz.",
        },
        { status: 400 }
      );
    }

    if (fileName.length > 180) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dosya adı en fazla 180 karakter olabilir.",
        },
        { status: 400 }
      );
    }

    const supabase =
      getSupabaseAdmin();

    const result =
      await supabase
        .from("calendar_attachments")
        .update({
          file_name:
            fileName,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", attachmentId)
        .eq("user_id", appUser.id)
        .select("*")
        .single();

    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      attachment:
        result.data,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Dosya adı güncellenemedi.",
      },
      { status: 500 }
    );
  }
}
