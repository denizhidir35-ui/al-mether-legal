"use client";

import { useState } from "react";

export default function CaseForm({
  onResult,
}: {
  onResult: (text: string) => void;
}) {
  const [title, setTitle] =
    useState("");

  const [client, setClient] =
    useState("");

  const [court, setCourt] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [reportLoading,
    setReportLoading] =
    useState(false);

  async function analyze() {

    if (
      !title.trim() ||
      !client.trim() ||
      !court.trim()
    ) {

      alert(
        "Tüm alanları doldurun."
      );

      return;
    }

    try {

      setLoading(true);

      const res =
        await fetch("/api/ai", {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            title,
            client,
            court,
          }),
        });

      const data =
        await res.json();

      onResult(data.text);

    } catch (error) {

      console.log(error);

      alert(
        "Analiz sırasında hata oluştu."
      );

    } finally {

      setLoading(false);
    }
  }

  async function createReport() {

    if (
      !title.trim() ||
      !client.trim() ||
      !court.trim()
    ) {

      alert(
        "Önce tüm alanları doldurun."
      );

      return;
    }

    try {

      setReportLoading(true);

      const res =
        await fetch("/api/report", {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({

            title,
            client,
            court,

            risk:
              "Yüksek Risk",

            level:
              "Kritik",

            duration:
              "7 gün",

            strategy:
              "İtiraz süreci hızlandırılmalı.",

            evidence:
              "Ödeme kayıtları incelenmeli.",
          }),
        });

      const data =
        await res.json();

      onResult(
        data.report ||
        "Rapor oluşturulamadı."
      );

    } catch (error) {

      console.log(error);

      alert(
        "Rapor oluşturulamadı."
      );

    } finally {

      setReportLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection:
          "column",
        gap: 14,
        marginBottom: 24,
      }}
    >

      <input
        placeholder="Dava Türü"
        value={title}
        onChange={(e) =>
          setTitle(
            e.target.value
          )
        }
        style={inputStyle}
      />

      <input
        placeholder="Müvekkil"
        value={client}
        onChange={(e) =>
          setClient(
            e.target.value
          )
        }
        style={inputStyle}
      />

      <input
        placeholder="Mahkeme"
        value={court}
        onChange={(e) =>
          setCourt(
            e.target.value
          )
        }
        style={inputStyle}
      />

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >

        <button
          onClick={analyze}
          disabled={loading}
          style={buttonStyle}
        >
          {loading
            ? "Analiz Ediliyor..."
            : "🤖 AI Analiz Başlat"}
        </button>

        <button
          onClick={createReport}
          disabled={reportLoading}
          style={reportButton}
        >
          {reportLoading
            ? "Rapor Hazırlanıyor..."
            : "📄 Rapor Oluştur"}
        </button>

      </div>
    </div>
  );
}

const inputStyle = {
  background:
    "rgba(255,255,255,0.04)",

  border:
    "1px solid rgba(255,255,255,0.08)",

  borderRadius: 16,

  padding: 14,

  color: "white",

  fontSize: 15,

  outline: "none",
};

const buttonStyle = {
  background:
    "linear-gradient(to right,#2563eb,#3b82f6)",

  border: "none",

  borderRadius: 18,

  padding: "14px 18px",

  color: "white",

  fontWeight: 700,

  cursor: "pointer",

  fontSize: 15,
};

const reportButton = {
  background:
    "rgba(255,255,255,0.05)",

  border:
    "1px solid rgba(255,255,255,0.08)",

  borderRadius: 18,

  padding: "14px 18px",

  color: "white",

  fontWeight: 700,

  cursor: "pointer",

  fontSize: 15,
};