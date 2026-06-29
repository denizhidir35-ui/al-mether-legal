import React from "react";

type LayoutProps = {
  children: React.ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(99,102,241,.22), transparent 34%), radial-gradient(circle at top right, rgba(14,165,233,.16), transparent 32%), #050507",
        color: "#f8fafc",
        padding: "0 16px 92px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1180, margin: "0 auto" }}>
        {children}
      </div>
    </main>
  );
}
