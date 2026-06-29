import React from "react";

type HeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export default function Header({ title, subtitle, right }: HeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "18px 0",
      }}
    >
      <div>
        <h1 style={{ margin: 0, color: "#fff", fontSize: 26, letterSpacing: "-.04em" }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: 14 }}>
            {subtitle}
          </p>
        )}
      </div>
      {right && <div>{right}</div>}
    </header>
  );
}
