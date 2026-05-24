"use client";

export default function TopBar() {
  return (
    <div
      style={{
        display: "flex",

        justifyContent:
          "space-between",

        alignItems: "center",

        background:
          "rgba(15,23,42,0.75)",

        border:
          "1px solid rgba(255,255,255,0.05)",

        borderRadius: 24,

        padding:
          "22px 26px",
      }}
    >
      {/* LEFT */}

      <div
        style={{
          display: "flex",

          alignItems:
            "center",

          gap: 16,
        }}
      >
        <img
          src="/scale.svg"
          alt="logo"
          style={{
            width: 54,

            height: 54,

            filter:
              "drop-shadow(0 0 18px rgba(255,209,102,0.35))",
          }}
        />

        <div>
          <h1
            style={{
              color: "white",

              margin: 0,

              fontSize: 28,

              fontWeight: 800,
            }}
          >
            AL Mether Legal
          </h1>

          <p
            style={{
              color:
                "#94a3b8",

              marginTop: 6,

              fontSize: 14,
            }}
          >
            AI Hukuk Operasyon Sistemi
          </p>
        </div>
      </div>

      {/* RIGHT */}

      <div
        style={{
          display: "flex",

          alignItems:
            "center",

          gap: 10,
        }}
      >
        <div
          style={{
            background:
              "#111827",

            color: "white",

            padding:
              "10px 14px",

            borderRadius: 12,

            fontSize: 13,

            fontWeight: 700,
          }}
        >
          GPT-4o Legal
        </div>

        <div
          style={{
            background:
              "#14532d",

            color: "#22c55e",

            padding:
              "10px 14px",

            borderRadius: 12,

            fontSize: 13,

            fontWeight: 700,
          }}
        >
          Sistem Aktif
        </div>

        <button
          style={{
            background:
              "#ef4444",

            color: "white",

            border: "none",

            padding:
              "10px 18px",

            borderRadius: 12,

            cursor:
              "pointer",

            fontWeight: 700,
          }}
        >
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}