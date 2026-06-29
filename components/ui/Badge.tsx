import React from "react";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
};

export default function Badge({ children, tone = "neutral", style, ...props }: BadgeProps) {
  const tones = {
    neutral: ["rgba(255,255,255,.08)", "#e5e7eb"],
    success: ["rgba(34,197,94,.14)", "#86efac"],
    warning: ["rgba(245,158,11,.14)", "#fcd34d"],
    danger: ["rgba(239,68,68,.14)", "#fca5a5"],
    info: ["rgba(59,130,246,.14)", "#93c5fd"],
  } as const;

  return (
    <span
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 26,
        padding: "0 10px",
        borderRadius: 999,
        background: tones[tone][0],
        color: tones[tone][1],
        fontSize: 12,
        fontWeight: 800,
        border: "1px solid rgba(255,255,255,.08)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
