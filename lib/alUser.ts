import "server-only";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export type AppUserRecord = {
  id: string;
  email: string;
  google_id?: string | null;
  name?: string | null;
  role?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AppSessionUser = {
  email: string;
  name: string;
  image: string;
};

export type GetOrCreateAppUserResult = {
  user: AppSessionUser | null;
  appUser: AppUserRecord | null;
  error: string | null;
};

function cleanEmail(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLocaleLowerCase("tr-TR");
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function getOrCreateAppUser(): Promise<GetOrCreateAppUserResult> {
  try {
    const session = await getServerSession(authOptions);

    const email = cleanEmail(session?.user?.email);

    if (!email) {
      return {
        user: null,
        appUser: null,
        error: "AL Mether Lawyer kullanıcı oturumu bulunamadı.",
      };
    }

    const sessionUser: AppSessionUser = {
      email,
      name:
        cleanText(session?.user?.name) ||
        email.split("@")[0] ||
        "Avukat",
      image: cleanText(session?.user?.image),
    };

    const supabase = getSupabaseAdmin();

    const existing = await supabase
      .from("app_users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existing.error) {
      return {
        user: sessionUser,
        appUser: null,
        error: existing.error.message,
      };
    }

    if (existing.data) {
      const currentUser =
        existing.data as AppUserRecord;

      if (
        currentUser.status &&
        currentUser.status !== "active"
      ) {
        return {
          user: sessionUser,
          appUser: currentUser,
          error:
            "AL Mether Legal hesabınız pasif durumda. Yönetici ile iletişime geçin.",
        };
      }

      const needsUpdate =
        currentUser.name !==
        sessionUser.name;

      if (!needsUpdate) {
        return {
          user: sessionUser,
          appUser: currentUser,
          error: null,
        };
      }

      const updated =
        await supabase
          .from("app_users")
          .update({
            name:
              sessionUser.name,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            currentUser.id
          )
          .select("*")
          .single();

      if (updated.error) {
        return {
          user: sessionUser,
          appUser: currentUser,
          error: null,
        };
      }

      return {
        user: sessionUser,
        appUser:
          updated.data as AppUserRecord,
        error: null,
      };
    }
    const created = await supabase
      .from("app_users")
      .insert({
        email,
        google_id: email,
        name: sessionUser.name,
        role: "lawyer",
        status: "active",
      })
      .select("*")
      .single();

    if (created.error) {
      return {
        user: sessionUser,
        appUser: null,
        error: created.error.message,
      };
    }

    return {
      user: sessionUser,
      appUser:
        created.data as AppUserRecord,
      error: null,
    };
  } catch (error: unknown) {
    return {
      user: null,
      appUser: null,
      error:
        error instanceof Error
          ? error.message
          : "AL Mether Lawyer kullanıcı kaydı hazırlanamadı.",
    };
  }
}

