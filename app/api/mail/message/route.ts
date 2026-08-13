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
  htmlToText,
} from "@/lib/mail/runtime";

import {
  parseMailFolder,
  resolveImapMailbox,
} from "@/lib/mail/folders";

import {
  toMailAccountDTO,
} from "@/lib/mail/accountModel";

export const runtime =
  "nodejs";

type Attachment = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
};

function decodeBase64Url(
  data: string
) {
  return Buffer.from(
    data
      .replace(/-/g, "+")
      .replace(/_/g, "/"),
    "base64"
  ).toString(
    "utf-8"
  );
}

function headerValue(
  headers: any[],
  name: string
) {
  return (
    headers.find(
      (header) =>
        String(
          header?.name ||
          ""
        ).toLowerCase() ===
        name.toLowerCase()
    )?.value || ""
  );
}

function googleBody(
  payload: any
): string {
  if (!payload) {
    return "";
  }

  if (
    payload.body?.data
  ) {
    const decoded =
      decodeBase64Url(
        payload.body.data
      );

    return payload
      .mimeType ===
      "text/html"
      ? htmlToText(
          decoded
        )
      : decoded;
  }

  const parts =
    Array.isArray(
      payload.parts
    )
      ? payload.parts
      : [];

  const plain =
    parts.find(
      (part: any) =>
        part.mimeType ===
        "text/plain"
    );

  if (plain) {
    const value =
      googleBody(
        plain
      );

    if (value) {
      return value;
    }
  }

  const html =
    parts.find(
      (part: any) =>
        part.mimeType ===
        "text/html"
    );

  if (html) {
    const value =
      googleBody(
        html
      );

    if (value) {
      return value;
    }
  }

  for (
    const part
    of parts
  ) {
    const value =
      googleBody(part);

    if (value) {
      return value;
    }
  }

  return "";
}

function googleAttachments(
  payload: any
) {
  const output:
    Attachment[] = [];

  function walk(
    part: any
  ) {
    if (!part) {
      return;
    }

    const filename =
      String(
        part.filename ||
        ""
      ).trim();

    const attachmentId =
      String(
        part.body
          ?.attachmentId ||
        ""
      ).trim();

    if (
      filename &&
      attachmentId
    ) {
      output.push({
        filename,

        mimeType:
          String(
            part.mimeType ||
            "application/octet-stream"
          ),

        size:
          Number(
            part.body
              ?.size ||
            0
          ),

        attachmentId,
      });
    }

    if (
      Array.isArray(
        part.parts
      )
    ) {
      for (
        const child
        of part.parts
      ) {
        walk(child);
      }
    }
  }

  walk(payload);

  return output;
}

async function getGoogle(
  connection: any,
  supabase: any,
  id: string
) {
  const gmail =
    createGoogleMailClient(
      connection,
      supabase
    );

  const detail =
    await gmail.users
      .messages.get({
        userId: "me",
        id,
        format: "full",
      });

  const headers =
    detail.data.payload
      ?.headers || [];

  return {
    id:
      String(
        detail.data.id ||
        id
      ),

    threadId:
      String(
        detail.data
          .threadId ||
        ""
      ),

    subject:
      headerValue(
        headers,
        "subject"
      ) ||
      "(Konu yok)",

    sender:
      headerValue(
        headers,
        "from"
      ),

    to:
      headerValue(
        headers,
        "to"
      ),

    cc:
      headerValue(
        headers,
        "cc"
      ),

    date:
      headerValue(
        headers,
        "date"
      ),

    body:
      googleBody(
        detail.data
          .payload
      ) ||
      detail.data
        .snippet ||
      "",

    attachments:
      googleAttachments(
        detail.data
          .payload
      ),
  };
}

function graphRecipients(
  values: any[]
) {
  return (
    Array.isArray(values)
      ? values
      : []
  )
    .map(
      (item: any) => {
        const address =
          item?.emailAddress ||
          {};

        return (
          address.name &&
          address.address
            ? `${address.name} <${address.address}>`
            : address.address ||
              address.name ||
              ""
        );
      }
    )
    .filter(Boolean)
    .join(", ");
}

