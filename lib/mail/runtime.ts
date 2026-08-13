import { google } from "googleapis";
import { ImapFlow } from "imapflow";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

import {
  decryptMailSecret,
} from "@/lib/mail/credentialCrypto";

import {
  assertPublicMailHostname,
} from "@/lib/mail/discovery";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

export type MailConnectionRow = {
  id: string;
  user_id: string;
  provider: "google" | "microsoft" | "imap" | string;
  email: string | null;
  status: string | null;
  display_name?: string | null;

  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;

  settings?: Record<string, unknown> | null;
  secret_encrypted?: string | null;
};

export async function getOwnedMailConnection(
  connectionId: string
) {
  const {
    appUser,
    error,
  } =
    await getOrCreateAppUser();

  if (
    error ||
    !appUser
  ) {
    throw new Error(
      error ||
      "Oturum bulunamadı."
    );
  }

  const supabase =
    getSupabaseAdmin();

  const result =
    await supabase
      .from("mail_connections")
      .select("*")
      .eq(
        "id",
        connectionId
      )
      .eq(
        "user_id",
        appUser.id
      )
      .eq(
        "status",
        "connected"
      )
      .maybeSingle();

  if (result.error) {
    throw new Error(
      result.error.message
    );
  }

  if (!result.data) {
    throw new Error(
      "Mail hesabı bulunamadı."
    );
  }

  return {
    appUser,
    supabase,
    connection:
      result.data as MailConnectionRow,
  };
}

function createGoogleOAuthClient(
  connection: MailConnectionRow,
  supabase: ReturnType<
    typeof getSupabaseAdmin
  >
) {
  const oauth2Client =
    new google.auth.OAuth2(
      process.env
        .GOOGLE_CLIENT_ID,
      process.env
        .GOOGLE_CLIENT_SECRET
    );

  oauth2Client.setCredentials({
    access_token:
      connection.access_token ||
      undefined,

    refresh_token:
      connection.refresh_token ||
      undefined,

    expiry_date:
      connection.token_expires_at
        ? new Date(
            connection
              .token_expires_at
          ).getTime()
        : undefined,
  });

  oauth2Client.on(
    "tokens",
    async (tokens) => {
      const update:
        Record<string, unknown> =
        {
          updated_at:
            new Date()
              .toISOString(),
        };

      if (
        tokens.access_token
      ) {
        update.access_token =
          tokens.access_token;
      }

      if (
        tokens.refresh_token
      ) {
        update.refresh_token =
          tokens.refresh_token;
      }

      if (
        tokens.expiry_date
      ) {
        update.token_expires_at =
          new Date(
            tokens.expiry_date
          ).toISOString();
      }

      await supabase
        .from(
          "mail_connections"
        )
        .update(update)
        .eq(
          "id",
          connection.id
        )
        .eq(
          "user_id",
          connection.user_id
        );
    }
  );

  return oauth2Client;
}

export async function getGoogleGrantedScopes(
  connection: MailConnectionRow,
  supabase: ReturnType<
    typeof getSupabaseAdmin
  >
) {
  const oauth2Client =
    createGoogleOAuthClient(
      connection,
      supabase
    );

  const accessTokenResult =
    await oauth2Client
      .getAccessToken();

  const accessToken =
    accessTokenResult?.token;

  if (!accessToken) {
    throw new Error(
      "Gmail izinleri doğrulanamadı."
    );
  }

  const tokenInfo =
    await oauth2Client
      .getTokenInfo(
        accessToken
      );

  return tokenInfo.scopes || [];
}

export function createGoogleMailClient(
  connection: MailConnectionRow,
  supabase: ReturnType<
    typeof getSupabaseAdmin
  >
) {
  const oauth2Client =
    createGoogleOAuthClient(
      connection,
      supabase
    );

  return google.gmail({
    version: "v1",
    auth: oauth2Client,
  });
}

