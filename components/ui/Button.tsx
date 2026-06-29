import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  style,
  ...props
}: ButtonProps) {
  const variants = {
    primary: { background: "#ffffff", color: "#09090b", border: "1px solid #ffffff" },
    secondary: { background: "rgba(255,255,255,.08)", color: "#f8fafc", border: "1px solid rgba(255,255,255,.12)" },
    ghost: { background: "transparent", color: "#cbd5e1", border: "1px solid transparent" },
    danger: { background: "#ef4444", color: "#fff", border: "1px solid #ef4444" },
  };

  const sizes = {
    sm: { height: 34, padding: "0 12px", fontSize: 13 },
    md: { height: 42, padding: "0 16px", fontSize: 14 },
    lg: { height: 50, padding: "0 20px", fontSize: 15 },
  };

  return (
    <button
      {...props}
      style={{
        ...variants[variant],
        ...sizes[size],
        borderRadius: 14,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all .2s ease",
        boxShadow: variant === "primary" ? "0 14px 34px rgba(255,255,255,.12)" : "none",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
