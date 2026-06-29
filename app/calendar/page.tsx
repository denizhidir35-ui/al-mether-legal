"use client";

import { CalendarRoot } from "@/components/calendar/CalendarRoot";
import { CalendarEventList } from "@/components/calendar/CalendarEventList";

export default function CalendarPage() {
  return (
    <CalendarRoot>
      <main className="min-h-screen bg-slate-100 p-4 sm:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              AL METHER LEGAL
            </div>

            <h1 className="mt-3 text-2xl font-black sm:text-4xl">
              Canlı Hukuk Takvimi
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              AI analizinden gelen hukuki süreler, risk seviyeleri ve hatırlatma kayıtları burada listelenir.
            </p>
          </header>

          <CalendarEventList />
        </div>
      </main>
    </CalendarRoot>
  );
}
