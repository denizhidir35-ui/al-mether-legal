export default function DeadlineList() {

  const items = [

    {
      title:
        "İcra İtiraz Dosyası",

      level:
        "Kritik",

      days: 3,
    },

    {
      title:
        "Ceza Savunması",

      level:
        "Çok Kritik",

      days: 1,
    },

    {
      title:
        "İş Mahkemesi",

      level:
        "Normal",

      days: 12,
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
        ⏳ Kritik Süreler
      </h2>

      <div
        style={{

          display: "flex",

          flexDirection:
            "column",

          gap: 16,
        }}
      >

        {items.map(
          (item, index) => (

          <div
            key={index}

            style={{

              background:
                "rgba(255,255,255,0.03)",

              border:
                "1px solid rgba(255,255,255,0.05)",

              borderRadius: 20,

              padding: 18,

              display: "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",
            }}
          >

            <div>

              <div
                style={{

                  fontWeight: 700,

                  marginBottom: 6,
                }}
              >
                {item.title}
              </div>

              <div
                style={{

                  color: "#94a3b8",

                  fontSize: 14,
                }}
              >
                {item.level}
              </div>
            </div>

            <div
              style={{

                fontSize: 28,

                fontWeight: 800,
              }}
            >
              {item.days}
              g
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}