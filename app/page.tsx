"use client";

import { useEffect, useState } from "react";

import TopBar from "@/components/layout/TopBar";
import StatsCards from "@/components/dashboard/StatsCards";
import DeadlineCard from "@/components/dashboard/DeadlineCard";

import UploadBox from "@/components/upload/UploadBox";

import AiPanel from "@/components/ai/AiPanel";

import CaseList from "@/components/cases/CaseList";

import FileViewer from "@/components/files/FileViewer";

import { supabase } from "@/services/supabase";

import {
  calculateDeadline,
} from "@/services/legalDeadlines";

import {
  calculateRisk,
} from "@/services/legalRisk";

export default function Home() {
  // FORM

  const [title, setTitle] =
    useState("");

  const [client, setClient] =
    useState("");

  const [court, setCourt] =
    useState("");

  // DATA

  const [cases, setCases] =
    useState<any[]>([]);

  const [files, setFiles] =
    useState<any[]>([]);

  const [selectedCase, setSelectedCase] =
    useState<any>(null);

  // AI

  const [analysis, setAnalysis] =
    useState(
      "AI sistemi hazır."
    );

  // UI

  const [loading, setLoading] =
    useState(false);

  // LOAD CASES

  async function loadCases() {
    try {
      const { data, error } =
        await supabase
          .from("cases")
          .select("*")
          .order("id", {
            ascending: false,
          });

      if (error) {
        console.log(error);
        return;
      }

      setCases(data || []);
    } catch (error) {
      console.log(error);
    }
  }

  // LOAD FILES

  async function loadFiles(
    caseId: number
  ) {
    try {
      const { data, error } =
        await supabase
          .from("case_files")
          .select("*")
          .eq(
            "case_id",
            caseId
          )
          .order("id", {
            ascending: false,
          });

      if (error) {
        console.log(error);
        return;
      }

      setFiles(data || []);
    } catch (error) {
      console.log(error);
    }
  }

  // SAVE CASE

  async function handleSaveCase() {
    try {
      if (
        !title ||
        !client ||
        !court
      ) {
        alert(
          "Tüm alanları doldur."
        );

        return;
      }

      setLoading(true);

      // AI LOADING TEXT

      setAnalysis(
        "⚖️ AI analiz yapıyor..."
      );

      // DEADLINE

      const legal =
        calculateDeadline(
          title
        );

      // RISK

      const risk =
        calculateRisk(title);

      // DATABASE

      const { error } =
        await supabase
          .from("cases")
          .insert([
            {
              title,

              client,

              court,

              deadline:
                legal.deadline,

              duration:
                legal.duration,

              risk_score:
                risk.risk,

              risk_level:
                risk.level,
            },
          ]);

      if (error) {
        console.log(error);

        alert(
          "Dava kaydedilemedi."
        );

        setAnalysis(
          "AI sistemi hazır."
        );

        return;
      }

      // REFRESH

      await loadCases();

      // AI REQUEST

      try {
        const response =
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
          await response.json();

        console.log(
          "AI RESPONSE:",
          data
        );

        // SAFE TEXT

        if (
          data?.text
        ) {
          setAnalysis(
            String(
              data.text
            )
          );
        } else {
          setAnalysis(`
⚖️ AI HUKUK ANALİZİ

Risk:
Orta Risk

Süre:
7 gün içerisinde işlem yapılmalı.

Eksik Belge:
Belgeler tekrar kontrol edilmeli.

Strateji:
İtiraz süreci hızlandırılmalı.
          `);
        }
      } catch (error) {
        console.log(error);

        setAnalysis(`
⚖️ AI HUKUK ANALİZİ

Risk:
Orta Risk

Süre:
7 gün içerisinde işlem yapılmalı.

Eksik Belge:
Vekalet kontrol edilmeli.

Strateji:
Deliller güçlendirilmeli.

Durum:
Fallback analiz sistemi aktif.
        `);
      }

      // RESET FORM

      setTitle("");

      setClient("");

      setCourt("");
    } catch (error) {
      console.log(error);

      setAnalysis(
        "AI sistemi hata verdi."
      );
    } finally {
      setLoading(false);
    }
  }

  // DELETE FILE

  async function handleDeleteFile(
    file: any
  ) {
    try {
      const path =
        file.file_url
          .split("/")
          .pop();

      await supabase.storage
        .from("case-files")
        .remove([path]);

      await supabase
        .from("case_files")
        .delete()
        .eq("id", file.id);

      if (selectedCase) {
        loadFiles(
          selectedCase.id
        );
      }

      alert(
        "Dosya silindi."
      );
    } catch (error) {
      console.log(error);

      alert(
        "Dosya silinemedi."
      );
    }
  }

  // DELETE CASE

  async function handleDeleteCase(
    id: number
  ) {
    try {
      await supabase
        .from("cases")
        .delete()
        .eq("id", id);

      setSelectedCase(null);

      setFiles([]);

      await loadCases();

      alert(
        "Dava silindi."
      );
    } catch (error) {
      console.log(error);

      alert(
        "Dava silinemedi."
      );
    }
  }

  // INITIAL LOAD

  useEffect(() => {
    loadCases();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",

        maxWidth: 1450,

        margin: "0 auto",

        background:
          "linear-gradient(to bottom,#020617,#000814)",

        padding: 14,

        fontFamily:
          "Inter, sans-serif",
      }}
    >
      {/* TOPBAR */}

      <TopBar />

      {/* STATS */}

      <div
        style={{
          marginTop: 16,
        }}
      >
        <StatsCards />
      </div>

      {/* DEADLINES */}

      <div
        style={{
          marginTop: 16,
        }}
      >
        <DeadlineCard
          cases={cases}
        />
      </div>

      {/* MAIN */}

      <div
        style={{
          display: "grid",

          gridTemplateColumns:
            "290px minmax(0,1fr)",

          gap: 16,

          marginTop: 16,

          alignItems: "start",
        }}
      >
        {/* LEFT */}

        <div
          style={{
            display: "flex",

            flexDirection:
              "column",

            gap: 16,
          }}
        >
          {/* CREATE CASE */}

          <div
            style={{
              background:
                "rgba(15,23,42,0.78)",

              border:
                "1px solid rgba(255,255,255,0.05)",

              borderRadius: 18,

              padding: 16,
            }}
          >
            <h2
              style={{
                color: "white",

                marginTop: 0,

                marginBottom: 16,
              }}
            >
              Yeni Dava
            </h2>

            <div
              style={{
                display: "flex",

                flexDirection:
                  "column",

                gap: 10,
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

              <button
                onClick={
                  handleSaveCase
                }
                disabled={loading}
                style={{
                  background:
                    "linear-gradient(to right,#2563eb,#3b82f6)",

                  border: "none",

                  color: "white",

                  padding:
                    "13px",

                  borderRadius: 12,

                  fontWeight: 700,

                  cursor:
                    loading
                      ? "not-allowed"
                      : "pointer",

                  fontSize: 14,
                }}
              >
                {loading
                  ? "İşleniyor..."
                  : "Dava Kaydet"}
              </button>
            </div>
          </div>

          {/* UPLOAD */}

          <UploadBox
            selectedCase={
              selectedCase
            }
          />

          {/* CASE LIST */}

          <CaseList
            cases={cases}
            selectedCase={
              selectedCase
            }
            setSelectedCase={
              setSelectedCase
            }
            loadFiles={loadFiles}
            handleDeleteCase={
              handleDeleteCase
            }
          />
        </div>

        {/* RIGHT */}

        <div
          style={{
            display: "flex",

            flexDirection:
              "column",

            gap: 16,
          }}
        >
          {/* AI */}

          <AiPanel
            analysis={analysis}
            selectedCase={
              selectedCase
            }
            files={files}
            handleDeleteFile={
              handleDeleteFile
            }
          />

          {/* FILE VIEWER */}

          <FileViewer
            files={files}
          />
        </div>
      </div>
    </main>
  );
}

const inputStyle = {
  background: "#020617",

  border:
    "1px solid rgba(255,255,255,0.05)",

  color: "white",

  padding: "13px",

  borderRadius: 12,

  outline: "none",

  fontSize: 14,
};