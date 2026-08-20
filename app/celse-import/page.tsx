"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import LegalBackButton from "@/components/LegalBackButton";

type BridgeCapture = {
  title?: string;
  url?: string;
  text?: string;
  capturedAt?: string;
  sourceDocument?: string;
};

type Hearing = {
  found?: boolean;
  date?: string;
  time?: string;
  location?: string;
  evidence?: string;
};

type CelseDocument = {
  documentType?: string;
  court?: string;
  fileNo?: string;
  summary?: string;
  hearing?: Hearing;
  needsHumanReview?: boolean;
  calendarSafe?: boolean;
};

type AnalyzeResponse = {
  ok?: boolean;
  error?: string;
  source?: { isTestDocument?: boolean };
  document?: CelseDocument;
};

type CommitResponse = {
  ok?: boolean;
  duplicate?: boolean;
  caseCreated?: boolean;
  message?: string;
  error?: string;
  case?: {
    id?: string;
    case_number?: string;
    court_name?: string;
    case_title?: string;
  };
  calendarEvent?: {
    id?: string;
    case_id?: string;
  };
};

type ImportStatus = {
  kind: "success" | "warning" | "error" | "info";
  message: string;
};

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isUyapUrl(value: unknown) {
  try {
    const url = new URL(safeText(value));
    return url.protocol === "https:" && url.hostname === "avukat.uyap.gov.tr";
  } catch {
    return false;
  }
}

function formatCapturedAt(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("tr-TR");
}

