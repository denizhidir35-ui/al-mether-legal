"use client";

export default function AnalysisCard() {
  return (
    <div
      style={{
        background:
          "rgba(15,23,42,0.65)",

        border:
          "1px solid rgba(255,255,255,0.08)",

        borderRadius: 24,

        padding: 24,

        marginBottom: 20,
      }}
    >
      <h2
        style={{
          color: "white",

          fontSize: 26,

          marginBottom: 20,
        }}
      >
        🤖 AL Analiz Sonucu
      </h2>

      <div style={rowStyle}>
        <span style={labelStyle}>
          ⚖️ Dava Türü
        </span>

        <span style={valueStyle}>
          İcra ve İflas
        </span>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>
          📂 Alt Tür
        </span>

        <span style={valueStyle}>
          İtirazın İptali
        </span>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>
          📅 Son Tarih
        </span>

        <span style={valueStyle}>
          12.06.2026
        </span>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>
          🚨 Risk Seviyesi
        </span>

        <span
          style={{
            ...valueStyle,

            color: "#ef4444",
          }}
        >
          Yüksek
        </span>
      </div>

      <div
        style={{
          marginTop: 20,
        }}
      >
        <div style={labelStyle}>
          📋 AI Değerlendirmesi
        </div>

        <div
          style={{
            color: "#e2e8f0",

            marginTop: 10,

            lineHeight: 1.8,
          }}
        >
          Mail içeriğinde icra
          takibine ilişkin süre
          tespit edildi.

          Tebligat evraklarının
          kontrol edilmesi ve
          itiraz süresinin
          kaçırılmaması
          önerilmektedir.

          Sistem tarafından
          taslak dilekçe
          oluşturulabilir.
        </div>
      </div>

      <div
        style={{
          display: "flex",

          gap: 12,

          flexWrap: "wrap",

          marginTop: 24,
        }}
      >
        <button style={primaryBtn}>
          📝 Taslak Oluştur
        </button>

        <button style={secondaryBtn}>
          📅 Takvime Ekle
        </button>

        <button style={secondaryBtn}>
          🔔 Hatırlatma Kur
        </button>
      </div>
    </div>
  );
}

const rowStyle = {
  display: "flex",

  justifyContent:
    "space-between",

  alignItems: "center",

  marginBottom: 14,
};

const labelStyle = {
  color: "#94a3b8",

  fontSize: 14,
};

const valueStyle = {
  color: "white",

  fontWeight: 700,
};

const primaryBtn = {
  background:
    "linear-gradient(to right,#2563eb,#3b82f6)",

  border: "none",

  borderRadius: 14,

  padding: "12px 18px",

  color: "white",

  fontWeight: 700,

  cursor: "pointer",
};

const secondaryBtn = {
  background:
    "rgba(255,255,255,0.06)",

  border:
    "1px solid rgba(255,255,255,0.08)",

  borderRadius: 14,

  padding: "12px 18px",

  color: "white",

  fontWeight: 700,

  cursor: "pointer",
};