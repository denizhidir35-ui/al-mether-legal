"use client";

import {
  signOut,
  useSession,
} from "next-auth/react";

import {
  useRouter,
} from "next/navigation";

import {
  useEffect,
  useState,
} from "react";

export default function LegalSessionControl() {
  const router =
    useRouter();

  const {
    data: session,
    status,
  } = useSession();

  const [
    mailConnected,
    setMailConnected,
  ] = useState(false);

  const [
    mailLoading,
    setMailLoading,
  ] = useState(true);

  useEffect(() => {
    if (
      status !== "authenticated"
    ) {
      setMailLoading(false);
      setMailConnected(false);
      return;
    }

    let active = true;

    async function loadMailStatus() {
      try {
        setMailLoading(true);

        const response =
          await fetch(
            "/api/mail-connection",
            {
              cache: "no-store",
            }
          );

        const text =
          await response.text();

        let data: any = {};

        if (text) {
          try {
            data =
              JSON.parse(text);
          } catch {
            data = {};
          }
        }

        if (!active) {
          return;
        }

        setMailConnected(
          response.ok &&
          data?.ok === true &&
          data?.connected === true
        );
      } catch {
        if (active) {
          setMailConnected(false);
        }
      } finally {
        if (active) {
          setMailLoading(false);
        }
      }
    }

    loadMailStatus();

    return () => {
      active = false;
    };
  }, [status]);

  if (
    status !== "authenticated" ||
    !session?.user
  ) {
    return null;
  }

  return (
    <div className="legal-session-control">
      <button
        type="button"
        className={`mail-status ${
          mailConnected
            ? "connected"
            : ""
        }`}
        onClick={() =>
          router.push(
            "/mail-connect"
          )
        }
        title={
          mailConnected
            ? "E-posta hesabı bağlı"
            : "E-posta hesabını bağla"
        }
      >
        <span
          className="mail-dot"
        />

        <span className="mail-text">
          {mailLoading
            ? "Kontrol..."
            : mailConnected
              ? "Mail bağlı"
              : "Mail bağla"}
        </span>
      </button>

      <button
        type="button"
        className="logout-button"
        onClick={() =>
          signOut({
            callbackUrl:
              "/login",
          })
        }
        title="Çıkış yap"
      >
        Çıkış
      </button>

      <style jsx global>{`
        .legal-session-control {
          position: fixed;
          top: 12px;
          right: 14px;
          z-index: 99990;

          display: flex;
          align-items: center;
          gap: 6px;
        }

        .legal-session-control button {
          height: 34px;

          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;

          padding: 0 10px;

          border: 1px solid
            var(--legal-border);

          border-radius: 11px;

          background:
            var(--legal-surface);

          backdrop-filter:
            blur(16px);

          -webkit-backdrop-filter:
            blur(16px);

          cursor: pointer;

          font-size: 9px;
          font-weight: 850;
        }

        .mail-status {
          color: #8da0bd;
        }

        .mail-status.connected {
          color: #63d6b0;
        }

        .mail-dot {
          width: 6px;
          height: 6px;
          flex: 0 0 6px;

          border-radius: 50%;
          background: #8090a8;
        }

        .mail-status.connected
        .mail-dot {
          background: #41d9a6;

          box-shadow:
            0 0 8px
            rgba(65,217,166,0.55);
        }

        .logout-button {
          color: #ff7c91;
        }

        @media (max-width: 760px) {
          .legal-session-control {
            top: 8px;
            right: 8px;
            gap: 4px;
          }

          .legal-session-control button {
            height: 30px;
            padding: 0 8px;
            border-radius: 9px;
            font-size: 8px;
          }

          .mail-text {
            display: none;
          }

          .mail-status {
            width: 30px;
            padding: 0 !important;
          }

          .logout-button {
            padding: 0 8px !important;
          }
        }
      `}</style>
    </div>
  );
}