export default function CelseImportPage() {
  const mockOriginRef = useRef("");
  const [capture, setCapture] = useState<BridgeCapture | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [matchedCase, setMatchedCase] = useState<
    CommitResponse["case"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<ImportStatus | null>(null);

  const commitHearing = useCallback(
    async (payload: BridgeCapture, analysis: AnalyzeResponse) => {
      const document = analysis.document;
      const hearing = document?.hearing;

      if (analysis.source?.isTestDocument === true) {
        setStatus({
          kind: "warning",
          message: "Test belgesi algılandı; dava veya takvim kaydı oluşturulmadı.",
        });
        return;
      }

      if (!hearing?.found) {
        setStatus({
          kind: "info",
          message: "Açık bir duruşma tarihi bulunamadı; kayıt oluşturulmadı.",
        });
        return;
      }

      if (!safeText(hearing.date) || !safeText(hearing.time)) {
        setStatus({
          kind: "warning",
          message: "Duruşma bulundu ancak tarih veya saat eksik; kayıt oluşturulmadı.",
        });
        return;
      }

      if (document?.needsHumanReview || document?.calendarSafe !== true) {
        setStatus({
          kind: "warning",
          message: "Analiz insan kontrolü gerektiriyor; dava ve takvim kaydı oluşturulmadı.",
        });
        return;
      }

      const response = await fetch("/api/celse/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          court: document.court || "",
          fileNo: document.fileNo || "",
          date: hearing.date,
          time: hearing.time,
          evidence: hearing.evidence || "",
          sourceUrl: payload.url || "",
        }),
      });
      const data = (await response.json()) as CommitResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Dava ve duruşma kaydı oluşturulamadı.");
      }

      setMatchedCase(data.case);
      setStatus({
        kind: data.duplicate ? "info" : "success",
        message: data.message || "Duruşma davaya bağlanarak takvime kaydedildi.",
      });

      if (mockOriginRef.current && window.opener) {
        window.opener.postMessage(
          {
            source: "METHER_CELSE_RESULT",
            result: data,
          },
          mockOriginRef.current
        );
      }
    },
    []
  );

  const analyzeCapture = useCallback(
    async (payload: BridgeCapture) => {
      const capturedText = safeText(payload.text);
      if (!capturedText || !isUyapUrl(payload.url)) {
        setError("Geçerli UYAP Avukat Portal verisi alınamadı.");
        return;
      }

      setLoading(true);
      setError("");
      setResult(null);
      setMatchedCase(null);
      setStatus(null);

      try {
        const response = await fetch("/api/uets/document-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: payload.title || "UYAP Dava Dosyası",
            url: payload.url || "",
            text: capturedText,
            sourceDocument: payload.sourceDocument || "UYAP Avukat Portal",
          }),
        });
        const data = (await response.json()) as AnalyzeResponse;

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "UYAP dosyası analiz edilemedi.");
        }

        setResult(data);
        await commitHearing(payload, data);
      } catch (analysisError) {
        setError(
          analysisError instanceof Error
            ? analysisError.message
            : "UYAP dosyası analiz edilemedi."
        );
      } finally {
        setLoading(false);
      }
    },
    [commitHearing]
  );

  useEffect(() => {
    function handleBridgeMessage(event: MessageEvent) {
      const isExtensionMessage =
        event.source === window && event.origin === window.location.origin;
      const isLocalMockMessage =
        ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
        new URLSearchParams(window.location.search).get("mock") === "1" &&
        ["http://localhost:4173", "http://127.0.0.1:4173"].includes(
          event.origin
        ) &&
        event.source === window.opener;

      if (
        (!isExtensionMessage && !isLocalMockMessage) ||
        event.data?.source !== "METHER_CELSE_BRIDGE"
      ) {
        return;
      }

      const payload = event.data?.payload as BridgeCapture;
      if (!payload || !safeText(payload.text) || !isUyapUrl(payload.url)) {
        setError("Bridge kaynağı doğrulanamadı.");
        return;
      }

      setCapture(payload);
      if (isLocalMockMessage && window.opener) {
        mockOriginRef.current = event.origin;
        window.opener.postMessage({ source: "METHER_CELSE_ACK" }, event.origin);
      } else {
        window.postMessage(
          { source: "METHER_CELSE_ACK" },
          window.location.origin
        );
      }
      void analyzeCapture(payload);
    }

    window.addEventListener("message", handleBridgeMessage);
    return () => window.removeEventListener("message", handleBridgeMessage);
  }, [analyzeCapture]);

  const statusColors =
    status?.kind === "success"
      ? { borderColor: "#2d8b64", color: "#8ce0b8" }
      : status?.kind === "error"
        ? { borderColor: "#a94444", color: "#ff9b9b" }
        : status?.kind === "warning"
          ? { borderColor: "#8f7134", color: "#e6c879" }
          : { borderColor: "#45617f", color: "#b8c8db" };

  return (
    <main style={{ minHeight: "100vh", background: "#070c12", color: "#f4f5f7", padding: "34px 22px 70px" }}>
      <div style={{ width: "min(960px, 100%)", margin: "0 auto" }}>
        <div style={{ marginBottom: 16 }}>
          <LegalBackButton fallback="/dashboard" />
        </div>

        <header style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 24 }}>
          <img src="/icon.png" alt="METHER Legal" width={42} height={42} />
          <div>
            <h1 style={{ margin: 0, fontSize: 23, fontWeight: 500 }}>UYAP / CELSE Aktarımı</h1>
            <p style={{ margin: "6px 0 0", color: "#8290a3", fontSize: 12 }}>
              UYAP Avukat Portal&apos;daki açık dava ve duruşma bilgisini analiz eder.
            </p>
          </div>
        </header>

        {!capture && (
          <section style={{ border: "1px solid #202c3b", borderRadius: 18, padding: 28, background: "#0d141e", color: "#8997aa" }}>
            UYAP Avukat Portal&apos;dan “METHER&apos;e Aktar” işlemi bekleniyor…
          </section>
        )}

        {capture && (
          <section style={{ border: "1px solid #263244", borderRadius: 18, padding: 18, background: "#0d141e" }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>{capture.title || "UYAP Dava Dosyası"}</h2>
            <div style={{ marginTop: 7, color: "#7f90a7", fontSize: 11, lineHeight: 1.7 }}>
              <div>{capture.url}</div>
              <div>{formatCapturedAt(capture.capturedAt)}</div>
            </div>

            <div style={{ height: 1, background: "#273242", margin: "18px 0" }} />

            {loading && <div style={{ padding: 15, color: "#d2b765" }}>METHER UYAP dosyasını analiz ediyor…</div>}
            {error && <div style={{ padding: 15, border: "1px solid #a94444", borderRadius: 12, color: "#ff9b9b" }}>{error}</div>}
            {status && (
              <div style={{ ...statusColors, padding: 15, borderStyle: "solid", borderWidth: 1, borderRadius: 12, marginBottom: 14 }}>
                {status.message}
              </div>
            )}

            {matchedCase && (
              <section style={{ border: "1px solid #2d5b4b", borderRadius: 12, padding: 14, marginBottom: 14, background: "#0d1817" }}>
                <strong>Eşleşen dava</strong>
                <div style={{ marginTop: 6, color: "#b9d8cd", fontSize: 13 }}>
                  {matchedCase.court_name} — {matchedCase.case_number}
                </div>
              </section>
            )}

            {result?.document && (
              <section style={{ border: "1px solid #253143", borderRadius: 14, padding: 16, background: "#111a25" }}>
                <strong>METHER Analizi</strong>
                <dl style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "8px 14px", margin: "14px 0 0", fontSize: 13 }}>
                  <dt style={{ color: "#8290a3" }}>Mahkeme</dt><dd style={{ margin: 0 }}>{result.document.court || "—"}</dd>
                  <dt style={{ color: "#8290a3" }}>Esas no</dt><dd style={{ margin: 0 }}>{result.document.fileNo || "—"}</dd>
                  <dt style={{ color: "#8290a3" }}>Duruşma</dt><dd style={{ margin: 0 }}>{result.document.hearing?.date || "—"} {result.document.hearing?.time || ""}</dd>
                  <dt style={{ color: "#8290a3" }}>Özet</dt><dd style={{ margin: 0 }}>{result.document.summary || "—"}</dd>
                </dl>
              </section>
            )}

            <details style={{ marginTop: 14, border: "1px solid #253143", borderRadius: 12, padding: "12px 14px", background: "#0e1621" }}>
              <summary style={{ cursor: "pointer", color: "#d6b45f", fontSize: 12, fontWeight: 700 }}>Yakalanan UYAP metni</summary>
              <pre style={{ margin: "14px 0 0", maxHeight: 420, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, lineHeight: 1.65, color: "#dce2e9" }}>
                {capture.text}
              </pre>
            </details>
          </section>
        )}
      </div>
    </main>
  );
}
