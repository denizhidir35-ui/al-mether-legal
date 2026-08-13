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
  resolveImapMailbox,
} from "@/lib/mail/folders";

export const runtime = "nodejs";

async function emptyGoogleTrash(
  connection: any,
  supabase: any
) {
  const gmail =
    createGoogleMailClient(
      connection,
      supabase
    );

  const messageIds: string[] = [];
  let pageToken:
    | string
    | undefined;

  do {
    const page =
      await gmail.users.messages.list({
        userId: "me",
        labelIds: ["TRASH"],
        maxResults: 500,
        pageToken,
      });

    messageIds.push(
      ...(
        page.data.messages || []
      )
        .map((message) =>
          String(message.id || "")
        )
        .filter(Boolean)
    );

    pageToken =
      page.data.nextPageToken ||
      undefined;
  } while (pageToken);

  for (
    let index = 0;
    index < messageIds.length;
    index += 1000
  ) {
    await gmail.users.messages.batchDelete({
      userId: "me",
      requestBody: {
        ids: messageIds.slice(
          index,
          index + 1000
        ),
      },
    });
  }
}

async function emptyMicrosoftTrash(
  connection: any,
  supabase: any
) {
  const token =
    await getMicrosoftAccessToken(
      connection,
      supabase
    );

  let nextUrl: string | null =
    "https://graph.microsoft.com/v1.0/me/mailFolders/deleteditems/messages?$select=id&$top=100";
  const messageIds: string[] = [];

  while (nextUrl) {
    const listResponse: Response =
      await fetch(nextUrl, {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
        cache: "no-store",
      });

    const listData: any =
      await listResponse.json();

    if (!listResponse.ok) {
      throw new Error(
        listData?.error?.message ||
          "Microsoft çöp kutusu alınamadı."
      );
    }

    const messages =
      Array.isArray(listData?.value)
        ? listData.value
        : [];

    messageIds.push(
      ...messages
        .map((message: any) =>
          String(message?.id || "")
        )
        .filter(Boolean)
    );

    nextUrl =
      typeof listData?.["@odata.nextLink"] ===
      "string"
        ? listData["@odata.nextLink"]
        : null;
  }

  for (const messageId of messageIds) {
      const deleteResponse =
        await fetch(
          `https://graph.microsoft.com/v1.0/me/mailFolders/deleteditems/messages/${encodeURIComponent(
            messageId
          )}/permanentDelete`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

      if (!deleteResponse.ok) {
        let errorMessage = "";

        try {
          const errorData =
            await deleteResponse.json();
          errorMessage =
            errorData?.error?.message ||
            "";
        } catch {}

        throw new Error(
          errorMessage ||
            "Microsoft çöp kutusu boşaltılamadı."
        );
      }
  }
}

async function emptyImapTrash(
  connection: any
) {
  const client =
    await createImapClient(
      connection
    );

  let lock: any = null;

  try {
    const mailboxPath =
      await resolveImapMailbox(
        client,
        "trash"
      );

    lock =
      await client.getMailboxLock(
        mailboxPath
      );

    const exists = Number(
      (client.mailbox as any)
        ?.exists || 0
    );

    if (
      Number.isFinite(exists) &&
      exists > 0
    ) {
      await client.messageDelete(
        "1:*"
      );
    }
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

export async function DELETE(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const connectionId =
      String(
        body?.connectionId || ""
      ).trim();

    if (!connectionId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Mail hesabı seçilmedi.",
        },
        { status: 400 }
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
      await emptyGoogleTrash(
        connection,
        supabase
      );
    } else if (
      connection.provider ===
      "microsoft"
    ) {
      await emptyMicrosoftTrash(
        connection,
        supabase
      );
    } else if (
      connection.provider === "imap"
    ) {
      await emptyImapTrash(
        connection
      );
    } else {
      throw new Error(
        "Bu posta sağlayıcısı desteklenmiyor."
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
          error instanceof Error
            ? error.message
            : "Çöp kutusu boşaltılamadı.",
      },
      { status: 500 }
    );
  }
}
