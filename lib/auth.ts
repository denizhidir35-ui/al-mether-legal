import {
  NextAuthOptions,
} from "next-auth";

import GoogleProvider
  from "next-auth/providers/google";
import CredentialsProvider
  from "next-auth/providers/credentials";

import {
  createClient as createSupabaseAuthClient,
} from "@supabase/supabase-js";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

import {
  isPendingApprovalStatus,
  notifyAdminsOfPendingUser,
  PENDING_APPROVAL_STATUS,
} from "@/lib/userApproval";

const credentialsProvider =
  CredentialsProvider({
    name:
      "E-posta ve Şifre",

    credentials: {
      email: {
        label:
          "E-posta",

        type:
          "email",
      },

      password: {
        label:
          "Şifre",

        type:
          "password",
      },
    },

    async authorize(
      credentials
    ) {
      const email =
        cleanEmail(
          credentials
            ?.email
        );

      const password =
        typeof credentials
          ?.password ===
        "string"
          ? credentials
              .password
          : "";

      const supabaseUrl =
        process.env
          .NEXT_PUBLIC_SUPABASE_URL;

      const supabaseAnonKey =
        process.env
          .NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (
        !email ||
        !password ||
        !supabaseUrl ||
        !supabaseAnonKey
      ) {
        return null;
      }

      const supabase =
        createSupabaseAuthClient(
          supabaseUrl,
          supabaseAnonKey,
          {
            auth: {
              autoRefreshToken:
                false,

              detectSessionInUrl:
                false,

              persistSession:
                false,
            },
          }
        );

      const result =
        await supabase.auth
          .signInWithPassword({
            email,
            password,
          });

      const authUser =
        result.data.user;

      if (
        result.error ||
        !authUser?.email
      ) {
        return null;
      }

      return {
        id:
          authUser.id,

        email:
          cleanEmail(
            authUser.email
          ),

        name:
          typeof authUser
            .user_metadata
            ?.full_name ===
          "string"
            ? authUser
                .user_metadata
                .full_name
            : email.split(
                "@"
              )[0],
      };
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
          "consent select_account",

        access_type:
          "offline",

        response_type:
          "code",

        scope:
          [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.modify",
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
    credentialsProvider,
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

  session: {
    strategy:
      "jwt",
  },

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
          existingUser.data &&
          existingUser.data.status !== "active" &&
          !isPendingApprovalStatus(
            existingUser.data.status
          )
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
                  PENDING_APPROVAL_STATUS,
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

          await notifyAdminsOfPendingUser(
            created.data
          );
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
          mailProvider &&
          appUser.status === "active"
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

      const email = cleanEmail(token.email);
      if (email) {
        const result = await getSupabaseAdmin()
          .from("app_users")
          .select("status")
          .eq("email", email)
          .maybeSingle();

        if (!result.error) {
          token.appUserStatus = result.data?.status || null;
        }
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
