import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

async function requireUser() {
  const {
    appUser,
    error,
  } =
    await getOrCreateAppUser();

  if (
    error ||
    !appUser
  ) {
    return {
      appUser: null,
      response:
        NextResponse.json(
          {
            ok: false,
            error:
              error ||
              "Kullanıcı oturumu bulunamadı.",
          },
          {
            status: 401,
          }
        ),
    };
  }

  return {
    appUser,
    response: null,
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const auth =
      await requireUser();

    if (
      auth.response ||
      !auth.appUser
    ) {
      return auth.response;
    }

    const {
      searchParams,
    } =
      new URL(
        request.url
      );

    const calendarEventId =
      searchParams
        .get(
          "calendarEventId"
        )
        ?.trim() || "";

    const supabase =
      getSupabaseAdmin();

    let query =
      supabase
        .from("alarms")
        .select(
          "id, calendar_event_id, legal_deadline_id, alarm_time, alarm_type, message, status"
        )
        .eq(
          "user_id",
          auth.appUser.id
        );

    if (
      calendarEventId
    ) {
      query =
        query.eq(
          "calendar_event_id",
          calendarEventId
        );
    }

    const result =
      await query.order(
        "alarm_time",
        {
          ascending: true,
        }
      );

    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result.error.message,
          alarms: [],
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      count:
        result.data
          ?.length || 0,
      alarms:
        result.data || [],
    });
  } catch (
    error: unknown
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Alarm kayıtları alınamadı.",
        alarms: [],
      },
      {
        status: 500,
      }
    );
  }
}
