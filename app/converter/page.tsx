"use client";

import {
  useState,
} from "react";

import {
  PDFDocument,
} from "pdf-lib";

import LegalDock from "@/components/LegalDock";
import LegalSessionControl from "@/components/LegalSessionControl";

export default function ConverterPage() {
  const [files, setFiles] =
    useState<File[]>([]);

  const [working, setWorking] =
    useState(false);

  const [error, setError] =
    useState("");

  const [resultUrl, setResultUrl] =
    useState("");

  const [resultName, setResultName] =
    useState("");

  function selectFiles(
    nextFiles: FileList | null
  ) {
    setError("");
    setResultUrl("");
    setResultName("");

    if (!nextFiles) {
      setFiles([]);
      return;
    }

    const selected =
      Array.from(
        nextFiles
      );

    const allowed =
      selected.filter(
        (file) =>
          file.type ===
            "image/jpeg" ||
          file.type ===
            "image/png"
      );

    if (
      allowed.length !==
      selected.length
    ) {
      setError(
        "Şimdilik yalnızca JPG ve PNG destekleniyor."
      );
    }

    setFiles(allowed);
  }

  async function convertToPdf() {
    if (
      files.length === 0
    ) {
      setError(
        "Önce bir görsel seçin."
      );
      return;
    }

    try {
      setWorking(true);
      setError("");

      if (resultUrl) {
        URL.revokeObjectURL(
          resultUrl
        );
      }

      const pdf =
        await PDFDocument.create();

      const pageWidth =
        595.28;

      const pageHeight =
        841.89;

      const margin = 28;

      const availableWidth =
        pageWidth -
        margin * 2;

      const availableHeight =
        pageHeight -
        margin * 2;

      for (
        const file
        of files
      ) {
        const bytes =
          await file.arrayBuffer();

        const image =
          file.type ===
          "image/png"
            ? await pdf.embedPng(
                bytes
              )
            : await pdf.embedJpg(
                bytes
              );

        const scale =
          Math.min(
            availableWidth /
              image.width,

            availableHeight /
              image.height
          );

        const width =
          image.width *
          scale;

        const height =
          image.height *
          scale;

        const page =
          pdf.addPage([
            pageWidth,
            pageHeight,
          ]);

        page.drawImage(
          image,
          {
            x:
              (
                pageWidth -
                width
              ) / 2,

            y:
              (
                pageHeight -
                height
              ) / 2,

            width,
            height,
          }
        );
      }

      const result =
        await pdf.save();

      const blob =
        new Blob(
          [
            new Uint8Array(
              result
            ),
          ],
          {
            type:
              "application/pdf",
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      setResultUrl(url);

      setResultName(
        files.length === 1
          ? `${files[0].name.replace(
              /\.[^.]+$/,
              ""
            )}.pdf`
          : `belgeler-${Date.now()}.pdf`
      );
    } catch (
      conversionError
    ) {
      setError(
        conversionError instanceof Error
          ? conversionError.message
          : "PDF oluşturulamadı."
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="legal-app converter-page">
      <header className="converter-header">
        <div>
          <span>
            AL METHER LEGAL
          </span>

          <h1>
            Dönüştür
          </h1>
        </div>
      </header>

      <section className="converter-workspace">
        <div className="converter-panel">
          <div className="panel-title">
            Görsel → PDF
          </div>

          <p>
            JPG veya PNG belgelerinizi tek PDF dosyasına dönüştürün.
          </p>

          <label className="drop-zone">
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png"
              onChange={(
                event
              ) =>
                selectFiles(
                  event.target
                    .files
                )
              }
            />

            <strong>
              Dosya seç
            </strong>

            <span>
              JPG / PNG
            </span>
          </label>

          {files.length >
            0 && (
            <div className="selected-files">
              {files.map(
                (
                  file,
                  index
                ) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="selected-file"
                  >
                    <strong>
                      {
                        file.name
                      }
                    </strong>

                    <span>
                      {(
                        file.size /
                        1024
                      ).toFixed(
                        1
                      )} KB
                    </span>
                  </div>
                )
              )}
            </div>
          )}

          {error && (
            <div className="converter-error">
              {error}
            </div>
          )}

          <div className="converter-actions">
            <button
              type="button"
              onClick={
                convertToPdf
              }
              disabled={
                working ||
                files.length ===
                  0
              }
            >
              {working
                ? "Dönüştürülüyor..."
                : "PDF oluştur"}
            </button>

            {resultUrl && (
              <a
                href={
                  resultUrl
                }
                download={
                  resultName
                }
              >
                İndir
              </a>
            )}
          </div>
        </div>

        <aside className="converter-info">
          <span>
            DOSYA
          </span>

          <strong>
            {files.length}
          </strong>

          <p>
            seçili belge
          </p>

          {resultUrl && (
            <div className="result-ready">
              PDF hazır
            </div>
          )}
        </aside>
      </section>

      <LegalSessionControl />
      <LegalDock />

      <style jsx>{`
        .converter-page {
          height: 100dvh;
          overflow: hidden;
          padding:
            12px 16px 74px;
        }

        .converter-header {
          height: 48px;

          display: flex;
          align-items: center;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .converter-header span {
          display: block;

          margin-bottom: 2px;

          color:
            var(--legal-gold);

          font-size: 7px;
          font-weight: 900;
          letter-spacing:
            0.16em;
        }

        .converter-header h1 {
          margin: 0;

          font-size: 15px;
        }

        .converter-workspace {
          width:
            min(
              980px,
              100%
            );

          display: grid;

          grid-template-columns:
            minmax(
              0,
              1fr
            )
            180px;

          gap: 8px;

          margin-top: 10px;
        }

        .converter-panel,
        .converter-info {
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

        .converter-panel {
          padding: 14px;
        }

        .panel-title {
          font-size: 11px;
          font-weight: 850;
        }

        .converter-panel p {
          margin:
            4px 0 12px;

          color:
            var(--legal-muted);

          font-size: 9px;
        }

        .drop-zone {
          height: 118px;

          display: grid;
          place-content: center;
          justify-items: center;

          gap: 4px;

          border:
            1px dashed
            var(--legal-border-strong);

          border-radius:
            var(--legal-radius-md);

          background:
            var(--legal-surface-2);

          cursor: pointer;
        }

        .drop-zone:hover {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);
        }

        .drop-zone input {
          display: none;
        }

        .drop-zone strong {
          color:
            var(--legal-text);

          font-size: 10px;
        }

        .drop-zone span {
          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .selected-files {
          max-height: 170px;

          overflow-y: auto;

          display: grid;
          gap: 5px;

          margin-top: 8px;
        }

        .selected-file {
          display: flex;
          justify-content:
            space-between;
          gap: 10px;

          padding: 8px 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);
        }

        .selected-file strong {
          min-width: 0;

          overflow: hidden;
          text-overflow:
            ellipsis;
          white-space: nowrap;

          font-size: 8.5px;
        }

        .selected-file span {
          color:
            var(--legal-muted);

          font-size: 7.5px;
        }

        .converter-error {
          margin-top: 8px;

          color:
            var(--legal-danger);

          font-size: 8px;
        }

        .converter-actions {
          display: flex;
          gap: 6px;

          margin-top: 10px;
        }

        .converter-actions button,
        .converter-actions a {
          height: 32px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          padding:
            0 12px;

          border:
            1px solid
            var(--legal-gold);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);

          text-decoration: none;

          font-size: 8.5px;
          font-weight: 850;
        }

        .converter-actions button {
          cursor: pointer;
        }

        .converter-actions button:disabled {
          opacity: 0.45;
          cursor: default;
        }

        .converter-info {
          min-height: 180px;

          display: grid;
          align-content: center;
          justify-items: center;
        }

        .converter-info > span {
          color:
            var(--legal-gold);

          font-size: 7px;
          font-weight: 900;
          letter-spacing:
            0.14em;
        }

        .converter-info > strong {
          margin-top: 5px;

          font-size: 28px;
        }

        .converter-info p {
          margin: 2px 0 0;

          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .result-ready {
          margin-top: 12px;

          padding:
            5px 8px;

          border:
            1px solid
            var(--legal-success);

          border-radius:
            999px;

          color:
            var(--legal-success);

          font-size: 7.5px;
          font-weight: 850;
        }

        @media (
          max-width: 700px
        ) {
          .converter-page {
            height: auto;
            min-height: 100dvh;

            overflow: visible;

            padding:
              8px 7px 76px;
          }

          .converter-workspace {
            grid-template-columns:
              1fr;
          }

          .converter-info {
            min-height: 100px;
          }
        }
      `}</style>
    </main>
  );
}
