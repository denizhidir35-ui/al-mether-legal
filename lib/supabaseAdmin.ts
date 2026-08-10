import "server-only";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

type JwtClaims = {
  ref?: unknown;
  role?: unknown;
};

function readJwtClaims(value: string): JwtClaims | null {
  const parts = value.split(".");

  if (parts.length !== 3) {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as JwtClaims;
  } catch {
    return null;
  }
}

function validateAdminConfiguration(
  supabaseUrl: string,
  serviceRoleKey: string
) {
  let projectRef = "";

  try {
    const url = new URL(supabaseUrl);
    const match = url.hostname.match(
      /^([a-z0-9-]+)\.supabase\.co$/i
    );

    if (!match) {
      throw new Error("host");
    }

    projectRef = match[1];
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL geçerli bir Supabase proje URL'si değil."
    );
  }

  if (serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY alanında publishable/anon key kullanılıyor. Bu alana aynı Supabase projesinin secret service-role key'i girilmelidir."
    );
  }

  const claims = readJwtClaims(serviceRoleKey);

  if (!claims) {
    return;
  }

  if (
    typeof claims.role === "string" &&
    claims.role !== "service_role"
  ) {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY service_role yetkisine sahip değil (algılanan rol: ${claims.role}).`
    );
  }

  if (
    typeof claims.ref === "string" &&
    claims.ref !== projectRef
  ) {
    throw new Error(
      `Supabase production yapılandırması farklı projelere ait: URL proje ref'i ${projectRef}, service-role key proje ref'i ${claims.ref}. Vercel environment değerlerini aynı projeden yeniden girin.`
    );
  }
}

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL tanımlı değil."
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY tanımlı değil."
    );
  }

  validateAdminConfiguration(
    supabaseUrl,
    serviceRoleKey
  );

  adminClient = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );

  return adminClient;
}
