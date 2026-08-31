import { NextResponse } from "next/server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSubscriptionAccess } from "@/lib/subscriptionServer";
import { subscriptionMessage } from "@/lib/subscription";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Oturum bulunamadı." }, { status: 401 });
  }
  try {
    const access = await getSubscriptionAccess(session.user.email);
    if (!access) return NextResponse.json({ ok: false, message: "Hesap bulunamadı." }, { status: 403 });
    return NextResponse.json({ ...access, ok: access.allowed,
      status: access.allowed ? "active" : "blocked",
      pending: access.subscription_status === "TRIAL_PENDING", message: subscriptionMessage(access) },
    { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ ok: false, message: "Lisans bilgisi doğrulanamadı. Lütfen yeniden deneyin." }, { status: 503 });
  }
}
