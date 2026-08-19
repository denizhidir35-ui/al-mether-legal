import {
  NextResponse,
} from "next/server";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

function clean(
  value: unknown
) {
  return value
    ?.toString()
    .trim() || "";
}

function isPlainObject(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

async function getOwnedCase(
  caseId: string,
  userId: string
) {
  return getSupabaseAdmin()
    .from("legal_cases")
    .select("id")
    .eq(
      "id",
      caseId
    )
    .eq(
      "user_id",
      userId
    )
    .maybeSingle();
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      caseId: string;
    }>;
  }
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
            "Kullanıcı oturumu bulunamadı.",
        },
        { status: 401 }
      );
    }

    const {
      caseId: rawCaseId,
    } =
      await context.params;

    const caseId =
      clean(rawCaseId);

    if (!caseId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dava bulunamadı.",
        },
        { status: 404 }
      );
    }

    const ownedCase =
      await getOwnedCase(
        caseId,
        appUser.id
      );

    if (ownedCase.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            ownedCase.error.message,
        },
        { status: 500 }
      );
    }

    if (!ownedCase.data) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dava bulunamadı.",
        },
        { status: 404 }
      );
    }

    const body =
      (await request.json()) as
        Record<string, unknown>;

    const documentIdentity =
      clean(
        body.documentIdentity
      )
        .toLocaleLowerCase(
          "tr-TR"
        );

    const fileName =
      clean(
        body.fileName
      );

    const documentType =
      clean(
        body.documentType
      );

    const parserData =
      body.parserData;

    if (
      !/^[a-f0-9]{64}$/.test(
        documentIdentity
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Belge kimliği geçersiz.",
        },
        { status: 400 }
      );
    }

    if (!fileName) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Belge adı zorunludur.",
        },
        { status: 400 }
      );
    }

    if (
      !isPlainObject(
        parserData
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Parser verisi geçersiz.",
        },
        { status: 400 }
      );
    }

    const supabase =
      getSupabaseAdmin();

    /*
     * Aynı fiziksel belge kullanıcı
     * bazında yalnız bir kez tutulur.
     */
    const existing =
      await supabase
        .from(
          "case_document_records"
        )
        .select("*")
        .eq(
          "user_id",
          appUser.id
        )
        .eq(
          "document_identity",
          documentIdentity
        )
        .maybeSingle();

    if (existing.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            existing.error.message,
        },
        { status: 500 }
      );
    }

    if (existing.data) {
      /*
       * Aynı dosyanın başka davaya
       * sessizce taşınmasına izin yok.
       */
      if (
        existing.data.case_id !==
        caseId
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Bu belge başka bir dava kaydıyla eşleşiyor.",
          },
          { status: 409 }
        );
      }

      /*
       * Aynı davadaysa parser verisini
       * güncel sürümle yenileyebiliriz.
       */
      const updated =
        await supabase
          .from(
            "case_document_records"
          )
          .update({
            file_name:
              fileName,

            document_type:
              documentType ||
              null,

            parser_data:
              parserData,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            existing.data.id
          )
          .eq(
            "user_id",
            appUser.id
          )
          .select("*")
          .single();

      if (updated.error) {
        return NextResponse.json(
          {
            ok: false,
            error:
              updated.error.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        duplicate: true,
        record:
          updated.data,
      });
    }

    const inserted =
      await supabase
        .from(
          "case_document_records"
        )
        .insert({
          case_id:
            caseId,

          user_id:
            appUser.id,

          document_identity:
            documentIdentity,

          file_name:
            fileName,

          document_type:
            documentType ||
            null,

          parser_data:
            parserData,
        })
        .select("*")
        .single();

    if (inserted.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            inserted.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      duplicate: false,
      record:
        inserted.data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Belge parser kaydı oluşturulamadı.",
      },
      { status: 500 }
    );
  }
}
