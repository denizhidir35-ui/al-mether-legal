"use client";

import React from "react";

type BottomSheetProps = {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
};

export default function BottomSheet({ open, title, children, onClose }: BottomSheetProps) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        background: "rgba(0,0,0,.64)",
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "82vh",
          overflow: "auto",
          borderRadius: "30px 30px 0 0",
          border: "1px solid rgba(255,255,255,.12)",
          background: "#09090b",
          padding: 20,
          boxShadow: "0 -30px 90px rgba(0,0,0,.5)",
        }}
      >
        <div
          style={{
            width: 44,
            height: 5,
            borderRadius: 999,
            background: "rgba(255,255,255,.22)",
            margin: "0 auto 16px",
          }}
        />
        {title && <h2 style={{ margin: "0 0 14px", color: "#fff", fontSize: 18 }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}
