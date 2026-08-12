"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type AccountState = "checking" | "active" | "pending" | "blocked";

export default function AccountApprovalGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const [accountState, setAccountState] = useState<AccountState>("checking");
  const [message, setMessage] = useState("");
  const checkedAccountRef = useRef("");

  useEffect(() => {
    if (sessionStatus === "loading") {
      return;
    }

    if (sessionStatus !== "authenticated") {
      checkedAccountRef.current = "";
      setAccountState("checking");
      return;
    }

    const accountKey = session?.user?.email || "authenticated";

    if (checkedAccountRef.current === accountKey) {
      return;
    }

    checkedAccountRef.current = accountKey;

    async function checkAccount() {
      try {
        const response = await fetch("/api/account/status", {
          cache: "no-store",
        });
        const data = await response.json();

        if (checkedAccountRef.current !== accountKey) return;

        if (data?.status === "active") {
          setAccountState("active");
          return;
        }

        setMessage(data?.message || "Hesap erişimi doğrulanamadı.");
        setAccountState(data?.pending ? "pending" : "blocked");
      } catch {
        if (checkedAccountRef.current !== accountKey) return;

        setMessage("Hesap erişimi doğrulanamadı.");
        setAccountState("blocked");
      }
    }

    void checkAccount();
  }, [session?.user?.email, sessionStatus]);

  if (sessionStatus === "unauthenticated") {
    return children;
  }

  if (accountState === "checking") {
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
