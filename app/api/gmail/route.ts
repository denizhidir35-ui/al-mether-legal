import { google } from "googleapis";
import { getOrCreateAppUser } from "@/lib/alUser";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type GmailAttachment = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
};

function decodeBase64Url(data: string) {
  return Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  ).toString("utf-8");
}

function cleanHtml(input: string) {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getBody(payload: any): string {
  if (!payload) return "";

  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);

    if (payload.mimeType === "text/html") {
      return cleanHtml(decoded);
    }

    return decoded.replace(/\s+/g, " ").trim();
  }

  if (payload.parts && payload.parts.length > 0) {
    const plainPart = payload.parts.find(
      (part: any) => part.mimeType === "text/plain"
    );

    if (plainPart) {
      const text = getBody(plainPart);

      if (text) {
        return text;
      }
    }

    for (const part of payload.parts) {
      const text = getBody(part);

      if (text) {
        return text;
      }
    }
  }

  return "";
}

function collectAttachments(payload: any): GmailAttachment[] {
  const attachments: GmailAttachment[] = [];

  function walk(part: any) {
    if (!part) return;

    const filename = part.filename || "";
    const attachmentId = part.body?.attachmentId || "";

    if (filename && attachmentId) {
      attachments.push({
        filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: Number(part.body?.size || 0),
        attachmentId,
      });
    }

    if (Array.isArray(part.parts)) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  }

  walk(payload);

  return attachments;
}

export async function GET() {
  try {
    const {
      appUser,
      error: userError,
    } = await getOrCreateAppUser();

    if (
      userError ||
      !appUser
    ) {
      return Response.json(
        {
          error:
            userError ||
            "Kullanıcı bulunamadı.",
        },
        { status: 401 }
      );
    }

    const supabase =
      getSupabaseAdmin();

    const connection =
      await supabase
        .from("mail_connections")
        .select("*")
        .eq(
          "user_id",
          appUser.id
        )
        .eq(
          "provider",
          "google"
        )
        .eq(
          "status",
          "connected"
        )
        .maybeSingle();

    if (connection.error) {
      return Response.json(
        {
          error:
            connection.error.message,
        },
        { status: 500 }
      );
    }

    if (!connection.data) {
      return Response.json(
        {
          error:
            "Google hesabı bağlı değil.",
        },
        { status: 401 }
      );
    }

    const oauth2Client =
      new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

    oauth2Client.setCredentials({
      access_token:
        connection.data.access_token ||
        undefined,

      refresh_token:
        connection.data.refresh_token ||
        undefined,

      expiry_date:
        connection.data.token_expires_at
          ? new Date(
              connection.data.token_expires_at
            ).getTime()
          : undefined,
    });

    oauth2Client.on(
      "tokens",
      async (tokens) => {
        const update: Record<
          string,
          unknown
        > = {
          updated_at:
            new Date().toISOString(),
        };

        if (tokens.access_token) {
          update.access_token =
            tokens.access_token;
        }

        if (tokens.refresh_token) {
          update.refresh_token =
            tokens.refresh_token;
        }

        if (tokens.expiry_date) {
          update.token_expires_at =
            new Date(
              tokens.expiry_date
            ).toISOString();
        }

        const updated =
          await supabase
            .from("mail_connections")
            .update(update)
            .eq(
              "id",
              connection.data.id
            );

        if (updated.error) {
          console.error(
            "MAIL TOKEN UPDATE ERROR:",
            updated.error.message
          );
        }
      }
    );

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const messages = await gmail.users.messages.list({
      userId: "me",
      maxResults: 50,
    });

    const result = [];

    for (const msg of messages.data.messages || []) {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      });

      const headers = detail.data.payload?.headers || [];

      const subject =
        headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";

      const from =
        headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";

      const date =
        headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";

      const body = getBody(detail.data.payload);
      const attachments = collectAttachments(detail.data.payload);

      result.push({
        id: msg.id,
        subject,
        from,
        sender: from,
        date,
        body: body || detail.data.snippet || "",
        snippet: detail.data.snippet || "",
        hasAttachment: attachments.length > 0,
        has_attachment: attachments.length > 0,
        attachments,
      });
    }

    return Response.json(result);
  } catch (error: any) {
    console.error("GMAIL HATASI:", error);

    return Response.json(
      {
        error: error?.message || "Mail okunamadı",
        details: error?.response?.data || error,
      },
      { status: 500 }
    );
  }
}

