"use client";

import LegalBackButton from "@/components/LegalBackButton";

import LegalBrand from "@/components/LegalBrand";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { useSession } from "next-auth/react";

import LegalDock from "@/components/LegalDock";
import LegalSessionControl from "@/components/LegalSessionControl";
import PasswordUpdateForm from "@/components/PasswordUpdateForm";
import { markSafeAppNavigation } from "@/lib/navigation/backNavigation";

type Theme =
  | "dark"
  | "light";

type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  status?: string | null;
  created_at?: string;
};

type AdminNotification = {
  id: string;
  message: string;
  metadata?: {
    pendingUserId?: string;
    target?: string;
  } | null;
  created_at?: string;
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const [mobileSection, setMobileSection] = useState("");

  useEffect(() => {
    const syncSection = () => {
      if (window.location.hash === "#user-management") setMobileSection("users");
    };
    syncSection();
    window.addEventListener("hashchange", syncSection);
    return () => window.removeEventListener("hashchange", syncSection);
  }, []);

  const [theme, setTheme] =
    useState<Theme>("light");

  const [users, setUsers] =
    useState<AdminUser[]>([]);

  const [adminNotifications, setAdminNotifications] =
    useState<AdminNotification[]>([]);

  const [adminMode, setAdminMode] =
    useState(false);

  const [loadingUsers, setLoadingUsers] =
    useState(true);

  const [userError, setUserError] =
    useState("");

  const [changingId, setChangingId] =
    useState("");

  const [inviteName, setInviteName] =
    useState("");

  const [inviteEmail, setInviteEmail] =
    useState("");

  const [inviting, setInviting] =
    useState(false);

  const [inviteMessage, setInviteMessage] =
    useState("");

  useEffect(() => {
    const saved =
      window.localStorage.getItem(
        "legal-theme"
      );

    const initial: Theme =
      saved === "dark"
        ? "dark"
        : "light";

    setTheme(initial);

    document.documentElement
      .classList.toggle(
        "dark",
        initial === "dark"
      );
  }, []);

  useEffect(() => {
    loadUsers();
  }, []);

  function applyTheme(
    next: Theme
  ) {
    setTheme(next);

    window.localStorage.setItem(
      "legal-theme",
      next
    );

    document.documentElement
      .classList.toggle(
        "dark",
        next === "dark"
      );

    document.documentElement
      .setAttribute(
        "data-legal-theme",
        next
      );

    window.dispatchEvent(
      new CustomEvent(
        "legal-theme-change",
        {
          detail: {
            theme: next,
          },
        }
      )
    );
  }

  async function loadUsers() {
    try {
      setLoadingUsers(true);
      setUserError("");

      const response =
        await fetch(
          "/api/admin/users",
          {
            cache: "no-store",
          }
        );

      if (response.status === 403) {
        setAdminMode(false);
        setUsers([]);
        return;
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Kullanıcılar alınamadı."
        );
      }

      setAdminMode(true);

      setUsers(
        Array.isArray(
          data?.users
        )
          ? data.users
          : []
      );

      setAdminNotifications(
        Array.isArray(data?.notifications) ? data.notifications : []
      );
    } catch (error) {
      setAdminMode(false);

      setUserError(
        error instanceof Error
          ? error.message
          : "Kullanıcılar alınamadı."
      );
    } finally {
      setLoadingUsers(false);
    }
  }

  async function changeUserStatus(
    user: AdminUser,
    nextStatus?: "active" | "inactive" | "rejected"
  ) {
    const targetStatus =
      nextStatus ||
      (user.status === "active" ? "inactive" : "active");

    try {
      setChangingId(user.id);
      setUserError("");

      const response =
        await fetch(
          "/api/admin/users",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              userId: user.id,
              status: targetStatus,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Kullanıcı durumu güncellenemedi."
        );
      }

      setUsers(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              data.user.id
                ? data.user
                : item
          )
      );
    } catch (error) {
      setUserError(
        error instanceof Error
          ? error.message
          : "Kullanıcı durumu güncellenemedi."
      );
    } finally {
      setChangingId("");
    }
  }

  async function deleteUser(
    user: AdminUser
  ) {
    const confirmed =
      window.confirm(
        "Bu kullanıcı kalıcı olarak silinecek. Devam edilsin mi?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setChangingId(user.id);
      setUserError("");

      const response =
        await fetch(
          "/api/admin/users",
          {
            method: "DELETE",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              userId: user.id,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Kullanıcı silinemedi."
        );
      }

      setUsers(
        (current) =>
          current.filter(
            (item) =>
              item.id !== user.id
          )
      );

      setAdminNotifications(
        (current) =>
          current.filter(
            (notification) =>
              notification.metadata
                ?.pendingUserId !==
              user.id
          )
      );
    } catch (error) {
      setUserError(
        error instanceof Error
          ? error.message
          : "Kullanıcı silinemedi."
      );
    } finally {
      setChangingId("");
    }
  }

  async function inviteUser(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setUserError("");
    setInviteMessage("");
    setInviting(true);

    try {
      const response =
        await fetch(
          "/api/admin/users",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name: inviteName,
              email: inviteEmail,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Kullanıcı davet edilemedi."
        );
      }

      setUsers((current) => [
        data.user,
        ...current,
      ]);
      setInviteName("");
      setInviteEmail("");
      setInviteMessage(
        "Davet e-postası gönderildi. Kullanıcı onay bekliyor."
      );
    } catch (error) {
      setUserError(
        error instanceof Error
          ? error.message
          : "Kullanıcı davet edilemedi."
      );
    } finally {
      setInviting(false);
    }
  }

  return (
    <main className="legal-app settings-page" data-mobile-section={mobileSection}>
      <div className="settings-back">
        <LegalBackButton fallback="/" />
      </div>

      <header className="settings-header">
        <div className="settings-brand">
          <LegalBrand compact />

          <h1>
            Ayarlar
          </h1>
        </div>
      </header>

      <section className="settings-grid">
        <nav className="mobile-settings-list" aria-label="Ayar bölümleri">
          {[
            ["account", "Hesap"], ["appearance", "Görünüm"], ["mail", "Mail"],
            ["notifications", "Bildirimler"], ["security", "Güvenlik"],
            ...(adminMode ? [["users", "Kullanıcı Yönetimi"]] : []),
          ].map(([id, label]) => (
            <button type="button" key={id} onClick={() => setMobileSection(id)}>{label}<span aria-hidden="true">›</span></button>
          ))}
        </nav>
        {mobileSection && <button type="button" className="mobile-settings-back" onClick={() => setMobileSection("")}>← Ayarlar</button>}
        <section className={`mobile-notification-settings ${mobileSection === "notifications" ? "mobile-section-active" : ""}`}>
          <h2>Bildirimler</h2>
          <p>Dava, süre ve e-posta bildirimlerinizi bildirim merkezinden görüntüleyin.</p>
          <button type="button" onClick={() => window.dispatchEvent(new Event("al-mether-open-notifications"))}>Bildirimleri görüntüle</button>
          <p>Cihazın bildirim izinlerini tarayıcı veya işletim sistemi ayarlarından yönetebilirsiniz.</p>
        </section>
        <div className="settings-column settings-column-left">
          <div className={`settings-panel ${mobileSection === "appearance" ? "mobile-section-active" : ""}`}>
          <div className="settings-section-title">
            Görünüm
          </div>

          <p>
            Uygulamanın temasını seçin.
          </p>

          <div className="theme-options">
            <button
              type="button"
              className={
                theme === "dark"
                  ? "theme-option active"
                  : "theme-option"
              }
              onClick={() =>
                applyTheme("dark")
              }
            >
              <strong>
                Koyu
              </strong>

              <span>
                Koyu arayüz
              </span>
            </button>

            <button
              type="button"
              className={
                theme === "light"
                  ? "theme-option active"
                  : "theme-option"
              }
              onClick={() =>
                applyTheme("light")
              }
            >
              <strong>
                Açık
              </strong>

              <span>
                Açık arayüz
              </span>
            </button>
          </div>
          </div>

          <div className={`settings-panel ${mobileSection === "mail" ? "mobile-section-active" : ""}`}>
          <div className="settings-section-title">
            E-posta
          </div>

          <p>
            Hukuki bildirimlerin okunacağı hesabı yönetin.
          </p>

          <a
            href="/mail-connect"
            className="settings-link"
            onClick={() =>
              markSafeAppNavigation("/mail-connect")
            }
          >
            Mail bağlantısını yönet
          </a>
          </div>

          <div className={`settings-panel security-panel ${mobileSection === "security" ? "mobile-section-active" : ""}`}>
          <div className="settings-section-title">
            Güvenlik
          </div>

          <p>
            Mevcut oturumunuz için yeni bir şifre belirleyin.
          </p>

          <div className="password-settings-form">
            <PasswordUpdateForm
              buttonLabel="Şifreyi Güncelle"
              noSessionMessage="Şifre değiştirmek için çıkış yapıp yeniden giriş yapın."
            />
          </div>
          </div>
        </div>

        <div className="settings-column settings-column-right">
          <div className={`settings-panel account-panel ${mobileSection === "account" ? "mobile-section-active" : ""}`}>
            <div className="settings-section-title">
              Hesap
            </div>

            <div className="account-summary">
              <div className="account-avatar" aria-hidden="true">
                {(session?.user?.name || session?.user?.email || "A")
                  .trim()
                  .charAt(0)
                  .toLocaleUpperCase("tr-TR")}
              </div>

              <div className="account-copy">
                <strong>{session?.user?.name || "AL METHER Legal kullanıcısı"}</strong>
                <span>{session?.user?.email || "Oturum bilgisi yükleniyor"}</span>
              </div>

              <span className="account-status">Aktif oturum</span>
            </div>
          </div>

        {adminMode && (
          <div
            className={`settings-panel admin-panel ${mobileSection === "users" ? "mobile-section-active" : ""}`}
            id="user-management"
          >
            <div className="admin-head">
              <div>
                <div className="settings-section-title">
                  Kullanıcı Yönetimi
                </div>

                <p>
                  AL Mether Legal kullanıcılarını yönetin.
                </p>
              </div>

              <span>
                {users.length}
                {" "}kullanıcı
              </span>
            </div>

            {userError && (
              <div className="user-error">
                {userError}
              </div>
            )}

            <form
              className="invite-form"
              onSubmit={inviteUser}
            >
              <input
                type="text"
                value={inviteName}
                onChange={(event) =>
                  setInviteName(
                    event.target.value
                  )
                }
                placeholder="Ad Soyad"
                autoComplete="name"
                required
              />

              <input
                type="email"
                value={inviteEmail}
                onChange={(event) =>
                  setInviteEmail(
                    event.target.value
                  )
                }
                placeholder="E-posta"
                autoComplete="email"
                required
              />

              <button
                type="submit"
                disabled={inviting}
              >
                {inviting
                  ? "Gönderiliyor..."
                  : "Kullanıcı Davet Et"}
              </button>
            </form>

            {inviteMessage && (
              <div className="invite-success">
                {inviteMessage}
              </div>
            )}

            {adminNotifications.length > 0 && (
              <div className="admin-notifications">
                {adminNotifications.map((notification) => (
                  <a
                    key={notification.id}
                    href={notification.metadata?.target || "#user-management"}
                  >
                    {notification.message}
                  </a>
                ))}
              </div>
            )}

            {loadingUsers ? (
              <div className="user-empty">
                Kullanıcılar yükleniyor...
              </div>
            ) : users.length === 0 ? (
              <div className="user-empty">
                Kullanıcı bulunamadı.
              </div>
            ) : (
              <div className="users-list">
                {users.map(
                  (user) => (
                    <div
                      key={user.id}
                      className="user-row"
                    >
                      <div className="user-main">
                        <strong>
                          {user.name ||
                            "İsimsiz kullanıcı"}
                        </strong>

                        <span>
                          {user.email}
                        </span>
                      </div>

                      <div className="user-role">
                        {user.role ===
                        "admin"
                          ? "Yönetici"
                          : "Avukat"}
                      </div>

                      <div
                        className={
                          user.status ===
                          "active"
                            ? "user-status active"
                            : user.status === "pending" ||
                                user.status === "pending_approval"
                              ? "user-status pending"
                            : "user-status passive"
                        }
                      >
                        {user.status ===
                        "active"
                          ? "Aktif"
                          : user.status === "pending" ||
                              user.status === "pending_approval"
                            ? "Onay Bekliyor"
                            : user.status === "rejected"
                              ? "Reddedildi"
                              : "Pasif"}
                      </div>

                      <div className="user-actions">
                        <button
                          type="button"
                          className="status-button"
                          disabled={changingId === user.id || user.role === "admin"}
                          onClick={() => changeUserStatus(user)}
                        >
                          {changingId === user.id
                            ? "Kaydediliyor..."
                            : user.role === "admin"
                              ? "Yönetici"
                              : user.status === "active"
                                ? "Pasif Yap"
                                : "Aktif Et"}
                        </button>

                        {(user.status === "pending" ||
                          user.status === "pending_approval") && (
                          <button
                            type="button"
                            className="status-button reject"
                            disabled={changingId === user.id}
                            onClick={() => changeUserStatus(user, "rejected")}
                          >
                            Reddet
                          </button>
                        )}

                        {user.role !== "admin" &&
                          (user.status === "pending" ||
                            user.status === "pending_approval" ||
                            user.status === "rejected" ||
                            user.status === "inactive") && (
                            <button
                              type="button"
                              className="status-button delete"
                              disabled={changingId === user.id}
                              onClick={() => deleteUser(user)}
                            >
                              {changingId === user.id
                                ? "Siliniyor..."
                                : "Sil"}
                            </button>
                          )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </section>

      <LegalSessionControl />
      <LegalDock />

      <style jsx>{`
        .settings-page {
          min-height: 100dvh;

          padding:
            14px 18px 82px;
        }

        .settings-header {
          min-height: 48px;

          display: flex;
          align-items: center;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .settings-header span {
          display: block;

          margin-bottom: 2px;

          color:
            var(--legal-gold);

          font-size: 7px;
          font-weight: 900;
          letter-spacing:
            0.16em;
        }

        .settings-header h1 {
          margin: 0;

          font-size: 15px;
        }

        .settings-grid {
          width:
            min(
              980px,
              100%
            );

          display: grid;
          gap: 9px;

          margin-top: 12px;
        }

        .settings-panel {
          padding: 14px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-lg);

          background:
            var(--legal-surface);

          box-shadow:
            var(--legal-shadow-sm);
        }

        .settings-column {
          min-width: 0;
          min-height: 0;
          display: grid;
          gap: 9px;
        }

        .account-summary {
          min-width: 0;
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
          padding: 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface-2);
        }

        .account-avatar {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border: 1px solid var(--legal-gold);
          border-radius: 12px;
          background: var(--legal-gold-soft);
          color: var(--legal-gold-dark);
          font-size: 14px;
          font-weight: 900;
        }

        .account-copy {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .account-copy strong,
        .account-copy span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .account-copy strong {
          font-size: 10px;
        }

        .account-copy span {
          color: var(--legal-muted);
          font-size: 8px;
        }

        .account-status {
          color: var(--legal-success);
          font-size: 8px;
          font-weight: 850;
          white-space: nowrap;
        }

        .settings-section-title {
          font-size: 11px;
          font-weight: 850;
        }

        .settings-panel p {
          margin:
            4px 0 12px;

          color:
            var(--legal-muted);

          font-size: 9px;
        }

        .theme-options {
          display: grid;

          grid-template-columns:
            repeat(
              2,
              minmax(0, 1fr)
            );

          gap: 8px;
        }

        .theme-option {
          min-height: 70px;

          display: grid;
          align-content: center;

          gap: 3px;

          padding: 12px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-md);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text);

          text-align: left;

          cursor: pointer;
        }

        .theme-option.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow:
            inset 3px 0 0
            var(--legal-gold);
        }

        .theme-option strong {
          font-size: 10px;
        }

        .theme-option span {
          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .settings-link {
          height: 32px;

          display:
            inline-flex;

          align-items: center;

          padding:
            0 11px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          text-decoration: none;

          font-size: 8.5px;
          font-weight: 800;
        }

        .settings-link:hover {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);
        }

        .password-settings-form {
          width: min(360px, 100%);
        }

        .admin-panel {
          min-width: 0;
        }

        .admin-head {
          display: flex;
          align-items: center;
          justify-content:
            space-between;

          gap: 12px;
        }

        .admin-head > span {
          color:
            var(--legal-gold);

          font-size: 8px;
          font-weight: 850;
        }

        .users-list {
          display: grid;
          gap: 5px;
        }

        .invite-form {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            minmax(0, 1fr)
            auto;
          gap: 7px;
          margin-bottom: 10px;
        }

        .invite-form input,
        .invite-form button {
          min-width: 0;
          height: 34px;
          padding: 0 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text);
          font: inherit;
          font-size: 8.5px;
        }

        .invite-form input:focus {
          border-color: var(--legal-gold);
          outline: none;
        }

        .invite-form button {
          background: var(--legal-gold-soft);
          color: var(--legal-gold);
          cursor: pointer;
          font-weight: 850;
        }

        .invite-form button:disabled {
          cursor: wait;
          opacity: 0.55;
        }

        .invite-success {
          margin-bottom: 8px;
          color: var(--legal-success);
          font-size: 8.5px;
        }

        .user-row {
          min-height: 48px;

          display: grid;

          grid-template-columns:
            minmax(
              0,
              1fr
            )
            80px
            72px
            90px;

          align-items: center;

          gap: 8px;

          padding:
            7px 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-md);

          background:
            var(--legal-surface-2);
        }

        .user-main {
          min-width: 0;

          display: grid;
          gap: 2px;
        }

        .user-main strong {
          overflow: hidden;

          text-overflow:
            ellipsis;

          white-space:
            nowrap;

          font-size: 9px;
        }

        .user-main span {
          overflow: hidden;

          text-overflow:
            ellipsis;

          white-space:
            nowrap;

          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .user-role {
          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .user-status {
          font-size: 8px;
          font-weight: 850;
        }

        .user-status.active {
          color:
            var(--legal-success);
        }

        .user-status.passive {
          color:
            var(--legal-danger);
        }

        .user-status.pending {
          color: var(--legal-gold);
        }

        .user-actions {
          display: flex;
          gap: 6px;
        }

        .admin-notifications {
          display: grid;
          gap: 6px;
          margin-bottom: 10px;
          padding: 10px;
          border: 1px solid var(--legal-gold);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-gold-soft);
          color: var(--legal-text-soft);
          font-size: 8.5px;
        }

        .admin-notifications a {
          color: inherit;
          text-decoration: none;
        }

        .admin-notifications a:hover {
          color: var(--legal-gold);
          text-decoration: underline;
        }

        .status-button.reject {
          color: var(--legal-danger);
        }

        .status-button.delete {
          border-color: var(--legal-danger);
          color: var(--legal-danger);
        }

        .status-button {
          height: 30px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface);

          color:
            var(--legal-text-soft);

          font-size: 8px;
          font-weight: 800;

          cursor: pointer;
        }

        .status-button:hover:not(:disabled) {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);
        }

        .status-button:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .user-error {
          margin-bottom: 8px;

          color:
            var(--legal-danger);

          font-size: 8px;
        }

        .user-empty {
          padding: 16px;

          color:
            var(--legal-muted);

          font-size: 8.5px;

          text-align: center;
        }

        @media (min-width: 901px) {
          .settings-page {
            height: 100vh;
            min-height: 0;
            padding: 10px 72px 10px 10px;
            overflow: hidden;
          }

          .settings-back {
            position: absolute;
            top: 21px;
            right: 88px;
            z-index: 2;
            margin: 0;
          }

          .settings-header {
            height: 56px;
            min-height: 56px;
            padding: 0 16px;
            border: 1px solid var(--legal-border);
            border-radius: 20px 20px 0 0;
            background: color-mix(in srgb, var(--legal-surface) 92%, transparent);
            box-shadow: var(--legal-shadow-sm);
            backdrop-filter: blur(20px);
          }

          .settings-header h1 {
            font-size: 16px;
            font-weight: 850;
          }

          .settings-grid {
            width: 100%;
            height: calc(100vh - 76px);
            min-height: 0;
            grid-template-columns: minmax(340px, .72fr) minmax(540px, 1.28fr);
            gap: 10px;
            margin-top: 0;
            padding: 10px;
            overflow: hidden;
            border: 1px solid var(--legal-border);
            border-top: 0;
            border-radius: 0 0 20px 20px;
            background: color-mix(in srgb, var(--legal-surface) 88%, transparent);
            box-shadow: var(--legal-shadow-md);
            backdrop-filter: blur(20px);
          }

          .settings-column-left {
            grid-template-rows: auto auto minmax(0, 1fr);
          }

          .settings-column-right {
            grid-template-rows: auto minmax(0, 1fr);
          }

          .settings-panel {
            min-height: 0;
            padding: 12px;
            background: color-mix(in srgb, var(--legal-surface) 94%, transparent);
          }

          .settings-panel p {
            margin-bottom: 9px;
          }

          .theme-option {
            min-height: 54px;
            padding: 9px 11px;
          }

          .security-panel {
            overflow-y: auto;
            scrollbar-width: thin;
          }

          .password-settings-form {
            width: min(410px, 100%);
          }

          .admin-panel {
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .admin-head,
          .invite-form,
          .invite-success,
          .admin-notifications,
          .user-error {
            flex: 0 0 auto;
          }

          .users-list {
            min-height: 0;
            overflow-y: auto;
            padding-right: 2px;
            scrollbar-width: thin;
          }

          .user-row {
            min-height: 44px;
            grid-template-columns: minmax(0, 1fr) 68px 72px minmax(92px, auto);
          }
        }

        @media (
          max-width: 620px
        ) {
          .settings-page {
            padding:
              8px 7px 76px;
          }

          .theme-options {
            grid-template-columns:
              1fr;
          }

          .user-row {
            grid-template-columns:
              minmax(
                0,
                1fr
              )
              auto;

            gap: 6px;
          }

          .invite-form {
            grid-template-columns: 1fr;
          }

          .user-role,
          .user-status {
            grid-column: auto;
          }

          .status-button {
            grid-column:
              1 / -1;

            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
