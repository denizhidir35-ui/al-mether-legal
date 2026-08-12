import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createGoogleMailClient,
  createImapClient,
  getMicrosoftAccessToken,
  getOwnedMailConnection,
} from "@/lib/mail/runtime";

import {
  googleLabelForFolder,
  microsoftFolderForFolder,
  parseMailFolder,
  resolveImapMailbox,
  type MailFolder,
} from "@/lib/mail/folders";

import {
  GMAIL_LEGAL_QUERY,
  isLegalMail,
} from "@/lib/mail/legalMailFilter";

export const runtime =
  "nodejs";

type MailSummary = {
  id: string;
  threadId?: string;
  subject: string;
  sender: string;
  date: string;
  snippet: string;
  unread: boolean;
  hasAttachments: boolean;
};

function headerValue(
  headers:
    | Array<{
        name?: string | null;
        value?: string | null;
      }>
    | null
    | undefined,
  name: string
) {
  return (
    headers?.find(
      (header) =>
        header.name
          ?.toLowerCase() ===
        name.toLowerCase()
    )?.value || ""
  );
}

async function mapConcurrent<
  T,
  R
>(
  values: T[],
  limit: number,
  worker:
    (value: T) =>
      Promise<R>
) {
  const output: R[] = [];

  for (
    let index = 0;
    index < values.length;
    index += limit
  ) {
    const batch =
      values.slice(
        index,
        index + limit
      );

    output.push(
      ...(
        await Promise.all(
          batch.map(worker)
        )
      )
    );
  }

  return output;
}

function formatAddress(
  value: any
) {
  const name =
    String(
      value?.name || ""
    ).trim();

  const address =
    String(
      value?.address || ""
    ).trim();

  if (
    name &&
    address
  ) {
    return `${name} <${address}>`;
  }

  return (
    address ||
    name ||
    ""
  );
}

function formatAddresses(
  values: any
) {
  if (
    !Array.isArray(values)
  ) {
    return "";
  }

  return values
    .map(formatAddress)
    .filter(Boolean)
    .join(", ");
}

function hasImapAttachment(
  node: any
): boolean {
  if (!node) {
    return false;
  }

  const disposition =
    String(
      node.disposition || ""
    ).toLowerCase();

  const filename =
    String(
      node
        .dispositionParameters
        ?.filename ||
      node.parameters?.name ||
      ""
    ).trim();

  if (
    disposition ===
      "attachment" ||
    filename
  ) {
    return true;
  }

  const children =
    Array.isArray(
      node.childNodes
    )
      ? node.childNodes
      : [];

  return children.some(
    hasImapAttachment
  );
}

