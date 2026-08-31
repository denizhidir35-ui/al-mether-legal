"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isPrivacyPath } from "@/lib/publicRoutes";
import SubscriptionAccessScreen from "@/components/SubscriptionAccessScreen";
import { setAccountStorageScope } from "@/lib/accountStorage";

type AccountState = "checking" | "active" | "pending" | "blocked";
type BootstrapState = "checking" | "authenticated" | "unauthenticated";

const PUBLIC_PATHS = [
  "/login",
  "/auth/accept-invite",
  "/auth/reset-password",
  "/auth/set-password",
  "/auth/forgot-password",
  "/account/access",
  "/download",
];

function isPublicPath(pathname: string) {
  return (
    isPrivacyPath(pathname) ||
    PUBLIC_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    )
  );
}

export default function AccountApprovalGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const [accountState, setAccountState] = useState<AccountState>("checking");
  const [bootstrapState, setBootstrapState] =
    useState<BootstrapState>("checking");
  const [bootstrapEmail, setBootstrapEmail] = useState("");
  const [message, setMessage] = useState("");
  const [expired, setExpired] = useState(false);
  const [verifiedIdentity, setVerifiedIdentity] = useState("");
  const checkedAccountRef = useRef("");

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      setBootstrapState("authenticated");
      setBootstrapEmail(session?.user?.email || "");
      return;
    }

    if (sessionStatus === "unauthenticated") {
      setBootstrapState("unauthenticated");
      setBootstrapEmail("");
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);

    async function resolveSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const data = await response.json();

        if (!active) return;

        if (data?.user) {
          setBootstrapEmail(
            typeof data.user.email === "string" ? data.user.email : ""
          );
          setBootstrapState("authenticated");
        } else {
          setBootstrapEmail("");
          setBootstrapState("unauthenticated");
        }
      } catch {
        if (!active) return;
        setBootstrapEmail("");
        setBootstrapState("unauthenticated");
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    void resolveSession();
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [session?.user?.email, sessionStatus]);

  const effectiveSessionStatus =
    sessionStatus === "loading" ? bootstrapState : sessionStatus;

  useEffect(() => {
    if (
      effectiveSessionStatus === "unauthenticated" &&
      !isPublicPath(pathname)
    ) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
    }
  }, [effectiveSessionStatus, pathname, router]);

  useEffect(() => {
    if (isPublicPath(pathname)) return;
    if (effectiveSessionStatus === "checking") {
      return;
    }

    if (effectiveSessionStatus !== "authenticated") {
      setAccountStorageScope(null);
      setVerifiedIdentity("");
      checkedAccountRef.current = "";
      setAccountState("checking");
      return;
    }

    const accountKey = `${session?.user?.email || bootstrapEmail}:${pathname}`;

    checkedAccountRef.current = accountKey;
    setAccountState("checking");
    let alive = true;

    async function checkAccount() {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch("/api/account/status", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const data = await response.json();

        if (!alive || checkedAccountRef.current !== accountKey) return;

        if (response.status === 401) {
          setBootstrapState("unauthenticated");
          checkedAccountRef.current = "";
          setMessage("Oturum doğrulanamadı. Giriş ekranına yönlendiriliyorsunuz.");
          setAccountState("blocked");
          router.replace(
            `/login?callbackUrl=${encodeURIComponent(pathname || "/")}`
          );
          return;
        }

        if (response.ok && data?.allowed === true) {
          setAccountStorageScope(data.user_id);
          setVerifiedIdentity(session?.user?.email || bootstrapEmail);
          setAccountState("active");
          return;
        }

        setMessage(data?.message || "Hesap erişimi doğrulanamadı.");
        setExpired(data?.subscription_status === "TRIAL_EXPIRED");
        setAccountState(data?.pending ? "pending" : "blocked");
      } catch {
        if (!alive || checkedAccountRef.current !== accountKey) return;

        setMessage("Hesap erişimi zaman aşımına uğradı. Lütfen yeniden deneyin.");
        setAccountState("blocked");
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    void checkAccount();
    const timer = window.setInterval(checkAccount, 30_000);
    window.addEventListener("focus", checkAccount);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener("focus", checkAccount); };
  }, [bootstrapEmail, effectiveSessionStatus, pathname, router, session?.user?.email]);

  if (isPublicPath(pathname)) return children;

  if (effectiveSessionStatus === "unauthenticated") {
    return isPublicPath(pathname)
      ? children
      : <main className="account-approval-screen">Giriş ekranına yönlendiriliyor...</main>;
  }

  if (accountState === "checking" || (accountState === "active" && verifiedIdentity !== (session?.user?.email || bootstrapEmail))) {
    return <main className="account-approval-screen">Hesap doğrulanıyor...</main>;
  }

  if (accountState !== "active") {
    return (
      <SubscriptionAccessScreen message={message} expired={expired} />
    );
  }

  return children;
}
