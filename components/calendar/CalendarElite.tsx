"use client";

import React, { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Header,
  Layout,
  Search,
} from "@/components/ui";

export type LegalCalendarEvent = {
  id: string;
  title: string;
  caseTitle?: string;
  court?: string;
  fileNo?: string;
  date: string;
  type?: "hearing" | "deadline" | "objection" | "execution" | "case" | "other";
  risk?: "low" | "medium" | "high" | "critical";
  status?: "open" | "done" | "missed";
  note?: string;
};

type CalendarEliteProps = {
  events?: LegalCalendarEvent[];
  title?: string;
  subtitle?: string;
};

const sampleEvents: LegalCalendarEvent[] = [
  {
    id: "1",
    title: "Cevap dilekçesi son günü",
    caseTitle: "AL Mether / Demo Dosya",
    court: "İzmir 3. Asliye Hukuk",
    fileNo: "2026/145 E.",
    date: new Date().toISOString(),
    type: "deadline",
    risk: "critical",
    status: "open",
    note: "AI tarafından yüksek riskli süre olarak işaretlendi.",
  },
  {
    id: "2",
    title: "Duruşma",
    caseTitle: "İşçilik Alacağı",
    court: "İzmir 8. İş Mahkemesi",
    fileNo: "2025/88 E.",
    date: new Date(Date.now() + 86400000 * 3).toISOString(),
    type: "hearing",
    risk: "medium",
    status: "open",
  },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(new Date(value));
}

function daysLeft(value: string) {
  const today = new Date();
  const target = new Date(value);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function typeLabel(type?: LegalCalendarEvent["type"]) {
  return {
    hearing: "Duruşma",
    deadline: "Süre",
    objection: "İtiraz",
    execution: "İcra",
    case: "Dava",
    other: "Diğer",
  }[type || "other"];
}

function riskTone(risk?: LegalCalendarEvent["risk"]) {
  if (risk === "critical") return "danger";
  if (risk === "high") return "warning";
  if (risk === "medium") return "info";
  return "neutral";
}

function riskLabel(risk?: LegalCalendarEvent["risk"]) {
  return {
    low: "Düşük",
    medium: "Orta",
    high: "Yüksek",
    critical: "Kritik",
  }[risk || "low"];
}

export default function CalendarElite({
  events = sampleEvents,
  title = "AL Calendar",
  subtitle = "Duruşmalar, süreler ve kritik hukuki takvim",
}: CalendarEliteProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "today" | "week" | "critical">("all");

  const filteredEvents = useMemo(() => {
    const q = query.toLowerCase().trim();

    return events
      .filter((event) => {
        const left = daysLeft(event.date);

        if (filter === "today" && left !== 0) return false;
        if (filter === "week" && (left < 0 || left > 7)) return false;
        if (filter === "critical" && event.risk !== "critical") return false;

        if (!q) return true;

        return [
          event.title,
          event.caseTitle,
          event.court,
          event.fileNo,
          event.note,
          typeLabel(event.type),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, query, filter]);

  const criticalCount = events.filter((e) => e.risk === "critical").length;
  const todayCount = events.filter((e) => daysLeft(e.date) === 0).length;
  const weekCount = events.filter((e) => {
    const left = daysLeft(e.date);
    return left >= 0 && left <= 7;
  }).length;

  return (
    <Layout>
      <Header
        title={title}
        subtitle={subtitle}
        right={<Badge tone="danger">{criticalCount} kritik</Badge>}
      />

      <div style={{ display: "grid", gap: 14 }}>
        <Search
          value={query}
          onChange={setQuery}
          placeholder="Dosya, mahkeme, süre, duruşma ara..."
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}
        >
          <Card>
            <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800 }}>Bugün</div>
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 900 }}>{todayCount}</div>
          </Card>

          <Card>
            <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800 }}>7 Gün</div>
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 900 }}>{weekCount}</div>
          </Card>

          <Card>
            <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800 }}>Kritik</div>
            <div style={{ color: "#fff", fontSize: 24, fontWeight: 900 }}>{criticalCount}</div>
          </Card>
        </div>

        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          <Button size="sm" variant={filter === "all" ? "default" : "secondary"} onClick={() => setFilter("all")}>
            Tümü
          </Button>
          <Button size="sm" variant={filter === "today" ? "default" : "secondary"} onClick={() => setFilter("today")}>
            Bugün
          </Button>
          <Button size="sm" variant={filter === "week" ? "default" : "secondary"} onClick={() => setFilter("week")}>
            7 Gün
          </Button>
          <Button size="sm" variant={filter === "critical" ? "default" : "secondary"} onClick={() => setFilter("critical")}>
            Kritik
          </Button>
        </div>

        {filteredEvents.length === 0 ? (
          <EmptyState
            title="Takvimde kayıt bulunamadı"
            description="Arama veya filtreye uygun duruşma, süre ya da dosya takvimi yok."
          />
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {filteredEvents.map((event) => {
              const left = daysLeft(event.date);

              return (
                <Card key={event.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Badge tone="info">{typeLabel(event.type)}</Badge>
                        <Badge tone={riskTone(event.risk)}>{riskLabel(event.risk)} risk</Badge>
                        {event.status === "done" && <Badge tone="success">Tamamlandı</Badge>}
                        {event.status === "missed" && <Badge tone="danger">Kaçtı</Badge>}
                      </div>

                      <h3
                        style={{
                          margin: 0,
                          color: "#fff",
                          fontSize: 18,
                          letterSpacing: "-.03em",
                        }}
                      >
                        {event.title}
                      </h3>

                      {event.caseTitle && (
                        <div style={{ color: "#cbd5e1", fontSize: 14, fontWeight: 700 }}>
                          {event.caseTitle}
                        </div>
                      )}

                      <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.55 }}>
                        {event.court && <div>{event.court}</div>}
                        {event.fileNo && <div>Dosya No: {event.fileNo}</div>}
                        <div>{formatDate(event.date)}</div>
                      </div>

                      {event.note && (
                        <div style={{ color: "#cbd5e1", fontSize: 13 }}>
                          {event.note}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        minWidth: 74,
                        height: 74,
                        borderRadius: 22,
                        display: "grid",
                        placeItems: "center",
                        background:
                          left < 0
                            ? "rgba(239,68,68,.14)"
                            : left === 0
                              ? "rgba(245,158,11,.16)"
                              : "rgba(255,255,255,.07)",
                        border: "1px solid rgba(255,255,255,.10)",
                      }}
                    >
                      <div style={{ textAlign: "center" }}>
                        <div style={{ color: "#fff", fontSize: 22, fontWeight: 950 }}>
                          {left < 0 ? "!" : left}
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 800 }}>
                          {left < 0 ? "geçti" : left === 0 ? "bugün" : "gün"}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}



