"use client";

import { useEffect, useState } from "react";

export default function FileList() {

  const [files, setFiles] =
    useState<any[]>([]);

  useEffect(() => {

    const stored =
      JSON.parse(
        localStorage.getItem(
          "al-mether-cases"
        ) || "[]"
      );

    setFiles(stored);

  }, []);

  return (

    <div
      style={{
        background:
          "rgba(15,23,42,0.65)",

        border:
          "1px solid rgba(255,255,255,0.08)",

        borderRadius: 28,

        padding: 24,
      }}
    >

      <h2
        style={{
          marginBottom: 20,

          fontSize: 24,

          fontWeight: 700,

          color: "white",
        }}
      >
        📂 Dosyalar
      </h2>

      {files.length === 0 && (

        <div
          style={{
            color: "#94a3b8",

            padding: 20,
          }}
        >
          Henüz kayıtlı dava yok.
        </div>

      )}

      {files.map((file) => (

        <div
          key={file.id}
          style={{
            background:
              "rgba(255,255,255,0.03)",

            border:
              "1px solid rgba(255,255,255,0.05)",

            borderRadius: 18,

            padding: 16,

            marginBottom: 12,
          }}
        >

          <div
            style={{
              fontWeight: 700,

              color: "white",

              fontSize: 16,
            }}
          >
            {file.title}
          </div>

          <div
            style={{
              color: "#cbd5e1",

              marginTop: 8,
            }}
          >
            👤 {file.client}
          </div>

          <div
            style={{
              color: "#cbd5e1",

              marginTop: 4,
            }}
          >
            🏛️ {file.court}
          </div>

          <div
            style={{
              color: "#facc15",

              marginTop: 6,

              fontWeight: 700,
            }}
          >
            📅 {file.deadline}
          </div>

          <div
            style={{
              color: "#64748b",

              marginTop: 6,

              fontSize: 12,
            }}
          >
            {file.createdAt}
          </div>

        </div>

      ))}

    </div>
  );
}