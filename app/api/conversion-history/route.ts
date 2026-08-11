import {
  NextResponse,
} from "next/server";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

export async function GET() {
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

    const supabase =
      getSupabaseAdmin();

    const result =
      await supabase
        .from(
          "conversion_history"
        )
        .select(
          "id,source_name,output_name,conversion_type,storage_path,file_size,created_at"
        )
        .eq(
          "user_id",
          appUser.id
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(10);

    if (
      result.error
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result.error.message,
        },
        {
          status: 500,
        }
      );
    }

    const items =
      await Promise.all(
        (
          result.data ||
          []
        ).map(
          async (
            item
          ) => {
            const signed =
              await supabase
                .storage
                .from(
                  "legal-conversions"
                )
                .createSignedUrl(
                  item.storage_path,
                  60 * 10
                );

            return {
              ...item,

              url:
                signed.data
                  ?.signedUrl ||
                null,
            };
          }
        )
      );

    return NextResponse.json({
      ok: true,
      items,
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
            : "Dönüşüm geçmişi alınamadı.",
      },
      {
        status: 500,
      }
    );
  }
}
