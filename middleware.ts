import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isPublicIndexPath } from "@/lib/publicRoutes";

function isPublicApi(pathname: string) {
  return (
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/app/windows-version" ||
    pathname === "/api/account/status" ||
    pathname === "/api/health" ||
    pathname === "/api/alarm-dispatch"
  );
}

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname;

    if (isPublicIndexPath(pathname)) {
      return NextResponse.next();
    }

    if (!pathname.startsWith("/api/") || isPublicApi(pathname)) {
      return NextResponse.next();
    }

    const token = req.nextauth.token;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Oturum bulunamadı." },
        { status: 401 }
      );
    }

    if (token.appUserStatus !== "active") {
      return NextResponse.json(
        { ok: false, error: "Aktif kullanıcı hesabı gerekiyor." },
        { status: 403 }
      );
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },

    callbacks: {
      authorized: ({ token, req }) => {
        if (isPublicIndexPath(req.nextUrl.pathname)) {
          return true;
        }

        if (req.nextUrl.pathname.startsWith("/api/")) {
          return true;
        }

        return Boolean(token);
      },
    },
  }
);

export const config = {
  matcher: [
    "/",
    "/calendar/:path*",
    "/cases/:path*",
    "/celse-import/:path*",
    "/converter/:path*",
    "/dashboard/:path*",
    "/dashboard-v2/:path*",
    "/inbox/:path*",
    "/mail-connect/:path*",
    "/search/:path*",
    "/settings/:path*",
    "/uets-import/:path*",
    "/api/:path*",
  ],
};
