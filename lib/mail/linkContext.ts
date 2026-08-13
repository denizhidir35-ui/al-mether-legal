import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export const MAIL_LINK_COOKIE =
  "mether_mail_link";

export const MAIL_LINK_MAX_AGE_SECONDS =
  10 * 60;

export type MailLinkProvider =
  | "google"
  | "microsoft";

type MailLinkPayload = {
  userId: string;
  provider: MailLinkProvider;
  expiresAt: number;
};

function signingSecret() {
  const secret =
    process.env
      .NEXTAUTH_SECRET ||
    "";

  if (!secret) {
    throw new Error(
      "NEXTAUTH_SECRET tanımlı değil."
    );
  }

  return secret;
}

function signature(
  payload: string
) {
  return createHmac(
    "sha256",
    signingSecret()
  )
    .update(payload)
    .digest("base64url");
}

export function createMailLinkToken(
  userId: string,
  provider: MailLinkProvider,
  now = Date.now()
) {
  const payload =
    Buffer.from(
      JSON.stringify({
        userId,
        provider,
        expiresAt:
          now +
          MAIL_LINK_MAX_AGE_SECONDS *
            1000,
      } satisfies MailLinkPayload),
      "utf8"
    ).toString("base64url");

  return `${payload}.${signature(
    payload
  )}`;
}

export function verifyMailLinkToken(
  token: string,
  provider: MailLinkProvider,
  now = Date.now()
) {
  const [payload, received] =
    token.split(".");

  if (
    !payload ||
    !received
  ) {
    return null;
  }

  const expected =
    signature(payload);

  const receivedBuffer =
    Buffer.from(received);

  const expectedBuffer =
    Buffer.from(expected);

  if (
    receivedBuffer.length !==
      expectedBuffer.length ||
    !timingSafeEqual(
      receivedBuffer,
      expectedBuffer
    )
  ) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(
        Buffer.from(
          payload,
          "base64url"
        ).toString("utf8")
      ) as Partial<MailLinkPayload>;

    if (
      typeof parsed.userId !==
        "string" ||
      !parsed.userId ||
      parsed.provider !==
        provider ||
      typeof parsed.expiresAt !==
        "number" ||
      parsed.expiresAt < now
    ) {
      return null;
    }

    return {
      userId:
        parsed.userId,
      provider:
        parsed.provider,
      expiresAt:
        parsed.expiresAt,
    } as MailLinkPayload;
  } catch {
    return null;
  }
}
