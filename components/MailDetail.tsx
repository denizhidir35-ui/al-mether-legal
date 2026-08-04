"use client";

import { useEffect, useState } from "react";

type Attachment = {
  filename: string;
  mimeType?: string;
  size?: number;
  attachmentId?: string;
};

type Props = {
  title?: string;
  sender?: string;
  body?: string;
  deadline?: string;
  type?: string;
  risk?: string;
  attachments?: Attachment[];
};

type AIAnalysis = {
  davaTuru: string;
  mahkeme: string;
  dosyaNo: string;
  kurum: string;
  risk: string;
  sonTarih: string;
  confidence: number;
  ozet: string;
  yapilacaklar: string[];
};

function addDaysIsoClient(date: string, days: number) {
  const base = new Date(`${date}T12:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function toIsoClient(day: string, month: string, year: string) {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function turkishMonthToNumber(value: string) {
  const key = value
    .toLowerCase()
    .replace(/\./g, "")
    .replace("ı", "i")
    .replace("ğ", "g")
    .replace("ü", "u")
    .replace("ş", "s")
    .replace("ö", "o")
    .replace("ç", "c");

  const months: Record<string, string> = {
    ocak: "01",
    oca: "01",
    subat: "02",
    sub: "02",
    mart: "03",
    mar: "03",
    nisan: "04",
    nis: "04",
    mayis: "05",
    may: "05",
    haziran: "06",
    haz: "06",
    temmuz: "07",
    tem: "07",
    agustos: "08",
    agu: "08",
    eylul: "09",
    eyl: "09",
    ekim: "10",
    eki: "10",
    kasim: "11",
    kas: "11",
    aralik: "12",
    ara: "12",
  };

  return months[key] || "";
}

function cleanDateClient(value: unknown) {
  if (!value || typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const dotDate = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(20\d{2})$/);
  if (dotDate) return toIsoClient(dotDate[1], dotDate[2], dotDate[3]);

  const slashDate = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  if (slashDate) return toIsoClient(slashDate[1], slashDate[2], slashDate[3]);

  const trDate = trimmed.match(/^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü.]+)\s+(20\d{2})$/i);
  if (trDate) {
    const month = turkishMonthToNumber(trDate[2]);
    if (month) return toIsoClient(trDate[1], month, trDate[3]);
  }

  return "";
}

function extractDeadlineFromMail(text: string) {
  const normalized = text.replace(/\s+/g, " ");

  const patterns = [
    /(\d{1,2}\.\d{1,2}\.20\d{2})\s+\d{1,2}:\d{2}\s+tarihinde/i,
    /(\d{1,2}\/\d{1,2}\/20\d{2})\s+\d{1,2}:\d{2}\s+tarihinde/i,
    /date:\s*(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü.]+\s+20\d{2})/i,
    /(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü.]+\s+20\d{2})[^0-9]{0,40}\d{1,2}:\d{2}/i,
    /(\d{1,2}\.\d{1,2}\.20\d{2})/i,
    /(\d{1,2}\/\d{1,2}\/20\d{2})/i,
    /(\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü.]+\s+20\d{2})/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const iso = cleanDateClient(match?.[1] || "");

    if (iso) {
      return addDaysIsoClient(iso, 5);
    }
  }

  return "-";
}

function normalizeAnalysisResponse(data: any, mailText: string): AIAnalysis {
  const raw = data?.analysis || data?.data?.analysis || {};

  const apiDeadline =
    cleanDateClient(raw?.sonTarih) ||
    cleanDateClient(raw?.son_tarih) ||
    cleanDateClient(raw?.deadline) ||
    cleanDateClient(raw?.legalDeadline) ||
    cleanDateClient(raw?.dates?.deadline);

  const fallbackDeadline = extractDeadlineFromMail(mailText);

  return {
    davaTuru: raw?.davaTuru || raw?.caseType || raw?.case_type || "Elektronik Tebligat",
    mahkeme: raw?.mahkeme || raw?.court || "-",
    dosyaNo: raw?.dosyaNo || raw?.fileNo || raw?.file_number || "-",
    kurum: raw?.kurum || raw?.institution || raw?.organization || "-",
    risk: raw?.risk || raw?.riskLevel || raw?.risk_level || "Orta",
    sonTarih: apiDeadline || fallbackDeadline || "-",
    confidence: Number(raw?.confidence || raw?.score || 75),
    ozet: raw?.ozet || raw?.summary || "-",
    yapilacaklar: Array.isArray(raw?.yapilacaklar)
      ? raw.yapilacaklar
      : Array.isArray(raw?.todos)
      ? raw.todos
      : Array.isArray(raw?.tasks)
      ? raw.tasks
      : [],
  };
}

export default function MailDetail({
  title = "Bir mail seçin",
  sender = "-",
  body = "Mail içeriği bulunamadı.",
  deadline = "-",
  type = "Analiz Bekliyor",
  risk = "Analiz Bekliyor",
  attachments = [],
}: Props) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [caseType, setCaseType] = useState(type);
  const [riskLevel, setRiskLevel] = useState(risk);
  const [calendarDate, setCalendarDate] = useState(deadline);
  const [court, setCourt] = useState("-");
  const [fileNo, setFileNo] = useState("-");
  const [confidence, setConfidence] = useState("-");
  const [summary, setSummary] = useState("-");
  const [todos, setTodos] = useState<string[]>([]);
  const [autoCalendarSuccess, setAutoCalendarSuccess] = useState(false);
  const [autoCalendarError, setAutoCalendarError] = useState("");
  const [calendarEventLink, setCalendarEventLink] = useState("");

  useEffect(() => {
    setCaseType(type);
    setRiskLevel(risk);
    setCalendarDate(deadline);
    setAnalysis("");
    setCourt("-");
    setFileNo("-");
    setConfidence("-");
    setSummary("-");
    setTodos([]);
    setAutoCalendarSuccess(false);
    setAutoCalendarError("");
    setCalendarEventLink("");
  }, [title, sender, body, deadline, type, risk]);

  async function saveToLegalOs(params: {
    subject: string;
    sender: string;
    mail_body: string;
    snippet?: string;
    dava_turu: string;
    risk: string;
    son_tarih: string;
    mahkeme: string;
    dosya_no: string;
    ai_summary: string;
    confidence: number;
    source?: string;
  }) {
    if (!params.son_tarih || params.son_tarih === "-") {
      throw new Error("Son tarih bulunamadı.");
    }

    setCalendarLoading(true);

    try {
      const res = await fetch("/api/cases/from-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "AL Mether Calendar kaydı oluşturulamadı.");
      }

      setCalendarEventLink("/cases");
      return data;
    } finally {
      setCalendarLoading(false);
    }
  }

  async function addToCalendar() {
    try {
      setAutoCalendarError("");

      await saveToLegalOs({
        subject: title,
        sender,
        mail_body: body,
        snippet: body?.slice?.(0, 300) || "",
        dava_turu: caseType,
        risk: riskLevel,
        son_tarih: calendarDate,
        mahkeme: court,
        dosya_no: fileNo,
        ai_summary: summary,
        confidence: Number(String(confidence).replace("%", "")) || 0,
        source: "manual",
      });

      setAutoCalendarSuccess(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AL Calendar kaydı başarısız.";

      setAutoCalendarError(message);
    }
  }

  async function createWordReport() {
    try {
      setReportLoading(true);

      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          sender,
          body,
          caseType,
          riskLevel,
          calendarDate,
          court,
          fileNo,
          summary,
          todos,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Rapor oluşturulamadı.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = `${title || "al-mether-legal-rapor"}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rapor hatası.";
      alert(message);
    } finally {
      setReportLoading(false);
    }
  }

  async function runAIAnalysis() {
    try {
      setLoading(true);
      setAutoCalendarSuccess(false);
      setAutoCalendarError("");
      setCalendarEventLink("");

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: title,
          sender,
          body,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "AI analizi başarısız oldu.");
      }

      const found = normalizeAnalysisResponse(data, `${title}\n${body}`);

      setCaseType(found.davaTuru);
      setRiskLevel(found.risk);
      setCalendarDate(found.sonTarih);
      setCourt(found.mahkeme);
      setFileNo(found.dosyaNo);
      setConfidence(`${found.confidence}%`);
      setSummary(found.ozet);
      setTodos(found.yapilacaklar);
      setAnalysis("completed");

      const backendCreated =
        data?.calendarEvent ||
        data?.storedCalendarEvent ||
        data?.deadline ||
        data?.data?.calendarEvent ||
        data?.data?.storedCalendarEvent ||
        data?.data?.deadline;

      if (backendCreated) {
        setAutoCalendarSuccess(true);
        setCalendarEventLink("/cases");
        return;
      }

      if (found.sonTarih && found.sonTarih !== "-") {
        await saveToLegalOs({
          subject: title,
          sender,
          mail_body: body,
          snippet: body?.slice?.(0, 300) || "",
          dava_turu: found.davaTuru,
          risk: found.risk,
          son_tarih: found.sonTarih,
          mahkeme: found.mahkeme,
          dosya_no: found.dosyaNo,
          ai_summary: found.ozet,
          confidence: found.confidence,
          source: "gmail_ai",
        });

        setAutoCalendarSuccess(true);
        return;
      }

      setAutoCalendarError(
        "AI son tarih bulamadığı için AL Calendar kaydı oluşturulmadı."
      );
    } catch (error) {
      setAnalysis("error");

      const message =
        error instanceof Error ? error.message : "AI analizi sırasında hata oluştu.";

      setSummary(message);
      setAutoCalendarError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <div style={smallLabel}>Mail Detayı</div>
          <h2 style={titleStyle}>{title}</h2>
          <p style={senderStyle}>{sender}</p>
        </div>

        <RiskBadge value={riskLevel} />
      </div>

      <div style={gridStyle}>
        <InfoCard label="Dava Türü" value={caseType} />
        <InfoCard label="Son Tarih" value={calendarDate} highlight />
        <InfoCard label="Mahkeme" value={court} />
        <InfoCard label="Dosya No" value={fileNo} />
        <InfoCard label="Güven" value={confidence} />
      </div>

      <div style={sectionBox}>
        <div style={sectionTitle}>Mail İçeriği</div>
        <div style={mailBodyStyle}>{body}</div>
      </div>

      <div style={sectionBox}>
        <div style={sectionTitle}>Mail Ekleri</div>

        {attachments.length === 0 ? (
          <p style={mutedText}>Bu mailde ek bulunamadı.</p>
        ) : (
          <div style={attachmentList}>
            {attachments.map((file, index) => (
              <div key={`${file.filename}-${index}`} style={attachmentItem}>
                <div style={{ minWidth: 0 }}>
                  <div style={attachmentName}>{file.filename}</div>
                  <div style={attachmentMeta}>
                    {file.mimeType || "Dosya"} ·{" "}
                    {file.size ? `${Math.round(file.size / 1024)} KB` : "-"}
                  </div>
                </div>

                <button style={attachmentBtn}>Analiz Et</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={analysisBox}>
        <div style={analysisHeader}>
          <div>
            <div style={sectionTitle}>AL Analiz Sonucu</div>
            <p style={mutedText}>
              Dava bilgileri, risk ve kritik tarih çıkarımı
            </p>
          </div>

          {(loading || calendarLoading) && (
            <span style={loadingBadge}>
              {loading ? "Analiz ediliyor..." : "Takvim hazırlanıyor..."}
            </span>
          )}
        </div>

        {autoCalendarSuccess && (
          <div style={successState}>
            Takvim kaydı ve alarm hatırlatmaları otomatik oluşturuldu.
            {calendarEventLink && (
              <div style={{ marginTop: 8 }}>
                <a
                  href={calendarEventLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#86efac", textDecoration: "underline" }}
                >
                  AL Calendar’da aç
                </a>
              </div>
            )}
          </div>
        )}

        {autoCalendarError && <div style={errorState}>{autoCalendarError}</div>}

        {!loading && !analysis ? (
          <div style={emptyState}>Mail seçildikten sonra AI analiz başlatın.</div>
        ) : (
          <>
            <div style={summaryBox}>
              <div style={sectionTitle}>Özet</div>
              <p style={summaryText}>{summary}</p>
            </div>

            <div style={todoBox}>
              <div style={sectionTitle}>Yapılacaklar</div>

              {todos.length === 0 ? (
                <p style={mutedText}>Henüz görev çıkarılmadı.</p>
              ) : (
                todos.map((todo, index) => (
                  <div key={index} style={todoItem}>
                    <span style={checkIcon}>✓</span>
                    <span>{todo}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div style={actionBar}>
        <button
          onClick={runAIAnalysis}
          style={primaryBtn}
          disabled={loading || calendarLoading}
        >
          {loading ? "Analiz Ediliyor" : "AI Analiz Et"}
        </button>

        <button
          onClick={addToCalendar}
          style={secondaryBtn}
          disabled={calendarLoading}
        >
          {calendarLoading ? "Takvim..." : "AL Takvimine Ekle"}
        </button>

        <button
          onClick={createWordReport}
          style={secondaryBtn}
          disabled={reportLoading}
        >
          {reportLoading ? "Oluşturuluyor" : "Word Oluştur"}
        </button>

        <button style={secondaryBtn} disabled={calendarLoading}>
          Alarm Kuruldu
        </button>
      </div>
    </section>
  );
}

function InfoCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={infoCardStyle}>
      <div style={cardLabel}>{label}</div>
      <div
        style={{
          ...cardValue,
          color: highlight ? "#facc15" : "white",
        }}
      >
        {value || "-"}
      </div>
    </div>
  );
}

function RiskBadge({ value }: { value: string }) {
  const color =
    value === "Yüksek" || value === "Kritik"
      ? "#ef4444"
      : value === "Orta"
      ? "#f97316"
      : value === "Analiz Bekliyor"
      ? "#60a5fa"
      : "#22c55e";

  return (
    <div
      style={{
        border: `1px solid ${color}`,
        color,
        background: `${color}22`,
        padding: "8px 12px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {value}
    </div>
  );
}

const containerStyle = {
  background: "linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.92))",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 28,
  padding: 18,
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 18,
  flexWrap: "wrap" as const,
};

const smallLabel = {
  color: "#60a5fa",
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 8,
};

const titleStyle = {
  color: "white",
  fontSize: 22,
  lineHeight: 1.3,
  margin: 0,
};

const senderStyle = {
  color: "#94a3b8",
  marginTop: 8,
  fontSize: 13,
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
  gap: 12,
  marginBottom: 14,
};

const infoCardStyle = {
  background: "rgba(255,255,255,0.045)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 18,
  padding: 14,
  minWidth: 0,
};

const cardLabel = {
  color: "#94a3b8",
  fontSize: 12,
  marginBottom: 8,
};

const cardValue = {
  fontWeight: 800,
  fontSize: 14,
  wordBreak: "break-word" as const,
};

const sectionBox = {
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 18,
  padding: 16,
  marginBottom: 14,
};

const sectionTitle = {
  color: "white",
  fontWeight: 800,
  marginBottom: 8,
};

const mailBodyStyle = {
  color: "#cbd5e1",
  lineHeight: 1.75,
  fontSize: 14,
  whiteSpace: "pre-wrap" as const,
  maxHeight: 260,
  overflowY: "auto" as const,
};

const attachmentList = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
};

const attachmentItem = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  background: "rgba(2,6,23,0.35)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: 12,
};

const attachmentName = {
  color: "white",
  fontWeight: 800,
  fontSize: 13,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap" as const,
};

const attachmentMeta = {
  color: "#94a3b8",
  fontSize: 11,
  marginTop: 4,
};

const attachmentBtn = {
  background: "rgba(59,130,246,0.14)",
  border: "1px solid rgba(59,130,246,0.25)",
  color: "#93c5fd",
  borderRadius: 12,
  padding: "8px 10px",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
};

const analysisBox = {
  background: "linear-gradient(180deg,rgba(37,99,235,0.13),rgba(15,23,42,0.2))",
  border: "1px solid rgba(96,165,250,0.22)",
  borderRadius: 22,
  padding: 16,
  marginBottom: 14,
};

const analysisHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  marginBottom: 14,
  flexWrap: "wrap" as const,
};

const mutedText = {
  color: "#94a3b8",
  fontSize: 13,
  margin: 0,
  lineHeight: 1.6,
};

const loadingBadge = {
  color: "#93c5fd",
  background: "rgba(59,130,246,0.15)",
  border: "1px solid rgba(59,130,246,0.25)",
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};

const emptyState = {
  color: "#94a3b8",
  padding: 16,
  borderRadius: 14,
  background: "rgba(255,255,255,0.03)",
};

const successState = {
  color: "#86efac",
  background: "rgba(34,197,94,0.12)",
  border: "1px solid rgba(34,197,94,0.28)",
  padding: 12,
  borderRadius: 14,
  marginBottom: 12,
  fontWeight: 800,
};

const errorState = {
  color: "#fecaca",
  background: "rgba(239,68,68,0.1)",
  border: "1px solid rgba(239,68,68,0.22)",
  padding: 12,
  borderRadius: 14,
  marginBottom: 12,
  fontWeight: 800,
};

const summaryBox = {
  background: "rgba(2,6,23,0.35)",
  borderRadius: 16,
  padding: 14,
  marginBottom: 12,
};

const summaryText = {
  color: "#e2e8f0",
  lineHeight: 1.7,
  margin: 0,
};

const todoBox = {
  background: "rgba(2,6,23,0.25)",
  borderRadius: 16,
  padding: 14,
};

const todoItem = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  color: "#e2e8f0",
  marginBottom: 9,
  lineHeight: 1.5,
};

const checkIcon = {
  background: "#22c55e",
  color: "#052e16",
  borderRadius: 999,
  width: 18,
  height: 18,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 900,
  flexShrink: 0,
};

const actionBar = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap" as const,
};

const primaryBtn = {
  background: "linear-gradient(to right,#7c3aed,#2563eb)",
  border: "none",
  borderRadius: 14,
  padding: "12px 16px",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryBtn = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 14,
  padding: "12px 16px",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};
