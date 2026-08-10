"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

export type Mail = {
  id: string;
  subject: string;
  sender: string;
  body: string;
  deadline: string;
  type: string;
  risk: string;
  date?: string;
  hasAttachment?: boolean;

  attachments?: {
    filename: string;
    mimeType?: string;
    size?: number;
    attachmentId?: string;
  }[];
};


function cleanVisibleMailText(
  value: string
) {
  if (!value) {
    return "";
  }

  return value
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<[^>]+>/g,
      " "
    )
    .replace(
      /https?:\/\/\S{90,}/gi,
      "[bağlantı]"
    )
    .replace(
      /(?:utm_[a-z_]+|trk|tracking|token|mid|lipi|origin)=[^\s&]+/gi,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function formatMailDate(
  value?: string
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

type Props = {
  onSelectMail?: (
    mail: Mail
  ) => void;

  selectedMailId?: string;
};

export default function MailInbox({
  onSelectMail,
  selectedMailId = "",
}: Props) {
  const [mails, setMails] =
    useState<Mail[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [attachmentsOnly, setAttachmentsOnly] =
    useState(false);

  const filteredMails =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLocaleLowerCase(
            "tr-TR"
          );

      return mails.filter(
        (mail) => {
          const matchesSearch =
            !term ||
            mail.subject
              .toLocaleLowerCase(
                "tr-TR"
              )
              .includes(term) ||
            mail.sender
              .toLocaleLowerCase(
                "tr-TR"
              )
              .includes(term) ||
            mail.body
              .toLocaleLowerCase(
                "tr-TR"
              )
              .includes(term);

          const matchesAttachment =
            !attachmentsOnly ||
            Boolean(
              mail.hasAttachment
            );

          return (
            matchesSearch &&
            matchesAttachment
          );
        }
      );
    }, [
      mails,
      search,
      attachmentsOnly,
    ]);

  async function runMailSync() {
    try {
      const response =
        await fetch(
          "/api/mail-sync",
          {
            method: "POST",
            cache: "no-store",
          }
        );

      if (!response.ok) {
        const data =
          await response
            .json()
            .catch(() => ({}));

        console.error(
          "MAIL SYNC ERROR:",
          data
        );
      }
    } catch (syncError) {
      console.error(
        "MAIL SYNC ERROR:",
        syncError
      );
    }
  }

  async function loadMails() {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch(
          "/api/gmail",
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Gmail verileri alınamadı."
        );
      }

      const formatted:
        Mail[] =
        (
          Array.isArray(data)
            ? data
            : []
        ).map(
          (mail: any) => ({
            id:
              mail.id || "",

            subject:
              mail.subject ||
              "Konu yok",

            sender:
              mail.from ||
              mail.sender ||
              "Bilinmeyen gönderen",

            body:
              cleanVisibleMailText(
                mail.body ||
                mail.snippet ||
                ""
              ),

            deadline:
              mail.deadline ||
              "-",

            type:
              mail.type ||
              "Analiz Bekliyor",

            risk:
              mail.risk ||
              "Analiz Bekliyor",

            date:
              formatMailDate(
                mail.date || ""
              ),

            attachments:
              Array.isArray(
                mail.attachments
              )
                ? mail.attachments
                : [],

            hasAttachment:
              Boolean(
                mail.hasAttachment
              ) ||
              Boolean(
                mail.has_attachment
              ) ||
              (
                Array.isArray(
                  mail.attachments
                ) &&
                mail.attachments
                  .length > 0
              ),
          })
        );

      setMails(
        formatted
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Mailler alınamadı."
      );
    } finally {
      setLoading(false);
    }
  }

  async function refreshMailSystem() {
    await runMailSync();
    await loadMails();
  }

  useEffect(() => {
    refreshMailSystem();

    const interval =
      window.setInterval(
        refreshMailSystem,
        2 * 60 * 1000
      );

    const handleFocus = () => {
      refreshMailSystem();
    };

    window.addEventListener(
      "focus",
      handleFocus
    );

    return () => {
      window.clearInterval(
        interval
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );
    };
  }, []);

  return (
    <section className="inbox-list">
      <div className="inbox-tools">
        <div className="inbox-search">
          <span>⌕</span>

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Mail ara..."
          />
        </div>

        <button
          type="button"
          className={
            attachmentsOnly
              ? "filter-button active"
              : "filter-button"
          }
          onClick={() =>
            setAttachmentsOnly(
              (value) => !value
            )
          }
          title="Ekli mailler"
        >
          Ekli
        </button>

        <button
          type="button"
          className="refresh-button"
          onClick={
            refreshMailSystem
          }
          title="Yenile"
        >
          ↻
        </button>
      </div>

      <div className="mail-count">
        {filteredMails.length}
        {" "}mail
      </div>

      <div className="mail-scroll">
        {loading &&
          mails.length === 0 && (
            <div className="mail-state">
              Mailler yükleniyor...
            </div>
          )}

        {!loading &&
          error && (
            <div className="mail-state error">
              {error}
            </div>
          )}

        {!loading &&
          !error &&
          filteredMails.length ===
            0 && (
            <div className="mail-state">
              Mail bulunamadı.
            </div>
          )}

        {filteredMails.map(
          (mail) => {
            const selected =
              selectedMailId ===
              mail.id;

            return (
              <button
                type="button"
                key={mail.id}
                className={
                  selected
                    ? "mail-row selected"
                    : "mail-row"
                }
                onClick={() =>
                  onSelectMail?.(
                    mail
                  )
                }
              >
                <div className="mail-row-top">
                  <strong>
                    {mail.subject}
                  </strong>

                  {mail.hasAttachment && (
                    <span className="attachment-mark">
                      ⛓
                    </span>
                  )}
                </div>

                <div className="mail-sender">
                  {mail.sender}
                </div>

                <div className="mail-preview">
                  {mail.body ||
                    "İçerik yok"}
                </div>

                {mail.date && (
                  <div className="mail-date">
                    {mail.date}
                  </div>
                )}
              </button>
            );
          }
        )}
      </div>

      <style jsx>{`
        .inbox-list {
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .inbox-tools {
          height: 42px;
          flex: 0 0 auto;

          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            auto
            34px;

          gap: 6px;
          align-items: center;
        }

        .inbox-search {
          height: 34px;

          display: flex;
          align-items: center;
          gap: 7px;

          padding: 0 10px;

          border: 1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);
        }

        .inbox-search span {
          color:
            var(--legal-muted);

          font-size: 14px;
        }

        .inbox-search input {
          width: 100%;

          border: 0;
          outline: 0;
          background: transparent;

          color:
            var(--legal-text);

          font-size: 11px;
        }

        .inbox-search input::placeholder {
          color:
            var(--legal-muted);
        }

        .filter-button,
        .refresh-button {
          height: 34px;

          border: 1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);

          cursor: pointer;
        }

        .filter-button {
          padding: 0 10px;
          font-size: 9px;
          font-weight: 800;
        }

        .refresh-button {
          width: 34px;
          font-size: 15px;
        }

        .filter-button:hover,
        .refresh-button:hover,
        .filter-button.active {
          border-color:
            var(--legal-gold);

          color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);
        }

        .mail-count {
          height: 24px;

          display: flex;
          align-items: center;

          flex: 0 0 auto;

          color:
            var(--legal-muted);

          font-size: 9px;
          font-weight: 700;
        }

        .mail-scroll {
          min-height: 0;
          flex: 1;

          overflow-y: auto;

          display: grid;
          align-content: start;
          gap: 5px;

          padding-right: 3px;
        }

        .mail-row {
          width: 100%;
          min-height: 74px;

          padding: 9px 10px;

          border: 1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-md);

          background:
            var(--legal-surface);

          color:
            var(--legal-text);

          text-align: left;
          cursor: pointer;

          transition:
            border-color
              var(--legal-transition),
            background
              var(--legal-transition),
            transform
              var(--legal-transition);
        }

        .mail-row:hover {
          border-color:
            var(
              --legal-border-strong
            );

          transform:
            translateY(-1px);
        }

        .mail-row.selected {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow:
            inset 3px 0 0
              var(--legal-gold);
        }

        .mail-row-top {
          display: flex;
          align-items: flex-start;
          justify-content:
            space-between;
          gap: 8px;
        }

        .mail-row strong {
          display: block;

          min-width: 0;

          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;

          color:
            var(--legal-text);

          font-size: 10.5px;
          font-weight: 800;
        }

        .attachment-mark {
          flex: 0 0 auto;

          color:
            var(--legal-gold);

          font-size: 10px;
        }

        .mail-sender {
          margin-top: 3px;

          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;

          color:
            var(--legal-muted);

          font-size: 9px;
        }

        .mail-preview {
          margin-top: 5px;

          overflow: hidden;

          display: -webkit-box;
          -webkit-box-orient:
            vertical;
          -webkit-line-clamp: 2;

          color:
            var(--legal-text-soft);

          font-size: 9px;
          line-height: 1.35;
        }

        .mail-date {
          margin-top: 5px;

          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .mail-state {
          padding: 24px 12px;

          color:
            var(--legal-muted);

          font-size: 10px;
          text-align: center;
        }

        .mail-state.error {
          color:
            var(--legal-danger);
        }
      `}</style>
    </section>
  );
}

