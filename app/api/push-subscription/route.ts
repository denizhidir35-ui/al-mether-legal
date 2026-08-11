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

    const body =
      await request.json();

    const endpoint =
      String(
        body?.endpoint ||
        ""
      ).trim();

    const p256dh =
      String(
        body?.keys?.p256dh ||
        ""
      ).trim();

    const auth =
      String(
        body?.keys?.auth ||
        ""
      ).trim();

    if (
      !endpoint ||
      !p256dh ||
      !auth
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Geçersiz push aboneliği.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      getSupabaseAdmin();

    const result =
      await supabase
        .from(
          "push_subscriptions"
        )
        .upsert(
          {
            user_id:
              appUser.id,

            endpoint,

            p256dh,

            auth,

            status:
              "active",
          },
          {
            onConflict:
              "endpoint",
          }
        )
        .select(
          "id,user_id,endpoint,status"
        )
        .single();

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

    return NextResponse.json({
      ok: true,
      subscription:
        result.data,
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
            : "Push aboneliği kaydedilemedi.",
      },
      {
        status: 500,
      }
    );
  }
}
