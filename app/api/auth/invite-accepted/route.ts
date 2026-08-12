import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isPendingApprovalStatus,
  notifyAdminsOfInviteAccepted,
} from "@/lib/userApproval";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "Davet oturumu bulunamadı." },
      { status: 401 }
    );
  }

  const supabase = getSupabaseAdmin();
  const authenticated = await supabase.auth.getUser(accessToken);
  const authUser = authenticated.data.user;
  const email = authUser?.email?.trim().toLowerCase() || "";

  if (authenticated.error || !authUser || !email || !authUser.invited_at) {
    return NextResponse.json(
      { ok: false, error: "Geçerli bir davet oturumu gerekiyor." },
      { status: 401 }
    );
  }

  const appUser = await supabase
    .from("app_users")
    .select("id,email,name,status")
    .eq("email", email)
    .maybeSingle();

  if (appUser.error || !appUser.data) {
    return NextResponse.json(
      { ok: false, error: "Davet kullanıcısı bulunamadı." },
      { status: 404 }
    );
  }

  if (!isPendingApprovalStatus(appUser.data.status)) {
    return NextResponse.json(
      { ok: false, error: "Kullanıcı aktivasyon beklemiyor." },
      { status: 409 }
    );
  }

  const notified = await notifyAdminsOfInviteAccepted(appUser.data);

  if (!notified.ok) {
    return NextResponse.json(
      { ok: false, error: "Yönetici bildirimi oluşturulamadı." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
