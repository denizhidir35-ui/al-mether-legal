"use client";

import LegalBrand from "@/components/LegalBrand";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import LegalDock from "@/components/LegalDock";
import LegalSessionControl from "@/components/LegalSessionControl";
import { readJsonResponse } from "@/lib/apiResponse";

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

type CaseAttachment = {
  id: string;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  source?: string | null;
  created_at?: string | null;
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

  const [caseFiles, setCaseFiles] =
    useState<CaseAttachment[]>([]);

  const [caseFilesLoading, setCaseFilesLoading] =
    useState(false);

  const [caseFileUploading, setCaseFileUploading] =
    useState(false);

  const [caseDocuments, setCaseDocuments] =
    useState<CaseAttachment[]>([]);

  const [caseDocumentsLoading, setCaseDocumentsLoading] =
    useState(false);

  const [caseDocumentError, setCaseDocumentError] =
    useState("");
  const [caseFileError, setCaseFileError] =
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
        await readJsonResponse(response);

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

  async function loadCaseDocuments(
    caseId: string
  ) {
    try {
      setCaseDocumentsLoading(true);
      setCaseDocumentError("");

      const response =
        await fetch(
          `/api/attachments?source=mail&caseId=${encodeURIComponent(
            caseId
          )}`,
          {
            cache: "no-store",
          }
        );

      const data =
        await readJsonResponse(
          response
        );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Evraklar alınamadı."
        );
      }

      setCaseDocuments(
        Array.isArray(
          data?.attachments
        )
          ? data.attachments
          : []
      );
    } catch (error) {
      setCaseDocuments([]);

      setCaseDocumentError(
        error instanceof Error
          ? error.message
          : "Evraklar alınamadı."
      );
    } finally {
      setCaseDocumentsLoading(false);
    }
  }
  async function loadCaseFiles(
    caseId: string
  ) {
    try {
      setCaseFilesLoading(true);
      setCaseFileError("");

      const response =
        await fetch(
          `/api/attachments?source=manual&caseId=${encodeURIComponent(
            caseId
          )}`,
          {
            cache: "no-store",
          }
        );

      const data =
        await readJsonResponse(
          response
        );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Dosyalar alınamadı."
        );
      }

      setCaseFiles(
        Array.isArray(
          data?.attachments
        )
          ? data.attachments
          : []
      );
    } catch (error) {
      setCaseFiles([]);

      setCaseFileError(
        error instanceof Error
          ? error.message
          : "Dosyalar alınamadı."
      );
    } finally {
      setCaseFilesLoading(false);
    }
  }

  async function uploadCaseFile(
    caseId: string,
    file: File
  ) {
    try {
      setCaseFileUploading(true);
      setCaseFileError("");

      const formData =
        new FormData();

      formData.append(
        "caseId",
        caseId
      );

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          "/api/attachments",
          {
            method: "POST",
            body: formData,
          }
        );

      const data =
        await readJsonResponse(
          response
        );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Dosya yüklenemedi."
        );
      }

      await loadCaseFiles(caseId);
    } catch (error) {
      setCaseFileError(
        error instanceof Error
          ? error.message
          : "Dosya yüklenemedi."
      );
    } finally {
      setCaseFileUploading(false);
    }
  }

  async function openCaseFile(
    attachmentId: string
  ) {
    try {
      setCaseFileError("");

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
        await readJsonResponse(
          response
        );

      if (
        !response.ok ||
        !data?.signedUrl
      ) {
        throw new Error(
          data?.error ||
            "Dosya açılamadı."
        );
      }

      window.open(
        data.signedUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      setCaseFileError(
        error instanceof Error
          ? error.message
          : "Dosya açılamadı."
      );
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

    if (tab === "file") {
      loadCaseFiles(caseId);
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
    <main className="legal-app cases-page">
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
        .case-mail-list {
          display: grid;
          gap: 7px;
        }

        .case-mail-item {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr)
            auto;
          gap: 12px;
          align-items: center;
          padding: 10px 11px;
          border: 1px solid #20314a;
          border-radius: 10px;
          background: #0d1829;
        }

        .case-mail-subject {
          margin-bottom: 4px;
          color: #eef4ff;
          font-size: 10px;
          font-weight: 850;
          line-height: 1.4;
        }

        .case-mail-sender {
          color: #7790b3;
          font-size: 9px;
          overflow-wrap: anywhere;
        }

        .case-mail-date {
          color: #7189aa;
          font-size: 8px;
          white-space: nowrap;
        }

        @media (max-width: 900px) {
          .case-mail-item {
            grid-template-columns: 1fr;
            gap: 5px;
          }

          .case-mail-date {
            white-space: normal;
          }
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

        .case-file-panel {
          display: grid;
          gap: 8px;
        }

        .case-file-toolbar {
          display: flex;
          justify-content: flex-end;
        }

        .case-file-upload {
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 11px;
          border: 1px solid #30415f;
          border-radius: 8px;
          background: #111d30;
          color: #dfe9f7;
          cursor: pointer;
          font-size: 9px;
          font-weight: 850;
        }

        .case-file-upload input {
          display: none;
        }

        .case-file-list {
          display: grid;
          gap: 6px;
        }

        .case-file-item {
          width: 100%;
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 10px;
          border: 1px solid #20314a;
          border-radius: 10px;
          background: #0d1829;
          color: #8fa8ca;
          cursor: pointer;
          text-align: left;
        }

        .case-file-item strong {
          display: block;
          margin-bottom: 3px;
          color: #edf4ff;
          font-size: 10px;
        }

        .case-file-item span {
          color: #7890b2;
          font-size: 8px;
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
          html,
          body {
            width: 100%;
            min-height: 100%;
            overflow-x: hidden;
            overflow-y: auto;
          }

          .cases-page {
            min-height: 100vh;
            padding: 12px 10px 86px;
          }

          .cases-shell {
            width: 100%;
            max-width: none;
          }

          .cases-header {
            align-items: stretch;
            flex-direction: column;
            gap: 9px;
            margin-bottom: 10px;
          }

          .cases-title small {
            margin-bottom: 3px;
            font-size: 8px;
          }

          .cases-title h1 {
            font-size: 18px;
          }

          .cases-title p {
            margin-top: 3px;
            font-size: 9px;
          }

          .header-actions {
            width: 100%;
            display: grid;
            grid-template-columns:
              minmax(0, 1fr)
              auto;
            gap: 6px;
          }

          .search-input {
            width: 100%;
            min-width: 0;
            height: 38px;
            font-size: 10px;
          }

          .manual-trigger {
            height: 38px;
            padding: 0 11px;
            white-space: nowrap;
            font-size: 9px;
          }

          .manual-form {
            grid-template-columns: 1fr;
            gap: 6px;
            margin-bottom: 8px;
            padding: 8px;
          }

          .manual-form input,
          .manual-form button {
            width: 100%;
            height: 38px;
          }

          .cases-list {
            gap: 7px;
          }

          .case-row {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
            min-height: 0;
            padding: 10px;
            border-radius: 12px;
          }

          .case-number {
            font-size: 12px;
          }

          .case-court {
            margin-top: 2px;
            font-size: 9px;
            white-space: normal;
          }

          .case-title {
            font-size: 10px;
            line-height: 1.35;
            white-space: normal;
          }

          .case-actions {
            width: 100%;
            display: grid;
            grid-template-columns:
              repeat(5, minmax(0, 1fr));
            gap: 5px;
          }

          .case-actions button {
            width: 100%;
            min-width: 0;
            height: 36px;
            padding: 0 4px;
            border-radius: 9px;
            font-size: 8px;
          }

          .case-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding-top: 6px;
            border-top: 1px solid #1f3048;
            font-size: 8px;
            text-align: left;
          }

          .case-status {
            margin-top: 0;
            white-space: nowrap;
            font-size: 8px;
          }

          .case-inline-panel {
            grid-column: 1;
            width: 100%;
            margin: 2px 0 0;
            padding: 9px;
            border-radius: 10px;
          }

          .case-note-area {
            height: 110px;
            font-size: 10px;
          }

          .inline-actions {
            width: 100%;
            justify-content: stretch;
          }

          .inline-actions button {
            flex: 1;
            height: 34px;
          }

          .state-box {
            padding: 18px 12px;
            font-size: 10px;
          }
        }

        @media (max-width: 430px) {
          .header-actions {
            grid-template-columns: 1fr;
          }

          .manual-trigger {
            width: 100%;
          }

          .case-actions {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .case-actions .deadline-button {
            grid-column: span 2;
          }
        }
        /* AL METHER CASES PREMIUM OVERRIDE */

        html,
        body {
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-page {
          height: 100dvh;
          min-height: 100dvh;
          overflow: hidden;
          padding: 12px 16px 72px;
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-shell {
          width: min(1500px, calc(100vw - 32px));
          height: 100%;
          display: flex;
          flex-direction: column;
          margin: 0 auto;
        }

        .cases-header {
          min-height: 46px;
          flex: 0 0 auto;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--legal-border);
        }

        .cases-title small {
          margin-bottom: 2px;
          color: var(--legal-gold);
          font-size: 7px;
          letter-spacing: 0.16em;
        }

        .cases-title h1 {
          color: var(--legal-text);
          font-size: 15px;
          font-weight: 850;
          letter-spacing: -0.02em;
        }

        .cases-title p {
          display: none;
        }

        .header-actions {
          gap: 6px;
        }

        .search-input {
          width: 250px;
          height: 32px;
          padding: 0 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface);
          color: var(--legal-text);
          font-size: 9px;
        }

        .search-input::placeholder {
          color: var(--legal-muted);
        }

        .search-input:focus {
          border-color: var(--legal-gold);
          box-shadow: 0 0 0 3px var(--legal-gold-soft);
        }

        .manual-trigger,
        .cases-theme-button {
          height: 32px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text-soft);
          cursor: pointer;
        }

        .manual-trigger {
          padding: 0 11px;
          font-size: 9px;
          font-weight: 800;
        }

        .cases-theme-button {
          width: 32px;
          color: var(--legal-gold);
          font-size: 13px;
        }

        .manual-trigger:hover,
        .cases-theme-button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
        }

        .manual-form {
          flex: 0 0 auto;
          margin-bottom: 7px;
          padding: 7px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
        }

        .manual-form input {
          height: 31px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text);
          font-size: 9px;
        }

        .manual-form button {
          height: 31px;
          border: 1px solid var(--legal-gold);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
          font-size: 9px;
        }

        .cases-list {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          align-content: start;
          gap: 5px;
          padding-right: 3px;
        }

        .case-row {
          min-height: 48px;
          grid-template-columns:
            185px
            minmax(170px, 1fr)
            auto
            112px;
          gap: 10px;
          padding: 7px 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
          box-shadow: none;
        }

        .case-row:hover {
          border-color: var(--legal-border-strong);
        }

        .case-row.selected {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          box-shadow: inset 3px 0 0 var(--legal-gold);
        }

        .case-number {
          color: var(--legal-text);
          font-size: 10.5px;
          font-weight: 900;
        }

        .case-court {
          margin-top: 2px;
          color: var(--legal-muted);
          font-size: 8px;
        }

        .case-title {
          color: var(--legal-text-soft);
          font-size: 9px;
          font-weight: 700;
        }

        .case-actions {
          gap: 4px;
        }

        .case-actions button {
          height: 27px;
          padding: 0 8px;
          border: 1px solid var(--legal-border);
          border-radius: 7px;
          background: var(--legal-surface-2);
          color: var(--legal-muted);
          font-size: 8px;
          font-weight: 800;
        }

        .case-actions button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
        }

        .case-meta {
          color: var(--legal-muted);
          font-size: 7.5px;
        }

        .case-status {
          margin-top: 2px;
          color: var(--legal-success);
          font-size: 7.5px;
        }

        .case-inline-panel {
          margin-top: 2px;
          padding: 8px;
          border-top: 1px solid var(--legal-border);
          background: var(--legal-surface-2);
        }

        .case-mail-item,
        .case-file-item {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text-soft);
        }

        .case-mail-subject,
        .case-file-item strong {
          color: var(--legal-text);
        }

        .case-mail-sender,
        .case-mail-date,
        .case-file-item span,
        .inline-empty,
        .state-box {
          color: var(--legal-muted);
        }

        .case-note-area {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text);
        }

        .inline-error,
        .inline-actions .danger {
          color: var(--legal-danger);
        }

        .deadline-button.warning {
          border-color: var(--legal-warning) !important;
          color: var(--legal-warning) !important;
        }

        .deadline-button.urgent,
        .deadline-button.critical,
        .deadline-button.overdue {
          border-color: var(--legal-danger) !important;
          color: var(--legal-danger) !important;
        }

        @media (max-width: 900px) {
          html,
          body {
            overflow-y: auto;
          }

          .cases-page {
            height: auto;
            min-height: 100dvh;
            overflow: visible;
            padding: 8px 7px 74px;
          }

          .cases-shell {
            width: 100%;
            height: auto;
          }

          .cases-header {
            display: grid;
            grid-template-columns: 1fr;
            gap: 7px;
          }

          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px
              auto;
          }

          .search-input,
          .cases-theme-button,
          .manual-trigger {
            height: 34px;
          }

          .cases-list {
            overflow: visible;
          }

          .case-row {
            grid-template-columns: 1fr;
            gap: 6px;
            padding: 9px;
          }

          .case-actions {
            display: grid;
            grid-template-columns:
              repeat(5, minmax(0, 1fr));
            gap: 4px;
          }

          .case-actions button {
            width: 100%;
            height: 32px;
            padding: 0 3px;
            font-size: 7.5px;
          }

          .case-meta {
            padding-top: 5px;
            border-top: 1px solid var(--legal-border);
          }
        }

        @media (max-width: 430px) {
          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px;
          }

          .manual-trigger {
            grid-column: 1 / -1;
            width: 100%;
          }

          .case-actions {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .case-actions .deadline-button {
            grid-column: span 2;
          }
        }

        /* AL METHER CASES PREMIUM OVERRIDE */

        html,
        body {
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-page {
          height: 100dvh;
          min-height: 100dvh;
          overflow: hidden;
          padding: 12px 16px 72px;
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-shell {
          width: min(1500px, calc(100vw - 32px));
          height: 100%;
          display: flex;
          flex-direction: column;
          margin: 0 auto;
        }

        .cases-header {
          min-height: 46px;
          flex: 0 0 auto;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--legal-border);
        }

        .cases-title small {
          margin-bottom: 2px;
          color: var(--legal-gold);
          font-size: 7px;
          letter-spacing: 0.16em;
        }

        .cases-title h1 {
          color: var(--legal-text);
          font-size: 15px;
          font-weight: 850;
          letter-spacing: -0.02em;
        }

        .cases-title p {
          display: none;
        }

        .header-actions {
          gap: 6px;
        }

        .search-input {
          width: 250px;
          height: 32px;
          padding: 0 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface);
          color: var(--legal-text);
          font-size: 9px;
        }

        .search-input::placeholder {
          color: var(--legal-muted);
        }

        .search-input:focus {
          border-color: var(--legal-gold);
          box-shadow: 0 0 0 3px var(--legal-gold-soft);
        }

        .manual-trigger,
        .cases-theme-button {
          height: 32px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text-soft);
          cursor: pointer;
        }

        .manual-trigger {
          padding: 0 11px;
          font-size: 9px;
          font-weight: 800;
        }

        .cases-theme-button {
          width: 32px;
          color: var(--legal-gold);
          font-size: 13px;
        }

        .manual-trigger:hover,
        .cases-theme-button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
        }

        .manual-form {
          flex: 0 0 auto;
          margin-bottom: 7px;
          padding: 7px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
        }

        .manual-form input {
          height: 31px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text);
          font-size: 9px;
        }

        .manual-form button {
          height: 31px;
          border: 1px solid var(--legal-gold);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
          font-size: 9px;
        }

        .cases-list {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          align-content: start;
          gap: 5px;
          padding-right: 3px;
        }

        .case-row {
          min-height: 48px;
          grid-template-columns:
            185px
            minmax(170px, 1fr)
            auto
            112px;
          gap: 10px;
          padding: 7px 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
          box-shadow: none;
        }

        .case-row:hover {
          border-color: var(--legal-border-strong);
        }

        .case-row.selected {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          box-shadow: inset 3px 0 0 var(--legal-gold);
        }

        .case-number {
          color: var(--legal-text);
          font-size: 10.5px;
          font-weight: 900;
        }

        .case-court {
          margin-top: 2px;
          color: var(--legal-muted);
          font-size: 8px;
        }

        .case-title {
          color: var(--legal-text-soft);
          font-size: 9px;
          font-weight: 700;
        }

        .case-actions {
          gap: 4px;
        }

        .case-actions button {
          height: 27px;
          padding: 0 8px;
          border: 1px solid var(--legal-border);
          border-radius: 7px;
          background: var(--legal-surface-2);
          color: var(--legal-muted);
          font-size: 8px;
          font-weight: 800;
        }

        .case-actions button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
        }

        .case-meta {
          color: var(--legal-muted);
          font-size: 7.5px;
        }

        .case-status {
          margin-top: 2px;
          color: var(--legal-success);
          font-size: 7.5px;
        }

        .case-inline-panel {
          margin-top: 2px;
          padding: 8px;
          border-top: 1px solid var(--legal-border);
          background: var(--legal-surface-2);
        }

        .case-mail-item,
        .case-file-item {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text-soft);
        }

        .case-mail-subject,
        .case-file-item strong {
          color: var(--legal-text);
        }

        .case-mail-sender,
        .case-mail-date,
        .case-file-item span,
        .inline-empty,
        .state-box {
          color: var(--legal-muted);
        }

        .case-note-area {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text);
        }

        .inline-error,
        .inline-actions .danger {
          color: var(--legal-danger);
        }

        .deadline-button.warning {
          border-color: var(--legal-warning) !important;
          color: var(--legal-warning) !important;
        }

        .deadline-button.urgent,
        .deadline-button.critical,
        .deadline-button.overdue {
          border-color: var(--legal-danger) !important;
          color: var(--legal-danger) !important;
        }

        @media (max-width: 900px) {
          html,
          body {
            overflow-y: auto;
          }

          .cases-page {
            height: auto;
            min-height: 100dvh;
            overflow: visible;
            padding: 8px 7px 74px;
          }

          .cases-shell {
            width: 100%;
            height: auto;
          }

          .cases-header {
            display: grid;
            grid-template-columns: 1fr;
            gap: 7px;
          }

          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px
              auto;
          }

          .search-input,
          .cases-theme-button,
          .manual-trigger {
            height: 34px;
          }

          .cases-list {
            overflow: visible;
          }

          .case-row {
            grid-template-columns: 1fr;
            gap: 6px;
            padding: 9px;
          }

          .case-actions {
            display: grid;
            grid-template-columns:
              repeat(5, minmax(0, 1fr));
            gap: 4px;
          }

          .case-actions button {
            width: 100%;
            height: 32px;
            padding: 0 3px;
            font-size: 7.5px;
          }

          .case-meta {
            padding-top: 5px;
            border-top: 1px solid var(--legal-border);
          }
        }

        @media (max-width: 430px) {
          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px;
          }

          .manual-trigger {
            grid-column: 1 / -1;
            width: 100%;
          }

          .case-actions {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .case-actions .deadline-button {
            grid-column: span 2;
          }
        }


        /* AL METHER CASES PREMIUM OVERRIDE */

        html,
        body {
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-page {
          height: 100dvh;
          min-height: 100dvh;
          overflow: hidden;
          padding: 12px 16px 72px;
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-shell {
          width: min(1500px, calc(100vw - 32px));
          height: 100%;
          display: flex;
          flex-direction: column;
          margin: 0 auto;
        }

        .cases-header {
          min-height: 46px;
          flex: 0 0 auto;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--legal-border);
        }

        .cases-title small {
          margin-bottom: 2px;
          color: var(--legal-gold);
          font-size: 7px;
          letter-spacing: 0.16em;
        }

        .cases-title h1 {
          color: var(--legal-text);
          font-size: 15px;
          font-weight: 850;
          letter-spacing: -0.02em;
        }

        .cases-title p {
          display: none;
        }

        .header-actions {
          gap: 6px;
        }

        .search-input {
          width: 250px;
          height: 32px;
          padding: 0 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface);
          color: var(--legal-text);
          font-size: 9px;
        }

        .search-input::placeholder {
          color: var(--legal-muted);
        }

        .search-input:focus {
          border-color: var(--legal-gold);
          box-shadow: 0 0 0 3px var(--legal-gold-soft);
        }

        .manual-trigger,
        .cases-theme-button {
          height: 32px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text-soft);
          cursor: pointer;
        }

        .manual-trigger {
          padding: 0 11px;
          font-size: 9px;
          font-weight: 800;
        }

        .cases-theme-button {
          width: 32px;
          color: var(--legal-gold);
          font-size: 13px;
        }

        .manual-trigger:hover,
        .cases-theme-button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
        }

        .manual-form {
          flex: 0 0 auto;
          margin-bottom: 7px;
          padding: 7px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
        }

        .manual-form input {
          height: 31px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text);
          font-size: 9px;
        }

        .manual-form button {
          height: 31px;
          border: 1px solid var(--legal-gold);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
          font-size: 9px;
        }

        .cases-list {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          align-content: start;
          gap: 5px;
          padding-right: 3px;
        }

        .case-row {
          min-height: 48px;
          grid-template-columns:
            185px
            minmax(170px, 1fr)
            auto
            112px;
          gap: 10px;
          padding: 7px 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
          box-shadow: none;
        }

        .case-row:hover {
          border-color: var(--legal-border-strong);
        }

        .case-row.selected {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          box-shadow: inset 3px 0 0 var(--legal-gold);
        }

        .case-number {
          color: var(--legal-text);
          font-size: 10.5px;
          font-weight: 900;
        }

        .case-court {
          margin-top: 2px;
          color: var(--legal-muted);
          font-size: 8px;
        }

        .case-title {
          color: var(--legal-text-soft);
          font-size: 9px;
          font-weight: 700;
        }

        .case-actions {
          gap: 4px;
        }

        .case-actions button {
          height: 27px;
          padding: 0 8px;
          border: 1px solid var(--legal-border);
          border-radius: 7px;
          background: var(--legal-surface-2);
          color: var(--legal-muted);
          font-size: 8px;
          font-weight: 800;
        }

        .case-actions button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
        }

        .case-meta {
          color: var(--legal-muted);
          font-size: 7.5px;
        }

        .case-status {
          margin-top: 2px;
          color: var(--legal-success);
          font-size: 7.5px;
        }

        .case-inline-panel {
          margin-top: 2px;
          padding: 8px;
          border-top: 1px solid var(--legal-border);
          background: var(--legal-surface-2);
        }

        .case-mail-item,
        .case-file-item {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text-soft);
        }

        .case-mail-subject,
        .case-file-item strong {
          color: var(--legal-text);
        }

        .case-mail-sender,
        .case-mail-date,
        .case-file-item span,
        .inline-empty,
        .state-box {
          color: var(--legal-muted);
        }

        .case-note-area {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text);
        }

        .inline-error,
        .inline-actions .danger {
          color: var(--legal-danger);
        }

        .deadline-button.warning {
          border-color: var(--legal-warning) !important;
          color: var(--legal-warning) !important;
        }

        .deadline-button.urgent,
        .deadline-button.critical,
        .deadline-button.overdue {
          border-color: var(--legal-danger) !important;
          color: var(--legal-danger) !important;
        }

        @media (max-width: 900px) {
          html,
          body {
            overflow-y: auto;
          }

          .cases-page {
            height: auto;
            min-height: 100dvh;
            overflow: visible;
            padding: 8px 7px 74px;
          }

          .cases-shell {
            width: 100%;
            height: auto;
          }

          .cases-header {
            display: grid;
            grid-template-columns: 1fr;
            gap: 7px;
          }

          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px
              auto;
          }

          .search-input,
          .cases-theme-button,
          .manual-trigger {
            height: 34px;
          }

          .cases-list {
            overflow: visible;
          }

          .case-row {
            grid-template-columns: 1fr;
            gap: 6px;
            padding: 9px;
          }

          .case-actions {
            display: grid;
            grid-template-columns:
              repeat(5, minmax(0, 1fr));
            gap: 4px;
          }

          .case-actions button {
            width: 100%;
            height: 32px;
            padding: 0 3px;
            font-size: 7.5px;
          }

          .case-meta {
            padding-top: 5px;
            border-top: 1px solid var(--legal-border);
          }
        }

        @media (max-width: 430px) {
          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px;
          }

          .manual-trigger {
            grid-column: 1 / -1;
            width: 100%;
          }

          .case-actions {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .case-actions .deadline-button {
            grid-column: span 2;
          }
        }
 
        /* AL METHER CASES PREMIUM OVERRIDE */

        html,
        body {
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-page {
          height: 100dvh;
          min-height: 100dvh;
          overflow: hidden;
          padding: 12px 16px 72px;
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-shell {
          width: min(1500px, calc(100vw - 32px));
          height: 100%;
          display: flex;
          flex-direction: column;
          margin: 0 auto;
        }

        .cases-header {
          min-height: 46px;
          flex: 0 0 auto;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--legal-border);
        }

        .cases-title small {
          margin-bottom: 2px;
          color: var(--legal-gold);
          font-size: 7px;
          letter-spacing: 0.16em;
        }

        .cases-title h1 {
          color: var(--legal-text);
          font-size: 15px;
          font-weight: 850;
          letter-spacing: -0.02em;
        }

        .cases-title p {
          display: none;
        }

        .header-actions {
          gap: 6px;
        }

        .search-input {
          width: 250px;
          height: 32px;
          padding: 0 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface);
          color: var(--legal-text);
          font-size: 9px;
        }

        .search-input::placeholder {
          color: var(--legal-muted);
        }

        .search-input:focus {
          border-color: var(--legal-gold);
          box-shadow: 0 0 0 3px var(--legal-gold-soft);
        }

        .manual-trigger,
        .cases-theme-button {
          height: 32px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text-soft);
          cursor: pointer;
        }

        .manual-trigger {
          padding: 0 11px;
          font-size: 9px;
          font-weight: 800;
        }

        .cases-theme-button {
          width: 32px;
          color: var(--legal-gold);
          font-size: 13px;
        }

        .manual-trigger:hover,
        .cases-theme-button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
        }

        .manual-form {
          flex: 0 0 auto;
          margin-bottom: 7px;
          padding: 7px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
        }

        .manual-form input {
          height: 31px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text);
          font-size: 9px;
        }

        .manual-form button {
          height: 31px;
          border: 1px solid var(--legal-gold);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
          font-size: 9px;
        }

        .cases-list {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          align-content: start;
          gap: 5px;
          padding-right: 3px;
        }

        .case-row {
          min-height: 48px;
          grid-template-columns:
            185px
            minmax(170px, 1fr)
            auto
            112px;
          gap: 10px;
          padding: 7px 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
          box-shadow: none;
        }

        .case-row:hover {
          border-color: var(--legal-border-strong);
        }

        .case-row.selected {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          box-shadow: inset 3px 0 0 var(--legal-gold);
        }

        .case-number {
          color: var(--legal-text);
          font-size: 10.5px;
          font-weight: 900;
        }

        .case-court {
          margin-top: 2px;
          color: var(--legal-muted);
          font-size: 8px;
        }

        .case-title {
          color: var(--legal-text-soft);
          font-size: 9px;
          font-weight: 700;
        }

        .case-actions {
          gap: 4px;
        }

        .case-actions button {
          height: 27px;
          padding: 0 8px;
          border: 1px solid var(--legal-border);
          border-radius: 7px;
          background: var(--legal-surface-2);
          color: var(--legal-muted);
          font-size: 8px;
          font-weight: 800;
        }

        .case-actions button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
        }

        .case-meta {
          color: var(--legal-muted);
          font-size: 7.5px;
        }

        .case-status {
          margin-top: 2px;
          color: var(--legal-success);
          font-size: 7.5px;
        }

        .case-inline-panel {
          margin-top: 2px;
          padding: 8px;
          border-top: 1px solid var(--legal-border);
          background: var(--legal-surface-2);
        }

        .case-mail-item,
        .case-file-item {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text-soft);
        }

        .case-mail-subject,
        .case-file-item strong {
          color: var(--legal-text);
        }

        .case-mail-sender,
        .case-mail-date,
        .case-file-item span,
        .inline-empty,
        .state-box {
          color: var(--legal-muted);
        }

        .case-note-area {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text);
        }

        .inline-error,
        .inline-actions .danger {
          color: var(--legal-danger);
        }

        .deadline-button.warning {
          border-color: var(--legal-warning) !important;
          color: var(--legal-warning) !important;
        }

        .deadline-button.urgent,
        .deadline-button.critical,
        .deadline-button.overdue {
          border-color: var(--legal-danger) !important;
          color: var(--legal-danger) !important;
        }

        @media (max-width: 900px) {
          html,
          body {
            overflow-y: auto;
          }

          .cases-page {
            height: auto;
            min-height: 100dvh;
            overflow: visible;
            padding: 8px 7px 74px;
          }

          .cases-shell {
            width: 100%;
            height: auto;
          }

          .cases-header {
            display: grid;
            grid-template-columns: 1fr;
            gap: 7px;
          }

          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px
              auto;
          }

          .search-input,
          .cases-theme-button,
          .manual-trigger {
            height: 34px;
          }

          .cases-list {
            overflow: visible;
          }

          .case-row {
            grid-template-columns: 1fr;
            gap: 6px;
            padding: 9px;
          }

          .case-actions {
            display: grid;
            grid-template-columns:
              repeat(5, minmax(0, 1fr));
            gap: 4px;
          }

          .case-actions button {
            width: 100%;
            height: 32px;
            padding: 0 3px;
            font-size: 7.5px;
          }

          .case-meta {
            padding-top: 5px;
            border-top: 1px solid var(--legal-border);
          }
        }

        @media (max-width: 430px) {
          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px;
          }

          .manual-trigger {
            grid-column: 1 / -1;
            width: 100%;
          }

          .case-actions {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .case-actions .deadline-button {
            grid-column: span 2;
          }
        }
 
        /* AL METHER CASES PREMIUM OVERRIDE */

        html,
        body {
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-page {
          height: 100dvh;
          min-height: 100dvh;
          overflow: hidden;
          padding: 12px 16px 72px;
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-shell {
          width: min(1500px, calc(100vw - 32px));
          height: 100%;
          display: flex;
          flex-direction: column;
          margin: 0 auto;
        }

        .cases-header {
          min-height: 46px;
          flex: 0 0 auto;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--legal-border);
        }

        .cases-title small {
          margin-bottom: 2px;
          color: var(--legal-gold);
          font-size: 7px;
          letter-spacing: 0.16em;
        }

        .cases-title h1 {
          color: var(--legal-text);
          font-size: 15px;
          font-weight: 850;
          letter-spacing: -0.02em;
        }

        .cases-title p {
          display: none;
        }

        .header-actions {
          gap: 6px;
        }

        .search-input {
          width: 250px;
          height: 32px;
          padding: 0 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface);
          color: var(--legal-text);
          font-size: 9px;
        }

        .search-input::placeholder {
          color: var(--legal-muted);
        }

        .search-input:focus {
          border-color: var(--legal-gold);
          box-shadow: 0 0 0 3px var(--legal-gold-soft);
        }

        .manual-trigger,
        .cases-theme-button {
          height: 32px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text-soft);
          cursor: pointer;
        }

        .manual-trigger {
          padding: 0 11px;
          font-size: 9px;
          font-weight: 800;
        }

        .cases-theme-button {
          width: 32px;
          color: var(--legal-gold);
          font-size: 13px;
        }

        .manual-trigger:hover,
        .cases-theme-button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
        }

        .manual-form {
          flex: 0 0 auto;
          margin-bottom: 7px;
          padding: 7px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
        }

        .manual-form input {
          height: 31px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text);
          font-size: 9px;
        }

        .manual-form button {
          height: 31px;
          border: 1px solid var(--legal-gold);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
          font-size: 9px;
        }

        .cases-list {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          align-content: start;
          gap: 5px;
          padding-right: 3px;
        }

        .case-row {
          min-height: 48px;
          grid-template-columns:
            185px
            minmax(170px, 1fr)
            auto
            112px;
          gap: 10px;
          padding: 7px 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
          box-shadow: none;
        }

        .case-row:hover {
          border-color: var(--legal-border-strong);
        }

        .case-row.selected {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          box-shadow: inset 3px 0 0 var(--legal-gold);
        }

        .case-number {
          color: var(--legal-text);
          font-size: 10.5px;
          font-weight: 900;
        }

        .case-court {
          margin-top: 2px;
          color: var(--legal-muted);
          font-size: 8px;
        }

        .case-title {
          color: var(--legal-text-soft);
          font-size: 9px;
          font-weight: 700;
        }

        .case-actions {
          gap: 4px;
        }

        .case-actions button {
          height: 27px;
          padding: 0 8px;
          border: 1px solid var(--legal-border);
          border-radius: 7px;
          background: var(--legal-surface-2);
          color: var(--legal-muted);
          font-size: 8px;
          font-weight: 800;
        }

        .case-actions button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
        }

        .case-meta {
          color: var(--legal-muted);
          font-size: 7.5px;
        }

        .case-status {
          margin-top: 2px;
          color: var(--legal-success);
          font-size: 7.5px;
        }

        .case-inline-panel {
          margin-top: 2px;
          padding: 8px;
          border-top: 1px solid var(--legal-border);
          background: var(--legal-surface-2);
        }

        .case-mail-item,
        .case-file-item {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text-soft);
        }

        .case-mail-subject,
        .case-file-item strong {
          color: var(--legal-text);
        }

        .case-mail-sender,
        .case-mail-date,
        .case-file-item span,
        .inline-empty,
        .state-box {
          color: var(--legal-muted);
        }

        .case-note-area {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text);
        }

        .inline-error,
        .inline-actions .danger {
          color: var(--legal-danger);
        }

        .deadline-button.warning {
          border-color: var(--legal-warning) !important;
          color: var(--legal-warning) !important;
        }

        .deadline-button.urgent,
        .deadline-button.critical,
        .deadline-button.overdue {
          border-color: var(--legal-danger) !important;
          color: var(--legal-danger) !important;
        }

        @media (max-width: 900px) {
          html,
          body {
            overflow-y: auto;
          }

          .cases-page {
            height: auto;
            min-height: 100dvh;
            overflow: visible;
            padding: 8px 7px 74px;
          }

          .cases-shell {
            width: 100%;
            height: auto;
          }

          .cases-header {
            display: grid;
            grid-template-columns: 1fr;
            gap: 7px;
          }

          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px
              auto;
          }

          .search-input,
          .cases-theme-button,
          .manual-trigger {
            height: 34px;
          }

          .cases-list {
            overflow: visible;
          }

          .case-row {
            grid-template-columns: 1fr;
            gap: 6px;
            padding: 9px;
          }

          .case-actions {
            display: grid;
            grid-template-columns:
              repeat(5, minmax(0, 1fr));
            gap: 4px;
          }

          .case-actions button {
            width: 100%;
            height: 32px;
            padding: 0 3px;
            font-size: 7.5px;
          }

          .case-meta {
            padding-top: 5px;
            border-top: 1px solid var(--legal-border);
          }
        }

        @media (max-width: 430px) {
          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px;
          }

          .manual-trigger {
            grid-column: 1 / -1;
            width: 100%;
          }

          .case-actions {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .case-actions .deadline-button {
            grid-column: span 2;
          }
        }
 
        /* AL METHER CASES PREMIUM OVERRIDE */

        html,
        body {
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-page {
          height: 100dvh;
          min-height: 100dvh;
          overflow: hidden;
          padding: 12px 16px 72px;
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-shell {
          width: min(1500px, calc(100vw - 32px));
          height: 100%;
          display: flex;
          flex-direction: column;
          margin: 0 auto;
        }

        .cases-header {
          min-height: 46px;
          flex: 0 0 auto;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--legal-border);
        }

        .cases-title small {
          margin-bottom: 2px;
          color: var(--legal-gold);
          font-size: 7px;
          letter-spacing: 0.16em;
        }

        .cases-title h1 {
          color: var(--legal-text);
          font-size: 15px;
          font-weight: 850;
          letter-spacing: -0.02em;
        }

        .cases-title p {
          display: none;
        }

        .header-actions {
          gap: 6px;
        }

        .search-input {
          width: 250px;
          height: 32px;
          padding: 0 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface);
          color: var(--legal-text);
          font-size: 9px;
        }

        .search-input::placeholder {
          color: var(--legal-muted);
        }

        .search-input:focus {
          border-color: var(--legal-gold);
          box-shadow: 0 0 0 3px var(--legal-gold-soft);
        }

        .manual-trigger,
        .cases-theme-button {
          height: 32px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text-soft);
          cursor: pointer;
        }

        .manual-trigger {
          padding: 0 11px;
          font-size: 9px;
          font-weight: 800;
        }

        .cases-theme-button {
          width: 32px;
          color: var(--legal-gold);
          font-size: 13px;
        }

        .manual-trigger:hover,
        .cases-theme-button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
        }

        .manual-form {
          flex: 0 0 auto;
          margin-bottom: 7px;
          padding: 7px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
        }

        .manual-form input {
          height: 31px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text);
          font-size: 9px;
        }

        .manual-form button {
          height: 31px;
          border: 1px solid var(--legal-gold);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
          font-size: 9px;
        }

        .cases-list {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          align-content: start;
          gap: 5px;
          padding-right: 3px;
        }

        .case-row {
          min-height: 48px;
          grid-template-columns:
            185px
            minmax(170px, 1fr)
            auto
            112px;
          gap: 10px;
          padding: 7px 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
          box-shadow: none;
        }

        .case-row:hover {
          border-color: var(--legal-border-strong);
        }

        .case-row.selected {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          box-shadow: inset 3px 0 0 var(--legal-gold);
        }

        .case-number {
          color: var(--legal-text);
          font-size: 10.5px;
          font-weight: 900;
        }

        .case-court {
          margin-top: 2px;
          color: var(--legal-muted);
          font-size: 8px;
        }

        .case-title {
          color: var(--legal-text-soft);
          font-size: 9px;
          font-weight: 700;
        }

        .case-actions {
          gap: 4px;
        }

        .case-actions button {
          height: 27px;
          padding: 0 8px;
          border: 1px solid var(--legal-border);
          border-radius: 7px;
          background: var(--legal-surface-2);
          color: var(--legal-muted);
          font-size: 8px;
          font-weight: 800;
        }

        .case-actions button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
        }

        .case-meta {
          color: var(--legal-muted);
          font-size: 7.5px;
        }

        .case-status {
          margin-top: 2px;
          color: var(--legal-success);
          font-size: 7.5px;
        }

        .case-inline-panel {
          margin-top: 2px;
          padding: 8px;
          border-top: 1px solid var(--legal-border);
          background: var(--legal-surface-2);
        }

        .case-mail-item,
        .case-file-item {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text-soft);
        }

        .case-mail-subject,
        .case-file-item strong {
          color: var(--legal-text);
        }

        .case-mail-sender,
        .case-mail-date,
        .case-file-item span,
        .inline-empty,
        .state-box {
          color: var(--legal-muted);
        }

        .case-note-area {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text);
        }

        .inline-error,
        .inline-actions .danger {
          color: var(--legal-danger);
        }

        .deadline-button.warning {
          border-color: var(--legal-warning) !important;
          color: var(--legal-warning) !important;
        }

        .deadline-button.urgent,
        .deadline-button.critical,
        .deadline-button.overdue {
          border-color: var(--legal-danger) !important;
          color: var(--legal-danger) !important;
        }

        @media (max-width: 900px) {
          html,
          body {
            overflow-y: auto;
          }

          .cases-page {
            height: auto;
            min-height: 100dvh;
            overflow: visible;
            padding: 8px 7px 74px;
          }

          .cases-shell {
            width: 100%;
            height: auto;
          }

          .cases-header {
            display: grid;
            grid-template-columns: 1fr;
            gap: 7px;
          }

          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px
              auto;
          }

          .search-input,
          .cases-theme-button,
          .manual-trigger {
            height: 34px;
          }

          .cases-list {
            overflow: visible;
          }

          .case-row {
            grid-template-columns: 1fr;
            gap: 6px;
            padding: 9px;
          }

          .case-actions {
            display: grid;
            grid-template-columns:
              repeat(5, minmax(0, 1fr));
            gap: 4px;
          }

          .case-actions button {
            width: 100%;
            height: 32px;
            padding: 0 3px;
            font-size: 7.5px;
          }

          .case-meta {
            padding-top: 5px;
            border-top: 1px solid var(--legal-border);
          }
        }

        @media (max-width: 430px) {
          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px;
          }

          .manual-trigger {
            grid-column: 1 / -1;
            width: 100%;
          }

          .case-actions {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .case-actions .deadline-button {
            grid-column: span 2;
          }
        }
 
        /* AL METHER CASES PREMIUM OVERRIDE */

        html,
        body {
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-page {
          height: 100dvh;
          min-height: 100dvh;
          overflow: hidden;
          padding: 12px 16px 72px;
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-shell {
          width: min(1500px, calc(100vw - 32px));
          height: 100%;
          display: flex;
          flex-direction: column;
          margin: 0 auto;
        }

        .cases-header {
          min-height: 46px;
          flex: 0 0 auto;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--legal-border);
        }

        .cases-title small {
          margin-bottom: 2px;
          color: var(--legal-gold);
          font-size: 7px;
          letter-spacing: 0.16em;
        }

        .cases-title h1 {
          color: var(--legal-text);
          font-size: 15px;
          font-weight: 850;
          letter-spacing: -0.02em;
        }

        .cases-title p {
          display: none;
        }

        .header-actions {
          gap: 6px;
        }

        .search-input {
          width: 250px;
          height: 32px;
          padding: 0 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface);
          color: var(--legal-text);
          font-size: 9px;
        }

        .search-input::placeholder {
          color: var(--legal-muted);
        }

        .search-input:focus {
          border-color: var(--legal-gold);
          box-shadow: 0 0 0 3px var(--legal-gold-soft);
        }

        .manual-trigger,
        .cases-theme-button {
          height: 32px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text-soft);
          cursor: pointer;
        }

        .manual-trigger {
          padding: 0 11px;
          font-size: 9px;
          font-weight: 800;
        }

        .cases-theme-button {
          width: 32px;
          color: var(--legal-gold);
          font-size: 13px;
        }

        .manual-trigger:hover,
        .cases-theme-button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
        }

        .manual-form {
          flex: 0 0 auto;
          margin-bottom: 7px;
          padding: 7px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
        }

        .manual-form input {
          height: 31px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text);
          font-size: 9px;
        }

        .manual-form button {
          height: 31px;
          border: 1px solid var(--legal-gold);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
          font-size: 9px;
        }

        .cases-list {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          align-content: start;
          gap: 5px;
          padding-right: 3px;
        }

        .case-row {
          min-height: 48px;
          grid-template-columns:
            185px
            minmax(170px, 1fr)
            auto
            112px;
          gap: 10px;
          padding: 7px 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
          box-shadow: none;
        }

        .case-row:hover {
          border-color: var(--legal-border-strong);
        }

        .case-row.selected {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          box-shadow: inset 3px 0 0 var(--legal-gold);
        }

        .case-number {
          color: var(--legal-text);
          font-size: 10.5px;
          font-weight: 900;
        }

        .case-court {
          margin-top: 2px;
          color: var(--legal-muted);
          font-size: 8px;
        }

        .case-title {
          color: var(--legal-text-soft);
          font-size: 9px;
          font-weight: 700;
        }

        .case-actions {
          gap: 4px;
        }

        .case-actions button {
          height: 27px;
          padding: 0 8px;
          border: 1px solid var(--legal-border);
          border-radius: 7px;
          background: var(--legal-surface-2);
          color: var(--legal-muted);
          font-size: 8px;
          font-weight: 800;
        }

        .case-actions button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
        }

        .case-meta {
          color: var(--legal-muted);
          font-size: 7.5px;
        }

        .case-status {
          margin-top: 2px;
          color: var(--legal-success);
          font-size: 7.5px;
        }

        .case-inline-panel {
          margin-top: 2px;
          padding: 8px;
          border-top: 1px solid var(--legal-border);
          background: var(--legal-surface-2);
        }

        .case-mail-item,
        .case-file-item {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text-soft);
        }

        .case-mail-subject,
        .case-file-item strong {
          color: var(--legal-text);
        }

        .case-mail-sender,
        .case-mail-date,
        .case-file-item span,
        .inline-empty,
        .state-box {
          color: var(--legal-muted);
        }

        .case-note-area {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text);
        }

        .inline-error,
        .inline-actions .danger {
          color: var(--legal-danger);
        }

        .deadline-button.warning {
          border-color: var(--legal-warning) !important;
          color: var(--legal-warning) !important;
        }

        .deadline-button.urgent,
        .deadline-button.critical,
        .deadline-button.overdue {
          border-color: var(--legal-danger) !important;
          color: var(--legal-danger) !important;
        }

        @media (max-width: 900px) {
          html,
          body {
            overflow-y: auto;
          }

          .cases-page {
            height: auto;
            min-height: 100dvh;
            overflow: visible;
            padding: 8px 7px 74px;
          }

          .cases-shell {
            width: 100%;
            height: auto;
          }

          .cases-header {
            display: grid;
            grid-template-columns: 1fr;
            gap: 7px;
          }

          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px
              auto;
          }

          .search-input,
          .cases-theme-button,
          .manual-trigger {
            height: 34px;
          }

          .cases-list {
            overflow: visible;
          }

          .case-row {
            grid-template-columns: 1fr;
            gap: 6px;
            padding: 9px;
          }

          .case-actions {
            display: grid;
            grid-template-columns:
              repeat(5, minmax(0, 1fr));
            gap: 4px;
          }

          .case-actions button {
            width: 100%;
            height: 32px;
            padding: 0 3px;
            font-size: 7.5px;
          }

          .case-meta {
            padding-top: 5px;
            border-top: 1px solid var(--legal-border);
          }
        }

        @media (max-width: 430px) {
          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px;
          }

          .manual-trigger {
            grid-column: 1 / -1;
            width: 100%;
          }

          .case-actions {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .case-actions .deadline-button {
            grid-column: span 2;
          }
        }
 
        /* AL METHER CASES PREMIUM OVERRIDE */

        html,
        body {
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-page {
          height: 100dvh;
          min-height: 100dvh;
          overflow: hidden;
          padding: 12px 16px 72px;
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-shell {
          width: min(1500px, calc(100vw - 32px));
          height: 100%;
          display: flex;
          flex-direction: column;
          margin: 0 auto;
        }

        .cases-header {
          min-height: 46px;
          flex: 0 0 auto;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--legal-border);
        }

        .cases-title small {
          margin-bottom: 2px;
          color: var(--legal-gold);
          font-size: 7px;
          letter-spacing: 0.16em;
        }

        .cases-title h1 {
          color: var(--legal-text);
          font-size: 15px;
          font-weight: 850;
          letter-spacing: -0.02em;
        }

        .cases-title p {
          display: none;
        }

        .header-actions {
          gap: 6px;
        }

        .search-input {
          width: 250px;
          height: 32px;
          padding: 0 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface);
          color: var(--legal-text);
          font-size: 9px;
        }

        .search-input::placeholder {
          color: var(--legal-muted);
        }

        .search-input:focus {
          border-color: var(--legal-gold);
          box-shadow: 0 0 0 3px var(--legal-gold-soft);
        }

        .manual-trigger,
        .cases-theme-button {
          height: 32px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text-soft);
          cursor: pointer;
        }

        .manual-trigger {
          padding: 0 11px;
          font-size: 9px;
          font-weight: 800;
        }

        .cases-theme-button {
          width: 32px;
          color: var(--legal-gold);
          font-size: 13px;
        }

        .manual-trigger:hover,
        .cases-theme-button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
        }

        .manual-form {
          flex: 0 0 auto;
          margin-bottom: 7px;
          padding: 7px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
        }

        .manual-form input {
          height: 31px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text);
          font-size: 9px;
        }

        .manual-form button {
          height: 31px;
          border: 1px solid var(--legal-gold);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
          font-size: 9px;
        }

        .cases-list {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          align-content: start;
          gap: 5px;
          padding-right: 3px;
        }

        .case-row {
          min-height: 48px;
          grid-template-columns:
            185px
            minmax(170px, 1fr)
            auto
            112px;
          gap: 10px;
          padding: 7px 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
          box-shadow: none;
        }

        .case-row:hover {
          border-color: var(--legal-border-strong);
        }

        .case-row.selected {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          box-shadow: inset 3px 0 0 var(--legal-gold);
        }

        .case-number {
          color: var(--legal-text);
          font-size: 10.5px;
          font-weight: 900;
        }

        .case-court {
          margin-top: 2px;
          color: var(--legal-muted);
          font-size: 8px;
        }

        .case-title {
          color: var(--legal-text-soft);
          font-size: 9px;
          font-weight: 700;
        }

        .case-actions {
          gap: 4px;
        }

        .case-actions button {
          height: 27px;
          padding: 0 8px;
          border: 1px solid var(--legal-border);
          border-radius: 7px;
          background: var(--legal-surface-2);
          color: var(--legal-muted);
          font-size: 8px;
          font-weight: 800;
        }

        .case-actions button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
        }

        .case-meta {
          color: var(--legal-muted);
          font-size: 7.5px;
        }

        .case-status {
          margin-top: 2px;
          color: var(--legal-success);
          font-size: 7.5px;
        }

        .case-inline-panel {
          margin-top: 2px;
          padding: 8px;
          border-top: 1px solid var(--legal-border);
          background: var(--legal-surface-2);
        }

        .case-mail-item,
        .case-file-item {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text-soft);
        }

        .case-mail-subject,
        .case-file-item strong {
          color: var(--legal-text);
        }

        .case-mail-sender,
        .case-mail-date,
        .case-file-item span,
        .inline-empty,
        .state-box {
          color: var(--legal-muted);
        }

        .case-note-area {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text);
        }

        .inline-error,
        .inline-actions .danger {
          color: var(--legal-danger);
        }

        .deadline-button.warning {
          border-color: var(--legal-warning) !important;
          color: var(--legal-warning) !important;
        }

        .deadline-button.urgent,
        .deadline-button.critical,
        .deadline-button.overdue {
          border-color: var(--legal-danger) !important;
          color: var(--legal-danger) !important;
        }

        @media (max-width: 900px) {
          html,
          body {
            overflow-y: auto;
          }

          .cases-page {
            height: auto;
            min-height: 100dvh;
            overflow: visible;
            padding: 8px 7px 74px;
          }

          .cases-shell {
            width: 100%;
            height: auto;
          }

          .cases-header {
            display: grid;
            grid-template-columns: 1fr;
            gap: 7px;
          }

          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px
              auto;
          }

          .search-input,
          .cases-theme-button,
          .manual-trigger {
            height: 34px;
          }

          .cases-list {
            overflow: visible;
          }

          .case-row {
            grid-template-columns: 1fr;
            gap: 6px;
            padding: 9px;
          }

          .case-actions {
            display: grid;
            grid-template-columns:
              repeat(5, minmax(0, 1fr));
            gap: 4px;
          }

          .case-actions button {
            width: 100%;
            height: 32px;
            padding: 0 3px;
            font-size: 7.5px;
          }

          .case-meta {
            padding-top: 5px;
            border-top: 1px solid var(--legal-border);
          }
        }

        @media (max-width: 430px) {
          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px;
          }

          .manual-trigger {
            grid-column: 1 / -1;
            width: 100%;
          }

          .case-actions {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .case-actions .deadline-button {
            grid-column: span 2;
          }
        }
 
        /* AL METHER CASES PREMIUM OVERRIDE */

        html,
        body {
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-page {
          height: 100dvh;
          min-height: 100dvh;
          overflow: hidden;
          padding: 12px 16px 72px;
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .cases-shell {
          width: min(1500px, calc(100vw - 32px));
          height: 100%;
          display: flex;
          flex-direction: column;
          margin: 0 auto;
        }

        .cases-header {
          min-height: 46px;
          flex: 0 0 auto;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--legal-border);
        }

        .cases-title small {
          margin-bottom: 2px;
          color: var(--legal-gold);
          font-size: 7px;
          letter-spacing: 0.16em;
        }

        .cases-title h1 {
          color: var(--legal-text);
          font-size: 15px;
          font-weight: 850;
          letter-spacing: -0.02em;
        }

        .cases-title p {
          display: none;
        }

        .header-actions {
          gap: 6px;
        }

        .search-input {
          width: 250px;
          height: 32px;
          padding: 0 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface);
          color: var(--legal-text);
          font-size: 9px;
        }

        .search-input::placeholder {
          color: var(--legal-muted);
        }

        .search-input:focus {
          border-color: var(--legal-gold);
          box-shadow: 0 0 0 3px var(--legal-gold-soft);
        }

        .manual-trigger,
        .cases-theme-button {
          height: 32px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text-soft);
          cursor: pointer;
        }

        .manual-trigger {
          padding: 0 11px;
          font-size: 9px;
          font-weight: 800;
        }

        .cases-theme-button {
          width: 32px;
          color: var(--legal-gold);
          font-size: 13px;
        }

        .manual-trigger:hover,
        .cases-theme-button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
        }

        .manual-form {
          flex: 0 0 auto;
          margin-bottom: 7px;
          padding: 7px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
        }

        .manual-form input {
          height: 31px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-surface-2);
          color: var(--legal-text);
          font-size: 9px;
        }

        .manual-form button {
          height: 31px;
          border: 1px solid var(--legal-gold);
          border-radius: var(--legal-radius-sm);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
          font-size: 9px;
        }

        .cases-list {
          min-height: 0;
          flex: 1;
          overflow-y: auto;
          align-content: start;
          gap: 5px;
          padding-right: 3px;
        }

        .case-row {
          min-height: 48px;
          grid-template-columns:
            185px
            minmax(170px, 1fr)
            auto
            112px;
          gap: 10px;
          padding: 7px 10px;
          border: 1px solid var(--legal-border);
          border-radius: var(--legal-radius-md);
          background: var(--legal-surface);
          box-shadow: none;
        }

        .case-row:hover {
          border-color: var(--legal-border-strong);
        }

        .case-row.selected {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          box-shadow: inset 3px 0 0 var(--legal-gold);
        }

        .case-number {
          color: var(--legal-text);
          font-size: 10.5px;
          font-weight: 900;
        }

        .case-court {
          margin-top: 2px;
          color: var(--legal-muted);
          font-size: 8px;
        }

        .case-title {
          color: var(--legal-text-soft);
          font-size: 9px;
          font-weight: 700;
        }

        .case-actions {
          gap: 4px;
        }

        .case-actions button {
          height: 27px;
          padding: 0 8px;
          border: 1px solid var(--legal-border);
          border-radius: 7px;
          background: var(--legal-surface-2);
          color: var(--legal-muted);
          font-size: 8px;
          font-weight: 800;
        }

        .case-actions button:hover {
          border-color: var(--legal-gold);
          background: var(--legal-gold-soft);
          color: var(--legal-gold-light);
        }

        .case-meta {
          color: var(--legal-muted);
          font-size: 7.5px;
        }

        .case-status {
          margin-top: 2px;
          color: var(--legal-success);
          font-size: 7.5px;
        }

        .case-inline-panel {
          margin-top: 2px;
          padding: 8px;
          border-top: 1px solid var(--legal-border);
          background: var(--legal-surface-2);
        }

        .case-mail-item,
        .case-file-item {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text-soft);
        }

        .case-mail-subject,
        .case-file-item strong {
          color: var(--legal-text);
        }

        .case-mail-sender,
        .case-mail-date,
        .case-file-item span,
        .inline-empty,
        .state-box {
          color: var(--legal-muted);
        }

        .case-note-area {
          border: 1px solid var(--legal-border);
          background: var(--legal-surface);
          color: var(--legal-text);
        }

        .inline-error,
        .inline-actions .danger {
          color: var(--legal-danger);
        }

        .deadline-button.warning {
          border-color: var(--legal-warning) !important;
          color: var(--legal-warning) !important;
        }

        .deadline-button.urgent,
        .deadline-button.critical,
        .deadline-button.overdue {
          border-color: var(--legal-danger) !important;
          color: var(--legal-danger) !important;
        }

        @media (max-width: 900px) {
          html,
          body {
            overflow-y: auto;
          }

          .cases-page {
            height: auto;
            min-height: 100dvh;
            overflow: visible;
            padding: 8px 7px 74px;
          }

          .cases-shell {
            width: 100%;
            height: auto;
          }

          .cases-header {
            display: grid;
            grid-template-columns: 1fr;
            gap: 7px;
          }

          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px
              auto;
          }

          .search-input,
          .cases-theme-button,
          .manual-trigger {
            height: 34px;
          }

          .cases-list {
            overflow: visible;
          }

          .case-row {
            grid-template-columns: 1fr;
            gap: 6px;
            padding: 9px;
          }

          .case-actions {
            display: grid;
            grid-template-columns:
              repeat(5, minmax(0, 1fr));
            gap: 4px;
          }

          .case-actions button {
            width: 100%;
            height: 32px;
            padding: 0 3px;
            font-size: 7.5px;
          }

          .case-meta {
            padding-top: 5px;
            border-top: 1px solid var(--legal-border);
          }
        }

        @media (max-width: 430px) {
          .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              32px;
          }

          .manual-trigger {
            grid-column: 1 / -1;
            width: 100%;
          }

          .case-actions {
            grid-template-columns:
              repeat(3, minmax(0, 1fr));
          }

          .case-actions .deadline-button {
            grid-column: span 2;
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

        /* LIVE CASES HEADER FIX */

        .cases-theme-button {
          display: none !important;
        }
`}</style>

      <div className="cases-shell">
        <header className="cases-header">
          <div className="cases-title">
            <LegalBrand compact />

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
                      className={`case-row ${openCaseId === item.id ? "selected" : ""}`}
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
                            <>
                              {(item.case_mails || []).length === 0 ? (
                                <div className="inline-empty">
                                  Bu davaya bağlı mail bulunmuyor.
                                </div>
                              ) : (
                                <div className="case-mail-list">
                                  {(item.case_mails || []).map(
                                    (mail) => (
                                      <div
                                        key={mail.id}
                                        className="case-mail-item"
                                      >
                                        <div>
                                          <div className="case-mail-subject">
                                            {mail.subject ||
                                              "Konu bilgisi yok"}
                                          </div>

                                          <div className="case-mail-sender">
                                            {mail.sender ||
                                              "Gönderen bilgisi yok"}
                                          </div>
                                        </div>

                                        <div className="case-mail-date">
                                          {formatDate(
                                            mail.received_at
                                          )}
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </>
                          )}

                          {openCaseTab === "file" && (
                            <div className="case-file-panel">
                              <div className="case-file-toolbar">
                                <label className="case-file-upload">
                                  <input
                                    type="file"
                                    accept=".pdf,.doc,.docx,image/jpeg,image/png"
                                    disabled={caseFileUploading}
                                    onChange={(event) => {
                                      const file =
                                        event.target.files?.[0];

                                      if (file) {
                                        uploadCaseFile(
                                          item.id,
                                          file
                                        );
                                      }

                                      event.target.value =
                                        "";
                                    }}
                                  />

                                  {caseFileUploading
                                    ? "Yükleniyor..."
                                    : "+ Dosya Ekle"}
                                </label>
                              </div>

                              {caseFileError && (
                                <div className="inline-error">
                                  {caseFileError}
                                </div>
                              )}

                              {caseFilesLoading ? (
                                <div className="inline-empty">
                                  Dosyalar yükleniyor...
                                </div>
                              ) : caseFiles.length === 0 ? (
                                <div className="inline-empty">
                                  Bu davaya ait dosya bulunmuyor.
                                </div>
                              ) : (
                                <div className="case-file-list">
                                  {caseFiles.map(
                                    (file) => (
                                      <button
                                        type="button"
                                        key={file.id}
                                        className="case-file-item"
                                        onClick={() =>
                                          openCaseFile(
                                            file.id
                                          )
                                        }
                                      >
                                        <div>
                                          <strong>
                                            {file.file_name ||
                                              "Dosya"}
                                          </strong>

                                          <span>
                                            {file.file_type ||
                                              "Dosya"}
                                          </span>
                                        </div>

                                        <span>
                                          Aç →
                                        </span>
                                      </button>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {openCaseTab === "document" && (
                            <div className="case-file-panel">
                              {caseDocumentError && (
                                <div className="inline-error">
                                  {caseDocumentError}
                                </div>
                              )}

                              {caseDocumentsLoading ? (
                                <div className="inline-empty">
                                  Evraklar yükleniyor...
                                </div>
                              ) : caseDocuments.length === 0 ? (
                                <div className="inline-empty">
                                  Bu davaya mailden gelen evrak bulunmuyor.
                                </div>
                              ) : (
                                <div className="case-file-list">
                                  {caseDocuments.map(
                                    (file) => (
                                      <button
                                        type="button"
                                        key={file.id}
                                        className="case-file-item"
                                        onClick={() =>
                                          openCaseFile(
                                            file.id
                                          )
                                        }
                                      >
                                        <div>
                                          <strong>
                                            {file.file_name ||
                                              "Evrak"}
                                          </strong>

                                          <span>
                                            Mailden otomatik alındı
                                          </span>
                                        </div>

                                        <span>
                                          Aç →
                                        </span>
                                      </button>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {openCaseTab === "deadline" && (
                            <>
                              {(item.legal_deadlines || []).length === 0 ? (
                                <div className="inline-empty">
                                  Bu davaya ait kayıtlı süre bulunmuyor.
                                </div>
                              ) : (
                                <div className="case-mail-list">
                                  {(item.legal_deadlines || [])
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
                                    )
                                    .map((deadline) => {
                                      const state =
                                        getDeadlineState(
                                          deadline.calculated_due_date
                                        );

                                      return (
                                        <div
                                          key={deadline.id}
                                          className="case-mail-item"
                                        >
                                          <div>
                                            <div className="case-mail-subject">
                                              {deadline.title ||
                                                "Hukuki süre"}
                                            </div>

                                            <div className="case-mail-sender">
                                              Durum:{" "}
                                              {deadline.status ||
                                                "active"}
                                            </div>
                                          </div>

                                          <div
                                            className={`case-mail-date deadline-button ${state}`}
                                          >
                                            {formatDate(
                                              deadline.calculated_due_date
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              )}
                            </>
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

      <LegalSessionControl />
      <LegalDock />
    </main>
  );
}
















