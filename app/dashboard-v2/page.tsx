"use client";

import { useEffect, useMemo, useState } from "react";

type TimelineItem = {
  id: string;
  title: string;
  due_date: string | null;
  priority: string | null;
  event_type: string | null;
  status: string | null;
};

type DashboardData = {
  stats: {
    activeCases: number;
    todayDeadlines: number;
    weekDeadlines: number;
    criticalCases: number;
  };
  timeline: TimelineItem[];
};

const emptyData: DashboardData = {
  stats: {
    activeCases: 0,
    todayDeadlines: 0,
    weekDeadlines: 0,
    criticalCases: 0,
  },
  timeline: [],
};

function formatDate(date?: string | null) {
  if (!date) return "-";
  return new Date(`${date}T00:00:00`).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
  });
}

function priorityStyle(priority?: string | null) {
  if (priority === "critical") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (priority === "high") return "border-orange-500/30 bg-orange-500/10 text-orange-200";
  return "border-blue-500/25 bg-blue-500/10 text-blue-200";
}

export default function DashboardV2Page() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);

  const todayText = useMemo(() => {
    return new Date().toLocaleDateString("tr-TR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, []);

  async function loadDashboard() {
    setLoading(true);
    const res = await fetch("/api/dashboard-v2");
    const json = await res.json();
    setData({
      stats: json.stats || emptyData.stats,
      timeline: json.timeline || [],
    });
    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <main className="min-h-screen bg-[#050816] text-white px-4 py-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 md:p-6 mb-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-blue-300 text-sm font-medium">AL Mether Legal OS</p>
              <h1 className="text-3xl md:text-4xl font-black mt-2">
                Bugün ne yapılacak?
              </h1>
              <p className="text-white/55 mt-2">{todayText}</p>
            </div>

            <a
              href="/search"
              className="rounded-2xl border border-white/10 bg-black/25 px-5 py-4 text-white/70 hover:bg-white/10"
            >
              ⌘ Dosya, kişi veya mahkeme ara...
            </a>
          </div>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard title="Açık Dosya" value={data.stats.activeCases} tone="blue" />
          <StatCard title="Bugün Son Gün" value={data.stats.todayDeadlines} tone="red" />
          <StatCard title="Bu Hafta" value={data.stats.weekDeadlines} tone="orange" />
          <StatCard title="Kritik Dosya" value={data.stats.criticalCases} tone="purple" />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">Yaklaşan İşler</h2>
                <p className="text-white/45 text-sm">Önümüzdeki 7 gün</p>
              </div>

              <a href="/calendar" className="text-blue-300 text-sm hover:underline">
                Takvimi Aç
              </a>
            </div>

            {loading ? (
              <div className="text-white/50 py-8">Yükleniyor...</div>
            ) : data.timeline.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-white/55">
                Önümüzdeki 7 gün için kayıt yok.
              </div>
            ) : (
              <div className="space-y-3">
                {data.timeline.map((item) => (
                  <a
                    key={item.id}
                    href="/calendar"
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-white/[0.06]"
                  >
                    <div>
                      <div className="font-bold">{item.title}</div>
                      <div className="text-sm text-white/45 mt-1">
                        {item.event_type || "legal_deadline"} · {item.status || "active"}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold">{formatDate(item.due_date)}</div>
                      <span className={`inline-block mt-2 rounded-full border px-3 py-1 text-xs ${priorityStyle(item.priority)}`}>
                        {item.priority || "normal"}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-blue-500/20 bg-blue-500/[0.08] p-5">
            <h2 className="text-xl font-bold">AI Gün Özeti</h2>
            <p className="text-white/60 mt-2">
              Bugün {data.stats.todayDeadlines} sürenin son günü.
              Bu hafta toplam {data.stats.weekDeadlines} takvim kaydı var.
              Kritik dosya sayısı {data.stats.criticalCases}.
            </p>

            <div className="mt-5 grid gap-3">
              <a href="/cases" className="rounded-2xl bg-black/25 border border-white/10 p-4 hover:bg-white/10">
                📂 Dosyalara Git
              </a>
              <a href="/search" className="rounded-2xl bg-black/25 border border-white/10 p-4 hover:bg-white/10">
                🔎 Universal Search
              </a>
              <a href="/calendar" className="rounded-2xl bg-black/25 border border-white/10 p-4 hover:bg-white/10">
                📅 AL Calendar
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "blue" | "red" | "orange" | "purple";
}) {
  const toneMap = {
    blue: "border-blue-500/20 bg-blue-500/10",
    red: "border-red-500/25 bg-red-500/10",
    orange: "border-orange-500/25 bg-orange-500/10",
    purple: "border-purple-500/25 bg-purple-500/10",
  };

  return (
    <div className={`rounded-[26px] border p-5 ${toneMap[tone]}`}>
      <div className="text-white/55 text-sm">{title}</div>
      <div className="text-4xl font-black mt-3">{value}</div>
    </div>
  );
}
