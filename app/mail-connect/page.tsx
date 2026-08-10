"use client";

import {
  signIn,
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

type MailConnection = {
  id: string;
  provider: string;
  email?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

export default function MailConnectPage() {
  const router =
    useRouter();

  const {
    data: session,
    status,
  } = useSession();

  const [
    connections,
    setConnections,
  ] = useState<
    MailConnection[]
  >([]);

  const [
    loadingConnections,
    setLoadingConnections,
  ] = useState(true);

  const [
    connectionError,
    setConnectionError,
  ] = useState("");

  useEffect(() => {
    if (
      status === "unauthenticated"
    ) {
      router.replace("/login");
      return;
    }

    if (
      status !== "authenticated"
    ) {
      return;
    }

    let active = true;

    async function loadConnections() {
      try {
        setLoadingConnections(true);
        setConnectionError("");

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

        if (
          !response.ok ||
          data?.ok !== true
        ) {
          throw new Error(
            data?.error ||
              "Mail bağlantıları alınamadı."
          );
        }

        setConnections(
          Array.isArray(
            data.connections
          )
            ? data.connections
            : []
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setConnections([]);

        setConnectionError(
          error instanceof Error
            ? error.message
            : "Mail bağlantıları alınamadı."
        );
      } finally {
        if (active) {
          setLoadingConnections(false);
        }
      }
    }

    loadConnections();

    return () => {
      active = false;
    };
  }, [
    status,
    router,
  ]);

  if (
    status === "loading"
  ) {
    return (
      <main className="connect-page">
        <div className="connect-loading">
          Oturum kontrol ediliyor...
        </div>
      </main>
    );
  }

  if (
    status !== "authenticated"
  ) {
    return null;
  }

  const googleConnection =
    connections.find(
      (item) =>
        item.provider ===
          "google" &&
        item.status ===
          "connected"
    );

  const googleConnected =
    Boolean(
      googleConnection
    );

  async function connectGoogle() {
    await signIn(
      "google-mail",
      {
        callbackUrl:
          "/calendar",
      }
    );
  }

  return (
    <main className="connect-page">
      <style jsx>{`
        .connect-page {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 18px;
          background:
            radial-gradient(
              circle at 50% 12%,
              rgba(
                91,
                88,
                255,
                0.14
              ),
              transparent 32%
            ),
            #060b18;
          color: white;
        }

        .connect-shell {
          width: min(
            620px,
            100%
          );
        }

        .connect-header {
          margin-bottom: 18px;
          text-align: center;
        }

        .connect-kicker {
          margin-bottom: 7px;
          color: #66a4ff;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.18em;
        }

        h1 {
          margin: 0;
          font-size: 24px;
        }

        .connect-header p {
          margin:
            9px
            auto
            0;
          max-width: 460px;
          color: #8294b0;
          font-size: 11px;
          line-height: 1.55;
        }

        .account {
          margin-bottom: 10px;
          padding: 10px 13px;
          border: 1px solid #20304a;
          border-radius: 12px;
          background: #0b1423;
          color: #8ea2bf;
          font-size: 10px;
          text-align: center;
        }

        .providers {
          display: grid;
          gap: 8px;
        }

        .provider {
          width: 100%;
          min-height: 64px;
          display: grid;
          grid-template-columns:
            40px
            minmax(0, 1fr)
            auto;
          align-items: center;
          gap: 11px;
          padding: 10px 13px;
          border: 1px solid #22324b;
          border-radius: 15px;
          background: #0e1829;
          color: white;
          text-align: left;
        }

        button.provider {
          cursor: pointer;
        }

        button.provider:hover {
          border-color:
            #675cff;
          background:
            #121d32;
        }

        .provider.connected {
          border-color:
            rgba(
              65,
              217,
              166,
              0.38
            );

          background:
            rgba(
              65,
              217,
              166,
              0.055
            );
        }

        .provider-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border: 1px solid #283a56;
          border-radius: 11px;
          background: #111d30;
          font-size: 16px;
          font-weight: 900;
        }

        .provider strong {
          display: block;
          margin-bottom: 3px;
          font-size: 11px;
        }

        .provider span {
          color: #7187a7;
          font-size: 9px;
          line-height: 1.4;
        }

        .provider-action {
          color:
            #9aaeff !important;
          font-size:
            9px !important;
          font-weight: 900;
          white-space: nowrap;
        }

        .provider.connected
        .provider-action {
          color:
            #63d6b0 !important;
        }

        .connection-email {
          margin-top: 3px;
          color:
            #63d6b0 !important;
        }

        .disabled {
          opacity: 0.48;
          cursor: default;
        }

        .connection-error {
          margin-bottom: 10px;
          padding: 9px 11px;
          border: 1px solid
            rgba(
              255,
              89,
              115,
              0.25
            );
          border-radius: 10px;
          background:
            rgba(
              255,
              89,
              115,
              0.06
            );
          color: #ff8296;
          font-size: 9px;
          text-align: center;
        }

        .footer-actions {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 14px;
        }

        .footer-button {
          height: 34px;
          padding: 0 12px;
          border: 1px solid #273852;
          border-radius: 10px;
          background: transparent;
          color: #8295b3;
          cursor: pointer;
          font-size: 9px;
          font-weight: 800;
        }

        .connect-loading {
          color: #8ca0bd;
          font-size: 11px;
        }

        @media (
          max-width: 500px
        ) {
          .connect-page {
            align-items: start;
            padding:
              36px
              12px
              20px;
          }

          h1 {
            font-size: 21px;
          }

          .provider {
            min-height: 62px;
            grid-template-columns:
              38px
              minmax(0, 1fr)
              auto;
            padding: 9px 10px;
          }
        }
      `}</style>

      <section className="connect-shell">
        <header className="connect-header">
          <div className="connect-kicker">
            AL METHER LEGAL
          </div>

          <h1>
            E-posta hesabını bağla
          </h1>

          <p>
            Hukuki bildirimleri ve dava
            e-postalarını algılayabilmemiz
            için kullandığınız e-posta
            hesabını bağlayın.
          </p>
        </header>

        <div className="account">
          Giriş yapılan hesap:{" "}
          {session?.user?.email ||
            "—"}
        </div>

        {connectionError && (
          <div className="connection-error">
            {connectionError}
          </div>
        )}

        <div className="providers">
          <button
            type="button"
            className={`provider ${
              googleConnected
                ? "connected"
                : ""
            }`}
            disabled={
              loadingConnections
            }
            onClick={
              connectGoogle
            }
          >
            <div className="provider-icon">
              G
            </div>

            <div>
              <strong>
                Google / Gmail
              </strong>

              <span>
                Gmail veya Google Workspace
                hesabınızı bağlayın.
              </span>

              {googleConnection?.email && (
                <span className="connection-email">
                  {googleConnection.email}
                </span>
              )}
            </div>

            <span className="provider-action">
              {loadingConnections
                ? "Kontrol..."
                : googleConnected
                  ? "Bağlı · Yenile"
                  : "Bağla →"}
            </span>
          </button>

          <div className="provider disabled">
            <div className="provider-icon">
              M
            </div>

            <div>
              <strong>
                Microsoft
              </strong>

              <span>
                Outlook, Hotmail veya
                Microsoft 365.
              </span>
            </div>

            <span className="provider-action">
              Hazırlanıyor
            </span>
          </div>

          <div className="provider disabled">
            <div className="provider-icon">
              @
            </div>

            <div>
              <strong>
                Diğer E-posta
              </strong>

              <span>
                Kurumsal domain ve
                IMAP hesapları.
              </span>
            </div>

            <span className="provider-action">
              Hazırlanıyor
            </span>
          </div>
        </div>

        <div className="footer-actions">
          {googleConnected && (
            <button
              type="button"
              className="footer-button"
              onClick={() =>
                router.push(
                  "/calendar"
                )
              }
            >
              Takvime Git
            </button>
          )}

          <button
            type="button"
            className="footer-button"
            onClick={() =>
              signOut({
                callbackUrl:
                  "/login",
              })
            }
          >
            Çıkış
          </button>
        </div>
      </section>
    </main>
  );
}
