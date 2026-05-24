import { NextResponse } from "next/server";

export async function POST(
  req: Request
) {
  try {
    const body =
      await req.json();

    const title =
      String(
        body.title || ""
      ).toLowerCase();

    let risk =
      "Orta Risk";

    let duration =
      "14 gün";

    let strategy =
      "Standart savunma hazırlanmalı.";

    let evidence =
      "Yazılı belgeler güçlendirilmeli.";

    let level =
      "Normal";

    // İCRA

    if (
      title.includes("icra")
    ) {
      risk =
        "Yüksek Risk";

      duration =
        "7 gün";

      level =
        "Kritik";

      strategy =
        "İtiraz süreci hızlandırılmalı.";

      evidence =
        "Ödeme kayıtları ve tebligatlar incelenmeli.";
    }

    // CEZA

    if (
      title.includes("ceza")
    ) {
      risk =
        "Kritik Risk";

      duration =
        "7 gün";

      level =
        "Çok Kritik";

      strategy =
        "Savunma delilleri hızla hazırlanmalı.";

      evidence =
        "Tanık, kamera ve HTS kayıtları değerlendirilmeli.";
    }

    // HACİZ

    if (
      title.includes("haciz")
    ) {
      risk =
        "Yüksek Risk";

      duration =
        "3 gün";

      level =
        "Acil";

      strategy =
        "Haciz işlemlerine hızlı itiraz edilmeli.";

      evidence =
        "Borç belgeleri detaylı incelenmeli.";
    }

    // İŞ

    if (
      title.includes("iş")
    ) {
      risk =
        "Orta Risk";

      duration =
        "14 gün";

      level =
        "Normal";

      strategy =
        "İşçi alacak hesapları kontrol edilmeli.";

      evidence =
        "SGK kayıtları ve maaş bordroları incelenmeli.";
    }

    const analysis = `
⚖️ AL METHER LEGAL AI ANALİZİ

━━━━━━━━━━━━━━━━━━

📌 Dava Türü:
${body.title}

👤 Müvekkil:
${body.client}

🏛️ Mahkeme:
${body.court}

━━━━━━━━━━━━━━━━━━

⚠️ Risk Durumu:
${risk}

🚨 Öncelik:
${level}

⏳ Kritik Süre:
${duration}

📂 Delil Önerileri:
${evidence}

🧠 Hukuki Strateji:
${strategy}

📋 Hukuki Not:
Dosya detayları ayrıca analiz edilmelidir.

🤖 Sistem:
AL Mether Yerel Hukuk Motoru Aktif.

━━━━━━━━━━━━━━━━━━
`;

    return NextResponse.json({
      text: analysis,
    });
  } catch (error) {
    console.log(error);

    return NextResponse.json({
      text:
        "AI sistemi hata verdi.",
    });
  }
}