import { NextResponse } from "next/server";

import { getOrCreateAppUser } from "@/lib/alUser";
import { isPendingApprovalStatus } from "@/lib/userApproval";

export async function GET() {
  const result = await getOrCreateAppUser();

  if (!result.appUser) {
    return NextResponse.json(
      { ok: false, error: result.error || "Oturum bulunamadı." },
      { status: 401 }
    );
  }

  const status = result.appUser.status || "inactive";

  return NextResponse.json({
    ok: status === "active",
    status,
    pending: isPendingApprovalStatus(status),
    message: result.error,
  });
}
