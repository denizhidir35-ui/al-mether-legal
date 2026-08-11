"use client";

import {
  useState,
} from "react";

import LegalDock from "@/components/LegalDock";
import LegalBrand from "@/components/LegalBrand";
import LegalSessionControl from "@/components/LegalSessionControl";

import MailInbox, {
  type Mail,
} from "@/components/mail/MailInbox";

function formatBytes(
  value?: number
) {
  if (!value) {
    return "";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (
    value <
    1024 * 1024
  ) {
    return `${(
      value / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    value /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

export default function InboxPage() {
  const [
    selectedMail,
    setSelectedMail,
  ] =
    useState<Mail | null>(
      null
    );

  const [
    mobileDetail,
    setMobileDetail,
  ] =
    useState(false);

  function selectMail(
    mail: Mail
  ) {
    setSelectedMail(mail);
    setMobileDetail(true);
  }

  return (
    <main className="legal-app inbox-page">
      <header className="inbox-header">
        <div className="brand">
          <LegalBrand compact />

          <span className="brand-context">
            Gelen Kutusu
          </span>
        </div>

        <div className="header-actions">
          <a
            href="/mail-connect"
            className="mail-status"
          >
            <span />
            Mail bağlı
          </a>

        </div>
      </header>

      <section className="workspace">
        <aside
          className={
            mobileDetail
              ? "mail-pane mobile-hidden"
              : "mail-pane"
          }
        >
          <div className="pane-title">
            <div>
              <strong>
                Gelen
              </strong>

              <span>
                Son 50 mail
              </span>
            </div>
          </div>

          <MailInbox
            selectedMailId={
              selectedMail?.id ||
              ""
            }
            onSelectMail={
              selectMail
            }
          />
        </aside>

        <section
          className={
            mobileDetail
              ? "detail-pane"
              : "detail-pane mobile-hidden"
          }
        >
          {!selectedMail ? (
            <div className="empty-detail">
              <div className="empty-mark">
                ✉
              </div>

              <strong>
                Mail seçin
              </strong>

              <span>
                İçeriği görüntülemek için
                soldaki listeden bir mail
                seçin.
              </span>
            </div>
          ) : (
            <>
              <div className="detail-header">
                <button
                  type="button"
                  className="mobile-back"
                  onClick={() =>
                    setMobileDetail(
                      false
                    )
                  }
                >
                  ←
                </button>

                <div className="detail-heading">
                  <div className="detail-kicker">
                    GELEN MAIL
                  </div>

                  <h1>
                    {
                      selectedMail.subject
                    }
                  </h1>

                  <div className="detail-meta">
                    <span>
                      {
                        selectedMail.sender
                      }
                    </span>

                    {selectedMail.date && (
                      <>
                        <i />
                        <span>
                          {
                            selectedMail.date
                          }
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {selectedMail
                .attachments &&
                selectedMail
                  .attachments
                  .length > 0 && (
                  <div className="attachments-strip">
                    {selectedMail
                      .attachments
                      .map(
                        (
                          attachment,
                          index
                        ) => (
                          <div
                            className="attachment-chip"
                            key={`${attachment.attachmentId}-${index}`}
                          >
                            <span className="attachment-icon">
                              ▱
                            </span>

                            <div>
                              <strong>
                                {
                                  attachment.filename
                                }
                              </strong>

                              <span>
                                {attachment.mimeType ||
                                  "Dosya"}

                                {attachment.size
                                  ? ` · ${formatBytes(
                                      attachment.size
                                    )}`
                                  : ""}
                              </span>
                            </div>
                          </div>
                        )
                      )}
                  </div>
                )}

              <article className="mail-content">
                {selectedMail.body ||
                  "Mail içeriği bulunmuyor."}
              </article>
            </>
          )}
        </section>
      </section>

      <LegalSessionControl />
      <LegalDock />

      <style jsx>{`
        .inbox-page {
          height: 100dvh;
          overflow: hidden;

          display: grid;
          grid-template-rows:
            52px
            minmax(0, 1fr);

          padding-bottom: 64px;

          background:
            var(--legal-bg);

          color:
            var(--legal-text);
        }

        .inbox-header {
          display: flex;
          align-items: center;
          justify-content:
            space-between;

          padding: 0 18px;

          border-bottom:
            1px solid
            var(--legal-border);

          background:
            var(--legal-surface);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .brand-mark {
          width: 27px;
          height: 27px;

          display: grid;
          place-items: center;

          border:
            1px solid
            var(--legal-gold);

          border-radius: 8px;

          color:
            var(--legal-gold);

          font-size: 9px;
          font-weight: 900;
          letter-spacing:
            0.05em;
        }

        .brand div {
          display: grid;
          gap: 1px;
        }

        .brand strong {
          color:
            var(--legal-text);

          font-size: 10px;
          letter-spacing:
            0.08em;
        }

        .brand div span {
          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .mail-status,
        .theme-button {
          height: 30px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 9px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);
        }

        .mail-status {
          display: flex;
          align-items: center;
          gap: 6px;

          padding: 0 9px;

          text-decoration: none;

          font-size: 8px;
          font-weight: 800;
        }

        .mail-status span {
          width: 5px;
          height: 5px;

          border-radius: 999px;

          background:
            var(--legal-success);
        }

        .theme-button {
          width: 30px;
          cursor: pointer;

          color:
            var(--legal-gold);

          font-size: 13px;
        }

        .workspace {
          min-height: 0;

          display: grid;

          grid-template-columns:
            minmax(280px, 31%)
            minmax(0, 1fr);

          gap: 8px;

          padding:
            8px 12px 0;
        }

        .mail-pane,
        .detail-pane {
          min-height: 0;

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

        .mail-pane {
          display: grid;
          grid-template-rows:
            44px
            minmax(0, 1fr);

          padding: 0 9px 9px;
        }

        .pane-title {
          display: flex;
          align-items: center;
          justify-content:
            space-between;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .pane-title div {
          display: flex;
          align-items: baseline;
          gap: 7px;
        }

        .pane-title strong {
          font-size: 12px;
          font-weight: 850;
        }

        .pane-title span {
          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .detail-pane {
          position: relative;

          display: flex;
          flex-direction: column;

          overflow: hidden;
        }

        .detail-header {
          min-height: 82px;

          display: flex;
          align-items: center;
          gap: 10px;

          flex: 0 0 auto;

          padding: 14px 18px;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .detail-heading {
          min-width: 0;
        }

        .detail-kicker {
          margin-bottom: 4px;

          color:
            var(--legal-gold);

          font-size: 7px;
          font-weight: 900;
          letter-spacing:
            0.16em;
        }

        .detail-heading h1 {
          margin: 0;

          overflow: hidden;
          text-overflow:
            ellipsis;
          white-space: nowrap;

          color:
            var(--legal-text);

          font-size:
            clamp(
              13px,
              1.4vw,
              17px
            );

          font-weight: 820;
          letter-spacing:
            -0.015em;
        }

        .detail-meta {
          margin-top: 6px;

          display: flex;
          align-items: center;
          gap: 7px;

          min-width: 0;

          color:
            var(--legal-muted);

          font-size: 8.5px;
        }

        .detail-meta span {
          overflow: hidden;
          text-overflow:
            ellipsis;
          white-space: nowrap;
        }

        .detail-meta i {
          width: 3px;
          height: 3px;

          flex: 0 0 auto;

          border-radius: 50%;

          background:
            var(--legal-gold);
        }

        .attachments-strip {
          display: flex;
          gap: 6px;

          flex: 0 0 auto;

          overflow-x: auto;

          padding: 8px 18px;

          border-bottom:
            1px solid
            var(--legal-border);

          background:
            var(--legal-surface-2);
        }

        .attachment-chip {
          min-width: 160px;
          max-width: 240px;

          display: flex;
          align-items: center;
          gap: 8px;

          padding: 7px 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 9px;

          background:
            var(--legal-surface);
        }

        .attachment-icon {
          color:
            var(--legal-gold);

          font-size: 15px;
        }

        .attachment-chip div {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .attachment-chip strong {
          overflow: hidden;
          text-overflow:
            ellipsis;
          white-space: nowrap;

          font-size: 8.5px;
        }

        .attachment-chip div span {
          color:
            var(--legal-muted);

          font-size: 7px;
        }

        .mail-content {
          flex: 1;
          min-height: 0;

          overflow-y: auto;

          padding: 18px;

          color:
            var(--legal-text-soft);

          font-size: 10.5px;
          line-height: 1.68;

          white-space:
            pre-wrap;
          overflow-wrap:
            anywhere;
        }

        .empty-detail {
          height: 100%;

          display: grid;
          place-content: center;

          justify-items: center;

          padding: 30px;

          text-align: center;
        }

        .empty-mark {
          width: 38px;
          height: 38px;

          display: grid;
          place-items: center;

          margin-bottom: 10px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 12px;

          color:
            var(--legal-gold);

          background:
            var(--legal-surface-2);

          font-size: 16px;
        }

        .empty-detail strong {
          font-size: 11px;
        }

        .empty-detail span {
          max-width: 280px;

          margin-top: 5px;

          color:
            var(--legal-muted);

          font-size: 9px;
          line-height: 1.45;
        }

        .mobile-back {
          display: none;
        }

        @media (
          max-width: 760px
        ) {
          .inbox-page {
            grid-template-rows:
              48px
              minmax(0, 1fr);

            padding-bottom: 68px;
          }

          .inbox-header {
            padding: 0 11px;
          }

          .brand strong {
            font-size: 9px;
          }

          .brand div span {
            display: none;
          }

          .mail-status {
            padding: 0 7px;
          }

          .workspace {
            display: block;

            padding:
              6px 7px 0;
          }

          .mail-pane,
          .detail-pane {
            height: 100%;
            border-radius: 13px;
          }

          .mail-pane {
            grid-template-rows:
              40px
              minmax(0, 1fr);

            padding:
              0 7px 7px;
          }

          .detail-header {
            min-height: 74px;

            padding:
              11px 12px;
          }

          .mobile-hidden {
            display: none;
          }

          .mobile-back {
            width: 30px;
            height: 30px;

            display: grid;
            place-items: center;

            flex: 0 0 auto;

            border:
              1px solid
              var(--legal-border);

            border-radius: 9px;

            background:
              var(--legal-surface-2);

            color:
              var(--legal-gold);

            cursor: pointer;
          }

          .detail-heading h1 {
            max-width:
              calc(
                100vw -
                90px
              );

            font-size: 13px;
          }

          .detail-meta {
            max-width:
              calc(
                100vw -
                90px
              );
          }

          .attachments-strip {
            padding:
              7px 11px;
          }

          .mail-content {
            padding: 13px;

            font-size: 10px;
            line-height: 1.6;
          }
        }
      
        /* =================================================
           AL METHER LEGAL — MOBILE FINAL POLISH
           ================================================= */

        @media (max-width: 760px) {

          html,
          body {
            width: 100%;
            max-width: 100%;
            overflow-x: hidden;
          }

          button,
          input,
          textarea,
          select {
            -webkit-tap-highlight-color:
              transparent;
          }

          button {
            touch-action:
              manipulation;
          }

          input,
          textarea {
            font-size: 16px;
          }
        }

        @media (max-width: 520px) {

          .inbox-page,
          .cases-page,
          .lawyer-calendar {
            padding-bottom:
              calc(
                72px +
                env(
                  safe-area-inset-bottom
                )
              );
          }

          .inbox-header {
            min-width: 0;
          }

          .brand {
            min-width: 0;
          }

          .brand strong {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .mail-status {
            max-width: 82px;

            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .inbox-tools {
            grid-template-columns:
              minmax(0, 1fr)
              auto
              34px;
          }

          .mail-row {
            min-height: 68px;

            padding:
              8px 9px;
          }

          .mail-row strong {
            font-size: 10px;
          }

          .mail-preview {
            -webkit-line-clamp: 1;

            font-size: 8.5px;
          }

          .detail-header {
            align-items: flex-start;
          }

          .detail-heading {
            width: 100%;
          }

          .detail-heading h1 {
            max-width:
              calc(
                100vw -
                84px
              );

            white-space: normal;

            display: -webkit-box;
            -webkit-box-orient:
              vertical;
            -webkit-line-clamp: 2;

            line-height: 1.3;
          }

          .detail-meta {
            flex-wrap: wrap;
          }

          .mail-content {
            overscroll-behavior:
              contain;
          }

          .cases-header {
            position: relative;
          }

          .search-input {
            min-width: 0;
            width: 100%;
          }

          .case-row {
            width: 100%;
            min-width: 0;
          }

          .case-court,
          .case-title {
            overflow-wrap: anywhere;
          }

          .case-actions {
            width: 100%;
          }

          .case-actions button {
            min-width: 0;

            overflow: hidden;
            text-overflow: ellipsis;
          }

          .case-inline-panel {
            width: 100%;
            min-width: 0;

            overflow: hidden;
          }

          .case-mail-item,
          .case-file-item {
            min-width: 0;
          }

          .case-file-toolbar {
            justify-content:
              stretch;
          }

          .case-file-upload {
            width: 100%;
          }

          .workspace {
            max-width: 100%;
          }

          .calendar-panel,
          .detail-panel {
            min-width: 0;
            max-width: 100%;
          }

          .calendar-toolbar {
            flex-wrap: wrap;
          }

          .calendar-navigation {
            width: 100%;

            justify-content:
              center;
          }

          .month-title {
            flex: 1;
            min-width: 0;
          }

          .month-grid {
            width: 100%;
          }

          .day-cell {
            min-width: 0;
          }

          .event-count-chip {
            max-width: 100%;

            overflow: hidden;
            text-overflow: ellipsis;
          }

          .detail-panel {
            margin-top: 6px;
          }

          .detail-date {
            font-size: 12px;
          }

          .event-selector-list {
            overflow-x: auto;

            scrollbar-width: none;
          }

          .event-selector-list::-webkit-scrollbar {
            display: none;
          }

          .event-selector-button {
            flex:
              0 0 120px;
          }

          .detail-tabs {
            width: 100%;

            overflow-x: auto;

            scrollbar-width: none;
          }

          .detail-tabs::-webkit-scrollbar {
            display: none;
          }

          .detail-tab {
            min-width: 68px;
          }

          .detail-content {
            overflow-y: visible;
          }
        }

        @media (max-width: 390px) {

          .brand-mark {
            width: 25px;
            height: 25px;
          }

          .mail-status {
            max-width: 68px;

            font-size: 7px;
          }

          .case-actions {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }

          .case-actions
          .deadline-button {
            grid-column: auto;
          }

          .weekday {
            padding:
              4px 1px;
          }

          .day-cell {
            min-height: 49px;
          }

          .day-number {
            width: 19px;
            height: 19px;
          }
        }

        /* LIVE INBOX FIX */

        .inbox-header
        .header-actions {
          display: none;
        }

        .workspace {
          min-width: 0;
        }

        .mail-pane,
        .detail-pane,
        .mail-scroll,
        .mail-row,
        .mail-content {
          min-width: 0;
          max-width: 100%;
        }

        .mail-scroll {
          overflow-x: hidden !important;
        }

        .mail-row {
          overflow: hidden;
        }

        .mail-preview {
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .mail-content {
          overflow-x: hidden;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        /* FINAL INBOX PAGE FIX */

        .workspace {
          grid-template-columns:
            minmax(320px, 32%)
            minmax(0, 1fr);

          width: 100%;
          min-width: 0;
          max-width: 100%;

          overflow: hidden;
        }

        .mail-pane {
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
        }

        .detail-pane {
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
        }

        .detail-header {
          min-width: 0;
        }

        .detail-heading {
          width: 100%;
          min-width: 0;
        }

        .mail-content {
          width: 100%;
          min-width: 0;
          max-width: 100%;

          overflow-x: hidden;
          overflow-y: auto;

          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .mail-content {
          padding:
            18px 22px;
        }

        .mail-content::first-line {
          line-height: 1.7;
        }

        @media (min-width: 1100px) {
          .mail-content {
            padding-right: 8%;
          }
        }

        @media (max-width: 760px) {
          .workspace {
            display: block;
            overflow: visible;
          }

          .mail-pane,
          .detail-pane {
            width: 100%;
            max-width: 100%;
          }
        }
`}</style>
    </main>
  );
}




