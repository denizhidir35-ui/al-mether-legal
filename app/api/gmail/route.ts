import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
    const session: any = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return Response.json(
        {
          error: "Google hesabı bağlı değil",
        },
        { status: 401 }
      );
    }

    const oauth2Client = new google.auth.OAuth2();

    oauth2Client.setCredentials({
      access_token: session.accessToken,
    });

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const messages = await gmail.users.messages.list({
      userId: "me",
      maxResults: 20,
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