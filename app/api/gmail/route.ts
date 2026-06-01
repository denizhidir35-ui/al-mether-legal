import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

function getBody(payload: any): string {
  if (!payload) return "";

  if (payload.body?.data) {
    return Buffer.from(
      payload.body.data,
      "base64"
    )
      .toString("utf-8")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (
    payload.parts &&
    payload.parts.length > 0
  ) {
    for (const part of payload.parts) {
      const text =
        getBody(part);

      if (text) {
        return text;
      }
    }
  }

  return "";
}

export async function GET() {
  try {
    const session: any =
      await getServerSession(
        authOptions
      );

    if (!session?.accessToken) {
      return Response.json(
        {
          error:
            "Google hesabı bağlı değil",
        },
        { status: 401 }
      );
    }

    const oauth2Client =
      new google.auth.OAuth2();

    oauth2Client.setCredentials({
      access_token:
        session.accessToken,
    });

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const messages =
      await gmail.users.messages.list({
        userId: "me",
        maxResults: 20,
      });

    const result = [];

    for (const msg of (
      messages.data.messages || []
    )) {
      const detail =
        await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
        });

      const headers =
        detail.data.payload?.headers ||
        [];

      const subject =
        headers.find(
          (h) =>
            h.name === "Subject"
        )?.value || "";

      const from =
        headers.find(
          (h) =>
            h.name === "From"
        )?.value || "";

      const body = getBody(
        detail.data.payload
      );

      result.push({
        id: msg.id,
        subject,
        from,
        body:
          body ||
          detail.data.snippet ||
          "",
      });
    }

    return Response.json(result);
  } catch (error: any) {
    console.error(
      "GMAIL HATASI:",
      error
    );

    return Response.json(
      {
        error:
          error?.message ||
          "Mail okunamadı",

        details:
          error?.response?.data ||
          error,
      },
      { status: 500 }
    );
  }
}