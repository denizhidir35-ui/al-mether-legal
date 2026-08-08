import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateAppUser } from "@/lib/alUser";

export async function GET(
  request: NextRequest
) {
  try {
    const { appUser, error } =
      await getOrCreateAppUser();

    if (error || !appUser) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error ||
            "Kullanıcı oturumu bulunamadı.",
          alarms: [],
        },
        { status: 401 }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const calendarEventId =
      searchParams
        .get("calendarEventId")
        ?.trim() || "";

    if (!calendarEventId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "calendarEventId zorunludur.",
          alarms: [],
        },
        { status: 400 }
      );
    }

    const supabase =
      getSupabaseAdmin();

    const result =
      await supabase
        .from("alarms")
        .select(
          "id, calendar_event_id, legal_deadline_id, alarm_time, alarm_type, message, status"
        )
        .eq("user_id", appUser.id)
        .eq(
          "calendar_event_id",
          calendarEventId
        )
        .order("alarm_time", {
          ascending: true,
        });

    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error.message,
          alarms: [],
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      count:
        result.data?.length || 0,
      alarms:
        result.data || [],
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Alarm kayıtları alınamadı.",
        alarms: [],
      },
      { status: 500 }
    );
  }
}
