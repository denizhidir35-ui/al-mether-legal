// components/dashboard/DeadlineCard.tsx

"use client";

export default function DeadlineCard({
  cases,
}: any) {
  const now = new Date();

  const urgentCases =
    cases.filter(
      (item: any) => {
        const end =
          new Date(
            item.deadline
          );

        const diff =
          Math.ceil(
            (end.getTime() -
              now.getTime()) /
              (1000 *
                60 *
                60 *
                24)
          );

        return diff <= 7;
      }
    );

  return (
    <div
      style={{
        background:
          "rgba(15,23,42,0.78)",

        border:
          "1px solid rgba(255,255,255,0.05)",

        borderRadius: 18,

        padding: 16,
      }}
    >
      <h2
        style={{
          color: "white",

          marginTop: 0,

          marginBottom: 14,

          fontSize: 18,
        }}
      >
        ⏳ Kritik Süreler
      </h2>

      {urgentCases.length ===
      0 ? (
        <div
          style={{
            color:
              "#94a3b8",

            fontSize: 13,
          }}
        >
          Kritik dava yok.
        </div>
      ) : (
        <div
          style={{
            display: "flex",

            flexDirection:
              "column",

            gap: 10,
          }}
        >
          {urgentCases.map(
            (item: any) => {
              const end =
                new Date(
                  item.deadline
                );

              const diff =
                Math.ceil(
                  (end.getTime() -
                    now.getTime()) /
                    (1000 *
                      60 *
                      60 *
                      24)
                );

              return (
                <div
                  key={item.id}
                  style={{
                    background:
                      diff <= 3
                        ? "rgba(239,68,68,0.12)"
                        : "rgba(234,179,8,0.12)",

                    border:
                      diff <= 3
                        ? "1px solid rgba(239,68,68,0.3)"
                        : "1px solid rgba(234,179,8,0.3)",

                    borderRadius: 12,

                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      color:
                        "white",

                      fontWeight: 700,

                      marginBottom: 6,
                    }}
                  >
                    {
                      item.title
                    }
                  </div>

                  <div
                    style={{
                      color:
                        diff <= 3
                          ? "#ef4444"
                          : "#eab308",

                      fontSize: 12,
                    }}
                  >
                    {diff > 0
                      ? `${diff} gün kaldı`
                      : "Süre geçti"}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}