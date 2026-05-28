"use client";

export default function TopBar() {

  return (

    <div
      style={{

        background:
          "rgba(15,23,42,0.72)",

        border:
          "1px solid rgba(255,255,255,0.08)",

        borderRadius: 28,

        padding: "22px 28px",

        display: "flex",

        justifyContent:
          "space-between",

        alignItems: "center",

        flexWrap: "wrap",

        gap: 18,

        backdropFilter:
          "blur(14px)",

        boxShadow:
          "0 10px 40px rgba(0,0,0,0.25)",
      }}
    >

      {/* LEFT */}

      <div
        style={{

          display: "flex",

          alignItems: "center",

          gap: 18,
        }}
      >

        {/* LOGO */}

        <div
          style={{

            width: 58,

            height: 58,

            borderRadius: 18,

            background:
              "linear-gradient(to bottom right,#2563eb,#1d4ed8)",

            display: "flex",

            alignItems: "center",

            justifyContent:
              "center",

            fontSize: 28,

            boxShadow:
              "0 8px 25px rgba(37,99,235,0.45)",
          }}
        >
          ⚖️
        </div>

        {/* TEXT */}

        <div>

          <h1
            style={{

              margin: 0,

              color: "white",

              fontSize:
                "clamp(22px,4vw,30px)",

              fontWeight: 800,

              letterSpacing:
                "-0.5px",
            }}
          >
            AL Mether Legal
          </h1>

          <p
            style={{

              margin: 0,

              marginTop: 6,

              color:
                "#94a3b8",

              fontSize: 14,

              lineHeight: 1.5,
            }}
          >
            AI destekli hukuk
            operasyon ve deadline
            yönetim sistemi
          </p>
        </div>
      </div>

      {/* RIGHT */}

      <div
        style={{

          display: "flex",

          alignItems: "center",

          flexWrap: "wrap",

          gap: 12,
        }}
      >

        {/* AI MODEL */}

        <div
          style={{

            background:
              "rgba(255,255,255,0.04)",

            border:
              "1px solid rgba(255,255,255,0.06)",

            color: "white",

            padding:
              "10px 16px",

            borderRadius: 16,

            fontSize: 13,

            fontWeight: 700,
          }}
        >
          🤖 Legal Engine v1
        </div>

        {/* STATUS */}

        <div
          style={{

            background:
              "rgba(34,197,94,0.12)",

            border:
              "1px solid rgba(34,197,94,0.22)",

            color: "#4ade80",

            padding:
              "10px 16px",

            borderRadius: 16,

            fontSize: 13,

            fontWeight: 700,
          }}
        >
          🟢 Sistem Aktif
        </div>

        {/* USER */}

        <div
          style={{

            width: 42,

            height: 42,

            borderRadius: 999,

            background:
              "linear-gradient(to bottom right,#334155,#1e293b)",

            display: "flex",

            alignItems: "center",

            justifyContent:
              "center",

            color: "white",

            fontWeight: 800,

            fontSize: 14,

            border:
              "1px solid rgba(255,255,255,0.08)",
          }}
        >
          A
        </div>
      </div>
    </div>
  );
}