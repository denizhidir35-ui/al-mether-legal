"use client";

export default function TopBar() {
  return (
    <div
      style={{
        background:
          "linear-gradient(90deg,#020617,#0f172a)",

        border:
          "1px solid rgba(255,255,255,0.05)",

        borderRadius: 24,

        padding: "22px 28px",

        display: "flex",

        justifyContent:
          "space-between",

        alignItems: "center",

        marginBottom: 20,
      }}
    >
      {/* LEFT */}

      <div
        style={{
          display: "flex",

          alignItems: "center",

          gap: 16,
        }}
      >
        <div
          style={{
            fontSize: 42,
          }}
        >
          ⚖️
        </div>

        <div>
          <h1
            style={{
              margin: 0,

              color: "white",

              fontSize: 28,

              fontWeight: 800,
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
            }}
          >
            AI Hukuk Operasyon
            Sistemi
          </p>
        </div>
      </div>

      {/* RIGHT */}

      <div
        style={{
          display: "flex",

          alignItems: "center",

          gap: 12,
        }}
      >
        <div
          style={{
            background:
              "#111827",

            color: "white",

            padding:
              "10px 16px",

            borderRadius: 14,

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
              "10px 16px",

            borderRadius: 14,

            fontSize: 13,

            fontWeight: 700,
          }}
        >
          Sistem Aktif
        </div>
      </div>
    </div>
  );
}