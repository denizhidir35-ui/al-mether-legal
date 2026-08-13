"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";

import {
  useSearchParams,
} from "next/navigation";

import LegalBackButton
  from "@/components/LegalBackButton";

import LegalBrand
  from "@/components/LegalBrand";

function FileViewerContent() {
  const searchParams =
    useSearchParams();

  const attachmentId =
    searchParams
      .get("attachmentId")
      ?.trim() || "";

  const [signedUrl, setSignedUrl] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadFile() {
      if (!attachmentId) {
        setError(
          "Dosya seçilmedi."
        );
        setLoading(false);
        return;
      }

      try {
        const response =
          await fetch(
            `/api/attachments?attachmentId=${encodeURIComponent(
              attachmentId
            )}`,
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data?.signedUrl
        ) {
          throw new Error(
            data?.error ||
            "Dosya açılamadı."
          );
        }

        if (active) {
          setSignedUrl(
            data.signedUrl
          );
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Dosya açılamadı."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadFile();

    return () => {
      active = false;
    };
  }, [attachmentId]);

  return (
    <main className="legal-app file-viewer-page">
      <header>
        <LegalBackButton
          fallback="/cases"
        />

        <LegalBrand compact />
      </header>

      <section className="viewer-shell">
        {loading ? (
          <div className="viewer-state">
            Belge açılıyor...
          </div>
        ) : error ? (
          <div className="viewer-state error">
            {error}
          </div>
        ) : (
          <iframe
            src={signedUrl}
            title="Belge görüntüleyici"
          />
        )}
      </section>

      <style jsx>{`
        .file-viewer-page {
          min-height: 100dvh;
          display: grid;
          grid-template-rows: 52px minmax(0, 1fr);
          padding: 8px;
          background: var(--legal-bg);
        }

        header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 4px;
        }

        .viewer-shell {
          min-height: 0;
          overflow: hidden;
          border: 1px solid var(--legal-border);
          border-radius: 12px;
          background: var(--legal-surface);
        }

        iframe {
          width: 100%;
          height: 100%;
          border: 0;
          background: #fff;
        }

        .viewer-state {
          height: 100%;
          display: grid;
          place-items: center;
          padding: 24px;
          color: var(--legal-muted);
          font-size: 10px;
          text-align: center;
        }

        .viewer-state.error {
          color: var(--legal-danger);
        }

        @media (max-width: 620px) {
          .file-viewer-page {
            grid-template-rows: 46px minmax(0, 1fr);
            padding: 5px;
          }

          .viewer-shell {
            border-radius: 9px;
          }
        }
      `}</style>
    </main>
  );
}

export default function FileViewerPage() {
  return (
    <Suspense
      fallback={
        <main className="legal-app">
          Belge açılıyor...
        </main>
      }
    >
      <FileViewerContent />
    </Suspense>
  );
}
