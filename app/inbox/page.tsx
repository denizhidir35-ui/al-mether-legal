"use client";

import CalendarWriteToast from "@/components/mail/CalendarWriteToast";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import LegalBrand
  from "@/components/LegalBrand";

import LegalDock
  from "@/components/LegalDock";

type Connection = {
  id: string;
  provider: string;
  email?: string | null;
  status?: string | null;
};

type MailFolder =
  | "inbox"
  | "sent"
  | "drafts"
  | "trash";

type MailSummary = {
  id: string;
  threadId?: string;
  subject: string;
  sender: string;
  date: string;
  snippet: string;
  unread: boolean;
  hasAttachments: boolean;
};

type Attachment = {
  filename: string;
  mimeType?: string;
  size?: number;
  attachmentId?: string;
};

type MailDetail = {
  id: string;
  threadId?: string;
  subject: string;
  sender: string;
  to?: string;
  cc?: string;
  date: string;
  body: string;
  attachments?: Attachment[];
};

const ACCOUNT_KEY =
  "mether-mail-account";

const FOLDERS: Array<{
  id: MailFolder;
  label: string;
}> = [
  {
    id: "inbox",
    label: "Gelen",
  },
  {
    id: "sent",
    label: "Gönderilen",
  },
  {
    id: "drafts",
    label: "Taslaklar",
  },
  {
    id: "trash",
    label: "Çöp",
  },
];

function folderLabel(
  folder: MailFolder
) {
  return (
    FOLDERS.find(
      (item) =>
        item.id === folder
    )?.label ||
    "Gelen"
  );
}

function providerName(
  provider: string
) {
  if (
    provider === "google"
  ) {
    return "Google";
  }

  if (
    provider ===
    "microsoft"
  ) {
    return "Microsoft";
  }

  if (
    provider === "imap"
  ) {
    return "Kurumsal";
  }

  return "Posta";
}

function providerMark(
  provider: string
) {
  if (
    provider === "google"
  ) {
    return "G";
  }

  if (
    provider ===
    "microsoft"
  ) {
    return "M";
  }

  return "@";
}

function formatDate(
  value: string
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

  const now =
    new Date();

  const sameDay =
    date.getFullYear() ===
      now.getFullYear() &&
    date.getMonth() ===
      now.getMonth() &&
    date.getDate() ===
      now.getDate();

  if (sameDay) {
    return date
      .toLocaleTimeString(
        "tr-TR",
        {
          hour: "2-digit",
          minute:
            "2-digit",
        }
      );
  }

  return date
    .toLocaleDateString(
      "tr-TR",
      {
        day: "2-digit",
        month: "2-digit",
      }
    );
}

