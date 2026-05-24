import { google } from "googleapis";

export async function POST(
  req: Request
) {
  try {
    const body =
      await req.json();

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

    await calendar.events.insert({
      calendarId:
        "primary",

      requestBody: {
        summary:
          body.title,

        description:
          body.client,

        start: {
          dateTime:
            body.date,
        },

        end: {
          dateTime:
            body.date,
        },
      },
    });

    return Response.json({
      success: true,
    });
  } catch (error) {
    console.log(error);

    return Response.json({
      success: false,
    });
  }
}