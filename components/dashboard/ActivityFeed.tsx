export default function ActivityFeed() {

  const logs = [

    {
      title:
        "İcra dosyası analiz edildi",

      time:
        "2 dk önce",
    },

    {
      title:
        "Kritik deadline oluşturuldu",

      time:
        "12 dk önce",
    },

    {
      title:
        "Ceza dosyası işlendi",

      time:
        "25 dk önce",
    },

    {
      title:
        "Takvim bildirimi üretildi",

      time:
        "40 dk önce",
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
        📡 Sistem Aktivitesi
      </h2>

      <div
        style={{

          display: "flex",

          flexDirection:
            "column",

          gap: 16,
        }}
      >

        {logs.map(
          (log, index) => (

          <div
            key={index}

            style={{

              background:
                "rgba(255,255,255,0.03)",

              border:
                "1px solid rgba(255,255,255,0.05)",

              borderRadius: 18,

              padding: 16,
            }}
          >

            <div
              style={{

                color: "white",

                marginBottom: 6,

                fontWeight: 600,
              }}
            >
              {log.title}
            </div>

            <div
              style={{

                color: "#94a3b8",

                fontSize: 13,
              }}
            >
              {log.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}