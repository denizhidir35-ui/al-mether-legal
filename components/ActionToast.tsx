"use client";

import { useEffect } from "react";

export default function ActionToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(onDismiss, 2800);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="action-toast" role="status" aria-live="polite">
      {message}

      <style jsx>{`
        .action-toast {
          position: fixed;
          right: max(18px, env(safe-area-inset-right));
          bottom: max(22px, calc(env(safe-area-inset-bottom) + 14px));
          z-index: 100100;
          width: min(360px, calc(100vw - 36px));
          padding: 12px 14px;
          border: 1px solid rgba(205, 164, 83, 0.55);
          border-radius: 14px;
          background: rgba(12, 20, 30, 0.97);
          box-shadow: 0 18px 55px rgba(0, 0, 0, 0.42);
          color: #f4f5f7;
          font-size: 12px;
          font-weight: 750;
          line-height: 1.45;
          backdrop-filter: blur(14px);
        }

        @media (max-width: 640px) {
          .action-toast {
            right: 12px;
            bottom: max(14px, calc(env(safe-area-inset-bottom) + 10px));
            width: calc(100vw - 24px);
          }
        }
      `}</style>
    </div>
  );
}
