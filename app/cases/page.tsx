"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import LegalDock from "@/components/LegalDock";

type LegalDeadline = {
  id: string;
  title?: string | null;
  calculated_due_date?: string | null;
  status?: string | null;
};

type CaseMail = {
  id: string;
  subject?: string | null;
  sender?: string | null;
  received_at?: string | null;
};

type LegalCase = {
  id: string;
  case_number?: string | null;
  court_name?: string | null;
  case_title?: string | null;
  case_type?: string | null;
  status?: string | null;
  risk_level?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  legal_deadlines?: LegalDeadline[];
  case_mails?: CaseMail[];
};

export default function CasesPage() {
  const [cases, setCases] =
    useState<LegalCase[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [manualOpen, setManualOpen] =
    useState(false);

  const [manualSaving, setManualSaving] =
    useState(false);

  const [manualCaseNo, setManualCaseNo] =
    useState("");

  const [manualCourt, setManualCourt] =
    useState("");

  const [manualTitle, setManualTitle] =
    useState("");

  const [openCaseId, setOpenCaseId] =
    useState("");

  const [openCaseTab, setOpenCaseTab] =
    useState<
      "mail" |
      "file" |
      "document" |
      "deadline" |
      "note" |
      ""
    >("");

  const [caseNote, setCaseNote] =
    useState("");

  const [caseNoteLoading, setCaseNoteLoading] =
    useState(false);

  const [caseNoteSaving, setCaseNoteSaving] =
    useState(false);

  const [caseNoteError, setCaseNoteError] =
    useState("");

  async function loadCases() {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch("/api/cases", {
          cache: "no-store",
        });

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Davalar alınamadı."
        );
      }

      setCases(
        data?.cases || []
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Davalar alınamadı."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCases();
  }, []);

  const filteredCases =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLocaleLowerCase("tr-TR");

      if (!value) {
        return cases;
      }

      return cases.filter((item) => {
        const text = [
          item.case_number,
          item.court_name,
          item.case_title,
          item.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("tr-TR");

        return text.includes(value);
      });
    }, [cases, search]);

  function formatDate(
    value?: string | null
  ) {
    if (!value) {
      return "—";
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
        month: "2-digit",
        year: "numeric",
      }
    ).format(date);
  }

  function getNearestDeadline(
    item: LegalCase
  ) {
    return (
      (item.legal_deadlines || [])
        .filter(
          (deadline) =>
            deadline.calculated_due_date
        )
        .sort(
          (a, b) =>
            new Date(
              a.calculated_due_date as string
            ).getTime() -
            new Date(
              b.calculated_due_date as string
            ).getTime()
        )[0] || null
    );
  }

  async function loadCaseNote(
    caseId: string
  ) {
    try {
      setCaseNoteLoading(true);
      setCaseNoteError("");

      const response = await fetch(
        `/api/case-notes?caseId=${encodeURIComponent(
          caseId
        )}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "Dava notu alınamadı."
        );
      }

      setCaseNote(
        data.note?.note_text || ""
      );
    } catch (error) {
      setCaseNote("");

      setCaseNoteError(
        error instanceof Error
          ? error.message
          : "Dava notu alınamadı."
      );
    } finally {
      setCaseNoteLoading(false);
    }
  }

  async function saveCaseNote(
    caseId: string
  ) {
    try {
      setCaseNoteSaving(true);
      setCaseNoteError("");

      const response = await fetch(
        "/api/case-notes",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            caseId,
            noteText: caseNote,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "Dava notu kaydedilemedi."
        );
      }
    } catch (error) {
      setCaseNoteError(
        error instanceof Error
          ? error.message
          : "Dava notu kaydedilemedi."
      );
    } finally {
      setCaseNoteSaving(false);
    }
  }

  async function deleteCaseNote(
    caseId: string
  ) {
    if (
      !window.confirm(
        "Bu dava notu kalıcı olarak silinsin mi?"
      )
    ) {
      return;
    }

    try {
      setCaseNoteSaving(true);
      setCaseNoteError("");

      const response = await fetch(
        `/api/case-notes?caseId=${encodeURIComponent(
          caseId
        )}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "Dava notu silinemedi."
        );
      }

      setCaseNote("");
    } catch (error) {
      setCaseNoteError(
        error instanceof Error
          ? error.message
          : "Dava notu silinemedi."
      );
    } finally {
      setCaseNoteSaving(false);
    }
  }

  function toggleCasePanel(
    caseId: string,
    tab:
      | "mail"
      | "file"
      | "document"
      | "deadline"
      | "note"
  ) {
    if (
      openCaseId === caseId &&
      openCaseTab === tab
    ) {
      setOpenCaseId("");
      setOpenCaseTab("");
      return;
    }

    setOpenCaseId(caseId);
    setOpenCaseTab(tab);

    if (tab === "note") {
      loadCaseNote(caseId);
    }
  }

  function getDeadlineState(
    value?: string | null
  ) {
    if (!value) {
      return "none";
    }

    const due = new Date(value);
    const now = new Date();

    due.setHours(23, 59, 59, 999);
    now.setHours(0, 0, 0, 0);

    const days =
      Math.ceil(
        (
          due.getTime() -
          now.getTime()
        ) /
          86400000
      );

    if (days < 0) return "overdue";
    if (days <= 1) return "critical";
    if (days <= 3) return "urgent";
    if (days <= 5) return "warning";
    if (days <= 7) return "soon";

    return "normal";
  }

  function getDeadlineText(
    value?: string | null
  ) {
    if (!value) {
      return "Süre yok";
    }

    const due = new Date(value);
    const now = new Date();

    due.setHours(23, 59, 59, 999);
    now.setHours(0, 0, 0, 0);

    const days =
      Math.ceil(
        (
          due.getTime() -
          now.getTime()
        ) /
          86400000
      );

    if (days < 0) return "Geçti";
    if (days === 0) return "Bugün";

    return `${days} gün`;
  }

  async function createManualCase() {
    const title =
      manualTitle.trim() ||
      manualCaseNo.trim();

    if (!title) {
      setError(
        "Dava başlığı veya dava numarası girin."
      );
      return;
    }

    try {
      setManualSaving(true);
      setError("");

      const response =
        await fetch(
          "/api/cases",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              case_title:
                title,

              case_number:
                manualCaseNo.trim() ||
                null,

              court_name:
                manualCourt.trim() ||
                null,

              source:
                "manual",
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Dava eklenemedi."
        );
      }

      setManualCaseNo("");
      setManualCourt("");
      setManualTitle("");
      setManualOpen(false);

      await loadCases();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Dava eklenemedi."
      );
    } finally {
      setManualSaving(false);
    }
  }

  return (
    <main className="cases-page">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          background: #060b18;
          color: #f7f9fc;
          font-family:
            Inter,
            Arial,
            sans-serif;
        }

        body {
          overflow: hidden;
        }

        .cases-page {
          min-height: 100vh;
          padding: 14px 26px 80px;
          background: #060b18;
        }

        .cases-shell {
          width: min(
            1680px,
            calc(100vw - 52px)
          );
          margin: 0 auto;
        }

        .cases-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 14px;
        }

        .cases-title small {
          display: block;
          margin-bottom: 5px;
          color: #66a4ff;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.18em;
        }

        .cases-title h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
        }

        .cases-title p {
          margin: 5px 0 0;
          color: #8296b6;
          font-size: 11px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .search-input {
          width: 245px;
          height: 36px;
          padding: 0 13px;
          border: 1px solid #243550;
          border-radius: 12px;
          outline: none;
          background: #0e1829;
          color: white;
          font-size: 11px;
        }

        .search-input:focus {
          border-color: #7659ff;
        }

        .manual-trigger {
          height: 36px;
          padding: 0 14px;
          border: 1px solid #30415f;
          border-radius: 12px;
          background: #111c2f;
          color: white;
          cursor: pointer;
          font-size: 11px;
          font-weight: 850;
        }

        .manual-form {
          display: grid;
          grid-template-columns:
            170px
            1fr
            1fr
            auto;
          gap: 8px;
          margin-bottom: 10px;
          padding: 9px;
          border: 1px solid #24344f;
          border-radius: 13px;
          background: #0d1626;
        }

        .manual-form input {
          min-width: 0;
          height: 34px;
          padding: 0 11px;
          border: 1px solid #263750;
          border-radius: 9px;
          outline: none;
          background: #09111f;
          color: white;
          font-size: 11px;
        }

        .manual-form button {
          height: 34px;
          padding: 0 15px;
          border: 1px solid #7659ff;
          border-radius: 9px;
          background: rgba(
            118,
            89,
            255,
            0.16
          );
          color: white;
          cursor: pointer;
          font-size: 11px;
          font-weight: 850;
        }

        .cases-list {
          display: grid;
          gap: 7px;
        }

        .case-row {
          display: grid;
          grid-template-columns:
            210px
            minmax(200px, 1fr)
            auto
            130px;
          align-items: center;
          gap: 14px;
          min-height: 54px;
          padding: 8px 12px;
          border: 1px solid #1f3048;
          border-radius: 13px;
          background: #0e1829;
        }

        .case-number {
          color: #ffffff;
          font-size: 12px;
          font-weight: 900;
        }

        .case-court {
          margin-top: 3px;
          overflow: hidden;
          color: #7892b7;
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .case-title {
          overflow: hidden;
          color: #d5deeb;
          font-size: 10px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .case-actions {
          display: flex;
          gap: 5px;
        }

        .case-actions button {
          height: 30px;
          padding: 0 10px;
          border: 1px solid #263954;
          border-radius: 9px;
          background: #111d30;
          color: #e4ecf7;
          cursor: pointer;
          font-size: 9px;
          font-weight: 850;
        }

        .case-actions button:hover {
          border-color: #775aff;
          background:
            rgba(
              119,
              90,
              255,
              0.14
            );
        }

        .deadline-button.soon {
          color: #6aa9ff !important;
        }

        .deadline-button.warning {
          border-color: #735d2c !important;
          color: #f2c45c !important;
        }

        .deadline-button.urgent {
          border-color: #814b28 !important;
          color: #ff9950 !important;
        }

        .deadline-button.critical,
        .deadline-button.overdue {
          border-color: #762d42 !important;
          color: #ff6e87 !important;
        }

        .deadline-button.none {
          opacity: 0.55;
        }

        .case-inline-panel {
          grid-column: 1 / -1;
          margin-top: 3px;
          padding: 10px;
          border-top: 1px solid #24344f;
          background: #0a1322;
          border-radius: 0 0 11px 11px;
        }

        .case-note-area {
          width: 100%;
          height: 78px;
          resize: none;
          padding: 9px 10px;
          border: 1px solid #263750;
          border-radius: 9px;
          outline: none;
          background: #08111f;
          color: white;
          font-size: 10px;
          line-height: 1.4;
        }

        .inline-actions {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
          margin-top: 7px;
        }

        .inline-actions button {
          height: 28px;
          padding: 0 10px;
          border: 1px solid #30415f;
          border-radius: 8px;
          background: #111d30;
          color: white;
          cursor: pointer;
          font-size: 9px;
          font-weight: 800;
        }

        .inline-actions .danger {
          border-color: #713149;
          color: #ff7089;
        }

        .inline-empty {
          padding: 10px;
          color: #7f94b3;
          font-size: 10px;
        }

        .inline-error {
          margin-top: 6px;
          color: #ff7089;
          font-size: 9px;
        }

        .case-meta {
          color: #7890b1;
          font-size: 9px;
          text-align: right;
        }

        .case-status {
          margin-top: 3px;
          color: #69d2ff;
          font-size: 9px;
          font-weight: 850;
        }

        .state-box {
          padding: 22px;
          border: 1px dashed #263650;
          border-radius: 13px;
          color: #7990b1;
          text-align: center;
          font-size: 11px;
        }

        @media (max-width: 900px) {
          body {
            overflow: auto;
          }

          .cases-page {
            padding:
              12px
              10px
              75px;
          }

          .cases-shell {
            width: 100%;
          }

          .cases-header {
            align-items: stretch;
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .search-input {
            width: 100%;
          }

          .manual-form,
          .case-row {
            grid-template-columns: 1fr;
          }

          .case-actions {
            flex-wrap: wrap;
          }

          .case-meta {
            text-align: left;
          }
        }
      `}</style>

      <div className="cases-shell">
        <header className="cases-header">
          <div className="cases-title">
            <small>
              AL METHER LEGAL
            </small>

            <h1>Davalar</h1>

            <p>
              Mailden algılanan ve kayıtlı dava dosyaları.
            </p>
          </div>

          <div className="header-actions">
            <input
              className="search-input"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Dava no veya mahkeme ara..."
            />

            <button
              type="button"
              className="manual-trigger"
              onClick={() =>
                setManualOpen(
                  (current) =>
                    !current
                )
              }
            >
              + Manuel Dava
            </button>
          </div>
        </header>

        {manualOpen && (
          <div className="manual-form">
            <input
              value={manualCaseNo}
              onChange={(event) =>
                setManualCaseNo(
                  event.target.value
                )
              }
              placeholder="Dava no"
            />

            <input
              value={manualCourt}
              onChange={(event) =>
                setManualCourt(
                  event.target.value
                )
              }
              placeholder="Mahkeme"
            />

            <input
              value={manualTitle}
              onChange={(event) =>
                setManualTitle(
                  event.target.value
                )
              }
              placeholder="Kısa açıklama"
            />

            <button
              type="button"
              disabled={manualSaving}
              onClick={
                createManualCase
              }
            >
              {manualSaving
                ? "Kaydediliyor..."
                : "Kaydet"}
            </button>
          </div>
        )}

        {error && (
          <div className="state-box">
            {error}
          </div>
        )}

        {!error && loading && (
          <div className="state-box">
            Davalar yükleniyor...
          </div>
        )}

        {!error &&
          !loading &&
          filteredCases.length ===
            0 && (
            <div className="state-box">
              Dava kaydı bulunamadı.
            </div>
          )}

        {!error &&
          !loading &&
          filteredCases.length >
            0 && (
            <section className="cases-list">
              {filteredCases.map(
                (item) => {
                  const deadline =
                    getNearestDeadline(
                      item
                    );

                  const deadlineState =
                    getDeadlineState(
                      deadline
                        ?.calculated_due_date
                    );

                  return (
                    <article
                      key={item.id}
                      className="case-row"
                    >
                      <div>
                        <div className="case-number">
                          {item.case_number ||
                            "Numarasız"}
                        </div>

                        <div className="case-court">
                          {item.court_name ||
                            "Mahkeme bilgisi yok"}
                        </div>
                      </div>

                      <div className="case-title">
                        {item.case_title ||
                          "Dava kaydı"}
                      </div>

                      <div className="case-actions">
                        <button
                          type="button"
                          onClick={() =>
                            toggleCasePanel(
                              item.id,
                              "mail"
                            )
                          }
                        >
                          Mail
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleCasePanel(
                              item.id,
                              "file"
                            )
                          }
                        >
                          Dosya
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleCasePanel(
                              item.id,
                              "document"
                            )
                          }
                        >
                          Evrak
                        </button>

                        <button
                          type="button"
                          className={`deadline-button ${deadlineState}`}
                          onClick={() =>
                            toggleCasePanel(
                              item.id,
                              "deadline"
                            )
                          }
                          title={
                            deadline
                              ?.calculated_due_date
                              ? formatDate(
                                  deadline.calculated_due_date
                                )
                              : "Süre yok"
                          }
                        >
                          Süre ·{" "}
                          {getDeadlineText(
                            deadline
                              ?.calculated_due_date
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleCasePanel(
                              item.id,
                              "note"
                            )
                          }
                        >
                          Not
                        </button>
                      </div>

                      <div className="case-meta">
                        Son işlem:{" "}
                        {formatDate(
                          item.updated_at ||
                            item.created_at
                        )}

                        <div className="case-status">
                          {item.status ||
                            "active"}
                        </div>
                      </div>

                      {openCaseId === item.id &&
                        openCaseTab && (
                        <div className="case-inline-panel">
                          {openCaseTab === "note" && (
                            <>
                              {caseNoteLoading ? (
                                <div className="inline-empty">
                                  Dava notu yükleniyor...
                                </div>
                              ) : (
                                <>
                                  <textarea
                                    className="case-note-area"
                                    value={caseNote}
                                    onChange={(event) =>
                                      setCaseNote(
                                        event.target.value
                                      )
                                    }
                                    placeholder="Bu davaya ait genel not..."
                                  />

                                  <div className="inline-actions">
                                    <button
                                      type="button"
                                      disabled={caseNoteSaving}
                                      onClick={() =>
                                        saveCaseNote(
                                          item.id
                                        )
                                      }
                                    >
                                      Kaydet
                                    </button>

                                    <button
                                      type="button"
                                      className="danger"
                                      disabled={caseNoteSaving}
                                      onClick={() =>
                                        deleteCaseNote(
                                          item.id
                                        )
                                      }
                                    >
                                      Sil
                                    </button>
                                  </div>

                                  {caseNoteError && (
                                    <div className="inline-error">
                                      {caseNoteError}
                                    </div>
                                  )}
                                </>
                              )}
                            </>
                          )}

                          {openCaseTab === "mail" && (
                            <div className="inline-empty">
                              Mail akışı burada açılacak.
                            </div>
                          )}

                          {openCaseTab === "file" && (
                            <div className="inline-empty">
                              Dosyalar burada açılacak.
                            </div>
                          )}

                          {openCaseTab === "document" && (
                            <div className="inline-empty">
                              Evraklar burada açılacak.
                            </div>
                          )}

                          {openCaseTab === "deadline" && (
                            <div className="inline-empty">
                              Süre ve hatırlatıcı burada açılacak.
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                }
              )}
            </section>
          )}
      </div>

      <LegalDock />
    </main>
  );
}