async function listGoogle(
  connection: any,
  supabase: any,
  folder: MailFolder
): Promise<MailSummary[]> {
  const gmail =
    createGoogleMailClient(
      connection,
      supabase
    );

  const list =
    await gmail.users
      .messages.list({
        userId: "me",
        maxResults: 25,
        q:
          folder === "inbox"
            ? GMAIL_LEGAL_QUERY
            : undefined,
        labelIds: [
          googleLabelForFolder(
            folder
          ),
        ],
      });

  const refs =
    list.data.messages ||
    [];

  const candidates =
    await mapConcurrent(
      refs,
      8,
      async (ref) => {
        const detail =
          await gmail.users
            .messages.get({
            userId: "me",
            id: ref.id!,
            format:
              "metadata",

            metadataHeaders: [
              "Subject",
              "From",
              "To",
              "Date",
            ],
          });

      const headers =
        detail.data.payload
          ?.headers || [];

      const labels =
        detail.data.labelIds ||
        [];

      const from =
        headerValue(
          headers,
          "from"
        );

      const to =
        headerValue(
          headers,
          "to"
        );

        return {
        id:
          String(
            detail.data.id ||
            ref.id ||
            ""
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
          folder === "sent" ||
          folder === "drafts"
            ? to || from
            : from,

        date:
          headerValue(
            headers,
            "date"
          ),

        snippet:
          String(
            detail.data
              .snippet ||
            ""
          ),

        unread:
          labels.includes(
            "UNREAD"
          ),

        hasAttachments:
          false,
        };
      }
    );

  return folder === "inbox"
    ? candidates.filter(
        (message) =>
          isLegalMail(message)
      )
    : candidates;
}

async function listMicrosoft(
  connection: any,
  supabase: any,
  folder: MailFolder
): Promise<MailSummary[]> {
  const token =
    await getMicrosoftAccessToken(
      connection,
      supabase
    );

  const graphFolder =
    microsoftFolderForFolder(
      folder
    );

  const url =
    new URL(
      `https://graph.microsoft.com/v1.0/me/mailFolders/${graphFolder}/messages`
    );

  url.searchParams.set(
    "$top",
    "25"
  );

  url.searchParams.set(
    "$orderby",
    "receivedDateTime desc"
  );

  url.searchParams.set(
    "$select",
    [
      "id",
      "subject",
      "from",
      "toRecipients",
      "receivedDateTime",
      "sentDateTime",
      "bodyPreview",
      "isRead",
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
      "Microsoft posta klasörü alınamadı."
    );
  }

  return (
    Array.isArray(
      data?.value
    )
      ? data.value
      : []
  ).map(
    (item: any) => {
      const from =
        item?.from
          ?.emailAddress ||
        {};

      const fromText =
        from.name &&
        from.address
          ? `${from.name} <${from.address}>`
          : from.address ||
            from.name ||
            "";

      const toText =
        (
          Array.isArray(
            item?.toRecipients
          )
            ? item.toRecipients
            : []
        )
          .map(
            (recipient: any) => {
              const address =
                recipient
                  ?.emailAddress ||
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

      return {
        id:
          String(
            item.id || ""
          ),

        threadId:
          String(
            item
              .conversationId ||
            ""
          ),

        subject:
          String(
            item.subject ||
            "(Konu yok)"
          ),

        sender:
          folder === "sent" ||
          folder === "drafts"
            ? toText ||
              fromText
            : fromText,

        date:
          String(
            item
              .sentDateTime ||
            item
              .receivedDateTime ||
            ""
          ),

        snippet:
          String(
            item
              .bodyPreview ||
            ""
          ),

        unread:
          item.isRead ===
          false,

        hasAttachments:
          Boolean(
            item
              .hasAttachments
          ),
      };
    }
  );
}

async function listImap(
  connection: any,
  folder: MailFolder
): Promise<MailSummary[]> {
  const client =
    await createImapClient(
      connection
    );

  let lock: any = null;

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

    const mailbox: any =
      client.mailbox;

    const exists =
      Number(
        mailbox?.exists ||
        0
      );

    if (
      !Number.isFinite(
        exists
      ) ||
      exists <= 0
    ) {
      return [];
    }

    const start =
      Math.max(
        1,
        exists - 24
      );

    const rows:
      MailSummary[] =
      [];

    for await (
      const message
      of client.fetch(
        `${start}:*`,
        {
          uid: true,
          envelope: true,
          flags: true,
          internalDate:
            true,
          bodyStructure:
            true,
        }
      )
    ) {
      const current: any =
        message;

      const from =
        formatAddresses(
          current.envelope
            ?.from
        );

      const to =
        formatAddresses(
          current.envelope
            ?.to
        );

      const flags:
        Set<string> =
        current.flags ||
        new Set();

      rows.push({
        id:
          String(
            current.uid
          ),

        threadId: "",

        subject:
          String(
            current.envelope
              ?.subject ||
            "(Konu yok)"
          ),

        sender:
          folder === "sent" ||
          folder === "drafts"
            ? to || from
            : from,

        date:
          current
            .internalDate
            ? new Date(
                current
                  .internalDate
              ).toISOString()
            : "",

        snippet: "",

        unread:
          !flags.has(
            "\\Seen"
          ),

        hasAttachments:
          hasImapAttachment(
            current
              .bodyStructure
          ),
      });
    }

    rows.sort(
      (
        left,
        right
      ) =>
        new Date(
          right.date || 0
        ).getTime() -
        new Date(
          left.date || 0
        ).getTime()
    );

    return rows.slice(
      0,
      25
    );
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

    const folder =
      parseMailFolder(
        request.nextUrl
          .searchParams
          .get("folder")
      );

    if (!connectionId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Mail hesabı seçilmedi.",
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

    let messages:
      MailSummary[] = [];

    if (
      connection.provider ===
      "google"
    ) {
      messages =
        await listGoogle(
          connection,
          supabase,
          folder
        );
    } else if (
      connection.provider ===
      "microsoft"
    ) {
      messages =
        await listMicrosoft(
          connection,
          supabase,
          folder
        );
    } else if (
      connection.provider ===
      "imap"
    ) {
      messages =
        await listImap(
          connection,
          folder
        );
    } else {
      throw new Error(
        "Bu mail sağlayıcısı desteklenmiyor."
      );
    }

    return NextResponse.json({
      ok: true,
      folder,

      connection: {
        id:
          connection.id,

        provider:
          connection.provider,

        email:
          connection.email,
      },

      messages,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof
          Error
            ? error.message
            : "Posta klasörü alınamadı.",
      },
      {
        status: 500,
      }
    );
  }
}
