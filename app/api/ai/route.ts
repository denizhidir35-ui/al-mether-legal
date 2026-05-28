import { NextResponse }
from "next/server";

import {
  analyzeLegalCase
} from "@/lib/legal-rules";

import {
  calculateDeadline
} from "@/lib/deadline-engine";

import {
  getNotifications
} from "@/lib/notification-engine";

import {
  createCalendarEvent
} from "@/lib/calendar-engine";

export async function POST(
  req: Request
) {

  try {

    const body =
      await req.json();

    const analysis =
      analyzeLegalCase(
        body.title || ""
      );

    const days =
      Number(
        analysis.duration
          .replace(" gün", "")
      );

    const deadline =
      calculateDeadline(
        days
      );

    const notifications =
      getNotifications(
        deadline.days
      );

    const calendar =
      createCalendarEvent(
        body.title || "Dava",
        deadline.days
      );

    const text = `
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
${analysis.risk}

🚨 Öncelik:
${deadline.level}

⏳ Kritik Süre:
${analysis.duration}

📅 Deadline Motoru:
${deadline.days} gün

🔔 Bildirimler:
${notifications.join("\n")}

📅 Takvim Deadline:
${calendar.deadline.toLocaleDateString("tr-TR")}

📂 Delil Önerileri:
${analysis.evidence}

🧠 Hukuki Strateji:
${analysis.strategy}

📋 Hukuki Not:
Dosya detayları ayrıca analiz edilmelidir.

🤖 Sistem:
AL Mether Legal Engine Aktif.

━━━━━━━━━━━━━━━━━━
`;

    return NextResponse.json({

      text,

      deadline,

      notifications,

      analysis,

      calendar,
    });

  } catch (error) {

    console.log(error);

    return NextResponse.json({

      text:
        "AI sistemi hata verdi.",
    });
  }
}