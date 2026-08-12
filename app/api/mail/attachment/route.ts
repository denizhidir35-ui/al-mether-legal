import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  simpleParser,
} from "mailparser";

import {
  createGoogleMailClient,
  createImapClient,
  getMicrosoftAccessToken,
  getOwnedMailConnection,
} from "@/lib/mail/runtime";

import {
  parseMailFolder,
  resolveImapMailbox,
} from "@/lib/mail/folders";

export const runtime = "nodejs";

function cleanFilename(
  value: unknown
) {
  return String(
    value || "dosya"
  )
    .replace(
      /[\r\n"\\/:*?<>|]+/g,
      "-"
    )
    .trim()
    .slice(0, 180) ||
    "dosya";
}

function safeMime(
  value: unknown
) {
  const mime =
    String(
      value ||
      "application/octet-stream"
    )
      .trim()
      .toLowerCase();

  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i
    .test(mime)
      ? mime
      : "application/octet-stream";
}

function mimeFromFilename(
  filename: string,
  preferred?: unknown
) {
  const supplied =
    safeMime(preferred);

  if (
    supplied !==
    "application/octet-stream"
  ) {
    return supplied;
  }

  const name =
    filename
      .toLowerCase();

  if (name.endsWith(".png")) {
    return "image/png";
  }

  if (
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg")
  ) {
    return "image/jpeg";
  }

  if (name.endsWith(".gif")) {
    return "image/gif";
  }

  if (name.endsWith(".webp")) {
    return "image/webp";
  }

  if (name.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (name.endsWith(".txt")) {
    return "text/plain";
  }

  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  if (name.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }

  return "application/octet-stream";
}
function contentDisposition(
  filename: string,
  open: boolean
) {
  return `${
    open
      ? "inline"
      : "attachment"
  }; filename*=UTF-8''${encodeURIComponent(
    filename
  )}`;
}

function findGoogleAttachmentMeta(
  payload: any,
  attachmentId: string
): {
  filename: string;
  mimeType: string;
} | null {
  if (!payload) {
    return null;
  }

  const currentId =
    String(
      payload?.body
        ?.attachmentId ||
      ""
    );

  if (
    currentId &&
    currentId ===
      attachmentId
  ) {
    return {
      filename:
        String(
          payload.filename ||
          "dosya"
        ),

      mimeType:
        String(
          payload.mimeType ||
          "application/octet-stream"
        ),
    };
  }

  if (
    Array.isArray(
      payload.parts
    )
  ) {
    for (
      const part
      of payload.parts
    ) {
      const found =
        findGoogleAttachmentMeta(
          part,
          attachmentId
        );

      if (found) {
        return found;
      }
    }
  }

  return null;
}

async function getGoogleAttachment(
  connection: any,
  supabase: any,
  messageId: string,
  attachmentId: string,
  fallbackFilename: string,
  fallbackMime: string
) {
  const gmail =
    createGoogleMailClient(
      connection,
      supabase
    );

  /*
   * ÖNEMLİ:
   * attachmentId zaten message detail'den Gmail tarafından
   * verilmiştir. Önce attachment'ın kendisini alıyoruz.
   * Metadata bulunamadı diye gerçek dosyayı reddetmiyoruz.
   */
  const attachment =
    await gmail.users
      .messages
      .attachments
      .get({
        userId: "me",
        messageId,
        id: attachmentId,
      });

  const encoded =
    attachment.data.data ||
    "";

  if (!encoded) {
    throw new Error(
      "Gmail ek verisi boş."
    );
  }

  let meta:
    {
      filename: string;
      mimeType: string;
    } | null = null;

  try {
    const message =
      await gmail.users
        .messages.get({
          userId: "me",
          id: messageId,
          format: "full",
        });

    meta =
      findGoogleAttachmentMeta(
        message.data.payload,
        attachmentId
      );
  } catch {
    /*
     * Dosyanın kendisi geldi.
     * Metadata başarısızlığı indirimi engellemez.
     */
  }

  return {
    filename:
      meta?.filename ||
      fallbackFilename ||
      "dosya",

    mimeType:
      meta?.mimeType ||
      fallbackMime ||
      "application/octet-stream",

    buffer:
      Buffer.from(
        encoded
          .replace(/-/g, "+")
          .replace(/_/g, "/"),
        "base64"
      ),
  };
}

async function getMicrosoftAttachment(
  connection: any,
  supabase: any,
  messageId: string,
  attachmentId: string,
  fallbackFilename: string,
  fallbackMime: string
) {
  const token =
    await getMicrosoftAccessToken(
      connection,
      supabase
    );

  const response =
    await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(
        messageId
      )}/attachments/${encodeURIComponent(
        attachmentId
      )}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      "Microsoft mail eki alınamadı."
    );
  }

  if (!data?.contentBytes) {
    throw new Error(
      "Microsoft eki doğrudan indirilebilir dosya değil."
    );
  }

  return {
    filename:
      data.name ||
      fallbackFilename ||
      "dosya",

    mimeType:
      data.contentType ||
      fallbackMime ||
      "application/octet-stream",

    buffer:
      Buffer.from(
        data.contentBytes,
        "base64"
      ),
  };
}

