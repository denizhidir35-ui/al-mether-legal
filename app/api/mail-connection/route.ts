import {
  NextResponse,
} from "next/server";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

import {
  toMailAccountDTO,
} from "@/lib/mail/accountModel";

import {
  getGmailScopeStatus,
  mergeGoogleOAuthScopes,
  readStoredGoogleScopes,
} from "@/lib/mail/googleScopes";

import {
  getGoogleGrantedScopes,
  type MailConnectionRow,
} from "@/lib/mail/runtime";

export async function GET() {
  const {
    appUser,
    error,
  } =
    await getOrCreateAppUser();

  if (
    error ||
    !appUser
  ) {
    return NextResponse.json(
      {
        ok: false,
        connected:
          false,

        error:
          error ||
          "Kullanıcı bulunamadı.",
      },
      {
        status: 401,
      }
    );
  }

  const supabase =
    getSupabaseAdmin();

  const result =
    await supabase
      .from(
        "mail_connections"
      )
      .select("*")
      .eq(
        "user_id",
        appUser.id
      )
      .eq(
        "status",
        "connected"
      );

  if (
    result.error
  ) {
    return NextResponse.json(
      {
        ok: false,
        connected:
          false,

        error:
          result.error.message,
      },
      {
        status: 500,
      }
    );
  }

  const connections =
    await Promise.all(
      (result.data || [])
        .map(async (row) => {
          const connection =
            row as MailConnectionRow;
          const account =
            toMailAccountDTO(
              connection
            );

          if (
            connection.provider !==
            "google"
          ) {
            return account;
          }

          let scopes =
            readStoredGoogleScopes(
              connection.settings
            );

          if (scopes.length === 0) {
            try {
              scopes =
                await getGoogleGrantedScopes(
                  connection,
                  supabase
                );

              const settings =
                mergeGoogleOAuthScopes(
                  connection.settings,
                  scopes
                );

              await supabase
                .from(
                  "mail_connections"
                )
                .update({
                  settings,
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
                  appUser.id
                );
            } catch {
              scopes = [];
            }
          }

          const scopeStatus =
            getGmailScopeStatus(
              scopes
            );

          return {
            ...account,
            gmailTrashReady:
              scopeStatus
                .trashReady,
            gmailReconnectRequired:
              scopeStatus
                .reconnectRequired,
          };
        })
    );

  return NextResponse.json({
    ok: true,

    connected:
      connections.length >
      0,

    connections,

    capabilities: {
      google:
        Boolean(
          process.env
            .GOOGLE_CLIENT_ID &&
          process.env
            .GOOGLE_CLIENT_SECRET
        ),

      microsoft:
        Boolean(
          process.env
            .MICROSOFT_CLIENT_ID &&
          process.env
            .MICROSOFT_CLIENT_SECRET
        ),

      imap:
        Boolean(
          process.env
            .MAIL_CREDENTIALS_KEY
        ),
    },
  });
}
