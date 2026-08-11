import {
  NextAuthOptions,
} from "next-auth";

import GoogleProvider
  from "next-auth/providers/google";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

const googleLoginProvider =
  GoogleProvider({
    clientId:
      process.env
        .GOOGLE_CLIENT_ID!,

    clientSecret:
      process.env
        .GOOGLE_CLIENT_SECRET!,

    authorization: {
      params: {
        prompt:
          "select_account",

        scope:
          "openid email profile",
      },
    },
  });

const googleMailProvider = {
  ...GoogleProvider({
    clientId:
      process.env
        .GOOGLE_CLIENT_ID!,

    clientSecret:
      process.env
        .GOOGLE_CLIENT_SECRET!,

    authorization: {
      params: {
        prompt:
          "consent",

        access_type:
          "offline",

        response_type:
          "code",

        scope:
          [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
          ].join(" "),
      },
    },
  }),

  id:
    "google-mail",

  name:
    "Google Mail",
};

const microsoftMailProvider:
  any = {
  id:
    "microsoft-mail",

  name:
    "Microsoft Mail",

  type:
    "oauth",

  wellKnown:
    "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",

  clientId:
    process.env
      .MICROSOFT_CLIENT_ID ||
    "",

  clientSecret:
    process.env
      .MICROSOFT_CLIENT_SECRET ||
    "",

  authorization: {
    params: {
      scope: [
        "openid",
        "profile",
        "email",
        "offline_access",
        "User.Read",
        "Mail.ReadWrite",
        "Mail.Send",
      ].join(" "),
    },
  },

  idToken:
    true,

  checks: [
    "pkce",
    "state",
  ],

  profile(
    profile: any
  ) {
    return {
      id:
        profile.sub,

      name:
        profile.name ||
        profile
          .preferred_username,

      email:
        profile.email ||
        profile
          .preferred_username,

      image:
        null,
    };
  },
};

function cleanEmail(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value
        .trim()
        .toLocaleLowerCase(
          "tr-TR"
        )
    : "";
}

const providers:
  NextAuthOptions[
    "providers"
  ] = [
    googleLoginProvider,
    googleMailProvider,
  ];

if (
  process.env
    .MICROSOFT_CLIENT_ID &&
  process.env
    .MICROSOFT_CLIENT_SECRET
) {
  providers.push(
    microsoftMailProvider
  );
}

export const authOptions:
  NextAuthOptions = {
  providers,

  callbacks: {
    async signIn({
      user,
      account,
    }) {
      try {
        const email =
          cleanEmail(
            user?.email
          );

        if (!email) {
          return false;
        }

        const supabase =
          getSupabaseAdmin();

        const existingUser =
          await supabase
            .from(
              "app_users"
            )
            .select("*")
            .eq(
              "email",
              email
            )
            .maybeSingle();

        if (
          existingUser.error
        ) {
          console.error(
            "APP USER LOGIN ERROR:",
            existingUser
              .error
              .message
          );

          return false;
        }

        if (
          existingUser
            .data
            ?.status &&
          existingUser
            .data
            .status !==
            "active"
        ) {
          return false;
        }

        let appUser =
          existingUser.data;

        if (!appUser) {
          const created =
            await supabase
              .from(
                "app_users"
              )
              .insert({
                email,

                google_id:
                  email,

                name:
                  user?.name ||
                  email
                    .split(
                      "@"
                    )[0] ||
                  "Avukat",

                role:
                  "lawyer",

                status:
                  "active",
              })
              .select("*")
              .single();

          if (
            created.error ||
            !created.data
          ) {
            return false;
          }

          appUser =
            created.data;
        }

        const accountProvider =
          account?.provider ||
          "";

        const mailProvider =
          accountProvider ===
          "google-mail"
            ? "google"
            : accountProvider ===
                "microsoft-mail"
              ? "microsoft"
              : "";

        if (
          mailProvider
        ) {
          const expiresAt =
            account?.expires_at
              ? new Date(
                  account
                    .expires_at *
                    1000
                ).toISOString()
              : null;

          const previous =
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
                mailProvider
              )
              .maybeSingle();

          if (
            previous.error
          ) {
            return false;
          }

          const refreshToken =
            account
              ?.refresh_token ||
            previous.data
              ?.refresh_token ||
            null;

          const saved =
            await supabase
              .from(
                "mail_connections"
              )
              .upsert(
                {
                  user_id:
                    appUser.id,

                  provider:
                    mailProvider,

                  email,

                  status:
                    "connected",

                  access_token:
                    account
                      ?.access_token ||
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

          if (
            saved.error
          ) {
            console.error(
              "MAIL CONNECTION SAVE ERROR:",
              saved
                .error
                .message
            );

            return false;
          }
        }

        return true;
      } catch (
        error
      ) {
        console.error(
          "NEXTAUTH SIGNIN ERROR:",
          error instanceof
          Error
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
      if (
        account
          ?.provider
      ) {
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
        token
          .connectedProvider;

      return session;
    },
  },

  debug:
    process.env
      .NODE_ENV !==
    "production",

  secret:
    process.env
      .NEXTAUTH_SECRET,
};
