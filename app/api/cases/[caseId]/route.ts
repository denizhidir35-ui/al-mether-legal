import {
  NextResponse,
} from "next/server";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";
import {
  createSupabaseCaseDeletionStore,
  deleteOwnedCase,
} from "@/lib/legal/caseDeletion";
import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      caseId: string;
    }>;
  }
) {
  try {
    const { appUser, error } =
      await getOrCreateAppUser();

    if (error || !appUser) {
      return NextResponse.json(
        {
          ok: false,
          error: "Kullanıcı oturumu bulunamadı.",
        },
        { status: 401 }
      );
    }

    const { caseId: rawCaseId } =
      await context.params;

    const caseId =
      rawCaseId?.trim() || "";

    if (
      !/^[A-Za-z0-9_-]{1,160}$/.test(caseId)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dava bulunamadı.",
        },
        { status: 404 }
      );
    }

    const body = await request.json();

    const caseTitle =
      body.case_title?.toString().trim() || "";

    if (!caseTitle) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dava başlığı zorunludur.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error: dbError } =
      await supabase
        .from("legal_cases")
        .update({
          case_number:
            body.case_number?.toString().trim() ||
            null,

          court_name:
            body.court_name?.toString().trim() ||
            null,

          case_title: caseTitle,

          case_type:
            body.case_type?.toString().trim() ||
            null,

          status:
            body.status?.toString().trim() ||
            "active",

          risk_level:
            body.risk_level?.toString().trim() ||
            "normal",

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", caseId)
        .eq("user_id", appUser.id)
        .select("*")
        .maybeSingle();

    if (dbError) {
      return NextResponse.json(
        {
          ok: false,
          error: dbError.message,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dava bulunamadı.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      case: data,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Dava güncellenemedi. Lütfen tekrar deneyin.",
      },
      { status: 500 }
    );
  }
}
export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{
      caseId: string;
    }>;
  }
) {
  try {
    const { appUser, error } =
      await getOrCreateAppUser();

    if (error || !appUser) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "KullanÄ±cÄ± oturumu bulunamadÄ±.",
        },
        { status: 401 }
      );
    }

    const { caseId: rawCaseId } =
      await context.params;
    const caseId =
      rawCaseId?.trim() || "";

    if (
      !/^[A-Za-z0-9_-]{1,160}$/.test(
        caseId
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dava bulunamadÄ±.",
        },
        { status: 404 }
      );
    }

    const store =
      createSupabaseCaseDeletionStore(
        getSupabaseAdmin()
      );
    const result =
      await deleteOwnedCase(
        store,
        appUser.id,
        caseId
      );

    if (!result.deleted) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dava bulunamadÄ±.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Dava silindi.",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Dava silinemedi. LÃ¼tfen tekrar deneyin.",
      },
      { status: 500 }
    );
  }
}
