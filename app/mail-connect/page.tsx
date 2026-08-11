"use client";

import LegalBrand
  from "@/components/LegalBrand";

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
};

type Capabilities = {
  google: boolean;
  microsoft: boolean;
  imap: boolean;
};

export default function MailConnectPage() {
  const router =
    useRouter();

  const {
    data: session,
    status,
  } =
    useSession();

  const [
    connections,
    setConnections,
  ] =
    useState<
      MailConnection[]
    >([]);

  const [
    capabilities,
    setCapabilities,
  ] =
    useState<Capabilities>({
      google: false,
      microsoft: false,
      imap: false,
    });

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    imapOpen,
    setImapOpen,
  ] =
    useState(false);

  const [
    imapSaving,
    setImapSaving,
  ] =
    useState(false);

  const [
    imapForm,
    setImapForm,
  ] =
    useState({
      email: "",
      password: "",

      imapHost: "",
      imapPort: "993",
      imapSecure: true,

      smtpHost: "",
      smtpPort: "465",
      smtpSecure: true,
    });

  async function loadConnections() {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch(
          "/api/mail-connection",
          {
            cache:
              "no-store",
          }
        );

      const data =
        await response
          .json();

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

      setCapabilities({
        google:
          Boolean(
            data
              ?.capabilities
              ?.google
          ),

        microsoft:
          Boolean(
            data
              ?.capabilities
              ?.microsoft
          ),

        imap:
          Boolean(
            data
              ?.capabilities
              ?.imap
          ),
      });
    } catch (
      loadError
    ) {
      setError(
        loadError instanceof
        Error
          ? loadError.message
          : "Mail bağlantıları alınamadı."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (
      status ===
      "unauthenticated"
    ) {
      router.replace(
        "/login"
      );

      return;
    }

    if (
      status ===
      "authenticated"
    ) {
      loadConnections();
    }
  }, [
    status,
    router,
  ]);

  if (
    status ===
    "loading"
  ) {
    return (
      <main className="connect-page">
        Oturum kontrol ediliyor...
      </main>
    );
  }

  if (
    status !==
    "authenticated"
  ) {
    return null;
  }

  const google =
    connections.find(
      (
        item
      ) =>
        item.provider ===
        "google"
    );

  const microsoft =
    connections.find(
      (
        item
      ) =>
        item.provider ===
        "microsoft"
    );

  const imap =
    connections.find(
      (
        item
      ) =>
        item.provider ===
        "imap"
    );

  async function saveImap() {
    try {
      setImapSaving(true);
      setError("");

      const response =
        await fetch(
          "/api/mail-connection/imap",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                ...imapForm,

                imapPort:
                  Number(
                    imapForm.imapPort
                  ),

                smtpPort:
                  Number(
                    imapForm.smtpPort
                  ),
              }),
          }
        );

      const data =
        await response
          .json();

      if (
        !response.ok ||
        data?.ok !== true
      ) {
        throw new Error(
          data?.error ||
          "Bağlantı kurulamadı."
        );
      }

      setImapOpen(false);

      setImapForm({
        email: "",
        password: "",

        imapHost: "",
        imapPort: "993",
        imapSecure: true,

        smtpHost: "",
        smtpPort: "465",
        smtpSecure: true,
      });

      await loadConnections();
    } catch (
      saveError
    ) {
      setError(
        saveError instanceof
        Error
          ? saveError.message
          : "Kurumsal mail bağlanamadı."
      );
    } finally {
      setImapSaving(false);
    }
  }

  return (
    <main className="connect-page">
      <section className="connect-shell">
        <header>
          <LegalBrand />

          <h1>
            E-posta hesapları
          </h1>

          <p>
            METHER Legal içinde
            kullanacağınız e-posta
            hesabını bağlayın.
          </p>
        </header>

        <div className="account">
          Oturum:{" "}
          {session
            ?.user
            ?.email ||
          "—"}
        </div>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <div className="providers">
          <button
            type="button"
            className={`provider ${
              google
                ? "connected"
                : ""
            }`}
            disabled={
              loading ||
              !capabilities.google
            }
            onClick={() =>
              signIn(
                "google-mail",
                {
                  callbackUrl:
                    "/mail-connect",
                }
              )
            }
          >
            <b>G</b>

            <div>
              <strong>
                Google / Gmail
              </strong>

              <span>
                Gmail ve Google
                Workspace
              </span>

              {google?.email && (
                <em>
                  {google.email}
                </em>
              )}
            </div>

            <small>
              {google
                ? "Bağlı · Yenile"
                : capabilities.google
                  ? "Bağla →"
                  : "Yapılandırma gerekli"}
            </small>
          </button>

          <button
            type="button"
            className={`provider ${
              microsoft
                ? "connected"
                : ""
            }`}
            disabled={
              loading ||
              !capabilities
                .microsoft
            }
            onClick={() =>
              signIn(
                "microsoft-mail",
                {
                  callbackUrl:
                    "/mail-connect",
                }
              )
            }
          >
            <b>M</b>

            <div>
              <strong>
                Microsoft
              </strong>

              <span>
                Outlook, Hotmail
                ve Microsoft 365
              </span>

              {microsoft
                ?.email && (
                <em>
                  {
                    microsoft.email
                  }
                </em>
              )}
            </div>

            <small>
              {microsoft
                ? "Bağlı · Yenile"
                : capabilities
                    .microsoft
                  ? "Bağla →"
                  : "Yapılandırma gerekli"}
            </small>
          </button>

          <button
            type="button"
            className={`provider ${
              imap
                ? "connected"
                : ""
            }`}
            disabled={
              loading ||
              !capabilities.imap
            }
            onClick={() =>
              setImapOpen(
                (
                  value
                ) => !value
              )
            }
          >
            <b>@</b>

            <div>
              <strong>
                Kurumsal E-posta
              </strong>

              <span>
                IMAP + SMTP
              </span>

              {imap?.email && (
                <em>
                  {imap.email}
                </em>
              )}
            </div>

            <small>
              {imap
                ? "Bağlı · Düzenle"
                : "Bağla →"}
            </small>
          </button>
        </div>

        {imapOpen && (
          <div className="imap-form">
            <input
              type="email"
              placeholder="E-posta"
              value={
                imapForm.email
              }
              onChange={(
                event
              ) =>
                setImapForm({
                  ...imapForm,
                  email:
                    event
                      .target
                      .value,
                })
              }
            />

            <input
              type="password"
              placeholder="Şifre / uygulama parolası"
              value={
                imapForm.password
              }
              onChange={(
                event
              ) =>
                setImapForm({
                  ...imapForm,
                  password:
                    event
                      .target
                      .value,
                })
              }
            />

            <div className="row">
              <input
                placeholder="IMAP sunucusu"
                value={
                  imapForm.imapHost
                }
                onChange={(
                  event
                ) =>
                  setImapForm({
                    ...imapForm,
                    imapHost:
                      event
                        .target
                        .value,
                  })
                }
              />

              <input
                placeholder="993"
                value={
                  imapForm.imapPort
                }
                onChange={(
                  event
                ) =>
                  setImapForm({
                    ...imapForm,
                    imapPort:
                      event
                        .target
                        .value,
                  })
                }
              />
            </div>

            <div className="row">
              <input
                placeholder="SMTP sunucusu"
                value={
                  imapForm.smtpHost
                }
                onChange={(
                  event
                ) =>
                  setImapForm({
                    ...imapForm,
                    smtpHost:
                      event
                        .target
                        .value,
                  })
                }
              />

              <input
                placeholder="465"
                value={
                  imapForm.smtpPort
                }
                onChange={(
                  event
                ) =>
                  setImapForm({
                    ...imapForm,
                    smtpPort:
                      event
                        .target
                        .value,
                  })
                }
              />
            </div>

            <div className="checks">
              <label>
                <input
                  type="checkbox"
                  checked={
                    imapForm
                      .imapSecure
                  }
                  onChange={(
                    event
                  ) =>
                    setImapForm({
                      ...imapForm,
                      imapSecure:
                        event
                          .target
                          .checked,
                    })
                  }
                />
                IMAP SSL
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={
                    imapForm
                      .smtpSecure
                  }
                  onChange={(
                    event
                  ) =>
                    setImapForm({
                      ...imapForm,
                      smtpSecure:
                        event
                          .target
                          .checked,
                    })
                  }
                />
                SMTP SSL
              </label>
            </div>

            <button
              type="button"
              className="save"
              disabled={
                imapSaving
              }
              onClick={
                saveImap
              }
            >
              {imapSaving
                ? "Bağlantı test ediliyor..."
                : "Bağlantıyı Test Et ve Kaydet"}
            </button>
          </div>
        )}

        <footer>
          <button
            type="button"
            onClick={() =>
              router.push(
                "/inbox"
              )
            }
          >
            Mailbox'a Git
          </button>

          <button
            type="button"
            onClick={() =>
              signOut({
                callbackUrl:
                  "/login",
              })
            }
          >
            Çıkış
          </button>
        </footer>
      </section>

      <style jsx>{`
        .connect-page {
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: 20px;
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .connect-shell {
          width: min(680px, 100%);
        }

        header {
          display: grid;
          justify-items: center;
          margin-bottom: 16px;
          text-align: center;
        }

        h1 {
          margin: 12px 0 4px;
          font-size: 23px;
        }

        header p {
          margin: 0;
          color: var(--legal-muted);
          font-size: 10px;
        }

        .account,
        .error {
          margin-bottom: 9px;
          padding: 9px 12px;
          border: 1px solid var(--legal-border);
          border-radius: 10px;
          text-align: center;
          font-size: 9px;
        }

        .account {
          color: var(--legal-muted);
          background: var(--legal-surface-2);
        }

        .error {
          color: var(--legal-danger);
        }

        .providers {
          display: grid;
          gap: 8px;
        }

        .provider {
          min-height: 66px;
          display: grid;
          grid-template-columns:
            40px
            minmax(0, 1fr)
            auto;
          align-items: center;
          gap: 11px;
          padding: 10px 12px;
          border: 1px solid var(--legal-border);
          border-radius: 14px;
          background: var(--legal-surface);
          color: var(--legal-text);
          text-align: left;
          cursor: pointer;
        }

        .provider:disabled {
          opacity: .5;
          cursor: default;
        }

        .provider.connected {
          border-color: var(--legal-success);
        }

        .provider b {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border: 1px solid var(--legal-border);
          border-radius: 10px;
          background: var(--legal-surface-2);
          font-size: 15px;
        }

        .provider strong,
        .provider span,
        .provider em {
          display: block;
        }

        .provider strong {
          font-size: 11px;
        }

        .provider span {
          margin-top: 2px;
          color: var(--legal-muted);
          font-size: 8.5px;
        }

        .provider em {
          margin-top: 3px;
          color: var(--legal-success);
          font-size: 8px;
          font-style: normal;
        }

        .provider small {
          color: var(--legal-gold);
          font-size: 8px;
          font-weight: 850;
        }

        .imap-form {
          display: grid;
          gap: 7px;
          margin-top: 9px;
          padding: 12px;
          border: 1px solid var(--legal-border);
          border-radius: 14px;
          background: var(--legal-surface);
        }

        .imap-form input {
          width: 100%;
          height: 34px;
          padding: 0 10px;
          border: 1px solid var(--legal-border);
          border-radius: 8px;
          outline: 0;
          background: var(--legal-surface-2);
          color: var(--legal-text);
        }

        .row {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            90px;
          gap: 7px;
        }

        .checks {
          display: flex;
          gap: 16px;
          color: var(--legal-muted);
          font-size: 9px;
        }

        .checks label {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .checks input {
          width: auto;
          height: auto;
        }

        .save {
          height: 36px;
          border: 1px solid var(--legal-gold);
          border-radius: 9px;
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
          font-weight: 850;
          cursor: pointer;
        }

        footer {
          display: flex;
          justify-content: center;
          gap: 7px;
          margin-top: 12px;
        }

        footer button {
          height: 34px;
          padding: 0 12px;
          border: 1px solid var(--legal-border);
          border-radius: 9px;
          background: var(--legal-surface-2);
          color: var(--legal-text-soft);
          cursor: pointer;
        }

        @media (max-width: 600px) {
          .connect-page {
            align-items: start;
            padding: 38px 12px 20px;
          }

          .provider {
            grid-template-columns:
              38px
              minmax(0, 1fr);
          }

          .provider small {
            grid-column: 2;
          }
        }
      `}</style>
    </main>
  );
}
