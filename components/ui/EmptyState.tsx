import React from "react";
import Button from "./Button";

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "46px 18px",
        borderRadius: 26,
        border: "1px dashed rgba(255,255,255,.14)",
        background: "rgba(255,255,255,.035)",
      }}
    >
      <div style={{ fontSize: 34, marginBottom: 12 }}>◇</div>
      <h3 style={{ margin: 0, color: "#fff", fontSize: 18 }}>{title}</h3>
      {description && (
        <p style={{ margin: "8px auto 0", color: "#94a3b8", maxWidth: 420, fontSize: 14 }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <div style={{ marginTop: 18 }}>
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
    </div>
  );
}
