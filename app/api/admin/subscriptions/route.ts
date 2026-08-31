import { NextRequest, NextResponse } from "next/server";
import { getOrCreateAppUser } from "@/lib/alUser";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

async function requireOwner() {
  const result = await getOrCreateAppUser();
  return !result.error && result.appUser?.is_license_owner &&
    result.appUser.subscription_status === "ACTIVE" ? result.appUser : null;
}

export async function GET() {
  if (!await requireOwner()) return NextResponse.json({ ok: false, error: "OWNER yetkisi gerekiyor." }, { status: 403 });
  const { data, error } = await getSupabaseAdmin().from("app_users")
    .select("id,name,email,subscription_status,trial_started_at,trial_ends_at,licensed_until,is_license_owner")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: "Kullanıcılar yüklenemedi." }, { status: 503 });
  return NextResponse.json({ ok: true, users: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ ok: false, error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ ok: false, error: "OWNER yetkisi gerekiyor." }, { status: 403 });
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek." }, { status: 400 });
  }
  if (!body || typeof body.userId !== "string" || !["approve", "extend", "activate", "suspend"].includes(body.action) ||
      (body.days !== undefined && ![2, 5, 7].includes(body.days)) ||
      (body.licensedUntil != null && (typeof body.licensedUntil !== "string" || !Number.isFinite(Date.parse(body.licensedUntil))))) {
    return NextResponse.json({ ok: false, error: "Geçersiz lisans işlemi." }, { status: 400 });
  }
  const { data, error } = await getSupabaseAdmin().rpc("manage_subscription", {
    p_actor_id: owner.id, p_user_id: body.userId, p_action: body.action,
    p_days: body.days ?? 5, p_licensed_until: body.licensedUntil ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error:
    error.code === "42501" ? "OWNER yetkisi gerekiyor; OWNER hesapları bu ekrandan değiştirilemez." :
    error.code === "22023" ? "Bu işlem mevcut hesap durumuna uygun değil. Onaylanmış demolar için Demo Uzat kullanın." :
    "Lisans işlemi tamamlanamadı." }, { status: error.code === "42501" ? 403 : error.code === "22023" ? 409 : 503 });
  return NextResponse.json({ ok: true, access: data }, { headers: { "Cache-Control": "private, no-store" } });
}
