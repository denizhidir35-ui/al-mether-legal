"use client";

export default function StatsCards() {
  const cards = [
    {
      title: "Toplam Dava",
      value: "24",
    },

    {
      title: "Yaklaşan Süre",
      value: "6",
    },

    {
      title: "AI Analiz",
      value: "18",
    },
  ];

  return (
    <div
      style={{
        display: "grid",

        gridTemplateColumns:
          "repeat(3,minmax(0,1fr))",

        gap: 14,
      }}
    >
      {cards.map((card, i) => (
        <div
          key={i}
          style={{
            background:
              "rgba(15,23,42,0.78)",

            border:
              "1px solid rgba(255,255,255,0.05)",

            borderRadius: 18,

            padding:
              "18px 20px",

            minHeight: 110,

            display: "flex",

            flexDirection:
              "column",

            justifyContent:
              "center",

            backdropFilter:
              "blur(10px)",
          }}
        >
          <p
            style={{
              color: "#94a3b8",

              margin: 0,

              fontSize: 13,

              marginBottom: 10,
            }}
          >
            {card.title}
          </p>

          <h2
            style={{
              color: "white",

              fontSize: 28,

              margin: 0,

              fontWeight: 800,
            }}
          >
            {card.value}
          </h2>
        </div>
      ))}
    </div>
  );
}