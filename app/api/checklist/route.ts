import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateAppUser } from "@/lib/alUser";

type ChecklistPayload = {
  calendarEventId?: string;
  mailRead?: boolean;
  noticeReviewed?: boolean;
  caseOpened?: boolean;
  deadlineChecked?: boolean;
  completed?: boolean;
};

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
          checklist: null,
        },
        { status: 401 }
      );
    }

    const calendarEventId =
      new URL(request.url)
        .searchParams
        .get("calendarEventId")
        ?.trim() || "";

    if (!calendarEventId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "calendarEventId zorunludur.",
          checklist: null,
        },
        { status: 400 }
      );
    }

    const supabase =
      getSupabaseAdmin();

    const result =
      await supabase
        .from("calendar_checklists")
        .select("*")
        .eq("user_id", appUser.id)
        .eq(
          "calendar_event_id",
          calendarEventId
        )
        .maybeSingle();

    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error.message,
          checklist: null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      checklist:
        result.data || null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Checklist alınamadı.",
        checklist: null,
      },
      { status: 500 }
    );
  }
}

export async function PUT(
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
        },
        { status: 401 }
      );
    }

    const body =
      (await request.json()) as ChecklistPayload;

    const calendarEventId =
      body.calendarEventId?.trim() || "";

    if (!calendarEventId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "calendarEventId zorunludur.",
        },
        { status: 400 }
      );
    }

    const supabase =
      getSupabaseAdmin();

    const result =
      await supabase
        .from("calendar_checklists")
        .upsert(
          {
            user_id:
              appUser.id,

            calendar_event_id:
              calendarEventId,

            mail_read:
              Boolean(body.mailRead),

            notice_reviewed:
              Boolean(
                body.noticeReviewed
              ),

            case_opened:
              Boolean(body.caseOpened),

            deadline_checked:
              Boolean(
                body.deadlineChecked
              ),

            completed:
              Boolean(body.completed),

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "user_id,calendar_event_id",
          }
        )
        .select("*")
        .single();

    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      checklist:
        result.data,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Checklist kaydedilemedi.",
      },
      { status: 500 }
    );
  }
}
