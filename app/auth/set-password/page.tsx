"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabaseClient";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [checking, setChecking] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function checkInviteSession() {
      const result =
        await supabase.auth.getUser();

      if (!active) return;

      if (
        result.error ||
        !result.data.user
      ) {
        setError(
          "Davet bağlantısı geçersiz veya süresi dolmuş."
        );
      } else {
        setSessionReady(true);
      }

      setChecking(false);
    }

    void checkInviteSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(
        "Şifre en az 8 karakter olmalıdır."
      );
      return;
    }

    if (password !== confirmation) {
      setError(
        "Şifreler eşleşmiyor."
      );
      return;
    }

    setSubmitting(true);

    const supabase = createClient();
    const user =
      await supabase.auth.getUser();

    if (
      user.error ||
      !user.data.user
    ) {
      setError(
        "Davet bağlantısı geçersiz veya süresi dolmuş."
      );
      setSubmitting(false);
      return;
    }

    const updated =
      await supabase.auth.updateUser({
        password,
      });

    if (updated.error) {
      setError(
        "Şifre oluşturulamadı. Lütfen bağlantıyı yeniden açın."
      );
      setSubmitting(false);
      return;
    }

    await supabase.auth.signOut({
      scope: "local",
    });

    setPassword("");
    setConfirmation("");
    router.replace("/login");
  }

  return (
    <main className="set-password-page">
      <section className="set-password-panel">
        <h1>Şifrenizi Oluşturun</h1>

        {checking ? (
          <p className="status">
            Davet doğrulanıyor...
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>
              Yeni Şifre
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                required
              />
            </label>

            <label>
              Yeni Şifre Tekrar
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) =>
                  setConfirmation(
                    event.target.value
                  )
                }
                required
              />
            </label>

            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                submitting ||
                !sessionReady
              }
            >
              {submitting
                ? "Oluşturuluyor..."
                : "Şifreyi Oluştur"}
            </button>
          </form>
        )}
      </section>

      <style jsx>{`
        .set-password-page {
          min-height: 100vh;
          min-height: 100dvh;
          display: grid;
          padding: 20px;
          background: #02050d;
          color: #f5f2eb;
          place-items: center;
        }

        .set-password-panel {
          width: min(360px, 100%);
        }

        h1 {
          margin: 0 0 28px;
          color: #d9b86e;
          font-size: 20px;
          text-align: center;
        }

        form {
          display: grid;
          gap: 16px;
        }

        label {
          display: grid;
          gap: 7px;
          color: #a9adb5;
          font-size: 10px;
          font-weight: 750;
        }

        input {
          width: 100%;
          height: 48px;
          padding: 0 14px;
          border: 1px solid #242b36;
          border-radius: 12px;
          outline: none;
          background: rgba(14, 18, 25, 0.96);
          color: #f5f2eb;
          font: inherit;
          font-size: 14px;
        }

        input:focus {
          border-color: #c8a45f;
          box-shadow: 0 0 0 3px rgba(200, 164, 95, 0.12);
        }

        button {
          height: 48px;
          margin-top: 4px;
          border: 1px solid #c8a45f;
          border-radius: 12px;
          background: linear-gradient(135deg, #d9b86e, #a97e34);
          color: #090a0d;
          cursor: pointer;
          font-size: 12px;
          font-weight: 850;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.58;
        }

        .status,
        .error {
          color: #a9adb5;
          font-size: 10px;
          text-align: center;
        }

        .error {
          margin: -3px 0 0;
          color: #e58484;
        }
      `}</style>
    </main>
  );
}
