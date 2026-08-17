"use client";

import LegalBrand from "@/components/LegalBrand";

import {
  useRouter,
} from "next/navigation";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import LegalDock from "@/components/LegalDock";
import LegalSessionControl from "@/components/LegalSessionControl";
import { readJsonResponse } from "@/lib/apiResponse";
import { canAddManualCaseToCalendar } from "@/lib/legal/manualCaseCalendar";
import {
  DATE_ONLY_LEGAL_ALARM_HOUR,
  DEFAULT_MANUAL_REMINDER_TIME,
  resolveDocumentHearingAt,
} from "@/lib/legal/alarmTimeRules";
import { optimizeCaseImageForAnalysis } from "@/lib/legal/clientImageOptimization";
import LegalBackButton from "@/components/LegalBackButton";
import { markSafeAppNavigation } from "@/lib/navigation/backNavigation";

type LegalDeadline = {
  id: string;
  title?: string | null;
  calculated_due_date?: string | null;
  status?: string | null;
  calendar_event_id?: string | null;
};

type DeemedServiceEvent = {
  id: string;
  event_type: "deemed_service";
  start_date?: string | null;
  due_date?: string | null;
};

type CaseMail = {
  id: string;
  subject?: string | null;
  sender?: string | null;
  received_at?: string | null;
  mail_account_id?: string | null;
  mail_account_email?: string | null;
  mail_provider?: string | null;
};

type CaseAttachment = {
  id: string;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  source?: string | null;
  created_at?: string | null;
};

type PaymentReminder = {
  paymentAmount?: number | null;
  paymentCurrency?: string | null;
  paymentDescription?: string | null;
  paymentDueDate?: string | null;
  paymentPeriodText?: string | null;
  sourceDocument?: string | null;
  calendarEventId?: string | null;
};

type ManualCalendarEvent = {
  id: string;
  title?: string | null;
  event_type:
    | "hearing"
    | "manual_deadline";
  start_date?: string | null;
  due_date?: string | null;
  raw?: {
    hearingAt?: string | null;
    manualDeadline?: string | null;
  } | null;
};

type ManualReminder = {
  id: string;
  case_id: string;
  calendar_event_id: string;
  alarm_time: string;
  alarm_type: "manual_reminder";
  message?: string | null;
  status?: string | null;
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
  deemed_service_events?: DeemedServiceEvent[];
  payment_reminders?: PaymentReminder[];
  manual_calendar_events?: ManualCalendarEvent[];
  mail_received_events?: Array<{
    id: string;
    event_type: "mail_received";
    start_date?: string | null;
    raw?: unknown;
  }>;
  case_mails?: CaseMail[];
};

type DocumentCasePreview = {
  court: string;
  fileNo: string;
  decisionNo: string;
  parties: string;
  lawyers: string;
  subject: string;
  caseType: string;
  barcodeNo: string;
  hearingDate: string;
  hearingTime: string;
  explicitDeadline: string;
  caseValue: string;
  caseValueCurrency: string;
  resultAndRequest: string;
  documentDate: string;
  interimMeasureRequested: boolean;
  paymentAmount: string;
  paymentCurrency: string;
  paymentDescription: string;
  paymentDueDate: string;
  paymentPeriodText: string;
  sourceDocument: string;
  documentIdentity: string;
};

const EMPTY_DOCUMENT_PREVIEW:
  DocumentCasePreview = {
    court: "",
    fileNo: "",
    decisionNo: "",
    parties: "",
    lawyers: "",
    subject: "",
    caseType: "Hukuki Belge",
    barcodeNo: "",
    hearingDate: "",
    hearingTime: "",
    explicitDeadline: "",
    caseValue: "",
    caseValueCurrency: "",
    resultAndRequest: "",
    documentDate: "",
    interimMeasureRequested: false,
    paymentAmount: "",
    paymentCurrency: "",
    paymentDescription: "",
    paymentDueDate: "",
    paymentPeriodText: "",
    sourceDocument: "",
    documentIdentity: "",
  };

