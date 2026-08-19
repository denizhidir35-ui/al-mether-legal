import { NextResponse } from "next/server";

import { getOrCreateAppUser } from "@/lib/alUser";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED_ROLES = new Set([
  "muvekkil",
  "davaci",
  "davali",
  "sanik",
  "supheli",
  "katilan",
  "feri_mudahil",
  "vekil",
  "diger",
]);

const ALLOWED_PARTY_TYPES = new Set([
  "person",
  "organization",
]);

function clean(value: unknown) {
  return value?.toString().trim() || "";
}

async function getOwnedCase(
  caseId: string,
  userId: string
) {
  const supabase = getSupabaseAdmin();

  return supabase
    .from("legal_cases")
    .select("id")
    .eq("id", caseId)
    .eq("user_id", userId)
    .maybeSingle();
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      caseId: string;
    }>;
  }
) {
  try {
    const { appUser, error } =
      await getOrCreateAppUser();

    if (error || !appUser) {
      return NextResponse.json(
        {
          ok: false,
          error: "Kullanıcı oturumu bulunamadı.",
        },
        { status: 401 }
      );
    }

    const { caseId } = await context.params;

    const ownedCase =
      await getOwnedCase(caseId, appUser.id);

    if (ownedCase.error) {
      return NextResponse.json(
        {
          ok: false,
          error: ownedCase.error.message,
        },
        { status: 500 }
      );
    }

    if (!ownedCase.data) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dava bulunamadı.",
        },
        { status: 404 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error: dbError } =
      await supabase
        .from("case_parties")
        .select("*")
        .eq("case_id", caseId)
        .eq("user_id", appUser.id)
        .order("created_at", {
          ascending: true,
        });

    if (dbError) {
      return NextResponse.json(
        {
          ok: false,
          error: dbError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      parties: data || [],
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Taraflar alınamadı.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      caseId: string;
    }>;
  }
) {
  try {
    const { appUser, error } =
      await getOrCreateAppUser();

    if (error || !appUser) {
      return NextResponse.json(
        {
          ok: false,
          error: "Kullanıcı oturumu bulunamadı.",
        },
        { status: 401 }
      );
    }

    const { caseId } = await context.params;

    const ownedCase =
      await getOwnedCase(caseId, appUser.id);

    if (ownedCase.error) {
      return NextResponse.json(
        {
          ok: false,
          error: ownedCase.error.message,
        },
        { status: 500 }
      );
    }

    if (!ownedCase.data) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dava bulunamadı.",
        },
        { status: 404 }
      );
    }

    const body = await request.json();

    const role = clean(body.role);
    const partyType =
      clean(body.party_type) || "person";
    const name = clean(body.name);

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Taraf rolü geçersiz.",
        },
        { status: 400 }
      );
    }

    if (
      !ALLOWED_PARTY_TYPES.has(
        partyType
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Taraf tipi geçersiz.",
        },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ad / ünvan zorunludur.",
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error: dbError } =
      await supabase
        .from("case_parties")
        .insert({
          case_id: caseId,
          user_id: appUser.id,
          role,
          party_type: partyType,
          name,
          is_client:
            Boolean(body.is_client),
          identity_no:
            clean(body.identity_no) ||
            null,
          phone:
            clean(body.phone) || null,
          email:
            clean(body.email) || null,
          note:
            clean(body.note) || null,
        })
        .select("*")
        .single();

    if (dbError) {
      return NextResponse.json(
        {
          ok: false,
          error: dbError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      party: data,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Taraf eklenemedi.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      caseId: string;
    }>;
  }
) {
  try {
    const { appUser, error } =
      await getOrCreateAppUser();

    if (error || !appUser) {
      return NextResponse.json(
        {
          ok: false,
          error: "Kullanıcı oturumu bulunamadı.",
        },
        { status: 401 }
      );
    }

    const { caseId } = await context.params;
    const body = await request.json();

    const partyId = clean(body.id);
    const role = clean(body.role);
    const partyType =
      clean(body.party_type);
    const name = clean(body.name);

    if (!partyId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Taraf kimliği zorunludur.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Taraf rolü geçersiz.",
        },
        { status: 400 }
      );
    }

    if (
      !ALLOWED_PARTY_TYPES.has(
        partyType
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Taraf tipi geçersiz.",
        },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ad / ünvan zorunludur.",
        },
        { status: 400 }
      );
    }

    const ownedCase =
      await getOwnedCase(caseId, appUser.id);

    if (!ownedCase.data) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dava bulunamadı.",
        },
        { status: 404 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error: dbError } =
      await supabase
        .from("case_parties")
        .update({
          role,
          party_type: partyType,
          name,
          is_client:
            Boolean(body.is_client),
          identity_no:
            clean(body.identity_no) ||
            null,
          phone:
            clean(body.phone) || null,
          email:
            clean(body.email) || null,
          note:
            clean(body.note) || null,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", partyId)
        .eq("case_id", caseId)
        .eq("user_id", appUser.id)
        .select("*")
        .maybeSingle();

    if (dbError) {
      return NextResponse.json(
        {
          ok: false,
          error: dbError.message,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          ok: false,
          error: "Taraf bulunamadı.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      party: data,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Taraf güncellenemedi.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      caseId: string;
    }>;
  }
) {
  try {
    const { appUser, error } =
      await getOrCreateAppUser();

    if (error || !appUser) {
      return NextResponse.json(
        {
          ok: false,
          error: "Kullanıcı oturumu bulunamadı.",
        },
        { status: 401 }
      );
    }

    const { caseId } = await context.params;

    const url = new URL(request.url);
    const partyId =
      clean(
        url.searchParams.get("partyId")
      );

    if (!partyId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Taraf kimliği zorunludur.",
        },
        { status: 400 }
      );
    }

    const ownedCase =
      await getOwnedCase(caseId, appUser.id);

    if (!ownedCase.data) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dava bulunamadı.",
        },
        { status: 404 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error: dbError } =
      await supabase
        .from("case_parties")
        .delete()
        .eq("id", partyId)
        .eq("case_id", caseId)
        .eq("user_id", appUser.id)
        .select("id")
        .maybeSingle();

    if (dbError) {
      return NextResponse.json(
        {
          ok: false,
          error: dbError.message,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          ok: false,
          error: "Taraf bulunamadı.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Taraf silinemedi.",
      },
      { status: 500 }
    );
  }
}
