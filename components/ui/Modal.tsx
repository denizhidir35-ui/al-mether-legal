"use client";

import React from "react";

type ModalProps = {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
};

export default function Modal({ open, title, children, onClose }: ModalProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,.72)",
        backdropFilter: "blur(14px)",
        display: "grid",
        placeItems: "center",
        padding: 18,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,.12)",
          background: "#09090b",
          boxShadow: "0 40px 120px rgba(0,0,0,.55)",
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ margin: 0, color: "#fff", fontSize: 18 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,.08)",
              color: "#fff",
              border: 0,
              borderRadius: 999,
              width: 34,
              height: 34,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ marginTop: 16 }}>{children}</div>
      </div>
    </div>
  );
}
