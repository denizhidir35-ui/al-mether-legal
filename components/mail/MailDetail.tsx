"use client";

import { useEffect, useMemo, useState } from "react";

type Attachment = {
  filename: string;
  mimeType?: string;
  size?: number;
  attachmentId?: string;
  url?: string;
};

type Props = {
messageId?: string;
title?: string;
  sender?: string;
  body?: string;
  deadline?: string;
  type?: string;
  risk?: string;
  attachments?: Attachment[];
};

type UetsExtraction = {
  found: boolean;
  institution: string;
  noticeType: string;

  arrivalDate: string;
  arrivalTime: string;
  arrivalDateTime: string;
  deemedServiceDate: string;

  court: string;
  fileNo: string;
  barcodeNo: string;
  recipient: string;
  subject: string;

  confidence: number;
  warnings: string[];
};

type LegalAnalysis = {
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

type AnalysisResponse = {
  ok?: boolean;
  error?: string;

  extractionMode?: string;
  uetsExtraction?: Partial<UetsExtraction>;
  analysis?: Partial<LegalAnalysis>;

  deadline?: unknown;
  calendarEvent?: unknown;
  storedCalendarEvent?: unknown;
  reminders?: unknown;

  data?: {
    extractionMode?: string;
    uetsExtraction?: Partial<UetsExtraction>;
    analysis?: Partial<LegalAnalysis>;

    deadline?: unknown;
    calendarEvent?: unknown;
    storedCalendarEvent?: unknown;
    reminders?: unknown;
  };
};

const EMPTY_UETS: UetsExtraction = {
  found: false,
  institution: "",
  noticeType: "",

  arrivalDate: "",
  arrivalTime: "",
  arrivalDateTime: "",
  deemedServiceDate: "",

  court: "",
  fileNo: "",
  barcodeNo: "",
  recipient: "",
  subject: "",

  confidence: 0,
  warnings: [],
};

const EMPTY_ANALYSIS: LegalAnalysis = {
  davaTuru: "",
  mahkeme: "",
  dosyaNo: "",
  kurum: "",
  risk: "",
  sonTarih: "",
  confidence: 0,
  ozet: "",
  yapilacaklar: [],
};

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeNumber(value: unknown): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  if (number > 0 && number <= 1) {
    return Math.round(number * 100);
  }

  return Math.max(0, Math.min(100, Math.round(number)));
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeUetsResponse(
  data: AnalysisResponse
): UetsExtraction {
  const raw =
    data?.uetsExtraction ||
    data?.data?.uetsExtraction ||
    {};

  return {
    found: Boolean(raw?.found),
    institution: safeString(raw?.institution),
    noticeType: safeString(raw?.noticeType),

    arrivalDate: safeString(raw?.arrivalDate),
    arrivalTime: safeString(raw?.arrivalTime),
    arrivalDateTime: safeString(raw?.arrivalDateTime),
    deemedServiceDate: safeString(raw?.deemedServiceDate),

    court: safeString(raw?.court),
    fileNo: safeString(raw?.fileNo),
    barcodeNo: safeString(raw?.barcodeNo),
    recipient: safeString(raw?.recipient),
    subject: safeString(raw?.subject),

    confidence: safeNumber(raw?.confidence),
    warnings: safeStringArray(raw?.warnings),
  };
}

function normalizeAnalysisResponse(
  data: AnalysisResponse,
  uets: UetsExtraction
): LegalAnalysis {
  const raw =
    data?.analysis ||
    data?.data?.analysis ||
    {};

  return {
    davaTuru:
      safeString(raw?.davaTuru) ||
      (uets.found ? "Elektronik Tebligat" : ""),

    mahkeme:
      uets.court ||
      safeString(raw?.mahkeme),

    dosyaNo:
      uets.fileNo ||
      safeString(raw?.dosyaNo),

    kurum:
      uets.institution ||
      safeString(raw?.kurum),

    risk:
      safeString(raw?.risk),

    sonTarih:
      uets.deemedServiceDate ||
      safeString(raw?.sonTarih),

    confidence:
      uets.confidence ||
      safeNumber(raw?.confidence),

    ozet:
      safeString(raw?.ozet) ||
      (uets.found
        ? "PTT UETS elektronik tebligat bildirimi bulundu."
        : ""),

    yapilacaklar:
      safeStringArray(raw?.yapilacaklar),
  };
}

function backendCreatedCalendar(
  data: AnalysisResponse
): boolean {
  return Boolean(
    data?.calendarEvent ||
      data?.storedCalendarEvent ||
      data?.deadline ||
      data?.data?.calendarEvent ||
      data?.data?.storedCalendarEvent ||
      data?.data?.deadline
  );
}

function formatDate(value: string): string {
  if (!value || value === "-") {
    return "-";
  }

  const parsed = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(
  date: string,
  time: string
): string {
  if (!date) {
    return "-";
  }

  return `${formatDate(date)}${time ? ` ${time}` : ""}`;
}

function sanitizeFilename(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export default function MailDetail({
  messageId,
title = "Bir mail seçin",
  sender = "-",
  body = "Mail içeriği bulunamadı.",
  deadline = "-",
  type = "Analiz Bekliyor",
  risk = "",
  attachments = [],
}: Props) {
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] =
    useState(false);
  const [reportLoading, setReportLoading] =
    useState(false);

  const [analysisStatus, setAnalysisStatus] =
    useState<"idle" | "success" | "error">("idle");

  const [uets, setUets] =
    useState<UetsExtraction>(EMPTY_UETS);

  const [analysis, setAnalysis] =
    useState<LegalAnalysis>({
      ...EMPTY_ANALYSIS,
      davaTuru: type === "Analiz Bekliyor" ? "" : type,
      risk,
      sonTarih: deadline === "-" ? "" : deadline,
    });

  const [calendarSuccess, setCalendarSuccess] =
    useState(false);

  const [message, setMessage] = useState("");
  const [calendarEventLink, setCalendarEventLink] =
    useState("");

  const hasSelectedMail =
    title !== "Bir mail seçin" &&
    body !== "Mail içeriği bulunamadı.";

  const displayCaseType =
    analysis.davaTuru || "Analiz Bekliyor";

  const displayDeadline =
    analysis.sonTarih || "-";

  const displayCourt =
    analysis.mahkeme || "-";

  const displayFileNo =
    analysis.dosyaNo || "-";

  const displayConfidence =
    analysis.confidence > 0
      ? `%${analysis.confidence}`
      : "-";

  const extractionLabel = useMemo(() => {
    if (uets.found) {
      return "PTT UETS bulundu";
    }

    if (analysisStatus === "success") {
      return "Mail analiz edildi";
    }

    if (analysisStatus === "error") {
      return "Analiz başarısız";
    }

    return "Analiz bekliyor";
  }, [analysisStatus, uets.found]);

  useEffect(() => {
    setUets(EMPTY_UETS);

    setAnalysis({
      ...EMPTY_ANALYSIS,
      davaTuru:
        type === "Analiz Bekliyor" ? "" : type,
      risk,
      sonTarih:
        deadline === "-" ? "" : deadline,
    });

    setAnalysisStatus("idle");
    setCalendarSuccess(false);
    setCalendarEventLink("");
    setMessage("");
  }, [
    title,
    sender,
    body,
    deadline,
    type,
    risk,
  ]);

  async function saveToLegalCalendar(
    currentAnalysis: LegalAnalysis,
    currentUets: UetsExtraction,
    source: "manual" | "gmail_uets"
  ) {
    if (!currentAnalysis.sonTarih) {
      throw new Error(
        "Takvim kaydı için tebliğ sayılma tarihi bulunamadı."
      );
    }

    setCalendarLoading(true);

    try {
      const response = await fetch(
        "/api/cases/from-analysis",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subject:
              currentUets.subject ||
              title,

            sender,


        gmail_message_id:
          messageId || "",
            mail_body: body,

            snippet:
              body.slice(0, 500),

            dava_turu:
              currentAnalysis.davaTuru,

            risk:
              currentAnalysis.risk,

            son_tarih:
              currentAnalysis.sonTarih,

            mahkeme:
              currentAnalysis.mahkeme,

            dosya_no:
              currentAnalysis.dosyaNo,

            ai_summary:
              currentAnalysis.ozet,

            confidence:
              currentAnalysis.confidence,

            source,

            institution:
              currentAnalysis.kurum,

            arrival_date:
              currentUets.arrivalDate,

            arrival_time:
              currentUets.arrivalTime,

            barcode_no:
              currentUets.barcodeNo,

        attachments:
          (attachments || []).map(
            (attachment) => ({
              filename:
                attachment.filename,

              mimeType:
                attachment.mimeType ||
                "application/octet-stream",

              size:
                attachment.size || 0,

              attachmentId:
                attachment.attachmentId ||
                "",
            })
          ),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "AL Calendar kaydı oluşturulamadı."
        );
      }

      setCalendarSuccess(true);
      setCalendarEventLink("/calendar");

      return data;
    } finally {
      setCalendarLoading(false);
    }
  }

  async function runMailEngine() {
    if (!hasSelectedMail) {
      setMessage("Önce bir mail seçin.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setCalendarSuccess(false);
      setCalendarEventLink("");
      setAnalysisStatus("idle");

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: title,
          sender,
          body,
        }),
      });

      const data =
        (await response.json()) as AnalysisResponse;

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            "Mail okuma motoru çalıştırılamadı."
        );
      }

      const foundUets =
        normalizeUetsResponse(data);

      const foundAnalysis =
        normalizeAnalysisResponse(
          data,
          foundUets
        );

      setUets(foundUets);
      setAnalysis(foundAnalysis);
      setAnalysisStatus("success");

      if (
        foundUets.found &&
        foundUets.deemedServiceDate
      ) {
        setMessage(
          `PTT UETS tebligatı bulundu. Tebliğ sayılma tarihi ${formatDate(
            foundUets.deemedServiceDate
          )}.`
        );
      } else if (foundAnalysis.sonTarih) {
        setMessage(
          `Tarih bulundu: ${formatDate(
            foundAnalysis.sonTarih
          )}.`
        );
      } else {
        setMessage(
          "Mail analiz edildi fakat kesin bir tebliğ sayılma tarihi bulunamadı."
        );
      }

      if (backendCreatedCalendar(data)) {
        setCalendarSuccess(true);
        setCalendarEventLink("/calendar");
      }

      if (foundAnalysis.sonTarih) {
        await saveToLegalCalendar(
          foundAnalysis,
          foundUets,
          "gmail_uets"
        );

        setMessage(
          `Tebliğ sayılma tarihi ${formatDate(
            foundAnalysis.sonTarih
          )} olarak AL Calendar'a kaydedildi.`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Mail okuma sırasında hata oluştu.";

      setAnalysisStatus("error");
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function addToCalendarManually() {
    try {
      setMessage("");

      await saveToLegalCalendar(
        analysis,
        uets,
        "manual"
      );

      setMessage(
        `Tarih ${formatDate(
          analysis.sonTarih
        )} olarak AL Calendar'a eklendi.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Takvim işlemi başarısız."
      );
    }
  }

  async function createWordReport() {
    try {
      setReportLoading(true);
      setMessage("");

      const response = await fetch("/api/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          sender,
          body,

          caseType:
            analysis.davaTuru,

          riskLevel:
            analysis.risk,

          calendarDate:
            analysis.sonTarih,

          court:
            analysis.mahkeme,

          fileNo:
            analysis.dosyaNo,

          institution:
            analysis.kurum,

          summary:
            analysis.ozet,

          todos:
            analysis.yapilacaklar,

          arrivalDate:
            uets.arrivalDate,

          arrivalTime:
            uets.arrivalTime,

          deemedServiceDate:
            uets.deemedServiceDate,

          barcodeNo:
            uets.barcodeNo,
        }),
      });

      if (!response.ok) {
        const errorData =
          await response.json().catch(() => null);

        throw new Error(
          errorData?.error ||
            "Word raporu oluşturulamadı."
        );
      }

      const blob = await response.blob();
      const url =
        window.URL.createObjectURL(blob);

      const anchor =
        document.createElement("a");

      anchor.href = url;
      anchor.download = `${sanitizeFilename(
        title || "al-mether-lawyer"
      )}.docx`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Word raporu oluşturulamadı."
      );
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <section style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ minWidth: 0 }}>
          <div style={smallLabel}>
            Mail Detayı
          </div>

          <h2 style={titleStyle}>
            {title}
          </h2>

          <p style={senderStyle}>
            {sender}
          </p>
        </div>

        <StatusBadge
          status={analysisStatus}
          uetsFound={uets.found}
          label={extractionLabel}
        />
      </div>

      <div style={gridStyle}>
        <InfoCard
          label="Tebligat Türü"
          value={displayCaseType}
        />

        <InfoCard
          label="Tebliğ Sayılma Tarihi"
          value={formatDate(displayDeadline)}
          highlight
        />

        <InfoCard
          label="Mahkeme"
          value={displayCourt}
        />

        <InfoCard
          label="Dosya No"
          value={displayFileNo}
        />

        <InfoCard
          label="Güven"
          value={displayConfidence}
        />
      </div>

      {uets.found && (
        <div style={uetsBox}>
          <div style={sectionTitle}>
            PTT UETS Tebligat Bilgileri
          </div>

          <div style={uetsGrid}>
            <MiniInfo
              label="Ulaşma Tarihi"
              value={formatDateTime(
                uets.arrivalDate,
                uets.arrivalTime
              )}
            />

            <MiniInfo
              label="Tebliğ Sayılma"
              value={formatDate(
                uets.deemedServiceDate
              )}
            />

            <MiniInfo
              label="Barkod No"
              value={uets.barcodeNo || "-"}
            />

            <MiniInfo
              label="Kurum"
              value={
                uets.institution || "PTT UETS"
              }
            />
          </div>
        </div>
      )}

      <div style={sectionBox}>
        <div style={sectionTitle}>
          Mail İçeriği
        </div>

        <div style={mailBodyStyle}>
          {body}
        </div>
      </div>

      <div style={sectionBox}>
        <div style={sectionHeader}>
          <div style={sectionTitle}>
            Mail Ekleri
          </div>

          <span style={countBadge}>
            {attachments.length}
          </span>
        </div>

        {attachments.length === 0 ? (
          <p style={mutedText}>
            Bu mailde ek bulunamadı.
          </p>
        ) : (
          <div style={attachmentList}>
            {attachments.map(
              (attachment, index) => (
                <div
                  key={`${attachment.filename}-${index}`}
                  style={attachmentItem}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={attachmentName}>
                      {attachment.filename}
                    </div>

                    <div style={attachmentMeta}>
                      {attachment.mimeType ||
                        "Dosya"}

                      {" · "}

                      {attachment.size
                        ? `${Math.round(
                            attachment.size / 1024
                          )} KB`
                        : "-"}
                    </div>
                  </div>

                  {attachment.url && (
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      style={attachmentButton}
                    >
                      Aç
                    </a>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>

      <div style={analysisBox}>
        <div style={analysisHeader}>
          <div>
            <div style={sectionTitle}>
              Mail Okuma Motoru Sonucu
            </div>

            <p style={mutedText}>
              PTT UETS bloğu, ulaşma tarihi ve
              tebliğ sayılma tarihi.
            </p>
          </div>

          {(loading || calendarLoading) && (
            <span style={loadingBadge}>
              {loading
                ? "Mail taranıyor..."
                : "Takvim kaydediliyor..."}
            </span>
          )}
        </div>

        {message && (
          <div
            style={
              analysisStatus === "error"
                ? errorState
                : calendarSuccess
                  ? successState
                  : infoState
            }
          >
            {message}

            {calendarEventLink &&
              calendarSuccess && (
                <div style={{ marginTop: 8 }}>
                  <a
                    href={calendarEventLink}
                    style={calendarLink}
                  >
                    AL Calendar’da aç
                  </a>
                </div>
              )}
          </div>
        )}

        <div style={summaryBox}>
          <div style={sectionTitle}>
            Özet
          </div>

          <p style={summaryText}>
            {analysis.ozet ||
              "Mail henüz taranmadı."}
          </p>
        </div>

        {uets.warnings.length > 0 && (
          <div style={warningBox}>
            <div style={warningTitle}>
              Kontrol Notları
            </div>

            {uets.warnings.map(
              (warning, index) => (
                <div
                  key={`${warning}-${index}`}
                  style={warningItem}
                >
                  {warning}
                </div>
              )
            )}
          </div>
        )}
      </div>

      <div style={actionBar}>
        <button
          type="button"
          onClick={runMailEngine}
          style={primaryButton}
          disabled={
            loading ||
            calendarLoading ||
            !hasSelectedMail
          }
        >
          {loading
            ? "Mail Taranıyor"
            : "Maili Tara"}
        </button>

        <button
          type="button"
          onClick={addToCalendarManually}
          style={secondaryButton}
          disabled={
            calendarLoading ||
            !analysis.sonTarih
          }
        >
          {calendarLoading
            ? "Kaydediliyor"
            : "AL Takvimine Ekle"}
        </button>

        <button
          type="button"
          onClick={createWordReport}
          style={secondaryButton}
          disabled={reportLoading}
        >
          {reportLoading
            ? "Oluşturuluyor"
            : "Word Oluştur"}
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
      <div style={cardLabel}>
        {label}
      </div>

      <div
        style={{
          ...cardValue,
          color: highlight
            ? "#f0b95b"
            : "#f8fafc",
        }}
      >
        {value || "-"}
      </div>
    </div>
  );
}

function MiniInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={miniInfoStyle}>
      <div style={miniLabel}>
        {label}
      </div>

      <div style={miniValue}>
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  uetsFound,
  label,
}: {
  status: "idle" | "success" | "error";
  uetsFound: boolean;
  label: string;
}) {
  const color =
    status === "error"
      ? "#ef8b8b"
      : uetsFound
        ? "#55d69e"
        : status === "success"
          ? "#67a7ff"
          : "#8ba2c7";

  return (
    <div
      style={{
        border: `1px solid ${color}66`,
        color,
        background: `${color}16`,
        padding: "8px 12px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}

const containerStyle = {
  background:
    "linear-gradient(180deg, rgba(12,22,43,0.98), rgba(4,11,25,0.98))",
  border:
    "1px solid rgba(106,137,190,0.22)",
  borderRadius: 24,
  padding: 16,
  color: "#f8fafc",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  flexWrap: "wrap" as const,
  marginBottom: 14,
};

const smallLabel = {
  color: "#69a7ff",
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 6,
};

const titleStyle = {
  margin: 0,
  fontSize: 20,
  lineHeight: 1.35,
  color: "#ffffff",
};

const senderStyle = {
  margin: "6px 0 0",
  color: "#8da2c2",
  fontSize: 12,
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
  marginBottom: 12,
};

const infoCardStyle = {
  minWidth: 0,
  background: "#111b30",
  border:
    "1px solid rgba(108,137,185,0.18)",
  borderRadius: 14,
  padding: 12,
};

const cardLabel = {
  color: "#8397b8",
  fontSize: 11,
  marginBottom: 7,
};

const cardValue = {
  fontSize: 13,
  fontWeight: 800,
  wordBreak: "break-word" as const,
};

const uetsBox = {
  background: "#0d2130",
  border:
    "1px solid rgba(62,207,142,0.25)",
  borderRadius: 16,
  padding: 14,
  marginBottom: 12,
};

const uetsGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const miniInfoStyle = {
  background: "#0a1728",
  border:
    "1px solid rgba(95,137,188,0.14)",
  borderRadius: 12,
  padding: 10,
};

const miniLabel = {
  color: "#7891b2",
  fontSize: 10,
  marginBottom: 6,
};

const miniValue = {
  color: "#f3f7fd",
  fontSize: 12,
  fontWeight: 800,
};

const sectionBox = {
  background: "#10192c",
  border:
    "1px solid rgba(106,137,190,0.16)",
  borderRadius: 16,
  padding: 14,
  marginBottom: 12,
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
};

const sectionTitle = {
  color: "#f8fafc",
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 8,
};

const countBadge = {
  color: "#83b7ff",
  background: "#132947",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 800,
  padding: "3px 8px",
};

const mailBodyStyle = {
  maxHeight: 250,
  overflowY: "auto" as const,
  whiteSpace: "pre-wrap" as const,
  color: "#c6d1e2",
  fontSize: 12,
  lineHeight: 1.65,
};

const mutedText = {
  margin: 0,
  color: "#8295b4",
  fontSize: 12,
  lineHeight: 1.55,
};

const attachmentList = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const attachmentItem = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  background: "#0b1527",
  border:
    "1px solid rgba(106,137,190,0.14)",
  borderRadius: 12,
  padding: 10,
};

const attachmentName = {
  color: "#f8fafc",
  fontSize: 12,
  fontWeight: 800,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap" as const,
};

const attachmentMeta = {
  color: "#7e91b0",
  fontSize: 10,
  marginTop: 4,
};

const attachmentButton = {
  color: "#86b9ff",
  border:
    "1px solid rgba(92,157,255,0.28)",
  background: "#10233e",
  borderRadius: 9,
  padding: "7px 10px",
  fontSize: 11,
  fontWeight: 800,
  textDecoration: "none",
};

const analysisBox = {
  background: "#0a1832",
  border:
    "1px solid rgba(82,139,229,0.28)",
  borderRadius: 18,
  padding: 14,
  marginBottom: 12,
};

const analysisHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap" as const,
  marginBottom: 12,
};

const loadingBadge = {
  color: "#8dbdff",
  background: "#122849",
  border:
    "1px solid rgba(89,151,247,0.24)",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 800,
};

const infoState = {
  color: "#b8d3ff",
  background: "#10233f",
  border:
    "1px solid rgba(85,146,240,0.24)",
  borderRadius: 12,
  padding: 11,
  marginBottom: 10,
  fontSize: 12,
  fontWeight: 700,
};

const successState = {
  color: "#9ce7c1",
  background: "#0e2b27",
  border:
    "1px solid rgba(68,198,139,0.25)",
  borderRadius: 12,
  padding: 11,
  marginBottom: 10,
  fontSize: 12,
  fontWeight: 700,
};

const errorState = {
  color: "#f3b3b3",
  background: "#2d1722",
  border:
    "1px solid rgba(221,99,119,0.28)",
  borderRadius: 12,
  padding: 11,
  marginBottom: 10,
  fontSize: 12,
  fontWeight: 700,
};

const calendarLink = {
  color: "#8dbdff",
  textDecoration: "underline",
};

const summaryBox = {
  background: "#071126",
  borderRadius: 13,
  padding: 12,
};

const summaryText = {
  margin: 0,
  color: "#d3dbea",
  fontSize: 12,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap" as const,
};

const warningBox = {
  marginTop: 10,
  background: "#211d13",
  border:
    "1px solid rgba(224,176,75,0.22)",
  borderRadius: 13,
  padding: 11,
};

const warningTitle = {
  color: "#efc46a",
  fontSize: 11,
  fontWeight: 800,
  marginBottom: 7,
};

const warningItem = {
  color: "#cab98e",
  fontSize: 11,
  lineHeight: 1.5,
  marginTop: 4,
};

const actionBar = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

const primaryButton = {
  border: "none",
  borderRadius: 12,
  padding: "10px 15px",
  color: "#ffffff",
  background:
    "linear-gradient(90deg, #4b67ff, #8c42e8)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButton = {
  border:
    "1px solid rgba(128,153,196,0.22)",
  borderRadius: 12,
  padding: "10px 15px",
  color: "#e7edf7",
  background: "#121b2e",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};





