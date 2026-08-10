import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const googleLoginProvider =
  GoogleProvider({
    clientId:
      process.env.GOOGLE_CLIENT_ID!,

    clientSecret:
      process.env.GOOGLE_CLIENT_SECRET!,

    authorization: {
      params: {
        prompt: "select_account",

        scope:
          "openid email profile",
      },
    },
  });

const googleMailProvider = {
  ...GoogleProvider({
    clientId:
      process.env.GOOGLE_CLIENT_ID!,

    clientSecret:
      process.env.GOOGLE_CLIENT_SECRET!,

    authorization: {
      params: {
        prompt: "consent",
        access_type: "offline",
        response_type: "code",

        scope:
          "openid email profile https://www.googleapis.com/auth/gmail.readonly",
      },
    },
  }),

  id: "google-mail",
  name: "Google Mail",
};

function cleanEmail(
  value: unknown
) {
  return typeof value === "string"
    ? value
        .trim()
        .toLocaleLowerCase("tr-TR")
    : "";
}

export const authOptions: NextAuthOptions = {
  providers: [
    googleLoginProvider,
    googleMailProvider,
  ],

  callbacks: {
    async signIn({
      user,
      account,
    }) {
      try {
        const email =
          cleanEmail(user?.email);

        if (!email) {
          return false;
        }

        const supabase =
          getSupabaseAdmin();

        const existingUser =
          await supabase
            .from("app_users")
            .select("*")
            .eq("email", email)
            .maybeSingle();

        if (existingUser.error) {
          console.error(
            "APP USER LOGIN ERROR:",
            existingUser.error.message
          );

          return false;
        }

        if (
          existingUser.data?.status &&
          existingUser.data.status !==
            "active"
        ) {
          return false;
        }

        let appUser =
          existingUser.data;

        if (!appUser) {
          const created =
            await supabase
              .from("app_users")
              .insert({
                email,
                google_id: email,
                name:
                  user?.name ||
                  email.split("@")[0] ||
                  "Avukat",
                role: "lawyer",
                status: "active",
              })
              .select("*")
              .single();

          if (
            created.error ||
            !created.data
          ) {
            console.error(
              "APP USER CREATE ERROR:",
              created.error?.message
            );

            return false;
          }

          appUser =
            created.data;
        }

        if (
          account?.provider ===
          "google-mail"
        ) {
          const expiresAt =
            account.expires_at
              ? new Date(
                  account.expires_at *
                    1000
                ).toISOString()
              : null;

          const existingConnection =
            await supabase
              .from(
                "mail_connections"
              )
              .select(
                "refresh_token"
              )
              .eq(
                "user_id",
                appUser.id
              )
              .eq(
                "provider",
                "google"
              )
              .maybeSingle();

          if (
            existingConnection.error
          ) {
            console.error(
              "MAIL CONNECTION READ ERROR:",
              existingConnection.error
                .message
            );

            return false;
          }

          const refreshToken =
            account.refresh_token ||
            existingConnection.data
              ?.refresh_token ||
            null;

          const connection =
            await supabase
              .from(
                "mail_connections"
              )
              .upsert(
                {
                  user_id:
                    appUser.id,

                  provider:
                    "google",

                  email,

                  status:
                    "connected",

                  access_token:
                    account.access_token ||
                    null,

                  refresh_token:
                    refreshToken,

                  token_expires_at:
                    expiresAt,

                  updated_at:
                    new Date()
                      .toISOString(),
                },
                {
                  onConflict:
                    "user_id,provider",
                }
              );

          if (connection.error) {
            console.error(
              "MAIL CONNECTION SAVE ERROR:",
              connection.error.message
            );

            return false;
          }
        }

        return true;
      } catch (error) {
        console.error(
          "NEXTAUTH SIGNIN ERROR:",
          error instanceof Error
            ? error.message
            : "Unknown error"
        );

        return false;
      }
    },

    async jwt({
      token,
      account,
    }) {
      if (account?.provider) {
        token.connectedProvider =
          account.provider;
      }

      return token;
    },

    async session({
      session,
      token,
    }) {
      (
        session as any
      ).connectedProvider =
        token.connectedProvider;

      return session;
    },
  },

  debug:
    process.env.NODE_ENV !==
    "production",

  secret:
    process.env.NEXTAUTH_SECRET,
};
