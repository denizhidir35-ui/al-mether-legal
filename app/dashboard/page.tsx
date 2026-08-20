"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  FolderOpen,
  Gavel,
  Mail,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import LegalBrand from "@/components/LegalBrand";
import LegalDock from "@/components/LegalDock";

type DashboardItem = {
  id: string;
  caseId: string;
  title: string;
  description: string;
  date: string;
  time: string;
  priority: string;
  eventType: string;
  category: "hearing" | "expert" | "petition" | "notice" | "deadline" | "task";
  source: string;
};

type DashboardDocument = {
  id: string;
  caseId: string;
  fileName: string;
  documentType: string;
  createdAt: string;
};

type DashboardCase = {
  case_type?: string | null;
  status?: string | null;
};

type CaseTypeCount = {
  type: string;
  filter: string;
  count: number;
};

type InlineSearchData = {
  cases: Array<{
    id: string;
    case_number?: string | null;
    court_name?: string | null;
    case_title?: string | null;
    case_type?: string | null;
  }>;
  mails: Array<{
    id: string;
    case_id?: string | null;
    subject?: string | null;
    sender?: string | null;
  }>;
  documents: Array<{
    id: string;
    case_id?: string | null;
    file_name?: string | null;
    document_type?: string | null;
  }>;
  events: Array<{
    id: string;
    title?: string | null;
    due_date?: string | null;
    event_type?: string | null;
  }>;
  alarms: Array<{
    id: string;
    case_id?: string | null;
    calendar_event_id?: string | null;
    message?: string | null;
    alarm_time?: string | null;
  }>;
};

const EMPTY_SEARCH: InlineSearchData = {
  cases: [],
  mails: [],
  documents: [],
  events: [],
  alarms: [],
};

const UNCLASSIFIED_CASE_TYPE = "__unclassified__";

type DashboardData = {
  ok: boolean;
  error?: string;
  stats: {
    activeCases: number;
    criticalCases: number;
    criticalToday: number;
    todayDeadlines: number;
    todayHearings: number;
    upcomingDeadlines: number;
    newNotices: number;
  };
  dailyPlan: DashboardItem[];
  timeline: DashboardItem[];
  incoming: DashboardItem[];
  documents: DashboardDocument[];
};

const EMPTY_DATA: DashboardData = {
  ok: true,
  stats: {
    activeCases: 0,
    criticalCases: 0,
    criticalToday: 0,
    todayDeadlines: 0,
    todayHearings: 0,
    upcomingDeadlines: 0,
    newNotices: 0,
  },
  dailyPlan: [],
  timeline: [],
  incoming: [],
  documents: [],
};

