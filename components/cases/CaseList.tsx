"use client";

import { useState } from "react";

export default function CaseList({
  cases,
  selectedCase,
  setSelectedCase,
  loadFiles,
  handleDeleteCase,
}: any) {
  const [search, setSearch] =
    useState("");

  return (
    <div
      style={{
        background:
          "rgba(15,23,42,0.78)",

        border:
          "1px solid rgba(255,255,255,0.05)",

        borderRadius: 18,

        padding: 16,

        backdropFilter:
          "blur(10px)",

        maxHeight: 700,

        overflow: "auto",
      }}
    >
      {/* HEADER */}

      <h2
        style={{
          color: "white",

          marginTop: 0,

          marginBottom: 14,

          fontSize: 18,
        }}
      >
        Davalar
      </h2>

      {/* SEARCH */}

      <input
        placeholder="Dava ara..."
        value={search}
        onChange={(e) =>
          setSearch(
            e.target.value
          )
        }
        style={{
          width: "100%",

          background:
            "#020617",

          border:
            "1px solid rgba(255,255,255,0.05)",

          color: "white",

          padding: "12px",

          borderRadius: 12,

          outline: "none",

          marginBottom: 14,

          fontSize: 13,
        }}
      />

      {/* LIST */}

      <div
        style={{
          display: "flex",

          flexDirection:
            "column",

          gap: 10,
        }}
      >
        {cases
          .filter((item: any) =>
            (
              item.title +
              item.client +
              item.court
            )
              .toLowerCase()
              .includes(
                search.toLowerCase()
              )
          )
          .map((item: any) => {
            const now =
              new Date();

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

            let statusColor =
              "#22c55e";

            let statusText =
              "Normal";

            if (diff <= 7) {
              statusColor =
                "#eab308";

              statusText =
                "Yaklaşıyor";
            }

            if (diff <= 3) {
              statusColor =
                "#ef4444";

              statusText =
                "Kritik";
            }

            return (
              <div
                key={item.id}
                style={{
                  background:
                    selectedCase?.id ===
                    item.id
                      ? "#1e3a8a"
                      : "#020617",

                  border:
                    "1px solid rgba(255,255,255,0.05)",

                  borderRadius: 14,

                  padding: 14,

                  cursor:
                    "pointer",

                  transition:
                    "0.2s",

                  display:
                    "flex",

                  justifyContent:
                    "space-between",

                  alignItems:
                    "center",

                  gap: 10,
                }}
              >
                {/* LEFT */}

                <div
                  onClick={() => {
                    setSelectedCase(
                      item
                    );

                    loadFiles(
                      item.id
                    );
                  }}
                  style={{
                    flex: 1,
                  }}
                >
                  {/* TITLE */}

                  <div
                    style={{
                      display:
                        "flex",

                      alignItems:
                        "center",

                      justifyContent:
                        "space-between",

                      marginBottom: 8,
                    }}
                  >
                    <h3
                      style={{
                        color:
                          "white",

                        margin: 0,

                        fontSize: 15,
                      }}
                    >
                      {
                        item.title
                      }
                    </h3>

                    {/* STATUS */}

                    <div
                      style={{
                        background:
                          statusColor,

                        color:
                          "white",

                        padding:
                          "4px 10px",

                        borderRadius: 999,

                        fontSize: 11,

                        fontWeight: 700,
                      }}
                    >
                      {statusText}
                    </div>
                  </div>

                  {/* CLIENT */}

                  <p
                    style={{
                      color:
                        "#94a3b8",

                      marginTop: 0,

                      marginBottom: 6,

                      fontSize: 12,
                    }}
                  >
                    👤{" "}
                    {
                      item.client
                    }
                  </p>

                  {/* COURT */}

                  <p
                    style={{
                      color:
                        "#64748b",

                      marginTop: 0,

                      marginBottom: 6,

                      fontSize: 11,
                    }}
                  >
                    ⚖️{" "}
                    {
                      item.court
                    }
                  </p>

                  {/* DEADLINE */}

                  <p
                    style={{
                      color:
                        diff <= 3
                          ? "#ef4444"
                          : "#94a3b8",

                      margin: 0,

                      fontSize: 11,
                    }}
                  >
                    ⏳{" "}
                    {diff > 0
                      ? `${diff} gün kaldı • ${item.duration} günlük süre`
                      : "Süre geçti"}
                  </p>

                  {/* RISK */}

                  <div
                    style={{
                      marginTop: 8,

                      display: "flex",

                      gap: 8,

                      flexWrap:
                        "wrap",
                    }}
                  >
                    <div
                      style={{
                        background:
                          item.risk_level ===
                          "Kritik"
                            ? "#7f1d1d"
                            : item.risk_level ===
                                "Yüksek"
                              ? "#991b1b"
                              : item.risk_level ===
                                  "Orta"
                                ? "#78350f"
                                : "#14532d",

                        color:
                          "white",

                        padding:
                          "4px 10px",

                        borderRadius: 999,

                        fontSize: 10,

                        fontWeight: 700,
                      }}
                    >
                      Risk:
                      {" "}
                      {
                        item.risk_level
                      }
                    </div>

                    <div
                      style={{
                        background:
                          "#1e293b",

                        color:
                          "#cbd5e1",

                        padding:
                          "4px 10px",

                        borderRadius: 999,

                        fontSize: 10,
                      }}
                    >
                      %
                      {
                        item.risk_score
                      }
                    </div>
                  </div>
                </div>

                {/* DELETE */}

                <button
                  onClick={() =>
                    handleDeleteCase(
                      item.id
                    )
                  }
                  style={{
                    background:
                      "transparent",

                    border:
                      "none",

                    color:
                      "#ef4444",

                    cursor:
                      "pointer",

                    fontSize: 18,
                  }}
                >
                  🗑️
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
}