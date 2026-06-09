"use client";

import { useEffect, useState } from "react";

export type Mail = {
  id: string;
  subject: string;
  sender: string;
  body: string;
  deadline: string;
  type: string;
  risk: string;
};

type Props = {
  onSelectMail?: (mail: Mail) => void;
};

export default function MailInbox({ onSelectMail }: Props) {
  const [mails, setMails] = useState<Mail[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMails();
  }, []);

  async function loadMails() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/gmail", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Gmail verileri alınamadı");
      }

      const formatted: Mail[] = (Array.isArray(data) ? data : []).map(
        (mail: any) => ({
          id: mail.id,
          subject: mail.subject || "Konu Yok",
          sender: mail.from || "Bilinmeyen",
          body: mail.body || mail.snippet || "",
          deadline: "-",
          type: "Analiz Bekliyor",
          risk: "Analiz Bekliyor",
        })
      );

      setMails(formatted);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Gmail yüklenirken hata oluştu"
      );
    } finally {
      setLoading(false);
    }
  }

  function selectMail(mail: Mail) {
    setSelectedId(mail.id);
    onSelectMail?.(mail);
  }

  return (
    <aside style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <div style={smallLabel}>Gmail</div>
          <h2 style={titleStyle}>📨 Gelen Kutusu</h2>
        </div>

        <button onClick={loadMails} style={refreshBtn} disabled={loading}>
          ↻
        </button>
      </div>

      <div style={statsRow}>
        <div style={statBox}>
          <span style={statValue}>{mails.length}</span>
          <span style={statLabel}>Mail</span>
        </div>

        <div style={statBox}>
          <span style={statValue}>
            {mails.filter((m) => m.risk === "Analiz Bekliyor").length}
          </span>
          <span style={statLabel}>Bekleyen</span>
        </div>
      </div>

      {loading && <div style={emptyState}>Mailler yükleniyor...</div>}

      {!loading && error && (
        <div style={errorState}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Gmail Hatası</div>
          <div>{error}</div>
        </div>
      )}

      {!loading && !error && mails.length === 0 && (
        <div style={emptyState}>Gelen kutusunda mail bulunamadı.</div>
      )}

      <div style={listStyle}>
        {!loading &&
          !error &&
          mails.map((mail) => {
            const selected = selectedId === mail.id;

            return (
              <button
                key={mail.id}
                onClick={() => selectMail(mail)}
                style={{
                  ...mailCardStyle,
                  border: selected
                    ? "1px solid rgba(96,165,250,0.65)"
                    : "1px solid rgba(255,255,255,0.07)",
                  background: selected
                    ? "linear-gradient(180deg,rgba(37,99,235,0.22),rgba(255,255,255,0.04))"
                    : "rgba(255,255,255,0.035)",
                }}
              >
                <div style={mailTopRow}>
                  <div style={mailSubject}>{mail.subject}</div>
                  <span style={gmailBadge}>Gmail</span>
                </div>

                <div style={senderStyle}>{mail.sender}</div>

                <div style={bodyPreview}>{mail.body || "İçerik yok"}</div>

                <div style={footerRow}>
                  <span style={statusBadge}>Analiz Bekliyor</span>
                  <span style={arrowStyle}>→</span>
                </div>
              </button>
            );
          })}
      </div>
    </aside>
  );
}

const containerStyle = {
  background:
    "linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.92))",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 28,
  padding: 16,
  boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
};

const smallLabel = {
  color: "#60a5fa",
  fontSize: 12,
  fontWeight: 900,
  marginBottom: 4,
};

const titleStyle = {
  color: "white",
  fontSize: 20,
  margin: 0,
  fontWeight: 900,
};

const refreshBtn = {
  width: 38,
  height: 38,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const statsRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginBottom: 14,
};

const statBox = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  padding: 12,
};

const statValue = {
  display: "block",
  color: "white",
  fontSize: 20,
  fontWeight: 900,
};

const statLabel = {
  color: "#94a3b8",
  fontSize: 12,
};

const listStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
  maxHeight: "calc(100vh - 250px)",
  overflowY: "auto" as const,
  paddingRight: 2,
};

const mailCardStyle = {
  width: "100%",
  textAlign: "left" as const,
  padding: 14,
  borderRadius: 18,
  cursor: "pointer",
  color: "white",
};

const mailTopRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
  marginBottom: 8,
};

const mailSubject = {
  fontWeight: 900,
  fontSize: 14,
  lineHeight: 1.35,
};

const gmailBadge = {
  color: "#93c5fd",
  background: "rgba(59,130,246,0.14)",
  border: "1px solid rgba(59,130,246,0.25)",
  padding: "3px 7px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
  flexShrink: 0,
};

const senderStyle = {
  color: "#94a3b8",
  fontSize: 12,
  marginBottom: 8,
  whiteSpace: "nowrap" as const,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const bodyPreview = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.5,
  marginBottom: 12,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical" as const,
  overflow: "hidden",
};

const footerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const statusBadge = {
  color: "#facc15",
  background: "rgba(250,204,21,0.1)",
  border: "1px solid rgba(250,204,21,0.2)",
  borderRadius: 999,
  padding: "5px 8px",
  fontSize: 11,
  fontWeight: 900,
};

const arrowStyle = {
  color: "#94a3b8",
  fontWeight: 900,
};

const emptyState = {
  color: "#94a3b8",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  padding: 14,
};

const errorState = {
  color: "#fecaca",
  background: "rgba(239,68,68,0.1)",
  border: "1px solid rgba(239,68,68,0.2)",
  borderRadius: 16,
  padding: 14,
  fontSize: 13,
};