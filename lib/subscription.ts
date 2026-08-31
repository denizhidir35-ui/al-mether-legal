export type SubscriptionStatus =
  | "TRIAL_PENDING" | "TRIAL_ACTIVE" | "TRIAL_EXPIRED" | "ACTIVE" | "SUSPENDED";

export type SubscriptionAccess = {
  user_id: string;
  subscription_status: SubscriptionStatus;
  allowed: boolean;
  is_owner: boolean;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  licensed_until: string | null;
  server_now: string;
  days_remaining: number | null;
  last_day: boolean;
};

export function subscriptionMessage(access: SubscriptionAccess): string {
  switch (access.subscription_status) {
    case "TRIAL_PENDING": return "Demo talebiniz inceleniyor.";
    case "TRIAL_EXPIRED": return "Demo süreniz sona erdi.";
    case "SUSPENDED": return "Hesabınızın uygulama erişimi askıya alındı.";
    case "TRIAL_ACTIVE": return access.last_day
      ? "Demo süreniz bugün sona eriyor."
      : `${access.days_remaining ?? 0} gün kaldı`;
    case "ACTIVE": return "Lisansınız aktif.";
  }
}
