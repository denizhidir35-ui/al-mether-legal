"use client";

import { useEffect, useMemo, useState } from "react";

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  event_type: string | null;
  start_date: string | null;
  end_date: string | null;
  due_date: string | null;
  status: string | null;
  priority: string | null;
  source: string | null;
  source_mail_id: string | null;
  created_at: string;
};

const months = [
  "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
  "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık",
];

const days = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function key(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const offset = (first.getDay() + 6) % 7;
  const result: (Date | null)[] = [];

  for (let i = 0; i < offset; i++) result.push(null);
  for (let d = 1; d <= last.getDate(); d++) result.push(new Date(year, month, d));
  while (result.length % 7 !== 0) result.push(null);

  return result;
}

function riskDot(priority?: string | null) {
  if (priority === "critical") return "bg-red-400 shadow-red-400/40";
  if (priority === "high") return "bg-orange-400 shadow-orange-400/40";
  if (priority === "low") return "bg-green-400 shadow-green-400/40";
  return "bg-blue-400 shadow-blue-400/40";
}

function riskLabel(priority?: string | null) {
  if (priority === "critical") return "Kritik";
  if (priority === "high") return "Yüksek";
  if (priority === "low") return "Düşük";
  return "Normal";
}

export default function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(key(today));
  const [loading, setLoading] = useState(true);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const allDays = useMemo(() => monthDays(year, month), [year, month]);

  const grouped = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((e) => {
      const d = e.due_date || e.start_date || e.end_date;
      if (!d) return;
      if (!map[d]) map[d] = [];
      map[d].push(e);
    });
    return map;
  }, [events]);

  const selectedEvents = grouped[selectedDate] || [];

  const monthEvents = events.filter((e) => {
    const d = e.due_date || e.start_date || e.end_date || "";
    return d.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`);
  });

  const stats = {
    today: grouped[key(today)]?.length || 0,
    month: monthEvents.length,
    critical: monthEvents.filter((e) => e.priority === "critical" || e.priority === "high").length,
    done: monthEvents.filter((e) => e.status === "done" || e.status === "completed").length,
  };

  async function loadEvents() {
    setLoading(true);
    const res = await fetch("/api/al-calendar");
    const json = await res.json();
    setEvents(json.events || []);
    setLoading(false);
  }

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <main className="min-h-screen bg-[#050816] text-white px-4 py-5 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5">
          <div className="rounded-[34px] border border-white/10 bg-white/[0.045] p-5 md:p-7">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-blue-300 text-sm font-semibold">AL Mether Legal Time Engine</p>
                <h1 className="text-4xl md:text-6xl font-black tracking-tight mt-2">
                  {months[month]} {year}
                </h1>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 hover:bg-white/10">←</button>
                <button onClick={() => setViewDate(new Date())} className="rounded-2xl border border-white/10 bg-black/25 px-5 py-3 hover:bg-white/10">Bugün</button>
                <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 hover:bg-white/10">→</button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-4 gap-2">
              <MiniStat label="Bugün" value={stats.today} />
              <MiniStat label="Bu Ay" value={stats.month} />
              <MiniStat label="Kritik" value={stats.critical} danger />
              <MiniStat label="Tamam" value={stats.done} />
            </div>
          </div>
        </header>

        <section className="rounded-[34px] border border-white/10 bg-white/[0.035] p-3 md:p-5">
          <div className="grid grid-cols-7 gap-2 mb-3">
            {days.map((d) => (
              <div key={d} className="text-center text-xs text-white/40 py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {allDays.map((day, i) => {
              if (!day) return <div key={i} className="aspect-square" />;

              const dKey = key(day);
              const dayEvents = grouped[dKey] || [];
              const selected = selectedDate === dKey;
              const isToday = dKey === key(today);
              const strongest =
                dayEvents.find((e) => e.priority === "critical") ||
                dayEvents.find((e) => e.priority === "high") ||
                dayEvents[0];

              return (
                <button
                  key={dKey}
                  onClick={() => setSelectedDate(dKey)}
                  className={`aspect-square rounded-[22px] border p-2 md:p-3 text-left transition relative overflow-hidden ${
                    selected
                      ? "border-blue-400 bg-blue-500/15"
                      : "border-white/10 bg-black/20 hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-black ${isToday ? "text-blue-300" : "text-white"}`}>
                      {day.getDate()}
                    </span>

                    {dayEvents.length > 0 && (
                      <span className={`h-3 w-3 rounded-full shadow-lg ${riskDot(strongest?.priority)}`} />
                    )}
                  </div>

                  {dayEvents.length > 0 && (
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="text-[10px] md:text-xs font-bold truncate">
                        {strongest?.title}
                      </div>
                      <div className="text-[10px] text-white/45 truncate">
                        {riskLabel(strongest?.priority)} · {dayEvents.length} kayıt
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-[34px] border border-white/10 bg-white/[0.045] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-white/45 text-sm">Seçili Gün</p>
              <h2 className="text-2xl md:text-3xl font-black mt-1">
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "long",
                  weekday: "long",
                })}
              </h2>
            </div>

            <a href="/search" className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm hover:bg-white/10">
              Ara
            </a>
          </div>

          <div className="mt-5">
            {loading ? (
              <div className="text-white/50">Yükleniyor...</div>
            ) : selectedEvents.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-black/25 p-5 text-white/55">
                Bu gün için kayıt yok.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedEvents.map((e) => (
                  <div key={e.id} className="rounded-3xl border border-white/10 bg-black/25 p-5">
                    <div className="flex gap-3">
                      <span className={`mt-1 h-3 w-3 rounded-full ${riskDot(e.priority)}`} />
                      <div>
                        <h3 className="font-black text-lg">{e.title}</h3>
                        <p className="text-sm text-white/45 mt-1">
                          {e.event_type || "legal_deadline"} · {riskLabel(e.priority)}
                        </p>
                        {e.description && (
                          <p className="text-sm text-white/60 mt-3 line-clamp-3">{e.description}</p>
                        )}
                        <div className="mt-4 flex gap-2">
                          <a href="/cases" className="rounded-xl bg-white text-black px-4 py-2 text-sm font-bold">Dosyaya Git</a>
                          <a href="/dashboard-v2" className="rounded-xl border border-white/10 px-4 py-2 text-sm">Dashboard</a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function MiniStat({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3 ${danger ? "border-red-500/25 bg-red-500/10" : "border-white/10 bg-black/20"}`}>
      <div className="text-[11px] text-white/45">{label}</div>
      <div className="text-2xl font-black mt-1">{value}</div>
    </div>
  );
}
