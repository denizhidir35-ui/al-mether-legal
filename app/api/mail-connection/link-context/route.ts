import {
  NextResponse,
} from "next/server";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

import {
  createMailLinkToken,
  MAIL_LINK_COOKIE,
  MAIL_LINK_MAX_AGE_SECONDS,
  type MailLinkProvider,
} from "@/lib/mail/linkContext";

export const runtime =
  "nodejs";

export async function POST(
  request: Request
) {
  const {
    appUser,
    error,
  } = await getOrCreateAppUser();

  if (
    error ||
    !appUser
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error ||
          "Oturum bulunamadı.",
      },
      {
        status: 401,
      }
    );
  }

  const body =
    await request.json()
      .catch(
        () => null
      );

  const provider =
    body?.provider ===
      "google" ||
    body?.provider ===
      "microsoft"
      ? body.provider as MailLinkProvider
      : null;

  if (!provider) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Mail sağlayıcısı geçersiz.",
      },
      {
        status: 400,
      }
    );
  }

  const response =
    NextResponse.json({
      ok: true,
    });

  response.cookies.set(
    MAIL_LINK_COOKIE,
    createMailLinkToken(
      appUser.id,
      provider
    ),
    {
      httpOnly: true,
      sameSite: "lax",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/",
      maxAge:
        MAIL_LINK_MAX_AGE_SECONDS,
    }
  );

  return response;
}
