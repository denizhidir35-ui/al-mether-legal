import {
  randomUUID,
} from "node:crypto";

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

import {
  attachmentLimitError,
  MAIL_ATTACHMENT_LIMIT_MESSAGE,
} from "@/lib/mail/attachments";

import {
  buildMimeMessage,
  nodemailerOptions,
  type OutgoingAttachment,
  type OutgoingMessage,
} from "@/lib/mail/outgoingMessage";

export const runtime =
  "nodejs";

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

class AttachmentLimitError
  extends Error {
  constructor() {
    super(
      MAIL_ATTACHMENT_LIMIT_MESSAGE
    );
  }
}

type ParsedSendRequest = {
  connectionId: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachments: OutgoingAttachment[];
};

async function parseSendRequest(
  request: NextRequest
): Promise<ParsedSendRequest> {
  const contentType =
    request.headers.get(
      "content-type"
    ) || "";

  if (
    !contentType
      .toLowerCase()
      .startsWith(
        "multipart/form-data"
      )
  ) {
    const body =
      await request.json();

    return {
      connectionId:
        String(
          body?.connectionId ||
          ""
        ),
      to:
        String(body?.to || ""),
      cc:
        String(body?.cc || ""),
      bcc:
        String(body?.bcc || ""),
      subject:
        String(
          body?.subject || ""
        ),
      body:
        String(body?.body || ""),
      attachments: [],
    };
  }

  const form =
    await request.formData();

  const files =
    form
      .getAll("attachments")
      .filter(
        (value): value is File =>
          value instanceof File
      );

  if (
    attachmentLimitError(
      files
    )
  ) {
    throw new AttachmentLimitError();
  }

  const attachments:
    OutgoingAttachment[] = [];

  for (const file of files) {
    attachments.push({
      filename:
        cleanHeader(
          file.name
        ) || "dosya",
      contentType:
        file.type ||
        "application/octet-stream",
      size: file.size,
      content:
        Buffer.from(
          await file.arrayBuffer()
        ),
    });
  }

  const field =
    (name: string) => {
      const value =
        form.get(name);

      return typeof value ===
        "string"
        ? value
        : "";
    };

  return {
    connectionId:
      field("connectionId"),
    to: field("to"),
    cc: field("cc"),
    bcc: field("bcc"),
    subject:
      field("subject"),
    body: field("body"),
    attachments,
  };
}

