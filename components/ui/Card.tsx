import React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
};

export default function Card({ children, elevated = false, style, ...props }: CardProps) {
  return (
    <div
      {...props}
      style={{
        border: "1px solid rgba(255,255,255,.10)",
        background: "linear-gradient(180deg, rgba(255,255,255,.075), rgba(255,255,255,.035))",
        borderRadius: 24,
        padding: 18,
        boxShadow: elevated ? "0 24px 80px rgba(0,0,0,.35)" : "none",
        backdropFilter: "blur(18px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