async function getMicrosoft(
  connection: any,
  supabase: any,
  id: string
) {
  const token =
    await getMicrosoftAccessToken(
      connection,
      supabase
    );

  const url =
    new URL(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(
        id
      )}`
    );

  url.searchParams.set(
    "$select",
    [
      "id",
      "subject",
      "from",
      "toRecipients",
      "ccRecipients",
      "receivedDateTime",
      "sentDateTime",
      "body",
      "hasAttachments",
      "conversationId",
    ].join(",")
  );

  const response =
    await fetch(
      url,
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },

        cache:
          "no-store",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error
        ?.message ||
      "Microsoft ileti açılamadı."
    );
  }

  let attachments:
    Attachment[] = [];

  if (
    data
      ?.hasAttachments
  ) {
    const attachmentsUrl =
      new URL(
        `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(
          id
        )}/attachments`
      );

    attachmentsUrl
      .searchParams
      .set(
        "$select",
        "id,name,contentType,size,isInline"
      );

    const attachmentResponse =
      await fetch(
        attachmentsUrl,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },

          cache:
            "no-store",
        }
      );

    if (
      attachmentResponse.ok
    ) {
      const attachmentData =
        await attachmentResponse
          .json();

      attachments =
        (
          Array.isArray(
            attachmentData
              ?.value
          )
            ? attachmentData
                .value
            : []
        )
          .filter(
            (item: any) =>
              !item
                ?.isInline
          )
          .map(
            (item: any) => ({
              filename:
                String(
                  item.name ||
                  "Dosya"
                ),

              mimeType:
                String(
                  item
                    .contentType ||
                  "application/octet-stream"
                ),

              size:
                Number(
                  item.size ||
                  0
                ),

              attachmentId:
                String(
                  item.id ||
                  ""
                ),
            })
          );
    }
  }

  const from =
    data?.from
      ?.emailAddress ||
    {};

  const rawBody =
    String(
      data?.body
        ?.content ||
      ""
    );

  return {
    id:
      String(
        data.id ||
        id
      ),

    threadId:
      String(
        data
          .conversationId ||
        ""
      ),

    subject:
      String(
        data.subject ||
        "(Konu yok)"
      ),

    sender:
      from.name &&
      from.address
        ? `${from.name} <${from.address}>`
        : from.address ||
          from.name ||
          "",

    to:
      graphRecipients(
        data
          .toRecipients
      ),

    cc:
      graphRecipients(
        data
          .ccRecipients
      ),

    date:
      String(
        data
          .sentDateTime ||
        data
          .receivedDateTime ||
        ""
      ),

    body:
      String(
        data?.body
          ?.contentType ||
        ""
      ).toLowerCase() ===
      "html"
        ? htmlToText(
            rawBody
          )
        : rawBody,

    attachments,
  };
}

function addressText(
  value: any
) {
  if (
    Array.isArray(value)
  ) {
    return value
      .map(
        (item) =>
          item?.text ||
          ""
      )
      .filter(Boolean)
      .join(", ");
  }

  return (
    value?.text ||
    ""
  );
}

async function getImap(
  connection: any,
  id: string,
  folder: ReturnType<
    typeof parseMailFolder
  >
) {
  const uid =
    Number(id);

  if (
    !Number.isFinite(uid) ||
    uid <= 0
  ) {
    throw new Error(
      "Mail kimliği geçersiz."
    );
  }

  const client =
    await createImapClient(
      connection
    );

  let lock: any =
    null;

  try {
    const mailboxPath =
      await resolveImapMailbox(
        client,
        folder
      );

    lock =
      await client
        .getMailboxLock(
          mailboxPath
        );

    const item: any =
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

    if (
      !item ||
      !item.source
    ) {
      throw new Error(
        "İleti bulunamadı."
      );
    }

    const parsed =
      await simpleParser(
        item.source
      );

    const body =
      parsed.text ||
      (
        parsed.html
          ? htmlToText(
              String(
                parsed.html
              )
            )
          : ""
      );

    return {
      id:
        String(uid),

      threadId: "",

      subject:
        parsed.subject ||
        "(Konu yok)",

      sender:
        parsed.from
          ?.text ||
        "",

      to:
        addressText(
          parsed.to
        ),

      cc:
        addressText(
          parsed.cc
        ),

      date:
        parsed.date
          ? parsed.date
              .toISOString()
          : "",

      body,

      attachments:
        parsed.attachments
          .map(
            (
              attachment,
              index
            ) => ({
              filename:
                attachment
                  .filename ||
                `Dosya-${index + 1}`,

              mimeType:
                attachment
                  .contentType ||
                "application/octet-stream",

              size:
                Number(
                  attachment
                    .size ||
                  attachment
                    .content
                    ?.length ||
                  0
                ),

              attachmentId:
                String(index),
            })
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
    const connectionId =
      request.nextUrl
        .searchParams
        .get(
          "connectionId"
        )
        ?.trim() ||
      "";

    const id =
      request.nextUrl
        .searchParams
        .get("id")
        ?.trim() ||
      "";

    const folder =
      parseMailFolder(
        request.nextUrl
          .searchParams
          .get("folder")
      );

    if (
      !connectionId ||
      !id
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Mail hesabı veya ileti seçilmedi.",
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

    let message:
      any;

    if (
      connection.provider ===
      "google"
    ) {
      message =
        await getGoogle(
          connection,
          supabase,
          id
        );
    } else if (
      connection.provider ===
      "microsoft"
    ) {
      message =
        await getMicrosoft(
          connection,
          supabase,
          id
        );
    } else if (
      connection.provider ===
      "imap"
    ) {
      message =
        await getImap(
          connection,
          id,
          folder
        );
    } else {
      throw new Error(
        "Mail sağlayıcısı desteklenmiyor."
      );
    }

    const sourceAccount =
      toMailAccountDTO(
        connection
      );

    return NextResponse.json({
      ok: true,
      message: {
        ...message,
        sourceAccount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof
          Error
            ? error.message
            : "İleti açılamadı.",
      },
      {
        status: 500,
      }
    );
  }
}
