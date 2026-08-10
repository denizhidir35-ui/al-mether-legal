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
            radial-gradient(
              circle at 50% 15%,
              rgba(94, 92, 255, 0.12),
              transparent 32%
            ),
            #060b18;
          color: white;
        }

        .login-card {
          width: min(
            390px,
            100%
          );
          padding: 28px;
          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.09
            );
          border-radius: 22px;
          background:
            rgba(
              13,
              22,
              38,
              0.92
            );
          box-shadow:
            0 28px 80px
            rgba(
              0,
              0,
              0,
              0.32
            );
          text-align: center;
        }

        .kicker {
          margin-bottom: 8px;
          color: #66a4ff;
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
          color: #8496b2;
          font-size: 12px;
          line-height: 1.6;
        }

        button {
          width: 100%;
          height: 44px;
          border: 1px solid
            rgba(
              255,
              255,
              255,
              0.16
            );
          border-radius: 13px;
          background: white;
          color: #080d17;
          cursor: pointer;
          font-size: 12px;
          font-weight: 900;
        }

        button:hover {
          background: #edf2f7;
        }

        .security {
          margin-top: 16px;
          color: #5f718d;
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

