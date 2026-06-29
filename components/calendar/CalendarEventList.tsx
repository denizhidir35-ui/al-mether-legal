"use client";

import { useMemo } from "react";
import { useCalendar } from "@/components/calendar/CalendarProvider";

function getRiskClass(risk: string) {
  const value = risk.toLowerCase();

  if (value.includes("kritik")) return "border-red-500 bg-red-50 text-red-800";
  if (value.includes("yüksek")) return "border-orange-500 bg-orange-50 text-orange-800";
  if (value.includes("orta")) return "border-yellow-500 bg-yellow-50 text-yellow-800";
  if (value.includes("düşük")) return "border-green-500 bg-green-50 text-green-800";

  return "border-slate-300 bg-slate-50 text-slate-700";
}

function formatDate(date: string) {
  if (!date) return "-";

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(`${date}T12:00:00`));
  } catch {
    return date;
  }
}

export function CalendarEventList() {
  const { events, loading, error, refresh } = useCalendar();

  const groupedEvents = useMemo(() => {
    return events.reduce<Record<string, typeof events>>((acc, event) => {
      const key = event.startDate || "Tarihsiz";
      acc[key] = acc[key] || [];
      acc[key].push(event);
      return acc;
    }, {});
  }, [events]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Takvim kayıtları yükleniyor...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="text-sm font-semibold text-red-700">Takvim hatası</div>
        <div className="mt-1 text-sm text-red-600">{error}</div>
        <button
          onClick={refresh}
          className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Henüz takvim kaydı yok.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {Object.entries(groupedEvents).map(([date, dateEvents]) => (
        <section key={date} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-sm font-bold text-slate-900">{formatDate(date)}</div>

          <div className="space-y-3">
            {dateEvents.map((event) => (
              <article
                key={event.id}
                className={`rounded-xl border-l-4 p-4 ${getRiskClass(event.risk)}`}
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold">{event.title}</h3>
                    {event.description ? (
                      <p className="mt-1 whitespace-pre-line text-sm opacity-90">
                        {event.description}
                      </p>
                    ) : null}
                  </div>

                  {event.risk ? (
                    <span className="mt-2 inline-flex w-fit rounded-full bg-white/70 px-3 py-1 text-xs font-bold sm:mt-0">
                      {event.risk}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs opacity-80">
                  <span>Kaynak: {event.source || "-"}</span>
                  {event.sourceId ? <span>Mail ID: {event.sourceId}</span> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
