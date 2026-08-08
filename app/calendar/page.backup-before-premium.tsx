"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

  const [checklist, setChecklist] =
    useState({
      mailRead: false,
      noticeReviewed: false,
      caseOpened: false,
      deadlineChecked: false,
      completed: false,
    });

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

  const selectedEvent =
    selectedEvents[0] || null;

  const selectedRaw =
    getCalendarRaw(
      selectedEvent?.raw
    );

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
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
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
          width: min(1500px, 100%);
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
          gap: 12px;
          min-width: 0;
        }

        .brand-mark {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background:
            linear-gradient(
              145deg,
              var(--accent-2),
              var(--accent)
            );
          color: white;
          font-weight: 900;
          font-size: 18px;
          box-shadow:
            0 10px 28px
            rgba(98, 94, 239, 0.28);
        }

        .brand-title {
          margin: 0;
          font-size: 15px;
          letter-spacing: 0.08em;
          font-weight: 900;
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
          padding: 14px 18px;
          border-right: 1px solid var(--border);
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          min-width: 0;
        }

        .detail-panel {
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
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
          min-height: 0;
          padding: 9px;
          border: 1px solid var(--border);
          border-radius: 13px;
          background: var(--surface-2);
          color: var(--text);
          text-align: left;
          cursor: pointer;
          overflow: hidden;
        }

        .day-cell:hover {
          border-color: var(--accent-2);
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
          width: 27px;
          height: 27px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 850;
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

        .event-chip {
          overflow: hidden;
          padding: 4px 6px;
          border-radius: 7px;
          background: var(--surface-3);
          color: var(--muted);
          font-size: 9px;
          font-weight: 750;
          text-overflow: ellipsis;
          white-space: nowrap;
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
          margin: 0 0 16px;
          font-size: 17px;
          line-height: 1.35;
        }

        .detail-list {
          min-height: 0;
          display: grid;
          gap: 10px;
          overflow: hidden;
        }

        .detail-tabs {
          display: flex;
          gap: 5px;
          margin: 8px 0 10px;
          overflow: hidden;
          flex: 0 0 auto;
        }

        .detail-tab {
          min-width: 0;
          flex: 1;
          height: 30px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
          color: var(--muted);
          cursor: pointer;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
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
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
          font-size: 10px;
        }

        .detail-row span {
          color: var(--muted);
        }

        .detail-row strong {
          max-width: 65%;
          text-align: right;
          color: var(--text);
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
          gap: 8px;
          min-height: 0;
          overflow: hidden;
        }

        .mail-summary {
          padding: 9px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface-2);
        }

        .mail-summary span {
          color: var(--accent-2);
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .mail-summary p {
          margin: 6px 0 0;
          color: var(--muted);
          font-size: 10px;
          line-height: 1.45;
        }

        .mail-body {
          max-height: 185px;
          overflow: hidden;
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface-2);
          color: var(--muted);
          font-size: 10px;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
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
          color: var(--accent-2);
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .event-title {
          margin: 7px 0 0;
          font-size: 13px;
          font-weight: 850;
          line-height: 1.4;
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
            <div className="brand-mark">
              ML
            </div>

            <div>
              <h1 className="brand-title">
                METHER LAWYER
              </h1>

              <p className="brand-subtitle">
                Hukuk çalışma takvimi
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
                        {dayEvents
                          .slice(0, 3)
                          .map((event) => (
                            <span
                              key={event.id}
                              className={`event-chip ${getEventKind(
                                event
                              )}`}
                            >
                              {event.title}
                            </span>
                          ))}
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
                      <div className="detail-empty">
                        Bu kayda ait ek bulunmuyor.
                      </div>
                    </section>
                  )}

                  {activeDetailTab === "checklist" && (
                    <section className="detail-section">
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
                              checked={
                                checklist[
                                  key as keyof typeof checklist
                                ]
                              }
                              onChange={(event) =>
                                setChecklist((current) => ({
                                  ...current,
                                  [key]:
                                    event.target.checked,
                                }))
                              }
                            />

                            {label}
                          </label>
                        ))}
                      </div>
                    </section>
                  )}

                  {activeDetailTab === "alarm" && (
                    <section className="detail-section">
                      <div className="detail-empty">
                        Bu kayıt için alarm planı bulunmuyor.
                      </div>
                    </section>
                  )}

                  {activeDetailTab === "notes" && (
                    <section className="detail-section">
                      <textarea
                        className="notes-area"
                        value={notes}
                        onChange={(event) =>
                          setNotes(event.target.value)
                        }
                        placeholder="Bu kayıt için not yazın..."
                      />
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







