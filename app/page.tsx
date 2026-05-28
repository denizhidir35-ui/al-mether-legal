"use client";

import NewCaseForm
from "@/components/cases/NewCaseForm";

import FileList
from "@/components/dashboard/FileList";

import { useState }
from "react";

import TopBar
from "@/components/layout/TopBar";

import AiPanel
from "@/components/ai/AiPanel";

import DeadlineList
from "@/components/dashboard/DeadlineList";

import ActivityFeed
from "@/components/dashboard/ActivityFeed";

import RecentCases
from "@/components/dashboard/RecentCases";

import CaseForm
from "@/components/ai/CaseForm";

export default function Home() {

  const [analysis, setAnalysis] =
    useState(`
⚖️ AL METHER LEGAL AI ANALİZİ

Sistem hazır.
Yeni analiz başlatın.
`);

const [cases, setCases] =
  useState<any[]>([]);

  return (

    <main
      style={{

        minHeight: "100vh",

        background:
          "linear-gradient(to bottom right,#020617,#000814,#0f172a)",

        color: "white",

        padding: "20px",

        fontFamily:
          "Inter, Arial, sans-serif",
      }}
    >

      <TopBar />

      {/* HERO */}

      <section
        style={{

          marginTop: 30,

          marginBottom: 30,

          display: "flex",

          justifyContent:
            "space-between",

          alignItems:
            "center",

          flexWrap: "wrap",

          gap: 20,
        }}
      >

        <div>

          <h1
            style={{

              fontSize:
                "clamp(28px,5vw,42px)",

              fontWeight: 800,

              marginBottom: 10,
            }}
          >
            ⚖️ AI Mether Legal
          </h1>

          <p
            style={{

              color: "#94a3b8",

              fontSize: 18,

              maxWidth: 700,

              lineHeight: 1.6,
            }}
          >
            Hukuki süreçleri analiz eden,
            deadline takibi yapan ve
            kritik dosyaları yöneten
            yeni nesil hukuk motoru.
          </p>
        </div>

        <div
          style={{

            padding:
              "14px 20px",

            borderRadius: 20,

            background:
              "rgba(15,23,42,0.7)",

            border:
              "1px solid rgba(255,255,255,0.08)",

            backdropFilter:
              "blur(10px)",
          }}
        >
          🟢 Sistem Aktif
        </div>
      </section>

      {/* DASHBOARD CARDS */}

      <section
        style={{

          display: "grid",

          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",

          gap: 20,

          marginBottom: 30,
        }}
      >

        <div
          style={cardStyle}
        >
          <h3 style={cardTitle}>
            🔴 Kritik Dosya
          </h3>

          <p style={cardValue}>
            12
          </p>
        </div>

        <div
          style={cardStyle}
        >
          <h3 style={cardTitle}>
            🟡 Yaklaşan
          </h3>

          <p style={cardValue}>
            28
          </p>
        </div>

        <div
          style={cardStyle}
        >
          <h3 style={cardTitle}>
            ⚖️ Aktif Dava
          </h3>

          <p style={cardValue}>
            146
          </p>
        </div>

        <div
          style={cardStyle}
        >
          <h3 style={cardTitle}>
            📅 Bugünkü Takvim
          </h3>

          <p style={cardValue}>
            9
          </p>
        </div>
      </section>

      {/* MAIN GRID */}

      <section
        style={{

          display: "grid",

          gridTemplateColumns:
            "repeat(auto-fit,minmax(340px,1fr))",

          gap: 24,

          alignItems:
            "start",
        }}
      >

        {/* LEFT */}

        <div
          style={{

            display: "flex",

            flexDirection:
              "column",

            gap: 24,
          }}
        >

          {/* AI PANEL */}

          <div
            style={{

              background:
                "rgba(15,23,42,0.65)",

              border:
                "1px solid rgba(255,255,255,0.08)",

              borderRadius: 28,

              padding: 22,

              backdropFilter:
                "blur(12px)",

              boxShadow:
                "0 10px 40px rgba(0,0,0,0.35)",
            }}
          >

            <div
              style={{

                marginBottom: 20,
              }}
            >

              <h2
                style={{

                  fontSize: 28,

                  marginBottom: 8,

                  fontWeight: 700,
                }}
              >
                🤖 AI Hukuk Analizi
              </h2>

              <p
                style={{

                  color: "#94a3b8",

                  marginBottom: 24,
                }}
              >
                Gerçek zamanlı dava
                analizi ve kritik süre
                yönetimi.
              </p>

              <CaseForm
                onResult={setAnalysis}
              />
            </div>

            <AiPanel
              analysis={analysis}
            />
          </div>

          {/* ACTIVITY */}

          <ActivityFeed />

<NewCaseForm
  onAdd={(item) =>
    setCases((prev) => [
      item,
      ...prev,
    ])
  }
/>

          <FileList />

        </div>

        {/* RIGHT */}

        <div
          style={{

            display: "flex",

            flexDirection:
              "column",

            gap: 24,
          }}
        >

          <DeadlineList />

        </div>

      </section>
    </main>
  );
}

const cardStyle = {

  background:
    "rgba(15,23,42,0.65)",

  border:
    "1px solid rgba(255,255,255,0.08)",

  borderRadius: 24,

  padding: 24,

  backdropFilter:
    "blur(10px)",

  boxShadow:
    "0 10px 30px rgba(0,0,0,0.25)",
};

const cardTitle = {

  color: "#94a3b8",

  marginBottom: 12,

  fontSize: 15,
};

const cardValue = {

  fontSize: 34,

  fontWeight: 800,
};