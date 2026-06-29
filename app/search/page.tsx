"use client";

import { useMemo, useState } from "react";

type SearchData = {
  query: string;
  cases: any[];
  mails: any[];
  events: any[];
  alarms: any[];
};

const emptyData: SearchData = {
  query: "",
  cases: [],
  mails: [],
  events: [],
  alarms: [],
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [data, setData] = useState<SearchData>(emptyData);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const total = useMemo(() => {
    return (
      data.cases.length +
      data.mails.length +
      data.events.length +
      data.alarms.length
    );
  }, [data]);

  const runSearch = async () => {
    const q = query.trim();

    if (q.length < 2) return;

    setLoading(true);
    setSearched(true);

    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const json = await res.json();

    setData({
      query: json.query || q,
      cases: json.cases || [],
      mails: json.mails || [],
      events: json.events || [],
      alarms: json.alarms || [],
    });

    setLoading(false);
  };

  const showCases = activeTab === "all" || activeTab === "cases";
  const showMails = activeTab === "all" || activeTab === "mails";
  const showEvents = activeTab === "all" || activeTab === "events";
  const showAlarms = activeTab === "all" || activeTab === "alarms";

  return (
    <main className="min-h-screen bg-[#050816] text-white px-4 py-5 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="text-sm text-blue-300">AL Mether Universal Search</p>
          <h1 className="text-3xl font-bold mt-1">Ara</h1>
          <p className="text-white/55 mt-2">
            Dosya, kişi, mahkeme, mail, takvim ve alarm kayıtlarında tek yerden ara.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5 mb-5">
          <div className="flex flex-col md:flex-row gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
              placeholder="Dosya no, isim, mahkeme, tebligat veya komut yaz..."
              className="flex-1 rounded-2xl bg-black/30 border border-white/10 px-5 py-4 outline-none text-base"
              autoFocus
            />

            <button
              onClick={runSearch}
              disabled={loading || query.trim().length < 2}
              className="rounded-2xl bg-blue-600 px-6 py-4 font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Aranıyor..." : "Ara"}
            </button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <Tab id="all" label={`Hepsi ${total}`} activeTab={activeTab} setActiveTab={setActiveTab} />
            <Tab id="cases" label={`Dosyalar ${data.cases.length}`} activeTab={activeTab} setActiveTab={setActiveTab} />
            <Tab id="mails" label={`Mailler ${data.mails.length}`} activeTab={activeTab} setActiveTab={setActiveTab} />
            <Tab id="events" label={`Takvim ${data.events.length}`} activeTab={activeTab} setActiveTab={setActiveTab} />
            <Tab id="alarms" label={`Alarmlar ${data.alarms.length}`} activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
        </div>

        {!searched ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {["2026/145", "İstinaf", "İzmir BAM", "Bugün"].map((item) => (
              <button
                key={item}
                onClick={() => setQuery(item)}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10"
              >
                <div className="text-white/45 text-xs">Örnek arama</div>
                <div className="font-semibold mt-1">{item}</div>
              </button>
            ))}
          </div>
        ) : total === 0 && !loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/55">
            Sonuç bulunamadı.
          </div>
        ) : (
          <div className="space-y-5">
            {showCases && data.cases.length > 0 && (
              <Section title="Dosyalar" icon="📂">
                {data.cases.map((item) => (
                  <ResultCard
                    key={item.id}
                    title={item.case_title}
                    subtitle={`${item.court_name || "Mahkeme yok"} · ${item.case_number || "Dosya no yok"}`}
                    meta={`${item.case_type || "Dosya"} · Risk: ${item.risk_level || "normal"}`}
                    href={`/cases`}
                  />
                ))}
              </Section>
            )}

            {showMails && data.mails.length > 0 && (
              <Section title="Mailler" icon="📧">
                {data.mails.map((item) => (
                  <ResultCard
                    key={item.id}
                    title={item.subject || "Başlıksız mail"}
                    subtitle={item.sender || "Gönderen yok"}
                    meta={item.snippet || item.ai_summary || "Mail sonucu"}
                    href="/"
                  />
                ))}
              </Section>
            )}

            {showEvents && data.events.length > 0 && (
              <Section title="AL Calendar" icon="📅">
                {data.events.map((item) => (
                  <ResultCard
                    key={item.id}
                    title={item.title}
                    subtitle={`Son gün: ${item.due_date || "-"}`}
                    meta={`${item.event_type || "event"} · ${item.priority || "normal"}`}
                    href="/calendar"
                  />
                ))}
              </Section>
            )}

            {showAlarms && data.alarms.length > 0 && (
              <Section title="Alarmlar" icon="🔔">
                {data.alarms.map((item) => (
                  <ResultCard
                    key={item.id}
                    title={item.message || item.alarm_type || "Alarm"}
                    subtitle={item.alarm_time || "-"}
                    meta={`Durum: ${item.status || "pending"}`}
                    href="/calendar"
                  />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Tab({
  id,
  label,
  activeTab,
  setActiveTab,
}: {
  id: string;
  label: string;
  activeTab: string;
  setActiveTab: (id: string) => void;
}) {
  const active = activeTab === id;

  return (
    <button
      onClick={() => setActiveTab(id)}
      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm border ${
        active
          ? "bg-white text-black border-white"
          : "bg-white/5 text-white/70 border-white/10"
      }`}
    >
      {label}
    </button>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span>{icon}</span>
        <h2 className="font-bold text-lg">{title}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function ResultCard({
  title,
  subtitle,
  meta,
  href,
}: {
  title: string;
  subtitle: string;
  meta: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="rounded-3xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.08] transition block"
    >
      <div className="font-bold">{title}</div>
      <div className="text-white/55 text-sm mt-1">{subtitle}</div>
      <div className="text-white/40 text-xs mt-3 line-clamp-2">{meta}</div>
    </a>
  );
}
