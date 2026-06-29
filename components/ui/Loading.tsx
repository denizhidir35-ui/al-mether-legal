import React from "react";

type LoadingProps = {
  label?: string;
};

export default function Loading({ label = "Yükleniyor..." }: LoadingProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        color: "#94a3b8",
        fontSize: 14,
        padding: 16,
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,.16)",
          borderTopColor: "#fff",
        }}
      />
      {label}
    </div>
  );
}
