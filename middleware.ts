import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },

  callbacks: {
    authorized: ({ token, req }) => {
      const pathname = req.nextUrl.pathname;
      const publicApi =
        pathname.startsWith("/api/auth/") ||
        pathname === "/api/account/status" ||
        pathname === "/api/health" ||
        pathname === "/api/alarm-dispatch";

      if (pathname.startsWith("/api/") && !publicApi) {
        return token?.appUserStatus === "active";
      }

      return Boolean(token);
    },
  },
});

export const config = {
  matcher: [
    "/calendar/:path*",
    "/cases/:path*",
    "/mail-connect/:path*",
    "/api/:path*",
  ],
};
