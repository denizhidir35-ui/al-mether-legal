"use client";

import { useEffect, useState } from "react";

import TopBar from "@/components/layout/TopBar";
import MailInbox, { Mail } from "@/components/mail/MailInbox";
import MailDetail from "@/components/mail/MailDetail";
import DeadlineList from "@/components/dashboard/DeadlineList";

type ActiveTab = "mail" | "detail" | "deadline";

type DeadlineRow = {
  id?: string | number;
  title?: string;
  risk?: string;
  deadline_date?: string | null;
  calendar_created?: boolean;
};

type DeadlineItem = {
  id?: string | number;
  title: string;
  level: string;
  days: number;
  calendarCreated?: boolean;
};

function calculateDays(dateValue?: string | null) {
  if (!dateValue) return 999;

  const now = new Date();
  const end = new Date(`${dateValue}T23:59:59`);

  if (Number.isNaN(end.getTime())) return 999;

  return Math.ceil(
    (end.getTime() - now.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

export default function Home() {
  const [selectedMail, setSelectedMail] =
    useState<Mail | null>(null);

  const [isMobile, setIsMobile] = useState(false);

  const [activeTab, setActiveTab] =
    useState<ActiveTab>("mail");

  const [deadlineItems, setDeadlineItems] =
    useState<DeadlineItem[]>([]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    handleResize();

    window.addEventListener("resize", handleResize);

    return () =>
      window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    loadDeadlines();

    const interval = window.setInterval(loadDeadlines, 5000);

    window.addEventListener("focus", loadDeadlines);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", loadDeadlines);
    };
  }, []);

  async function loadDeadlines() {
    try {
      const res = await fetch("/api/deadline", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("DEADLINE API ERROR:", data);
        return;
      }

      const formatted = (Array.isArray(data) ? data : [])
        .filter((item: DeadlineRow) => item.deadline_date)
        .map((item: DeadlineRow) => ({
          id: item.id,
          title: item.title || "İsimsiz Dava",
          level: item.risk || "Normal",
          days: calculateDays(item.deadline_date),
          calendarCreated: Boolean(item.calendar_created),
        }))
        .sort((a, b) => a.days - b.days);

      setDeadlineItems(formatted);
    } catch (error) {
      console.error("DEADLINE LOAD ERROR:", error);
    }
  }

  function handleSelectMail(mail: Mail) {
    setSelectedMail(mail);

    if (isMobile) {
      setActiveTab("detail");
    }
  }

  const criticalCount = deadlineItems.filter(
    (item) => item.days <= 3
  ).length;

  const highRiskCount = deadlineItems.filter(
    (item) => item.level === "Yüksek"
  ).length;

  const calendarCount = deadlineItems.filter(
    (item) => item.calendarCreated
  ).length;

  const mailDetail = (
    <MailDetail
      title={selectedMail?.subject ?? "Bir mail seçin"}
      sender={selectedMail?.sender ?? "-"}
      body={selectedMail?.body ?? "Soldaki listeden bir mail seçin."}
      deadline={selectedMail?.deadline ?? "-"}
      type={selectedMail?.type ?? "Analiz Bekliyor"}
      risk={selectedMail?.risk ?? "Analiz Bekliyor"}
    />
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left,rgba(37,99,235,0.18),transparent 32%), linear-gradient(to bottom right,#020617,#000814,#0f172a)",
        color: "white",
        padding: isMobile ? "10px 10px 86px" : 16,
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <TopBar />

      <section style={{ marginTop: 12, marginBottom: 18 }}>
        <h1
          style={{
            fontSize: isMobile ? 22 : 30,
            fontWeight: 900,
            marginBottom: 8,
          }}
        >
          ⚖️ AL Mether Legal
        </h1>

        <p
          style={{
            color: "#94a3b8",
            fontSize: isMobile ? 12 : 14,
            maxWidth: 800,
            lineHeight: 1.6,
          }}
        >
          Hukuki mailleri analiz eder, kritik süreleri tespit eder,
          takvime işler ve sizi zamanında uyarır.
        </p>
      </section>

      <section style={kpiGrid(isMobile)}>
        <KpiCard
          icon="📨"
          label="Seçili Mail"
          value={selectedMail ? "1" : "0"}
          note={selectedMail ? "Analize hazır" : "Mail seçilmedi"}
        />

        <KpiCard
          icon="⏳"
          label="Kritik Süre"
          value={String(criticalCount)}
          note="3 gün ve altı"
          tone={criticalCount > 0 ? "danger" : "success"}
        />

        <KpiCard
          icon="🚨"
          label="Yüksek Risk"
          value={String(highRiskCount)}
          note="Acil takip"
          tone={highRiskCount > 0 ? "danger" : "success"}
        />

        <KpiCard
          icon="📅"
          label="Takvimlenen"
          value={String(calendarCount)}
          note="Google Calendar"
          tone="info"
        />
      </section>

      {!isMobile ? (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "350px 1fr 320px",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <MailInbox onSelectMail={handleSelectMail} />
          </div>

          <div style={{ minWidth: 0 }}>{mailDetail}</div>

          <div style={{ minWidth: 0 }}>
            <DeadlineList items={deadlineItems} />
          </div>
        </section>
      ) : (
        <>
          <section style={{ minWidth: 0 }}>
            {activeTab === "mail" && (
              <MailInbox onSelectMail={handleSelectMail} />
            )}

            {activeTab === "detail" && mailDetail}

            {activeTab === "deadline" && (
              <DeadlineList items={deadlineItems} />
            )}
          </section>

          <nav style={mobileNav}>
            <MobileTab
              active={activeTab === "mail"}
              label="Gelen"
              icon="📥"
              onClick={() => setActiveTab("mail")}
            />

            <MobileTab
              active={activeTab === "detail"}
              label="Analiz"
              icon="🤖"
              onClick={() => setActiveTab("detail")}
            />

            <MobileTab
              active={activeTab === "deadline"}
              label="Süreler"
              icon="⏳"
              badge={deadlineItems.length}
              onClick={() => setActiveTab("deadline")}
            />
          </nav>
        </>
      )}
    </main>
  );
}

function KpiCard({
  icon,
  label,
  value,
  note,
  tone = "info",
}: {
  icon: string;
  label: string;
  value: string;
  note: string;
  tone?: "info" | "danger" | "success";
}) {
  const color =
    tone === "danger"
      ? "#ef4444"
      : tone === "success"
      ? "#22c55e"
      : "#60a5fa";

  return (
    <div style={kpiCard}>
      <div style={kpiTop}>
        <div style={kpiIcon(color)}>{icon}</div>
        <div style={kpiValue}>{value}</div>
      </div>

      <div style={kpiLabel}>{label}</div>
      <div style={kpiNote}>{note}</div>
    </div>
  );
}

function MobileTab({
  active,
  label,
  icon,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: active
          ? "linear-gradient(to right,#7c3aed,#2563eb)"
          : "rgba(255,255,255,0.04)",
        border: active
          ? "1px solid rgba(147,197,253,0.5)"
          : "1px solid rgba(255,255,255,0.08)",
        color: "white",
        borderRadius: 18,
        padding: "10px 8px",
        fontWeight: 800,
        cursor: "pointer",
        position: "relative",
      }}
    >
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ fontSize: 11, marginTop: 2 }}>{label}</div>

      {badge ? (
        <span
          style={{
            position: "absolute",
            top: -7,
            right: 8,
            background: "#ef4444",
            color: "white",
            borderRadius: 999,
            padding: "2px 7px",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

const kpiGrid = (isMobile: boolean) => ({
  display: "grid",
  gridTemplateColumns: isMobile
    ? "repeat(2,1fr)"
    : "repeat(4,1fr)",
  gap: 12,
  marginBottom: 20,
});

const kpiCard = {
  background:
    "linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.9))",
  border: "1px solid rgba(148,163,184,0.16)",
  borderRadius: 22,
  padding: 14,
  boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
};

const kpiTop = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 10,
};

const kpiIcon = (color: string) => ({
  width: 38,
  height: 38,
  borderRadius: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: `${color}18`,
  border: `1px solid ${color}33`,
  fontSize: 18,
});

const kpiValue = {
  fontSize: 26,
  fontWeight: 950,
  color: "white",
};

const kpiLabel = {
  color: "white",
  fontWeight: 900,
  fontSize: 13,
  marginBottom: 4,
};

const kpiNote = {
  color: "#94a3b8",
  fontSize: 12,
};

const mobileNav = {
  position: "fixed" as const,
  left: 10,
  right: 10,
  bottom: 10,
  zIndex: 50,
  display: "flex",
  gap: 8,
  padding: 8,
  borderRadius: 24,
  background: "rgba(2,6,23,0.92)",
  border: "1px solid rgba(148,163,184,0.18)",
  backdropFilter: "blur(14px)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
};