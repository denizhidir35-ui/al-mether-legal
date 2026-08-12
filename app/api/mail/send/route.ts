import {
  randomUUID,
} from "node:crypto";

import {
  Readable,
} from "node:stream";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import nodemailer
  from "nodemailer";

import {
  decryptMailSecret,
} from "@/lib/mail/credentialCrypto";

import {
  assertPublicMailHostname,
} from "@/lib/mail/discovery";

import {
  resolveImapMailbox,
} from "@/lib/mail/folders";

import {
  createGoogleMailClient,
  createImapClient,
  getMicrosoftAccessToken,
  getOwnedMailConnection,
} from "@/lib/mail/runtime";

export const runtime =
  "nodejs";

async function mailMessageToBuffer(
  value: Buffer | Readable
): Promise<Buffer> {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of value) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk)
    );
  }

  return Buffer.concat(chunks);
}
const EMAIL =
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/i;

function parseRecipients(
  value: unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return [];
  }

  const unique =
    new Set<string>();

  for (
    const part
    of value.split(
      /[,;]+/
    )
  ) {
    const clean =
      part.trim()
        .toLowerCase();

    if (!clean) {
      continue;
    }

    if (
      !EMAIL.test(
        clean
      )
    ) {
      throw new Error(
        `Geçersiz e-posta adresi: ${clean}`
      );
    }

    unique.add(clean);
  }

  return Array.from(
    unique
  );
}

function cleanHeader(
  value: unknown
) {
  return String(
    value || ""
  )
    .replace(
      /[\r\n]+/g,
      " "
    )
    .trim();
}

function chunkBase64(
  value: string
) {
  return value
    .match(/.{1,76}/g)
    ?.join("\r\n") ||
    "";
}

function gmailRawMessage(
  from: string,
  to: string[],
  cc: string[],
  bcc: string[],
  subject: string,
  body: string
) {
  const headers = [
    `From: ${cleanHeader(
      from
    )}`,
    `To: ${to.join(", ")}`,
  ];

  if (cc.length) {
    headers.push(
      `Cc: ${cc.join(", ")}`
    );
  }

  if (bcc.length) {
    headers.push(
      `Bcc: ${bcc.join(", ")}`
    );
  }

  headers.push(
    `Subject: =?UTF-8?B?${Buffer.from(
      subject,
      "utf8"
    ).toString(
      "base64"
    )}?=`,

    "MIME-Version: 1.0",

    'Content-Type: text/plain; charset="UTF-8"',

    "Content-Transfer-Encoding: base64"
  );

  const encodedBody =
    chunkBase64(
      Buffer.from(
        body,
        "utf8"
      ).toString(
        "base64"
      )
    );

  return Buffer.from(
    `${headers.join(
      "\r\n"
    )}\r\n\r\n${encodedBody}`,
    "utf8"
  )
    .toString(
      "base64url"
    );
}

function graphRecipients(
  values: string[]
) {
  return values.map(
    (address) => ({
      emailAddress: {
        address,
      },
    })
  );
}

async function sendGoogle(
  connection: any,
  supabase: any,
  to: string[],
  cc: string[],
  bcc: string[],
  subject: string,
  body: string
) {
  const gmail =
    createGoogleMailClient(
      connection,
      supabase
    );

  const raw =
    gmailRawMessage(
      connection.email ||
        "",
      to,
      cc,
      bcc,
      subject,
      body
    );

  await gmail.users
    .messages.send({
      userId: "me",

      requestBody: {
        raw,
      },
    });
}

async function sendMicrosoft(
  connection: any,
  supabase: any,
  to: string[],
  cc: string[],
  bcc: string[],
  subject: string,
  body: string
) {
  const token =
    await getMicrosoftAccessToken(
      connection,
      supabase
    );

  const response =
    await fetch(
      "https://graph.microsoft.com/v1.0/me/sendMail",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            message: {
              subject,

              body: {
                contentType:
                  "Text",

                content:
                  body,
              },

              toRecipients:
                graphRecipients(
                  to
                ),

              ccRecipients:
                graphRecipients(
                  cc
                ),

              bccRecipients:
                graphRecipients(
                  bcc
                ),
            },

            saveToSentItems:
              true,
          }),

        cache: "no-store",
      }
    );

  if (!response.ok) {
    const data =
      await response
        .json()
        .catch(
          () => null
        );

    throw new Error(
      data?.error
        ?.message ||
      "Microsoft ileti gönderemedi."
    );
  }
}