function outgoingMessage(
  from: string,
  to: string[],
  cc: string[],
  bcc: string[],
  subject: string,
  body: string,
  attachments:
    OutgoingAttachment[],
  messageId?: string
): OutgoingMessage {
  return {
    from,
    to,
    cc,
    bcc,
    subject,
    text: body,
    messageId,
    attachments,
  };
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
  body: string,
  attachments:
    OutgoingAttachment[]
) {
  const gmail =
    createGoogleMailClient(
      connection,
      supabase
    );

  const raw =
    (
      await buildMimeMessage(
        outgoingMessage(
          connection.email ||
            "",
          to,
          cc,
          bcc,
          subject,
          body,
          attachments
        )
      )
    ).toString(
      "base64url"
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
  body: string,
  attachments:
    OutgoingAttachment[]
) {
  const token =
    await getMicrosoftAccessToken(
      connection,
      supabase
    );

  const headers = {
    Authorization:
      `Bearer ${token}`,
    "Content-Type":
      "application/json",
  };

  const message = {
    subject,
    body: {
      contentType: "Text",
      content: body,
    },
    toRecipients:
      graphRecipients(to),
    ccRecipients:
      graphRecipients(cc),
    bccRecipients:
      graphRecipients(bcc),
  };

  if (
    attachments.length === 0
  ) {
    const response =
      await fetch(
        "https://graph.microsoft.com/v1.0/me/sendMail",
        {
          method: "POST",
          headers,
          body:
            JSON.stringify({
              message,
              saveToSentItems:
                true,
            }),
          cache: "no-store",
        }
      );

    if (!response.ok) {
      const data =
        await response.json()
          .catch(() => null);

      throw new Error(
        data?.error
          ?.message ||
        "Microsoft ileti gönderemedi."
      );
    }

    return;
  }

  const draftResponse =
    await fetch(
      "https://graph.microsoft.com/v1.0/me/messages",
      {
        method: "POST",
        headers,
        body:
          JSON.stringify(message),
        cache: "no-store",
      }
    );

  const draft =
    await draftResponse.json()
      .catch(() => null);

  if (
    !draftResponse.ok ||
    !draft?.id
  ) {
    throw new Error(
      draft?.error?.message ||
      "Microsoft ileti taslağı oluşturamadı."
    );
  }

  const draftId =
    encodeURIComponent(
      String(draft.id)
    );

  for (
    const attachment
    of attachments
  ) {
    if (
      attachment.size <
      3 * 1024 * 1024
    ) {
      const response =
        await fetch(
          `https://graph.microsoft.com/v1.0/me/messages/${draftId}/attachments`,
          {
            method: "POST",
            headers,
            body:
              JSON.stringify({
                "@odata.type":
                  "#microsoft.graph.fileAttachment",
                name:
                  attachment.filename,
                contentType:
                  attachment.contentType,
                contentBytes:
                  attachment.content
                    .toString(
                      "base64"
                    ),
              }),
            cache: "no-store",
          }
        );

      if (!response.ok) {
        const data =
          await response.json()
            .catch(() => null);

        throw new Error(
          data?.error?.message ||
          "Microsoft eki yükleyemedi."
        );
      }

      continue;
    }

    const sessionResponse =
      await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${draftId}/attachments/createUploadSession`,
        {
          method: "POST",
          headers,
          body:
            JSON.stringify({
              AttachmentItem: {
                attachmentType:
                  "file",
                name:
                  attachment.filename,
                size:
                  attachment.size,
              },
            }),
          cache: "no-store",
        }
      );

    const session =
      await sessionResponse.json()
        .catch(() => null);

    if (
      !sessionResponse.ok ||
      !session?.uploadUrl
    ) {
      throw new Error(
        session?.error?.message ||
        "Microsoft büyük ek yüklemesini başlatamadı."
      );
    }

    const chunkSize =
      10 * 320 * 1024;

    for (
      let start = 0;
      start < attachment.size;
      start += chunkSize
    ) {
      const end =
        Math.min(
          start + chunkSize,
          attachment.size
        );

      const chunk =
        attachment.content
          .subarray(
            start,
            end
          );

      const uploadBody =
        new ArrayBuffer(
          chunk.length
        );

      new Uint8Array(
        uploadBody
      ).set(chunk);

      const uploadResponse =
        await fetch(
          session.uploadUrl,
          {
            method: "PUT",
            headers: {
              "Content-Length":
                String(
                  chunk.length
                ),
              "Content-Range":
                `bytes ${start}-${end - 1}/${attachment.size}`,
            },
            body: uploadBody,
            cache: "no-store",
          }
        );

      if (!uploadResponse.ok) {
        const data =
          await uploadResponse
            .json()
            .catch(() => null);

        throw new Error(
          data?.error?.message ||
          "Microsoft büyük eki yükleyemedi."
        );
      }
    }
  }

  const sendResponse =
    await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${draftId}/send`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

  if (!sendResponse.ok) {
    const data =
      await sendResponse.json()
        .catch(() => null);

    throw new Error(
      data?.error?.message ||
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
  body: string,
  attachments:
    OutgoingAttachment[]
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

  const message =
    outgoingMessage(
      connection.email,
      to,
      cc,
      bcc,
      subject,
      body,
      attachments,
      messageId
    );

  const options =
    nodemailerOptions(
      message
    );

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
    const raw =
      await buildMimeMessage(
        message
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
      await parseSendRequest(
        request
      );

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
      !text &&
      body.attachments
        .length === 0
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
        text,
        body.attachments
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
        text,
        body.attachments
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
        text,
        body.attachments
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
        status:
          error instanceof
            AttachmentLimitError
            ? 413
            : 500,
      }
    );
  }
}
