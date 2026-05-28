"use client";

export default function RecentCases() {

  const cases = [

    {
      title:
        "İcra İtiraz Dosyası",

      client:
        "Ahmet Yılmaz",

      risk:
        "Yüksek Risk",
    },

    {
      title:
        "Ceza Savunması",

      client:
        "Mehmet Kaya",

      risk:
        "Kritik Risk",
    },

    {
      title:
        "İş Mahkemesi",

      client:
        "Ayşe Demir",

      risk:
        "Orta Risk",
    },
  ];

  return (

    <div
      style={{

        background:
          "rgba(15,23,42,0.65)",

        border:
          "1px solid rgba(255,255,255,0.08)",

        borderRadius: 28,

        padding: 24,

        backdropFilter:
          "blur(12px)",
      }}
    >

      <h2
        style={{

          fontSize: 24,

          fontWeight: 700,

          marginBottom: 20,
        }}
      >
        📂 Son Analizler
      </h2>

      <div
        style={{

          display: "flex",

          flexDirection:
            "column",

          gap: 16,
        }}
      >

        {cases.map(
          (item, index) => (

          <div
            key={index}

            style={{

              background:
                "rgba(255,255,255,0.03)",

              border:
                "1px solid rgba(255,255,255,0.05)",

              borderRadius: 18,

              padding: 18,
            }}
          >

            <div
              style={{

                color: "white",

                fontWeight: 700,

                marginBottom: 8,
              }}
            >
              {item.title}
            </div>

            <div
              style={{

                color: "#94a3b8",

                fontSize: 14,

                marginBottom: 6,
              }}
            >
              👤 {item.client}
            </div>

            <div
              style={{

                color: "#facc15",

                fontSize: 13,

                fontWeight: 700,
              }}
            >
              ⚠️ {item.risk}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}