export async function getMicrosoftAccessToken(
  connection: MailConnectionRow,
  supabase: ReturnType<
    typeof getSupabaseAdmin
  >
) {
  const expiresAt =
    connection
      .token_expires_at
      ? new Date(
          connection
            .token_expires_at
        ).getTime()
      : 0;

  if (
    connection.access_token &&
    expiresAt >
      Date.now() + 60_000
  ) {
    return connection
      .access_token;
  }

  if (
    !connection.refresh_token
  ) {
    throw new Error(
      "Microsoft oturumu yenilenemedi. Hesabı yeniden bağlayın."
    );
  }

  const clientId =
    process.env
      .MICROSOFT_CLIENT_ID;

  const clientSecret =
    process.env
      .MICROSOFT_CLIENT_SECRET;

  if (
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "Microsoft mail yapılandırması eksik."
    );
  }

  const params =
    new URLSearchParams({
      client_id:
        clientId,

      client_secret:
        clientSecret,

      grant_type:
        "refresh_token",

      refresh_token:
        connection
          .refresh_token,

      scope: [
        "openid",
        "profile",
        "email",
        "offline_access",
        "User.Read",
        "Mail.ReadWrite",
        "Mail.Send",
      ].join(" "),
    });

  const response =
    await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body: params,

        cache: "no-store",
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data?.access_token
  ) {
    throw new Error(
      "Microsoft mail oturumu yenilenemedi."
    );
  }

  const nextExpiry =
    new Date(
      Date.now() +
        Number(
          data.expires_in ||
          3600
        ) *
          1000
    ).toISOString();

  const nextRefresh =
    data.refresh_token ||
    connection.refresh_token;

  await supabase
    .from(
      "mail_connections"
    )
    .update({
      access_token:
        data.access_token,

      refresh_token:
        nextRefresh,

      token_expires_at:
        nextExpiry,

      updated_at:
        new Date()
          .toISOString(),
    })
    .eq(
      "id",
      connection.id
    )
    .eq(
      "user_id",
      connection.user_id
    );

  return String(
    data.access_token
  );
}

function readSetting(
  settings:
    | Record<string, unknown>
    | null
    | undefined,
  key: string
) {
  const value =
    settings?.[key];

  return value;
}

export async function createImapClient(
  connection: MailConnectionRow
) {
  if (
    !connection.email ||
    !connection
      .secret_encrypted
  ) {
    throw new Error(
      "Kurumsal mail bağlantı bilgileri eksik."
    );
  }

  const settings =
    connection.settings || {};

  const hostRaw =
    String(
      readSetting(
        settings,
        "imapHost"
      ) || ""
    ).trim();

  const port =
    Number(
      readSetting(
        settings,
        "imapPort"
      ) || 993
    );

  const secure =
    Boolean(
      readSetting(
        settings,
        "imapSecure"
      )
    );

  const starttls =
    Boolean(
      readSetting(
        settings,
        "imapStarttls"
      )
    );

  if (
    !hostRaw ||
    !Number.isFinite(port)
  ) {
    throw new Error(
      "IMAP ayarları eksik."
    );
  }

  const host =
    await assertPublicMailHostname(
      hostRaw
    );

  const password =
    decryptMailSecret(
      connection
        .secret_encrypted
    );

  const client =
    new ImapFlow({
      host,
      port,
      secure,

      doSTARTTLS:
        starttls,

      auth: {
        user:
          connection.email,
        pass: password,
      },

      connectionTimeout:
        10_000,

      greetingTimeout:
        10_000,

      socketTimeout:
        15_000,

      logger: false,
    });

  await client.connect();

  return client;
}

export function htmlToText(
  input: string
) {
  return input
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<br\s*\/?>/gi,
      "\n"
    )
    .replace(
      /<\/p>/gi,
      "\n"
    )
    .replace(
      /<[^>]+>/g,
      " "
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /\r/g,
      ""
    )
    .replace(
      /\n[ \t]+/g,
      "\n"
    )
    .replace(
      /[ \t]{2,}/g,
      " "
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
}
