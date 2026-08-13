"use client";

import LegalBrand
  from "@/components/LegalBrand";
import LegalBackButton
  from "@/components/LegalBackButton";

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
  accountId?: string;
  provider: string;
  email?: string | null;
  emailAddress?: string | null;
  displayName?: string | null;
  status?: string | null;
  connectionStatus?: string | null;
  gmailTrashReady?: boolean;
  gmailReconnectRequired?: boolean;
};

type Capabilities = {
  google: boolean;
  microsoft: boolean;
  imap: boolean;
};

type MailCandidate = {
  host: string;
  port: number;
  secure: boolean;
  starttls: boolean;
};

type DiscoveryResult = {
  provider:
    | "google"
    | "microsoft"
    | "imap"
    | "unknown";
  email?: string;
  imapCandidates?: MailCandidate[];
  smtpCandidates?: MailCandidate[];
  error?: string;
};

type DiscoveryState =
  | "idle"
  | "searching"
  | "google"
  | "microsoft"
  | "imap"
  | "unknown";

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
  ] = useState<MailConnection[]>([]);

  const [
    capabilities,
    setCapabilities,
  ] = useState<Capabilities>({
    google: false,
    microsoft: false,
    imap: false,
  });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    corporateOpen,
    setCorporateOpen,
  ] = useState(false);

  const [
    discoveryEmail,
    setDiscoveryEmail,
  ] = useState("");

  const [
    discoveryState,
    setDiscoveryState,
  ] = useState<DiscoveryState>(
    "idle"
  );

  const [
    discovery,
    setDiscovery,
  ] = useState<DiscoveryResult | null>(
    null
  );

  const [password, setPassword] =
    useState("");

  const [
    advancedOpen,
    setAdvancedOpen,
  ] = useState(false);

  const [saving, setSaving] =
    useState(false);

  const [manual, setManual] =
    useState({
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

      const response = await fetch(
        "/api/mail-connection",
        {
          cache: "no-store",
        }
      );

      const data =
        await response.json();

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
        Array.isArray(data.connections)
          ? data.connections
          : []
      );

      setCapabilities({
        google: Boolean(
          data?.capabilities?.google
        ),
        microsoft: Boolean(
          data?.capabilities?.microsoft
        ),
        imap: Boolean(
          data?.capabilities?.imap
        ),
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Mail bağlantıları alınamadı."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    if (status === "authenticated") {
      const timer = window.setTimeout(
        () => {
          void loadConnections();
        },
        0
      );

      return () =>
        window.clearTimeout(timer);
    }
  }, [status, router]);

  async function findAccount() {
    try {
      setError("");
      setAdvancedOpen(false);
      setDiscovery(null);
      setDiscoveryState("searching");

      const response = await fetch(
        "/api/mail-discovery",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            email: discoveryEmail,
          }),
        }
      );

      const data =
        await response.json() as DiscoveryResult;

      if (
        !response.ok ||
        ![
          "google",
          "microsoft",
          "imap",
        ].includes(data.provider)
      ) {
        setDiscoveryState("unknown");
        setError(
          data?.error ||
          "Sunucu ayarları otomatik bulunamadı."
        );
        return;
      }

      setDiscovery(data);
      setDiscoveryEmail(
        data.email || discoveryEmail
      );
      setDiscoveryState(data.provider);
    } catch {
      setDiscoveryState("unknown");
      setError(
        "Sunucu ayarları otomatik bulunamadı."
      );
    }
  }

  async function connectImap(
    useManualSettings = false
  ) {
    try {
      setSaving(true);
      setError("");

      const payload =
        useManualSettings
          ? {
              email: discoveryEmail,
              password,
              ...manual,
            }
          : {
              email: discoveryEmail,
              password,
              discovery: {
                imapCandidates:
                  discovery
                    ?.imapCandidates || [],
                smtpCandidates:
                  discovery
                    ?.smtpCandidates || [],
              },
            };

      const response = await fetch(
        "/api/mail-connection/imap",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        data?.ok !== true
      ) {
        throw new Error(
          data?.error ||
          "Kurumsal mail bağlanamadı."
        );
      }

      setPassword("");
      setCorporateOpen(false);
      setAdvancedOpen(false);
      setDiscovery(null);
      setDiscoveryState("idle");
      await loadConnections();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Kurumsal mail bağlanamadı."
      );
    } finally {
      setSaving(false);
    }
  }

  async function connectOAuth(
    provider:
      | "google"
      | "microsoft"
  ) {
    try {
      setSaving(true);
      setError("");

      const response =
        await fetch(
          "/api/mail-connection/link-context",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                provider,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        data?.ok !== true
      ) {
        throw new Error(
          data?.error ||
          "Mail bağlantısı başlatılamadı."
        );
      }

      await signIn(
        provider === "google"
          ? "google-mail"
          : "microsoft-mail",
        {
          callbackUrl:
            "/mail-connect",
        }
      );
    } catch (connectError) {
      setError(
        connectError instanceof
          Error
          ? connectError.message
          : "Mail bağlantısı başlatılamadı."
      );
      setSaving(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="connect-page">
        Oturum kontrol ediliyor...
      </main>
    );
  }

  if (status !== "authenticated") {
    return null;
  }

  const google = connections.find(
    (item) => item.provider === "google"
  );

  const microsoft = connections.find(
    (item) => item.provider === "microsoft"
  );

  const imap = connections.find(
    (item) => item.provider === "imap"
  );

  return (
    <main className="connect-page">
      <section className="connect-shell">
        <div className="back-row">
          <LegalBackButton fallback="/settings" />
        </div>

        <header>
          <LegalBrand />
          <h1>E-posta hesapları</h1>
          <p>
            METHER Legal içinde kullanacağınız
            e-posta hesabını bağlayın.
          </p>
        </header>

        <div className="account">
          Oturum: {session?.user?.email || "—"}
        </div>

        {connections.length > 0 && (
          <section className="connected-accounts">
            <h2>Bağlı posta kutuları</h2>
            {connections.map(
              (connection) => (
                <div
                  className="connected-account"
                  key={connection.id}
                >
                  <strong>
                    {connection.displayName ||
                      connection.emailAddress ||
                      connection.email ||
                      "Posta hesabı"}
                  </strong>
                  <span>
                    {connection.emailAddress ||
                      connection.email ||
                      "—"}
                  </span>
                  <small>
                    ID: {connection.accountId ||
                      connection.id} · {connection.provider} ·{" "}
                    {connection.connectionStatus ||
                      connection.status ||
                      "connected"}
                  </small>
                  {connection.provider === "google" &&
                    connection.gmailReconnectRequired && (
                      <div className="gmail-reconnect-warning">
                        <p>
                          Gmail bağlantınızı yeni izinler için yeniden bağlamanız gerekiyor.
                        </p>
                        <button
                          type="button"
                          disabled={saving || !capabilities.google}
                          onClick={() =>
                            void connectOAuth("google")
                          }
                        >
                          Gmail&apos;i Yeniden Bağla
                        </button>
                      </div>
                    )}
                </div>
              )
            )}
          </section>
        )}

        {error && (
          <div className="error">{error}</div>
        )}

        <div className="providers">
          <button
            type="button"
            className={`provider ${
              google ? "connected" : ""
            }`}
            disabled={
              loading || saving || !capabilities.google
            }
            onClick={() =>
              void connectOAuth("google")
            }
          >
            <b>G</b>
            <div>
              <strong>Google / Gmail</strong>
              <span>
                Gmail ve Google Workspace
              </span>
              {google?.email && (
                <em>{google.email}</em>
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
              microsoft ? "connected" : ""
            }`}
            disabled={
              loading || saving || !capabilities.microsoft
            }
            onClick={() =>
              void connectOAuth("microsoft")
            }
          >
            <b>M</b>
            <div>
              <strong>Microsoft</strong>
              <span>
                Outlook, Hotmail ve Microsoft 365
              </span>
              {microsoft?.email && (
                <em>{microsoft.email}</em>
              )}
            </div>
            <small>
              {microsoft
                ? "Bağlı · Yenile"
                : capabilities.microsoft
                  ? "Bağla →"
                  : "Yapılandırma gerekli"}
            </small>
          </button>

          <button
            type="button"
            className={`provider ${
              imap ? "connected" : ""
            }`}
            disabled={
              loading || !capabilities.imap
            }
            onClick={() => {
              setCorporateOpen(
                (value) => !value
              );
              setError("");
            }}
          >
            <b>@</b>
            <div>
              <strong>Kurumsal E-posta</strong>
              <span>
                Sunucu ayarlarını otomatik bul
              </span>
              {imap?.email && (
                <em>{imap.email}</em>
              )}
            </div>
            <small>
              {imap
                ? "Bağlı · Düzenle"
                : "Bağla →"}
            </small>
          </button>
        </div>

        {corporateOpen && (
          <section className="corporate-panel">
            <h2>Kurumsal E-posta</h2>

            {discoveryState === "idle" && (
              <>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="avukat@firma.com"
                  value={discoveryEmail}
                  onChange={(event) =>
                    setDiscoveryEmail(
                      event.target.value
                    )
                  }
                />
                <button
                  type="button"
                  className="save"
                  onClick={findAccount}
                >
                  Hesabı Bul
                </button>
              </>
            )}

            {discoveryState === "searching" && (
              <p className="status-text">
                Mail sağlayıcısı aranıyor...
              </p>
            )}

            {discoveryState === "google" && (
              <>
                <p className="success-text">
                  Google Workspace algılandı
                </p>
                <button
                  type="button"
                  className="save"
                  onClick={() =>
                    void connectOAuth("google")
                  }
                >
                  Google ile Bağla
                </button>
              </>
            )}

            {discoveryState === "microsoft" && (
              <>
                <p className="success-text">
                  Microsoft 365 algılandı
                </p>
                <button
                  type="button"
                  className="save"
                  onClick={() =>
                    void connectOAuth("microsoft")
                  }
                >
                  Microsoft ile Bağla
                </button>
              </>
            )}

            {discoveryState === "imap" && (
              <>
                <p className="success-text">
                  Mail sunucusu bulundu
                </p>
                <input
                  type="email"
                  value={discoveryEmail}
                  readOnly
                  aria-label="E-posta"
                />
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Şifre / uygulama parolası"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                />
                <button
                  type="button"
                  className="save"
                  disabled={saving || !password}
                  onClick={() => connectImap(false)}
                >
                  {saving
                    ? "Bağlantı test ediliyor..."
                    : "Hesabı Bağla"}
                </button>
              </>
            )}

            {discoveryState === "unknown" && (
              <>
                <p className="status-text">
                  Sunucu ayarları otomatik bulunamadı.
                </p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setAdvancedOpen(true)
                  }
                >
                  Gelişmiş Ayarlar
                </button>
              </>
            )}

            {advancedOpen && (
              <div className="advanced-form">
                <input
                  type="email"
                  placeholder="E-posta"
                  value={discoveryEmail}
                  onChange={(event) =>
                    setDiscoveryEmail(
                      event.target.value
                    )
                  }
                />
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Şifre / uygulama parolası"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                />
                <div className="row">
                  <input
                    placeholder="IMAP sunucusu"
                    value={manual.imapHost}
                    onChange={(event) =>
                      setManual({
                        ...manual,
                        imapHost: event.target.value,
                      })
                    }
                  />
                  <input
                    inputMode="numeric"
                    placeholder="993"
                    value={manual.imapPort}
                    onChange={(event) =>
                      setManual({
                        ...manual,
                        imapPort: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="row">
                  <input
                    placeholder="SMTP sunucusu"
                    value={manual.smtpHost}
                    onChange={(event) =>
                      setManual({
                        ...manual,
                        smtpHost: event.target.value,
                      })
                    }
                  />
                  <input
                    inputMode="numeric"
                    placeholder="465"
                    value={manual.smtpPort}
                    onChange={(event) =>
                      setManual({
                        ...manual,
                        smtpPort: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="checks">
                  <label>
                    <input
                      type="checkbox"
                      checked={manual.imapSecure}
                      onChange={(event) =>
                        setManual({
                          ...manual,
                          imapSecure:
                            event.target.checked,
                          imapPort:
                            event.target.checked
                              ? "993"
                              : "143",
                        })
                      }
                    />
                    IMAP SSL
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={manual.smtpSecure}
                      onChange={(event) =>
                        setManual({
                          ...manual,
                          smtpSecure:
                            event.target.checked,
                          smtpPort:
                            event.target.checked
                              ? "465"
                              : "587",
                        })
                      }
                    />
                    SMTP SSL
                  </label>
                </div>
                <button
                  type="button"
                  className="save"
                  disabled={saving || !password}
                  onClick={() => connectImap(true)}
                >
                  {saving
                    ? "Bağlantı test ediliyor..."
                    : "Hesabı Bağla"}
                </button>
              </div>
            )}

            {discoveryState !== "idle" &&
              discoveryState !== "searching" && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setDiscoveryState("idle");
                    setDiscovery(null);
                    setAdvancedOpen(false);
                    setPassword("");
                    setError("");
                  }}
                >
                  Başka hesap ara
                </button>
              )}
          </section>
        )}

        <footer>
          <button
            type="button"
            onClick={() => router.push("/inbox")}
          >
            Mailbox&apos;a Git
          </button>
          <button
            type="button"
            onClick={() =>
              signOut({ callbackUrl: "/login" })
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
        .back-row {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 10px;
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
        .connected-accounts {
          display: grid;
          gap: 6px;
          margin-bottom: 9px;
          padding: 11px;
          border: 1px solid var(--legal-border);
          border-radius: 12px;
          background: var(--legal-surface);
        }
        .connected-accounts h2 {
          margin: 0 0 2px;
          font-size: 11px;
        }
        .connected-account {
          display: grid;
          gap: 2px;
          padding: 8px 9px;
          border: 1px solid var(--legal-border);
          border-radius: 8px;
          background: var(--legal-surface-2);
        }
        .connected-account strong {
          font-size: 10px;
        }
        .connected-account span,
        .connected-account small {
          color: var(--legal-muted);
          font-size: 8px;
          overflow-wrap: anywhere;
        }
        .gmail-reconnect-warning {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 6px;
          padding-top: 7px;
          border-top: 1px solid var(--legal-border);
        }
        .gmail-reconnect-warning p {
          margin: 0;
          color: var(--legal-gold);
          font-size: 8.5px;
          line-height: 1.45;
        }
        .gmail-reconnect-warning button {
          flex: 0 0 auto;
          min-height: 30px;
          padding: 6px 9px;
          border: 1px solid var(--legal-gold);
          border-radius: 8px;
          background: transparent;
          color: var(--legal-gold);
          cursor: pointer;
          font: inherit;
          font-size: 8px;
          font-weight: 850;
        }
        .gmail-reconnect-warning button:disabled {
          cursor: default;
          opacity: .5;
        }
        .providers {
          display: grid;
          gap: 8px;
        }
        .provider {
          min-height: 66px;
          display: grid;
          grid-template-columns: 40px minmax(0, 1fr) auto;
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
        .corporate-panel {
          display: grid;
          gap: 8px;
          margin-top: 9px;
          padding: 14px;
          border: 1px solid var(--legal-border);
          border-radius: 14px;
          background: var(--legal-surface);
        }
        .corporate-panel h2 {
          margin: 0 0 2px;
          font-size: 13px;
        }
        .corporate-panel input {
          width: 100%;
          height: 36px;
          padding: 0 10px;
          border: 1px solid var(--legal-border);
          border-radius: 8px;
          outline: 0;
          background: var(--legal-surface-2);
          color: var(--legal-text);
        }
        .advanced-form {
          display: grid;
          gap: 7px;
          margin-top: 2px;
        }
        .row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 90px;
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
        .save,
        .secondary {
          min-height: 36px;
          border-radius: 9px;
          font-weight: 850;
          cursor: pointer;
        }
        .save {
          border: 1px solid var(--legal-gold);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
        }
        .secondary {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface-2);
          color: var(--legal-text);
        }
        .save:disabled {
          opacity: .5;
          cursor: default;
        }
        .status-text,
        .success-text {
          margin: 3px 0;
          padding: 9px;
          border-radius: 8px;
          text-align: center;
          font-size: 10px;
        }
        .status-text {
          color: var(--legal-muted);
          background: var(--legal-surface-2);
        }
        .success-text {
          color: var(--legal-success);
          background: var(--legal-surface-2);
        }
        .text-button {
          justify-self: center;
          border: 0;
          background: transparent;
          color: var(--legal-muted);
          font-size: 9px;
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
            grid-template-columns: 38px minmax(0, 1fr);
          }
          .provider small {
            grid-column: 2;
          }
        }
      `}</style>
    </main>
  );
}
