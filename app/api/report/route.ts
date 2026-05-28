import { NextResponse }
from "next/server";

export async function POST(
  req: Request
) {

  try {

    const body =
      await req.json();

    const report = `
⚖️ AL METHER LEGAL RAPORU

━━━━━━━━━━━━━━━━━━

📌 Dava Türü:
${body.title}

👤 Müvekkil:
${body.client}

🏛️ Mahkeme:
${body.court}

━━━━━━━━━━━━━━━━━━

⚠️ Risk Durumu:
${body.risk}

🚨 Öncelik:
${body.level}

⏳ Kritik Süre:
${body.duration}

🔔 Bildirimler:
⏰ Son gün yaklaşıyor
🚨 Kritik takip gerekli

📂 Delil Önerileri:
${body.evidence}

🧠 Hukuki Strateji:
${body.strategy}

📋 Hukuki Not:
PDF export sistemi hazırlanıyor.

🤖 Sistem:
AL Mether Legal Engine Aktif.

━━━━━━━━━━━━━━━━━━
`;

    return NextResponse.json({

      success: true,

      report,
    });

  } catch (error) {

    console.log(error);

    return NextResponse.json({

      success: false,
    });
  }
}