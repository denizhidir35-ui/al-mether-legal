import "server-only";

import { createHash } from "node:crypto";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const PENDING_APPROVAL_STATUS = "pending_approval";

export function isPendingApprovalStatus(status: unknown) {
  return status === "pending" || status === PENDING_APPROVAL_STATUS;
}

export function appUserAccessMessage(status: unknown) {
  if (isPendingApprovalStatus(status)) {
    return "Hesabınız yönetici onayı bekliyor.";
  }

  if (status === "rejected") {
    return "Hesabınız reddedildi. Yönetici ile iletişime geçin.";
  }

  return "AL Mether Legal hesabınız pasif durumda. Yönetici ile iletişime geçin.";
}

type PendingUser = {
  id: string;
  email: string;
  name?: string | null;
};

function inviteAcceptedNotificationId(userId: string, adminId: string) {
  const hash = createHash("sha256")
    .update(`legal:user-approval:invite-accepted:${userId}:${adminId}`)
    .digest("hex");
  const variant = ((Number.parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);

  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function notifyAdminsOfPendingUser(user: PendingUser) {
  const supabase = getSupabaseAdmin();
  const admins = await supabase
    .from("app_users")
    .select("id")
    .eq("role", "admin")
    .eq("status", "active");

  if (admins.error || !admins.data?.length) {
    if (admins.error) {
      console.error("ADMIN NOTIFICATION LOOKUP ERROR:", admins.error.message);
    }
    return;
  }

  const displayName = user.name?.trim() || "İsimsiz kullanıcı";
  const message = `Yeni kullanıcı onay bekliyor: ${displayName} — ${user.email}`;
  const notifications = admins.data.map((admin) => ({
    id: crypto.randomUUID(),
    title: "Yeni kullanıcı onayı",
    message,
    channel: "in-app",
    status: "pending",
    product: "legal",
    user_id: admin.id,
    source: "user-approval",
    source_id: user.id,
    metadata: { pendingUserId: user.id },
  }));

  const inserted = await supabase.from("core_notifications").insert(notifications);
  if (inserted.error) {
    console.error("ADMIN NOTIFICATION CREATE ERROR:", inserted.error.message);
  }
}

export async function notifyAdminsOfInviteAccepted(user: PendingUser) {
  const supabase = getSupabaseAdmin();
  const admins = await supabase
    .from("app_users")
    .select("id")
    .eq("role", "admin")
    .eq("status", "active");

  if (admins.error || !admins.data?.length) {
    return {
      ok: false,
      error: admins.error?.message || "Aktif yönetici bulunamadı.",
    };
  }

  const displayName = user.name?.trim() || "İsimsiz kullanıcı";
  const notifications = admins.data.map((admin) => ({
    id: inviteAcceptedNotificationId(user.id, admin.id),
    title: "Davet kabul edildi",
    message: `${displayName} daveti kabul etti. Hesabı aktivasyon bekliyor.`,
    channel: "in-app",
    status: "pending",
    product: "legal",
    user_id: admin.id,
    source: "user-approval",
    source_id: user.id,
    metadata: {
      pendingUserId: user.id,
      event: "invite-accepted",
      target: "/settings#user-management",
    },
  }));

  const inserted = await supabase
    .from("core_notifications")
    .upsert(notifications, {
      onConflict: "id",
      ignoreDuplicates: true,
    });

  return inserted.error
    ? { ok: false, error: inserted.error.message }
    : { ok: true, error: null };
}
