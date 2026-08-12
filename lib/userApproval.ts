import "server-only";

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
