"use client";

type DeadlineItem = {
  id?: string | number;
  title?: string;
  level?: string;
  days?: number;
};

type Props = {
  items?: DeadlineItem[];
};

function getDeadlineColor(days?: number) {
  if (days === undefined || days >= 999) return "#64748b";
  if (days <= 1) return "#ef4444";
  if (days <= 3) return "#f97316";
  if (days <= 7) return "#facc15";
  return "#22c55e";
}

function getDeadlineText(days?: number) {
  if (days === undefined || days >= 999) return "Tarih yok";
  if (days < 0) return `${Math.abs(days)} gün geçti`;
  if (days === 0) return "Bugün";
  return `${days} gün`;
}

export default function DeadlineList({ items = [] }: Props) {
  const criticalCount = items.filter(
    (item) => (item.days ?? 999) <= 3
  ).length;

  return (
    <aside style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <div style={smallLabel}>Takip</div>
          <h2 style={titleStyle}>⏳ Kritik Süreler</h2>
        </div>

        <div style={countBadge}>{items.length}</div>
      </div>

      <div style={statsRow}>
        <div style={statBox}>
          <span style={statValue}>{criticalCount}</span>
          <span style={statLabel}>Kritik</span>
        </div>

        <div style={statBox}>
          <span style={statValue}>
            {items.length - criticalCount}
          </span>
          <span style={statLabel}>Normal</span>
        </div>
      </div>

      <div style={listStyle}>
        {items.length === 0 ? (
          <div style={emptyState}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
            <div style={{ fontWeight: 800, color: "white" }}>
              Kritik süre bulunamadı
            </div>
            <p style={mutedText}>
              AI analiz sonrası son tarih bulunan kayıtlar burada
              görünecek.
            </p>
          </div>
        ) : (
          items.map((item, index) => {
            const color = getDeadlineColor(item.days);

            return (
              <div key={item.id || index} style={cardStyle}>
                <div style={leftLine(color)} />

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={cardTitle}>
                    {item.title || "İsimsiz Dava"}
                  </div>

                  <div style={metaRow}>
                    <span style={riskBadge(item.level)}>
                      🚨 {item.level || "Normal"}
                    </span>

                    <span style={sourceText}>Deadline</span>
                  </div>
                </div>

                <div style={dayBox(color)}>
                  <div style={dayNumber}>
                    {getDeadlineText(item.days)}
                  </div>
                </div>
              </div>
            );
          })
        )}
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

const countBadge = {
  minWidth: 38,
  height: 38,
  borderRadius: 14,
  background: "rgba(59,130,246,0.14)",
  border: "1px solid rgba(59,130,246,0.25)",
  color: "#93c5fd",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
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
};

const emptyState = {
  color: "#94a3b8",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 18,
  padding: 18,
  textAlign: "center" as const,
};

const mutedText = {
  color: "#94a3b8",
  fontSize: 13,
  lineHeight: 1.6,
  margin: "8px 0 0",
};

const cardStyle = {
  position: "relative" as const,
  overflow: "hidden",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 18,
  padding: 14,
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const leftLine = (color: string) => ({
  position: "absolute" as const,
  left: 0,
  top: 0,
  bottom: 0,
  width: 4,
  background: color,
});

const cardTitle = {
  color: "white",
  fontWeight: 900,
  fontSize: 14,
  lineHeight: 1.35,
  marginBottom: 9,
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical" as const,
};

const metaRow = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap" as const,
  alignItems: "center",
};

const riskBadge = (level?: string) => {
  const color =
    level === "Yüksek"
      ? "#ef4444"
      : level === "Orta"
      ? "#f97316"
      : "#22c55e";

  return {
    color,
    background: `${color}18`,
    border: `1px solid ${color}33`,
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 900,
  };
};

const sourceText = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 800,
};

const dayBox = (color: string) => ({
  flexShrink: 0,
  minWidth: 64,
  borderRadius: 16,
  padding: "10px 8px",
  textAlign: "center" as const,
  background: `${color}14`,
  border: `1px solid ${color}33`,
});

const dayNumber = {
  color: "white",
  fontSize: 12,
  fontWeight: 900,
};