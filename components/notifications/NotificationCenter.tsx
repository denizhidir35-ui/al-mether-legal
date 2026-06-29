"use client";

import React, { useMemo, useState } from "react";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  Header,
  Layout,
  Search,
} from "@/components/ui";

export type LegalNotification = {
  id: string;
  title: string;
  description?: string;
  date?: string;
  type?: "deadline" | "hearing" | "mail" | "ai" | "system";
  priority?: "low" | "medium" | "high" | "critical";
  read?: boolean;
  actionLabel?: string;
};

type NotificationCenterProps = {
  notifications?: LegalNotification[];
};

const demoNotifications: LegalNotification[] = [
  {
    id: "n1",
    title: "Kritik süre bugün doluyor",
    description: "Cevap dilekçesi son günü bugün. Dosya kontrol edilmeli.",
    date: new Date().toISOString(),
    type: "deadline",
    priority: "critical",
    read: false,
    actionLabel: "Dosyayı aç",
  },
  {
    id: "n2",
    title: "Yeni AI analiz tamamlandı",
    description: "Gmail üzerinden gelen evrak analiz edildi ve takvime işlendi.",
    date: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    type: "ai",
    priority: "medium",
    read: false,
    actionLabel: "Analizi gör",
  },
];

function formatDate(value?: string) {
  if (!value) return "Tarih yok";

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function typeLabel(type?: LegalNotification["type"]) {
  return {
    deadline: "Süre",
    hearing: "Duruşma",
    mail: "Mail",
    ai: "AI",
    system: "Sistem",
  }[type || "system"];
}

function priorityTone(priority?: LegalNotification["priority"]) {
  if (priority === "critical") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "info";
  return "neutral";
}

function priorityLabel(priority?: LegalNotification["priority"]) {
  return {
    low: "Düşük",
    medium: "Orta",
    high: "Yüksek",
    critical: "Kritik",
  }[priority || "low"];
}

function typeIcon(type?: LegalNotification["type"]) {
  return {
    deadline: "⏰",
    hearing: "⚖️",
    mail: "✉️",
    ai: "🤖",
    system: "◇",
  }[type || "system"];
}

export default function NotificationCenter({
  notifications = demoNotifications,
}: NotificationCenterProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "critical">("all");
  const [selected, setSelected] = useState<LegalNotification | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();

    return notifications
      .filter((item) => {
        if (filter === "unread" && item.read) return false;
        if (filter === "critical" && item.priority !== "critical") return false;

        if (!q) return true;

        return [item.title, item.description, typeLabel(item.type), priorityLabel(item.priority)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const ad = a.date ? new Date(a.date).getTime() : 0;
        const bd = b.date ? new Date(b.date).getTime() : 0;
        return bd - ad;
      });
  }, [notifications, query, filter]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const criticalCount = notifications.filter((n) => n.priority === "critical").length;

  return (
    <Layout>
      <Header
        title="Notification Center"
        subtitle="Süre, duruşma, AI ve mail uyarıları"
        right={<Badge tone="danger">{criticalCount} kritik</Badge>}
      />

      <div style={{ display: "grid", gap: 14 }}>
        <Search
          value={query}
          onChange={setQuery}
          placeholder="Bildirim, süre, mail veya AI uyarısı ara..."
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          <Card>
            <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>
              Okunmamış
            </div>
            <div style={{ color: "#fff", fontSize: 25, fontWeight: 950 }}>{unreadCount}</div>
          </Card>

          <Card>
            <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>
              Kritik
            </div>
            <div style={{ color: "#fff", fontSize: 25, fontWeight: 950 }}>{criticalCount}</div>
          </Card>
        </div>

        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          <Button size="sm" variant={filter === "all" ? "primary" : "secondary"} onClick={() => setFilter("all")}>
            Tümü
          </Button>
          <Button size="sm" variant={filter === "unread" ? "primary" : "secondary"} onClick={() => setFilter("unread")}>
            Okunmamış
          </Button>
          <Button size="sm" variant={filter === "critical" ? "primary" : "secondary"} onClick={() => setFilter("critical")}>
            Kritik
          </Button>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Bildirim bulunamadı"
            description="Arama veya filtreye uygun bildirim yok."
          />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((item) => (
              <Card
                key={item.id}
                elevated={item.priority === "critical"}
                onClick={() => setSelected(item)}
                style={{
                  cursor: "pointer",
                  opacity: item.read ? 0.72 : 1,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "42px 1fr", gap: 12 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 17,
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(255,255,255,.07)",
                      border: "1px solid rgba(255,255,255,.09)",
                    }}
                  >
                    {typeIcon(item.type)}
                  </div>

                  <div style={{ display: "grid", gap: 7 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Badge tone="info">{typeLabel(item.type)}</Badge>
                      <Badge tone={priorityTone(item.priority)}>
                        {priorityLabel(item.priority)}
                      </Badge>
                      {!item.read && <Badge tone="success">Yeni</Badge>}
                    </div>

                    <div style={{ color: "#fff", fontSize: 15, fontWeight: 950 }}>
                      {item.title}
                    </div>

                    {item.description && (
                      <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.55 }}>
                        {item.description}
                      </div>
                    )}

                    <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                      {formatDate(item.date)}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BottomSheet
        open={Boolean(selected)}
        title={selected?.title}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge tone="info">{typeLabel(selected.type)}</Badge>
              <Badge tone={priorityTone(selected.priority)}>
                {priorityLabel(selected.priority)}
              </Badge>
            </div>

            <p style={{ margin: 0, color: "#cbd5e1", fontSize: 14, lineHeight: 1.7 }}>
              {selected.description || "Bu bildirim için açıklama bulunmuyor."}
            </p>

            <div style={{ color: "#94a3b8", fontSize: 13 }}>
              {formatDate(selected.date)}
            </div>

            <Button>{selected.actionLabel || "İşleme Git"}</Button>
          </div>
        )}
      </BottomSheet>
    </Layout>
  );
}
