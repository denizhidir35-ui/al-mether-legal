import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateAppUser } from "@/lib/alUser";

type NotePayload = {
  calendarEventId?: string;
  noteText?: string;
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
          note: null,
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
          note: null,
        },
        { status: 400 }
      );
    }

    const supabase =
      getSupabaseAdmin();

    const result =
      await supabase
        .from("calendar_notes")
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
          note: null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      note:
        result.data || null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Not alınamadı.",
        note: null,
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
      (await request.json()) as NotePayload;

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

    const noteText =
      typeof body.noteText === "string"
        ? body.noteText
        : "";

    const supabase =
      getSupabaseAdmin();

    const result =
      await supabase
        .from("calendar_notes")
        .upsert(
          {
            user_id:
              appUser.id,

            calendar_event_id:
              calendarEventId,

            note_text:
              noteText,

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
      note:
        result.data,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Not kaydedilemedi.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
        },
        { status: 400 }
      );
    }

    const supabase =
      getSupabaseAdmin();

    const result =
      await supabase
        .from("calendar_notes")
        .delete()
        .eq("user_id", appUser.id)
        .eq(
          "calendar_event_id",
          calendarEventId
        );

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
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Not silinemedi.",
      },
      { status: 500 }
    );
  }
}
