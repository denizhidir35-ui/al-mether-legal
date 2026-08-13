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
    (result.data || [])
      .map(
        toMailAccountDTO
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
