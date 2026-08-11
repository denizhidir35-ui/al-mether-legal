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

export async function DELETE(
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

    const id =
      new URL(
        request.url
      ).searchParams
        .get("id")
        ?.trim() ||
      "";

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dönüşüm kaydı seçilmedi.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      getSupabaseAdmin();

    /*
     * Önce kaydın gerçekten
     * bu kullanıcıya ait olduğunu doğrula.
     */
    const existing =
      await supabase
        .from(
          "conversion_history"
        )
        .select(
          "id,storage_path"
        )
        .eq(
          "id",
          id
        )
        .eq(
          "user_id",
          appUser.id
        )
        .maybeSingle();

    if (
      existing.error
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            existing.error.message,
        },
        {
          status: 500,
        }
      );
    }

    if (
      !existing.data
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dönüştürülen belge bulunamadı.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Önce Storage dosyasını kaldır.
     */
    const storageResult =
      await supabase
        .storage
        .from(
          "legal-conversions"
        )
        .remove([
          existing.data
            .storage_path,
        ]);

    if (
      storageResult.error
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            storageResult.error.message,
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Ardından geçmiş kaydını sil.
     */
    const deleteResult =
      await supabase
        .from(
          "conversion_history"
        )
        .delete()
        .eq(
          "id",
          id
        )
        .eq(
          "user_id",
          appUser.id
        );

    if (
      deleteResult.error
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            deleteResult.error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      id,
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
            : "Belge silinemedi.",
      },
      {
        status: 500,
      }
    );
  }
}
