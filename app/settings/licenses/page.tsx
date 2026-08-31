import { redirect } from "next/navigation";
import { getOrCreateAppUser } from "@/lib/alUser";
import SubscriptionManagement from "@/components/SubscriptionManagement";

export default async function LicenseManagementPage() {
  const result = await getOrCreateAppUser();
  if (result.error) redirect("/account/access");
  if (!result.appUser?.is_license_owner || result.appUser.subscription_status !== "ACTIVE") redirect("/settings");
  return <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, height: "100dvh", overflowY: "auto" }}>
    <a href="/settings">Ayarlar’a dön</a>
    <h1 style={{ fontSize: 24, margin: "20px 0" }}>Demo ve Lisans Yönetimi</h1>
    <SubscriptionManagement />
  </main>;
}
