import { createServerSupabaseClient } from "@/lib/supabaseServer";

export async function getOrCreateAppUser() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) {
    return { user: null, appUser: null, error: "Kullanıcı oturumu bulunamadı." };
  }

  const email = user.email;

  const existing = await supabase
    .from("app_users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (existing.data) {
    return { user, appUser: existing.data, error: null };
  }

  const created = await supabase
    .from("app_users")
    .insert({
      email,
      google_id: user.id,
      name: user.user_metadata?.full_name || user.user_metadata?.name || email,
      role: "lawyer",
      status: "active",
    })
    .select("*")
    .single();

  if (created.error) {
    return { user, appUser: null, error: created.error.message };
  }

  return { user, appUser: created.data, error: null };
}
