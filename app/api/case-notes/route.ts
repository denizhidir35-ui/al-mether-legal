import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOrCreateAppUser } from "@/lib/alUser";

export async function GET(
  request: Request
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
            "Kullanıcı bulunamadı.",
        },
        { status: 401 }
      );
    }

    const url =
      new URL(request.url);

    const caseId =
      url.searchParams
        .get("caseId")
        ?.trim() || "";

    if (!caseId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "caseId zorunludur.",
        },
        { status: 400 }
      );
    }

    const supabase =
      getSupabaseAdmin();

    const result =
      await supabase
        .from("case_notes")
        .select("*")
        .eq("user_id", appUser.id)
        .eq("case_id", caseId)
        .maybeSingle();

    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      note:
        result.data || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Dava notu okunamadı.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request
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
            "Kullanıcı bulunamadı.",
        },
        { status: 401 }
      );
    }

    const body =
      await request.json();

    const caseId =
      body.caseId
        ?.toString()
        .trim() || "";

    const noteText =
      body.noteText
        ?.toString() || "";

    if (!caseId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "caseId zorunludur.",
        },
        { status: 400 }
      );
    }

    const supabase =
      getSupabaseAdmin();

    const result =
      await supabase
        .from("case_notes")
        .upsert(
          {
            user_id:
              appUser.id,

            case_id:
              caseId,

            note_text:
              noteText,

            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "user_id,case_id",
          }
        )
        .select("*")
        .single();

    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      note:
        result.data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Dava notu kaydedilemedi.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request
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
            "Kullanıcı bulunamadı.",
        },
        { status: 401 }
      );
    }

    const url =
      new URL(request.url);

    const caseId =
      url.searchParams
        .get("caseId")
        ?.trim() || "";

    if (!caseId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "caseId zorunludur.",
        },
        { status: 400 }
      );
    }

    const supabase =
      getSupabaseAdmin();

    const result =
      await supabase
        .from("case_notes")
        .delete()
        .eq("user_id", appUser.id)
        .eq("case_id", caseId);

    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result.error.message,
        },
        { status: 500 }
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
            : "Dava notu silinemedi.",
      },
      { status: 500 }
    );
  }
}
