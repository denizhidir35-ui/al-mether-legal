import "server-only";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { SubscriptionAccess } from "@/lib/subscription";

// Never cache license decisions in JWTs, module state or browser storage.
// Only pass email from a cryptographically verified session, never request input.
export async function getSubscriptionAccess(email: string): Promise<SubscriptionAccess | null> {
  const { data, error } = await getSupabaseAdmin().rpc("get_subscription_access", { p_email: email });
  if (error) throw new Error("Lisans bilgisi doğrulanamadı. Lütfen yeniden deneyin.");
  return data as SubscriptionAccess | null;
}
