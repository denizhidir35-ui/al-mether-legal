"use client";

import {
  useRouter,
} from "next/navigation";
import {
  hasSafeAppHistory,
  SAFE_HISTORY_KEY,
} from "@/lib/navigation/backNavigation";

type LegalBackButtonProps = {
  fallback: string;
  onBack?: () => void;
  className?: string;
};

export default function LegalBackButton({
  fallback,
  onBack,
  className = "",
}: LegalBackButtonProps) {
  const router =
    useRouter();

  function goBack() {
    if (onBack) {
      onBack();
      return;
    }

    let markedPath = "";

    try {
      markedPath =
        window.sessionStorage
          .getItem(
            SAFE_HISTORY_KEY
          ) || "";
    } catch {}

    if (
      hasSafeAppHistory(
        window.location.pathname,
        document.referrer,
        window.history.length,
        markedPath,
        window.location.origin
      )
    ) {
      try {
        window.sessionStorage
          .removeItem(
            SAFE_HISTORY_KEY
          );
      } catch {}

      router.back();
      return;
    }

    router.replace(fallback);
  }

  return (
    <button
      type="button"
      className={`legal-back-button ${className}`.trim()}
      onClick={goBack}
      aria-label="Geri"
    >
      <span aria-hidden="true">
        &larr;
      </span>
      Geri

      <style jsx>{`
        .legal-back-button {
          min-height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 0 10px;
          border: 1px solid var(--legal-border);
          border-radius: 8px;
          background: var(--legal-surface-2);
          color: var(--legal-text-soft);
          font: inherit;
          font-size: 8px;
          font-weight: 850;
          cursor: pointer;
        }

        .legal-back-button:hover {
          border-color: var(--legal-gold);
          color: var(--legal-gold-light);
        }

        .legal-back-button span {
          font-size: 12px;
          line-height: 1;
        }

        @media (max-width: 620px) {
          .legal-back-button {
            min-height: 32px;
            padding: 0 9px;
          }
        }
      `}</style>
    </button>
  );
}