function formatBytes(
  value?: number
) {
  if (!value) {
    return "";
  }

  if (
    value < 1024
  ) {
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

function extractEmailAddresses(
  value: string
) {
  const matches =
    value.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
    ) || [];

  return Array.from(
    new Set(
      matches.map(
        (item) =>
          item
            .trim()
            .toLowerCase()
      )
    )
  );
}

function replySubject(
  value: string
) {
  return /^re:/i.test(
    value.trim()
  )
    ? value
    : `Re: ${value}`;
}

function forwardSubject(
  value: string
) {
  return /^(fwd|fw):/i.test(
    value.trim()
  )
    ? value
    : `Fwd: ${value}`;
}
export default function InboxPage() {
  const [
    connections,
    setConnections,
  ] =
    useState<
      Connection[]
    >([]);

  const [
    selectedConnectionId,
    setSelectedConnectionId,
  ] =
    useState("");

  const [
    folder,
    setFolder,
  ] =
    useState<MailFolder>(
      "inbox"
    );

  const [
    messages,
    setMessages,
  ] =
    useState<
      MailSummary[]
    >([]);

  const [
    selectedSummary,
    setSelectedSummary,
  ] =
    useState<
      MailSummary | null
    >(null);

  const [
    selectedMail,
    setSelectedMail,
  ] =
    useState<
      MailDetail | null
    >(null);

  const [
    loadingAccounts,
    setLoadingAccounts,
  ] =
    useState(true);

  const [
    loadingList,
    setLoadingList,
  ] =
    useState(false);

  const [
    loadingDetail,
    setLoadingDetail,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    notice,
    setNotice,
  ] =
    useState("");

  const [
    composerError,
    setComposerError,
  ] =
    useState("");

  const [
    composerPosition,
    setComposerPosition,
  ] =
    useState({
      x: 0,
      y: 0,
    });

  const composerDrag =
    useRef<any>(null);
  const [
    mobileDetail,
    setMobileDetail,
  ] =
    useState(false);

  const [
    composerOpen,
    setComposerOpen,
  ] =
    useState(false);

  const [
    sending,
    setSending,
  ] =
    useState(false);

  const [
    composer,
    setComposer,
  ] =
    useState({
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      body: "",
    });

  const listAbort =
    useRef<
      AbortController | null
    >(null);

  const detailAbort =
    useRef<
      AbortController | null
    >(null);

  const selectedConnection =
    useMemo(
      () =>
        connections.find(
          (item) =>
            item.id ===
            selectedConnectionId
        ) ||
        null,
      [
        connections,
        selectedConnectionId,
      ]
    );

  useEffect(
    () => {
      let alive = true;

      async function loadAccounts() {
        try {
          setLoadingAccounts(
            true
          );

          const response =
            await fetch(
              "/api/mail-connection",
              {
                cache:
                  "no-store",
              }
            );

          const data =
            await response
              .json();

          if (
            !response.ok ||
            data?.ok !==
              true
          ) {
            throw new Error(
              data?.error ||
              "Posta hesapları alınamadı."
            );
          }

          const available:
            Connection[] =
            Array.isArray(
              data
                ?.connections
            )
              ? data
                  .connections
              : [];

          if (!alive) {
            return;
          }

          setConnections(
            available
          );

          const remembered =
            window
              .localStorage
              .getItem(
                ACCOUNT_KEY
              ) ||
            "";

          const initial =
            available.some(
              (item) =>
                item.id ===
                remembered
            )
              ? remembered
              : available[0]
                  ?.id ||
                "";

          setSelectedConnectionId(
            initial
          );
        } catch (
          loadError
        ) {
          if (!alive) {
            return;
          }

          setError(
            loadError instanceof
            Error
              ? loadError
                  .message
              : "Posta hesapları alınamadı."
          );
        } finally {
          if (alive) {
            setLoadingAccounts(
              false
            );
          }
        }
      }

      loadAccounts();

      return () => {
        alive = false;
      };
    },
    []
  );

  const loadMessages =
    useCallback(
      async (
        silent = false
      ) => {
        if (
          !selectedConnectionId
        ) {
          setMessages([]);
          return;
        }

        listAbort.current
          ?.abort();

        const controller =
          new AbortController();

        listAbort.current =
          controller;

        try {
          if (!silent) {
            setLoadingList(
              true
            );
          }

          setError("");

          const response =
            await fetch(
              `/api/mail/messages?connectionId=${encodeURIComponent(
                selectedConnectionId
              )}&folder=${folder}`,
              {
                cache:
                  "no-store",

                signal:
                  controller
                    .signal,
              }
            );

          const data =
            await response
              .json();

          if (
            !response.ok ||
            data?.ok !== true
          ) {
            throw new Error(
              data?.error ||
              "Posta klasörü alınamadı."
            );
          }

          setMessages(
            Array.isArray(
              data.messages
            )
              ? data.messages
              : []
          );
        } catch (
          loadError
        ) {
          if (
            controller
              .signal
              .aborted
          ) {
            return;
          }

          setError(
            loadError instanceof
            Error
              ? loadError
                  .message
              : "Posta klasörü alınamadı."
          );
        } finally {
          if (
            !controller
              .signal
              .aborted &&
            !silent
          ) {
            setLoadingList(
              false
            );
          }
        }
      },
      [
        selectedConnectionId,
        folder,
      ]
    );

  useEffect(
    () => {
      if (
        !selectedConnectionId
      ) {
        return;
      }

      setMessages([]);
      setSelectedSummary(
        null
      );
      setSelectedMail(
        null
      );
      setMobileDetail(
        false
      );

      loadMessages(false);

      return () => {
        listAbort.current
          ?.abort();
      };
    },
    [
      selectedConnectionId,
      folder,
      loadMessages,
    ]
  );

  useEffect(
    () => {
      if (
        !selectedConnectionId
      ) {
        return;
      }

      const refresh =
        () => {
          if (
            document
              .visibilityState ===
            "visible"
          ) {
            loadMessages(
              true
            );
          }
        };

      const timer =
        window.setInterval(
          refresh,
          folder === "inbox"
            ? 10_000
            : 30_000
        );

      window.addEventListener(
        "focus",
        refresh
      );

      document
        .addEventListener(
          "visibilitychange",
          refresh
        );

      return () => {
        window.clearInterval(
          timer
        );

        window
          .removeEventListener(
            "focus",
            refresh
          );

        document
          .removeEventListener(
            "visibilitychange",
            refresh
          );
      };
    },
    [
      selectedConnectionId,
      folder,
      loadMessages,
    ]
  );

  useEffect(
    () => {
      if (
        selectedConnection
          ?.provider !==
        "google" ||
      folder !== "inbox"
      ) {
        return;
      }

      const timer =
        window.setTimeout(
          () => {
            fetch(
              "/api/mail-sync",
              {
                method:
                  "POST",
              }
            ).catch(
              () => {}
            );
          },
          2500
        );

      return () =>
        window.clearTimeout(
          timer
        );
    },
    [
      selectedConnection
        ?.id,
      selectedConnection
        ?.provider,
      folder,
    ]
  );

  async function openMail(
    summary: MailSummary
  ) {
    if (
      !selectedConnectionId
    ) {
      return;
    }

    detailAbort.current
      ?.abort();

    const controller =
      new AbortController();

    detailAbort.current =
      controller;

    setSelectedSummary(
      summary
    );

    setSelectedMail(
      null
    );

    setMobileDetail(
      true
    );

    setLoadingDetail(
      true
    );

    setError("");

    try {
      const response =
        await fetch(
          `/api/mail/message?connectionId=${encodeURIComponent(
            selectedConnectionId
          )}&folder=${folder}&id=${encodeURIComponent(
            summary.id
          )}`,
          {
            cache:
              "no-store",

            signal:
              controller
                .signal,
          }
        );

      const data =
        await response
          .json();

      if (
        !response.ok ||
        data?.ok !== true
      ) {
        throw new Error(
          data?.error ||
          "İleti açılamadı."
        );
      }

      setSelectedMail(
        data.message
      );
    } catch (
      openError
    ) {
      if (
        controller
          .signal
          .aborted
      ) {
        return;
      }

      setError(
        openError instanceof
        Error
          ? openError.message
          : "İleti açılamadı."
      );
    } finally {
      if (
        !controller
          .signal
          .aborted
      ) {
        setLoadingDetail(
          false
        );
      }
    }
  }

  function changeAccount(
    value: string
  ) {
    window
      .localStorage
      .setItem(
        ACCOUNT_KEY,
        value
      );

    setSelectedConnectionId(
      value
    );
  }

  function changeFolder(
    next:
      MailFolder
  ) {
    setFolder(next);
  }

  function resetComposer() {
    setComposer({
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      body: "",
    });
  }

  function startComposerDrag(
    event: any
  ) {
    if (
      window.innerWidth <=
      760
    ) {
      return;
    }

    const target =
      event.target as HTMLElement;

    if (
      target.closest(
        "button,input,textarea,select,a"
      )
    ) {
      return;
    }

    composerDrag.current = {
      pointerId:
        event.pointerId,

      startX:
        event.clientX,

      startY:
        event.clientY,

      originX:
        composerPosition.x,

      originY:
        composerPosition.y,
    };

    try {
      event.currentTarget
        .setPointerCapture(
          event.pointerId
        );
    } catch {}
  }

  function moveComposerDrag(
    event: any
  ) {
    const drag =
      composerDrag.current;

    if (
      !drag ||
      drag.pointerId !==
        event.pointerId
    ) {
      return;
    }

    setComposerPosition({
      x:
        drag.originX +
        (
          event.clientX -
          drag.startX
        ),

      y:
        drag.originY +
        (
          event.clientY -
          drag.startY
        ),
    });
  }

  function endComposerDrag(
    event: any
  ) {
    if (
      composerDrag.current
        ?.pointerId !==
      event.pointerId
    ) {
      return;
    }

    composerDrag.current =
      null;

    try {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId
        );
    } catch {}
  }

  function openMailComposer(
    mode:
      | "new"
      | "reply"
      | "replyAll"
      | "forward"
      | "draft"
  ) {
    setComposerError("");
    setComposerPosition({
      x: 0,
      y: 0,
    });

    if (
      mode === "new" ||
      !selectedMail
    ) {
      resetComposer();
      setComposerOpen(true);
      return;
    }

    const ownEmail =
      (
        selectedConnection
          ?.email ||
        ""
      )
        .trim()
        .toLowerCase();

    if (
      mode === "draft"
    ) {
      setComposer({
        to:
          selectedMail.to ||
          "",

        cc:
          selectedMail.cc ||
          "",

        bcc: "",

        subject:
          selectedMail.subject ||
          "",

        body:
          selectedMail.body ||
          "",
      });

      setComposerOpen(true);
      return;
    }

    if (
      mode === "forward"
    ) {
      setComposer({
        to: "",
        cc: "",
        bcc: "",

        subject:
          forwardSubject(
            selectedMail.subject ||
            ""
          ),

        body:
          `

---------- İletilen ileti ----------
Gönderen: ${selectedMail.sender || ""}
Tarih: ${selectedMail.date || ""}
Konu: ${selectedMail.subject || ""}

${selectedMail.body || ""}`,
      });

      setComposerOpen(true);
      return;
    }

    const sender =
      extractEmailAddresses(
        selectedMail.sender ||
        ""
      );

    const originalTo =
      extractEmailAddresses(
        selectedMail.to ||
        ""
      );

    const originalCc =
      extractEmailAddresses(
        selectedMail.cc ||
        ""
      );

    const recipients =
      mode === "replyAll"
        ? [
            ...sender,
            ...originalTo,
            ...originalCc,
          ]
        : sender;

    const unique =
      Array.from(
        new Set(
          recipients.filter(
            (email) =>
              email !==
              ownEmail
          )
        )
      );

    setComposer({
      to:
        unique.join(", "),

      cc: "",
      bcc: "",

      subject:
        replySubject(
          selectedMail.subject ||
          ""
        ),

      body:
        `

---------- Önceki ileti ----------
${selectedMail.body || ""}`,
    });

    setComposerOpen(true);
  }
  async function sendMail() {
    if (
      !selectedConnectionId ||
      sending
    ) {
      return;
    }

    try {
      setSending(true);
      setError("");
      setNotice("");
      setComposerError("");

      const response =
        await fetch(
          "/api/mail/send",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                connectionId:
                  selectedConnectionId,

                ...composer,
              }),
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => null
          );

      if (
        !response.ok ||
        data?.ok !== true
      ) {
        throw new Error(
          data?.error ||
          `İleti gönderilemedi. HTTP ${response.status}`
        );
      }

      setNotice(
        "İleti gönderildi."
      );

      setComposerError("");

      resetComposer();

      setComposerOpen(
        false
      );

      setFolder(
        "sent"
      );
    } catch (
      sendError
    ) {
      setComposerError(
        sendError instanceof
        Error
          ? sendError.message
          : "İleti gönderilemedi."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="legal-app mether-posta">
      <CalendarWriteToast />
      <header className="posta-header">
        <div className="brand-side">
          <LegalBrand compact />

          <span className="brand-context">
            Posta
          </span>
        </div>

        <div className="header-tools">
          <button
            type="button"
            className="compose-primary"
            onClick={() => openMailComposer("new")}
            disabled={
              !selectedConnectionId
            }
          >
            + Yeni İleti
          </button>

          <div className="account-side">
            <span className="provider-mark">
              {providerMark(
                selectedConnection
                  ?.provider ||
                  ""
              )}
            </span>

            <select
              aria-label="Posta hesabı"
              value={
                selectedConnectionId
              }
              disabled={
                loadingAccounts ||
                connections.length ===
                  0
              }
              onChange={(
                event
              ) =>
                changeAccount(
                  event.target
                    .value
                )
              }
            >
              {connections.map(
                (
                  connection
                ) => (
                  <option
                    key={
                      connection.id
                    }
                    value={
                      connection.id
                    }
                  >
                    {providerName(
                      connection.provider
                    )} ·{" "}
                    {connection.email ||
                      "Hesap"}
                  </option>
                )
              )}
            </select>

            <a
              href="/mail-connect"
              className="accounts-button"
              title="Posta hesapları"
            >
              âš™
            </a>
          </div>
        </div>
      </header>

      <section className="posta-toolbar">
        <nav className="folder-tabs">
          {FOLDERS.map(
            (item) => (
              <button
                type="button"
                key={
                  item.id
                }
                className={`folder ${
                  folder ===
                  item.id
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  changeFolder(
                    item.id
                  )
                }
              >
                {item.label}
              </button>
            )
          )}
        </nav>

        <div className="sync-status">
          <span>
            {loadingList
              ? "Posta getiriliyor..."
              : `${messages.length} ileti`}
          </span>

          <button
            type="button"
            className="refresh"
            disabled={
              loadingList ||
              !selectedConnectionId
            }
            onClick={() =>
              loadMessages(
                false
              )
            }
            title="Yenile"
          >
            ↻
          </button>
        </div>
      </section>

      {(error ||
        notice) && (
        <div
          className={
            error
              ? "posta-message error"
              : "posta-message success"
          }
        >
          {error ||
            notice}
        </div>
      )}

      <section className="posta-workspace">
        <aside
          className={
            mobileDetail
              ? "mail-pane mobile-hidden"
              : "mail-pane"
          }
        >
          <div className="list-head">
            <div>
              <strong>
                {folderLabel(
                  folder
                )}
              </strong>

              <span>
                {selectedConnection
                  ?.email ||
                  "Posta hesabı"}
              </span>
            </div>

            <span className="provider-label">
              {providerName(
                selectedConnection
                  ?.provider ||
                  ""
              )}
            </span>
          </div>

          <div className="mail-list">
            {loadingList &&
            messages.length ===
              0 ? (
              <div className="list-state">
                Postalar getiriliyor...
              </div>
            ) : messages.length ===
              0 ? (
              <div className="list-state">
                Bu klasör boş.
              </div>
            ) : (
              messages.map(
                (mail) => (
                  <button
                    type="button"
                    key={
                      mail.id
                    }
                    className={`mail-row ${
                      mail.unread
                        ? "unread"
                        : ""
                    } ${
                      selectedSummary
                        ?.id ===
                      mail.id
                        ? "selected"
                        : ""
                    }`}
                    onClick={() =>
                      openMail(
                        mail
                      )
                    }
                  >
                    <div className="mail-top">
                      <strong>
                        {mail.sender ||
                          "â€”"}
                      </strong>

                      <time>
                        {formatDate(
                          mail.date
                        )}
                      </time>
                    </div>

                    <div className="mail-subject">
                      {mail.unread &&
                      folder ===
                        "inbox" ? (
                        <i />
                      ) : null}

                      <span>
                        {mail.subject ||
                          "(Konu yok)"}
                      </span>

                      {mail.hasAttachments && (
                        <b title="Ekli">
                          â–±
                        </b>
                      )}
                    </div>

                    {mail.snippet && (
                      <div className="mail-snippet">
                        {mail.snippet}
                      </div>
                    )}
                  </button>
                )
              )
            )}
          </div>
        </aside>

        <section
          className={
            mobileDetail
              ? "detail-pane"
              : "detail-pane mobile-hidden"
          }
        >
          {!selectedSummary ? (
            <div className="empty-detail">
              <div className="empty-mark">
                ✉
              </div>

              <strong>
                Postanız hazır.
              </strong>

              <span>
                Sol taraftan bir ileti seçin.
              </span>
            </div>
          ) : loadingDetail ? (
            <div className="empty-detail">
              <div className="empty-mark pulse">
                ✉
              </div>

              <strong>
                İleti açılıyor...
              </strong>
            </div>
          ) : selectedMail ? (
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
                    {providerName(
                      selectedConnection
                        ?.provider ||
                        ""
                    )} ·{" "}
                    {folderLabel(
                      folder
                    ).toLocaleUpperCase(
                      "tr-TR"
                    )}
                  </div>

                  <h1>
                    {selectedMail.subject ||
                      "(Konu yok)"}
                  </h1>

                  <div className="detail-meta">
                    <span>
                      {selectedMail.sender}
                    </span>

                    {selectedMail.date && (
                      <>
                        <i />
                        <span>
                          {formatDate(
                            selectedMail.date
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {(selectedMail
                .to ||
                selectedMail
                  .cc) && (
                <div className="recipient-line">
                  {selectedMail
                    .to && (
                    <span>
                      <b>
                        Kime:
                      </b>{" "}
                      {
                        selectedMail.to
                      }
                    </span>
                  )}

                  {selectedMail
                    .cc && (
                    <span>
                      <b>
                        Bilgi:
                      </b>{" "}
                      {
                        selectedMail.cc
                      }
                    </span>
                  )}
                </div>
              )}

              {selectedMail
                .attachments &&
                selectedMail
                  .attachments
                  .length >
                  0 && (
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
                            key={`${attachment.attachmentId || attachment.filename}-${index}`}
                          >
                            <span className="attachment-icon">
                              â–±
                            </span>

                            <div>
                              <strong>
                                {attachment.filename}
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

                            <div className="attachment-actions">
                              <a
                                href={`/api/mail/attachment?connectionId=${encodeURIComponent(
                                  selectedConnectionId
                                )}&folder=${folder}&messageId=${encodeURIComponent(
                                  selectedMail.id
                                )}&attachmentId=${encodeURIComponent(
                                  attachment.attachmentId || ""
                                )}&filename=${encodeURIComponent(attachment.filename || "dosya")}&mimeType=${encodeURIComponent(attachment.mimeType || "application/octet-stream")}&mode=open`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Aç
                              </a>

                              <a
                                href={`/api/mail/attachment?connectionId=${encodeURIComponent(
                                  selectedConnectionId
                                )}&folder=${folder}&messageId=${encodeURIComponent(
                                  selectedMail.id
                                )}&attachmentId=${encodeURIComponent(
                                  attachment.attachmentId || ""
                                )}&filename=${encodeURIComponent(attachment.filename || "dosya")}&mimeType=${encodeURIComponent(attachment.mimeType || "application/octet-stream")}&mode=download`}
                              >
                                İndir
                              </a>
                            </div>
                          </div>
                        )
                      )}
                  </div>
                )}

                            <div className="mail-action-bar">
                {folder === "drafts" ? (
                  <button
                    type="button"
                    onClick={() =>
                      openMailComposer(
                        "draft"
                      )
                    }
                  >
                    Taslağı Düzenle
                  </button>
                ) : (
                  <>
                    {folder !== "sent" && (
                      <button
                        type="button"
                        onClick={() =>
                          openMailComposer(
                            "reply"
                          )
                        }
                      >
                        Yanıtla
                      </button>
                    )}

                    {folder !== "sent" && (
                      <button
                        type="button"
                        onClick={() =>
                          openMailComposer(
                            "replyAll"
                          )
                        }
                      >
                        Tümüne Yanıtla
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        openMailComposer(
                          "forward"
                        )
                      }
                    >
                      İlet
                    </button>
                  </>
                )}
              </div>
<article className="mail-content">
                {selectedMail.body ||
                  "Mail içeriği bulunmuyor."}
              </article>
            </>
          ) : (
            <div className="empty-detail">
              <strong>
                İleti açılamadı.
              </strong>
            </div>
          )}
        </section>
      </section>

      {composerOpen && (
        <div
          className="composer-backdrop"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget &&
              !sending
            ) {
              setComposerOpen(
                false
              );
            }
          }}
        >
          <section
            className="composer"
            style={{
              transform:
                `translate(${composerPosition.x}px, ${composerPosition.y}px)`,
            }}
          >
            <header
              className="composer-drag-handle"
              onPointerDown={
                startComposerDrag
              }
              onPointerMove={
                moveComposerDrag
              }
              onPointerUp={
                endComposerDrag
              }
              onPointerCancel={
                endComposerDrag
              }
            >
              <div>
                <strong>
                  Yeni İleti
                </strong>

                <span>
                  {selectedConnection
                    ?.email ||
                    "Posta hesabı"}
                </span>
              </div>

              <button
                type="button"
                disabled={
                  sending
                }
                onClick={() =>
                  setComposerOpen(
                    false
                  )
                }
              >
                ×
              </button>
            </header>
            {composerError && (
              <div className="composer-inline-error">
                {composerError}
              </div>
            )}

            <div className="compose-field">
              <label>
                Kime
              </label>

              <input
                value={
                  composer.to
                }
                onChange={(
                  event
                ) =>
                  setComposer({
                    ...composer,
                    to:
                      event
                        .target
                        .value,
                  })
                }
                placeholder="ornek@firma.com"
              />
            </div>

            <div className="compose-two">
              <div className="compose-field">
                <label>
                  Bilgi
                </label>

                <input
                  value={
                    composer.cc
                  }
                  onChange={(
                    event
                  ) =>
                    setComposer({
                      ...composer,
                      cc:
                        event
                          .target
                          .value,
                    })
                  }
                  placeholder="Cc"
                />
              </div>

              <div className="compose-field">
                <label>
                  Gizli
                </label>

                <input
                  value={
                    composer.bcc
                  }
                  onChange={(
                    event
                  ) =>
                    setComposer({
                      ...composer,
                      bcc:
                        event
                          .target
                          .value,
                    })
                  }
                  placeholder="Bcc"
                />
              </div>
            </div>

            <div className="compose-field">
              <label>
                Konu
              </label>

              <input
                value={
                  composer.subject
                }
                onChange={(
                  event
                ) =>
                  setComposer({
                    ...composer,
                    subject:
                      event
                        .target
                        .value,
                  })
                }
                placeholder="İleti konusu"
              />
            </div>

            <textarea
              className="compose-body"
              value={
                composer.body
              }
              onChange={(
                event
              ) =>
                setComposer({
                  ...composer,
                  body:
                    event
                      .target
                      .value,
                })
              }
              placeholder="Mesajınızı yazın..."
            />

            <footer>
              <span>
                {providerName(
                  selectedConnection
                    ?.provider ||
                    ""
                )}
              </span>

              <button
                type="button"
                className="send-button"
                disabled={
                  sending ||
                  !composer.to
                    .trim()
                }
                onClick={
                  sendMail
                }
              >
                {sending
                  ? "Gönderiliyor..."
                  : "Gönder"}
              </button>
            </footer>
          </section>
        </div>
      )}

      <LegalDock />

      <style jsx>{`
        .mether-posta {
          height: 100dvh;
          overflow: hidden;
          display: grid;
          grid-template-rows:
            56px
            44px
            auto
            minmax(0, 1fr);
          padding-bottom: 64px;
          background:
            var(--legal-bg);
          color:
            var(--legal-text);
        }

        .posta-header {
          display: flex;
          align-items: center;
          justify-content:
            space-between;
          gap: 16px;
          padding:
            0 16px;
          border-bottom:
            1px solid
            var(--legal-border);
          background:
            var(--legal-surface);
        }

        .brand-side,
        .header-tools,
        .account-side {
          display: flex;
          align-items: center;
        }

        .brand-side {
          gap: 10px;
          min-width: 0;
        }

        .brand-context {
          font-size: 16px;
          font-weight: 650;
        }

        .header-tools {
          gap: 8px;
          min-width: 0;
        }

        .compose-primary {
          height: 32px;
          padding:
            0 13px;
          border:
            1px solid
            var(--legal-gold);
          border-radius: 10px;
          background:
            color-mix(
              in srgb,
              var(--legal-gold)
                12%,
              var(--legal-surface)
            );
          color:
            var(--legal-gold);
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .account-side {
          gap: 6px;
          min-width: 0;
        }

        .provider-mark {
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
          font-size: 10px;
          font-weight: 900;
        }

        .account-side select {
          width:
            min(
              310px,
              36vw
            );
          height: 32px;
          padding:
            0 28px
            0 10px;
          border:
            1px solid
            var(--legal-border);
          border-radius: 9px;
          outline: none;
          background:
            var(--legal-surface-2);
          color:
            var(--legal-text);
          font-size: 9px;
          font-weight: 750;
        }

        .accounts-button {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border:
            1px solid
            var(--legal-border);
          border-radius: 9px;
          text-decoration: none;
          color:
            var(--legal-gold);
          background:
            var(--legal-surface-2);
        }

        .posta-toolbar {
          display: flex;
          align-items: center;
          justify-content:
            space-between;
          gap: 10px;
          padding:
            5px 12px;
          border-bottom:
            1px solid
            var(--legal-border);
          background:
            var(--legal-surface);
        }

        .folder-tabs {
          display: flex;
          gap: 4px;
        }

        .folder {
          height: 31px;
          padding:
            0 12px;
          border:
            1px solid
            transparent;
          border-radius: 9px;
          background:
            transparent;
          color:
            var(--legal-muted);
          font-size: 8.5px;
          font-weight: 800;
          cursor: pointer;
        }

        .folder:hover {
          background:
            var(--legal-surface-2);
        }

        .folder.active {
          border-color:
            color-mix(
              in srgb,
              var(--legal-gold)
                42%,
              var(--legal-border)
            );
          background:
            var(--legal-surface-2);
          color:
            var(--legal-gold);
        }

        .sync-status {
          display: flex;
          align-items: center;
          gap: 7px;
          color:
            var(--legal-muted);
          font-size: 8px;
        }

        .refresh {
          width: 30px;
          height: 30px;
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

        .posta-message {
          margin:
            6px 12px
            0;
          padding:
            7px 10px;
          border-radius: 9px;
          font-size: 8.5px;
        }

        .posta-message.error {
          border:
            1px solid
            color-mix(
              in srgb,
              var(--legal-danger)
                40%,
              transparent
            );
          color:
            var(--legal-danger);
        }

        .posta-message.success {
          border:
            1px solid
            color-mix(
              in srgb,
              var(--legal-success)
                40%,
              transparent
            );
          color:
            var(--legal-success);
        }

        .posta-workspace {
          min-height: 0;
          min-width: 0;
          display: grid;
          grid-template-columns:
            minmax(
              320px,
              33%
            )
            minmax(
              0,
              1fr
            );
          gap: 8px;
          padding:
            8px 10px
            0;
          overflow: hidden;
        }

        .mail-pane,
        .detail-pane {
          min-height: 0;
          min-width: 0;
          border:
            1px solid
            var(--legal-border);
          border-radius:
            var(--legal-radius-lg);
          background:
            var(--legal-surface);
          overflow: hidden;
        }

        .mail-pane {
          display: grid;
          grid-template-rows:
            48px
            minmax(
              0,
              1fr
            );
        }

        .list-head {
          display: flex;
          align-items: center;
          justify-content:
            space-between;
          gap: 8px;
          padding:
            0 11px;
          border-bottom:
            1px solid
            var(--legal-border);
        }

        .list-head > div {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .list-head strong {
          font-size: 11px;
        }

        .list-head span {
          overflow: hidden;
          text-overflow:
            ellipsis;
          white-space:
            nowrap;
          color:
            var(--legal-muted);
          font-size: 7.5px;
        }

        .provider-label {
          padding:
            3px 7px;
          border:
            1px solid
            var(--legal-border);
          border-radius: 999px;
          color:
            var(--legal-gold) !important;
          font-size:
            7px !important;
          font-weight: 850;
        }

        .mail-list {
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .mail-row {
          width: 100%;
          min-width: 0;
          display: grid;
          gap: 4px;
          padding:
            9px 11px;
          border: 0;
          border-bottom:
            1px solid
            var(--legal-border);
          background:
            transparent;
          color:
            var(--legal-text);
          text-align: left;
          cursor: pointer;
        }

        .mail-row:hover,
        .mail-row.selected {
          background:
            var(--legal-surface-2);
        }

        .mail-row.selected {
          box-shadow:
            inset 2px 0
            var(--legal-gold);
        }

        .mail-top {
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content:
            space-between;
          gap: 8px;
        }

        .mail-top strong {
          min-width: 0;
          overflow: hidden;
          text-overflow:
            ellipsis;
          white-space:
            nowrap;
          font-size: 9px;
          font-weight: 650;
        }

        .mail-row.unread
        .mail-top strong {
          font-weight: 900;
        }

        .mail-top time {
          flex: 0 0 auto;
          color:
            var(--legal-muted);
          font-size: 7px;
        }

        .mail-subject {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .mail-subject i {
          width: 5px;
          height: 5px;
          flex: 0 0 auto;
          border-radius: 50%;
          background:
            var(--legal-gold);
        }

        .mail-subject span {
          min-width: 0;
          overflow: hidden;
          text-overflow:
            ellipsis;
          white-space:
            nowrap;
          font-size: 9px;
          font-weight: 700;
        }

        .mail-row.unread
        .mail-subject span {
          font-weight: 900;
        }

        .mail-subject b {
          margin-left: auto;
          color:
            var(--legal-gold);
        }

        .mail-snippet {
          overflow: hidden;
          display:
            -webkit-box;
          -webkit-box-orient:
            vertical;
          -webkit-line-clamp:
            1;
          color:
            var(--legal-muted);
          font-size: 8px;
          line-height: 1.35;
          overflow-wrap:
            anywhere;
        }

        .list-state {
          padding: 28px;
          text-align: center;
          color:
            var(--legal-muted);
          font-size: 9px;
        }

        .detail-pane {
          display: flex;
          flex-direction: column;
        }

        .detail-header {
          min-height: 82px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 0 0 auto;
          padding:
            14px 18px;
          border-bottom:
            1px solid
            var(--legal-border);
        }

        .detail-heading {
          width: 100%;
          min-width: 0;
        }

        .detail-kicker {
          margin-bottom: 4px;
          color:
            var(--legal-gold);
          font-size: 7px;
          font-weight: 900;
          letter-spacing:
            .12em;
        }

        .detail-heading h1 {
          margin: 0;
          overflow: hidden;
          text-overflow:
            ellipsis;
          white-space:
            nowrap;
          font-size:
            clamp(
              13px,
              1.4vw,
              17px
            );
        }

        .detail-meta {
          margin-top: 6px;
          display: flex;
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
          white-space:
            nowrap;
        }

        .detail-meta i {
          width: 3px;
          height: 3px;
          flex: 0 0 auto;
          border-radius: 50%;
          background:
            var(--legal-gold);
        }

        .recipient-line {
          display: grid;
          gap: 3px;
          padding:
            7px 18px;
          border-bottom:
            1px solid
            var(--legal-border);
          color:
            var(--legal-muted);
          font-size: 7.5px;
        }

        .recipient-line b {
          color:
            var(--legal-text);
        }

        .attachments-strip {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding:
            8px 18px;
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
          padding:
            7px 9px;
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
          white-space:
            nowrap;
          font-size: 8.5px;
        }

        .attachment-chip span {
          color:
            var(--legal-muted);
          font-size: 7px;
        }

        .mail-content {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding:
            20px 24px;
          color:
            var(--legal-text-soft);
          font-size: 10.5px;
          line-height: 1.7;
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
        }

        .empty-mark.pulse {
          animation:
            pulse 1s
            infinite
            alternate;
        }

        @keyframes pulse {
          from {
            opacity: .45;
          }

          to {
            opacity: 1;
          }
        }

        .empty-detail strong {
          font-size: 11px;
        }

        .empty-detail span {
          margin-top: 5px;
          color:
            var(--legal-muted);
          font-size: 9px;
        }

        .mobile-back {
          display: none;
        }

        .composer-backdrop {
          position: fixed;
          inset: 0;
          z-index: 5000;
          display: grid;
          place-items: end;
          padding: 18px;
          background:
            rgba(
              0,
              0,
              0,
              .36
            );
          backdrop-filter:
            blur(3px);
        }

        .composer {
          width:
            min(
              620px,
              calc(
                100vw -
                36px
              )
            );
          max-height:
            calc(
              100dvh -
              36px
            );
          display: grid;
          gap: 9px;
          padding: 14px;
          border:
            1px solid
            var(--legal-border);
          border-radius: 16px;
          background:
            var(--legal-surface);
          box-shadow:
            var(--legal-shadow-lg);
        }

        .composer > header {
          display: flex;
          align-items: center;
          justify-content:
            space-between;
          gap: 10px;
          padding-bottom: 9px;
          border-bottom:
            1px solid
            var(--legal-border);
        }

        .composer > header div {
          display: grid;
          gap: 2px;
        }

        .composer > header strong {
          font-size: 12px;
        }

        .composer > header span {
          color:
            var(--legal-muted);
          font-size: 8px;
        }

        .composer > header button {
          width: 30px;
          height: 30px;
          border:
            1px solid
            var(--legal-border);
          border-radius: 9px;
          background:
            var(--legal-surface-2);
          color:
            var(--legal-text);
          cursor: pointer;
        }

        .compose-field {
          display: grid;
          gap: 4px;
        }

        .compose-field label {
          color:
            var(--legal-muted);
          font-size: 7.5px;
          font-weight: 800;
        }

        .compose-field input,
        .compose-body {
          width: 100%;
          border:
            1px solid
            var(--legal-border);
          border-radius: 9px;
          outline: none;
          background:
            var(--legal-surface-2);
          color:
            var(--legal-text);
        }

        .compose-field input {
          height: 34px;
          padding:
            0 10px;
          font-size: 9px;
        }

        .compose-two {
          display: grid;
          grid-template-columns:
            1fr 1fr;
          gap: 8px;
        }

        .compose-body {
          min-height: 220px;
          resize: vertical;
          padding: 11px;
          font-family: inherit;
          font-size: 10px;
          line-height: 1.6;
        }

        .composer footer {
          display: flex;
          align-items: center;
          justify-content:
            space-between;
          gap: 10px;
        }

        .composer footer span {
          color:
            var(--legal-muted);
          font-size: 8px;
        }

        .send-button {
          min-width: 92px;
          height: 34px;
          padding:
            0 15px;
          border:
            1px solid
            var(--legal-gold);
          border-radius: 10px;
          background:
            var(--legal-gold);
          color: #101010;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .send-button:disabled,
        .compose-primary:disabled {
          opacity: .48;
          cursor: default;
        }

        @media (
          max-width:
            760px
        ) {
          .mether-posta {
            grid-template-rows:
              auto
              auto
              auto
              minmax(
                0,
                1fr
              );

            padding-bottom:
              calc(
                70px +
                env(
                  safe-area-inset-bottom
                )
              );
          }

          .posta-header {
            flex-wrap: wrap;
            padding:
              7px 9px;
          }

          .brand-context {
            font-size: 13px;
          }

          .header-tools {
            flex: 1;
            justify-content:
              flex-end;
          }

          .compose-primary {
            padding:
              0 9px;
          }

          .provider-mark {
            display: none;
          }

          .account-side select {
            width:
              min(
                220px,
                50vw
              );
          }

          .posta-toolbar {
            padding:
              5px 7px;
          }

          .folder-tabs {
            min-width: 0;
            overflow-x: auto;
          }

          .folder {
            flex:
              0 0 auto;
            padding:
              0 9px;
          }

          .sync-status > span {
            display: none;
          }

          .posta-workspace {
            display: block;
            padding:
              6px 7px
              0;
            overflow: visible;
          }

          .mail-pane,
          .detail-pane {
            width: 100%;
            height: 100%;
            border-radius:
              13px;
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
            border-radius:
              9px;
            background:
              var(--legal-surface-2);
            color:
              var(--legal-gold);
          }

          .detail-header {
            align-items:
              flex-start;
            padding:
              11px 12px;
          }

          .detail-heading h1 {
            white-space:
              normal;
            display:
              -webkit-box;
            -webkit-box-orient:
              vertical;
            -webkit-line-clamp:
              2;
            font-size: 13px;
            line-height: 1.3;
          }

          .recipient-line,
          .attachments-strip {
            padding-left:
              11px;
            padding-right:
              11px;
          }

          .mail-content {
            padding: 13px;
            font-size: 10px;
          }

          .composer-backdrop {
            padding: 0;
          }

          .composer {
            width: 100%;
            height: 100dvh;
            max-height: 100dvh;
            border-radius: 0;
            padding:
              calc(
                12px +
                env(
                  safe-area-inset-top
                )
              )
              11px
              calc(
                12px +
                env(
                  safe-area-inset-bottom
                )
              );
          }

          .compose-two {
            grid-template-columns:
              1fr;
          }

          .compose-body {
            min-height: 0;
            height: 100%;
          }
        }
      
        .composer-drag-handle {
          cursor: move;
          user-select: none;
          touch-action: none;
        }

        .composer-inline-error {
          padding: 9px 10px;

          border:
            1px solid
            color-mix(
              in srgb,
              var(--legal-danger)
                45%,
              transparent
            );

          border-radius: 9px;

          background:
            color-mix(
              in srgb,
              var(--legal-danger)
                8%,
              var(--legal-surface)
            );

          color:
            var(--legal-danger);

          font-size: 9px;
          line-height: 1.45;
        }

        @media (max-width: 760px) {
          .composer {
            transform: none !important;
          }

          .composer-drag-handle {
            cursor: default;
            touch-action: auto;
          }
        }

        .mail-action-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;

          padding:
            8px 18px;

          border-bottom:
            1px solid
            var(--legal-border);

          background:
            var(--legal-surface-2);
        }

        .mail-action-bar button {
          height: 29px;

          padding:
            0 10px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            8px;

          background:
            var(--legal-surface);

          color:
            var(--legal-text);

          font-size: 8px;
          font-weight: 800;

          cursor: pointer;
        }

        .mail-action-bar button:hover {
          border-color:
            var(--legal-gold);

          color:
            var(--legal-gold);
        }

        .attachment-actions {
          display: flex;
          gap: 4px;

          margin-left: auto;
        }

        .attachment-actions a {
          padding:
            4px 7px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            7px;

          color:
            var(--legal-gold);

          background:
            var(--legal-surface-2);

          text-decoration: none;

          font-size: 7px;
          font-weight: 850;
        }

        @media (max-width: 760px) {
          .mail-action-bar {
            padding:
              7px 11px;

            overflow-x: auto;
            flex-wrap: nowrap;
          }

          .mail-action-bar button {
            flex:
              0 0 auto;
          }
        }
`}</style>
    </main>
  );
}