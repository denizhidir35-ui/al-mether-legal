"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { createClient } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://legal.almether.com/auth/reset-password",
    });

    setMessage(
      "E-posta sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderildi."
    );
    setSubmitting(false);
  }

  return (
    <main className="auth-page">
      <section>
        <h1>Şifremi Unuttum</h1>
        <form onSubmit={handleSubmit}>
          <label>
            E-posta
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          {message ? <p role="status">{message}</p> : null}
          <button type="submit" disabled={submitting}>
            {submitting
              ? "Gönderiliyor..."
              : "Şifre Sıfırlama Bağlantısı Gönder"}
          </button>
          <Link href="/login">Giriş ekranına dön</Link>
        </form>
      </section>

      <style jsx>{`
        .auth-page { min-height: 100dvh; display: grid; padding: 24px; background: #02050d; color: #f5f2eb; place-items: center; }
        section { width: min(380px, 100%); }
        h1 { margin: 0 0 22px; color: #d9b86e; font-size: 22px; text-align: center; }
        form, label { display: grid; gap: 14px; }
        label { gap: 7px; color: #a9adb5; font-size: 10px; font-weight: 750; }
        input, button { width: 100%; height: 48px; border: 1px solid #242b36; border-radius: 12px; font: inherit; }
        input { padding: 0 14px; outline: none; background: #0e1219; color: #f5f2eb; }
        input:focus { border-color: #c8a45f; box-shadow: 0 0 0 3px rgba(200, 164, 95, 0.12); }
        button { border-color: #c8a45f; background: linear-gradient(135deg, #d9b86e, #a97e34); color: #090a0d; cursor: pointer; font-size: 11px; font-weight: 850; }
        button:disabled { cursor: wait; opacity: 0.65; }
        p { margin: 0; color: #75c69a; font-size: 10px; line-height: 1.5; text-align: center; }
        form :global(a) { color: #c8a45f; font-size: 10px; text-align: center; text-decoration: none; }
      `}</style>
    </main>
  );
}
