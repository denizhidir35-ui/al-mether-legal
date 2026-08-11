"use client";

import {
  useEffect,
} from "react";

type LegalTheme =
  | "dark"
  | "light";

function applyTheme(
  theme: LegalTheme
) {
  document.documentElement
    .classList.toggle(
      "dark",
      theme === "dark"
    );

  document.documentElement
    .setAttribute(
      "data-legal-theme",
      theme
    );
}

export default function GlobalLegalTheme() {
  useEffect(() => {
    const saved =
      window.localStorage
        .getItem(
          "legal-theme"
        );

    const theme:
      LegalTheme =
      saved === "light"
        ? "light"
        : "dark";

    applyTheme(theme);

    function handleThemeChange(
      event: Event
    ) {
      const customEvent =
        event as CustomEvent<{
          theme?:
            LegalTheme;
        }>;

      const next =
        customEvent.detail
          ?.theme;

      if (
        next !== "dark" &&
        next !== "light"
      ) {
        return;
      }

      applyTheme(next);
    }

    function handleStorage(
      event: StorageEvent
    ) {
      if (
        event.key !==
        "legal-theme"
      ) {
        return;
      }

      const next:
        LegalTheme =
        event.newValue ===
        "light"
          ? "light"
          : "dark";

      applyTheme(next);
    }

    window.addEventListener(
      "legal-theme-change",
      handleThemeChange
    );

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "legal-theme-change",
        handleThemeChange
      );

      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, []);

  return null;
}
