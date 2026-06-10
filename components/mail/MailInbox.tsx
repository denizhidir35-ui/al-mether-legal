"use client";

import { useEffect, useMemo, useState } from "react";

export type Mail = {
  id: string;
  subject: string;
  sender: string;
  body: string;
  deadline: string;
  type: string;
  risk: string;
  hasAttachment?: boolean;
  attachments?: {
    filename: string;
    mimeType?: string;
    size?: number;
    attachmentId?: string;
  }[];
};

type Props = {
  onSelectMail?: (mail: Mail) => void;
};

type FilterType = "all" | "waiting" | "attachment";

export default function MailInbox({ onSelectMail }: Props) {
  const [mails, setMails] = useState<Mail[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    loadMails();
  }, []);

  const filteredMails = useMemo(() => {
    const term = search.trim().toLowerCase();

    return mails.filter((mail) => {
      const matchesSearch =
        !term ||
        mail.subject.toLowerCase().includes(term) ||
        mail.sender.toLowerCase().includes(term) ||
        mail.body.toLowerCase().includes(term) ||
        mail.deadline.toLowerCase().includes(term) ||
        mail.type.toLowerCase().includes(term) ||
        mail.risk.toLowerCase().includes(term);

      const matchesFilter =
        filter === "all" ||
        (filter === "waiting" && mail.risk === "Analiz Bekliyor") ||
        (filter === "attachment" && mail.hasAttachment);

      return matchesSearch && matchesFilter;
    });
  }, [mails, search, filter]);

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
          sender: mail.from || mail.sender || "Bilinmeyen",
          body: mail.body || mail.snippet || "",
          deadline: mail.deadline || "-",
          type: mail.type || "Analiz Bekliyor",
          risk: mail.risk || "Analiz Bekliyor",
          hasAttachment:
            Boolean(mail.hasAttachment) ||
            Boolean(mail.has_attachment) ||
            (Array.isArray(mail.attachments) && mail.attachments.length > 0),
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

  function clearSearch() {
    setSearch("");
    setFilter("all");
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
          <span style={statLabel}>Toplam</span>
        </div>

        <div style={statBox}>
          <span style={statValue}>{filteredMails.length}</span>
          <span style={statLabel}>Sonuç</span>
        </div>
      </div>

      <div style={searchWrap}>
        <span style={searchIcon}>🔍</span>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Konu, gönderen, içerik ara..."
          style={searchInput}
        />

        {(search || filter !== "all") && (
          <button onClick={clearSearch} style={clearBtn}>
            Temizle
          </button>
        )}
      </div>

      <div style={filterRow}>
        <FilterButton
          active={filter === "all"}
          label="Tümü"
          onClick={() => setFilter("all")}
        />

        <FilterButton
          active={filter === "waiting"}
          label="Bekleyen"
          onClick={() => setFilter("waiting")}
        />

        <FilterButton
          active={filter === "attachment"}
          label="📎 Ekli"
          onClick={() => setFilter("attachment")}
        />
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

      {!loading && !error && mails.length > 0 && filteredMails.length === 0 && (
        <div style={emptyState}>Aramanızla eşleşen mail bulunamadı.</div>
      )}

      <div style={listStyle}>
        {!loading &&
          !error &&
          filteredMails.map((mail) => {
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

                  <div style={badgeGroup}>
                    {mail.hasAttachment && <span style={attachBadge}>📎</span>}
                    <span style={gmailBadge}>Gmail</span>
                  </div>
                </div>

                <div style={senderStyle}>{mail.sender}</div>

                <div style={bodyPreview}>{mail.body || "İçerik yok"}</div>

                <div style={footerRow}>
                  <span style={statusBadge}>{mail.risk}</span>
                  <span style={arrowStyle}>→</span>
                </div>
              </button>
            );
          })}
      </div>
    </aside>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...filterBtn,
        background: active
          ? "rgba(59,130,246,0.18)"
          : "rgba(255,255,255,0.04)",
        border: active
          ? "1px solid rgba(96,165,250,0.35)"
          : "1px solid rgba(255,255,255,0.07)",
        color: active ? "#93c5fd" : "#94a3b8",
      }}
    >
      {label}
    </button>
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
  marginBottom: 12,
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

const searchWrap = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  padding: "10px 12px",
  marginBottom: 10,
};

const searchIcon = {
  color: "#94a3b8",
  flexShrink: 0,
};

const searchInput = {
  flex: 1,
  minWidth: 0,
  background: "transparent",
  border: "none",
  outline: "none",
  color: "white",
  fontSize: 13,
};

const clearBtn = {
  border: "none",
  background: "rgba(239,68,68,0.13)",
  color: "#fecaca",
  borderRadius: 999,
  padding: "5px 8px",
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
};

const filterRow = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap" as const,
  marginBottom: 14,
};

const filterBtn = {
  borderRadius: 999,
  padding: "7px 10px",
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
};

const listStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
  maxHeight: "calc(100vh - 330px)",
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

const badgeGroup = {
  display: "flex",
  gap: 5,
  alignItems: "center",
  flexShrink: 0,
};

const attachBadge = {
  color: "#facc15",
  background: "rgba(250,204,21,0.12)",
  border: "1px solid rgba(250,204,21,0.22)",
  padding: "3px 6px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
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