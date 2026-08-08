"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PDFDocument } from "pdf-lib";

type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  risk?: string;
  source?: string;
  sourceId?: string;
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

type Theme = "dark" | "light";

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

  const [theme, setTheme] =
    useState<Theme>("dark");

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
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/calendar-events?from=${monthRange.first}&to=${monthRange.last}`,
        {
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
            "Takvim kayıtları alınamadı."
        );
      }

      const loadedEvents = data.events || [];

      setEvents(loadedEvents);

      if (loadedEvents.length > 0) {
        const firstEventDate =
          loadedEvents[0].startDate;

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
        }
      }
    } catch (loadError) {
      setEvents([]);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Takvim kayıtları alınamadı."
      );
    } finally {
      setLoading(false);
    }
  }, [monthRange.first, monthRange.last]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

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

    return map;
  }, [events]);

  const selectedEvents =
    eventsByDate.get(selectedDate) || [];

  const [selectedEventId, setSelectedEventId] =
    useState("");

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

  const selectedEvent =
    selectedEvents.find(
      (event) =>
        event.id === selectedEventId
    ) ||
    selectedEvents[0] ||
    null;

  const selectedRaw =
    getCalendarRaw(
      selectedEvent?.raw
    );

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
    async function loadAlarms() {
      if (!selectedEvent?.id) {
        setAlarms([]);
        setAlarmsError("");
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
          }
        );

        const data = await response.json();

        if (!response.ok || !data?.ok) {
          throw new Error(
            data?.error ||
              "Alarm kayıtları alınamadı."
          );
        }

        setAlarms(data.alarms || []);
      } catch (error) {
        setAlarms([]);

        setAlarmsError(
          error instanceof Error
            ? error.message
            : "Alarm kayıtları alınamadı."
        );
      } finally {
        setAlarmsLoading(false);
      }
    }

    loadAlarms();
  }, [selectedEvent?.id]);

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
      className={`lawyer-calendar ${theme}`}
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

        .lawyer-calendar.dark {
          --bg: #070b14;
          --surface: #0d1422;
          --surface-2: #111b2d;
          --surface-3: #162238;
          --border: #23324b;
          --text: #f7f8fb;
          --muted: #8797b0;
          --accent: #9b6dff;
          --accent-2: #4f8cff;
          --warning: #f2b84b;
          --success: #22d3a7;
          --danger: #ff5d73;
          --cyan: #31c8ff;
          --violet-soft: rgba(155, 109, 255, 0.16);
          --blue-soft: rgba(79, 140, 255, 0.14);
          --cyan-soft: rgba(49, 200, 255, 0.14);
          --danger-soft: rgba(255, 93, 115, 0.14);
          --shadow: rgba(0, 0, 0, 0.34);
          background:
            radial-gradient(
              circle at top left,
              rgba(79, 140, 255, 0.09),
              transparent 32%
            ),
            var(--bg);
          color: var(--text);
        }

        .lawyer-calendar.light {
          --bg: #f3f5f9;
          --surface: #ffffff;
          --surface-2: #f7f8fb;
          --surface-3: #edf1f7;
          --border: #dce2ec;
          --text: #172033;
          --muted: #66738a;
          --accent: #7656e8;
          --accent-2: #2f6fe4;
          --warning: #b87912;
          --success: #16866a;
          --danger: #d9435d;
          --cyan: #148ebc;
          --violet-soft: rgba(118, 86, 232, 0.10);
          --blue-soft: rgba(47, 111, 228, 0.09);
          --cyan-soft: rgba(20, 142, 188, 0.10);
          --danger-soft: rgba(217, 67, 93, 0.10);
          --shadow: rgba(35, 48, 76, 0.12);
          background: var(--bg);
          color: var(--text);
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
          min-height: 290px;
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
            height: 100vh;
            border: 0;
            border-radius: 0;
          }

          .topbar {
            min-height: 62px;
            padding: 10px 12px;
          }

          .brand-subtitle {
            display: none;
          }

          .brand-mark {
            width: 38px;
            height: 38px;
          }

          .action-button.labelled {
            display: none;
          }

          .main-grid {
            display: grid;
            grid-template-rows: 58% 42%;
            overflow: hidden;
          }

          .calendar-panel,
          .detail-panel {
            overflow: hidden;
            border-right: 0;
          }

          .calendar-panel {
            padding: 12px;
          }

          .detail-panel {
            padding: 10px 12px;
            border-top: 1px solid var(--border);
          }

          .calendar-toolbar {
            margin-bottom: 10px;
          }

          .month-title {
            min-width: 135px;
            font-size: 15px;
          }

          .day-cell {
            min-height: 58px;
            padding: 5px;
            border-radius: 10px;
          }

          .day-number {
            width: 23px;
            height: 23px;
            font-size: 10px;
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
      `}</style>

      <section className="workspace">
        <header className="topbar">
          <div className="brand">
            <div className="brand-copy">
              <div className="brand-kicker">
                AL METHER
              </div>

              <h1 className="brand-title">
                METHER LEGAL
              </h1>

              <p className="brand-subtitle">
                Hukuk çalışma masası
              </p>
            </div>
          </div>

          <div className="top-actions">
            <button
              type="button"
              className="action-button labelled"
              onClick={loadEvents}
            >
              Yenile
            </button>

            <button
              type="button"
              className="action-button"
              onClick={() =>
                setTheme(
                  theme === "dark"
                    ? "light"
                    : "dark"
                )
              }
            >
              {theme === "dark"
                ? "Açık"
                : "Koyu"}
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
                      onClick={() =>
                        setSelectedDate(date)
                      }
                    >
                      <span className="day-number">
                        {day}
                      </span>

                        <span className="event-dots">
                          {dayEvents.length > 0 && (
                            <>
                              <span
                                className={`event-chip ${getEventKind(
                                  dayEvents[0]
                                )}`}
                              >
                                {dayEvents[0].title}
                              </span>

                              {dayEvents.length > 1 && (
                                <span className="event-count-chip">
                                  +{dayEvents.length - 1} kayıt
                                </span>
                              )}
                            </>
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
          </section>

          <aside className="detail-panel">
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
                            {selectedEvent.source ||
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
                      {alarmsLoading ? (
                        <div className="detail-empty">
                          Alarm kayıtları yükleniyor...
                        </div>
                      ) : alarmsError ? (
                        <div className="detail-empty">
                          {alarmsError}
                        </div>
                      ) : alarms.length === 0 ? (
                        <div className="detail-empty">
                          Bu kayıt için alarm planı bulunmuyor.
                        </div>
                      ) : (
                        <div className="alarm-list">
                          {alarms.map((alarm) => (
                            <div
                              key={alarm.id}
                              className="alarm-item"
                            >
                              <div>
                                <strong>
                                  {alarm.message}
                                </strong>

                                <span>
                                  {new Date(
                                    alarm.alarm_time
                                  ).toLocaleString(
                                    "tr-TR"
                                  )}
                                </span>
                              </div>

                              <span className="alarm-status">
                                {alarm.status}
                              </span>
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
    </main>
  );
}























