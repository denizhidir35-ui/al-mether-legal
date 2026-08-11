"use client";

import {
  signIn,
  useSession,
} from "next-auth/react";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();

  const {
    data: session,
    status,
  } = useSession();

  useEffect(() => {
    if (
      status === "authenticated" &&
      session?.user
    ) {
      router.replace("/mail-connect");
    }
  }, [
    status,
    session,
    router,
  ]);

  async function loginWithGoogle() {
    await signIn(
      "google",
      {
        callbackUrl:
          "/mail-connect",
      }
    );
  }

  return (
    <main className="login-page">
      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 20px;
          background:
            var(--legal-bg);
          color: var(--legal-text);
        }

        .login-card {
          width: min(
            390px,
            100%
          );
          padding: 28px;
          border: 1px solid
            var(--legal-border);
          border-radius: 22px;
          background:
            var(--legal-surface);
          box-shadow:
            var(--legal-shadow-md);
          text-align: center;
        }

        .kicker {
          margin-bottom: 8px;
          color: var(--legal-gold);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.18em;
        }

        h1 {
          margin: 0;
          font-size: 24px;
        }

        p {
          margin: 10px 0 24px;
          color: var(--legal-muted);
          font-size: 12px;
          line-height: 1.6;
        }

        button {
          width: 100%;
          height: 44px;
          border: 1px solid
            var(--legal-border);
          border-radius: 13px;
          background: var(--legal-surface-2);
          color: var(--legal-text);
          cursor: pointer;
          font-size: 12px;
          font-weight: 900;
        }

        button:hover {
          background: var(--legal-gold-soft);
        }

        .security {
          margin-top: 16px;
          color: var(--legal-muted);
          font-size: 9px;
        }

        @media (
          max-width: 500px
        ) {
          .login-card {
            padding: 24px 18px;
            border-radius: 18px;
          }
        }
      `}</style>

      <section className="login-card">
        <div className="kicker">
          AL METHER LEGAL
        </div>

        <h1>Giriş Yap</h1>

        <p>
          Hukuki takviminize ve dava çalışma
          alanınıza güvenli şekilde erişin.
        </p>

        <button
          type="button"
          disabled={
            status === "loading"
          }
          onClick={
            loginWithGoogle
          }
        >
          {status === "loading"
            ? "Kontrol ediliyor..."
            : "Google ile Giriş Yap"}
        </button>

        <div className="security">
          E-posta bağlantısı girişten sonra
          ayrıca yapılır.
        </div>
      </section>
    </main>
  );
}

