import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const report = `
⚖️ AL METHER LEGAL RAPORU

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Dava Türü
${body.title || "-"}

👤 Müvekkil
${body.client || "-"}

🏛️ Mahkeme
${body.court || "-"}

📂 Dosya No
${body.fileNo || "-"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 Risk Seviyesi
${body.risk || "-"}

🎯 Güven Skoru
${body.confidence || 0}%

⏳ Son Tarih
${body.deadline || "-"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Hukuki Özet

${body.summary || "-"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Yapılması Gerekenler

${
  Array.isArray(body.todos)
    ? body.todos.map((x: string) => `• ${x}`).join("\n")
    : "-"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Delil Önerileri

${body.evidence || "-"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚖️ Hukuki Strateji

${body.strategy || "-"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 AL Mether Legal

Bu rapor yapay zeka destekli analiz sonucu
otomatik oluşturulmuştur.

Oluşturulma Tarihi:
${new Date().toLocaleString("tr-TR")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("REPORT ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Rapor oluşturulamadı",
      },
      {
        status: 500,
      }
    );
  }
}