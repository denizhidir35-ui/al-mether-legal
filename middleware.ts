import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },

  callbacks: {
    authorized: ({ token }) => {
      return Boolean(token);
    },
  },
});

export const config = {
  matcher: [
    "/calendar/:path*",
    "/cases/:path*",
    "/mail-connect/:path*",
  ],
};
