import {
  NextAuthOptions,
} from "next-auth";

import GoogleProvider
  from "next-auth/providers/google";
import CredentialsProvider
  from "next-auth/providers/credentials";

import {
  cookies,
} from "next/headers";

import {
  createClient as createSupabaseAuthClient,
} from "@supabase/supabase-js";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

import {
  MAIL_LINK_COOKIE,
  verifyMailLinkToken,
} from "@/lib/mail/linkContext";

import {
  isPendingApprovalStatus,
  notifyAdminsOfPendingUser,
  PENDING_APPROVAL_STATUS,
} from "@/lib/userApproval";

const TRUSTED_DEVICE_SESSION_SECONDS =
  60 * 60 * 24 * 365;

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

    maxAge:
      TRUSTED_DEVICE_SESSION_SECONDS,
  },

  jwt: {
    maxAge:
      TRUSTED_DEVICE_SESSION_SECONDS,
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

        if (mailProvider) {
          const cookieStore =
            await cookies();

          const linkContext =
            verifyMailLinkToken(
              cookieStore
                .get(
                  MAIL_LINK_COOKIE
                )?.value ||
                "",
              mailProvider
            );

          if (!linkContext) {
            return false;
          }

          const owner =
            await supabase
              .from(
                "app_users"
              )
              .select("*")
              .eq(
                "id",
                linkContext
                  .userId
              )
              .eq(
                "status",
                "active"
              )
              .maybeSingle();

          if (
            owner.error ||
            !owner.data
          ) {
            return false;
          }

          const previous =
            await supabase
              .from(
                "mail_connections"
              )
              .select(
                "id,refresh_token"
              )
              .eq(
                "user_id",
                owner.data.id
              )
              .eq(
                "provider",
                mailProvider
              )
              .eq(
                "email",
                email
              )
              .maybeSingle();

          if (previous.error) {
            return false;
          }

          const expiresAt =
            account?.expires_at
              ? new Date(
                  account
                    .expires_at *
                    1000
                ).toISOString()
              : null;

          const values = {
            user_id:
              owner.data.id,
            provider:
              mailProvider,
            email,
            display_name:
              user?.name ||
              email,
            status:
              "connected",
            access_token:
              account
                ?.access_token ||
              null,
            refresh_token:
              account
                ?.refresh_token ||
              previous.data
                ?.refresh_token ||
              null,
            token_expires_at:
              expiresAt,
            updated_at:
              new Date()
                .toISOString(),
          };

          const saved =
            previous.data?.id
              ? await supabase
                  .from(
                    "mail_connections"
                  )
                  .update(values)
                  .eq(
                    "id",
                    previous
                      .data.id
                  )
                  .eq(
                    "user_id",
                    owner.data.id
                  )
              : await supabase
                  .from(
                    "mail_connections"
                  )
                  .insert(values);

          if (saved.error) {
            console.error(
              "MAIL CONNECTION SAVE ERROR:",
              saved.error
                .message
            );

            return false;
          }

          user.email =
            owner.data.email;
          user.name =
            owner.data.name ||
            user.name;

          try {
            cookieStore.delete(
              MAIL_LINK_COOKIE
            );
          } catch {}

          return true;
        }

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
