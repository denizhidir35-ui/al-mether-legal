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

const PROTECTED_ADMIN_EMAIL =
  "denizhidir35@gmail.com";

function isMissingNotificationStorage(
  error: { code?: string } | null
) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01"
  );
}

async function cleanupUserApprovalNotifications(
  userId: string
) {
  const result =
    await getSupabaseAdmin()
      .from("core_notifications")
      .delete()
      .eq("source", "user-approval")
      .eq("source_id", userId);

  return result.error &&
    !isMissingNotificationStorage(
      result.error
    )
    ? result.error
    : null;
}

async function findAuthUserByEmail(
  email: string
) {
  const supabase =
    getSupabaseAdmin();
  const perPage = 1000;

  for (
    let page = 1;
    page <= 100;
    page += 1
  ) {
    const result =
      await supabase.auth.admin
        .listUsers({
          page,
          perPage,
        });

    if (result.error) {
      return {
        user: null,
        error:
          result.error.message,
      };
    }

    const user =
      result.data.users.find(
        (item) =>
          item.email
            ?.trim()
            .toLowerCase() ===
          email
      );

    if (user) {
      return {
        user,
        error: null,
      };
    }

    if (
      result.data.users.length <
      perPage
    ) {
      return {
        user: null,
        error: null,
      };
    }
  }

  return {
    user: null,
    error:
      "Auth kullanıcı listesi tamamlanamadı.",
  };
}

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
    .select("id,message,metadata,created_at")
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

export async function DELETE(
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
    userId ===
    auth.appUser.id
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Yönetici hesabı silinemez.",
      },
      { status: 403 }
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
      .eq("id", userId)
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
    const notificationError =
      await cleanupUserApprovalNotifications(
        userId
      );

    if (notificationError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Kullanıcı bildirimleri temizlenemedi.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      userId,
      alreadyDeleted: true,
    });
  }

  const email =
    String(
      existing.data.email || ""
    )
      .trim()
      .toLowerCase();

  if (
    existing.data.role ===
      "admin" ||
    email ===
      PROTECTED_ADMIN_EMAIL
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Yönetici hesabı silinemez.",
      },
      { status: 403 }
    );
  }

  if (
    existing.data.status ===
    "active"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Aktif kullanıcı önce pasif yapılmalıdır.",
      },
      { status: 409 }
    );
  }

  if (
    existing.data.status !== "pending" &&
    existing.data.status !== "pending_approval" &&
    existing.data.status !== "rejected" &&
    existing.data.status !== "inactive"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Bu kullanıcı durumu silmeye uygun değil.",
      },
      { status: 409 }
    );
  }

  const notificationError =
    await cleanupUserApprovalNotifications(
      userId
    );

  if (notificationError) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Kullanıcı bildirimleri temizlenemedi.",
      },
      { status: 500 }
    );
  }

  const authUser =
    await findAuthUserByEmail(
      email
    );

  if (authUser.error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Auth kullanıcısı doğrulanamadı.",
      },
      { status: 500 }
    );
  }

  if (authUser.user) {
    const deletedAuth =
      await supabase.auth.admin
        .deleteUser(
          authUser.user.id
        );

    if (deletedAuth.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Auth kullanıcısı silinemedi.",
        },
        { status: 500 }
      );
    }
  }

  const deletedUser =
    await supabase
      .from("app_users")
      .delete()
      .eq("id", userId);

  if (deletedUser.error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Uygulama kullanıcısı silinemedi.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    userId,
  });
}
