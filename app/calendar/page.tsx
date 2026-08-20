"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import LegalBrand from "@/components/LegalBrand";
import LegalDock from "@/components/LegalDock";
import LegalSessionControl from "@/components/LegalSessionControl";
import LegalBackButton from "@/components/LegalBackButton";
import { readJsonResponse } from "@/lib/apiResponse";
import {
  ALARM_LOAD_ERROR_MESSAGE,
  readAlarmApiResponse,
} from "@/lib/calendar/alarmApiResponse";
import {
  getManualReminderPresentation,
  sortCalendarEventsForDisplay,
} from "@/lib/calendar/calendarDisplay";

type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  risk?: string;
  source?: string;
  sourceId?: string;
  caseId?: string;
  eventType?: string;
  raw?: unknown;
};

type ApiResponse = {
  ok: boolean;
  events?: CalendarEvent[];
  error?: string;
};

type CalendarRaw = {
  subject?: string;
  sender?: string;
  receivedAt?: string;
  snippet?: string;
  mailBody?: string;
  aiSummary?: string;
  court?: string;
  caseNumber?: string;
  institution?: string;
  barcodeNo?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  deemedServiceDate?: string;
};

function getCalendarRaw(
  value: unknown
): CalendarRaw {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as CalendarRaw;
  }

  return {};
}

type AttachmentRow = {
  id: string;
  calendar_event_id: string;
  file_name: string;
  file_type?: string | null;
  file_size?: number | null;
  storage_path: string;
  source?: string | null;
  created_at?: string | null;
};

type AlarmRow = {
  id: string;
  calendar_event_id: string;
  legal_deadline_id: string;
  alarm_time: string;
  alarm_type: string;
  message: string;
  status: string;
};

const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

const WEEKDAYS = [
  "Pzt",
  "Sal",
  "Çar",
  "Per",
  "Cum",
  "Cmt",
  "Paz",
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toIsoDate(
  year: number,
  monthIndex: number,
  day: number
): string {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function todayIso(): string {
  const now = new Date();

  return toIsoDate(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}

function formatLongDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long",
  });
}

