"use client";

export default function AiPanel({
  analysis,
}: any) {

  function extract(label: string) {

    const regex =
      new RegExp(
        `${label}:\\s*([\\s\\S]*?)(?=\\n\\n|$)`
      );

    const match =
      analysis.match(regex);

    return match
      ? match[1].trim()
      : "-";
  }

  const dava =
    extract("📌 Dava Türü");

  const muvekkil =
    extract("👤 Müvekkil");

  const mahkeme =
    extract("🏛️ Mahkeme");

  const risk =
    extract("⚠️ Risk Durumu");

  const oncelik =
    extract("🚨 Öncelik");

  const sure =
    extract("⏳ Kritik Süre");

  const strateji =
    extract("🧠 Hukuki Strateji");

  const delil =
    extract("📂 Delil Önerileri");

  const bildirim =
    extract("🔔 Bildirimler");

  return (

    <div
      style={{

        display: "flex",

        flexDirection:
          "column",

        gap: 14,
      }}
    >

      {/* TOP */}

      <div
        style={{

          display: "grid",

          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",

          gap: 16,
        }}
      >

        <Card
          title="📌 Dava Türü"
          value={dava}
        />

        <Card
          title="👤 Müvekkil"
          value={muvekkil}
        />

        <Card
          title="🏛️ Mahkeme"
          value={mahkeme}
        />

        <Card
          title="⚠️ Risk"
          value={risk}
        />
      </div>

      {/* MIDDLE */}

      <div
        style={{

          display: "grid",

          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",

          gap: 16,
        }}
      >

        <BigCard
          title="🚨 Öncelik"
          value={oncelik}
        />

        <BigCard
          title="⏳ Kritik Süre"
          value={sure}
        />
      </div>

      {/* BOTTOM */}

      <div
        style={{

          display: "grid",

          gridTemplateColumns:
            "1fr",

          gap: 16,
        }}
      >

        <TextCard
          title="📂 Delil Önerileri"
          value={delil}
        />

        <TextCard
          title="🧠 Hukuki Strateji"
          value={strateji}
        />

        <TextCard
          title="🔔 Bildirimler"
          value={bildirim}
        />
      </div>
    </div>
  );
}

function Card({
  title,
  value,
}: any) {

  return (

    <div
      style={{

        background:
          "rgba(255,255,255,0.03)",

        border:
          "1px solid rgba(255,255,255,0.06)",

        borderRadius: 20,

        padding: 18,

        minHeight: 90,
      }}
    >

      <div
        style={{

          color: "#94a3b8",

          marginBottom: 10,

          fontSize: 14,
        }}
      >
        {title}
      </div>

      <div
        style={{

          color: "white",

          fontSize: 20,

          fontWeight: 700,

          lineHeight: 1.5,

          wordBreak: "break-word",
           overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function BigCard({
  title,
  value,
}: any) {

  return (

    <div
      style={{

        background:
          "rgba(59,130,246,0.08)",

        border:
          "1px solid rgba(59,130,246,0.18)",

        borderRadius: 24,

        padding: 24,

        minHeight: 140,
      }}
    >

      <div
        style={{

          color: "#93c5fd",

          marginBottom: 12,

          fontSize: 15,
        }}
      >
        {title}
      </div>

      <div
        style={{

          color: "white",

          fontSize:
            "clamp(24px,4vw,30px)",

          fontWeight: 800,

          lineHeight: 1.4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TextCard({
  title,
  value,
}: any) {

  return (

    <div
      style={{

        background:
          "rgba(255,255,255,0.03)",

        border:
          "1px solid rgba(255,255,255,0.06)",

        borderRadius: 20,

        padding: 20,
      }}
    >

      <div
        style={{

          color: "#94a3b8",

          marginBottom: 12,

          fontSize: 14,
        }}
      >
        {title}
      </div>

      <div
        style={{

          color: "white",

          lineHeight: 1.8,

          fontSize: 15,

          wordBreak:
            "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}