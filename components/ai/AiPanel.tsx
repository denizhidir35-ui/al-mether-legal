"use client";

export default function AiPanel({
  analysis,
}: any) {
  return (
    <div
      style={{
        background:
          "rgba(15,23,42,0.78)",

        border:
          "1px solid rgba(255,255,255,0.05)",

        borderRadius: 18,

        padding: 16,

        minHeight: 520,
      }}
    >
      {/* HEADER */}

      <div
        style={{
          display: "flex",

          justifyContent:
            "space-between",

          alignItems: "center",

          marginBottom: 16,
        }}
      >
        <h2
          style={{
            color: "white",

            margin: 0,

            fontSize: 18,
          }}
        >
          ⚖️ AI Hukuk Analizi
        </h2>

        <div
          style={{
            background:
              "#14532d",

            color: "#22c55e",

            padding:
              "6px 12px",

            borderRadius: 999,

            fontSize: 11,

            fontWeight: 700,
          }}
        >
          AI AKTİF
        </div>
      </div>

      {/* BODY */}

      <div
        style={{
          background:
            "#020617",

          border:
            "1px solid rgba(255,255,255,0.05)",

          borderRadius: 16,

          minHeight: 420,

          padding: 20,

          color: "white",

          animation:
            "fadeIn 0.4s ease",
        }}
      >
        <div
          style={{
            whiteSpace:
              "pre-wrap",

            lineHeight: 1.9,

            fontSize: 15,

            color:
              "#e2e8f0",
          }}
        >
          {analysis}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;

            transform: translateY(
              10px
            );
          }

          to {
            opacity: 1;

            transform: translateY(
              0
            );
          }
        }
      `}</style>
    </div>
  );
}