async function sendImap(
  connection: any,
  to: string[],
  cc: string[],
  bcc: string[],
  subject: string,
  body: string
) {
  if (
    !connection.email ||
    !connection
      .secret_encrypted
  ) {
    throw new Error(
      "Kurumsal mail bağlantısı eksik."
    );
  }

  const settings =
    connection.settings ||
    {};

  const host =
    await assertPublicMailHostname(
      String(
        settings.smtpHost ||
        ""
      )
    );

  const port =
    Number(
      settings.smtpPort ||
      465
    );

  const secure =
    Boolean(
      settings.smtpSecure
    );

  const requireTLS =
    Boolean(
      settings.smtpStarttls
    );

  const password =
    decryptMailSecret(
      connection
        .secret_encrypted
    );

  const messageId =
    `<${randomUUID()}@${connection.email.split(
      "@"
    )[1] || "mether.local"}>`;

  const options = {
    from:
      connection.email,

    to:
      to.join(", "),

    cc:
      cc.length
        ? cc.join(", ")
        : undefined,

    bcc:
      bcc.length
        ? bcc.join(", ")
        : undefined,

    subject,
    text: body,
    messageId,
  };

  const transport =
    nodemailer
      .createTransport({
        host,
        port,
        secure,
        requireTLS,

        auth: {
          user:
            connection.email,

          pass:
            password,
        },

        connectionTimeout:
          10_000,

        greetingTimeout:
          10_000,

        socketTimeout:
          15_000,
      });

  await transport
    .sendMail(
      options
    );

  transport.close();

  try {
    const builder =
      nodemailer
        .createTransport({
          streamTransport:
            true,

          buffer: true,

          newline:
            "unix",
        });

    const rendered =
      await builder
        .sendMail(
          options
        );

    const raw =
      await mailMessageToBuffer(
        rendered.message
      );

    const imap =
      await createImapClient(
        connection
      );

    try {
      const sentPath =
        await resolveImapMailbox(
          imap,
          "sent"
        );

      await imap.append(
        sentPath,
        raw,
        [
          "\\Seen",
        ],
        new Date()
      );
    } finally {
      try {
        await imap.logout();
      } catch {
        try {
          imap.close();
        } catch {}
      }
    }
  } catch {
    // SMTP gönderimi başarılıysa Sent append hatası
    // gönderimi başarısız saydırmaz.
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const connectionId =
      String(
        body
          ?.connectionId ||
        ""
      ).trim();

    if (!connectionId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Gönderen posta hesabı seçilmedi.",
        },
        {
          status: 400,
        }
      );
    }

    const to =
      parseRecipients(
        body?.to
      );

    const cc =
      parseRecipients(
        body?.cc
      );

    const bcc =
      parseRecipients(
        body?.bcc
      );

    const subject =
      cleanHeader(
        body?.subject
      );

    const text =
      String(
        body?.body ||
        ""
      ).trim();

    if (
      to.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "En az bir alıcı gerekli.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !subject &&
      !text
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Boş ileti gönderilemez.",
        },
        {
          status: 400,
        }
      );
    }

    const {
      connection,
      supabase,
    } =
      await getOwnedMailConnection(
        connectionId
      );

    if (
      connection.provider ===
      "google"
    ) {
      await sendGoogle(
        connection,
        supabase,
        to,
        cc,
        bcc,
        subject,
        text
      );
    } else if (
      connection.provider ===
      "microsoft"
    ) {
      await sendMicrosoft(
        connection,
        supabase,
        to,
        cc,
        bcc,
        subject,
        text
      );
    } else if (
      connection.provider ===
      "imap"
    ) {
      await sendImap(
        connection,
        to,
        cc,
        bcc,
        subject,
        text
      );
    } else {
      throw new Error(
        "Bu posta hesabından gönderim desteklenmiyor."
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof
          Error
            ? error.message
            : "İleti gönderilemedi.",
      },
      {
        status: 500,
      }
    );
  }
}