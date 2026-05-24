"use client";

import {
  signIn,
  signOut,
  useSession,
} from "next-auth/react";

export default function LoginButton() {
  const {
    data: session,
  } = useSession();

  if (session) {
    return (
      <button
        onClick={() =>
          signOut()
        }
        style={{
          background:
            "#ef4444",

          border: "none",

          color: "white",

          padding:
            "10px 18px",

          borderRadius: 12,

          cursor: "pointer",

          fontWeight: 700,
        }}
      >
        Çıkış Yap
      </button>
    );
  }

  return (
    <button
      onClick={() =>
        signIn("google")
      }
      style={{
        background:
          "#2563eb",

        border: "none",

        color: "white",

        padding:
          "10px 18px",

        borderRadius: 12,

        cursor: "pointer",

        fontWeight: 700,
      }}
    >
      Google Giriş
    </button>
  );
}