const categoryMeta = {
  hearing: { label: "Duruşma", icon: Gavel, tone: "blue" },
  expert: { label: "Bilirkişi", icon: BriefcaseBusiness, tone: "amber" },
  petition: { label: "Dilekçe", icon: FileText, tone: "violet" },
  notice: { label: "Tebligat", icon: Mail, tone: "cyan" },
  deadline: { label: "Son gün", icon: AlertTriangle, tone: "red" },
  task: { label: "İş", icon: Clock3, tone: "green" },
} as const;

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", options || {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function normalizeCaseTypeKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [caseTypes, setCaseTypes] = useState<CaseTypeCount[]>([]);
  const [caseTypesTotal, setCaseTypesTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchData, setSearchData] = useState<InlineSearchData>(EMPTY_SEARCH);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationReadIds, setNotificationReadIds] = useState<Set<string>>(
    new Set()
  );
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notificationBoxRef = useRef<HTMLDivElement>(null);
  const searchRequestRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const [response, casesResponse] = await Promise.all([
          fetch("/api/dashboard-v2", { cache: "no-store" }),
          fetch("/api/cases", { cache: "no-store" }),
        ]);
        const [payload, casesPayload] = await Promise.all([
          response.json() as Promise<DashboardData>,
          casesResponse.json() as Promise<{ cases?: DashboardCase[]; error?: string }>,
        ]);

        if (!response.ok || payload.ok !== true) {
          throw new Error(payload.error || "Dashboard verileri yüklenemedi.");
        }

        if (!casesResponse.ok) {
          throw new Error(casesPayload.error || "Dava dağılımı yüklenemedi.");
        }

        if (active) {
          const activeCases = (casesPayload.cases || []).filter(
            (legalCase) => legalCase.status === "active"
          );
          const grouped = new Map<
            string,
            { count: number; variants: Map<string, number> }
          >();

          for (const legalCase of activeCases) {
            const caseType = legalCase.case_type?.trim() || "";
            const key = caseType
              ? normalizeCaseTypeKey(caseType)
              : UNCLASSIFIED_CASE_TYPE;
            const current = grouped.get(key) || {
              count: 0,
              variants: new Map<string, number>(),
            };
            current.count += 1;
            if (caseType) {
              current.variants.set(
                caseType,
                (current.variants.get(caseType) || 0) + 1
              );
            }
            grouped.set(key, current);
          }

          setData(payload);
          setCaseTypesTotal(activeCases.length);
          setCaseTypes(
            Array.from(grouped, ([key, group]) => {
              const type = key === UNCLASSIFIED_CASE_TYPE
                ? "Türü belirtilmemiş"
                : Array.from(group.variants)
                    .sort(
                      ([leftLabel, leftCount], [rightLabel, rightCount]) =>
                        rightCount - leftCount ||
                        leftLabel.localeCompare(rightLabel, "tr")
                    )[0]?.[0] || key;

              return {
                type,
                filter: key === UNCLASSIFIED_CASE_TYPE ? key : type,
                count: group.count,
              };
            })
              .sort(
                (left, right) =>
                  right.count - left.count || left.type.localeCompare(right.type, "tr")
              )
          );
        }
      } catch (loadError: unknown) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Dashboard verileri yüklenemedi."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const executeSearch = useCallback(async (value: string) => {
    const query = value.trim();

    if (query.length < 2) {
      searchRequestIdRef.current += 1;
      searchRequestRef.current?.abort();
      setSearchData(EMPTY_SEARCH);
      setSearchOpen(false);
      setSearchError("");
      return;
    }

    searchRequestRef.current?.abort();
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    const controller = new AbortController();
    searchRequestRef.current = controller;
    setSearchLoading(true);
    setSearchError("");
    setSearchOpen(true);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as InlineSearchData & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Arama yapılamadı.");
      }

      if (searchRequestIdRef.current !== requestId) return;

      setSearchData({
        cases: payload.cases || [],
        mails: payload.mails || [],
        documents: payload.documents || [],
        events: payload.events || [],
        alarms: payload.alarms || [],
      });
    } catch (requestError: unknown) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        return;
      }

      if (searchRequestIdRef.current === requestId) {
        setSearchError(
          requestError instanceof Error ? requestError.message : "Arama yapılamadı."
        );
        setSearchData(EMPTY_SEARCH);
      }
    } finally {
      if (searchRequestRef.current === controller) {
        setSearchLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();

    if (query.length < 2) {
      searchRequestIdRef.current += 1;
      searchRequestRef.current?.abort();
      setSearchData(EMPTY_SEARCH);
      setSearchOpen(false);
      setSearchError("");
      setSearchLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void executeSearch(query);
    }, 260);

    return () => window.clearTimeout(timeoutId);
  }, [executeSearch, searchQuery]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("tr-TR") === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        if (searchQuery.trim().length >= 2) setSearchOpen(true);
        return;
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    }

    function handleOutsidePointer(event: MouseEvent) {
      if (!searchBoxRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleOutsidePointer);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsidePointer);
      searchRequestRef.current?.abort();
    };
  }, [searchQuery]);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem("legal-notification-read") || "[]"
      );
      setNotificationReadIds(
        new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : [])
      );
    } catch {
      setNotificationReadIds(new Set());
    }

    function closeNotifications(event: MouseEvent) {
      if (!notificationBoxRef.current?.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
    }

    function closeNotificationsWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setNotificationOpen(false);
    }

    document.addEventListener("mousedown", closeNotifications);
    window.addEventListener("keydown", closeNotificationsWithEscape);

    return () => {
      document.removeEventListener("mousedown", closeNotifications);
      window.removeEventListener("keydown", closeNotificationsWithEscape);
    };
  }, []);

  const searchResultCount = useMemo(
    () =>
      searchData.cases.length +
      searchData.mails.length +
      searchData.documents.length +
      searchData.events.length +
      searchData.alarms.length,
    [searchData]
  );

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        weekday: "long",
      }).format(new Date()),
    []
  );

  const notifications = useMemo(() => {
    const unique = new Map<string, DashboardItem>();

    for (const item of [...data.incoming, ...data.dailyPlan, ...data.timeline]) {
      if (!unique.has(item.id)) unique.set(item.id, item);
    }

    return Array.from(unique.values()).slice(0, 12).map((item) => {
      const isMail = item.eventType === "mail_received";
      const isCaseNotice =
        item.eventType === "deemed_service" ||
        item.eventType === "notification_review";
      const href = isMail
        ? "/inbox"
        : isCaseNotice && item.caseId
          ? `/cases?case=${encodeURIComponent(item.caseId)}`
          : `/calendar?event=${encodeURIComponent(item.id)}`;

      return {
        ...item,
        href,
        displayTime: item.time
          ? `${formatDate(item.date)} · ${item.time}`
          : formatDate(item.date),
      };
    });
  }, [data.dailyPlan, data.incoming, data.timeline]);

  const notificationUnreadCount = notifications.filter(
    (item) => !notificationReadIds.has(item.id)
  ).length;

  function markNotificationRead(id: string) {
    setNotificationReadIds((current) => {
      const next = new Set(current);
      next.add(id);
      window.localStorage.setItem("legal-notification-read", JSON.stringify([...next]));
      return next;
    });
    setNotificationOpen(false);
  }

  const summary = [
    {
      label: "Kritik / Son Gün",
      value: data.stats.todayDeadlines + data.stats.criticalToday,
      note: `${data.stats.criticalCases} kritik dava`,
      icon: AlertTriangle,
      tone: "red",
      href: "/calendar",
    },
    {
      label: "Bugünkü Duruşmalar",
      value: data.stats.todayHearings,
      note: "Bugünün takvimi",
      icon: Gavel,
      tone: "blue",
      href: "/calendar",
    },
    {
      label: "Yaklaşan Son Günler",
      value: data.stats.upcomingDeadlines,
      note: "Önümüzdeki 7 gün",
      icon: CalendarDays,
      tone: "amber",
      href: "/calendar",
    },
  ];

  const distributionCount = caseTypes.reduce(
    (total, item) => total + item.count,
    0
  );

  return (
    <main className="legal-app dashboard-page">
      <section className="dashboard-shell">
        <header className="dashboard-header">
          <Link href="/" className="brand-link" aria-label="AL METHER Legal ana sayfa">
            <LegalBrand />
          </Link>

          <div className="dashboard-search" ref={searchBoxRef}>
            <div className="global-search">
              <Search size={17} />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2) setSearchOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void executeSearch(searchQuery);
                  }
                }}
                placeholder="Evrak, dava, kişi ara..."
                aria-label="Global arama"
              />
              <kbd>Ctrl K</kbd>
            </div>

            {searchOpen && searchQuery.trim().length >= 2 && (
              <div className="search-overlay" role="dialog" aria-label="Arama sonuçları">
                {searchLoading ? (
                  <div className="search-state">Aranıyor...</div>
                ) : searchError ? (
                  <div className="search-state error">{searchError}</div>
                ) : searchResultCount === 0 ? (
                  <div className="search-state">Sonuç bulunamadı.</div>
                ) : (
                  <div className="search-groups">
                    {searchData.cases.length > 0 && (
                      <InlineSearchGroup title="Davalar">
                        {searchData.cases.map((item) => (
                          <Link
                            href={`/cases?case=${encodeURIComponent(item.id)}`}
                            className="search-result-row"
                            key={`case-${item.id}`}
                          >
                            <BriefcaseBusiness size={15} />
                            <span><strong>{item.case_title || item.case_number || "Dava"}</strong><small>{item.court_name || "Mahkeme bilgisi yok"} · {item.case_number || "Dosya no yok"}</small></span>
                            <ChevronRight size={14} />
                          </Link>
                        ))}
                      </InlineSearchGroup>
                    )}

                    {searchData.mails.length > 0 && (
                      <InlineSearchGroup title="Mailler">
                        {searchData.mails.map((item) => (
                          <Link
                            href={item.case_id ? `/cases?case=${encodeURIComponent(item.case_id)}` : "/inbox"}
                            className="search-result-row"
                            key={`mail-${item.id}`}
                          >
                            <Mail size={15} />
                            <span><strong>{item.subject || "Başlıksız mail"}</strong><small>{item.sender || "Gönderen bilgisi yok"}</small></span>
                            <ChevronRight size={14} />
                          </Link>
                        ))}
                      </InlineSearchGroup>
                    )}

                    {searchData.documents.length > 0 && (
                      <InlineSearchGroup title="Belgeler">
                        {searchData.documents.map((item) => (
                          <Link
                            href={item.case_id ? `/cases?case=${encodeURIComponent(item.case_id)}` : "/converter"}
                            className="search-result-row"
                            key={`document-${item.id}`}
                          >
                            <FileText size={15} />
                            <span><strong>{item.file_name || "Belge"}</strong><small>{item.document_type || "Belge türü yok"}</small></span>
                            <ChevronRight size={14} />
                          </Link>
                        ))}
                      </InlineSearchGroup>
                    )}

                    {searchData.events.length > 0 && (
                      <InlineSearchGroup title="Takvim">
                        {searchData.events.map((item) => (
                          <Link
                            href={`/calendar?event=${encodeURIComponent(item.id)}`}
                            className="search-result-row"
                            key={`event-${item.id}`}
                          >
                            <CalendarDays size={15} />
                            <span><strong>{item.title || "Takvim kaydı"}</strong><small>{item.due_date || "Tarih yok"} · {item.event_type || "Takvim"}</small></span>
                            <ChevronRight size={14} />
                          </Link>
                        ))}
                      </InlineSearchGroup>
                    )}

                    {searchData.alarms.length > 0 && (
                      <InlineSearchGroup title="Alarmlar">
                        {searchData.alarms.map((item) => {
                          const href = item.calendar_event_id
                            ? `/calendar?event=${encodeURIComponent(item.calendar_event_id)}`
                            : item.case_id
                              ? `/cases?case=${encodeURIComponent(item.case_id)}`
                              : "/calendar";
                          return (
                            <Link href={href} className="search-result-row" key={`alarm-${item.id}`}>
                              <Bell size={15} />
                              <span><strong>{item.message || "Alarm"}</strong><small>{item.alarm_time || "Zaman bilgisi yok"}</small></span>
                              <ChevronRight size={14} />
                            </Link>
                          );
                        })}
                      </InlineSearchGroup>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="header-actions">
            <Link href="/cases" className="import-action">
              <Upload size={16} />
              İçe Aktar
            </Link>
            <div className="notification-box" ref={notificationBoxRef}>
              <button
                type="button"
                className="icon-action"
                aria-label="Bildirimler"
                aria-expanded={notificationOpen}
                onClick={() => setNotificationOpen((open) => !open)}
              >
                <Bell size={18} />
                {notificationUnreadCount > 0 && (
                  <span className="notification-dot">{notificationUnreadCount}</span>
                )}
              </button>

              {notificationOpen && (
                <div className="notification-popover" role="dialog" aria-label="Bildirimler">
                  <div className="notification-head">
                    <strong>Bildirimler</strong>
                    <span>{notificationUnreadCount} okunmamış</span>
                  </div>

                  <div className="notification-list">
                    {notifications.length === 0 ? (
                      <div className="notification-empty">Yeni bildirim bulunmuyor.</div>
                    ) : (
                      notifications.map((item) => {
                        const meta = categoryMeta[item.category];
                        const Icon = meta.icon;
                        const unread = !notificationReadIds.has(item.id);

                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            className={`notification-row ${unread ? "unread" : ""}`}
                            onClick={() => markNotificationRead(item.id)}
                          >
                            <span className={`notification-icon ${meta.tone}`}>
                              <Icon size={14} />
                            </span>
                            <span className="notification-copy">
                              <strong>{item.title}</strong>
                              <small>{item.displayTime}</small>
                            </span>
                            {unread && <span className="unread-dot" aria-label="Okunmamış" />}
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="header-date">
              <CalendarDays size={16} />
              <span>{todayLabel}</span>
            </div>
          </div>
        </header>

        <div className="dashboard-body">
          <section className="summary-grid" aria-label="Günlük özet">
            {summary.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} href={item.href} className={`summary-card ${item.tone}`}>
                  <span className="summary-icon"><Icon size={19} /></span>
                  <span className="summary-copy">
                    <span>{item.label}</span>
                    <strong>{loading ? "—" : item.value}</strong>
                    <small>{item.note}</small>
                  </span>
                  <ChevronRight size={16} className="summary-arrow" />
                </Link>
              );
            })}

            <section className="distribution-summary" aria-label="Dava Dağılımı">
              <div className="distribution-heading">
                <span className="distribution-heading-copy">
                  <strong>Dava Dağılımı</strong>
                  <small>{distributionCount} / {caseTypesTotal} dağılıma dahil</small>
                </span>
                <span className="case-total">{caseTypesTotal} aktif</span>
              </div>

              {caseTypes.length === 0 && !loading ? (
                <div className="distribution-empty">Aktif dava türü bulunmuyor.</div>
              ) : (
                <>
                  <div className="distribution-track" aria-label="Dava türü segmentleri">
                    {caseTypes.map((item, index) => (
                      <Link
                        href={`/cases?type=${encodeURIComponent(item.filter)}`}
                        className={`distribution-segment segment-tone-${index % 6}`}
                        style={{ width: `${caseTypesTotal ? (item.count / caseTypesTotal) * 100 : 0}%` }}
                        title={`${item.type}: ${item.count}`}
                        aria-label={`${item.type}: ${item.count}`}
                        key={`segment-${item.filter}`}
                      />
                    ))}
                  </div>

                  <div
                    className="distribution-legends"
                    onWheel={(event) => {
                      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                        event.currentTarget.scrollLeft += event.deltaY;
                      }
                    }}
                  >
                    {caseTypes.map((item) => (
                      <Link
                        href={`/cases?type=${encodeURIComponent(item.filter)}`}
                        className="distribution-pill"
                        key={`legend-${item.filter}`}
                      >
                        <span className={`legend-dot segment-tone-${caseTypes.indexOf(item) % 6}`} />
                        <span>{item.type}</span>
                        <strong>{item.count}</strong>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </section>
          </section>

          {error && (
            <div className="dashboard-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
                <RefreshCw size={14} /> Yenile
              </button>
            </div>
          )}

          <div className="workspace-grid">
            <section className="plan-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">GÜNLÜK AKIŞ</span>
                  <h1>Bugünkü İş Planınız</h1>
                </div>
                <Link href="/calendar">Takvimi aç <ChevronRight size={15} /></Link>
              </div>

              <div className="plan-list">
                {loading ? (
                  <div className="empty-state">Günün işleri yükleniyor...</div>
                ) : data.dailyPlan.length === 0 ? (
                  <div className="empty-state">
                    <CalendarDays size={24} />
                    <strong>Bugün için kayıtlı iş bulunmuyor.</strong>
                    <span>Yeni iş ve süreler takvim kayıtlarından burada görünür.</span>
                  </div>
                ) : (
                  data.dailyPlan.map((item) => {
                    const meta = categoryMeta[item.category] || categoryMeta.task;
                    const Icon = meta.icon;
                    return (
                      <Link href={`/calendar?event=${encodeURIComponent(item.id)}`} className="plan-row" key={item.id}>
                        <div className="plan-time">
                          <strong>{item.time || "Tüm gün"}</strong>
                          <span>{formatDate(item.date, { day: "2-digit", month: "short" })}</span>
                        </div>
                        <span className={`plan-icon ${meta.tone}`}><Icon size={18} /></span>
                        <div className="plan-copy">
                          <div className="plan-labels">
                            <span className={`category-badge ${meta.tone}`}>{meta.label}</span>
                            {["critical", "high", "important"].includes(item.priority) && (
                              <span className="priority-badge">Kritik</span>
                            )}
                          </div>
                          <strong>{item.title}</strong>
                          {item.description && <span>{item.description}</span>}
                        </div>
                        <ChevronRight size={17} />
                      </Link>
                    );
                  })
                )}
              </div>

              <div className="upcoming-strip">
                <div className="upcoming-title">
                  <Clock3 size={16} />
                  <strong>Yaklaşan 7 Gün</strong>
                </div>
                <div className="upcoming-items">
                  {data.timeline.length === 0 && !loading ? (
                    <span className="muted-line">Yaklaşan kayıt bulunmuyor.</span>
                  ) : (
                    data.timeline.slice(0, 4).map((item) => (
                      <Link href={`/calendar?event=${encodeURIComponent(item.id)}`} key={item.id}>
                        <span>{formatDate(item.date)}</span>
                        <strong>{item.title}</strong>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </section>

            <aside className="side-column">
              <section className="side-card incoming-card">
                <div className="side-heading">
                  <h2>Yeni Gelenler</h2>
                  <Link href="/inbox">Tümü <ChevronRight size={14} /></Link>
                </div>
                <div className="compact-list">
                  {data.incoming.length === 0 && !loading ? (
                    <div className="compact-empty">Yeni gelen kayıt bulunmuyor.</div>
                  ) : (
                    data.incoming.map((item) => (
                      <Link href={`/calendar?event=${encodeURIComponent(item.id)}`} key={item.id} className="compact-row">
                        <span className="compact-icon cyan"><Mail size={15} /></span>
                        <span><strong>{item.title}</strong><small>{formatDate(item.date)}</small></span>
                        <ChevronRight size={14} />
                      </Link>
                    ))
                  )}
                </div>
              </section>

              <section className="side-card quick-card">
                <div className="side-heading"><h2>Hızlı İşlemler</h2></div>
                <div className="quick-grid">
                  <Link href="/cases"><BriefcaseBusiness size={17} /><span>Yeni Dava</span></Link>
                  <Link href="/calendar"><CalendarDays size={17} /><span>Takvime Ekle</span></Link>
                  <Link href="/converter"><Upload size={17} /><span>Belge Yükle</span></Link>
                  <Link href="/inbox"><Mail size={17} /><span>Mail</span></Link>
                </div>
              </section>

              <section className="side-card documents-card">
                <div className="side-heading">
                  <h2>Son Belgeler</h2>
                  <Link href="/converter">Tümü <ChevronRight size={14} /></Link>
                </div>
                <div className="compact-list">
                  {data.documents.length === 0 && !loading ? (
                    <div className="compact-empty">Henüz belge kaydı bulunmuyor.</div>
                  ) : (
                    data.documents.map((document) => (
                      <Link
                        href={document.caseId ? `/cases?case=${encodeURIComponent(document.caseId)}` : "/cases"}
                        key={document.id}
                        className="compact-row"
                      >
                        <span className="compact-icon amber"><FileText size={15} /></span>
                        <span><strong>{document.fileName}</strong><small>{document.documentType} · {formatTimestamp(document.createdAt)}</small></span>
                        <ChevronRight size={14} />
                      </Link>
                    ))
                  )}
                </div>
              </section>
            </aside>
          </div>

          <footer className="dashboard-footer">
            <span><FolderOpen size={14} /> {data.stats.activeCases} aktif dava</span>
            <span>Veriler mevcut dava, takvim ve belge kayıtlarından gösterilir.</span>
          </footer>
        </div>
      </section>

      <LegalDock />

      <style jsx global>{`
        .dashboard-page { min-height: 100vh; padding: 10px 68px 10px 10px; }
        .dashboard-shell { position: relative; z-index: 1; max-width: 1680px; height: calc(100vh - 28px); min-height: 720px; margin: 0 auto; overflow: hidden; border: 1px solid var(--legal-border); border-radius: 24px; background: color-mix(in srgb, var(--legal-surface) 94%, transparent); box-shadow: var(--legal-shadow-md); backdrop-filter: blur(24px); }
        .dashboard-header { min-height: 64px; display: grid; grid-template-columns: 205px minmax(260px, 580px) 1fr; align-items: center; gap: 18px; padding: 9px 18px; border-bottom: 1px solid var(--legal-border); }
        .brand-link { color: inherit; text-decoration: none; }
        .dashboard-search { position: relative; min-width: 0; }
        .global-search { height: 40px; display: flex; align-items: center; gap: 9px; padding: 0 11px; border: 1px solid var(--legal-border); border-radius: 12px; background: var(--legal-surface-2); color: var(--legal-muted); }
        .global-search:focus-within { border-color: var(--legal-gold); box-shadow: 0 0 0 3px var(--legal-gold-soft); }
        .global-search input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--legal-text); font: inherit; font-size: 12px; }
        .global-search input::placeholder { color: var(--legal-muted); }
        .global-search kbd { padding: 4px 7px; border: 1px solid var(--legal-border); border-radius: 7px; background: var(--legal-surface); color: var(--legal-muted); font: inherit; font-size: 9px; }
        .search-overlay { position: absolute; top: calc(100% + 7px); right: 0; left: 0; z-index: 100; max-height: 410px; overflow-y: auto; border: 1px solid var(--legal-border); border-radius: 14px; background: color-mix(in srgb, var(--legal-surface) 97%, transparent); box-shadow: 0 20px 48px rgba(24, 20, 15, .18); backdrop-filter: blur(22px); scrollbar-width: thin; scrollbar-color: var(--legal-border-strong) transparent; }
        .search-overlay::-webkit-scrollbar { width: 5px; }
        .search-overlay::-webkit-scrollbar-thumb { border-radius: 999px; background: var(--legal-border-strong); }
        .search-state { padding: 22px 16px; color: var(--legal-muted); font-size: 10px; text-align: center; }
        .search-state.error { color: var(--legal-danger); }
        .search-groups { padding: 5px; }
        .inline-search-group + .inline-search-group { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--legal-border); }
        .inline-search-title { display: block; padding: 6px 8px 4px; color: var(--legal-muted); font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
        .search-result-row { min-height: 46px; display: grid; grid-template-columns: 24px minmax(0, 1fr) 14px; align-items: center; gap: 7px; padding: 6px 8px; border-radius: 9px; color: var(--legal-text); text-decoration: none; }
        .search-result-row:hover { background: var(--legal-surface-2); }
        .search-result-row > svg { color: var(--legal-gold-dark); }
        .search-result-row > span { min-width: 0; display: grid; gap: 2px; }
        .search-result-row strong, .search-result-row small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .search-result-row strong { font-size: 9px; }
        .search-result-row small { color: var(--legal-muted); font-size: 8px; }
        .header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 9px; }
        .import-action, .icon-action { height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--legal-border); border-radius: 11px; background: var(--legal-surface); color: var(--legal-text-soft); text-decoration: none; font-size: 10px; font-weight: 750; }
        .import-action { padding: 0 13px; }
        .icon-action { position: relative; width: 36px; padding: 0; cursor: pointer; }
        .notification-dot { position: absolute; top: -5px; right: -5px; min-width: 17px; height: 17px; display: grid; padding: 0 4px; border: 2px solid var(--legal-surface); border-radius: 9px; background: var(--legal-danger); color: #fff; place-items: center; font-size: 8px; font-weight: 900; }
        .notification-box { position: relative; }
        .notification-popover { position: absolute; top: calc(100% + 8px); right: 0; z-index: 110; width: min(340px, calc(100vw - 32px)); overflow: hidden; border: 1px solid var(--legal-border); border-radius: 14px; background: color-mix(in srgb, var(--legal-surface) 97%, transparent); box-shadow: 0 20px 48px rgba(24, 20, 15, .2); backdrop-filter: blur(22px); }
        .notification-head { min-height: 42px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 11px; border-bottom: 1px solid var(--legal-border); }
        .notification-head strong { font-size: 10px; }
        .notification-head span { color: var(--legal-muted); font-size: 8px; }
        .notification-list { max-height: 330px; overflow-y: auto; padding: 5px; scrollbar-width: thin; scrollbar-color: var(--legal-border-strong) transparent; }
        .notification-row { min-height: 47px; display: grid; grid-template-columns: 28px minmax(0, 1fr) 8px; align-items: center; gap: 8px; padding: 6px 7px; border-radius: 9px; color: var(--legal-text); text-decoration: none; }
        .notification-row:hover { background: var(--legal-surface-2); }
        .notification-row.unread { background: color-mix(in srgb, var(--legal-gold-soft) 62%, transparent); }
        .notification-row.unread:hover { background: var(--legal-gold-soft); }
        .notification-icon { width: 28px; height: 28px; display: grid; border-radius: 9px; background: var(--legal-surface-2); color: var(--legal-muted); place-items: center; }
        .notification-icon.red { color: var(--legal-danger); background: color-mix(in srgb, var(--legal-danger) 9%, var(--legal-surface)); }
        .notification-icon.blue { color: #3984c9; background: rgba(58, 133, 206, .09); }
        .notification-icon.amber { color: var(--legal-warning); background: color-mix(in srgb, var(--legal-warning) 10%, var(--legal-surface)); }
        .notification-icon.cyan { color: #168e94; background: rgba(22, 142, 148, .09); }
        .notification-copy { min-width: 0; display: grid; gap: 3px; }
        .notification-copy strong, .notification-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .notification-copy strong { font-size: 9px; }
        .notification-copy small { color: var(--legal-muted); font-size: 8px; }
        .unread-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--legal-gold); }
        .notification-empty { padding: 22px 12px; color: var(--legal-muted); font-size: 9px; text-align: center; }
        .header-date { display: flex; align-items: center; gap: 7px; margin-left: 4px; color: var(--legal-muted); font-size: 10px; text-transform: capitalize; }
        .dashboard-body { padding: 14px 16px 10px; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 1.75fr); gap: 8px; }
        .summary-card { min-height: 64px; display: flex; align-items: center; gap: 9px; padding: 8px 10px; border: 1px solid var(--legal-border); border-radius: 14px; background: var(--legal-surface); color: var(--legal-text); text-decoration: none; transition: transform 140ms ease, border-color 140ms ease; }
        .summary-card:hover { transform: translateY(-2px); border-color: var(--legal-border-strong); }
        .summary-icon, .plan-icon, .compact-icon { flex: 0 0 auto; display: grid; border-radius: 11px; place-items: center; }
        .summary-icon { width: 30px; height: 30px; border-radius: 9px; }
        .summary-icon svg { width: 16px; height: 16px; }
        .summary-copy { min-width: 0; display: grid; gap: 2px; }
        .summary-copy > span { color: var(--legal-text-soft); font-size: 9px; font-weight: 750; }
        .summary-copy strong { font-size: 17px; line-height: 1; }
        .summary-copy small { color: var(--legal-muted); font-size: 8px; }
        .summary-arrow { margin-left: auto; color: var(--legal-muted); }
        .distribution-summary { min-width: 0; min-height: 64px; display: grid; align-content: center; gap: 6px; padding: 7px 11px; border: 1px solid var(--legal-border); border-radius: 14px; background: var(--legal-surface); }
        .distribution-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .distribution-heading-copy { min-width: 0; display: flex; align-items: baseline; gap: 7px; }
        .distribution-heading-copy strong { color: var(--legal-text-soft); font-size: 9px; }
        .distribution-heading-copy small { color: var(--legal-muted); font-size: 7px; font-weight: 700; white-space: nowrap; }
        .distribution-track { height: 7px; display: flex; overflow: hidden; border-radius: 999px; background: var(--legal-surface-2); }
        .distribution-segment { min-width: 3px; height: 100%; border-right: 1px solid color-mix(in srgb, var(--legal-surface) 72%, transparent); transition: filter 140ms ease; }
        .distribution-segment:hover { filter: brightness(.88); }
        .distribution-legends { min-width: 0; display: flex; align-items: center; gap: 5px; overflow-x: auto; overflow-y: hidden; overscroll-behavior-inline: contain; scrollbar-width: none; }
        .distribution-legends::-webkit-scrollbar { display: none; }
        .distribution-pill { min-width: max-content; display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border: 1px solid var(--legal-border-strong); border-radius: 999px; background: var(--legal-surface-2); color: var(--legal-text-soft); text-decoration: none; font-size: 8px; font-weight: 700; line-height: 1.2; white-space: nowrap; }
        .distribution-pill:hover { border-color: var(--legal-gold); color: var(--legal-text-soft); }
        .distribution-pill strong { min-width: 14px; padding-left: 4px; border-left: 1px solid var(--legal-border); color: var(--legal-gold-dark); font-size: 8px; text-align: right; }
        .legend-dot { width: 6px; height: 6px; flex: 0 0 auto; border-radius: 999px; }
        .segment-tone-0 { background: #b98224; }
        .segment-tone-1 { background: #d09d45; }
        .segment-tone-2 { background: #a79069; }
        .segment-tone-3 { background: #d7b875; }
        .segment-tone-4 { background: #8e8069; }
        .segment-tone-5 { background: #c8a35f; }
        .distribution-empty { color: var(--legal-muted); font-size: 8px; }
        .red .summary-icon, .plan-icon.red, .category-badge.red { background: rgba(190, 66, 66, .10); color: var(--legal-danger); }
        .blue .summary-icon, .plan-icon.blue, .category-badge.blue { background: rgba(58, 133, 206, .11); color: #3984c9; }
        .amber .summary-icon, .plan-icon.amber, .category-badge.amber, .compact-icon.amber { background: var(--legal-gold-soft); color: var(--legal-gold-dark); }
        .cyan .summary-icon, .plan-icon.cyan, .category-badge.cyan, .compact-icon.cyan { background: rgba(35, 158, 165, .10); color: #238e95; }
        .plan-icon.violet, .category-badge.violet { background: rgba(124, 91, 184, .10); color: #7958ad; }
        .plan-icon.green, .category-badge.green { background: rgba(47, 143, 103, .10); color: var(--legal-success); }
        .dashboard-error { margin-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--legal-danger) 35%, var(--legal-border)); border-radius: 12px; background: color-mix(in srgb, var(--legal-danger) 8%, var(--legal-surface)); color: var(--legal-danger); font-size: 10px; }
        .dashboard-error button { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; font-weight: 800; }
        .workspace-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 10px; margin-top: 10px; }
        .plan-card, .side-card { border: 1px solid var(--legal-border); border-radius: 15px; background: var(--legal-surface); }
        .plan-card { min-width: 0; overflow: hidden; }
        .section-heading, .side-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .section-heading { min-height: 60px; padding: 11px 15px; border-bottom: 1px solid var(--legal-border); }
        .eyebrow { color: var(--legal-gold-dark); font-size: 8px; font-weight: 900; letter-spacing: .14em; }
        .section-heading h1 { margin: 2px 0 0; font-size: 17px; letter-spacing: -.02em; text-transform: uppercase; }
        .section-heading a, .side-heading a { display: inline-flex; align-items: center; gap: 3px; color: var(--legal-muted); text-decoration: none; font-size: 9px; font-weight: 750; }
        .plan-list { max-height: 428px; overflow-y: auto; overscroll-behavior: contain; }
        .plan-row { min-height: 64px; display: grid; grid-template-columns: 62px 38px minmax(0, 1fr) 18px; align-items: center; gap: 10px; padding: 8px 15px; border-bottom: 1px solid var(--legal-border); color: var(--legal-text); text-decoration: none; }
        .plan-row:hover { background: var(--legal-surface-2); }
        .plan-time { display: grid; gap: 3px; }
        .plan-time strong { font-size: 13px; }
        .plan-time span { color: var(--legal-muted); font-size: 9px; }
        .plan-icon { width: 36px; height: 36px; }
        .plan-copy { min-width: 0; display: grid; gap: 3px; }
        .plan-labels { display: flex; gap: 5px; }
        .category-badge, .priority-badge { width: max-content; padding: 3px 6px; border-radius: 6px; font-size: 7px; font-weight: 900; text-transform: uppercase; }
        .priority-badge { background: rgba(190, 66, 66, .10); color: var(--legal-danger); }
        .plan-copy > strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
        .plan-copy > span { overflow: hidden; color: var(--legal-muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
        .plan-row > svg { color: var(--legal-muted); }
        .empty-state { min-height: 118px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 16px; color: var(--legal-muted); text-align: center; font-size: 9px; }
        .empty-state strong { color: var(--legal-text-soft); font-size: 12px; }
        .upcoming-strip { display: grid; grid-template-columns: 132px minmax(0, 1fr); gap: 10px; padding: 10px 15px; background: var(--legal-surface-2); }
        .upcoming-title { display: flex; align-items: center; gap: 7px; color: var(--legal-text-soft); font-size: 10px; }
        .upcoming-items { min-width: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
        .upcoming-items a { min-width: 0; display: grid; gap: 3px; padding-left: 9px; border-left: 2px solid var(--legal-gold); color: inherit; text-decoration: none; }
        .upcoming-items span { color: var(--legal-muted); font-size: 8px; }
        .upcoming-items strong { overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
        .muted-line { color: var(--legal-muted); font-size: 9px; }
        .side-column { display: grid; align-content: start; gap: 9px; }
        .side-card { overflow: hidden; }
        .side-heading { min-height: 40px; padding: 0 12px; border-bottom: 1px solid var(--legal-border); }
        .side-heading h2 { margin: 0; font-size: 12px; }
        .compact-list { padding: 4px 0; }
        .compact-row { min-height: 46px; display: grid; grid-template-columns: 30px minmax(0, 1fr) 14px; align-items: center; gap: 8px; padding: 5px 11px; color: inherit; text-decoration: none; }
        .compact-row:hover { background: var(--legal-surface-2); }
        .compact-icon { width: 29px; height: 29px; }
        .compact-row > span:nth-child(2) { min-width: 0; display: grid; gap: 3px; }
        .compact-row strong, .compact-row small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .compact-row strong { font-size: 9px; }
        .compact-row small { color: var(--legal-muted); font-size: 8px; }
        .compact-row > svg { color: var(--legal-muted); }
        .compact-empty { padding: 14px 12px; color: var(--legal-muted); font-size: 9px; text-align: center; }
        .quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 8px; }
        .quick-grid a { min-height: 51px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; border: 1px solid var(--legal-border); border-radius: 10px; background: var(--legal-surface-2); color: var(--legal-text-soft); text-decoration: none; font-size: 7px; font-weight: 750; text-align: center; }
        .quick-grid a:hover { border-color: var(--legal-gold); color: var(--legal-gold-dark); }
        .case-total { color: var(--legal-muted); font-size: 8px; font-weight: 800; }
        .incoming-card .compact-list { max-height: 184px; overflow-y: auto; }
        .documents-card .compact-list { max-height: 238px; overflow-y: auto; }
        .plan-list, .incoming-card .compact-list, .documents-card .compact-list { scrollbar-width: thin; scrollbar-color: var(--legal-border-strong) transparent; }
        .plan-list::-webkit-scrollbar, .incoming-card .compact-list::-webkit-scrollbar, .documents-card .compact-list::-webkit-scrollbar { width: 5px; }
        .plan-list::-webkit-scrollbar-track, .incoming-card .compact-list::-webkit-scrollbar-track, .documents-card .compact-list::-webkit-scrollbar-track { background: transparent; }
        .plan-list::-webkit-scrollbar-thumb, .incoming-card .compact-list::-webkit-scrollbar-thumb, .documents-card .compact-list::-webkit-scrollbar-thumb { border-radius: 999px; background: var(--legal-border-strong); }
        .dashboard-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 8px 2px 0; color: var(--legal-muted); font-size: 8px; }
        .dashboard-footer span { display: inline-flex; align-items: center; gap: 5px; }
        @media (min-width: 1024px) {
          html:has(.dashboard-page), body:has(.dashboard-page) { height: 100%; overflow: hidden; }
          .dashboard-page { height: 100vh; min-height: 0; overflow: hidden; }
          .dashboard-shell { height: calc(100vh - 20px); min-height: 0; }
          .dashboard-body { height: calc(100% - 64px); display: flex; min-height: 0; flex-direction: column; overflow: hidden; }
          .summary-grid { flex: 0 0 auto; }
          .workspace-grid { min-height: 0; flex: 0 1 auto; }
          .plan-card, .side-column { min-height: 0; }
          .dashboard-footer { flex: 0 0 auto; }
        }
        @media (max-width: 1180px) {
          .dashboard-header { grid-template-columns: 190px minmax(220px, 1fr); }
          .header-actions { grid-column: 1 / -1; justify-content: flex-start; }
          .workspace-grid { grid-template-columns: minmax(0, 1fr) 290px; }
          .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .distribution-summary { grid-column: 1 / -1; }
        }
        @media (max-width: 760px) {
          .dashboard-page { padding: 10px 10px 78px; }
          .dashboard-shell { min-height: auto; border-radius: 20px; }
          .dashboard-header { display: flex; flex-wrap: wrap; gap: 10px; padding: 12px; }
          .global-search { width: 100%; order: 3; }
          .header-actions { margin-left: auto; }
          .header-date, .import-action { display: none; }
          .dashboard-body { padding: 12px; }
          .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .summary-card { min-height: 96px; padding: 12px; }
          .distribution-summary { grid-column: 1 / -1; }
          .summary-arrow, .summary-copy small { display: none; }
          .workspace-grid { grid-template-columns: 1fr; }
          .side-column { grid-template-columns: 1fr; }
          .plan-row { grid-template-columns: 54px 36px minmax(0, 1fr); padding: 10px; }
          .plan-row > svg { display: none; }
          .plan-icon { width: 34px; height: 34px; }
          .upcoming-strip { grid-template-columns: 1fr; }
          .upcoming-items { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
    </main>
  );
}

function InlineSearchGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="inline-search-group">
      <span className="inline-search-title">{title}</span>
      {children}
    </section>
  );
}
