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
            "Kullanıcı oturumu bulunamadı.",
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
          error: "Dava bulunamadı.",
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
          error: "Dava bulunamadı.",
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
          "Dava silinemedi. Lütfen tekrar deneyin.",
      },
      { status: 500 }
    );
  }
}
