"use client";

export default function UploadBox() {
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
        }}
      >
        📂 Dosya Yükleme
      </h2>

      <div
        style={{
          border:
            "2px dashed rgba(255,255,255,0.1)",

          borderRadius: 16,

          padding: 30,

          textAlign: "center",

          color: "#94a3b8",

          marginTop: 12,
        }}
      >
        Upload sistemi geçici olarak devre dışı.
      </div>
    </div>
  );
}