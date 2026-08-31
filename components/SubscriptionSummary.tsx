"use client";
import { useEffect, useState } from "react";
import type { SubscriptionAccess } from "@/lib/subscription";
import { subscriptionMessage } from "@/lib/subscription";

export default function SubscriptionSummary() {
  const [access, setAccess] = useState<SubscriptionAccess | null>(null);
  useEffect(() => {
    let alive = true;
    const refresh = () => fetch("/api/account/status", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null).then(data => { if (alive) setAccess(data); }).catch(() => {});
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);
  if (!access) return null;
  return <p role="status">{access.subscription_status === "TRIAL_ACTIVE" && <strong>Demo hesabı · </strong>}{subscriptionMessage(access)}
    {access.is_owner && <> · <a href="/settings/licenses">Demo ve lisans yönetimi</a></>}
  </p>;
}
