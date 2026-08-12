"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabaseClient";

const INVALID_INVITE_MESSAGE =
  "Davet bağlantısı geçersiz veya süresi dolmuş. Yeni davet isteyin.";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  async function acceptInvite() {
    setError("");
    setAccepting(true);

    const searchParams = new URLSearchParams(window.location.search);
    const tokenHash = searchParams.get("token_hash")?.trim() || "";
    const type = searchParams.get("type");

    if (!tokenHash || type !== "invite") {
      setError(INVALID_INVITE_MESSAGE);
      setAccepting(false);
      return;
    }

    const supabase = createClient();
    const verified = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "invite",
    });

    if (verified.error || !verified.data.session) {
      setError(INVALID_INVITE_MESSAGE);
      setAccepting(false);
      return;
    }

    router.replace("/auth/set-password");
  }

  return (
    <main className="accept-invite-page">
      <section>
        <h1>AL METHER Legal’e davet edildiniz</h1>

        {error ? (
          <p role="alert">{error}</p>
        ) : null}

        <button
          type="button"
          disabled={accepting}
          onClick={acceptInvite}
        >
          {accepting ? "Davet kabul ediliyor..." : "Davetimi Kabul Et"}
        </button>
      </section>

      <style jsx>{`
        .accept-invite-page {
          min-height: 100vh;
          min-height: 100dvh;
          display: grid;
          padding: 24px;
          background: #02050d;
          color: #f5f2eb;
          place-items: center;
        }

        section {
          width: min(380px, 100%);
          display: grid;
          gap: 22px;
        }

        h1 {
          margin: 0;
          color: #d9b86e;
          font-size: 22px;
          line-height: 1.3;
          text-align: center;
        }

        p {
          margin: 0;
          color: #e58484;
          font-size: 10px;
          line-height: 1.5;
          text-align: center;
        }

        button {
          width: 100%;
          height: 48px;
          border: 1px solid #c8a45f;
          border-radius: 12px;
          background: linear-gradient(135deg, #d9b86e, #a97e34);
          color: #090a0d;
          cursor: pointer;
          font-size: 12px;
          font-weight: 850;
        }

        button:disabled {
          cursor: wait;
          opacity: 0.65;
        }
      `}</style>
    </main>
  );
}
