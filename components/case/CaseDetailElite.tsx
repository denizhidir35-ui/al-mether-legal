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
  Modal,
} from "@/components/ui";

export type CaseTimelineItem = {
  id: string;
  title: string;
  date?: string;
  description?: string;
  type?: "mail" | "ai" | "calendar" | "document" | "note" | "system";
};

export type CaseDeadline = {
  id: string;
  title: string;
  date: string;
  risk?: "low" | "medium" | "high" | "critical";
  status?: "open" | "done" | "missed";
};

export type LegalCaseDetail = {
  id: string;
  title: string;
  client?: string;
  opponent?: string;
  court?: string;
  fileNo?: string;
  status?: "active" | "waiting" | "closed" | "risk";
  risk?: "low" | "medium" | "high" | "critical";
  summary?: string;
  aiAnalysis?: string;
  deadlines?: CaseDeadline[];
  timeline?: CaseTimelineItem[];
};

type CaseDetailEliteProps = {
  caseData?: LegalCaseDetail;
};

const demoCase: LegalCaseDetail = {
  id: "demo",
  title: "AL Mether / Demo Hukuk Dosyası",
  client: "Demo Müvekkil",
  opponent: "Karşı Taraf A.Ş.",
  court: "İzmir 3. Asliye Hukuk Mahkemesi",
  fileNo: "2026/145 E.",
  status: "risk",
  risk: "critical",
  summary:
    "Bu dosya AI tarafından kritik süre içeren aktif dosya olarak işaretlenmiştir. Cevap dilekçesi ve delil sunma takibi önerilir.",
  aiAnalysis:
    "AI ön değerlendirmesine göre dosyada süre kaçırma riski yüksektir. Takvim kaydı oluşturulmalı, sorumlu avukat atanmalı ve son tarih öncesi çoklu hatırlatma kurulmalıdır.",
  deadlines: [
    {
      id: "d1",
      title: "Cevap dilekçesi son günü",
      date: new Date().toISOString(),
      risk: "critical",
      status: "open",
    },
  ],
  timeline: [
    {
      id: "t1",
      title: "Gmail üzerinden dosya tespit edildi",
      type: "mail",
      date: new Date().toISOString(),
      description: "Mail içeriği AI tarafından analiz edildi.",
    },
    {
      id: "t2",
      title: "AI analiz tamamlandı",
      type: "ai",
      date: new Date().toISOString(),
      description: "Risk, mahkeme, dosya no ve süre bilgileri ayrıştırıldı.",
    },
  ],
};

