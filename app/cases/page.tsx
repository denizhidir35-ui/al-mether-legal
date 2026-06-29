"use client";

import { useEffect, useMemo, useState } from "react";

type LegalDeadline = {
  id: string;
  title: string | null;
  calculated_due_date: string | null;
  status: string | null;
  ai_confidence: number | null;
};

type CaseMail = {
  id: string;
  subject: string | null;
  sender: string | null;
  received_at: string | null;
};

type LegalCase = {
  id: string;
  case_number: string | null;
  court_name: string | null;
  case_title: string;
  case_type: string | null;
  status: string | null;
  risk_level: string | null;
  source: string | null;
  created_at: string;
  legal_deadlines?: LegalDeadline[];
  case_mails?: CaseMail[];
};

function daysLeft(dateValue?: string | null) {
  if (!dateValue) return null;

  const today = new Date();
  const target = new Date(`${dateValue}T00:00:00`);

  today.setHours(0, 0, 0, 0);

  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function riskClass(risk?: string | null) {
  if (risk === "critical") return "bg-red-500/15 text-red-300 border-red-500/30";
  if (risk === "high") return "bg-orange-500/15 text-orange-300 border-orange-500/30";
  if (risk === "low") return "bg-green-500/15 text-green-300 border-green-500/30";
  return "bg-blue-500/15 text-blue-300 border-blue-500/30";
}

export default function CasesPage() {
  const [cases, setCases] = useState<LegalCase[]>([]);
  const [loading, setLoading] = useState(true);

  const [caseTitle, setCaseTitle] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [courtName, setCourtName] = useState("");
  const [creating, setCreating] = useState(false);

  const stats = useMemo(() => {
    const total = cases.length;
    const critical = cases.filter((item) => item.risk_level === "critical").length;
    const active = cases.filter((item) => item.status === "active").length;

    return { total, critical, active };
  }, [cases]);

  const loadCases = async () => {
    setLoading(true);
    const res = await fetch("/api/cases");
    const json = await res.json();
    setCases(json.cases || []);
    setLoading(false);
  };

  const createCase = async () => {
    if (!caseTitle.trim()) return;

    setCreating(true);

    await fetch("/api/cases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        case_title: caseTitle,
        case_number: caseNumber || null,
        court_name: courtName || null,
        case_type: "Tebligat",
        risk_level: "normal",
        source: "manual",
      }),
    });

    setCaseTitle("");
    setCaseNumber("");
    setCourtName("");
    await loadCases();
    setCreating(false);
  };

  useEffect(() => {
    loadCases();
  }, []);

  return (
    <main className="min-h-screen bg-[#050816] text-white px-4 py-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <p className="text-sm text-blue-300">AL Mether Legal OS</p>
          <h1 className="text-3xl font-bold mt-1">Dosyalar</h1>
          <p className="text-white/55 mt-2">
            Tebligatlar, süreler, alarmlar ve AI analizleri dosya merkezinde toplanır.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/50 text-sm">Toplam</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-white/50 text-sm">Aktif</div>
            <div className="text-2xl font-bold mt-1">{stats.active}</div>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <div className="text-red-200/80 text-sm">Kritik</div>
            <div className="text-2xl font-bold mt-1">{stats.critical}</div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5 mb-6">
          <h2 className="font-semibold mb-4">Manuel dosya ekle</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={caseTitle}
              onChange={(e) => setCaseTitle(e.target.value)}
              placeholder="Dosya başlığı"
              className="rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none"
            />

            <input
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              placeholder="Dosya no"
              className="rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none"
            />

            <input
              value={courtName}
              onChange={(e) => setCourtName(e.target.value)}
              placeholder="Mahkeme"
              className="rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none"
            />

            <button
              onClick={createCase}
              disabled={creating}
              className="rounded-xl bg-blue-600 px-4 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {creating ? "Ekleniyor..." : "Dosya Ekle"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
            Dosyalar yükleniyor...
          </div>
        ) : cases.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
            Henüz dosya yok. Tebligat analiz edildiğinde dosya otomatik oluşacak.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {cases.map((item) => {
              const firstDeadline = item.legal_deadlines?.[0];
              const left = daysLeft(firstDeadline?.calculated_due_date);

              return (
                <div
                  key={item.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.07] transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-white/45">
                        {item.court_name || "Mahkeme belirtilmedi"}
                      </div>

                      <h3 className="font-bold text-lg mt-1">{item.case_title}</h3>

                      <div className="text-sm text-white/50 mt-1">
                        Dosya No: {item.case_number || "-"}
                      </div>
                    </div>

                    <span
                      className={`text-xs px-3 py-1 rounded-full border ${riskClass(
                        item.risk_level
                      )}`}
                    >
                      {item.risk_level || "normal"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-5">
                    <div className="rounded-2xl bg-black/25 border border-white/10 p-3">
                      <div className="text-xs text-white/45">Son gün</div>
                      <div className="font-semibold mt-1">
                        {firstDeadline?.calculated_due_date || "-"}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-black/25 border border-white/10 p-3">
                      <div className="text-xs text-white/45">Kalan</div>
                      <div className="font-semibold mt-1">
                        {left === null ? "-" : left < 0 ? "Geçti" : `${left} gün`}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-black/25 border border-white/10 p-3">
                      <div className="text-xs text-white/45">Tebligat</div>
                      <div className="font-semibold mt-1">{item.case_mails?.length || 0}</div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <div className="text-xs text-white/40">
                      Kaynak: {item.source || "gmail"}
                    </div>

                    <button className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/10">
                      Detay
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
