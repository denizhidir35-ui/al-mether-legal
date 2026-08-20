import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { getOrCreateAppUser } from "@/lib/alUser";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function validSubscriptionEndpoint(value: string) {
  if (value.length > 2048) {
    return false;
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

async function saveOwnedSubscription(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  p256dh: string,
  auth: string
) {
  const existing = await supabase
    .from("push_subscriptions")
    .select("id,user_id")
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (existing.error) {
    return { data: null, error: existing.error, conflict: false };
  }

  if (existing.data && existing.data.user_id !== userId) {
    return { data: null, error: null, conflict: true };
  }

  if (existing.data) {
    const updated = await supabase
      .from("push_subscriptions")
      .update({ p256dh, auth, status: "active" })
      .eq("id", existing.data.id)
      .eq("user_id", userId)
      .select("id,user_id,status")
      .single();

    return {
      data: updated.data,
      error: updated.error,
      conflict: false,
    };
  }

  const inserted = await supabase
    .from("push_subscriptions")
    .insert({
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      status: "active",
    })
    .select("id,user_id,status")
    .single();

  if (inserted.error?.code === "23505") {
    const raced = await supabase
      .from("push_subscriptions")
      .select("id,user_id")
      .eq("endpoint", endpoint)
      .maybeSingle();

    if (raced.error) {
      return { data: null, error: raced.error, conflict: false };
    }

    if (raced.data && raced.data.user_id !== userId) {
      return { data: null, error: null, conflict: true };
    }

    if (raced.data) {
      const updated = await supabase
        .from("push_subscriptions")
        .update({ p256dh, auth, status: "active" })
        .eq("id", raced.data.id)
        .eq("user_id", userId)
        .select("id,user_id,status")
        .single();

      return {
        data: updated.data,
        error: updated.error,
        conflict: false,
      };
    }
  }

  return {
    data: inserted.data,
    error: inserted.error,
    conflict: false,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { appUser, error } = await getOrCreateAppUser();

    if (error || !appUser) {
      return NextResponse.json(
        {
          ok: false,
          error: error || "Oturum bulunamadı.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const endpoint = String(body?.endpoint || "").trim();
    const p256dh = String(body?.keys?.p256dh || "").trim();
    const auth = String(body?.keys?.auth || "").trim();

    if (
      !validSubscriptionEndpoint(endpoint) ||
      !p256dh ||
      !auth ||
      p256dh.length > 512 ||
      auth.length > 512
    ) {
      return NextResponse.json(
        { ok: false, error: "Geçersiz push aboneliği." },
        { status: 400 }
      );
    }

    const result = await saveOwnedSubscription(
      getSupabaseAdmin(),
      appUser.id,
      endpoint,
      p256dh,
      auth
    );

    if (result.conflict) {
      return NextResponse.json(
        {
          ok: false,
          error: "Push aboneliği başka bir kullanıcıya ait.",
        },
        { status: 409 }
      );
    }

    if (result.error || !result.data) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result.error?.message ||
            "Push aboneliği kaydedilemedi.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      subscription: result.data,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Push aboneliği kaydedilemedi.",
      },
      { status: 500 }
    );
  }
}