function formatDate(value?: string) {
  if (!value) return "Tarih yok";

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

function riskTone(risk?: LegalCaseDetail["risk"]) {
  if (risk === "critical") return "danger";
  if (risk === "high") return "warning";
  if (risk === "medium") return "info";
  return "neutral";
}

function riskLabel(risk?: LegalCaseDetail["risk"]) {
  return {
    low: "Düşük",
    medium: "Orta",
    high: "Yüksek",
    critical: "Kritik",
  }[risk || "low"];
}

function statusLabel(status?: LegalCaseDetail["status"]) {
  return {
    active: "Aktif",
    waiting: "Beklemede",
    closed: "Kapalı",
    risk: "Riskli",
  }[status || "active"];
}

function timelineIcon(type?: CaseTimelineItem["type"]) {
  return {
    mail: "✉️",
    ai: "🤖",
    calendar: "📅",
    document: "📄",
    note: "📝",
    system: "◇",
  }[type || "system"];
}

export default function CaseDetailElite({ caseData = demoCase }: CaseDetailEliteProps) {
  const [aiOpen, setAiOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  const nextDeadline = useMemo(() => {
    return [...(caseData.deadlines || [])]
      .filter((item) => item.status !== "done")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  }, [caseData.deadlines]);

  const criticalDeadlines = (caseData.deadlines || []).filter(
    (item) => item.risk === "critical" && item.status !== "done"
  );

  return (
    <Layout>
      <Header
        title="Case Detail"
        subtitle="Dosya merkezi, AI analiz ve süre takibi"
        right={<Badge tone={riskTone(caseData.risk)}>{riskLabel(caseData.risk)} risk</Badge>}
      />

      <div style={{ display: "grid", gap: 14 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge tone="info">{statusLabel(caseData.status)}</Badge>
                {criticalDeadlines.length > 0 && (
                  <Badge tone="danger">{criticalDeadlines.length} kritik süre</Badge>
                )}
              </div>

              <h1
                style={{
                  margin: 0,
                  color: "#fff",
                  fontSize: 26,
                  letterSpacing: "-.045em",
                  lineHeight: 1.05,
                }}
              >
                {caseData.title}
              </h1>

              <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.65 }}>
                {caseData.client && <div>Müvekkil: {caseData.client}</div>}
                {caseData.opponent && <div>Karşı taraf: {caseData.opponent}</div>}
                {caseData.court && <div>{caseData.court}</div>}
                {caseData.fileNo && <div>Dosya No: {caseData.fileNo}</div>}
              </div>
            </div>

            {nextDeadline && (
              <div
                style={{
                  minWidth: 82,
                  height: 82,
                  borderRadius: 26,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(239,68,68,.13)",
                  border: "1px solid rgba(239,68,68,.22)",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#fff", fontSize: 24, fontWeight: 950 }}>
                    {daysLeft(nextDeadline.date)}
                  </div>
                  <div style={{ color: "#fca5a5", fontSize: 11, fontWeight: 900 }}>gün</div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          <Button onClick={() => setAiOpen(true)}>AI Analiz</Button>
          <Button variant="secondary" onClick={() => setActionsOpen(true)}>
            İşlemler
          </Button>
        </div>

        <Card>
          <h2 style={{ margin: "0 0 8px", color: "#fff", fontSize: 18 }}>Dosya Özeti</h2>
          <p style={{ margin: 0, color: "#cbd5e1", fontSize: 14, lineHeight: 1.7 }}>
            {caseData.summary || "Bu dosya için henüz özet oluşturulmadı."}
          </p>
        </Card>

        <Card>
          <h2 style={{ margin: "0 0 12px", color: "#fff", fontSize: 18 }}>Yaklaşan Süreler</h2>

          {(caseData.deadlines || []).length === 0 ? (
            <EmptyState
              title="Süre bulunamadı"
              description="Bu dosyaya bağlı açık hukuki süre kaydı yok."
            />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {(caseData.deadlines || []).map((deadline) => {
                const left = daysLeft(deadline.date);

                return (
                  <div
                    key={deadline.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: 12,
                      borderRadius: 18,
                      background: "rgba(255,255,255,.045)",
                      border: "1px solid rgba(255,255,255,.08)",
                    }}
                  >
                    <div>
                      <div style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>
                        {deadline.title}
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                        {formatDate(deadline.date)}
                      </div>
                    </div>

                    <Badge tone={riskTone(deadline.risk)}>
                      {left < 0 ? "Geçti" : left === 0 ? "Bugün" : `${left} gün`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <h2 style={{ margin: "0 0 12px", color: "#fff", fontSize: 18 }}>Timeline</h2>

          {(caseData.timeline || []).length === 0 ? (
            <EmptyState title="Hareket yok" description="Bu dosyada henüz işlem geçmişi oluşmadı." />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {(caseData.timeline || []).map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "34px 1fr",
                    gap: 10,
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 14,
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(255,255,255,.07)",
                    }}
                  >
                    {timelineIcon(item.type)}
                  </div>

                  <div>
                    <div style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>
                      {item.title}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 3 }}>
                      {formatDate(item.date)}
                    </div>
                    {item.description && (
                      <div style={{ color: "#cbd5e1", fontSize: 13, marginTop: 5 }}>
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal open={aiOpen} title="AI Analiz" onClose={() => setAiOpen(false)}>
        <p style={{ color: "#cbd5e1", lineHeight: 1.7, margin: 0 }}>
          {caseData.aiAnalysis || "Bu dosya için AI analiz sonucu bulunamadı."}
        </p>
      </Modal>

      <BottomSheet open={actionsOpen} title="Dosya İşlemleri" onClose={() => setActionsOpen(false)}>
        <div style={{ display: "grid", gap: 10 }}>
          <Button>Takvime Süre Ekle</Button>
          <Button variant="secondary">Mail Geçmişini Aç</Button>
          <Button variant="secondary">Belge Oluştur</Button>
          <Button variant="secondary">Hatırlatma Kur</Button>
        </div>
      </BottomSheet>
    </Layout>
  );
}