export default function CasesPage() {
  const router =
    useRouter();

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

  const [manualRecordDate, setManualRecordDate] =
    useState("");

  const [manualHearingAt, setManualHearingAt] =
    useState("");

  const [manualDeadline, setManualDeadline] =
    useState("");

  const [manualNote, setManualNote] =
    useState("");

  const [manualSavedCaseId, setManualSavedCaseId] =
    useState("");

  const [manualFeedback, setManualFeedback] =
    useState("");

  const [documentOpen, setDocumentOpen] =
    useState(false);

  const [documentAnalyzing, setDocumentAnalyzing] =
    useState(false);

  const [documentSaving, setDocumentSaving] =
    useState(false);

  const [documentFile, setDocumentFile] =
    useState<File | null>(null);

  const [documentPreview, setDocumentPreview] =
    useState<DocumentCasePreview | null>(null);

  const [documentFeedback, setDocumentFeedback] =
    useState("");

  const pdfInputRef =
    useRef<HTMLInputElement>(null);

  const photoInputRef =
    useRef<HTMLInputElement>(null);

  const cameraInputRef =
    useRef<HTMLInputElement>(null);

  const [openCaseId, setOpenCaseId] =
    useState("");

  const notificationCaseHandled =
    useRef(false);

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

  const [deleteCandidate, setDeleteCandidate] =
    useState<LegalCase | null>(null);

  const [deletingCaseId, setDeletingCaseId] =
    useState("");

  const [deleteFeedback, setDeleteFeedback] =
    useState("");

  const [deleteError, setDeleteError] =
    useState("");

  const [manualReminderCase, setManualReminderCase] =
    useState<LegalCase | null>(null);

  const [manualReminderDate, setManualReminderDate] =
    useState("");

  const [manualReminderTime, setManualReminderTime] =
    useState(
      DEFAULT_MANUAL_REMINDER_TIME
    );

  const [manualReminderNote, setManualReminderNote] =
    useState("");

  const [manualReminders, setManualReminders] =
    useState<ManualReminder[]>([]);

  const [manualReminderLoading, setManualReminderLoading] =
    useState(false);

  const [manualReminderSaving, setManualReminderSaving] =
    useState(false);

  const [manualReminderError, setManualReminderError] =
    useState("");

  const [manualReminderFeedback, setManualReminderFeedback] =
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

  useEffect(() => {
    if (
      loading ||
      notificationCaseHandled.current
    ) {
      return;
    }

    notificationCaseHandled.current = true;

    const caseId =
      new URLSearchParams(window.location.search)
        .get("case")
        ?.trim() || "";

    if (
      !/^[A-Za-z0-9_-]{1,160}$/.test(caseId) ||
      !cases.some((item) => item.id === caseId)
    ) {
      return;
    }

    setOpenCaseId(caseId);
    setOpenCaseTab("deadline");
  }, [cases, loading]);

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

  function formatDateTime(
    value?: string | null
  ) {
    if (!value) {
      return "—";
    }

    const normalized =
      value.length === 16 &&
      value.includes("T")
        ? `${value}:00+03:00`
        : value;

    const date =
      new Date(normalized);

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
        hour: "2-digit",
        minute: "2-digit",
        timeZone:
          "Europe/Istanbul",
      }
    ).format(date);
  }

  function formatTime(
    value?: string | null
  ) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone:
          "Europe/Istanbul",
      }
    ).format(date);
  }

  function formatReminderDate(
    value?: string | null
  ) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "tr-TR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone:
          "Europe/Istanbul",
      }
    ).format(date);
  }

  function getManualEvent(
    item: LegalCase,
    eventType:
      | "hearing"
      | "manual_deadline"
  ) {
    return (
      item.manual_calendar_events
        ?.find(
          (event) =>
            event.event_type ===
            eventType
        ) || null
    );
  }

  function getLegalDeadlineRecords(item: LegalCase) {
    const deemedServiceEventIds = new Set(
      (item.deemed_service_events || []).map((event) => event.id)
    );

    return (item.legal_deadlines || []).filter(
      (deadline) =>
        !(
          deadline.calendar_event_id &&
          deemedServiceEventIds.has(deadline.calendar_event_id)
        )
    );
  }

  function getNearestDeadline(item: LegalCase) {
    return (
      getLegalDeadlineRecords(item)
        .filter((deadline) => deadline.calculated_due_date)
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

  function getDeemedServiceEvent(item: LegalCase) {
    return (
      (item.deemed_service_events || [])
        .filter((event) => event.due_date || event.start_date)
        .sort(
          (a, b) =>
            new Date(b.due_date || b.start_date || "").getTime() -
            new Date(a.due_date || a.start_date || "").getTime()
        )[0] || null
    );
  }

  function formatPaymentAmount(payment: PaymentReminder) {
    if (typeof payment.paymentAmount !== "number") {
      return "Tutar belirtilmedi";
    }

    const currency =
      payment.paymentCurrency === "TRY"
        ? "TL"
        : payment.paymentCurrency || "";

    return `${new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits:
        Number.isInteger(payment.paymentAmount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(payment.paymentAmount)}${currency ? ` ${currency}` : ""}`;
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

  async function createCasePhotoOcr(
    caseId: string,
    file: File
  ) {
    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      return;
    }

    try {
      /*
       * OCR ayrı çalışır.
       * Orijinal dosyanın davaya eklenmesini bekletmez.
       */
      const ocrForm =
        new FormData();

      ocrForm.append(
        "file",
        file
      );

      const startedAt =
        performance.now();

      const ocrResponse =
        await fetch(
          "/api/convert/image-to-word",
          {
            method:
              "POST",

            body:
              ocrForm,
          }
        );

      if (
        !ocrResponse.ok
      ) {
        const raw =
          await ocrResponse
            .text();

        console.error(
          "CASE PHOTO OCR ERROR:",
          raw
        );

        return;
      }

      const ocrBlob =
        await ocrResponse
          .blob();

      const baseName =
        file.name.replace(
          /\.[^.]+$/,
          ""
        );

      const ocrFile =
        new File(
          [
            ocrBlob,
          ],
          `${baseName}-OCR.docx`,
          {
            type:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }
        );

      const uploadForm =
        new FormData();

      uploadForm.append(
        "caseId",
        caseId
      );

      uploadForm.append(
        "file",
        ocrFile
      );

      const uploadResponse =
        await fetch(
          "/api/attachments",
          {
            method:
              "POST",

            body:
              uploadForm,
          }
        );

      if (
        !uploadResponse.ok
      ) {
        const raw =
          await uploadResponse
            .text();

        console.error(
          "CASE OCR ATTACHMENT ERROR:",
          raw
        );

        return;
      }

      console.info(
        "CASE PHOTO OCR duration:",
        Math.round(
          performance.now() -
          startedAt
        ),
        "ms"
      );

      await loadCaseFiles(
        caseId
      );
    } catch (
      error
    ) {
      console.error(
        "CASE PHOTO OCR ERROR:",
        error
      );
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

      if (
        file.type.startsWith(
          "image/"
        )
      ) {
        /*
         * Await YOK.
         * Kullanıcı dosyanın yüklenmesini OCR yüzünden beklemez.
         */
        void createCasePhotoOcr(
          caseId,
          file
        );
      }
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

  function openCaseFile(
    attachmentId: string
  ) {
    const destination =
      `/file-viewer?attachmentId=${encodeURIComponent(
        attachmentId
      )}`;

    markSafeAppNavigation(
      "/file-viewer"
    );

    router.push(destination);
  }

  function closeCasePanel() {
    setOpenCaseId("");
    setOpenCaseTab("");
  }

  function clearDeletedCaseState(
    caseId: string
  ) {
    if (openCaseId === caseId) {
      setOpenCaseId("");
      setOpenCaseTab("");
      setCaseNote("");
      setCaseNoteError("");
      setCaseFiles([]);
      setCaseFileError("");
      setCaseDocuments([]);
      setCaseDocumentError("");
    }

    if (
      manualSavedCaseId === caseId
    ) {
      setManualSavedCaseId("");
    }
  }

  function requestCaseDeletion(
    item: LegalCase
  ) {
    setDeleteError("");
    setDeleteFeedback("");
    setDeleteCandidate(item);
  }

  async function confirmCaseDeletion() {
    if (
      !deleteCandidate ||
      deletingCaseId
    ) {
      return;
    }

    const caseId =
      deleteCandidate.id;

    try {
      setDeletingCaseId(caseId);
      setDeleteError("");

      const response = await fetch(
        `/api/cases/${encodeURIComponent(
          caseId
        )}`,
        {
          method: "DELETE",
        }
      );
      const data =
        await readJsonResponse(
          response
        );

      if (
        !response.ok ||
        !data?.ok
      ) {
        throw new Error(
          "Dava silinemedi."
        );
      }

      setCases((current) =>
        current.filter(
          (item) =>
            item.id !== caseId
        )
      );
      clearDeletedCaseState(
        caseId
      );
      setDeleteCandidate(null);
      setDeleteFeedback(
        "Dava silindi."
      );
    } catch {
      setDeleteError(
        "Dava silinemedi. Lütfen tekrar deneyin."
      );
    } finally {
      setDeletingCaseId("");
    }
  }

  async function loadManualReminders(
    caseId: string
  ) {
    try {
      setManualReminderLoading(true);
      setManualReminderError("");

      const response = await fetch(
        `/api/cases/manual-reminders?caseId=${encodeURIComponent(
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

      if (
        !response.ok ||
        !data?.ok
      ) {
        throw new Error(
          "Hatırlatmalar alınamadı."
        );
      }

      setManualReminders(
        Array.isArray(
          data.reminders
        )
          ? data.reminders
          : []
      );
    } catch {
      setManualReminders([]);
      setManualReminderError(
        "Hatırlatmalar alınamadı."
      );
    } finally {
      setManualReminderLoading(false);
    }
  }

  function requestManualReminder(
    item: LegalCase
  ) {
    setManualReminderCase(item);
    setManualReminderDate("");
    setManualReminderTime(
      DEFAULT_MANUAL_REMINDER_TIME
    );
    setManualReminderNote("");
    setManualReminderFeedback("");
    setManualReminderError("");
    setManualReminders([]);
    void loadManualReminders(
      item.id
    );
  }

  async function saveManualReminder() {
    if (
      !manualReminderCase ||
      manualReminderSaving
    ) {
      return;
    }

    try {
      setManualReminderSaving(true);
      setManualReminderError("");
      setManualReminderFeedback("");

      const response = await fetch(
        "/api/cases/manual-reminders",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            caseId:
              manualReminderCase.id,
            date:
              manualReminderDate,
            time:
              manualReminderTime,
            note:
              manualReminderNote,
          }),
        }
      );
      const data =
        await readJsonResponse(
          response
        );

      if (
        !response.ok ||
        !data?.ok
      ) {
        throw new Error(
          typeof data?.error ===
            "string"
            ? data.error
            : "Hatırlatma kaydedilemedi."
        );
      }

      if (data.reminder) {
        setManualReminders(
          (current) =>
            Array.from(
              new Map(
                [
                  ...current,
                  data.reminder as
                    ManualReminder,
                ].map(
                  (reminder) => [
                    reminder.id,
                    reminder,
                  ]
                )
              ).values()
            ).sort(
              (left, right) =>
                left.alarm_time
                  .localeCompare(
                    right.alarm_time
                  )
            )
        );
      }

      setManualReminderFeedback(
        data.message ||
          "Manuel hatırlatma kaydedildi."
      );

      if (!data.duplicate) {
        setManualReminderDate("");
        setManualReminderTime(
          DEFAULT_MANUAL_REMINDER_TIME
        );
        setManualReminderNote("");
      }
    } catch (saveError) {
      setManualReminderError(
        saveError instanceof Error
          ? saveError.message
          : "Hatırlatma kaydedilemedi."
      );
    } finally {
      setManualReminderSaving(false);
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

    due.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const days =
      Math.round(
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

    due.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const days =
      Math.round(
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

  function resetManualForm() {
    setManualCaseNo("");
    setManualCourt("");
    setManualTitle("");
    setManualRecordDate("");
    setManualHearingAt("");
    setManualDeadline("");
    setManualNote("");
    setManualSavedCaseId("");
  }

  async function createManualCase(
    addToCalendar = false
  ) {
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
      setManualFeedback("");

      let caseId =
        manualSavedCaseId;

      if (!caseId) {
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
                case_record_date:
                  manualRecordDate ||
                  null,
                note:
                  manualNote.trim() ||
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

        caseId =
          data?.case?.id || "";

        if (!caseId) {
          throw new Error(
            "Dava kimliği alınamadı."
          );
        }

        setManualSavedCaseId(
          caseId
        );
      }

      if (addToCalendar) {
        const calendarResponse =
          await fetch(
            "/api/cases/manual-calendar",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                caseId,
                hearingAt:
                  manualHearingAt ||
                  null,
                manualDeadline:
                  manualDeadline ||
                  null,
                note:
                  manualNote.trim() ||
                  null,
              }),
            }
          );

        const calendarData =
          await calendarResponse
            .json();

        if (
          !calendarResponse.ok ||
          calendarData?.ok !== true
        ) {
          throw new Error(
            calendarData?.error ||
            "Takvim kaydı oluşturulamadı."
          );
        }

        setManualFeedback(
          calendarData.message ||
          (calendarData.duplicate
            ? "Zaten takvimde"
            : "Takvime eklendi")
        );
      } else {
        setManualFeedback(
          "Dava kaydedildi"
        );

        await loadCases();

        if (
          !canAddManualCaseToCalendar(
            manualHearingAt,
            manualDeadline
          )
        ) {
          resetManualForm();
          setManualOpen(false);
        }

        return;
      }

      resetManualForm();
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

  function updateDocumentPreview(
    field: keyof DocumentCasePreview,
    value: string | boolean
  ) {
    setDocumentPreview(
      (current) =>
        current
          ? {
              ...current,
              [field]: value,
            }
          : current
    );
  }

  async function analyzeCaseDocument(
    file: File
  ) {
    try {
      setDocumentAnalyzing(true);
      setError("");
      setDocumentFeedback("");
      setDocumentFile(file);
      setDocumentPreview(null);

      const formData =
        new FormData();

      const analysisFile =
        file.type.startsWith("image/") ||
        /\.(?:jpe?g|png|webp)$/i.test(
          file.name
        )
          ? await optimizeCaseImageForAnalysis(
              file
            )
          : file;

      formData.append(
        "file",
        analysisFile
      );

      const response = await fetch(
        "/api/uets/document-analyze",
        {
          method: "POST",
          body: formData,
        }
      );

      const data =
        await readJsonResponse(
          response
        );

      if (
        !response.ok ||
        data?.ok !== true ||
        !data?.document
      ) {
        throw new Error(
          data?.error ||
            "Belge analiz edilemedi."
        );
      }

      const document =
        data.document;
      const payment =
        document.payment || {};
      const hearing =
        document.hearing || {};
      const explicitDeadline =
        Array.isArray(
          document.deadlines
        )
          ? document.deadlines.find(
              (item: {
                isExplicitFinalDate?: boolean;
                explicitDate?: string;
              }) =>
                item
                  ?.isExplicitFinalDate &&
                item.explicitDate
            )?.explicitDate || ""
          : "";

      setDocumentPreview({
        ...EMPTY_DOCUMENT_PREVIEW,
        court:
          document.court || "",
        fileNo:
          document.fileNo || "",
        decisionNo:
          document.decisionNo || "",
        parties:
          document.parties || "",
        lawyers:
          Array.isArray(document.lawyers)
            ? document.lawyers.join("\n")
            : "",
        subject:
          document.subject || "",
        caseType:
          document.documentType ||
          "Hukuki Belge",
        barcodeNo:
          document.uets
            ?.barcodeNo || "",
        hearingDate:
          hearing.date || "",
        hearingTime:
          hearing.time || "",
        explicitDeadline,
        caseValue:
          typeof document.caseValue ===
            "number"
            ? String(document.caseValue)
            : "",
        caseValueCurrency:
          document.caseValueCurrency ||
          "",
        resultAndRequest:
          document.resultAndRequest ||
          "",
        documentDate:
          document.documentDate || "",
        interimMeasureRequested:
          document.interimMeasureRequested ===
          true,
        paymentAmount:
          typeof payment.paymentAmount ===
            "number"
            ? String(
                payment.paymentAmount
              )
            : "",
        paymentCurrency:
          payment.paymentCurrency ||
          "",
        paymentDescription:
          payment.paymentDescription ||
          "",
        paymentDueDate:
          payment.paymentDueDate ||
          "",
        paymentPeriodText:
          payment.paymentPeriodText ||
          "",
        sourceDocument:
          data.source
            ?.sourceDocument ||
          file.name,
        documentIdentity:
          data.source
            ?.documentIdentity || "",
      });
    } catch (analysisError) {
      setDocumentFile(null);
      setDocumentPreview(null);
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Belge analiz edilemedi."
      );
    } finally {
      setDocumentAnalyzing(false);
    }
  }

  async function attachCreatedCaseDocument(
    caseId: string,
    file: File
  ) {
    if (
      file.size >
      20 * 1024 * 1024
    ) {
      return false;
    }

    const supported = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);

    if (!supported.has(file.type)) {
      return false;
    }

    const formData =
      new FormData();
    formData.append("caseId", caseId);
    formData.append("file", file);

    const response = await fetch(
      "/api/attachments",
      {
        method: "POST",
        body: formData,
      }
    );

    return response.ok;
  }

  async function createDocumentCase(
    addToCalendar: boolean
  ) {
    if (
      !documentPreview ||
      !documentFile
    ) {
      return;
    }

    const title =
      documentPreview.subject.trim() ||
      documentPreview.fileNo.trim() ||
      documentPreview.sourceDocument.trim();

    if (!title) {
      setError(
        "Konu veya dosya numarası girin."
      );
      return;
    }

    try {
      setDocumentSaving(true);
      setError("");
      setDocumentFeedback("");

      const note = [
        documentPreview.decisionNo
          ? `Karar No: ${documentPreview.decisionNo}`
          : "",
        documentPreview.parties
          ? `Taraflar: ${documentPreview.parties}`
          : "",
        documentPreview.barcodeNo
          ? `Barkod/Tebligat No: ${documentPreview.barcodeNo}`
          : "",
        documentPreview.caseValue
          ? `Dava Değeri: ${documentPreview.caseValue}${
              documentPreview.caseValueCurrency
                ? ` ${documentPreview.caseValueCurrency}`
                : ""
            }`
          : "",
        documentPreview.resultAndRequest
          ? `Sonuç ve İstem: ${documentPreview.resultAndRequest}`
          : "",
        documentPreview.paymentPeriodText
          ? `Süre metni: ${documentPreview.paymentPeriodText}`
          : "",
        documentPreview.sourceDocument
          ? `Kaynak belge: ${documentPreview.sourceDocument}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const caseResponse =
        await fetch("/api/cases", {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            case_title: title,
            case_number:
              documentPreview.fileNo ||
              null,
            court_name:
              documentPreview.court ||
              null,
            case_type:
              documentPreview.caseType ||
              null,
            note: note || null,
            source:
              "document_upload",
            document_identity:
              documentPreview
                .documentIdentity ||
              null,
          }),
        });

      const caseData =
        await readJsonResponse(
          caseResponse
        );

      if (!caseResponse.ok) {
        throw new Error(
          caseData?.error ||
            "Dava oluşturulamadı."
        );
      }

      const caseId =
        caseData?.case?.id || "";

      if (!caseId) {
        throw new Error(
          "Dava kimliği alınamadı."
        );
      }

      let attachmentStored = true;

      if (!caseData.duplicate) {
        attachmentStored =
          await attachCreatedCaseDocument(
            caseId,
            documentFile
          );
      }

      const hearingAt =
        resolveDocumentHearingAt(
          documentPreview
            .hearingDate,
          documentPreview
            .hearingTime
        );

      const manualDeadline =
        documentPreview
          .explicitDeadline &&
        documentPreview
          .explicitDeadline !==
          documentPreview
            .paymentDueDate
          ? documentPreview
              .explicitDeadline
          : "";

      const messages: string[] = [
        caseData.duplicate
          ? "Bu belgeye ait dava zaten mevcut."
          : "Dava oluşturuldu.",
      ];

      if (
        !caseData.duplicate &&
        !attachmentStored
      ) {
        messages.push(
          "Belge analiz edildi; mevcut dosya saklama sınırı nedeniyle ek olarak yüklenmedi."
        );
      }

      if (
        addToCalendar &&
        (hearingAt ||
          manualDeadline)
      ) {
        const calendarResponse =
          await fetch(
            "/api/cases/manual-calendar",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                caseId,
                hearingAt:
                  hearingAt || null,
                manualDeadline:
                  manualDeadline ||
                  null,
                note,
              }),
            }
          );

        const calendarData =
          await readJsonResponse(
            calendarResponse
          );

        if (!calendarResponse.ok) {
          throw new Error(
            calendarData?.error ||
              "Takvim kaydı oluşturulamadı."
          );
        }

        messages.push(
          calendarData?.message ||
            "Takvime eklendi."
        );
      }

      if (
        addToCalendar &&
        documentPreview
          .paymentDueDate
      ) {
        const amount =
          documentPreview
            .paymentAmount.trim()
            ? Number(
                documentPreview
                  .paymentAmount
                  .replace(",", ".")
              )
            : null;

        const paymentResponse =
          await fetch(
            "/api/cases/from-analysis",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                case_id: caseId,
                case_number:
                  documentPreview.fileNo,
                court_name:
                  documentPreview.court,
                case_title: title,
                case_type:
                  documentPreview.caseType,
                barcode_no:
                  documentPreview.barcodeNo,
                record_mode:
                  "payment_deadline",
                payment_amount:
                  Number.isFinite(amount)
                    ? amount
                    : null,
                payment_currency:
                  documentPreview
                    .paymentCurrency,
                payment_description:
                  documentPreview
                    .paymentDescription,
                payment_due_date:
                  documentPreview
                    .paymentDueDate,
                payment_period_text:
                  documentPreview
                    .paymentPeriodText,
                source_document:
                  documentPreview
                    .sourceDocument,
                notification_hour:
                  DATE_ONLY_LEGAL_ALARM_HOUR,
              }),
            }
          );

        const paymentData =
          await readJsonResponse(
            paymentResponse
          );

        if (!paymentResponse.ok) {
          throw new Error(
            paymentData?.error ||
              "Ödeme hatırlatıcısı oluşturulamadı."
          );
        }

        messages.push(
          paymentData?.message ||
            "Ödeme hatırlatıcısı oluşturuldu."
        );
      }

      if (
        documentPreview
          .paymentPeriodText &&
        !documentPreview
          .paymentDueDate
      ) {
        messages.push(
          "Süre metni bulundu; başlangıç tarihi doğrulanamadığı için son tarih oluşturulmadı."
        );
      }

      if (
        documentPreview.hearingDate &&
        !documentPreview.hearingTime
      ) {
        messages.push(
          "Duruşma saati doğrulanamadığı için duruşma takvim kaydı oluşturulmadı."
        );
      }

      setDocumentFeedback(
        messages.join(" ")
      );
      setDocumentOpen(false);
      setDocumentPreview(null);
      setDocumentFile(null);
      await loadCases();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Dava oluşturulamadı."
      );
    } finally {
      setDocumentSaving(false);
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

        .manual-form {
          display: grid;
          grid-template-columns:
            repeat(
              3,
              minmax(0, 1fr)
            );
          gap: 8px;
          align-items: end;
        }

        .manual-form label {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .manual-form label > span {
          color: var(--legal-muted);
          font-size: 8px;
          font-weight: 750;
        }

        .manual-form input,
        .manual-form textarea {
          width: 100%;
          min-width: 0;
          border: 1px solid var(--legal-border);
          border-radius: 8px;
          background: var(--legal-surface-2);
          color: var(--legal-text);
        }

        .manual-form textarea {
          min-height: 58px;
          resize: vertical;
          padding: 8px;
          font: inherit;
        }

        .manual-note-field,
        .manual-form-actions {
          grid-column: 1 / -1;
        }

        .manual-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 7px;
        }

        .manual-form-actions button {
          min-width: 120px;
        }

        .manual-form-actions button:disabled {
          opacity: .45;
          cursor: default;
        }

        .manual-feedback {
          color: var(--legal-success);
          border-color: var(--legal-success);
        }

        .case-title {
          display: grid;
          gap: 5px;
        }

        .case-manual-dates {
          display: grid;
          gap: 2px;
        }

        .case-manual-dates small {
          color: var(--legal-gold-light);
          font-size: 7.5px;
          font-weight: 650;
        }

        .case-mail-timeline-label {
          margin-bottom: 3px;
          color: var(--legal-gold-light);
          font-size: 7px;
          font-weight: 850;
          letter-spacing: .05em;
          text-transform: uppercase;
        }

        .case-mail-account {
          margin-top: 2px;
          color: var(--legal-muted);
          font-size: 7.5px;
          overflow-wrap: anywhere;
        }

        .case-panel-back-row {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 8px;
        }

        @media (max-width: 760px) {
          .manual-form {
            grid-template-columns: 1fr;
          }

          .manual-note-field,
          .manual-form-actions {
            grid-column: auto;
          }

          .manual-form-actions {
            display: grid;
            grid-template-columns:
              1fr 1fr;
          }

          .manual-form-actions button {
            width: 100%;
            min-width: 0;
          }
        }

        .cases-shell {
          container-type: inline-size;
        }

        .cases-header {
          display: grid;
          grid-template-columns:
            minmax(150px, 1fr)
            minmax(310px, auto)
            max-content;
          grid-template-areas:
            "title actions session";
          align-items: center;
          gap: 8px;
        }

        .cases-title {
          grid-area: title;
          min-width: 0;
        }

        .cases-header .header-actions {
          grid-area: actions;
          min-width: 0;
          display: grid;
          grid-template-columns:
            minmax(190px, 250px)
            max-content
            max-content;
          align-items: center;
          gap: 6px;
        }

        .cases-header .search-input {
          width: 100%;
          min-width: 0;
        }

        .cases-header
        .legal-session-control {
          position: static !important;
          grid-area: session;
          width: max-content;
          max-width: none;
          margin: 0;
          z-index: auto;
        }

        @container (max-width: 1050px) {
          .cases-header {
            grid-template-columns:
              minmax(0, 1fr)
              max-content;
            grid-template-areas:
              "title session"
              "actions actions";
          }

          .cases-header .header-actions {
            width: 100%;
            grid-template-columns:
              minmax(0, 1fr)
              max-content
              max-content;
          }
        }

        @container (max-width: 760px) {
          .cases-header .header-actions {
            grid-template-columns:
              minmax(0, 1fr)
              minmax(0, 1fr);
          }

          .cases-header .search-input {
            grid-column: 1 / -1;
          }

          .cases-header .manual-trigger {
            width: 100%;
          }
        }

        @container (max-width: 430px) {
          .cases-header .header-actions {
            grid-template-columns: 1fr;
          }

          .cases-header .manual-trigger {
            width: 100%;
          }
        }

        .cases-theme-button {
          display: none !important;
        }

        .case-delete-button {
          border-color: rgba(
            255,
            110,
            135,
            .55
          ) !important;
          color: #ff9aac !important;
        }

        .case-delete-button:hover {
          border-color: #ff6e87 !important;
          background: rgba(
            255,
            110,
            135,
            .12
          ) !important;
        }

        .case-delete-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1200;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(
            3,
            8,
            16,
            .76
          );
          backdrop-filter: blur(5px);
        }

        .case-delete-dialog {
          width: min(420px, 100%);
          padding: 20px;
          border: 1px solid
            var(--legal-border);
          border-radius: 15px;
          background:
            var(--legal-surface);
          box-shadow:
            0 24px 70px
            rgba(0, 0, 0, .42);
        }

        .case-delete-dialog h2 {
          margin: 0 0 8px;
          color: var(--legal-text);
          font-size: 16px;
        }

        .case-delete-dialog p {
          margin: 0;
          color: var(--legal-muted);
          font-size: 11px;
          line-height: 1.55;
        }

        .case-delete-context {
          display: grid;
          gap: 3px;
          margin-top: 14px;
          padding: 11px;
          border: 1px solid
            var(--legal-border);
          border-radius: 10px;
          background:
            var(--legal-surface-2);
        }

        .case-delete-context strong {
          color: var(--legal-text);
          font-size: 12px;
        }

        .case-delete-context span {
          color: var(--legal-muted);
          font-size: 10px;
          overflow-wrap: anywhere;
        }

        .case-delete-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 18px;
        }

        .case-delete-actions button {
          min-height: 36px;
          padding: 0 14px;
          border: 1px solid
            var(--legal-border);
          border-radius: 9px;
          background:
            var(--legal-surface-2);
          color: var(--legal-text);
          cursor: pointer;
          font-size: 10px;
          font-weight: 850;
        }

        .case-delete-actions
        .confirm-delete {
          border-color: #a53a50;
          background: rgba(
            165,
            58,
            80,
            .2
          );
          color: #ff9aac;
        }

        .case-delete-actions
        button:disabled {
          cursor: default;
          opacity: .5;
        }

        .case-delete-error {
          margin-top: 10px !important;
          color: #ff9aac !important;
        }

        @media (max-width: 520px) {
          .case-delete-dialog {
            padding: 16px;
          }

          .case-delete-actions {
            display: grid;
            grid-template-columns:
              1fr 1fr;
          }

          .case-delete-actions button {
            width: 100%;
            min-width: 0;
          }
        }

        .manual-reminder-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1190;
          display: grid;
          place-items: center;
          padding: 18px;
          background: rgba(
            3,
            8,
            16,
            .76
          );
          backdrop-filter: blur(5px);
        }

        .manual-reminder-dialog {
          width: min(480px, 100%);
          max-height:
            min(680px, calc(100vh - 36px));
          overflow-y: auto;
          padding: 20px;
          border: 1px solid
            var(--legal-border);
          border-radius: 15px;
          background:
            var(--legal-surface);
          box-shadow:
            0 24px 70px
            rgba(0, 0, 0, .42);
        }

        .manual-reminder-dialog h2,
        .manual-reminder-dialog h3 {
          margin: 0;
          color: var(--legal-text);
        }

        .manual-reminder-dialog h2 {
          font-size: 16px;
        }

        .manual-reminder-dialog h3 {
          margin-top: 18px;
          font-size: 12px;
        }

        .manual-reminder-case {
          margin-top: 6px;
          color: var(--legal-muted);
          font-size: 10px;
          overflow-wrap: anywhere;
        }

        .manual-reminder-form {
          display: grid;
          grid-template-columns:
            1fr 1fr;
          gap: 9px;
          margin-top: 16px;
        }

        .manual-reminder-form label {
          display: grid;
          gap: 5px;
          min-width: 0;
        }

        .manual-reminder-form label > span {
          color: var(--legal-muted);
          font-size: 9px;
          font-weight: 750;
        }

        .manual-reminder-form input,
        .manual-reminder-form textarea {
          width: 100%;
          min-width: 0;
          border: 1px solid
            var(--legal-border);
          border-radius: 9px;
          background:
            var(--legal-surface-2);
          color: var(--legal-text);
          font: inherit;
        }

        .manual-reminder-form input {
          min-height: 38px;
          padding: 0 10px;
        }

        .manual-reminder-form textarea {
          min-height: 76px;
          padding: 10px;
          resize: vertical;
        }

        .manual-reminder-note {
          grid-column: 1 / -1;
        }

        .manual-reminder-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 14px;
        }

        .manual-reminder-actions button {
          min-height: 36px;
          padding: 0 14px;
          border: 1px solid
            var(--legal-border);
          border-radius: 9px;
          background:
            var(--legal-surface-2);
          color: var(--legal-text);
          cursor: pointer;
          font-size: 10px;
          font-weight: 850;
        }

        .manual-reminder-actions
        .save-reminder {
          border-color: var(--legal-gold);
          color: var(--legal-gold-light);
        }

        .manual-reminder-actions
        button:disabled {
          cursor: default;
          opacity: .5;
        }

        .manual-reminder-message {
          margin-top: 10px;
          font-size: 10px;
        }

        .manual-reminder-message.success {
          color: var(--legal-success);
        }

        .manual-reminder-message.error {
          color: #ff9aac;
        }

        .manual-reminder-list {
          display: grid;
          gap: 7px;
          margin-top: 9px;
        }

        .manual-reminder-item {
          display: grid;
          grid-template-columns:
            auto minmax(0, 1fr);
          gap: 10px;
          padding: 9px 10px;
          border: 1px solid
            var(--legal-border);
          border-radius: 9px;
          background:
            var(--legal-surface-2);
        }

        .manual-reminder-item strong {
          color: var(--legal-gold-light);
          font-size: 10px;
          white-space: nowrap;
        }

        .manual-reminder-item span {
          min-width: 0;
          color: var(--legal-text);
          font-size: 10px;
          overflow-wrap: anywhere;
        }

        @media (max-width: 520px) {
          .manual-reminder-dialog {
            padding: 16px;
          }

          .manual-reminder-form {
            grid-template-columns: 1fr;
          }

          .manual-reminder-note {
            grid-column: auto;
          }

          .manual-reminder-actions {
            display: grid;
            grid-template-columns:
              1fr 1fr;
          }

          .manual-reminder-actions button {
            width: 100%;
            min-width: 0;
          }

          .manual-reminder-item {
            grid-template-columns: 1fr;
            gap: 4px;
          }
        }

        .document-upload-panel {
          display: grid;
          gap: 10px;
          margin-bottom: 10px;
          padding: 13px;
          border: 1px solid var(--legal-border);
          border-radius: 13px;
          background: var(--legal-surface);
        }

        .document-upload-options,
        .document-preview-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .document-upload-options button,
        .document-preview-actions button {
          min-height: 36px;
          padding: 7px 11px;
          border: 1px solid var(--legal-gold);
          border-radius: 9px;
          background: var(--legal-surface-2);
          color: var(--legal-text);
          cursor: pointer;
          font: inherit;
          font-size: 9px;
          font-weight: 800;
        }

        .document-upload-options button:disabled,
        .document-preview-actions button:disabled {
          cursor: default;
          opacity: .45;
        }

        .document-preview-grid {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .document-preview-grid label {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .document-preview-grid label > span {
          color: var(--legal-muted);
          font-size: 8px;
          font-weight: 750;
        }

        .document-preview-grid input,
        .document-preview-grid textarea {
          width: 100%;
          min-width: 0;
          padding: 8px;
          border: 1px solid var(--legal-border);
          border-radius: 8px;
          background: var(--legal-surface-2);
          color: var(--legal-text);
          font: inherit;
          font-size: 9px;
        }

        .document-preview-grid textarea {
          min-height: 58px;
          resize: vertical;
        }

        .document-period-warning {
          margin: 0;
          padding: 8px 10px;
          border: 1px solid var(--legal-gold);
          border-radius: 8px;
          color: var(--legal-gold-light);
          font-size: 8.5px;
          line-height: 1.5;
        }

        @media (max-width: 760px) {
          .document-preview-grid {
            grid-template-columns: 1fr;
          }

          .document-upload-options,
          .document-preview-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .document-upload-options button,
          .document-preview-actions button {
            width: 100%;
          }
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
              onClick={() => {
                setManualOpen(
                  (current) =>
                    !current
                );
                setDocumentOpen(false);
                setError("");
              }}
            >
              + Manuel Dava
            </button>

            <button
              type="button"
              className="manual-trigger document-trigger"
              onClick={() => {
                setDocumentOpen(
                  (current) =>
                    !current
                );
                setManualOpen(false);
                setError("");
              }}
            >
              PDF / Fotoğraf ile Dava Ekle
            </button>
          </div>

          <LegalSessionControl />
        </header>

        {manualOpen && (
          <div className="manual-form">
            <label>
              <span>Dava no</span>
              <input
                value={manualCaseNo}
                onChange={(event) =>
                  setManualCaseNo(
                    event.target.value
                  )
                }
                placeholder="Dava no"
              />
            </label>

            <label>
              <span>Mahkeme</span>
              <input
                value={manualCourt}
                onChange={(event) =>
                  setManualCourt(
                    event.target.value
                  )
                }
                placeholder="Mahkeme"
              />
            </label>

            <label>
              <span>Kısa açıklama</span>
              <input
                value={manualTitle}
                onChange={(event) =>
                  setManualTitle(
                    event.target.value
                  )
                }
                placeholder="Kısa açıklama"
              />
            </label>

            <label>
              <span>Dava kayıt tarihi (opsiyonel)</span>
              <input
                type="date"
                value={manualRecordDate}
                onChange={(event) =>
                  setManualRecordDate(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              <span>Duruşma tarihi ve saati (opsiyonel)</span>
              <input
                type="datetime-local"
                value={manualHearingAt}
                onChange={(event) =>
                  setManualHearingAt(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              <span>Manuel son tarih (opsiyonel)</span>
              <input
                type="date"
                value={manualDeadline}
                onChange={(event) =>
                  setManualDeadline(
                    event.target.value
                  )
                }
              />
            </label>

            <label className="manual-note-field">
              <span>Not (opsiyonel)</span>
              <textarea
                value={manualNote}
                onChange={(event) =>
                  setManualNote(
                    event.target.value
                  )
                }
                placeholder="Dava notu"
              />
            </label>

            <div className="manual-form-actions">
              <button
                type="button"
                disabled={
                  manualSaving ||
                  Boolean(
                    manualSavedCaseId
                  )
                }
                onClick={() =>
                  void createManualCase(
                    false
                  )
                }
              >
                {manualSaving
                  ? "Kaydediliyor..."
                  : manualSavedCaseId
                    ? "Dava Kaydedildi"
                    : "Davayı Kaydet"}
              </button>

              <button
                type="button"
                disabled={
                  manualSaving ||
                  !canAddManualCaseToCalendar(
                    manualHearingAt,
                    manualDeadline
                  )
                }
                onClick={() =>
                  void createManualCase(
                    true
                  )
                }
              >
                Takvime Ekle
              </button>
            </div>
          </div>
        )}

        {documentOpen && (
          <section className="document-upload-panel">
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(event) => {
                const file =
                  event.currentTarget
                    .files?.[0];
                event.currentTarget.value = "";
                if (file) {
                  void analyzeCaseDocument(
                    file
                  );
                }
              }}
            />

            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              hidden
              onChange={(event) => {
                const file =
                  event.currentTarget
                    .files?.[0];
                event.currentTarget.value = "";
                if (file) {
                  void analyzeCaseDocument(
                    file
                  );
                }
              }}
            />

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(event) => {
                const file =
                  event.currentTarget
                    .files?.[0];
                event.currentTarget.value = "";
                if (file) {
                  void analyzeCaseDocument(
                    file
                  );
                }
              }}
            />

            <div className="document-upload-options">
              <button
                type="button"
                disabled={documentAnalyzing}
                onClick={() =>
                  pdfInputRef.current
                    ?.click()
                }
              >
                PDF Seç
              </button>
              <button
                type="button"
                disabled={documentAnalyzing}
                onClick={() =>
                  photoInputRef.current
                    ?.click()
                }
              >
                Fotoğraf Seç
              </button>
              <button
                type="button"
                disabled={documentAnalyzing}
                onClick={() =>
                  cameraInputRef.current
                    ?.click()
                }
              >
                Mobilden Fotoğraf Çek
              </button>
            </div>

            {documentAnalyzing && (
              <div className="state-box">
                Belge analiz ediliyor...
              </div>
            )}

            {documentPreview && (
              <>
                <div className="document-preview-grid">
                  <label>
                    <span>Mahkeme</span>
                    <input
                      value={documentPreview.court}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "court",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Dosya / Esas No</span>
                    <input
                      value={documentPreview.fileNo}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "fileNo",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Karar No</span>
                    <input
                      value={documentPreview.decisionNo}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "decisionNo",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Taraflar</span>
                    <textarea
                      value={documentPreview.parties}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "parties",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Avukatlar</span>
                    <textarea
                      value={documentPreview.lawyers}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "lawyers",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Dava türü / Konu</span>
                    <textarea
                      value={documentPreview.subject}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "subject",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Barkod / Tebligat No</span>
                    <input
                      value={documentPreview.barcodeNo}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "barcodeNo",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Duruşma tarihi</span>
                    <input
                      type="date"
                      value={documentPreview.hearingDate}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "hearingDate",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Duruşma saati</span>
                    <input
                      type="time"
                      value={documentPreview.hearingTime}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "hearingTime",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Açık son tarih</span>
                    <input
                      type="date"
                      value={documentPreview.explicitDeadline}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "explicitDeadline",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Dava Değeri</span>
                    <input
                      inputMode="decimal"
                      value={documentPreview.caseValue}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "caseValue",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Dava Değeri Para Birimi</span>
                    <input
                      value={documentPreview.caseValueCurrency}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "caseValueCurrency",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Sonuç ve İstem</span>
                    <textarea
                      value={documentPreview.resultAndRequest}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "resultAndRequest",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Belge tarihi</span>
                    <input
                      type="date"
                      value={documentPreview.documentDate}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "documentDate",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>İhtiyati tedbir talebi</span>
                    <input
                      type="checkbox"
                      checked={documentPreview.interimMeasureRequested}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "interimMeasureRequested",
                          event.target.checked
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Ödeme tutarı</span>
                    <input
                      inputMode="decimal"
                      value={documentPreview.paymentAmount}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "paymentAmount",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Ödeme para birimi</span>
                    <input
                      value={documentPreview.paymentCurrency}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "paymentCurrency",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Ödeme son tarihi</span>
                    <input
                      type="date"
                      value={documentPreview.paymentDueDate}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "paymentDueDate",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Ödeme açıklaması</span>
                    <textarea
                      value={documentPreview.paymentDescription}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "paymentDescription",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Süre metni</span>
                    <textarea
                      value={documentPreview.paymentPeriodText}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "paymentPeriodText",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Kaynak belge</span>
                    <input
                      value={documentPreview.sourceDocument}
                      onChange={(event) =>
                        updateDocumentPreview(
                          "sourceDocument",
                          event.target.value
                        )
                      }
                    />
                  </label>
                </div>

                {documentPreview.paymentPeriodText &&
                  !documentPreview.paymentDueDate && (
                    <p className="document-period-warning">
                      Süre metni bulundu; başlangıç tarihi doğrulanamadığı için son tarih oluşturulmadı.
                    </p>
                  )}

                <div className="document-preview-actions">
                  <button
                    type="button"
                    disabled={documentSaving}
                    onClick={() =>
                      void createDocumentCase(
                        false
                      )
                    }
                  >
                    Davayı Oluştur
                  </button>

                  <button
                    type="button"
                    disabled={
                      documentSaving ||
                      !(
                        (documentPreview.hearingDate &&
                          documentPreview.hearingTime) ||
                        documentPreview.explicitDeadline ||
                        documentPreview.paymentDueDate
                      )
                    }
                    onClick={() =>
                      void createDocumentCase(
                        true
                      )
                    }
                  >
                    Davayı Oluştur ve Takvime Ekle
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {manualFeedback && (
          <div className="state-box manual-feedback">
            {manualFeedback}
          </div>
        )}

        {documentFeedback && (
          <div className="state-box manual-feedback">
            {documentFeedback}
          </div>
        )}

        {deleteFeedback && (
          <div className="state-box manual-feedback">
            {deleteFeedback}
          </div>
        )}

        {deleteError && !deleteCandidate && (
          <div className="state-box">
            {deleteError}
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

                  const deemedServiceEvent = deadline
                    ? null
                    : getDeemedServiceEvent(item);

                  const deemedServiceDate =
                    deemedServiceEvent?.due_date ||
                    deemedServiceEvent?.start_date;

                  const deadlineState =
                    deemedServiceDate
                      ? "deemed-service"
                      : getDeadlineState(deadline?.calculated_due_date);

                  const manualHearing =
                    getManualEvent(
                      item,
                      "hearing"
                    );

                  const manualDeadlineEvent =
                    getManualEvent(
                      item,
                      "manual_deadline"
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
                        <span>
                          {item.case_title ||
                            "Dava kaydı"}
                        </span>

                        {(manualHearing ||
                          manualDeadlineEvent) && (
                          <div className="case-manual-dates">
                            {manualHearing && (
                              <small>
                                Duruşma: {formatDateTime(
                                  manualHearing.raw
                                    ?.hearingAt ||
                                  manualHearing.start_date
                                )}
                              </small>
                            )}

                            {manualDeadlineEvent && (
                              <small>
                                Manuel son tarih: {formatDate(
                                  manualDeadlineEvent.raw
                                    ?.manualDeadline ||
                                  manualDeadlineEvent.due_date ||
                                  manualDeadlineEvent.start_date
                                )}
                              </small>
                            )}
                          </div>
                        )}
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
                            deemedServiceDate
                              ? `Tebliğ edilmiş sayılma: ${formatDate(deemedServiceDate)}`
                              : deadline?.calculated_due_date
                                ? formatDate(deadline.calculated_due_date)
                              : "Süre yok"
                          }
                        >
                          {deemedServiceDate ? (
                            <>
                              Tebliğ edilmiş sayılma ·{" "}
                              {formatDate(deemedServiceDate)}
                            </>
                          ) : (
                            <>
                              Süre ·{" "}
                              {getDeadlineText(deadline?.calculated_due_date)}
                            </>
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

                        <button
                          type="button"
                          onClick={() =>
                            requestManualReminder(
                              item
                            )
                          }
                        >
                          Alarm Ekle
                        </button>

                        <button
                          type="button"
                          className="case-delete-button"
                          disabled={Boolean(
                            deletingCaseId
                          )}
                          onClick={() =>
                            requestCaseDeletion(
                              item
                            )
                          }
                        >
                          Sil
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
                          <div className="case-panel-back-row">
                            <LegalBackButton
                              fallback="/cases"
                              onBack={closeCasePanel}
                            />
                          </div>

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
                                          <div className="case-mail-timeline-label">
                                            E-posta alındı
                                          </div>

                                          <div className="case-mail-subject">
                                            Konu: {mail.subject ||
                                              "Konu bilgisi yok"}
                                          </div>

                                          <div className="case-mail-sender">
                                            Gönderen: {mail.sender ||
                                              "Gönderen bilgisi yok"}
                                          </div>

                                          <div className="case-mail-account">
                                            Hesap: {mail.mail_account_email ||
                                              "Kaynak hesap bilgisi yok"}

                                            {mail.mail_provider
                                              ? ` · ${mail.mail_provider}`
                                              : ""}
                                          </div>
                                        </div>

                                        <div className="case-mail-date">
                                          {formatDateTime(
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
                                <label className="case-file-upload case-photo-capture">
  Fotoğraf çek

  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    capture="environment"
    onChange={(
      event
    ) => {
      const photo =
        event.target.files?.[0];

      if (
        photo &&
        openCaseId
      ) {
        void uploadCaseFile(
          openCaseId,
          photo
        );
      }

      event.currentTarget.value =
        "";
    }}
  />
</label>
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
                              {(item.payment_reminders || []).length > 0 && (
                                <div className="case-mail-list">
                                  {(item.payment_reminders || []).map(
                                    (payment, index) => (
                                      <div
                                        key={`${payment.sourceDocument || "payment"}-${index}`}
                                        className="case-mail-item"
                                      >
                                        <div>
                                          <div className="case-mail-subject">
                                            {formatPaymentAmount(payment)}
                                            {payment.paymentDescription
                                              ? ` · ${payment.paymentDescription}`
                                              : ""}
                                          </div>
                                          <div className="case-mail-sender">
                                            {payment.paymentDueDate
                                              ? `Son tarih: ${formatDate(payment.paymentDueDate)}`
                                              : payment.paymentPeriodText ||
                                                "Son tarih bulunamadı"}
                                            {" · "}
                                            {payment.sourceDocument ||
                                              "Kaynak PDF belirtilmedi"}
                                          </div>
                                          {!payment.paymentDueDate &&
                                            payment.paymentPeriodText && (
                                              <div className="case-mail-sender">
                                                Süre metni bulundu; başlangıç tarihi doğrulanamadığı için son tarih oluşturulmadı.
                                              </div>
                                            )}
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}

                              {getLegalDeadlineRecords(item).length === 0 ? (
                                (item.payment_reminders || []).length === 0 ? (
                                  <div className="inline-empty">
                                    Bu davaya ait kayıtlı süre bulunmuyor.
                                  </div>
                                ) : null
                              ) : (
                                <div className="case-mail-list">
                                  {getLegalDeadlineRecords(item)
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

      {manualReminderCase && (
        <div
          className="manual-reminder-backdrop"
          role="presentation"
        >
          <section
            className="manual-reminder-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-reminder-title"
          >
            <h2 id="manual-reminder-title">
              Manuel Hatırlatma
            </h2>

            <div className="manual-reminder-case">
              {manualReminderCase.case_number ||
                "Numarasız dava"}
              {" · "}
              {manualReminderCase.court_name ||
                "Mahkeme bilgisi yok"}
            </div>

            <div className="manual-reminder-form">
              <label>
                <span>Tarih</span>
                <input
                  type="date"
                  required
                  value={manualReminderDate}
                  onChange={(event) =>
                    setManualReminderDate(
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>Saat</span>
                <input
                  type="time"
                  required
                  value={manualReminderTime}
                  onChange={(event) =>
                    setManualReminderTime(
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="manual-reminder-note">
                <span>Not / Açıklama</span>
                <textarea
                  maxLength={500}
                  value={manualReminderNote}
                  onChange={(event) =>
                    setManualReminderNote(
                      event.target.value
                    )
                  }
                  placeholder="Hatırlatma notu..."
                />
              </label>
            </div>

            {manualReminderFeedback && (
              <div className="manual-reminder-message success">
                {manualReminderFeedback}
              </div>
            )}

            {manualReminderError && (
              <div className="manual-reminder-message error">
                {manualReminderError}
              </div>
            )}

            <div className="manual-reminder-actions">
              <button
                type="button"
                disabled={manualReminderSaving}
                onClick={() => {
                  setManualReminderCase(null);
                  setManualReminderError("");
                  setManualReminderFeedback("");
                }}
              >
                Vazgeç
              </button>

              <button
                type="button"
                className="save-reminder"
                disabled={
                  manualReminderSaving ||
                  !manualReminderDate ||
                  !manualReminderTime
                }
                onClick={() =>
                  void saveManualReminder()
                }
              >
                {manualReminderSaving
                  ? "Kaydediliyor..."
                  : "Alarmı Kaydet"}
              </button>
            </div>

            <h3>Manuel hatırlatmalar</h3>

            {manualReminderLoading ? (
              <div className="manual-reminder-message">
                Hatırlatmalar yükleniyor...
              </div>
            ) : manualReminders.length === 0 ? (
              <div className="manual-reminder-message">
                Kayıtlı manuel hatırlatma yok.
              </div>
            ) : (
              <div className="manual-reminder-list">
                {manualReminders.map(
                  (reminder) => (
                    <div
                      key={reminder.id}
                      className="manual-reminder-item"
                    >
                      <strong>
                        {formatReminderDate(
                          reminder.alarm_time
                        )}
                        {" · "}
                        {formatTime(
                          reminder.alarm_time
                        )}
                      </strong>
                      <span>
                        {reminder.message ||
                          "Manuel hatırlatma"}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {deleteCandidate && (
        <div
          className="case-delete-backdrop"
          role="presentation"
        >
          <section
            className="case-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="case-delete-title"
          >
            <h2 id="case-delete-title">
              Davayı silmek istediğinize emin misiniz?
            </h2>

            <p>
              Dava ve AL METHER içindeki bağlı kayıtları silinecektir.
            </p>

            <div className="case-delete-context">
              <strong>
                {deleteCandidate.case_number ||
                  "Numarasız dava"}
              </strong>
              <span>
                {deleteCandidate.court_name ||
                  "Mahkeme bilgisi yok"}
              </span>
            </div>

            {deleteError && (
              <p className="case-delete-error">
                {deleteError}
              </p>
            )}

            <div className="case-delete-actions">
              <button
                type="button"
                disabled={Boolean(
                  deletingCaseId
                )}
                onClick={() => {
                  setDeleteCandidate(null);
                  setDeleteError("");
                }}
              >
                Vazgeç
              </button>

              <button
                type="button"
                className="confirm-delete"
                disabled={Boolean(
                  deletingCaseId
                )}
                onClick={() =>
                  void confirmCaseDeletion()
                }
              >
                {deletingCaseId
                  ? "Siliniyor..."
                  : "Davayı Sil"}
              </button>
            </div>
          </section>
        </div>
      )}

      <LegalDock />
    </main>
  );
}


