async function getImapAttachment(
  connection: any,
  folder:
    ReturnType<
      typeof parseMailFolder
    >,
  messageId: string,
  attachmentId: string,
  fallbackFilename: string,
  fallbackMime: string
) {
  const uid =
    Number(
      messageId
    );

  const index =
    Number(
      attachmentId
    );

  if (
    !Number.isFinite(uid) ||
    !Number.isFinite(index) ||
    uid <= 0 ||
    index < 0
  ) {
    throw new Error(
      "Mail eki kimliği geçersiz."
    );
  }

  const client =
    await createImapClient(
      connection
    );

  let lock:
    any = null;

  try {
    const mailbox =
      await resolveImapMailbox(
        client,
        folder
      );

    lock =
      await client
        .getMailboxLock(
          mailbox
        );

    const message:
      any =
      await client.fetchOne(
        uid,
        {
          source: true,
          uid: true,
        },
        {
          uid: true,
        }
      );

    if (!message?.source) {
      throw new Error(
        "Mail bulunamadı."
      );
    }

    const parsed =
      await simpleParser(
        message.source
      );

    const file =
      parsed.attachments[
        index
      ];

    if (!file) {
      throw new Error(
        "Mail eki bulunamadı."
      );
    }

    return {
      filename:
        file.filename ||
        fallbackFilename ||
        `dosya-${index + 1}`,

      mimeType:
        file.contentType ||
        fallbackMime ||
        "application/octet-stream",

      buffer:
        Buffer.from(
          file.content
        ),
    };
  } finally {
    try {
      lock?.release();
    } catch {}

    try {
      await client.logout();
    } catch {
      try {
        client.close();
      } catch {}
    }
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    const params =
      request.nextUrl
        .searchParams;

    const connectionId =
      params
        .get(
          "connectionId"
        )
        ?.trim() ||
      "";

    const messageId =
      params
        .get(
          "messageId"
        )
        ?.trim() ||
      "";

    const attachmentId =
      params
        .get(
          "attachmentId"
        )
        ?.trim() ||
      "";

    const folder =
      parseMailFolder(
        params.get(
          "folder"
        )
      );

    const open =
      params.get(
        "mode"
      ) === "open";

    const fallbackFilename =
      cleanFilename(
        params.get(
          "filename"
        ) ||
        "dosya"
      );

    const fallbackMime =
      mimeFromFilename(
        fallbackFilename,
        params.get(
          "mimeType"
        )
      );

    if (
      !connectionId ||
      !messageId ||
      !attachmentId
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Mail eki bilgileri eksik.",
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

    let result:
      {
        filename: string;
        mimeType: string;
        buffer: Buffer;
      };

    if (
      connection.provider ===
      "google"
    ) {
      result =
        await getGoogleAttachment(
          connection,
          supabase,
          messageId,
          attachmentId,
          fallbackFilename,
          fallbackMime
        );
    } else if (
      connection.provider ===
      "microsoft"
    ) {
      result =
        await getMicrosoftAttachment(
          connection,
          supabase,
          messageId,
          attachmentId,
          fallbackFilename,
          fallbackMime
        );
    } else if (
      connection.provider ===
      "imap"
    ) {
      result =
        await getImapAttachment(
          connection,
          folder,
          messageId,
          attachmentId,
          fallbackFilename,
          fallbackMime
        );
    } else {
      throw new Error(
        "Bu posta sağlayıcısında ek desteklenmiyor."
      );
    }

    const filename =
      cleanFilename(
        result.filename
      );

    const mimeType =
      mimeFromFilename(
        filename,
        result.mimeType ||
        fallbackMime
      );

    return new Response(
      new Uint8Array(
        result.buffer
      ),
      {
        status: 200,

        headers: {
          "Content-Type":
            mimeType,

          "Content-Disposition":
            contentDisposition(
              filename,
              open
            ),

          "Content-Length":
            String(
              result.buffer.length
            ),

          "Cache-Control":
            "private, no-store",
        },
      }
    );
  } catch (error: any) {
    const message =
      error instanceof Error
        ? error.message
        : "Mail eki açılamadı.";

    console.error(
      "METHER ATTACHMENT:",
      message
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          message,
      },
      {
        status: 500,
      }
    );
  }
}