"use client";

import { useState } from "react";

import TopBar from "@/components/layout/TopBar";
import MailInbox, {
  Mail,
} from "@/components/mail/MailInbox";
import MailDetail from "@/components/mail/MailDetail";
import DeadlineList from "@/components/dashboard/DeadlineList";

export default function Home() {
  const [selectedMail, setSelectedMail] =
    useState<Mail | null>(null);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(to bottom right,#020617,#000814,#0f172a)",
        color: "white",
        padding: 16,
        fontFamily:
          "Inter, Arial, sans-serif",
      }}
    >
      <TopBar />

      <section
        style={{
          marginTop: 12,
          marginBottom: 16,
        }}
      >
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            marginBottom: 6,
          }}
        >
          📨 AL Mether Legal
        </h1>

        <p
          style={{
            color: "#94a3b8",
            fontSize: 14,
          }}
        >
          Gelen hukuk maillerini analiz eder,
          kritik tarihleri çıkarır,
          takvime ekler ve sizi
          zamanında uyarır.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "380px 1fr 320px",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* SOL - MAIL LISTESI */}

        <div>
          <MailInbox
            onSelectMail={
              setSelectedMail
            }
          />
        </div>

        {/* ORTA - MAIL DETAY */}

        <div>
          <MailDetail
            title={
              selectedMail?.subject ??
              "Bir mail seçin"
            }
            sender={
              selectedMail?.sender ??
              "-"
            }
            body={
              selectedMail?.body ??
              "Soldaki listeden bir mail seçin."
            }
            deadline={
              selectedMail?.deadline ??
              "-"
            }
            type={
              selectedMail?.type ??
              "Analiz Bekliyor"
            }
            risk={
              selectedMail?.risk ??
              "Analiz Bekliyor"
            }
          />
        </div>

        {/* SAĞ - DEADLINE */}

        <div>
          <DeadlineList />
        </div>
      </section>
    </main>
  );
}