function getEventKind(event: CalendarEvent) {
  if (
    getManualReminderPresentation(event)
  ) {
    return "manual";
  }

  const text = [
    event.title,
    event.description,
    event.source,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR");

  if (
    text.includes("tebliğ edilmiş sayılma") ||
    text.includes("deemed_service")
  ) {
    return "service";
  }

  if (
    text.includes("duruşma") ||
    text.includes("hearing")
  ) {
    return "hearing";
  }

  if (
    text.includes("son gün") ||
    text.includes("deadline") ||
    event.risk === "critical"
  ) {
    return "deadline";
  }

  return "notice";
}

function getKindLabel(event: CalendarEvent): string {
  const kind = getEventKind(event);

  if (kind === "manual") {
    return "Manuel Hatırlatma";
  }

  if (kind === "service") {
    return "Tebliğ tarihi";
  }

  if (kind === "hearing") {
    return "Duruşma";
  }

  if (kind === "deadline") {
    return "Son gün";
  }

  return "Tebligat";
}

export default function CalendarPage() {
  const now = new Date();

  const [year, setYear] =
    useState(now.getFullYear());

  const [month, setMonth] =
    useState(now.getMonth());

  const [selectedDate, setSelectedDate] =
    useState(todayIso());

  const [events, setEvents] =
    useState<CalendarEvent[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadRequestRef = useRef(0);
  const notificationEventRef = useRef("");

  const [selectedEventId, setSelectedEventId] =
    useState("");
  const [calendarDetailOpen, setCalendarDetailOpen] =
    useState(true);

  const [activeDetailTab, setActiveDetailTab] =
    useState<
      "general" |
      "mail" |
      "attachments" |
      "checklist" |
      "alarm" |
      "notes"
    >("general");

  const [notes, setNotes] =
    useState("");

  const [notesLoading, setNotesLoading] =
    useState(false);

  const [notesSaving, setNotesSaving] =
    useState(false);

  const [notesError, setNotesError] =
    useState("");

  const [notesEditing, setNotesEditing] =
    useState(false);

  const [savedNotes, setSavedNotes] =
    useState("");

  const [attachments, setAttachments] =
    useState<AttachmentRow[]>([]);

  const [attachmentsLoading, setAttachmentsLoading] =
    useState(false);

  const [attachmentUploading, setAttachmentUploading] =
    useState(false);

  const [attachmentsError, setAttachmentsError] =
    useState("");

  const [previewAttachment, setPreviewAttachment] =
    useState<AttachmentRow | null>(null);

  const [previewUrl, setPreviewUrl] =
    useState("");

  const [previewLoading, setPreviewLoading] =
    useState(false);

  const [alarms, setAlarms] =
    useState<AlarmRow[]>([]);

  const [alarmsLoading, setAlarmsLoading] =
    useState(false);

  const [alarmsError, setAlarmsError] =
    useState("");

  const [alarmChangingId, setAlarmChangingId] =
    useState("");

  const [checklist, setChecklist] =
    useState({
      mailRead: false,
      noticeReviewed: false,
      caseOpened: false,
      deadlineChecked: false,
      completed: false,
    });

  const [checklistLoading, setChecklistLoading] =
    useState(false);

  const [checklistSaving, setChecklistSaving] =
    useState(false);

  const [checklistError, setChecklistError] =
    useState("");

  const monthRange = useMemo(() => {
    const first = toIsoDate(
      year,
      month,
      1
    );

    const lastDay = new Date(
      year,
      month + 1,
      0
    ).getDate();

    const last = toIsoDate(
      year,
      month,
      lastDay
    );

    return {
      first,
      last,
      lastDay,
    };
  }, [year, month]);

  const loadEvents = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/calendar-events?from=${monthRange.first}&to=${monthRange.last}`,
        {
          cache: "no-store",
          signal: controller.signal,
        }
      );

      const data =
        (await readJsonResponse(response)) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
            "Takvim kayıtları alınamadı."
        );
      }

      const loadedEvents = data.events || [];

      if (requestId !== loadRequestRef.current) {
        return;
      }

      setEvents(loadedEvents);

      if (loadedEvents.length > 0) {
        const notificationEvent =
          loadedEvents.find(
            (event: CalendarEvent) =>
              event.id === notificationEventRef.current
          );

        if (
          notificationEventRef.current &&
          !notificationEvent
        ) {
          return;
        }

        const firstEventDate =
          (notificationEvent || loadedEvents[0]).startDate;

        const match =
          firstEventDate.match(
            /^(\d{4})-(\d{2})-(\d{2})$/
          );

        if (match) {
          const eventYear =
            Number(match[1]);

          const eventMonth =
            Number(match[2]) - 1;

          setYear(eventYear);
          setMonth(eventMonth);
          setSelectedDate(firstEventDate);

          if (notificationEvent) {
            setSelectedEventId(notificationEvent.id);
            setCalendarDetailOpen(true);
            notificationEventRef.current = "";
          }
        }
      }
    } catch (loadError) {
      if (requestId !== loadRequestRef.current) {
        return;
      }

      setEvents([]);

      setError(
        loadError instanceof DOMException && loadError.name === "AbortError"
          ? "Takvim isteği zaman aşımına uğradı. Lütfen tekrar deneyin."
          : loadError instanceof Error
          ? loadError.message
          : "Takvim kayıtları alınamadı."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (requestId === loadRequestRef.current) {
        setLoading(false);
      }
    }
  }, [monthRange.first, monthRange.last]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const eventId =
      new URLSearchParams(window.location.search)
        .get("event")
        ?.trim() || "";

    if (!/^[A-Za-z0-9_-]{1,160}$/.test(eventId)) return;

    notificationEventRef.current = eventId;

    let disposed = false;

    async function locateEvent() {
      try {
        const response = await fetch(
          `/api/calendar-events?eventId=${encodeURIComponent(eventId)}`,
          { cache: "no-store" }
        );
        const data = (await readJsonResponse(response)) as ApiResponse;
        const target = data.events?.find((event) => event.id === eventId);

        if (disposed) return;

        if (!response.ok || !data.ok || !target) {
          notificationEventRef.current = "";
          return;
        }

        const match = target.startDate.match(
          /^(\d{4})-(\d{2})-(\d{2})$/
        );

        if (!match) return;

        notificationEventRef.current = eventId;
        setYear(Number(match[1]));
        setMonth(Number(match[2]) - 1);
        setSelectedDate(target.startDate);
        setSelectedEventId(eventId);
        setCalendarDetailOpen(true);
      } catch {
        notificationEventRef.current = "";
        // Eski/geçersiz hedefte takvim güvenli varsayılan görünümde kalır.
      }
    }

    void locateEvent();

    return () => {
      disposed = true;
    };
  }, []);

  const eventsByDate = useMemo(() => {
    const map =
      new Map<string, CalendarEvent[]>();

    for (const event of events) {
      const date = event.startDate;

      if (!map.has(date)) {
        map.set(date, []);
      }

      map.get(date)?.push(event);
    }

    for (const [date, dateEvents] of map) {
      map.set(
        date,
        sortCalendarEventsForDisplay(
          dateEvents
        )
      );
    }

    return map;
  }, [events]);

  const selectedEvents =
    eventsByDate.get(selectedDate) || [];

  useEffect(() => {
    if (selectedEvents.length === 0) {
      setSelectedEventId("");
      return;
    }

    const selectedStillExists =
      selectedEvents.some(
        (event) =>
          event.id === selectedEventId
      );

    if (!selectedStillExists) {
      setSelectedEventId(
        selectedEvents[0].id
      );
    }
  }, [
    selectedDate,
    selectedEvents,
    selectedEventId,
  ]);

  const selectedEvent = calendarDetailOpen
    ? selectedEvents.find(
        (event) =>
          event.id === selectedEventId
      ) ||
      selectedEvents[0] ||
      null
    : null;

  const selectedRaw =
    getCalendarRaw(
      selectedEvent?.raw
    );
  const selectedManualReminder =
    selectedEvent
      ? getManualReminderPresentation(
          selectedEvent
        )
      : null;

  useEffect(() => {
    async function loadAttachments() {
      if (!selectedEvent?.id) {
        setAttachments([]);
        setAttachmentsError("");
        return;
      }

      try {
        setAttachmentsLoading(true);
        setAttachmentsError("");

        const response = await fetch(
          `/api/attachments?calendarEventId=${encodeURIComponent(
            selectedEvent.id
          )}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok || !data?.ok) {
          throw new Error(
            data?.error ||
              "Ekler alınamadı."
          );
        }

        setAttachments(
          data.attachments || []
        );
      } catch (error) {
        setAttachments([]);

        setAttachmentsError(
          error instanceof Error
            ? error.message
            : "Ekler alınamadı."
        );
      } finally {
        setAttachmentsLoading(false);
      }
    }

    loadAttachments();
  }, [selectedEvent?.id]);

  async function convertImagesToPdfAndUpload(
    imageFiles: File[]
  ) {
    if (
      !selectedEvent?.id ||
      imageFiles.length === 0
    ) {
      return;
    }

    try {
      setAttachmentUploading(true);
      setAttachmentsError("");

      const pdfDocument =
        await PDFDocument.create();

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 28;

      const availableWidth =
        pageWidth - margin * 2;

      const availableHeight =
        pageHeight - margin * 2;

      for (const imageFile of imageFiles) {
        const imageBytes =
          await imageFile.arrayBuffer();

        let embeddedImage;

        if (
          imageFile.type === "image/png"
        ) {
          embeddedImage =
            await pdfDocument.embedPng(
              imageBytes
            );
        } else if (
          imageFile.type === "image/jpeg"
        ) {
          embeddedImage =
            await pdfDocument.embedJpg(
              imageBytes
            );
        } else {
          throw new Error(
            `${imageFile.name} desteklenmeyen görsel türünde.`
          );
        }

        const scale = Math.min(
          availableWidth /
            embeddedImage.width,
          availableHeight /
            embeddedImage.height
        );

        const imageWidth =
          embeddedImage.width * scale;

        const imageHeight =
          embeddedImage.height * scale;

        const page =
          pdfDocument.addPage([
            pageWidth,
            pageHeight,
          ]);

        page.drawImage(
          embeddedImage,
          {
            x:
              (pageWidth -
                imageWidth) /
              2,

            y:
              (pageHeight -
                imageHeight) /
              2,

            width:
              imageWidth,

            height:
              imageHeight,
          }
        );
      }

      const pdfBytes =
        await pdfDocument.save();

      const timestamp =
        new Date()
          .toISOString()
          .replace(
            /[:.]/g,
            "-"
          );

      const pdfFile =
        new File(
          [new Uint8Array(pdfBytes)],
          `belgeler-${timestamp}.pdf`,
          {
            type:
              "application/pdf",
          }
        );

      await uploadAttachment(
        pdfFile
      );
    } catch (error) {
      setAttachmentsError(
        error instanceof Error
          ? error.message
          : "Görseller PDF'e dönüştürülemedi."
      );

      setAttachmentUploading(false);
    }
  }

  async function convertImageToPdfAndUpload(
    imageFile: File
  ) {
    if (!selectedEvent?.id) {
      return;
    }

    try {
      setAttachmentUploading(true);
      setAttachmentsError("");

      const imageBytes =
        await imageFile.arrayBuffer();

      const pdfDocument =
        await PDFDocument.create();

      let embeddedImage;

      if (
        imageFile.type === "image/png"
      ) {
        embeddedImage =
          await pdfDocument.embedPng(
            imageBytes
          );
      } else {
        embeddedImage =
          await pdfDocument.embedJpg(
            imageBytes
          );
      }

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 28;

      const availableWidth =
        pageWidth - margin * 2;

      const availableHeight =
        pageHeight - margin * 2;

      const scale = Math.min(
        availableWidth /
          embeddedImage.width,
        availableHeight /
          embeddedImage.height
      );

      const imageWidth =
        embeddedImage.width * scale;

      const imageHeight =
        embeddedImage.height * scale;

      const page =
        pdfDocument.addPage([
          pageWidth,
          pageHeight,
        ]);

      page.drawImage(
        embeddedImage,
        {
          x:
            (pageWidth -
              imageWidth) /
            2,

          y:
            (pageHeight -
              imageHeight) /
            2,

          width:
            imageWidth,

          height:
            imageHeight,
        }
      );

      const pdfBytes =
        await pdfDocument.save();

      const baseName =
        imageFile.name
          .replace(
            /\.[^.]+$/,
            ""
          )
          .trim() ||
        "belge";

      const pdfFile =
        new File(
          [new Uint8Array(pdfBytes)],
          `${baseName}.pdf`,
          {
            type:
              "application/pdf",
          }
        );

      await uploadAttachment(
        pdfFile
      );
    } catch (error) {
      setAttachmentsError(
        error instanceof Error
          ? error.message
          : "Görsel PDF'e dönüştürülemedi."
      );

      setAttachmentUploading(false);
    }
  }

  async function uploadAttachment(
    file: File
  ) {
    if (!selectedEvent?.id) {
      return;
    }

    try {
      setAttachmentUploading(true);
      setAttachmentsError("");

      const formData =
        new FormData();

      formData.append(
        "calendarEventId",
        selectedEvent.id
      );

      formData.append(
        "file",
        file
      );

      const response = await fetch(
        "/api/attachments",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "Dosya yüklenemedi."
        );
      }

      setAttachments((current) => [
        data.attachment,
        ...current,
      ]);
    } catch (error) {
      setAttachmentsError(
        error instanceof Error
          ? error.message
          : "Dosya yüklenemedi."
      );
    } finally {
      setAttachmentUploading(false);
    }
  }

  async function getAttachmentUrl(
    attachmentId: string
  ) {
    const response = await fetch(
      `/api/attachments?attachmentId=${encodeURIComponent(
        attachmentId
      )}`,
      {
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok || !data?.ok) {
      throw new Error(
        data?.error ||
          "Dosya bağlantısı oluşturulamadı."
      );
    }

    if (!data.signedUrl) {
      throw new Error(
        "Dosya bağlantısı bulunamadı."
      );
    }

    return data.signedUrl as string;
  }

  async function previewAttachmentFile(
    attachment: AttachmentRow
  ) {
    try {
      setPreviewLoading(true);
      setAttachmentsError("");

      const signedUrl =
        await getAttachmentUrl(
          attachment.id
        );

      if (
        attachment.file_type ===
        "application/pdf"
      ) {
        setPreviewAttachment(
          attachment
        );
        setPreviewUrl(signedUrl);
        return;
      }

      window.open(
        signedUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      setAttachmentsError(
        error instanceof Error
          ? error.message
          : "Dosya açılamadı."
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function downloadAttachment(
    attachment: AttachmentRow
  ) {
    try {
      setAttachmentsError("");

      const signedUrl =
        await getAttachmentUrl(
          attachment.id
        );

      const link =
        document.createElement("a");

      link.href = signedUrl;
      link.download =
        attachment.file_name ||
        "dosya";

      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setAttachmentsError(
        error instanceof Error
          ? error.message
          : "Dosya indirilemedi."
      );
    }
  }

  function closeAttachmentPreview() {
    setPreviewAttachment(null);
    setPreviewUrl("");
  }
  async function renameAttachment(
    attachment: AttachmentRow
  ) {
    const nextName =
      window.prompt(
        "Yeni dosya adını yazın:",
        attachment.file_name
      );

    if (nextName === null) {
      return;
    }

    const cleanName =
      nextName.trim();

    if (!cleanName) {
      setAttachmentsError(
        "Dosya adı boş olamaz."
      );
      return;
    }

    try {
      setAttachmentsError("");

      const response = await fetch(
        "/api/attachments",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            attachmentId:
              attachment.id,
            fileName:
              cleanName,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "Dosya adı güncellenemedi."
        );
      }

      setAttachments((current) =>
        current.map((item) =>
          item.id === attachment.id
            ? data.attachment
            : item
        )
      );
    } catch (error) {
      setAttachmentsError(
        error instanceof Error
          ? error.message
          : "Dosya adı güncellenemedi."
      );
    }
  }
  async function deleteAttachment(
    attachmentId: string
  ) {
    const approved =
      window.confirm(
        "Bu ek kalıcı olarak silinsin mi?"
      );

    if (!approved) {
      return;
    }

    try {
      setAttachmentsError("");

      const response = await fetch(
        `/api/attachments?attachmentId=${encodeURIComponent(
          attachmentId
        )}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "Ek silinemedi."
        );
      }

      setAttachments((current) =>
        current.filter(
          (attachment) =>
            attachment.id !==
            attachmentId
        )
      );
    } catch (error) {
      setAttachmentsError(
        error instanceof Error
          ? error.message
          : "Ek silinemedi."
      );
    }
  }

  useEffect(() => {
    async function loadNote() {
      if (!selectedEvent?.id) {
        setNotes("");
        setNotesError("");
        return;
      }

      try {
        setNotesLoading(true);
        setNotesError("");

        const response = await fetch(
          `/api/notes?calendarEventId=${encodeURIComponent(
            selectedEvent.id
          )}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok || !data?.ok) {
          throw new Error(
            data?.error ||
              "Not alınamadı."
          );
        }

        const loadedNote =
          data.note?.note_text || "";

        setNotes(loadedNote);
        setSavedNotes(loadedNote);
        setNotesEditing(!loadedNote);
      } catch (error) {
        setNotes("");
        setNotesError(
          error instanceof Error
            ? error.message
            : "Not alınamadı."
        );
      } finally {
        setNotesLoading(false);
      }
    }

    loadNote();
  }, [selectedEvent?.id]);

  async function saveNote() {
    if (!selectedEvent?.id) {
      return;
    }

    try {
      setNotesSaving(true);
      setNotesError("");

      const response = await fetch(
        "/api/notes",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            calendarEventId:
              selectedEvent.id,
            noteText:
              notes,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "Not kaydedilemedi."
        );
      }

      setSavedNotes(notes);
      setNotesEditing(false);
    } catch (error) {
      setNotesError(
        error instanceof Error
          ? error.message
          : "Not kaydedilemedi."
      );
    } finally {
      setNotesSaving(false);
    }
  }

  async function deleteNote() {
    if (!selectedEvent?.id) {
      return;
    }

    const approved =
      window.confirm(
        "Bu not kalıcı olarak silinsin mi?"
      );

    if (!approved) {
      return;
    }

    try {
      setNotesSaving(true);
      setNotesError("");

      const response = await fetch(
        `/api/notes?calendarEventId=${encodeURIComponent(
          selectedEvent.id
        )}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "Not silinemedi."
        );
      }

      setNotes("");
      setSavedNotes("");
      setNotesEditing(true);
    } catch (error) {
      setNotesError(
        error instanceof Error
          ? error.message
          : "Not silinemedi."
      );
    } finally {
      setNotesSaving(false);
    }
  }

  useEffect(() => {
    async function loadChecklist() {
      if (!selectedEvent?.id) {
        setChecklist({
          mailRead: false,
          noticeReviewed: false,
          caseOpened: false,
          deadlineChecked: false,
          completed: false,
        });

        setChecklistError("");
        return;
      }

      try {
        setChecklistLoading(true);
        setChecklistError("");

        const response = await fetch(
          `/api/checklist?calendarEventId=${encodeURIComponent(
            selectedEvent.id
          )}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok || !data?.ok) {
          throw new Error(
            data?.error ||
              "Checklist alınamadı."
          );
        }

        const stored = data.checklist;

        setChecklist({
          mailRead:
            Boolean(stored?.mail_read),

          noticeReviewed:
            Boolean(
              stored?.notice_reviewed
            ),

          caseOpened:
            Boolean(stored?.case_opened),

          deadlineChecked:
            Boolean(
              stored?.deadline_checked
            ),

          completed:
            Boolean(stored?.completed),
        });
      } catch (error) {
        setChecklistError(
          error instanceof Error
            ? error.message
            : "Checklist alınamadı."
        );
      } finally {
        setChecklistLoading(false);
      }
    }

    loadChecklist();
  }, [selectedEvent?.id]);

  async function updateChecklist(
    key: keyof typeof checklist,
    checked: boolean
  ) {
    if (!selectedEvent?.id) {
      return;
    }

    const nextChecklist = {
      ...checklist,
      [key]: checked,
    };

    setChecklist(nextChecklist);
    setChecklistSaving(true);
    setChecklistError("");

    try {
      const response = await fetch(
        "/api/checklist",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            calendarEventId:
              selectedEvent.id,

            ...nextChecklist,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "Checklist kaydedilemedi."
        );
      }
    } catch (error) {
      setChecklist({
        ...nextChecklist,
        [key]: !checked,
      });

      setChecklistError(
        error instanceof Error
          ? error.message
          : "Checklist kaydedilemedi."
      );
    } finally {
      setChecklistSaving(false);
    }
  }

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadAlarms() {
      if (
        activeDetailTab !== "alarm" ||
        !selectedEvent?.id
      ) {
        setAlarms([]);
        setAlarmsError("");
        setAlarmsLoading(false);
        return;
      }

      try {
        setAlarmsLoading(true);
        setAlarmsError("");

        const response = await fetch(
          `/api/alarms?calendarEventId=${encodeURIComponent(
            selectedEvent.id
          )}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result =
          await readAlarmApiResponse<{
            ok?: boolean;
            alarms?: AlarmRow[];
          }>(response);

        if (!result.ok) {
          throw new Error(result.error);
        }

        setAlarms(
          Array.isArray(result.data?.alarms)
            ? result.data.alarms
            : []
        );
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException &&
            error.name === "AbortError")
        ) {
          return;
        }

        setAlarms([]);
        setAlarmsError(ALARM_LOAD_ERROR_MESSAGE);
      } finally {
        if (!controller.signal.aborted) {
          setAlarmsLoading(false);
        }
      }
    }

    void loadAlarms();

    return () => {
      controller.abort();
    };
  }, [activeDetailTab, selectedEvent?.id]);

  async function changeAlarmStatus(
    alarm: AlarmRow
  ) {
    const nextStatus =
      alarm.status === "active"
        ? "disabled"
        : "active";

    try {
      setAlarmChangingId(
        alarm.id
      );

      setAlarmsError("");

      const response =
        await fetch(
          "/api/alarms",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              alarmId:
                alarm.id,

              status:
                nextStatus,
            }),
          }
        );

      const result =
        await readAlarmApiResponse<{
          ok?: boolean;
          alarm?: AlarmRow;
        }>(response);

      if (
        !result.ok ||
        !result.data?.alarm
      ) {
        throw new Error(
          "Alarm durumu değiştirilemedi."
        );
      }

      const updatedAlarm =
        result.data.alarm;

      setAlarms(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              alarm.id
                ? updatedAlarm
                : item
          )
      );
    } catch (error) {
      setAlarmsError(
          "Alarm durumu değiştirilemedi."
      );
    } finally {
      setAlarmChangingId("");
    }
  }
  const todayEvents =
    eventsByDate.get(todayIso()) || [];

  const criticalCount = events.filter(
    (event) =>
      event.risk === "critical" ||
      getEventKind(event) === "deadline"
  ).length;

  const noticeCount = events.filter(
    (event) =>
      getEventKind(event) === "notice" ||
      getEventKind(event) === "service"
  ).length;

  const firstDay = new Date(
    year,
    month,
    1
  ).getDay();

  const mondayBasedOffset =
    firstDay === 0
      ? 6
      : firstDay - 1;

  const calendarCells = [
    ...Array.from(
      { length: mondayBasedOffset },
      () => null
    ),
    ...Array.from(
      { length: monthRange.lastDay },
      (_, index) => index + 1
    ),
  ];

  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null);
  }

  function changeMonth(direction: number) {
    const next = new Date(
      year,
      month + direction,
      1
    );

    setYear(next.getFullYear());
    setMonth(next.getMonth());

    setSelectedDate(
      toIsoDate(
        next.getFullYear(),
        next.getMonth(),
        1
      )
    );
  }

  function goToday() {
    const today = new Date();

    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDate(todayIso());
  }

  return (
    <main
      className="legal-app lawyer-calendar"
    >
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          min-height: 100%;
          font-family:
            "Segoe UI Variable",
            "Segoe UI",
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            sans-serif;
        }

        button {
          font: inherit;
        }

        .lawyer-calendar {
          min-height: 100vh;
          padding: 18px;
          transition:
            background 180ms ease,
            color 180ms ease;
        }

        .lawyer-calendar {
          --bg: var(--legal-bg);
          --surface: var(--legal-surface);
          --surface-2: var(--legal-surface-2);
          --surface-3: var(--legal-surface-2);
          --border: var(--legal-border);
          --text: var(--legal-text);
          --muted: var(--legal-muted);
          --accent: var(--legal-gold);
          --accent-2: var(--legal-gold);
          --warning: var(--legal-warning);
          --success: var(--legal-success);
          --danger: var(--legal-danger);
          --cyan: var(--legal-gold);
          --violet-soft: var(--legal-gold-soft);
          --blue-soft: var(--legal-gold-soft);
          --cyan-soft: var(--legal-gold-soft);
          --danger-soft: color-mix(in srgb, var(--legal-danger) 12%, transparent);
          --shadow: color-mix(in srgb, var(--legal-text) 18%, transparent);
          background: var(--legal-bg);
          color: var(--legal-text);
        }

        .workspace {
          width: min(1680px, 100%);
          height: calc(100vh - 36px);
          margin: 0 auto;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 22px;
          background: var(--surface);
          box-shadow:
            0 22px 70px var(--shadow);
        }

        .topbar {
          min-height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 18px;
          border-bottom: 1px solid var(--border);
        }

        .brand {
          display: flex;
          align-items: center;
          min-width: 0;
        }

        .brand-copy {
          display: grid;
          gap: 2px;
        }

        .brand-kicker {
          color: var(--accent-2);
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.22em;
        }


        .brand-title {
          margin: 0;
          font-size: 16px;
          letter-spacing: 0.10em;
          font-weight: 950;
          text-shadow:
            0 0 22px rgba(79, 140, 255, 0.12);
        }

        .brand-subtitle {
          margin: 3px 0 0;
          color: var(--muted);
          font-size: 11px;
        }

        .top-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .action-button {
          height: 38px;
          border: 1px solid var(--border);
          border-radius: 11px;
          background: var(--surface-2);
          color: var(--text);
          padding: 0 13px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 750;
        }

        .action-button:hover {
          border-color: var(--accent-2);
        }

        .main-grid {
          min-height: 0;
          display: grid;
          grid-template-columns:
            minmax(620px, 2.35fr)
            minmax(330px, 1fr);
        }

        .summary-panel,
        .calendar-panel,
        .detail-panel {
          min-height: 0;
          overflow: hidden;
        }

        .summary-panel {
          display: none;
        }

        .calendar-panel {
          padding: 16px 20px;
          border-right: 1px solid var(--border);
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          min-width: 0;
          background:
            radial-gradient(
              circle at 50% 0%,
              rgba(79, 140, 255, 0.055),
              transparent 35%
            );
        }

        .detail-panel {
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
          background:
            linear-gradient(
              180deg,
              rgba(79, 140, 255, 0.035),
              transparent 38%
            );
        }

        .section-eyebrow {
          margin-bottom: 6px;
          color: var(--accent-2);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .section-title {
          margin: 0;
          font-size: 19px;
          line-height: 1.25;
        }

        .summary-stack {
          display: grid;
          gap: 10px;
          margin-top: 18px;
        }

        .summary-item {
          padding: 13px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface-2);
        }

        .summary-value {
          font-size: 25px;
          font-weight: 900;
        }

        .summary-label {
          margin-top: 4px;
          color: var(--muted);
          font-size: 11px;
        }

        .calendar-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .calendar-navigation {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .month-title {
          min-width: 175px;
          text-align: center;
          font-size: 18px;
          font-weight: 900;
        }

        .icon-button {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border: 1px solid var(--border);
          border-radius: 11px;
          background: var(--surface-2);
          color: var(--text);
          cursor: pointer;
          font-size: 18px;
        }

        .weekdays,
        .month-grid {
          display: grid;
          grid-template-columns:
            repeat(7, minmax(0, 1fr));
        }

        .weekdays {
          margin-bottom: 6px;
        }

        .weekday {
          padding: 8px 4px;
          color: var(--muted);
          text-align: center;
          font-size: 10px;
          font-weight: 850;
        }

        .month-grid {
          min-height: 0;
          gap: 6px;
          grid-template-rows: repeat(6, minmax(0, 1fr));
        }

        .day-cell {
          position: relative;
          min-height: 0;
          padding: 11px;
          border: 1px solid var(--border);
          border-radius: 15px;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.018),
              transparent
            ),
            var(--surface-2);
          color: var(--text);
          text-align: left;
          cursor: pointer;
          overflow: hidden;
          transition:
            transform 150ms ease,
            border-color 150ms ease,
            background 150ms ease,
            box-shadow 150ms ease;
        }

        .day-cell::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0;
          background:
            radial-gradient(
              circle at 50% 0%,
              rgba(79, 140, 255, 0.15),
              transparent 62%
            );
          transition: opacity 150ms ease;
        }

        .day-cell:hover {
          transform: translateY(-2px);
          border-color: rgba(79, 140, 255, 0.65);
          box-shadow:
            0 10px 24px rgba(0, 0, 0, 0.10),
            0 0 18px rgba(79, 140, 255, 0.08);
        }

        .day-cell:hover::after {
          opacity: 1;
        }

        .day-cell.empty {
          border-color: transparent;
          background: transparent;
          cursor: default;
        }

        .day-cell.selected {
          border-color: var(--accent);
          background:
            linear-gradient(
              145deg,
              var(--violet-soft),
              var(--blue-soft)
            ),
            var(--surface-2);
          box-shadow:
            inset 0 0 0 1px var(--accent),
            0 0 24px rgba(155, 109, 255, 0.16);
        }

        .day-cell.today {
          background:
            linear-gradient(
              145deg,
              rgba(79, 140, 255, 0.15),
              rgba(143, 114, 255, 0.10)
            ),
            var(--surface-2);
        }

        .day-number {
          position: relative;
          z-index: 1;
          width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: -0.02em;
        }

        .today .day-number {
          background: var(--accent-2);
          color: white;
        }

        .event-dots {
          display: grid;
          gap: 4px;
          margin-top: 7px;
        }
        .event-count-chip {
          position: relative;
          z-index: 1;
          width: fit-content;
          max-width: 100%;
          padding: 4px 7px;
          border: 1px solid rgba(155, 109, 255, 0.28);
          border-radius: 8px;
          background: var(--violet-soft);
          color: var(--accent);
          font-size: 9px;
          font-weight: 900;
          white-space: nowrap;
        }

        .event-chip {
          position: relative;
          z-index: 1;
          overflow: hidden;
          max-width: 100%;
          padding: 5px 8px;
          border: 1px solid transparent;
          border-radius: 8px;
          background: var(--surface-3);
          color: var(--muted);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: -0.01em;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .event-chip.service {
          border-color: rgba(34, 211, 167, 0.24);
          box-shadow:
            0 0 15px rgba(34, 211, 167, 0.06);
        }

        .event-chip.deadline {
          border-color: rgba(255, 93, 115, 0.25);
        }

        .event-chip.hearing {
          border-color: rgba(242, 184, 75, 0.25);
        }

        .event-chip.deadline {
          color: var(--danger);
          background: var(--danger-soft);
        }

        .event-chip.service {
          color: var(--success);
          background: rgba(34, 211, 167, 0.12);
        }

        .event-chip.hearing {
          color: var(--warning);
          background: rgba(242, 184, 75, 0.12);
        }

        .event-chip.notice {
          color: var(--cyan);
          background: var(--cyan-soft);
        }

        .detail-date {
          margin: 0 0 10px;
          padding-left: 12px;
          border-left: 3px solid var(--accent);
          font-size: 17px;
          line-height: 1.35;
          font-weight: 850;
        }

        .detail-list {
          min-height: 0;
          display: grid;
          gap: 10px;
          overflow: hidden;
        }

        .event-selector {
          display: grid;
          gap: 6px;
          margin-bottom: 8px;
        }

        .event-selector-title {
          color: var(--accent-2);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .event-selector-list {
          display: flex;
          gap: 6px;
          overflow: hidden;
        }

        .event-selector-button {
          display: grid;
          grid-template-columns: 20px minmax(0, 1fr);
          align-items: center;
          min-width: 0;
          flex: 1;
          gap: 5px;
          height: 34px;
          padding: 0 7px;
          border: 1px solid var(--border);
          border-radius: 9px;
          background: var(--surface-2);
          color: var(--muted);
          cursor: pointer;
        }

        .event-selector-button span {
          display: grid;
          place-items: center;
          width: 20px;
          height: 20px;
          border-radius: 7px;
          background: var(--surface-3);
          font-size: 9px;
          font-weight: 900;
        }

        .event-selector-button strong {
          overflow: hidden;
          color: inherit;
          font-size: 9px;
          text-align: left;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .event-selector-button.active {
          border-color: var(--accent);
          background:
            linear-gradient(
              145deg,
              var(--violet-soft),
              var(--blue-soft)
            ),
            var(--surface-2);
          color: var(--text);
        }

        .detail-tabs {
          display: flex;
          gap: 5px;
          margin: 6px 0 8px;
          overflow: hidden;
          flex: 0 0 auto;
        }

        .detail-tab {
          min-width: 0;
          flex: 1;
          height: 34px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface-2);
          color: var(--muted);
          cursor: pointer;
          font-size: 9px;
          font-weight: 900;
          white-space: nowrap;
          transition:
            border-color 150ms ease,
            color 150ms ease,
            transform 150ms ease,
            box-shadow 150ms ease;
        }

        .detail-tab:hover {
          transform: translateY(-1px);
          border-color: var(--accent-2);
          color: var(--text);
        }

        .detail-tab.active {
          border-color: var(--accent);
          background:
            linear-gradient(
              145deg,
              var(--violet-soft),
              var(--blue-soft)
            ),
            var(--surface-2);
          color: var(--text);
          box-shadow:
            0 0 18px rgba(155, 109, 255, 0.14);
        }

        .detail-content {
          min-height: 0;
          overflow: hidden;
          flex: 1 1 auto;
        }

        .detail-section {
          min-height: 0;
          overflow: hidden;
        }

        .detail-grid {
          display: grid;
          gap: 8px;
        }

        .detail-row {
          display: grid;
          grid-template-columns: 64px minmax(0, 1fr);
          align-items: start;
          gap: 8px;
          padding: 7px 0;
          border-bottom: 1px solid var(--border);
          font-size: 9px;
        }

        .detail-row span {
          color: var(--muted);
        }

        .detail-row strong {
          max-width: none;
          text-align: left;
          color: var(--text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .detail-row strong::before {
          content: "";
          margin: 0;
        }

        .detail-empty {
          padding: 14px;
          border: 1px dashed var(--border);
          border-radius: 12px;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.5;
        }

        .checklist {
          display: grid;
          gap: 8px;
        }

        .check-item {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface-2);
          font-size: 10px;
        }

        .check-item input {
          width: 15px;
          height: 15px;
        }

        .mail-detail {
          display: grid;
          gap: 6px;
          min-height: 0;
          overflow: hidden;
        }

        .mail-summary {
          padding: 9px;
          border: 1px solid rgba(79, 140, 255, 0.22);
          border-radius: 10px;
          background:
            linear-gradient(
              145deg,
              var(--blue-soft),
              transparent
            ),
            var(--surface-2);
        }

        .mail-summary span {
          color: var(--accent-2);
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .mail-summary p {
          display: -webkit-box;
          margin: 5px 0 0;
          overflow: hidden;
          color: var(--muted);
          font-size: 9px;
          line-height: 1.35;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }

        .mail-body {
          display: -webkit-box;
          max-height: none;
          overflow: hidden;
          padding: 9px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.018),
              transparent
            ),
            var(--surface-2);
          color: var(--muted);
          font-size: 9px;
          line-height: 1.35;
          white-space: normal;
          word-break: break-word;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 6;
        }

        .attachment-upload-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 10px;
        }

        .attachment-upload {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          margin-bottom: 0;
          padding: 0 12px;
          border: 1px solid var(--accent);
          border-radius: 10px;
          background:
            linear-gradient(
              145deg,
              var(--violet-soft),
              var(--blue-soft)
            );
          color: var(--text);
          cursor: pointer;
          font-size: 10px;
          font-weight: 900;
        }

        .attachment-upload input {
          display: none;
        }

        .camera-upload {
          border-color: rgba(34, 211, 167, 0.34);
          background:
            linear-gradient(
              145deg,
              rgba(34, 211, 167, 0.13),
              transparent
            ),
            var(--surface-2);
        }

        .convert-upload {
          border-color: rgba(242, 184, 75, 0.34);
          background:
            linear-gradient(
              145deg,
              rgba(242, 184, 75, 0.13),
              transparent
            ),
            var(--surface-2);
        }

        .multi-convert-upload {
          border-color: rgba(155, 109, 255, 0.34);
          background:
            linear-gradient(
              145deg,
              rgba(155, 109, 255, 0.14),
              transparent
            ),
            var(--surface-2);
        }

        .convert-upload {
          background:
            linear-gradient(
              145deg,
              rgba(242, 184, 75, 0.13),
              transparent
            ),
            var(--surface-2);
        }

        .camera-upload {
          background:
            linear-gradient(
              145deg,
              rgba(34, 211, 167, 0.13),
              transparent
            ),
            var(--surface-2);
        }

        @media (min-width: 761px) {
          .camera-upload {
            display: none;
          }
        }
        .pdf-preview {
          min-height: 0;
          height: 100%;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          gap: 8px;
        }

        .pdf-preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .pdf-preview-header strong {
          min-width: 0;
          overflow: hidden;
          color: var(--text);
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pdf-preview-frame {
          width: 100%;
          height: 100%;
          min-height: 470px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: white;
        }

        .attachment-list {
          display: grid;
          gap: 8px;
        }

        .attachment-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: 11px;
          background: var(--surface-2);
        }

        .attachment-item > div {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .attachment-item strong {
          overflow: hidden;
          color: var(--text);
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .attachment-item span {
          color: var(--muted);
          font-size: 9px;
        }

        .alarm-list {
          display: grid;
          gap: 8px;
        }

        .alarm-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: 11px;
          background: var(--surface-2);
        }

        .alarm-item > div {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .alarm-item strong {
          color: var(--text);
          font-size: 10px;
          line-height: 1.4;
        }

        .alarm-item span {
          color: var(--muted);
          font-size: 9px;
        }

        .alarm-status {
          flex: 0 0 auto;
          padding: 4px 7px;
          border-radius: 999px;
          background: var(--blue-soft);
          color: var(--accent-2) !important;
          font-weight: 900;
          text-transform: uppercase;
        }

        .save-status {
          margin-top: 8px;
          color: var(--accent-2);
          font-size: 9px;
          font-weight: 800;
        }

        .save-error {
          margin-top: 8px;
          color: var(--danger);
          font-size: 9px;
          font-weight: 800;
        }

        .check-item input:disabled {
          cursor: wait;
          opacity: 0.6;
        }

        .notes-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
        }

        .notes-actions .small-button:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        .notes-area:read-only {
          cursor: default;
          opacity: 0.92;
        }

        .danger-button {
          border-color: rgba(255, 93, 115, 0.30);
          background: var(--danger-soft);
          color: var(--danger);
        }

        .notes-area {
          width: 100%;
          height: 150px;
          resize: none;
          border: 1px solid var(--border);
          border-radius: 11px;
          background: var(--surface-2);
          color: var(--text);
          padding: 11px;
          outline: none;
          font: inherit;
          font-size: 11px;
          line-height: 1.5;
        }

        .event-card {
          padding: 13px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface-2);
        }

        .event-type {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          padding: 5px 8px;
          border: 1px solid rgba(79, 140, 255, 0.24);
          border-radius: 999px;
          background: var(--blue-soft);
          color: var(--accent-2);
          font-size: 9px;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .event-title {
          margin: 7px 0 0;
          font-size: 14px;
          font-weight: 900;
          line-height: 1.4;
          letter-spacing: -0.02em;
        }

        .event-description {
          margin: 7px 0 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.55;
        }

        .event-meta {
          display: grid;
          gap: 8px;
          margin-top: 13px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }

        .event-meta div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 10px;
        }

        .event-meta span {
          color: var(--muted);
        }

        .event-meta strong {
          max-width: 65%;
          text-align: right;
          color: var(--text);
          font-weight: 800;
        }

        .event-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
        }

        .small-button {
          min-height: 32px;
          border: 1px solid var(--border);
          border-radius: 9px;
          background: var(--surface-3);
          color: var(--text);
          padding: 0 10px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .empty-state,
        .error-state {
          padding: 18px;
          border: 1px dashed var(--border);
          border-radius: 14px;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
        }

        .error-state {
          color: #d67676;
        }

        .loading {
          color: var(--muted);
          font-size: 12px;
        }

        @media (max-width: 1050px) {
          .main-grid {
            grid-template-columns:
              minmax(0, 1.65fr)
              minmax(300px, 1fr);
          }
        }

        @media (max-width: 760px) {
          .lawyer-calendar {
            padding: 0;
          }

          .workspace {
            min-height: 100vh;
            height: auto;
            border: 0;
            border-radius: 0;
            overflow: visible;
          }

          .topbar {
            min-height: 56px;
            padding: 10px 12px;
          }

          .brand-kicker {
            font-size: 9px;
          }

          .brand-title {
            font-size: 15px;
          }

          .brand-subtitle {
            display: none;
          }

          .top-actions {
            gap: 6px;
          }

          .top-actions button {
            height: 34px;
            padding: 0 10px;
            font-size: 10px;
          }

          .main-grid {
            display: block;
            overflow: visible;
          }

          .summary-panel {
            display: none;
          }

          .calendar-panel,
          .detail-panel {
            width: 100%;
            min-height: 0;
            overflow: visible;
            border-right: 0;
          }

          .calendar-panel {
            padding: 10px;
          }

          .detail-panel {
            padding: 12px 10px 88px;
            border-top: 1px solid var(--border);
          }

          .calendar-toolbar {
            margin-bottom: 8px;
          }

          .calendar-navigation {
            width: 100%;
            justify-content: space-between;
          }

          .month-title {
            min-width: auto;
            font-size: 15px;
          }

          .calendar-grid {
            gap: 5px;
          }

          .weekday {
            font-size: 9px;
          }

          .day-cell {
            min-height: 46px;
            aspect-ratio: 1 / 1;
            padding: 4px;
            border-radius: 9px;
          }

          .day-number {
            width: 22px;
            height: 22px;
            font-size: 10px;
          }

          .event-dots {
            gap: 2px;
            margin-top: 3px;
          }

          .event-chip {
            width: 6px;
            height: 6px;
            min-width: 6px;
            padding: 0;
            border-radius: 50%;
            color: transparent;
          }

          .section-eyebrow {
            font-size: 9px;
          }

          .detail-date {
            margin-bottom: 8px;
            font-size: 15px;
          }

          .detail-tabs {
            display: flex;
            gap: 5px;
            margin: 6px 0 8px;
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: none;
          }

          .detail-tabs::-webkit-scrollbar {
            display: none;
          }

          .detail-tab {
            flex: 0 0 auto;
            min-width: 62px;
            height: 32px;
            padding: 0 10px;
            font-size: 9px;
          }

          .detail-section {
            overflow: visible;
          }

          .pdf-preview {
            height: auto;
            min-height: 0;
          }

          .pdf-preview-frame {
            min-height: 420px;
          }

          .legal-dock-zone {
            height: 70px;
          }

          .legal-dock {
            width: calc(100vw - 18px);
            max-width: 420px;
            justify-content: space-around;
            gap: 2px;
            margin-bottom: 6px;
            padding: 6px 8px;
            opacity: 1;
            transform: none;
            pointer-events: auto;
            border-radius: 18px;
          }

          .legal-dock a {
            width: 48px;
            height: 46px;
            flex: 0 0 48px;
            border-radius: 13px;
          }

          .legal-dock a:hover {
            width: 48px;
            min-width: 48px;
            transform: none;
            padding: 0;
          }

          .legal-dock .dock-label {
            display: none !important;
          }

          .legal-dock .dock-icon {
            font-size: 18px;
          }

          .detail-panel {
            background: var(--surface-1);
          }

          .detail-empty {
            min-height: 72px;
            padding: 14px;
            font-size: 10px;
            line-height: 1.55;
          }

          .event-selector {
            max-height: none;
            overflow: visible;
          }

          .event-selector-list {
            max-height: 160px;
            overflow-y: auto;
          }

          .detail-row {
            grid-template-columns: 78px minmax(0, 1fr);
            gap: 8px;
            padding: 9px 0;
          }

          .detail-row-label {
            font-size: 9px;
          }

          .detail-row-value {
            min-width: 0;
            overflow-wrap: anywhere;
            font-size: 10px;
          }

          .attachment-upload-row {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 6px;
          }

          .attachment-upload {
            width: 100%;
            justify-content: center;
            min-height: 38px;
            padding: 0 8px;
            font-size: 9px;
          }

          .attachment-item {
            align-items: flex-start;
            flex-direction: column;
          }

          .attachment-item > div:last-child {
            width: 100%;
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
          }

          .attachment-item .small-button {
            flex: 1 1 auto;
          }
        }

          .event-chip {
            width: 7px;
            height: 7px;
            padding: 0;
            border-radius: 50%;
            color: transparent;
          }

          .event-dots {
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
            margin-top: 5px;
          }

          .weekday {
            font-size: 9px;
          }
        }
        /* =================================================
           AL METHER CALENDAR GOLD OVERRIDE
           ================================================= */

        .lawyer-calendar {
          --bg:
            var(--legal-bg);

          --surface:
            var(--legal-surface);

          --surface-2:
            var(--legal-surface-2);

          --surface-3:
            var(--legal-surface-3);

          --border:
            var(--legal-border);

          --text:
            var(--legal-text);

          --muted:
            var(--legal-muted);

          --accent:
            var(--legal-gold);

          --accent-2:
            var(--legal-gold);

          --warning:
            var(--legal-warning);

          --success:
            var(--legal-success);

          --danger:
            var(--legal-danger);

          --cyan:
            var(--legal-gold-light);

          --violet-soft:
            var(--legal-gold-soft);

          --blue-soft:
            var(--legal-gold-soft);

          --cyan-soft:
            var(--legal-gold-soft);

          --danger-soft:
            color-mix(
              in srgb,
              var(--legal-danger) 12%,
              transparent
            );

          --shadow:
            rgba(0, 0, 0, 0.22);

          background:
            var(--legal-bg);

          color:
            var(--legal-text);
        }

        .lawyer-calendar {
          height: 100dvh;
          min-height: 100dvh;

          overflow: hidden;

          padding:
            10px 12px 72px;
        }

        .workspace {
          width:
            min(
              1560px,
              100%
            );

          height:
            calc(
              100dvh -
              82px
            );

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

        .topbar {
          min-height: 48px;

          padding:
            8px 12px;

          gap: 10px;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .brand-kicker {
          color:
            var(--legal-gold);

          font-size: 7px;
          letter-spacing:
            0.16em;
        }

        .brand-title {
          color:
            var(--legal-text);

          font-size: 12px;
          letter-spacing:
            0.07em;

          text-shadow: none;
        }

        .brand-subtitle {
          display: none;
        }

        .top-actions {
          gap: 5px;
        }

        .action-button {
          height: 30px;

          padding:
            0 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 9px;
          font-weight: 800;
        }

        .action-button:hover {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);
        }

        .main-grid {
          grid-template-columns:
            minmax(560px, 2.5fr)
            minmax(300px, 1fr);
        }

        .calendar-panel {
          padding:
            10px 12px;

          border-right:
            1px solid
            var(--legal-border);

          background:
            var(--legal-surface);
        }

        .detail-panel {
          padding:
            10px 12px;

          background:
            var(--legal-surface);
        }

        .section-eyebrow {
          margin-bottom: 3px;

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .section-title {
          font-size: 14px;
        }

        .calendar-toolbar {
          margin-bottom: 8px;
          gap: 8px;
        }

        .calendar-navigation {
          gap: 5px;
        }

        .month-title {
          min-width: 145px;

          color:
            var(--legal-text);

          font-size: 14px;
        }

        .icon-button {
          width: 30px;
          height: 30px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 14px;
        }

        .icon-button:hover {
          border-color:
            var(--legal-gold);

          color:
            var(--legal-gold);
        }

        .weekdays {
          margin-bottom: 4px;
        }

        .weekday {
          padding: 5px 3px;

          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .month-grid {
          gap: 4px;
        }

        .day-cell {
          padding: 7px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            10px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text);

          transition:
            border-color
              var(--legal-transition),
            background
              var(--legal-transition);
        }

        .day-cell::after {
          display: none;
        }

        .day-cell:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow: none;
        }

        .day-cell.selected {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow:
            inset 0 0 0 1px
            var(--legal-gold);
        }

        .day-cell.today {
          background:
            var(--legal-surface-3);
        }

        .day-number {
          width: 24px;
          height: 24px;

          border-radius: 7px;

          font-size: 9px;
        }

        .today .day-number {
          background:
            var(--legal-gold);

          color:
            #111111;
        }

        .event-dots {
          gap: 3px;
          margin-top: 5px;
        }

        .event-count-chip {
          padding:
            3px 5px;

          border:
            1px solid
            var(--legal-gold);

          border-radius: 6px;

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-chip {
          padding:
            3px 5px;

          border-radius: 6px;

          font-size: 7px;
        }

        .event-chip.service {
          color:
            var(--legal-success);
        }

        .event-chip.deadline {
          color:
            var(--legal-danger);
        }

        .event-chip.hearing {
          color:
            var(--legal-warning);
        }

        .event-chip.notice {
          color:
            var(--legal-gold-light);

          background:
            var(--legal-gold-soft);
        }

        .detail-date {
          margin:
            0 0 7px;

          padding-left: 9px;

          border-left:
            2px solid
            var(--legal-gold);

          color:
            var(--legal-text);

          font-size: 13px;
        }

        .detail-list {
          gap: 6px;
        }

        .event-selector {
          gap: 4px;
          margin-bottom: 5px;
        }

        .event-selector-title {
          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-selector-list {
          gap: 4px;
        }

        .event-selector-button {
          height: 29px;

          grid-template-columns:
            17px
            minmax(0, 1fr);

          gap: 4px;

          padding:
            0 5px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);
        }

        .event-selector-button span {
          width: 17px;
          height: 17px;

          border-radius: 5px;

          background:
            var(--legal-surface-3);

          font-size: 7px;
        }

        .event-selector-button strong {
          font-size: 7.5px;
        }

        .event-selector-button.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-text);
        }

        .detail-tabs {
          gap: 3px;

          margin:
            4px 0 6px;
        }

        .detail-tab {
          height: 29px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);

          font-size: 7.5px;
        }

        .detail-tab:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          color:
            var(--legal-text);
        }

        .detail-tab.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold-light);

          box-shadow: none;
        }

        .detail-row {
          grid-template-columns:
            58px
            minmax(0, 1fr);

          gap: 6px;

          padding:
            5px 0;

          border-bottom:
            1px solid
            var(--legal-border);

          font-size: 8px;
        }

        .detail-row span {
          color:
            var(--legal-muted);
        }

        .detail-row strong {
          color:
            var(--legal-text);
        }

        .detail-empty {
          border-color:
            var(--legal-border);

          color:
            var(--legal-muted);
        }

        @media (
          max-width: 900px
        ) {
          .lawyer-calendar {
            height: auto;
            min-height: 100dvh;

            overflow: visible;

            padding:
              7px 7px 74px;
          }

          .workspace {
            width: 100%;
            height: auto;

            min-height:
              calc(
                100dvh -
                81px
              );

            overflow: visible;

            border-radius: 13px;
          }

          .topbar {
            min-height: 44px;
            padding: 7px 8px;
          }

          .brand-title {
            font-size: 10px;
          }

          .main-grid {
            display: block;
          }

          .calendar-panel {
            padding: 8px;

            border-right: 0;
          }

          .detail-panel {
            padding: 8px;

            border-top:
              1px solid
              var(--legal-border);
          }

          .calendar-toolbar {
            margin-bottom: 6px;
          }

          .month-title {
            min-width: 120px;
            font-size: 12px;
          }

          .month-grid {
            gap: 3px;
          }

          .day-cell {
            min-height: 62px;

            padding: 5px;

            border-radius: 8px;
          }

          .day-number {
            width: 21px;
            height: 21px;

            font-size: 8px;
          }

          .event-chip {
            padding:
              2px 4px;

            font-size: 6.5px;
          }

          .detail-tabs {
            overflow-x: auto;
          }

          .detail-tab {
            flex:
              0 0 auto;

            min-width: 64px;
          }
        }

        @media (
          max-width: 520px
        ) {
          .action-button {
            padding:
              0 7px;

            font-size: 8px;
          }

          .weekday {
            font-size: 7px;
          }

          .day-cell {
            min-height: 54px;
            padding: 4px;
          }

          .event-chip {
            display: none;
          }

          .event-count-chip {
            display: block;
          }
        }

        /* =================================================
           AL METHER CALENDAR GOLD OVERRIDE
           ================================================= */

        .lawyer-calendar {
          --bg:
            var(--legal-bg);

          --surface:
            var(--legal-surface);

          --surface-2:
            var(--legal-surface-2);

          --surface-3:
            var(--legal-surface-3);

          --border:
            var(--legal-border);

          --text:
            var(--legal-text);

          --muted:
            var(--legal-muted);

          --accent:
            var(--legal-gold);

          --accent-2:
            var(--legal-gold);

          --warning:
            var(--legal-warning);

          --success:
            var(--legal-success);

          --danger:
            var(--legal-danger);

          --cyan:
            var(--legal-gold-light);

          --violet-soft:
            var(--legal-gold-soft);

          --blue-soft:
            var(--legal-gold-soft);

          --cyan-soft:
            var(--legal-gold-soft);

          --danger-soft:
            color-mix(
              in srgb,
              var(--legal-danger) 12%,
              transparent
            );

          --shadow:
            rgba(0, 0, 0, 0.22);

          background:
            var(--legal-bg);

          color:
            var(--legal-text);
        }

        .lawyer-calendar {
          height: 100dvh;
          min-height: 100dvh;

          overflow: hidden;

          padding:
            10px 12px 72px;
        }

        .workspace {
          width:
            min(
              1560px,
              100%
            );

          height:
            calc(
              100dvh -
              82px
            );

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

        .topbar {
          min-height: 48px;

          padding:
            8px 12px;

          gap: 10px;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .brand-kicker {
          color:
            var(--legal-gold);

          font-size: 7px;
          letter-spacing:
            0.16em;
        }

        .brand-title {
          color:
            var(--legal-text);

          font-size: 12px;
          letter-spacing:
            0.07em;

          text-shadow: none;
        }

        .brand-subtitle {
          display: none;
        }

        .top-actions {
          gap: 5px;
        }

        .action-button {
          height: 30px;

          padding:
            0 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 9px;
          font-weight: 800;
        }

        .action-button:hover {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);
        }

        .main-grid {
          grid-template-columns:
            minmax(560px, 2.5fr)
            minmax(300px, 1fr);
        }

        .calendar-panel {
          padding:
            10px 12px;

          border-right:
            1px solid
            var(--legal-border);

          background:
            var(--legal-surface);
        }

        .detail-panel {
          padding:
            10px 12px;

          background:
            var(--legal-surface);
        }

        .section-eyebrow {
          margin-bottom: 3px;

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .section-title {
          font-size: 14px;
        }

        .calendar-toolbar {
          margin-bottom: 8px;
          gap: 8px;
        }

        .calendar-navigation {
          gap: 5px;
        }

        .month-title {
          min-width: 145px;

          color:
            var(--legal-text);

          font-size: 14px;
        }

        .icon-button {
          width: 30px;
          height: 30px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 14px;
        }

        .icon-button:hover {
          border-color:
            var(--legal-gold);

          color:
            var(--legal-gold);
        }

        .weekdays {
          margin-bottom: 4px;
        }

        .weekday {
          padding: 5px 3px;

          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .month-grid {
          gap: 4px;
        }

        .day-cell {
          padding: 7px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            10px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text);

          transition:
            border-color
              var(--legal-transition),
            background
              var(--legal-transition);
        }

        .day-cell::after {
          display: none;
        }

        .day-cell:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow: none;
        }

        .day-cell.selected {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow:
            inset 0 0 0 1px
            var(--legal-gold);
        }

        .day-cell.today {
          background:
            var(--legal-surface-3);
        }

        .day-number {
          width: 24px;
          height: 24px;

          border-radius: 7px;

          font-size: 9px;
        }

        .today .day-number {
          background:
            var(--legal-gold);

          color:
            #111111;
        }

        .event-dots {
          gap: 3px;
          margin-top: 5px;
        }

        .event-count-chip {
          padding:
            3px 5px;

          border:
            1px solid
            var(--legal-gold);

          border-radius: 6px;

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-chip {
          padding:
            3px 5px;

          border-radius: 6px;

          font-size: 7px;
        }

        .event-chip.service {
          color:
            var(--legal-success);
        }

        .event-chip.deadline {
          color:
            var(--legal-danger);
        }

        .event-chip.hearing {
          color:
            var(--legal-warning);
        }

        .event-chip.notice {
          color:
            var(--legal-gold-light);

          background:
            var(--legal-gold-soft);
        }

        .detail-date {
          margin:
            0 0 7px;

          padding-left: 9px;

          border-left:
            2px solid
            var(--legal-gold);

          color:
            var(--legal-text);

          font-size: 13px;
        }

        .detail-list {
          gap: 6px;
        }

        .event-selector {
          gap: 4px;
          margin-bottom: 5px;
        }

        .event-selector-title {
          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-selector-list {
          gap: 4px;
        }

        .event-selector-button {
          height: 29px;

          grid-template-columns:
            17px
            minmax(0, 1fr);

          gap: 4px;

          padding:
            0 5px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);
        }

        .event-selector-button span {
          width: 17px;
          height: 17px;

          border-radius: 5px;

          background:
            var(--legal-surface-3);

          font-size: 7px;
        }

        .event-selector-button strong {
          font-size: 7.5px;
        }

        .event-selector-button.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-text);
        }

        .detail-tabs {
          gap: 3px;

          margin:
            4px 0 6px;
        }

        .detail-tab {
          height: 29px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);

          font-size: 7.5px;
        }

        .detail-tab:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          color:
            var(--legal-text);
        }

        .detail-tab.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold-light);

          box-shadow: none;
        }

        .detail-row {
          grid-template-columns:
            58px
            minmax(0, 1fr);

          gap: 6px;

          padding:
            5px 0;

          border-bottom:
            1px solid
            var(--legal-border);

          font-size: 8px;
        }

        .detail-row span {
          color:
            var(--legal-muted);
        }

        .detail-row strong {
          color:
            var(--legal-text);
        }

        .detail-empty {
          border-color:
            var(--legal-border);

          color:
            var(--legal-muted);
        }

        @media (
          max-width: 900px
        ) {
          .lawyer-calendar {
            height: auto;
            min-height: 100dvh;

            overflow: visible;

            padding:
              7px 7px 74px;
          }

          .workspace {
            width: 100%;
            height: auto;

            min-height:
              calc(
                100dvh -
                81px
              );

            overflow: visible;

            border-radius: 13px;
          }

          .topbar {
            min-height: 44px;
            padding: 7px 8px;
          }

          .brand-title {
            font-size: 10px;
          }

          .main-grid {
            display: block;
          }

          .calendar-panel {
            padding: 8px;

            border-right: 0;
          }

          .detail-panel {
            padding: 8px;

            border-top:
              1px solid
              var(--legal-border);
          }

          .calendar-toolbar {
            margin-bottom: 6px;
          }

          .month-title {
            min-width: 120px;
            font-size: 12px;
          }

          .month-grid {
            gap: 3px;
          }

          .day-cell {
            min-height: 62px;

            padding: 5px;

            border-radius: 8px;
          }

          .day-number {
            width: 21px;
            height: 21px;

            font-size: 8px;
          }

          .event-chip {
            padding:
              2px 4px;

            font-size: 6.5px;
          }

          .detail-tabs {
            overflow-x: auto;
          }

          .detail-tab {
            flex:
              0 0 auto;

            min-width: 64px;
          }
        }

        @media (
          max-width: 520px
        ) {
          .action-button {
            padding:
              0 7px;

            font-size: 8px;
          }

          .weekday {
            font-size: 7px;
          }

          .day-cell {
            min-height: 54px;
            padding: 4px;
          }

          .event-chip {
            display: none;
          }

          .event-count-chip {
            display: block;
          }
        }


        /* =================================================
           AL METHER CALENDAR GOLD OVERRIDE
           ================================================= */

        .lawyer-calendar {
          --bg:
            var(--legal-bg);

          --surface:
            var(--legal-surface);

          --surface-2:
            var(--legal-surface-2);

          --surface-3:
            var(--legal-surface-3);

          --border:
            var(--legal-border);

          --text:
            var(--legal-text);

          --muted:
            var(--legal-muted);

          --accent:
            var(--legal-gold);

          --accent-2:
            var(--legal-gold);

          --warning:
            var(--legal-warning);

          --success:
            var(--legal-success);

          --danger:
            var(--legal-danger);

          --cyan:
            var(--legal-gold-light);

          --violet-soft:
            var(--legal-gold-soft);

          --blue-soft:
            var(--legal-gold-soft);

          --cyan-soft:
            var(--legal-gold-soft);

          --danger-soft:
            color-mix(
              in srgb,
              var(--legal-danger) 12%,
              transparent
            );

          --shadow:
            rgba(0, 0, 0, 0.22);

          background:
            var(--legal-bg);

          color:
            var(--legal-text);
        }

        .lawyer-calendar {
          height: 100dvh;
          min-height: 100dvh;

          overflow: hidden;

          padding:
            10px 12px 72px;
        }

        .workspace {
          width:
            min(
              1560px,
              100%
            );

          height:
            calc(
              100dvh -
              82px
            );

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

        .topbar {
          min-height: 48px;

          padding:
            8px 12px;

          gap: 10px;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .brand-kicker {
          color:
            var(--legal-gold);

          font-size: 7px;
          letter-spacing:
            0.16em;
        }

        .brand-title {
          color:
            var(--legal-text);

          font-size: 12px;
          letter-spacing:
            0.07em;

          text-shadow: none;
        }

        .brand-subtitle {
          display: none;
        }

        .top-actions {
          gap: 5px;
        }

        .action-button {
          height: 30px;

          padding:
            0 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 9px;
          font-weight: 800;
        }

        .action-button:hover {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);
        }

        .main-grid {
          grid-template-columns:
            minmax(560px, 2.5fr)
            minmax(300px, 1fr);
        }

        .calendar-panel {
          padding:
            10px 12px;

          border-right:
            1px solid
            var(--legal-border);

          background:
            var(--legal-surface);
        }

        .detail-panel {
          padding:
            10px 12px;

          background:
            var(--legal-surface);
        }

        .section-eyebrow {
          margin-bottom: 3px;

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .section-title {
          font-size: 14px;
        }

        .calendar-toolbar {
          margin-bottom: 8px;
          gap: 8px;
        }

        .calendar-navigation {
          gap: 5px;
        }

        .month-title {
          min-width: 145px;

          color:
            var(--legal-text);

          font-size: 14px;
        }

        .icon-button {
          width: 30px;
          height: 30px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 14px;
        }

        .icon-button:hover {
          border-color:
            var(--legal-gold);

          color:
            var(--legal-gold);
        }

        .weekdays {
          margin-bottom: 4px;
        }

        .weekday {
          padding: 5px 3px;

          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .month-grid {
          gap: 4px;
        }

        .day-cell {
          padding: 7px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            10px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text);

          transition:
            border-color
              var(--legal-transition),
            background
              var(--legal-transition);
        }

        .day-cell::after {
          display: none;
        }

        .day-cell:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow: none;
        }

        .day-cell.selected {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow:
            inset 0 0 0 1px
            var(--legal-gold);
        }

        .day-cell.today {
          background:
            var(--legal-surface-3);
        }

        .day-number {
          width: 24px;
          height: 24px;

          border-radius: 7px;

          font-size: 9px;
        }

        .today .day-number {
          background:
            var(--legal-gold);

          color:
            #111111;
        }

        .event-dots {
          gap: 3px;
          margin-top: 5px;
        }

        .event-count-chip {
          padding:
            3px 5px;

          border:
            1px solid
            var(--legal-gold);

          border-radius: 6px;

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-chip {
          padding:
            3px 5px;

          border-radius: 6px;

          font-size: 7px;
        }

        .event-chip.service {
          color:
            var(--legal-success);
        }

        .event-chip.deadline {
          color:
            var(--legal-danger);
        }

        .event-chip.hearing {
          color:
            var(--legal-warning);
        }

        .event-chip.notice {
          color:
            var(--legal-gold-light);

          background:
            var(--legal-gold-soft);
        }

        .detail-date {
          margin:
            0 0 7px;

          padding-left: 9px;

          border-left:
            2px solid
            var(--legal-gold);

          color:
            var(--legal-text);

          font-size: 13px;
        }

        .detail-list {
          gap: 6px;
        }

        .event-selector {
          gap: 4px;
          margin-bottom: 5px;
        }

        .event-selector-title {
          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-selector-list {
          gap: 4px;
        }

        .event-selector-button {
          height: 29px;

          grid-template-columns:
            17px
            minmax(0, 1fr);

          gap: 4px;

          padding:
            0 5px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);
        }

        .event-selector-button span {
          width: 17px;
          height: 17px;

          border-radius: 5px;

          background:
            var(--legal-surface-3);

          font-size: 7px;
        }

        .event-selector-button strong {
          font-size: 7.5px;
        }

        .event-selector-button.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-text);
        }

        .detail-tabs {
          gap: 3px;

          margin:
            4px 0 6px;
        }

        .detail-tab {
          height: 29px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);

          font-size: 7.5px;
        }

        .detail-tab:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          color:
            var(--legal-text);
        }

        .detail-tab.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold-light);

          box-shadow: none;
        }

        .detail-row {
          grid-template-columns:
            58px
            minmax(0, 1fr);

          gap: 6px;

          padding:
            5px 0;

          border-bottom:
            1px solid
            var(--legal-border);

          font-size: 8px;
        }

        .detail-row span {
          color:
            var(--legal-muted);
        }

        .detail-row strong {
          color:
            var(--legal-text);
        }

        .detail-empty {
          border-color:
            var(--legal-border);

          color:
            var(--legal-muted);
        }

        @media (
          max-width: 900px
        ) {
          .lawyer-calendar {
            height: auto;
            min-height: 100dvh;

            overflow: visible;

            padding:
              7px 7px 74px;
          }

          .workspace {
            width: 100%;
            height: auto;

            min-height:
              calc(
                100dvh -
                81px
              );

            overflow: visible;

            border-radius: 13px;
          }

          .topbar {
            min-height: 44px;
            padding: 7px 8px;
          }

          .brand-title {
            font-size: 10px;
          }

          .main-grid {
            display: block;
          }

          .calendar-panel {
            padding: 8px;

            border-right: 0;
          }

          .detail-panel {
            padding: 8px;

            border-top:
              1px solid
              var(--legal-border);
          }

          .calendar-toolbar {
            margin-bottom: 6px;
          }

          .month-title {
            min-width: 120px;
            font-size: 12px;
          }

          .month-grid {
            gap: 3px;
          }

          .day-cell {
            min-height: 62px;

            padding: 5px;

            border-radius: 8px;
          }

          .day-number {
            width: 21px;
            height: 21px;

            font-size: 8px;
          }

          .event-chip {
            padding:
              2px 4px;

            font-size: 6.5px;
          }

          .detail-tabs {
            overflow-x: auto;
          }

          .detail-tab {
            flex:
              0 0 auto;

            min-width: 64px;
          }
        }

        @media (
          max-width: 520px
        ) {
          .action-button {
            padding:
              0 7px;

            font-size: 8px;
          }

          .weekday {
            font-size: 7px;
          }

          .day-cell {
            min-height: 54px;
            padding: 4px;
          }

          .event-chip {
            display: none;
          }

          .event-count-chip {
            display: block;
          }
        }
 
        /* =================================================
           AL METHER CALENDAR GOLD OVERRIDE
           ================================================= */

        .lawyer-calendar {
          --bg:
            var(--legal-bg);

          --surface:
            var(--legal-surface);

          --surface-2:
            var(--legal-surface-2);

          --surface-3:
            var(--legal-surface-3);

          --border:
            var(--legal-border);

          --text:
            var(--legal-text);

          --muted:
            var(--legal-muted);

          --accent:
            var(--legal-gold);

          --accent-2:
            var(--legal-gold);

          --warning:
            var(--legal-warning);

          --success:
            var(--legal-success);

          --danger:
            var(--legal-danger);

          --cyan:
            var(--legal-gold-light);

          --violet-soft:
            var(--legal-gold-soft);

          --blue-soft:
            var(--legal-gold-soft);

          --cyan-soft:
            var(--legal-gold-soft);

          --danger-soft:
            color-mix(
              in srgb,
              var(--legal-danger) 12%,
              transparent
            );

          --shadow:
            rgba(0, 0, 0, 0.22);

          background:
            var(--legal-bg);

          color:
            var(--legal-text);
        }

        .lawyer-calendar {
          height: 100dvh;
          min-height: 100dvh;

          overflow: hidden;

          padding:
            10px 12px 72px;
        }

        .workspace {
          width:
            min(
              1560px,
              100%
            );

          height:
            calc(
              100dvh -
              82px
            );

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

        .topbar {
          min-height: 48px;

          padding:
            8px 12px;

          gap: 10px;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .brand-kicker {
          color:
            var(--legal-gold);

          font-size: 7px;
          letter-spacing:
            0.16em;
        }

        .brand-title {
          color:
            var(--legal-text);

          font-size: 12px;
          letter-spacing:
            0.07em;

          text-shadow: none;
        }

        .brand-subtitle {
          display: none;
        }

        .top-actions {
          gap: 5px;
        }

        .action-button {
          height: 30px;

          padding:
            0 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 9px;
          font-weight: 800;
        }

        .action-button:hover {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);
        }

        .main-grid {
          grid-template-columns:
            minmax(560px, 2.5fr)
            minmax(300px, 1fr);
        }

        .calendar-panel {
          padding:
            10px 12px;

          border-right:
            1px solid
            var(--legal-border);

          background:
            var(--legal-surface);
        }

        .detail-panel {
          padding:
            10px 12px;

          background:
            var(--legal-surface);
        }

        .section-eyebrow {
          margin-bottom: 3px;

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .section-title {
          font-size: 14px;
        }

        .calendar-toolbar {
          margin-bottom: 8px;
          gap: 8px;
        }

        .calendar-navigation {
          gap: 5px;
        }

        .month-title {
          min-width: 145px;

          color:
            var(--legal-text);

          font-size: 14px;
        }

        .icon-button {
          width: 30px;
          height: 30px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 14px;
        }

        .icon-button:hover {
          border-color:
            var(--legal-gold);

          color:
            var(--legal-gold);
        }

        .weekdays {
          margin-bottom: 4px;
        }

        .weekday {
          padding: 5px 3px;

          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .month-grid {
          gap: 4px;
        }

        .day-cell {
          padding: 7px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            10px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text);

          transition:
            border-color
              var(--legal-transition),
            background
              var(--legal-transition);
        }

        .day-cell::after {
          display: none;
        }

        .day-cell:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow: none;
        }

        .day-cell.selected {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow:
            inset 0 0 0 1px
            var(--legal-gold);
        }

        .day-cell.today {
          background:
            var(--legal-surface-3);
        }

        .day-number {
          width: 24px;
          height: 24px;

          border-radius: 7px;

          font-size: 9px;
        }

        .today .day-number {
          background:
            var(--legal-gold);

          color:
            #111111;
        }

        .event-dots {
          gap: 3px;
          margin-top: 5px;
        }

        .event-count-chip {
          padding:
            3px 5px;

          border:
            1px solid
            var(--legal-gold);

          border-radius: 6px;

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-chip {
          padding:
            3px 5px;

          border-radius: 6px;

          font-size: 7px;
        }

        .event-chip.service {
          color:
            var(--legal-success);
        }

        .event-chip.deadline {
          color:
            var(--legal-danger);
        }

        .event-chip.hearing {
          color:
            var(--legal-warning);
        }

        .event-chip.notice {
          color:
            var(--legal-gold-light);

          background:
            var(--legal-gold-soft);
        }

        .detail-date {
          margin:
            0 0 7px;

          padding-left: 9px;

          border-left:
            2px solid
            var(--legal-gold);

          color:
            var(--legal-text);

          font-size: 13px;
        }

        .detail-list {
          gap: 6px;
        }

        .event-selector {
          gap: 4px;
          margin-bottom: 5px;
        }

        .event-selector-title {
          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-selector-list {
          gap: 4px;
        }

        .event-selector-button {
          height: 29px;

          grid-template-columns:
            17px
            minmax(0, 1fr);

          gap: 4px;

          padding:
            0 5px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);
        }

        .event-selector-button span {
          width: 17px;
          height: 17px;

          border-radius: 5px;

          background:
            var(--legal-surface-3);

          font-size: 7px;
        }

        .event-selector-button strong {
          font-size: 7.5px;
        }

        .event-selector-button.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-text);
        }

        .detail-tabs {
          gap: 3px;

          margin:
            4px 0 6px;
        }

        .detail-tab {
          height: 29px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);

          font-size: 7.5px;
        }

        .detail-tab:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          color:
            var(--legal-text);
        }

        .detail-tab.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold-light);

          box-shadow: none;
        }

        .detail-row {
          grid-template-columns:
            58px
            minmax(0, 1fr);

          gap: 6px;

          padding:
            5px 0;

          border-bottom:
            1px solid
            var(--legal-border);

          font-size: 8px;
        }

        .detail-row span {
          color:
            var(--legal-muted);
        }

        .detail-row strong {
          color:
            var(--legal-text);
        }

        .detail-empty {
          border-color:
            var(--legal-border);

          color:
            var(--legal-muted);
        }

        @media (
          max-width: 900px
        ) {
          .lawyer-calendar {
            height: auto;
            min-height: 100dvh;

            overflow: visible;

            padding:
              7px 7px 74px;
          }

          .workspace {
            width: 100%;
            height: auto;

            min-height:
              calc(
                100dvh -
                81px
              );

            overflow: visible;

            border-radius: 13px;
          }

          .topbar {
            min-height: 44px;
            padding: 7px 8px;
          }

          .brand-title {
            font-size: 10px;
          }

          .main-grid {
            display: block;
          }

          .calendar-panel {
            padding: 8px;

            border-right: 0;
          }

          .detail-panel {
            padding: 8px;

            border-top:
              1px solid
              var(--legal-border);
          }

          .calendar-toolbar {
            margin-bottom: 6px;
          }

          .month-title {
            min-width: 120px;
            font-size: 12px;
          }

          .month-grid {
            gap: 3px;
          }

          .day-cell {
            min-height: 62px;

            padding: 5px;

            border-radius: 8px;
          }

          .day-number {
            width: 21px;
            height: 21px;

            font-size: 8px;
          }

          .event-chip {
            padding:
              2px 4px;

            font-size: 6.5px;
          }

          .detail-tabs {
            overflow-x: auto;
          }

          .detail-tab {
            flex:
              0 0 auto;

            min-width: 64px;
          }
        }

        @media (
          max-width: 520px
        ) {
          .action-button {
            padding:
              0 7px;

            font-size: 8px;
          }

          .weekday {
            font-size: 7px;
          }

          .day-cell {
            min-height: 54px;
            padding: 4px;
          }

          .event-chip {
            display: none;
          }

          .event-count-chip {
            display: block;
          }
        }
 
        /* =================================================
           AL METHER CALENDAR GOLD OVERRIDE
           ================================================= */

        .lawyer-calendar {
          --bg:
            var(--legal-bg);

          --surface:
            var(--legal-surface);

          --surface-2:
            var(--legal-surface-2);

          --surface-3:
            var(--legal-surface-3);

          --border:
            var(--legal-border);

          --text:
            var(--legal-text);

          --muted:
            var(--legal-muted);

          --accent:
            var(--legal-gold);

          --accent-2:
            var(--legal-gold);

          --warning:
            var(--legal-warning);

          --success:
            var(--legal-success);

          --danger:
            var(--legal-danger);

          --cyan:
            var(--legal-gold-light);

          --violet-soft:
            var(--legal-gold-soft);

          --blue-soft:
            var(--legal-gold-soft);

          --cyan-soft:
            var(--legal-gold-soft);

          --danger-soft:
            color-mix(
              in srgb,
              var(--legal-danger) 12%,
              transparent
            );

          --shadow:
            rgba(0, 0, 0, 0.22);

          background:
            var(--legal-bg);

          color:
            var(--legal-text);
        }

        .lawyer-calendar {
          height: 100dvh;
          min-height: 100dvh;

          overflow: hidden;

          padding:
            10px 12px 72px;
        }

        .workspace {
          width:
            min(
              1560px,
              100%
            );

          height:
            calc(
              100dvh -
              82px
            );

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

        .topbar {
          min-height: 48px;

          padding:
            8px 12px;

          gap: 10px;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .brand-kicker {
          color:
            var(--legal-gold);

          font-size: 7px;
          letter-spacing:
            0.16em;
        }

        .brand-title {
          color:
            var(--legal-text);

          font-size: 12px;
          letter-spacing:
            0.07em;

          text-shadow: none;
        }

        .brand-subtitle {
          display: none;
        }

        .top-actions {
          gap: 5px;
        }

        .action-button {
          height: 30px;

          padding:
            0 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 9px;
          font-weight: 800;
        }

        .action-button:hover {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);
        }

        .main-grid {
          grid-template-columns:
            minmax(560px, 2.5fr)
            minmax(300px, 1fr);
        }

        .calendar-panel {
          padding:
            10px 12px;

          border-right:
            1px solid
            var(--legal-border);

          background:
            var(--legal-surface);
        }

        .detail-panel {
          padding:
            10px 12px;

          background:
            var(--legal-surface);
        }

        .section-eyebrow {
          margin-bottom: 3px;

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .section-title {
          font-size: 14px;
        }

        .calendar-toolbar {
          margin-bottom: 8px;
          gap: 8px;
        }

        .calendar-navigation {
          gap: 5px;
        }

        .month-title {
          min-width: 145px;

          color:
            var(--legal-text);

          font-size: 14px;
        }

        .icon-button {
          width: 30px;
          height: 30px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 14px;
        }

        .icon-button:hover {
          border-color:
            var(--legal-gold);

          color:
            var(--legal-gold);
        }

        .weekdays {
          margin-bottom: 4px;
        }

        .weekday {
          padding: 5px 3px;

          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .month-grid {
          gap: 4px;
        }

        .day-cell {
          padding: 7px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            10px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text);

          transition:
            border-color
              var(--legal-transition),
            background
              var(--legal-transition);
        }

        .day-cell::after {
          display: none;
        }

        .day-cell:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow: none;
        }

        .day-cell.selected {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow:
            inset 0 0 0 1px
            var(--legal-gold);
        }

        .day-cell.today {
          background:
            var(--legal-surface-3);
        }

        .day-number {
          width: 24px;
          height: 24px;

          border-radius: 7px;

          font-size: 9px;
        }

        .today .day-number {
          background:
            var(--legal-gold);

          color:
            #111111;
        }

        .event-dots {
          gap: 3px;
          margin-top: 5px;
        }

        .event-count-chip {
          padding:
            3px 5px;

          border:
            1px solid
            var(--legal-gold);

          border-radius: 6px;

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-chip {
          padding:
            3px 5px;

          border-radius: 6px;

          font-size: 7px;
        }

        .event-chip.service {
          color:
            var(--legal-success);
        }

        .event-chip.deadline {
          color:
            var(--legal-danger);
        }

        .event-chip.hearing {
          color:
            var(--legal-warning);
        }

        .event-chip.notice {
          color:
            var(--legal-gold-light);

          background:
            var(--legal-gold-soft);
        }

        .detail-date {
          margin:
            0 0 7px;

          padding-left: 9px;

          border-left:
            2px solid
            var(--legal-gold);

          color:
            var(--legal-text);

          font-size: 13px;
        }

        .detail-list {
          gap: 6px;
        }

        .event-selector {
          gap: 4px;
          margin-bottom: 5px;
        }

        .event-selector-title {
          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-selector-list {
          gap: 4px;
        }

        .event-selector-button {
          height: 29px;

          grid-template-columns:
            17px
            minmax(0, 1fr);

          gap: 4px;

          padding:
            0 5px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);
        }

        .event-selector-button span {
          width: 17px;
          height: 17px;

          border-radius: 5px;

          background:
            var(--legal-surface-3);

          font-size: 7px;
        }

        .event-selector-button strong {
          font-size: 7.5px;
        }

        .event-selector-button.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-text);
        }

        .detail-tabs {
          gap: 3px;

          margin:
            4px 0 6px;
        }

        .detail-tab {
          height: 29px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);

          font-size: 7.5px;
        }

        .detail-tab:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          color:
            var(--legal-text);
        }

        .detail-tab.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold-light);

          box-shadow: none;
        }

        .detail-row {
          grid-template-columns:
            58px
            minmax(0, 1fr);

          gap: 6px;

          padding:
            5px 0;

          border-bottom:
            1px solid
            var(--legal-border);

          font-size: 8px;
        }

        .detail-row span {
          color:
            var(--legal-muted);
        }

        .detail-row strong {
          color:
            var(--legal-text);
        }

        .detail-empty {
          border-color:
            var(--legal-border);

          color:
            var(--legal-muted);
        }

        @media (
          max-width: 900px
        ) {
          .lawyer-calendar {
            height: auto;
            min-height: 100dvh;

            overflow: visible;

            padding:
              7px 7px 74px;
          }

          .workspace {
            width: 100%;
            height: auto;

            min-height:
              calc(
                100dvh -
                81px
              );

            overflow: visible;

            border-radius: 13px;
          }

          .topbar {
            min-height: 44px;
            padding: 7px 8px;
          }

          .brand-title {
            font-size: 10px;
          }

          .main-grid {
            display: block;
          }

          .calendar-panel {
            padding: 8px;

            border-right: 0;
          }

          .detail-panel {
            padding: 8px;

            border-top:
              1px solid
              var(--legal-border);
          }

          .calendar-toolbar {
            margin-bottom: 6px;
          }

          .month-title {
            min-width: 120px;
            font-size: 12px;
          }

          .month-grid {
            gap: 3px;
          }

          .day-cell {
            min-height: 62px;

            padding: 5px;

            border-radius: 8px;
          }

          .day-number {
            width: 21px;
            height: 21px;

            font-size: 8px;
          }

          .event-chip {
            padding:
              2px 4px;

            font-size: 6.5px;
          }

          .detail-tabs {
            overflow-x: auto;
          }

          .detail-tab {
            flex:
              0 0 auto;

            min-width: 64px;
          }
        }

        @media (
          max-width: 520px
        ) {
          .action-button {
            padding:
              0 7px;

            font-size: 8px;
          }

          .weekday {
            font-size: 7px;
          }

          .day-cell {
            min-height: 54px;
            padding: 4px;
          }

          .event-chip {
            display: none;
          }

          .event-count-chip {
            display: block;
          }
        }
 
        /* =================================================
           AL METHER CALENDAR GOLD OVERRIDE
           ================================================= */

        .lawyer-calendar {
          --bg:
            var(--legal-bg);

          --surface:
            var(--legal-surface);

          --surface-2:
            var(--legal-surface-2);

          --surface-3:
            var(--legal-surface-3);

          --border:
            var(--legal-border);

          --text:
            var(--legal-text);

          --muted:
            var(--legal-muted);

          --accent:
            var(--legal-gold);

          --accent-2:
            var(--legal-gold);

          --warning:
            var(--legal-warning);

          --success:
            var(--legal-success);

          --danger:
            var(--legal-danger);

          --cyan:
            var(--legal-gold-light);

          --violet-soft:
            var(--legal-gold-soft);

          --blue-soft:
            var(--legal-gold-soft);

          --cyan-soft:
            var(--legal-gold-soft);

          --danger-soft:
            color-mix(
              in srgb,
              var(--legal-danger) 12%,
              transparent
            );

          --shadow:
            rgba(0, 0, 0, 0.22);

          background:
            var(--legal-bg);

          color:
            var(--legal-text);
        }

        .lawyer-calendar {
          height: 100dvh;
          min-height: 100dvh;

          overflow: hidden;

          padding:
            10px 12px 72px;
        }

        .workspace {
          width:
            min(
              1560px,
              100%
            );

          height:
            calc(
              100dvh -
              82px
            );

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

        .topbar {
          min-height: 48px;

          padding:
            8px 12px;

          gap: 10px;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .brand-kicker {
          color:
            var(--legal-gold);

          font-size: 7px;
          letter-spacing:
            0.16em;
        }

        .brand-title {
          color:
            var(--legal-text);

          font-size: 12px;
          letter-spacing:
            0.07em;

          text-shadow: none;
        }

        .brand-subtitle {
          display: none;
        }

        .top-actions {
          gap: 5px;
        }

        .action-button {
          height: 30px;

          padding:
            0 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 9px;
          font-weight: 800;
        }

        .action-button:hover {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);
        }

        .main-grid {
          grid-template-columns:
            minmax(560px, 2.5fr)
            minmax(300px, 1fr);
        }

        .calendar-panel {
          padding:
            10px 12px;

          border-right:
            1px solid
            var(--legal-border);

          background:
            var(--legal-surface);
        }

        .detail-panel {
          padding:
            10px 12px;

          background:
            var(--legal-surface);
        }

        .section-eyebrow {
          margin-bottom: 3px;

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .section-title {
          font-size: 14px;
        }

        .calendar-toolbar {
          margin-bottom: 8px;
          gap: 8px;
        }

        .calendar-navigation {
          gap: 5px;
        }

        .month-title {
          min-width: 145px;

          color:
            var(--legal-text);

          font-size: 14px;
        }

        .icon-button {
          width: 30px;
          height: 30px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 14px;
        }

        .icon-button:hover {
          border-color:
            var(--legal-gold);

          color:
            var(--legal-gold);
        }

        .weekdays {
          margin-bottom: 4px;
        }

        .weekday {
          padding: 5px 3px;

          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .month-grid {
          gap: 4px;
        }

        .day-cell {
          padding: 7px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            10px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text);

          transition:
            border-color
              var(--legal-transition),
            background
              var(--legal-transition);
        }

        .day-cell::after {
          display: none;
        }

        .day-cell:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow: none;
        }

        .day-cell.selected {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow:
            inset 0 0 0 1px
            var(--legal-gold);
        }

        .day-cell.today {
          background:
            var(--legal-surface-3);
        }

        .day-number {
          width: 24px;
          height: 24px;

          border-radius: 7px;

          font-size: 9px;
        }

        .today .day-number {
          background:
            var(--legal-gold);

          color:
            #111111;
        }

        .event-dots {
          gap: 3px;
          margin-top: 5px;
        }

        .event-count-chip {
          padding:
            3px 5px;

          border:
            1px solid
            var(--legal-gold);

          border-radius: 6px;

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-chip {
          padding:
            3px 5px;

          border-radius: 6px;

          font-size: 7px;
        }

        .event-chip.service {
          color:
            var(--legal-success);
        }

        .event-chip.deadline {
          color:
            var(--legal-danger);
        }

        .event-chip.hearing {
          color:
            var(--legal-warning);
        }

        .event-chip.notice {
          color:
            var(--legal-gold-light);

          background:
            var(--legal-gold-soft);
        }

        .detail-date {
          margin:
            0 0 7px;

          padding-left: 9px;

          border-left:
            2px solid
            var(--legal-gold);

          color:
            var(--legal-text);

          font-size: 13px;
        }

        .detail-list {
          gap: 6px;
        }

        .event-selector {
          gap: 4px;
          margin-bottom: 5px;
        }

        .event-selector-title {
          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-selector-list {
          gap: 4px;
        }

        .event-selector-button {
          height: 29px;

          grid-template-columns:
            17px
            minmax(0, 1fr);

          gap: 4px;

          padding:
            0 5px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);
        }

        .event-selector-button span {
          width: 17px;
          height: 17px;

          border-radius: 5px;

          background:
            var(--legal-surface-3);

          font-size: 7px;
        }

        .event-selector-button strong {
          font-size: 7.5px;
        }

        .event-selector-button.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-text);
        }

        .detail-tabs {
          gap: 3px;

          margin:
            4px 0 6px;
        }

        .detail-tab {
          height: 29px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);

          font-size: 7.5px;
        }

        .detail-tab:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          color:
            var(--legal-text);
        }

        .detail-tab.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold-light);

          box-shadow: none;
        }

        .detail-row {
          grid-template-columns:
            58px
            minmax(0, 1fr);

          gap: 6px;

          padding:
            5px 0;

          border-bottom:
            1px solid
            var(--legal-border);

          font-size: 8px;
        }

        .detail-row span {
          color:
            var(--legal-muted);
        }

        .detail-row strong {
          color:
            var(--legal-text);
        }

        .detail-empty {
          border-color:
            var(--legal-border);

          color:
            var(--legal-muted);
        }

        @media (
          max-width: 900px
        ) {
          .lawyer-calendar {
            height: auto;
            min-height: 100dvh;

            overflow: visible;

            padding:
              7px 7px 74px;
          }

          .workspace {
            width: 100%;
            height: auto;

            min-height:
              calc(
                100dvh -
                81px
              );

            overflow: visible;

            border-radius: 13px;
          }

          .topbar {
            min-height: 44px;
            padding: 7px 8px;
          }

          .brand-title {
            font-size: 10px;
          }

          .main-grid {
            display: block;
          }

          .calendar-panel {
            padding: 8px;

            border-right: 0;
          }

          .detail-panel {
            padding: 8px;

            border-top:
              1px solid
              var(--legal-border);
          }

          .calendar-toolbar {
            margin-bottom: 6px;
          }

          .month-title {
            min-width: 120px;
            font-size: 12px;
          }

          .month-grid {
            gap: 3px;
          }

          .day-cell {
            min-height: 62px;

            padding: 5px;

            border-radius: 8px;
          }

          .day-number {
            width: 21px;
            height: 21px;

            font-size: 8px;
          }

          .event-chip {
            padding:
              2px 4px;

            font-size: 6.5px;
          }

          .detail-tabs {
            overflow-x: auto;
          }

          .detail-tab {
            flex:
              0 0 auto;

            min-width: 64px;
          }
        }

        @media (
          max-width: 520px
        ) {
          .action-button {
            padding:
              0 7px;

            font-size: 8px;
          }

          .weekday {
            font-size: 7px;
          }

          .day-cell {
            min-height: 54px;
            padding: 4px;
          }

          .event-chip {
            display: none;
          }

          .event-count-chip {
            display: block;
          }
        }
 
        /* =================================================
           AL METHER CALENDAR GOLD OVERRIDE
           ================================================= */

        .lawyer-calendar {
          --bg:
            var(--legal-bg);

          --surface:
            var(--legal-surface);

          --surface-2:
            var(--legal-surface-2);

          --surface-3:
            var(--legal-surface-3);

          --border:
            var(--legal-border);

          --text:
            var(--legal-text);

          --muted:
            var(--legal-muted);

          --accent:
            var(--legal-gold);

          --accent-2:
            var(--legal-gold);

          --warning:
            var(--legal-warning);

          --success:
            var(--legal-success);

          --danger:
            var(--legal-danger);

          --cyan:
            var(--legal-gold-light);

          --violet-soft:
            var(--legal-gold-soft);

          --blue-soft:
            var(--legal-gold-soft);

          --cyan-soft:
            var(--legal-gold-soft);

          --danger-soft:
            color-mix(
              in srgb,
              var(--legal-danger) 12%,
              transparent
            );

          --shadow:
            rgba(0, 0, 0, 0.22);

          background:
            var(--legal-bg);

          color:
            var(--legal-text);
        }

        .lawyer-calendar {
          height: 100dvh;
          min-height: 100dvh;

          overflow: hidden;

          padding:
            10px 12px 72px;
        }

        .workspace {
          width:
            min(
              1560px,
              100%
            );

          height:
            calc(
              100dvh -
              82px
            );

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

        .topbar {
          min-height: 48px;

          padding:
            8px 12px;

          gap: 10px;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .brand-kicker {
          color:
            var(--legal-gold);

          font-size: 7px;
          letter-spacing:
            0.16em;
        }

        .brand-title {
          color:
            var(--legal-text);

          font-size: 12px;
          letter-spacing:
            0.07em;

          text-shadow: none;
        }

        .brand-subtitle {
          display: none;
        }

        .top-actions {
          gap: 5px;
        }

        .action-button {
          height: 30px;

          padding:
            0 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 9px;
          font-weight: 800;
        }

        .action-button:hover {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);
        }

        .main-grid {
          grid-template-columns:
            minmax(560px, 2.5fr)
            minmax(300px, 1fr);
        }

        .calendar-panel {
          padding:
            10px 12px;

          border-right:
            1px solid
            var(--legal-border);

          background:
            var(--legal-surface);
        }

        .detail-panel {
          padding:
            10px 12px;

          background:
            var(--legal-surface);
        }

        .section-eyebrow {
          margin-bottom: 3px;

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .section-title {
          font-size: 14px;
        }

        .calendar-toolbar {
          margin-bottom: 8px;
          gap: 8px;
        }

        .calendar-navigation {
          gap: 5px;
        }

        .month-title {
          min-width: 145px;

          color:
            var(--legal-text);

          font-size: 14px;
        }

        .icon-button {
          width: 30px;
          height: 30px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 14px;
        }

        .icon-button:hover {
          border-color:
            var(--legal-gold);

          color:
            var(--legal-gold);
        }

        .weekdays {
          margin-bottom: 4px;
        }

        .weekday {
          padding: 5px 3px;

          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .month-grid {
          gap: 4px;
        }

        .day-cell {
          padding: 7px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            10px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text);

          transition:
            border-color
              var(--legal-transition),
            background
              var(--legal-transition);
        }

        .day-cell::after {
          display: none;
        }

        .day-cell:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow: none;
        }

        .day-cell.selected {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow:
            inset 0 0 0 1px
            var(--legal-gold);
        }

        .day-cell.today {
          background:
            var(--legal-surface-3);
        }

        .day-number {
          width: 24px;
          height: 24px;

          border-radius: 7px;

          font-size: 9px;
        }

        .today .day-number {
          background:
            var(--legal-gold);

          color:
            #111111;
        }

        .event-dots {
          gap: 3px;
          margin-top: 5px;
        }

        .event-count-chip {
          padding:
            3px 5px;

          border:
            1px solid
            var(--legal-gold);

          border-radius: 6px;

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-chip {
          padding:
            3px 5px;

          border-radius: 6px;

          font-size: 7px;
        }

        .event-chip.service {
          color:
            var(--legal-success);
        }

        .event-chip.deadline {
          color:
            var(--legal-danger);
        }

        .event-chip.hearing {
          color:
            var(--legal-warning);
        }

        .event-chip.notice {
          color:
            var(--legal-gold-light);

          background:
            var(--legal-gold-soft);
        }

        .detail-date {
          margin:
            0 0 7px;

          padding-left: 9px;

          border-left:
            2px solid
            var(--legal-gold);

          color:
            var(--legal-text);

          font-size: 13px;
        }

        .detail-list {
          gap: 6px;
        }

        .event-selector {
          gap: 4px;
          margin-bottom: 5px;
        }

        .event-selector-title {
          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-selector-list {
          gap: 4px;
        }

        .event-selector-button {
          height: 29px;

          grid-template-columns:
            17px
            minmax(0, 1fr);

          gap: 4px;

          padding:
            0 5px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);
        }

        .event-selector-button span {
          width: 17px;
          height: 17px;

          border-radius: 5px;

          background:
            var(--legal-surface-3);

          font-size: 7px;
        }

        .event-selector-button strong {
          font-size: 7.5px;
        }

        .event-selector-button.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-text);
        }

        .detail-tabs {
          gap: 3px;

          margin:
            4px 0 6px;
        }

        .detail-tab {
          height: 29px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);

          font-size: 7.5px;
        }

        .detail-tab:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          color:
            var(--legal-text);
        }

        .detail-tab.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold-light);

          box-shadow: none;
        }

        .detail-row {
          grid-template-columns:
            58px
            minmax(0, 1fr);

          gap: 6px;

          padding:
            5px 0;

          border-bottom:
            1px solid
            var(--legal-border);

          font-size: 8px;
        }

        .detail-row span {
          color:
            var(--legal-muted);
        }

        .detail-row strong {
          color:
            var(--legal-text);
        }

        .detail-empty {
          border-color:
            var(--legal-border);

          color:
            var(--legal-muted);
        }

        @media (
          max-width: 900px
        ) {
          .lawyer-calendar {
            height: auto;
            min-height: 100dvh;

            overflow: visible;

            padding:
              7px 7px 74px;
          }

          .workspace {
            width: 100%;
            height: auto;

            min-height:
              calc(
                100dvh -
                81px
              );

            overflow: visible;

            border-radius: 13px;
          }

          .topbar {
            min-height: 44px;
            padding: 7px 8px;
          }

          .brand-title {
            font-size: 10px;
          }

          .main-grid {
            display: block;
          }

          .calendar-panel {
            padding: 8px;

            border-right: 0;
          }

          .detail-panel {
            padding: 8px;

            border-top:
              1px solid
              var(--legal-border);
          }

          .calendar-toolbar {
            margin-bottom: 6px;
          }

          .month-title {
            min-width: 120px;
            font-size: 12px;
          }

          .month-grid {
            gap: 3px;
          }

          .day-cell {
            min-height: 62px;

            padding: 5px;

            border-radius: 8px;
          }

          .day-number {
            width: 21px;
            height: 21px;

            font-size: 8px;
          }

          .event-chip {
            padding:
              2px 4px;

            font-size: 6.5px;
          }

          .detail-tabs {
            overflow-x: auto;
          }

          .detail-tab {
            flex:
              0 0 auto;

            min-width: 64px;
          }
        }

        @media (
          max-width: 520px
        ) {
          .action-button {
            padding:
              0 7px;

            font-size: 8px;
          }

          .weekday {
            font-size: 7px;
          }

          .day-cell {
            min-height: 54px;
            padding: 4px;
          }

          .event-chip {
            display: none;
          }

          .event-count-chip {
            display: block;
          }
        }
 
        /* =================================================
           AL METHER CALENDAR GOLD OVERRIDE
           ================================================= */

        .lawyer-calendar {
          --bg:
            var(--legal-bg);

          --surface:
            var(--legal-surface);

          --surface-2:
            var(--legal-surface-2);

          --surface-3:
            var(--legal-surface-3);

          --border:
            var(--legal-border);

          --text:
            var(--legal-text);

          --muted:
            var(--legal-muted);

          --accent:
            var(--legal-gold);

          --accent-2:
            var(--legal-gold);

          --warning:
            var(--legal-warning);

          --success:
            var(--legal-success);

          --danger:
            var(--legal-danger);

          --cyan:
            var(--legal-gold-light);

          --violet-soft:
            var(--legal-gold-soft);

          --blue-soft:
            var(--legal-gold-soft);

          --cyan-soft:
            var(--legal-gold-soft);

          --danger-soft:
            color-mix(
              in srgb,
              var(--legal-danger) 12%,
              transparent
            );

          --shadow:
            rgba(0, 0, 0, 0.22);

          background:
            var(--legal-bg);

          color:
            var(--legal-text);
        }

        .lawyer-calendar {
          height: 100dvh;
          min-height: 100dvh;

          overflow: hidden;

          padding:
            10px 12px 72px;
        }

        .workspace {
          width:
            min(
              1560px,
              100%
            );

          height:
            calc(
              100dvh -
              82px
            );

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

        .topbar {
          min-height: 48px;

          padding:
            8px 12px;

          gap: 10px;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .brand-kicker {
          color:
            var(--legal-gold);

          font-size: 7px;
          letter-spacing:
            0.16em;
        }

        .brand-title {
          color:
            var(--legal-text);

          font-size: 12px;
          letter-spacing:
            0.07em;

          text-shadow: none;
        }

        .brand-subtitle {
          display: none;
        }

        .top-actions {
          gap: 5px;
        }

        .action-button {
          height: 30px;

          padding:
            0 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 9px;
          font-weight: 800;
        }

        .action-button:hover {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);
        }

        .main-grid {
          grid-template-columns:
            minmax(560px, 2.5fr)
            minmax(300px, 1fr);
        }

        .calendar-panel {
          padding:
            10px 12px;

          border-right:
            1px solid
            var(--legal-border);

          background:
            var(--legal-surface);
        }

        .detail-panel {
          padding:
            10px 12px;

          background:
            var(--legal-surface);
        }

        .section-eyebrow {
          margin-bottom: 3px;

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .section-title {
          font-size: 14px;
        }

        .calendar-toolbar {
          margin-bottom: 8px;
          gap: 8px;
        }

        .calendar-navigation {
          gap: 5px;
        }

        .month-title {
          min-width: 145px;

          color:
            var(--legal-text);

          font-size: 14px;
        }

        .icon-button {
          width: 30px;
          height: 30px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 14px;
        }

        .icon-button:hover {
          border-color:
            var(--legal-gold);

          color:
            var(--legal-gold);
        }

        .weekdays {
          margin-bottom: 4px;
        }

        .weekday {
          padding: 5px 3px;

          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .month-grid {
          gap: 4px;
        }

        .day-cell {
          padding: 7px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            10px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text);

          transition:
            border-color
              var(--legal-transition),
            background
              var(--legal-transition);
        }

        .day-cell::after {
          display: none;
        }

        .day-cell:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow: none;
        }

        .day-cell.selected {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow:
            inset 0 0 0 1px
            var(--legal-gold);
        }

        .day-cell.today {
          background:
            var(--legal-surface-3);
        }

        .day-number {
          width: 24px;
          height: 24px;

          border-radius: 7px;

          font-size: 9px;
        }

        .today .day-number {
          background:
            var(--legal-gold);

          color:
            #111111;
        }

        .event-dots {
          gap: 3px;
          margin-top: 5px;
        }

        .event-count-chip {
          padding:
            3px 5px;

          border:
            1px solid
            var(--legal-gold);

          border-radius: 6px;

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-chip {
          padding:
            3px 5px;

          border-radius: 6px;

          font-size: 7px;
        }

        .event-chip.service {
          color:
            var(--legal-success);
        }

        .event-chip.deadline {
          color:
            var(--legal-danger);
        }

        .event-chip.hearing {
          color:
            var(--legal-warning);
        }

        .event-chip.notice {
          color:
            var(--legal-gold-light);

          background:
            var(--legal-gold-soft);
        }

        .detail-date {
          margin:
            0 0 7px;

          padding-left: 9px;

          border-left:
            2px solid
            var(--legal-gold);

          color:
            var(--legal-text);

          font-size: 13px;
        }

        .detail-list {
          gap: 6px;
        }

        .event-selector {
          gap: 4px;
          margin-bottom: 5px;
        }

        .event-selector-title {
          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-selector-list {
          gap: 4px;
        }

        .event-selector-button {
          height: 29px;

          grid-template-columns:
            17px
            minmax(0, 1fr);

          gap: 4px;

          padding:
            0 5px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);
        }

        .event-selector-button span {
          width: 17px;
          height: 17px;

          border-radius: 5px;

          background:
            var(--legal-surface-3);

          font-size: 7px;
        }

        .event-selector-button strong {
          font-size: 7.5px;
        }

        .event-selector-button.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-text);
        }

        .detail-tabs {
          gap: 3px;

          margin:
            4px 0 6px;
        }

        .detail-tab {
          height: 29px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);

          font-size: 7.5px;
        }

        .detail-tab:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          color:
            var(--legal-text);
        }

        .detail-tab.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold-light);

          box-shadow: none;
        }

        .detail-row {
          grid-template-columns:
            58px
            minmax(0, 1fr);

          gap: 6px;

          padding:
            5px 0;

          border-bottom:
            1px solid
            var(--legal-border);

          font-size: 8px;
        }

        .detail-row span {
          color:
            var(--legal-muted);
        }

        .detail-row strong {
          color:
            var(--legal-text);
        }

        .detail-empty {
          border-color:
            var(--legal-border);

          color:
            var(--legal-muted);
        }

        @media (
          max-width: 900px
        ) {
          .lawyer-calendar {
            height: auto;
            min-height: 100dvh;

            overflow: visible;

            padding:
              7px 7px 74px;
          }

          .workspace {
            width: 100%;
            height: auto;

            min-height:
              calc(
                100dvh -
                81px
              );

            overflow: visible;

            border-radius: 13px;
          }

          .topbar {
            min-height: 44px;
            padding: 7px 8px;
          }

          .brand-title {
            font-size: 10px;
          }

          .main-grid {
            display: block;
          }

          .calendar-panel {
            padding: 8px;

            border-right: 0;
          }

          .detail-panel {
            padding: 8px;

            border-top:
              1px solid
              var(--legal-border);
          }

          .calendar-toolbar {
            margin-bottom: 6px;
          }

          .month-title {
            min-width: 120px;
            font-size: 12px;
          }

          .month-grid {
            gap: 3px;
          }

          .day-cell {
            min-height: 62px;

            padding: 5px;

            border-radius: 8px;
          }

          .day-number {
            width: 21px;
            height: 21px;

            font-size: 8px;
          }

          .event-chip {
            padding:
              2px 4px;

            font-size: 6.5px;
          }

          .detail-tabs {
            overflow-x: auto;
          }

          .detail-tab {
            flex:
              0 0 auto;

            min-width: 64px;
          }
        }

        @media (
          max-width: 520px
        ) {
          .action-button {
            padding:
              0 7px;

            font-size: 8px;
          }

          .weekday {
            font-size: 7px;
          }

          .day-cell {
            min-height: 54px;
            padding: 4px;
          }

          .event-chip {
            display: none;
          }

          .event-count-chip {
            display: block;
          }
        }
 
        /* =================================================
           AL METHER CALENDAR GOLD OVERRIDE
           ================================================= */

        .lawyer-calendar {
          --bg:
            var(--legal-bg);

          --surface:
            var(--legal-surface);

          --surface-2:
            var(--legal-surface-2);

          --surface-3:
            var(--legal-surface-3);

          --border:
            var(--legal-border);

          --text:
            var(--legal-text);

          --muted:
            var(--legal-muted);

          --accent:
            var(--legal-gold);

          --accent-2:
            var(--legal-gold);

          --warning:
            var(--legal-warning);

          --success:
            var(--legal-success);

          --danger:
            var(--legal-danger);

          --cyan:
            var(--legal-gold-light);

          --violet-soft:
            var(--legal-gold-soft);

          --blue-soft:
            var(--legal-gold-soft);

          --cyan-soft:
            var(--legal-gold-soft);

          --danger-soft:
            color-mix(
              in srgb,
              var(--legal-danger) 12%,
              transparent
            );

          --shadow:
            rgba(0, 0, 0, 0.22);

          background:
            var(--legal-bg);

          color:
            var(--legal-text);
        }

        .lawyer-calendar {
          height: 100dvh;
          min-height: 100dvh;

          overflow: hidden;

          padding:
            10px 12px 72px;
        }

        .workspace {
          width:
            min(
              1560px,
              100%
            );

          height:
            calc(
              100dvh -
              82px
            );

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

        .topbar {
          min-height: 48px;

          padding:
            8px 12px;

          gap: 10px;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .brand-kicker {
          color:
            var(--legal-gold);

          font-size: 7px;
          letter-spacing:
            0.16em;
        }

        .brand-title {
          color:
            var(--legal-text);

          font-size: 12px;
          letter-spacing:
            0.07em;

          text-shadow: none;
        }

        .brand-subtitle {
          display: none;
        }

        .top-actions {
          gap: 5px;
        }

        .action-button {
          height: 30px;

          padding:
            0 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 9px;
          font-weight: 800;
        }

        .action-button:hover {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);
        }

        .main-grid {
          grid-template-columns:
            minmax(560px, 2.5fr)
            minmax(300px, 1fr);
        }

        .calendar-panel {
          padding:
            10px 12px;

          border-right:
            1px solid
            var(--legal-border);

          background:
            var(--legal-surface);
        }

        .detail-panel {
          padding:
            10px 12px;

          background:
            var(--legal-surface);
        }

        .section-eyebrow {
          margin-bottom: 3px;

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .section-title {
          font-size: 14px;
        }

        .calendar-toolbar {
          margin-bottom: 8px;
          gap: 8px;
        }

        .calendar-navigation {
          gap: 5px;
        }

        .month-title {
          min-width: 145px;

          color:
            var(--legal-text);

          font-size: 14px;
        }

        .icon-button {
          width: 30px;
          height: 30px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          font-size: 14px;
        }

        .icon-button:hover {
          border-color:
            var(--legal-gold);

          color:
            var(--legal-gold);
        }

        .weekdays {
          margin-bottom: 4px;
        }

        .weekday {
          padding: 5px 3px;

          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .month-grid {
          gap: 4px;
        }

        .day-cell {
          padding: 7px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            10px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text);

          transition:
            border-color
              var(--legal-transition),
            background
              var(--legal-transition);
        }

        .day-cell::after {
          display: none;
        }

        .day-cell:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow: none;
        }

        .day-cell.selected {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow:
            inset 0 0 0 1px
            var(--legal-gold);
        }

        .day-cell.today {
          background:
            var(--legal-surface-3);
        }

        .day-number {
          width: 24px;
          height: 24px;

          border-radius: 7px;

          font-size: 9px;
        }

        .today .day-number {
          background:
            var(--legal-gold);

          color:
            #111111;
        }

        .event-dots {
          gap: 3px;
          margin-top: 5px;
        }

        .event-count-chip {
          padding:
            3px 5px;

          border:
            1px solid
            var(--legal-gold);

          border-radius: 6px;

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-chip {
          padding:
            3px 5px;

          border-radius: 6px;

          font-size: 7px;
        }

        .event-chip.service {
          color:
            var(--legal-success);
        }

        .event-chip.deadline {
          color:
            var(--legal-danger);
        }

        .event-chip.hearing {
          color:
            var(--legal-warning);
        }

        .event-chip.notice {
          color:
            var(--legal-gold-light);

          background:
            var(--legal-gold-soft);
        }

        .detail-date {
          margin:
            0 0 7px;

          padding-left: 9px;

          border-left:
            2px solid
            var(--legal-gold);

          color:
            var(--legal-text);

          font-size: 13px;
        }

        .detail-list {
          gap: 6px;
        }

        .event-selector {
          gap: 4px;
          margin-bottom: 5px;
        }

        .event-selector-title {
          color:
            var(--legal-gold);

          font-size: 7px;
        }

        .event-selector-list {
          gap: 4px;
        }

        .event-selector-button {
          height: 29px;

          grid-template-columns:
            17px
            minmax(0, 1fr);

          gap: 4px;

          padding:
            0 5px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);
        }

        .event-selector-button span {
          width: 17px;
          height: 17px;

          border-radius: 5px;

          background:
            var(--legal-surface-3);

          font-size: 7px;
        }

        .event-selector-button strong {
          font-size: 7.5px;
        }

        .event-selector-button.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-text);
        }

        .detail-tabs {
          gap: 3px;

          margin:
            4px 0 6px;
        }

        .detail-tab {
          height: 29px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface-2);

          color:
            var(--legal-muted);

          font-size: 7.5px;
        }

        .detail-tab:hover {
          transform: none;

          border-color:
            var(--legal-gold);

          color:
            var(--legal-text);
        }

        .detail-tab.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold-light);

          box-shadow: none;
        }

        .detail-row {
          grid-template-columns:
            58px
            minmax(0, 1fr);

          gap: 6px;

          padding:
            5px 0;

          border-bottom:
            1px solid
            var(--legal-border);

          font-size: 8px;
        }

        .detail-row span {
          color:
            var(--legal-muted);
        }

        .detail-row strong {
          color:
            var(--legal-text);
        }

        .detail-empty {
          border-color:
            var(--legal-border);

          color:
            var(--legal-muted);
        }

        @media (
          max-width: 900px
        ) {
          .lawyer-calendar {
            height: auto;
            min-height: 100dvh;

            overflow: visible;

            padding:
              7px 7px 74px;
          }

          .workspace {
            width: 100%;
            height: auto;

            min-height:
              calc(
                100dvh -
                81px
              );

            overflow: visible;

            border-radius: 13px;
          }

          .topbar {
            min-height: 44px;
            padding: 7px 8px;
          }

          .brand-title {
            font-size: 10px;
          }

          .main-grid {
            display: block;
          }

          .calendar-panel {
            padding: 8px;

            border-right: 0;
          }

          .detail-panel {
            padding: 8px;

            border-top:
              1px solid
              var(--legal-border);
          }

          .calendar-toolbar {
            margin-bottom: 6px;
          }

          .month-title {
            min-width: 120px;
            font-size: 12px;
          }

          .month-grid {
            gap: 3px;
          }

          .day-cell {
            min-height: 62px;

            padding: 5px;

            border-radius: 8px;
          }

          .day-number {
            width: 21px;
            height: 21px;

            font-size: 8px;
          }

          .event-chip {
            padding:
              2px 4px;

            font-size: 6.5px;
          }

          .detail-tabs {
            overflow-x: auto;
          }

          .detail-tab {
            flex:
              0 0 auto;

            min-width: 64px;
          }
        }

        @media (
          max-width: 520px
        ) {
          .action-button {
            padding:
              0 7px;

            font-size: 8px;
          }

          .weekday {
            font-size: 7px;
          }

          .day-cell {
            min-height: 54px;
            padding: 4px;
          }

          .event-chip {
            display: none;
          }

          .event-count-chip {
            display: block;
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

        /* LIVE CALENDAR VISIBILITY FIX */

        .top-actions {
          display: none !important;
        }

        .day-cell.today {
          border-color:
            var(--legal-border-strong);

          background:
            var(--legal-surface-3);
        }

        .day-cell.today
        .day-number {
          background:
            var(--legal-gold);

          color: #111;
        }

        .day-cell.selected {
          border:
            2px solid
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow: none;
        }

        .day-cell.selected.today {
          border:
            2px solid
            var(--legal-gold);
        }

        .event-dots {
          display: flex;
          flex-wrap: wrap;
          gap: 3px;

          max-width: 100%;
        }

        .event-chip {
          width: auto !important;
          height: auto !important;
          min-width: 0 !important;

          display: block !important;

          padding:
            2px 5px !important;

          border-radius:
            999px !important;

          color:
            var(--legal-text-soft)
            !important;

          font-size:
            6.5px !important;

          line-height: 1.25;

          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .event-chip.service {
          border-color:
            color-mix(
              in srgb,
              var(--legal-success)
              40%,
              transparent
            );

          background:
            color-mix(
              in srgb,
              var(--legal-success)
              12%,
              transparent
            );

          color:
            var(--legal-success)
            !important;
        }

        .event-chip.deadline {
          color:
            var(--legal-danger)
            !important;
        }

        .event-chip.hearing {
          color:
            var(--legal-warning)
            !important;
        }

        .event-chip.notice {
          color:
            var(--legal-gold)
            !important;
        }

        .detail-row {
          font-size: 8.7px;
        }

        .detail-row strong {
          font-size: 8.7px;
        }

        @media (
          max-width: 760px
        ) {
          .event-chip {
            max-width: 100%;

            padding:
              2px 4px !important;

            font-size:
              6px !important;
          }
        }

        @media (
          max-width: 520px
        ) {
          .event-chip {
            width: 7px !important;
            height: 7px !important;
            min-width: 7px !important;

            padding: 0 !important;

            color:
              transparent !important;

            font-size: 0 !important;
          }
        }


        /* =================================================
           MOBILE CALENDAR HARD WIDTH FIX
           ================================================= */

        @media (max-width: 760px) {

          .lawyer-calendar,
          .workspace,
          .main-grid,
          .calendar-panel,
          .detail-panel {
            width: 100%;
            max-width: 100%;
            min-width: 0;

            box-sizing: border-box;
          }

          .calendar-panel {
            overflow-x: hidden;
          }

          .weekdays,
          .month-grid {
            width: 100%;
            max-width: 100%;
            min-width: 0;

            display: grid;

            grid-template-columns:
              repeat(
                7,
                minmax(0, 1fr)
              );

            box-sizing: border-box;
          }

          .weekdays {
            gap: 2px;
          }

          .month-grid {
            gap: 3px;
          }

          .weekday,
          .day-cell,
          .day-cell.empty {
            width: auto;
            min-width: 0;
            max-width: 100%;

            box-sizing: border-box;
          }

          .day-cell {
            min-height: 50px;

            padding: 3px;
          }

          .calendar-toolbar {
            width: 100%;
            max-width: 100%;

            box-sizing: border-box;
          }

          .calendar-navigation {
            width: 100%;
            min-width: 0;

            display: grid;

            grid-template-columns:
              34px
              minmax(0, 1fr)
              34px;

            gap: 5px;
          }

          .calendar-navigation
          .icon-button {
            width: 34px;
            min-width: 34px;
          }

          .month-title {
            width: auto;
            min-width: 0;

            text-align: center;
          }
        }

        @media (max-width: 390px) {

          .calendar-panel {
            padding:
              6px 4px;
          }

          .weekdays {
            gap: 1px;
          }

          .month-grid {
            gap: 2px;
          }

          .day-cell {
            min-height: 46px;

            padding: 2px;
          }

          .weekday {
            font-size: 6.5px;
          }
        }
        /* AUTOMATIC LEGAL ALARM UI */

        .alarm-plan-info {
          display: grid;
          gap: 2px;

          margin-bottom: 8px;
          padding-bottom: 8px;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .alarm-plan-info strong {
          color:
            var(--legal-text);

          font-size: 9px;
        }

        .alarm-plan-info span {
          color:
            var(--legal-muted);

          font-size: 7.5px;
        }

        .alarm-list {
          display: grid;
          gap: 5px;
        }

        .alarm-item {
          min-height: 48px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 10px;

          padding: 7px 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);
        }

        .alarm-item.active {
          border-left:
            2px solid
            var(--legal-gold);
        }

        .alarm-item.disabled {
          opacity: 0.55;
        }

        .alarm-main {
          min-width: 0;

          display: grid;
          gap: 3px;
        }

        .alarm-main strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;

          color:
            var(--legal-text);

          font-size: 8.5px;
        }

        .alarm-main span {
          color:
            var(--legal-muted);

          font-size: 7.5px;
        }

        .alarm-controls {
          flex: 0 0 auto;

          display: flex;
          align-items: center;

          gap: 6px;
        }

        .alarm-status {
          font-size: 7px;
          font-weight: 850;
        }

        .alarm-status.active {
          color:
            var(--legal-success);
        }

        .alarm-status.disabled {
          color:
            var(--legal-muted);
        }

        .alarm-controls button {
          width: 42px;
          height: 27px;

          border:
            1px solid
            var(--legal-border);

          border-radius: 7px;

          background:
            var(--legal-surface);

          color:
            var(--legal-text-soft);

          font-size: 7px;
          font-weight: 800;

          cursor: pointer;
        }

        .alarm-controls button:hover:not(:disabled) {
          border-color:
            var(--legal-gold);

          color:
            var(--legal-gold);
        }

        .alarm-error {
          color:
            var(--legal-danger);

          font-size: 7.5px;
        }

        .event-dots {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr);
          align-content: start;
          gap: 3px;
        }

        .event-dots .event-chip,
        .event-dots .event-count-chip {
          width: 100% !important;
          max-width: 100%;
          text-align: left;
        }

        .event-selector-list {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr);
          gap: 6px;
          overflow: visible;
        }

        .event-selector-button {
          width: 100%;
          min-height: 40px;
          height: auto;
          flex: none;
          padding: 6px 8px;
        }

        .event-selector-button strong {
          display: -webkit-box;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          white-space: normal;
          line-height: 1.3;
        }

        @media (max-width: 520px) {
          .event-dots {
            gap: 2px;
            margin-top: 4px;
          }

          .event-dots .event-chip,
          .event-dots .event-count-chip {
            width: 100% !important;
            height: auto !important;
            min-width: 0 !important;
            padding: 1px 3px !important;
            font-size: 5.5px !important;
            line-height: 1.2;
          }

          .event-dots .event-chip {
            color:
              var(--legal-text-soft)
              !important;
          }

          .event-dots .event-chip.service {
            color:
              var(--legal-success)
              !important;
          }

          .event-dots .event-chip.deadline {
            color:
              var(--legal-danger)
              !important;
          }

          .event-dots .event-chip.hearing {
            color:
              var(--legal-warning)
              !important;
          }

          .event-dots .event-chip.notice,
          .event-dots .event-count-chip {
            color:
              var(--legal-gold)
              !important;
          }

          .event-selector-button {
            min-height: 44px;
          }
        }

        /* CALENDAR DESKTOP PRODUCT SHELL */
        @media (min-width: 901px) {
          html:has(.lawyer-calendar),
          body:has(.lawyer-calendar) {
            height: 100%;
            overflow: hidden;
          }

          .lawyer-calendar {
            width: 100%;
            height: 100vh;
            min-height: 0;
            padding: 10px 72px 10px 10px;
            overflow: hidden;
            background: transparent;
          }

          .workspace {
            width: 100%;
            max-width: none;
            height: calc(100vh - 20px);
            min-height: 0;
            margin: 0;
            overflow: hidden;
            border: 1px solid var(--legal-border);
            border-radius: 22px;
            background: color-mix(in srgb, var(--legal-surface) 94%, transparent);
            box-shadow: var(--legal-shadow-md);
            backdrop-filter: blur(24px);
          }

          .topbar {
            min-height: 58px;
            height: 58px;
            padding: 8px 16px;
            background: transparent;
          }

          .brand {
            display: flex;
            align-items: center;
            gap: 11px;
          }

          .calendar-home-link {
            color: inherit;
            text-decoration: none;
          }

          .brand-subtitle {
            display: block;
            margin: 0;
            padding-left: 11px;
            border-left: 1px solid var(--legal-border);
            color: var(--legal-text);
            font-size: 15px;
            font-weight: 850;
            letter-spacing: -.02em;
          }

          .main-grid {
            height: calc(100% - 58px);
            min-height: 0;
            grid-template-columns: minmax(0, 1.72fr) minmax(330px, .72fr);
            overflow: hidden;
          }

          .summary-panel {
            display: none;
          }

          .calendar-panel,
          .detail-panel {
            min-width: 0;
            min-height: 0;
            background: transparent;
          }

          .calendar-panel {
            display: flex;
            flex-direction: column;
            padding: 12px 14px;
            border-right: 1px solid var(--legal-border);
          }

          .detail-panel {
            padding: 12px 14px;
            overflow-y: auto;
            background: color-mix(in srgb, var(--legal-surface-2) 58%, transparent);
            scrollbar-width: thin;
            scrollbar-color: var(--legal-border-strong) transparent;
          }

          .detail-panel::-webkit-scrollbar {
            width: 5px;
          }

          .detail-panel::-webkit-scrollbar-thumb {
            border-radius: 999px;
            background: var(--legal-border-strong);
          }

          .calendar-toolbar {
            min-height: 34px;
            flex: 0 0 auto;
            margin-bottom: 7px;
          }

          .month-title {
            min-width: 150px;
            font-size: 14px;
            font-weight: 900;
            letter-spacing: -.015em;
          }

          .weekdays {
            flex: 0 0 auto;
            margin-bottom: 4px;
          }

          .weekday {
            padding: 4px 3px;
            font-size: 7.5px;
            font-weight: 850;
            letter-spacing: .04em;
            text-transform: uppercase;
          }

          .month-grid {
            flex: 1 1 auto;
            min-height: 0;
            grid-auto-rows: minmax(0, 1fr);
            gap: 5px;
          }

          .day-cell,
          .day-cell.empty {
            min-width: 0;
            min-height: 0;
            padding: 6px;
            overflow: hidden;
            border: 1px solid var(--legal-border);
            border-radius: 10px;
            background: color-mix(in srgb, var(--legal-surface-2) 82%, transparent);
          }

          .day-cell.empty {
            opacity: .48;
          }

          .day-cell:hover {
            border-color: var(--legal-border-strong);
            background: var(--legal-surface-2);
          }

          .day-cell.selected {
            border: 1px solid var(--legal-gold);
            background: var(--legal-gold-soft);
            box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--legal-gold) 28%, transparent);
          }

          .day-number {
            width: 22px;
            height: 22px;
            font-size: 8px;
            font-weight: 900;
          }

          .event-dots {
            gap: 3px;
            margin-top: 4px;
          }

          .event-dots .event-chip,
          .event-dots .event-count-chip {
            min-width: 0;
            padding: 3px 6px !important;
            border: 1px solid var(--legal-border);
            border-radius: 999px !important;
            background: var(--legal-surface);
            color: var(--legal-text-soft) !important;
            font-size: 8.5px !important;
            font-weight: 760;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            cursor: pointer;
          }

          .event-dots .event-chip.critical,
          .event-dots .event-chip.deadline {
            border-color: color-mix(in srgb, var(--legal-danger) 38%, var(--legal-border));
            background: color-mix(in srgb, var(--legal-danger) 8%, var(--legal-surface));
            color: var(--legal-danger) !important;
          }

          .event-dots .event-chip.approaching {
            border-color: color-mix(in srgb, var(--legal-warning) 42%, var(--legal-border));
            background: color-mix(in srgb, var(--legal-warning) 9%, var(--legal-surface));
            color: var(--legal-warning) !important;
          }

          .event-dots .event-chip.hearing {
            border-color: rgba(58, 133, 206, .38);
            background: rgba(58, 133, 206, .08);
            color: #3984c9 !important;
          }

          .event-dots .event-chip.notice,
          .event-dots .event-count-chip {
            border-color: color-mix(in srgb, var(--legal-gold) 38%, var(--legal-border));
            background: var(--legal-gold-soft);
            color: var(--legal-gold-dark) !important;
          }

          .event-dots .event-chip.service {
            border-color: var(--legal-border-strong);
            background: var(--legal-surface-2);
            color: var(--legal-text-soft) !important;
          }

          .detail-date {
            margin-bottom: 8px;
            color: var(--legal-text);
            font-size: 13px;
          }

          .event-selector-list {
            max-height: 144px;
            overflow-y: auto;
            scrollbar-width: thin;
          }

          .detail-tabs {
            position: sticky;
            top: -12px;
            z-index: 2;
            padding: 5px 0;
            background: color-mix(in srgb, var(--legal-surface-2) 94%, transparent);
          }

          .detail-tab {
            min-width: 0;
            height: 28px;
            font-size: 7px;
          }
        }
`}</style>

      <section className="workspace">
        <header className="topbar">
          <div className="brand">
            <a href="/" className="calendar-home-link" aria-label="Dashboard'a dön">
              <LegalBrand />
            </a>

            <p className="brand-subtitle">
              Takvim
            </p>
          </div>

          <div className="top-actions">
            <button
              type="button"
              className="action-button labelled"
              onClick={loadEvents}
            >
              Yenile
            </button>

          </div>
        </header>

        <div className="main-grid">
          <aside className="summary-panel">
            <div className="section-eyebrow">
              Bugün
            </div>

            <h2 className="section-title">
              Ne yapmam gerekiyor?
            </h2>

            <div className="summary-stack">
              <div className="summary-item">
                <div className="summary-value">
                  {todayEvents.length}
                </div>

                <div className="summary-label">
                  Bugünkü kayıt
                </div>
              </div>

              <div className="summary-item">
                <div className="summary-value">
                  {criticalCount}
                </div>

                <div className="summary-label">
                  Kritik / son gün
                </div>
              </div>

              <div className="summary-item">
                <div className="summary-value">
                  {noticeCount}
                </div>

                <div className="summary-label">
                  Tebligat kaydı
                </div>
              </div>
            </div>
          </aside>

          <section className="calendar-panel">
            <div className="calendar-toolbar">
              <div className="calendar-navigation">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() =>
                    changeMonth(-1)
                  }
                  aria-label="Önceki ay"
                >
                  ‹
                </button>

                <div className="month-title">
                  {MONTHS[month]} {year}
                </div>

                <button
                  type="button"
                  className="icon-button"
                  onClick={() =>
                    changeMonth(1)
                  }
                  aria-label="Sonraki ay"
                >
                  ›
                </button>
              </div>

              <button
                type="button"
                className="action-button"
                onClick={goToday}
              >
                Bugün
              </button>
            </div>

            <div className="weekdays">
              {WEEKDAYS.map((weekday) => (
                <div
                  key={weekday}
                  className="weekday"
                >
                  {weekday}
                </div>
              ))}
            </div>

            <div className="month-grid">
              {calendarCells.map(
                (day, index) => {
                  if (!day) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="day-cell empty"
                      />
                    );
                  }

                  const date = toIsoDate(
                    year,
                    month,
                    day
                  );

                  const dayEvents =
                    eventsByDate.get(date) ||
                    [];

                  const classes = [
                    "day-cell",
                    date === selectedDate
                      ? "selected"
                      : "",
                    date === todayIso()
                      ? "today"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      type="button"
                      key={date}
                      className={classes}
                      onClick={() => {
                        setSelectedDate(date);
                        setCalendarDetailOpen(true);
                      }}
                    >
                      <span className="day-number">
                        {day}
                      </span>

                        <span className="event-dots">
                          {dayEvents
                            .slice(0, 2)
                            .map((event) => {
                              const manual =
                                getManualReminderPresentation(
                                  event
                                );
                              const eventLabel = manual
                                ? `${manual.time} — ${manual.note}`
                                : event.title;

                              return (
                                <span
                                  key={event.id}
                                  title={eventLabel}
                                  className={`event-chip ${getEventKind(event)} ${
                                    event.risk === "critical"
                                      ? "critical"
                                      : event.risk === "high"
                                        ? "approaching"
                                        : ""
                                  }`}
                                  onClick={(clickEvent) => {
                                    clickEvent.stopPropagation();
                                    setSelectedDate(date);
                                    setSelectedEventId(event.id);
                                    setCalendarDetailOpen(true);
                                  }}
                                >
                                  {eventLabel}
                                </span>
                              );
                            })}

                          {dayEvents.length > 2 && (
                            <span
                              className="event-count-chip"
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation();
                                setSelectedDate(date);
                                setCalendarDetailOpen(true);
                              }}
                            >
                              +{dayEvents.length - 2} kayıt
                            </span>
                          )}
                        </span>
                    </button>
                  );
                }
              )}
            </div>

            {loading && (
              <p className="loading">
                Takvim yükleniyor...
              </p>
            )}

            {error && (
              <div className="error-state">
                {error}
              </div>
            )}

            {!loading && !error && events.length === 0 && (
              <div className="empty-state">
                Bu ay için takvim kaydı bulunmuyor.
              </div>
            )}
          </section>

          <aside className="detail-panel">
            {selectedEvent && (
              <LegalBackButton
                fallback="/calendar"
                onBack={() =>
                  setCalendarDetailOpen(false)
                }
              />
            )}

            <div className="section-eyebrow">
              Seçili gün
            </div>

            <h2 className="detail-date">
              {formatLongDate(selectedDate)}
            </h2>

            {selectedEvents.length > 1 && (
              <div className="event-selector">
                <div className="event-selector-title">
                  {selectedEvents.length} kayıt
                </div>

                <div className="event-selector-list">
                  {selectedEvents.map(
                    (event, index) => (
                      <button
                        key={event.id}
                        type="button"
                        className={`event-selector-button ${
                          selectedEvent?.id ===
                          event.id
                            ? "active"
                            : ""
                        }`}
                        onClick={() => {
                          setSelectedEventId(
                            event.id
                          );
                          setCalendarDetailOpen(true);
                          setActiveDetailTab(
                            "general"
                          );
                        }}
                      >
                        <span>
                          {index + 1}
                        </span>

                        <strong>
                          {event.title}
                        </strong>
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {!selectedEvent ? (
              <div className="empty-state">
                Bu güne ait tebligat, son tarih
                veya görev bulunmuyor.
              </div>
            ) : (
              <>
                <div className="detail-tabs">
                  {[
                    ["general", "Genel"],
                    ["mail", "Mail"],
                    ["attachments", "Ekler"],
                    ["checklist", "Liste"],
                    ["alarm", "Alarm"],
                    ["notes", "Not"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`detail-tab ${
                        activeDetailTab === key
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setActiveDetailTab(
                          key as typeof activeDetailTab
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="detail-content">
                  {activeDetailTab === "general" && (
                    <section className="detail-section">
                      <div className="event-type">
                        {getKindLabel(selectedEvent)}
                      </div>

                      <h3 className="event-title">
                        {selectedEvent.title}
                      </h3>

                      {selectedEvent.description && (
                        <p className="event-description">
                          {selectedEvent.description}
                        </p>
                      )}

                      <div className="detail-grid">
                        {selectedManualReminder && (
                          <>
                            <div className="detail-row">
                              <span>Dava</span>
                              <strong>
                                {selectedManualReminder.caseTitle}
                              </strong>
                            </div>

                            <div className="detail-row">
                              <span>Saat</span>
                              <strong>
                                {selectedManualReminder.time ||
                                  "Bilgi yok"}
                              </strong>
                            </div>

                            <div className="detail-row">
                              <span>Not</span>
                              <strong>
                                {selectedManualReminder.note}
                              </strong>
                            </div>
                          </>
                        )}

                        <div className="detail-row">
                          <span>Tür</span>
                          <strong>
                            {getKindLabel(selectedEvent)}
                          </strong>
                        </div>

                        <div className="detail-row">
                          <span>Tarih</span>
                          <strong>
                            {formatLongDate(
                              selectedEvent.startDate
                            )}
                          </strong>
                        </div>

                        <div className="detail-row">
                          <span>Kaynak</span>
                          <strong>
                            {selectedManualReminder
                              ? selectedManualReminder.sourceLabel
                              : selectedEvent.source ||
                                "METHER LAWYER"}
                          </strong>
                        </div>

                        <div className="detail-row">
                          <span>Risk</span>
                          <strong>
                            {selectedEvent.risk ||
                              "Bilgi yok"}
                          </strong>
                        </div>
                      </div>
                    </section>
                  )}

                  {activeDetailTab === "mail" && (
                    <section className="detail-section">
                      {!selectedRaw.mailBody &&
                      !selectedRaw.subject ? (
                        <div className="detail-empty">
                          Bu takvim kaydına bağlı mail
                          içeriği bulunmuyor.
                        </div>
                      ) : (
                        <div className="mail-detail">
                          <div className="detail-row">
                            <span>Konu</span>
                            <strong>
                              {selectedRaw.subject ||
                                "Bilgi yok"}
                            </strong>
                          </div>

                          <div className="detail-row">
                            <span>Gönderen</span>
                            <strong>
                              {selectedRaw.sender ||
                                "Bilgi yok"}
                            </strong>
                          </div>

                          <div className="detail-row">
                            <span>Tarih</span>
                            <strong>
                              {selectedRaw.receivedAt ||
                                selectedRaw.arrivalDate ||
                                "Bilgi yok"}
                            </strong>
                          </div>

                          {selectedRaw.aiSummary && (
                            <div className="mail-summary">
                              <span>Özet</span>
                              <p>
                                {selectedRaw.aiSummary}
                              </p>
                            </div>
                          )}

                          <div className="mail-body">
                            {selectedRaw.mailBody ||
                              selectedRaw.snippet ||
                              "Mail içeriği bulunmuyor."}
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {activeDetailTab === "attachments" && (
                    <section className="detail-section">
                      {!previewAttachment && (
<div className="attachment-upload-row">
                        <label className="attachment-upload">
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            disabled={
                              attachmentUploading
                            }
                            onChange={(event) => {
                              const file =
                                event.target.files?.[0];

                              if (file) {
                                uploadAttachment(file);
                              }

                              event.target.value = "";
                            }}
                          />

                          <span>
                            {attachmentUploading
                              ? "Yükleniyor..."
                              : "Dosya Ekle"}
                          </span>
                        </label>

                        <label className="attachment-upload camera-upload">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            disabled={
                              attachmentUploading
                            }
                            onChange={(event) => {
                              const file =
                                event.target.files?.[0];

                              if (file) {
                                uploadAttachment(file);
                              }

                              event.target.value = "";
                            }}
                          />

                          <span>
                            Fotoğraf Çek
                          </span>
                        </label>

                        <label className="attachment-upload convert-upload">
                          <input
                            type="file"
                            accept="image/jpeg,image/png"
                            disabled={
                              attachmentUploading
                            }
                            onChange={(event) => {
                              const file =
                                event.target.files?.[0];

                              if (file) {
                                convertImageToPdfAndUpload(
                                  file
                                );
                              }

                              event.target.value = "";
                            }}
                          />

                          <span>
                            Görseli PDF Yap
                          </span>
                        </label>

                        <label className="attachment-upload multi-convert-upload">
                          <input
                            type="file"
                            accept="image/jpeg,image/png"
                            multiple
                            disabled={
                              attachmentUploading
                            }
                            onChange={(event) => {
                              const files =
                                Array.from(
                                  event.target.files || []
                                );

                              if (files.length > 0) {
                                convertImagesToPdfAndUpload(
                                  files
                                );
                              }

                              event.target.value = "";
                            }}
                          />

                          <span>
                            Çoklu Görsel → PDF
                          </span>
                        </label>
                      </div>
)}

{attachmentsLoading ? (
                        <div className="detail-empty">
                          Ekler yükleniyor...
                        </div>
                      ) : attachmentsError ? (
                        <div className="save-error">
                          {attachmentsError}
                        </div>
                      ) : attachments.length === 0 ? (
                        <div className="detail-empty">
                          Bu kayda ait ek bulunmuyor.
                        </div>
                      ) : previewAttachment &&
                        previewUrl ? (
                        <div className="pdf-preview">
                          <div className="pdf-preview-header">
                            <strong>
                              {previewAttachment.file_name}
                            </strong>

                            <button
                              type="button"
                              className="small-button"
                              onClick={
                                closeAttachmentPreview
                              }
                            >
                              Kapat
                            </button>
                          </div>

                          <iframe
                            title={
                              previewAttachment.file_name
                            }
                            src={previewUrl}
                            className="pdf-preview-frame"
                          />
                        </div>
                      ) : (
                        <div className="attachment-list">
                          {attachments.map(
                            (attachment) => (
                              <div
                                key={attachment.id}
                                className="attachment-item"
                              >
                                <div>
                                  <strong>
                                    {attachment.file_name}
                                  </strong>

                                  <span>
                                    {attachment.file_type ||
                                      "Dosya"}

                                    {attachment.file_size
                                      ? ` · ${Math.max(
                                          1,
                                          Math.round(
                                            attachment.file_size /
                                              1024
                                          )
                                        )} KB`
                                      : ""}
                                  </span>
                                </div>

                                <div className="attachment-actions">
                                  <button
                                    type="button"
                                    className="small-button"
                                    disabled={
                                      previewLoading
                                    }
                                    onClick={() =>
                                      previewAttachmentFile(
                                        attachment
                                      )
                                    }
                                  >
                                    {attachment.file_type ===
                                    "application/pdf"
                                      ? "Önizle"
                                      : "Aç"}
                                  </button>

                                  <button
                                    type="button"
                                    className="small-button"
                                    onClick={() =>
                                      downloadAttachment(
                                        attachment
                                      )
                                    }
                                  >
                                    İndir
                                  </button>

                                  <button
                                    type="button"
                                    className="small-button"
                                    onClick={() =>
                                      renameAttachment(
                                        attachment
                                      )
                                    }
                                  >
                                    Adlandır
                                  </button>

                                  <button
                                    type="button"
                                    className="small-button danger-button"
                                    onClick={() =>
                                      deleteAttachment(
                                        attachment.id
                                      )
                                    }
                                  >
                                    Sil
                                  </button>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </section>
                  )}

                  {activeDetailTab === "checklist" && (
                    <section className="detail-section">
                      {checklistLoading ? (
                        <div className="detail-empty">
                          Checklist yükleniyor...
                        </div>
                      ) : (
                        <>
                          <div className="checklist">
                            {[
                              ["mailRead", "Mail okundu"],
                              ["noticeReviewed", "Tebligat incelendi"],
                              ["caseOpened", "Dosya açıldı"],
                              ["deadlineChecked", "Süre kontrol edildi"],
                              ["completed", "İş tamamlandı"],
                            ].map(([key, label]) => (
                              <label
                                key={key}
                                className="check-item"
                              >
                                <input
                                  type="checkbox"
                                  disabled={
                                    checklistSaving
                                  }
                                  checked={
                                    checklist[
                                      key as keyof typeof checklist
                                    ]
                                  }
                                  onChange={(event) =>
                                    updateChecklist(
                                      key as keyof typeof checklist,
                                      event.target.checked
                                    )
                                  }
                                />

                                {label}
                              </label>
                            ))}
                          </div>

                          {checklistSaving && (
                            <div className="save-status">
                              Kaydediliyor...
                            </div>
                          )}

                          {checklistError && (
                            <div className="save-error">
                              {checklistError}
                            </div>
                          )}
                        </>
                      )}
                    </section>
                  )}

                  {activeDetailTab === "alarm" && (
                    <section className="detail-section">
                      <div className="alarm-plan-info">
                        <strong>
                          Otomatik hukuki süre hatırlatmaları
                        </strong>

                        <span>
                          7 gün · 3 gün · 1 gün · son gün 09:00
                        </span>
                      </div>

                      {alarmsLoading ? (
                        <div className="detail-empty">
                          Alarm kayıtları yükleniyor...
                        </div>
                      ) : alarmsError ? (
                        <div className="alarm-error">
                          {alarmsError}
                        </div>
                      ) : alarms.length === 0 ? (
                        <div className="detail-empty">
                          Planlanmış alarm bulunmuyor.
                        </div>
                      ) : (
                        <div className="alarm-list">
                          {alarms.map((alarm) => (
                            <div
                              key={alarm.id}
                              className={
                                alarm.status === "active"
                                  ? "alarm-item active"
                                  : "alarm-item disabled"
                              }
                            >
                              <div className="alarm-main">
                                <strong>
                                  {alarm.message}
                                </strong>

                                <span>
                                  {new Date(
                                    alarm.alarm_time
                                  ).toLocaleString(
                                    "tr-TR",
                                    {
                                      day: "2-digit",
                                      month: "long",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      timeZone:
                                        "Europe/Istanbul",
                                    }
                                  )}
                                </span>
                              </div>

                              <div className="alarm-controls">
                                <span
                                  className={
                                    alarm.status === "active"
                                      ? "alarm-status active"
                                      : "alarm-status disabled"
                                  }
                                >
                                  {alarm.status === "active"
                                    ? "Aktif"
                                    : "Pasif"}
                                </span>

                                <button
                                  type="button"
                                  disabled={
                                    alarmChangingId ===
                                    alarm.id
                                  }
                                  onClick={() =>
                                    changeAlarmStatus(
                                      alarm
                                    )
                                  }
                                >
                                  {alarmChangingId ===
                                  alarm.id
                                    ? "..."
                                    : alarm.status ===
                                        "active"
                                      ? "Kapat"
                                      : "Aç"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {activeDetailTab === "notes" && (
                    <section className="detail-section">
                      {notesLoading ? (
                        <div className="detail-empty">
                          Not yükleniyor...
                        </div>
                      ) : (
                        <>
                          <textarea
                            className="notes-area"
                            value={notes}
                            readOnly={!notesEditing}
                            onChange={(event) =>
                              setNotes(
                                event.target.value
                              )
                            }
                            placeholder="Bu kayıt için not yazın..."
                          />

                          <div className="notes-actions">
                            {!notesEditing ? (
                              <button
                                type="button"
                                className="small-button"
                                onClick={() =>
                                  setNotesEditing(true)
                                }
                              >
                                Düzenle
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="small-button"
                                  disabled={notesSaving}
                                  onClick={saveNote}
                                >
                                  {notesSaving
                                    ? "Kaydediliyor..."
                                    : "Kaydet"}
                                </button>

                                {savedNotes && (
                                  <button
                                    type="button"
                                    className="small-button"
                                    disabled={notesSaving}
                                    onClick={() => {
                                      setNotes(
                                        savedNotes
                                      );
                                      setNotesEditing(
                                        false
                                      );
                                    }}
                                  >
                                    Vazgeç
                                  </button>
                                )}
                              </>
                            )}

                            {savedNotes && (
                              <button
                                type="button"
                                className="small-button danger-button"
                                disabled={notesSaving}
                                onClick={deleteNote}
                              >
                                Sil
                              </button>
                            )}
                          </div>

                          {notesError && (
                            <div className="save-error">
                              {notesError}
                            </div>
                          )}
                        </>
                      )}
                    </section>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </section>
      <LegalSessionControl />
      <LegalDock />
</main>
  );
}








































