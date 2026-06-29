import React from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export default function Input({ label, style, ...props }: InputProps) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      {label && (
        <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>
          {label}
        </span>
      )}
      <input
        {...props}
        style={{
          width: "100%",
          height: 46,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(255,255,255,.06)",
          color: "#f8fafc",
          padding: "0 14px",
          outline: "none",
          fontSize: 15,
          ...style,
        }}
      />
    </label>
  );
}
