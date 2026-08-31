import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { isPublicIndexPath } from "@/lib/publicRoutes";
import { getSubscriptionAccess } from "@/lib/subscriptionServer";
import { subscriptionMessage } from "@/lib/subscription";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Public identity/recovery routes remain usable by pending/expired accounts.
  if (isPublicIndexPath(path) || path === "/login" || path.startsWith("/auth/") ||
      path === "/download" || path.startsWith("/api/auth/") ||
      ["/api/app/windows-version", "/api/health", "/api/alarm-dispatch"].includes(path)) {
    return NextResponse.next();
  }
  const api = path.startsWith("/api/");
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.email) {
    if (api) return NextResponse.json({ ok: false, error: "Oturum bulunamadı." }, { status: 401 });
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(login);
  }
  if (path === "/account/access" || path === "/api/account/status") return NextResponse.next();
  try {
    const access = await getSubscriptionAccess(token.email);
    if (!access?.allowed) {
      if (api) return NextResponse.json({ ok: false, error: access ? subscriptionMessage(access) : "Hesap bulunamadı.",
        subscription_status: access?.subscription_status }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
      return NextResponse.redirect(new URL("/account/access", request.url));
    }
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    if (api) return NextResponse.json({ ok: false, error: "Lisans doğrulanamadı." }, { status: 503 });
    return NextResponse.redirect(new URL("/account/access", request.url));
  }
}

export const config = {
  // Cover current AND future app pages/APIs, including file-viewer and RSC requests.
  matcher: ["/((?!_next/static|_next/image|brand/|favicon.ico|icon.png|apple-icon.png|opengraph-image|robots.txt|sitemap.xml|manifest.json|legal-push-sw.js|download.css|download-install.js|file.svg|globe.svg|next.svg|vercel.svg|window.svg).*)"],
};
