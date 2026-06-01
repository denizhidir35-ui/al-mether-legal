"use client";

import { useState } from "react";
import AnalysisCard from "@/components/mail/AnalysisCard";

type Props = {
  title?: string;
  sender?: string;
  body?: string;
  deadline?: string;
  type?: string;
  risk?: string;
};

export default function MailDetail({
  title = "Bir mail seçin",
  sender = "-",
  body = "Mail içeriği bulunamadı.",
  deadline = "-",
  type = "Analiz Bekliyor",
  risk = "Analiz Bekliyor",
}: Props) {
  const [analysis, setAnalysis] =
    useState("");

  const [loading, setLoading] =
    useState(false);

    async function addToCalendar() {
  try {
    const response =
      await fetch(
        "/api/calendar",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            title,
            client: sender,
            date:
              new Date().toISOString(),
          }),
        }
      );

    const data =
      await response.json();

    if (data.success) {
      alert(
        "Takvime eklendi ✅"
      );
    } else {
      alert(
        "Takvim hatası ❌"
      );
    }
  } catch (error) {
    console.error(error);

    alert(
      "Takvim hatası ❌"
    );
  }
}

  async function runAIAnalysis() {
    try {
      setLoading(true);

      const res = await fetch(
        "/api/ai",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            subject: title,
            body,
          }),
        }
      );

      const data =
        await res.json();

      setAnalysis(`
⚖️ Dava Türü:
${data.davaTuru || "-"}

🚨 Risk:
${data.risk || "-"}

📅 Son Tarih:
${data.sonTarih || "-"}

📝 Özet:
${data.ozet || "-"}

✅ Yapilacaklar:

${data.yapilacaklar?.join("\n") || "-"}
`);
    } catch (error) {
      console.error(error);

      setAnalysis(
        "AI analizi sırasında hata oluştu"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background:
          "rgba(15,23,42,0.65)",
        border:
          "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24,
        padding: 20,
      }}
    >
      <h2
        style={{
          color: "white",
          fontSize: 20,
          marginBottom: 18,
        }}
      >
        📄 Mail Detayı
      </h2>

      <AnalysisCard />

      <div style={boxStyle}>
        <div style={labelStyle}>
          📨 Mail Başlığı
        </div>

        <div
          style={{
            color: "white",
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          {title}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <InfoCard
          label="👤 Gönderen"
          value={sender}
        />

        <InfoCard
          label="📅 Son Tarih"
          value={deadline}
        />

        <InfoCard
          label="⚖️ Dava Türü"
          value={type}
        />

        <InfoCard
          label="🚨 Risk"
          value={risk}
          color="#f97316"
        />
      </div>

      <div style={boxStyle}>
        <div style={labelStyle}>
          📄 Mail İçeriği
        </div>

        <div
          style={{
            color: "#e2e8f0",
            lineHeight: 1.8,
            fontSize: 14,
            whiteSpace:
              "pre-wrap",
            maxHeight: 300,
            overflowY: "auto",
          }}
        >
          {body}
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          marginBottom: 16,
          padding: 14,
          borderRadius: 14,
          background:
            "rgba(59,130,246,0.08)",
          border:
            "1px solid rgba(59,130,246,0.18)",
        }}
      >
        <div
          style={{
            color: "#60a5fa",
            fontWeight: 700,
            marginBottom: 8,
          }}
        >
          🤖 AI Analizi
        </div>

        {loading ? (
          <div
            style={{
              color: "#cbd5e1",
            }}
          >
            Gemini analiz yapıyor...
          </div>
        ) : (
          <div
            style={{
              color: "#cbd5e1",
              whiteSpace:
                "pre-wrap",
            }}
          >
            {analysis ||
              "Henüz analiz yapılmadı"}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={
            runAIAnalysis
          }
          style={primaryBtn}
        >
          🤖 AI Analiz Et
        </button>

        <button
          onClick={
            addToCalendar
          }
          style={secondaryBtn}
        >
          📅 Takvime Ekle
        </button>

        <button
          style={secondaryBtn}
        >
          📄 Word Oluştur
        </button>

        <button
          style={secondaryBtn}
        >
          🔔 Hatırlatma Kur
        </button>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  color = "white",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background:
          "rgba(255,255,255,0.03)",
        border:
          "1px solid rgba(255,255,255,0.05)",
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: 12,
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <div
        style={{
          color,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const boxStyle = {
  background:
    "rgba(255,255,255,0.03)",
  border:
    "1px solid rgba(255,255,255,0.05)",
  borderRadius: 14,
  padding: 16,
  marginBottom: 16,
};

const labelStyle = {
  color: "#94a3b8",
  marginBottom: 10,
  fontSize: 13,
};

const primaryBtn = {
  background:
    "linear-gradient(to right,#2563eb,#3b82f6)",
  border: "none",
  borderRadius: 12,
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
  borderRadius: 12,
  padding: "12px 18px",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
}