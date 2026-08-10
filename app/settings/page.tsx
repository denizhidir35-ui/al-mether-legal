"use client";

import {
  useEffect,
  useState,
} from "react";

import LegalDock from "@/components/LegalDock";
import LegalSessionControl from "@/components/LegalSessionControl";

type Theme =
  | "dark"
  | "light";

export default function SettingsPage() {
  const [theme, setTheme] =
    useState<Theme>("dark");

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
  }

  return (
    <main className="legal-app settings-page">
      <header className="settings-header">
        <div>
          <span>
            AL METHER LEGAL
          </span>

          <h1>Ayarlar</h1>
        </div>
      </header>

      <section className="settings-panel">
        <div className="settings-section-title">
          Görünüm
        </div>

        <p>
          Uygulama temasını seçin.
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

        .settings-panel {
          width: min(
            620px,
            100%
          );

          margin-top: 12px;

          padding: 14px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-lg);

          background:
            var(--legal-surface);
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

        @media (
          max-width: 520px
        ) {
          .settings-page {
            padding:
              8px 7px 76px;
          }

          .theme-options {
            grid-template-columns:
              1fr;
          }
        }
      `}</style>
    </main>
  );
}
