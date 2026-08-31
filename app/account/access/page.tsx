import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getSubscriptionAccess } from "@/lib/subscriptionServer";
import { subscriptionMessage } from "@/lib/subscription";
import SubscriptionAccessScreen from "@/components/SubscriptionAccessScreen";

export default async function AccountAccessPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");
  const access = await getSubscriptionAccess(session.user.email).catch(() => null);
  if (access?.allowed) redirect("/dashboard");
  return <SubscriptionAccessScreen message={access ? subscriptionMessage(access) : "Hesap erişimi doğrulanamadı. Lütfen yeniden deneyin."}
    expired={access?.subscription_status === "TRIAL_EXPIRED"} />;
}
