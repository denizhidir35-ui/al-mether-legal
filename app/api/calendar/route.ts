import { google } from "googleapis";

export async function POST(
  req: Request
) {
  try {
    const body =
      await req.json();

    console.log(
      "REFRESH TOKEN:",
      process.env.GOOGLE_REFRESH_TOKEN
        ? "VAR"
        : "YOK"
    );

    const oauth2Client =
      new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        "http://localhost:3000/api/auth/callback/google"
      );

    oauth2Client.setCredentials({
      refresh_token:
        process.env.GOOGLE_REFRESH_TOKEN,
    });

    const calendar =
      google.calendar({
        version: "v3",
        auth: oauth2Client,
      });

    const startDate =
      new Date(body.date);

    const endDate =
      new Date(body.date);

    endDate.setHours(
      endDate.getHours() + 1
    );

    const event =
      await calendar.events.insert({
        calendarId:
          "primary",

        requestBody: {
          summary:
            body.title ||
            "AL Mether Deadline",

          description:
            body.client ||
            "",

          start: {
            dateTime:
              startDate.toISOString(),
            timeZone:
              "Europe/Istanbul",
          },

          end: {
            dateTime:
              endDate.toISOString(),
            timeZone:
              "Europe/Istanbul",
          },
        },
      });

    return Response.json({
      success: true,
      eventId:
        event.data.id,
      eventLink:
        event.data.htmlLink,
    });
  } catch (error: any) {
    console.error(
      "CALENDAR FULL ERROR:",
      error
    );

    console.error(
      "GOOGLE RESPONSE:",
      error?.response?.data
    );

    return Response.json(
      {
        success: false,
        error:
          error?.response?.data ||
          error?.message ||
          String(error),
      },
      { status: 500 }
    );
  }
}