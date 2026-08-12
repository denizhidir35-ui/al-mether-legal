"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type AccountState = "checking" | "active" | "pending" | "blocked";

export default function AccountApprovalGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status: sessionStatus, update } = useSession();
  const [accountState, setAccountState] = useState<AccountState>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (sessionStatus !== "authenticated") {
      setAccountState("checking");
      return;
    }

    let cancelled = false;

    async function checkAccount() {
      try {
        const response = await fetch("/api/account/status", {
          cache: "no-store",
        });
        const data = await response.json();

        if (cancelled) return;

        if (data?.status === "active") {
          await update();
          setAccountState("active");
          return;
        }

        setMessage(data?.message || "Hesap erişimi doğrulanamadı.");
        setAccountState(data?.pending ? "pending" : "blocked");
      } catch {
        if (!cancelled) {
          setMessage("Hesap erişimi doğrulanamadı.");
          setAccountState("blocked");
        }
      }
    }

    void checkAccount();
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, update]);

  if (sessionStatus === "unauthenticated") {
    return children;
  }

  if (sessionStatus === "loading" || accountState === "checking") {
    return <main className="account-approval-screen">Hesap doğrulanıyor...</main>;
  }

  if (accountState !== "active") {
    return (
      <main className="account-approval-screen">
        {accountState === "pending"
          ? "Hesabınız yönetici onayı bekliyor."
          : message}
      </main>
    );
  }

  return children;
}
