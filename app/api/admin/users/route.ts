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

import {
  PENDING_APPROVAL_STATUS,
} from "@/lib/userApproval";

async function requireAdmin() {
  const result =
    await getOrCreateAppUser();

  if (
    result.error ||
    !result.appUser
  ) {
    return {
      appUser: null,
      response:
        NextResponse.json(
          {
            ok: false,
            error:
              result.error ||
              "Oturum bulunamadı.",
          },
          { status: 401 }
        ),
    };
  }

  if (
    result.appUser.role !==
    "admin"
  ) {
    return {
      appUser: null,
      response:
        NextResponse.json(
          {
            ok: false,
            error:
              "Bu işlem için yönetici yetkisi gerekiyor.",
          },
          { status: 403 }
        ),
    };
  }

  return {
    appUser:
      result.appUser,
    response: null,
  };
}

export async function GET() {
  const auth =
    await requireAdmin();

  if (auth.response) {
    return auth.response;
  }

  const supabase =
    getSupabaseAdmin();

  const result =
    await supabase
      .from("app_users")
      .select(
        "id,email,name,role,status,created_at"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

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

  const notifications = await supabase
    .from("core_notifications")
    .select("id,message,created_at")
    .eq("user_id", auth.appUser?.id)
    .eq("channel", "in-app")
    .eq("source", "user-approval")
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    ok: true,
    users:
      result.data || [],
    notifications: notifications.error ? [] : notifications.data || [],
  });
}

export async function POST(
  request: NextRequest
) {
  const auth =
    await requireAdmin();

  if (
    auth.response ||
    !auth.appUser
  ) {
    return auth.response;
  }

  let body: any = {};

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Geçersiz istek.",
      },
      { status: 400 }
    );
  }

  const email =
    String(
      body?.email || ""
    )
      .trim()
      .toLowerCase();

  const name =
    String(
      body?.name || ""
    ).trim();

  if (
    !name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Ad soyad ve geçerli e-posta gerekiyor.",
      },
      { status: 400 }
    );
  }

  const supabase =
    getSupabaseAdmin();

  const existing =
    await supabase
      .from("app_users")
      .select("id")
      .eq("email", email)
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
    return NextResponse.json(
      {
        ok: false,
        error:
          "Bu e-posta zaten kullanıcı listesinde.",
      },
      { status: 409 }
    );
  }

  const created =
    await supabase
      .from("app_users")
      .insert({
        email,
        google_id: email,
        name,
        role: "lawyer",
        status:
          PENDING_APPROVAL_STATUS,
      })
      .select(
        "id,email,name,role,status,created_at"
      )
      .single();

  if (
    created.error ||
    !created.data
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          created.error
            ?.message ||
          "Kullanıcı oluşturulamadı.",
      },
      { status: 500 }
    );
  }

  const redirectTo =
    new URL(
      "/auth/set-password",
      request.nextUrl.origin
    ).toString();

  const invited =
    await supabase.auth.admin
      .inviteUserByEmail(
        email,
        {
          redirectTo,
          data: {
            full_name: name,
          },
        }
      );

  if (invited.error) {
    await supabase
      .from("app_users")
      .delete()
      .eq(
        "id",
        created.data.id
      );

    return NextResponse.json(
      {
        ok: false,
        error:
          "Davet e-postası gönderilemedi.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      user:
        created.data,
    },
    { status: 201 }
  );
}

export async function PATCH(
  request: NextRequest
) {
  const auth =
    await requireAdmin();

  if (
    auth.response ||
    !auth.appUser
  ) {
    return auth.response;
  }

  let body: any = {};

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Geçersiz istek.",
      },
      { status: 400 }
    );
  }

  const userId =
    String(
      body?.userId || ""
    ).trim();

  const status =
    String(
      body?.status || ""
    ).trim();

  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Kullanıcı seçilmedi.",
      },
      { status: 400 }
    );
  }

  if (
    status !== "active" &&
    status !== "inactive" &&
    status !== "passive" &&
    status !== "rejected"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Geçersiz kullanıcı durumu.",
      },
      { status: 400 }
    );
  }

  /*
   * Admin kendi hesabını yanlışlıkla
   * pasif yapamasın.
   */
  if (
    userId ===
      auth.appUser.id &&
    status !== "active"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Kendi yönetici hesabınızı pasif yapamazsınız.",
      },
      { status: 400 }
    );
  }

  const supabase =
    getSupabaseAdmin();

  const existing =
    await supabase
      .from("app_users")
      .select(
        "id,email,name,role,status"
      )
      .eq(
        "id",
        userId
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

  if (!existing.data) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Kullanıcı bulunamadı.",
      },
      { status: 404 }
    );
  }

  /*
   * Başka bir admin hesabını da
   * bu basit ekrandan pasif etmiyoruz.
   */
  if (
    existing.data.role ===
      "admin" &&
    status !== "active"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Yönetici hesabı bu ekrandan pasif yapılamaz.",
      },
      { status: 400 }
    );
  }

  const updated =
    await supabase
      .from("app_users")
      .update({
        status,
      })
      .eq(
        "id",
        userId
      )
      .select(
        "id,email,name,role,status,created_at"
      )
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
    user:
      updated.data,
  });
}
