"use client";

import TopBar from "@/components/layout/TopBar";
import AiPanel from "@/components/ai/AiPanel";

export default function Home() {
  const analysis = `
⚖️ AL METHER LEGAL AI ANALİZİ

━━━━━━━━━━━━━━━━━━

📌 Dava Türü:
İcra İtiraz

👤 Müvekkil:
Demo Kullanıcı

🏛️ Mahkeme:
İzmir İcra

━━━━━━━━━━━━━━━━━━

⚠️ Risk Durumu:
Yüksek Risk

🚨 Öncelik:
Kritik

⏳ Kritik Süre:
7 gün

📂 Delil Önerileri:
Ödeme kayıtları ve tebligatlar incelenmeli.

🧠 Hukuki Strateji:
İtiraz süreci hızlandırılmalı.

📋 Hukuki Not:
Dosya detayları ayrıca analiz edilmelidir.

🤖 Sistem:
AL Mether Yerel Hukuk Motoru Aktif.

━━━━━━━━━━━━━━━━━━
`;

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(to bottom,#020617,#000814)",
        padding: 20,
        fontFamily:
          "Arial, Helvetica, sans-serif",
      }}
    >
      <TopBar />

      <div
        style={{
          marginTop: 20,
        }}
      >
        <AiPanel
          analysis={analysis}
        />
      </div>
    </main>
  );
}