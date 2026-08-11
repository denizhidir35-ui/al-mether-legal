"use client";

import LegalBrand from "@/components/LegalBrand";

import {
  useEffect,
  useState,
} from "react";

import LegalDock from "@/components/LegalDock";
import LegalSessionControl from "@/components/LegalSessionControl";

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

export default function SettingsPage() {
  const [theme, setTheme] =
    useState<Theme>("dark");

  const [users, setUsers] =
    useState<AdminUser[]>([]);

  const [adminMode, setAdminMode] =
    useState(false);

  const [loadingUsers, setLoadingUsers] =
    useState(true);

  const [userError, setUserError] =
    useState("");

  const [changingId, setChangingId] =
    useState("");

  useEffect(() => {
    const saved =
      window.localStorage.getItem(
        "legal-theme"
      );

    const initial: Theme =
      saved === "light"
        ? "light"
        : "dark";

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
    user: AdminUser
  ) {
    const nextStatus =
      user.status === "active"
        ? "passive"
        : "active";

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
              status: nextStatus,
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

  return (
    <main className="legal-app settings-page">
      <header className="settings-header">
        <div className="settings-brand">
          <LegalBrand compact />

          <h1>
            Ayarlar
          </h1>
        </div>
      </header>

      <section className="settings-grid">
        <div className="settings-panel">
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

        <div className="settings-panel">
          <div className="settings-section-title">
            E-posta
          </div>

          <p>
            Hukuki bildirimlerin okunacağı hesabı yönetin.
          </p>

          <a
            href="/mail-connect"
            className="settings-link"
          >
            Mail bağlantısını yönet
          </a>
        </div>

        {adminMode && (
          <div className="settings-panel admin-panel">
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
                            : "user-status passive"
                        }
                      >
                        {user.status ===
                        "active"
                          ? "Aktif"
                          : "Pasif"}
                      </div>

                      <button
                        type="button"
                        className="status-button"
                        disabled={
                          changingId ===
                            user.id ||
                          user.role ===
                            "admin"
                        }
                        onClick={() =>
                          changeUserStatus(
                            user
                          )
                        }
                      >
                        {changingId ===
                        user.id
                          ? "Kaydediliyor..."
                          : user.role ===
                            "admin"
                            ? "Yönetici"
                            : user.status ===
                              "active"
                              ? "Pasif yap"
                              : "Aktif yap"}
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
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


