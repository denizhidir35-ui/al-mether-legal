"use client";

import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { createClient } from "@/lib/supabaseClient";

type LoginPhase = "waiting" | "intro" | "fading" | "form";

const INTRO_FALLBACK_MS = 7000;
const INTRO_FADE_MS = 360;

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [phase, setPhase] = useState<LoginPhase>("waiting");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      router.replace("/inbox");
      return;
    }

    if (status === "unauthenticated" && phase === "waiting") {
      setPhase("intro");
    }
  }, [phase, router, session, status]);

  useEffect(() => {
    if (phase !== "intro") return;

    const fallback = window.setTimeout(
      () => setPhase("fading"),
      INTRO_FALLBACK_MS
    );

    return () => window.clearTimeout(fallback);
  }, [phase]);

  useEffect(() => {
    if (phase !== "fading") return;

    const transition = window.setTimeout(
      () => setPhase("form"),
      INTRO_FADE_MS
    );

    return () => window.clearTimeout(transition);
  }, [phase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const supabase = createClient();
    const supabaseResult = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (supabaseResult.error) {
      setError("E-posta veya şifre hatalı.");
      setSubmitting(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.ok) {
      router.replace("/inbox");
      router.refresh();
      return;
    }

    await supabase.auth.signOut({ scope: "local" });
    setError("E-posta veya şifre hatalı.");
    setSubmitting(false);
  }

  const showIntro = phase === "intro" || phase === "fading";

  return (
    <main className="login-page">
      <style jsx>{`
        .login-page {
          min-height: 100vh;
          min-height: 100dvh;
          display: grid;
          place-items: center;
          overflow: hidden;
          background:
            linear-gradient(rgba(2, 5, 13, 0.82), rgba(2, 5, 13, 0.92)),
            url("/brand/legal-login-background.webp") center / cover no-repeat,
            #02050d;
          color: #f5f2eb;
        }

        .intro {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          border: 0;
          object-fit: cover;
          background: #02050d;
          opacity: ${phase === "fading" ? 0 : 1};
          transition: opacity ${INTRO_FADE_MS}ms ease;
        }

        .login-shell {
          width: min(360px, calc(100vw - 40px));
          animation: form-in 360ms ease both;
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
          letter-spacing: 0.04em;
        }

        input {
          width: 100%;
          height: 48px;
          padding: 0 14px;
          border: 1px solid #242b36;
          border-radius: 12px;
          outline: none;
          background: rgba(14, 18, 25, 0.94);
          color: #f5f2eb;
          font: inherit;
          font-size: 14px;
          transition: border-color 140ms ease, box-shadow 140ms ease;
        }

        input:focus {
          border-color: #c8a45f;
          box-shadow: 0 0 0 3px rgba(200, 164, 95, 0.12);
        }

        input:-webkit-autofill {
          -webkit-text-fill-color: #f5f2eb;
          box-shadow: 0 0 0 1000px #0e1219 inset;
        }

        .password-field {
          position: relative;
        }

        .password-field input {
          padding-right: 48px;
        }

        .password-toggle {
          position: absolute;
          top: 50%;
          right: 4px;
          display: grid;
          width: 40px;
          height: 40px;
          padding: 0;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: #a9adb5;
          cursor: pointer;
          place-items: center;
          transform: translateY(-50%);
          transition: color 140ms ease, background-color 140ms ease;
        }

        .password-toggle:hover {
          background: rgba(200, 164, 95, 0.08);
          color: #d9b86e;
        }

        .password-toggle:focus-visible {
          outline: 2px solid #c8a45f;
          outline-offset: -2px;
        }

        .submit-button {
          width: 100%;
          height: 48px;
          margin-top: 4px;
          border: 1px solid #c8a45f;
          border-radius: 12px;
          background: linear-gradient(135deg, #d9b86e, #a97e34);
          color: #090a0d;
          cursor: pointer;
          font-size: 12px;
          font-weight: 850;
          letter-spacing: 0.04em;
          transition: filter 140ms ease, transform 140ms ease;
        }

        .submit-button:hover {
          filter: brightness(1.08);
        }

        .submit-button:active {
          transform: translateY(1px);
        }

        .submit-button:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        .error {
          margin: -4px 0 0;
          color: #e58484;
          font-size: 10px;
          text-align: center;
        }

        .forgot-link {
          margin-top: -4px;
          color: #c8a45f;
          font-size: 10px;
          text-align: center;
          text-decoration: none;
        }

        .forgot-link:hover {
          color: #e0c37d;
          text-decoration: underline;
        }

        .browser-integrations {
          display: grid;
          gap: 8px;
          margin-top: 2px;
          padding-top: 13px;
          border-top: 1px solid rgba(200, 164, 95, 0.16);
        }

        .browser-integrations-title {
          margin: 0;
          color: #8f949d;
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-align: center;
          text-transform: uppercase;
        }

        .browser-integration-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .browser-integration-link {
          display: grid;
          min-height: 38px;
          padding: 7px 9px;
          border: 1px solid rgba(200, 164, 95, 0.28);
          border-radius: 10px;
          background: rgba(14, 18, 25, 0.72);
          color: #c7a75f;
          font-size: 9px;
          font-weight: 780;
          line-height: 1.25;
          place-items: center;
          text-align: center;
          text-decoration: none;
          transition:
            border-color 140ms ease,
            background-color 140ms ease,
            color 140ms ease;
        }

        .browser-integration-link:hover {
          border-color: rgba(217, 184, 110, 0.5);
          background: rgba(200, 164, 95, 0.08);
          color: #d9b86e;
        }

        .browser-integration-link:focus-visible {
          outline: 2px solid #c8a45f;
          outline-offset: 2px;
        }

        .browser-integrations-mobile-note {
          display: none;
          margin: 0;
          color: #8f949d;
          font-size: 9px;
          line-height: 1.45;
          text-align: center;
        }

        @keyframes form-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 500px) {
          .login-shell {
            width: min(330px, calc(100vw - 36px));
          }

          .browser-integrations-title,
          .browser-integration-actions {
            display: none;
          }

          .browser-integrations-mobile-note {
            display: block;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .intro,
          .login-shell {
            transition-duration: 1ms;
            animation-duration: 1ms;
          }
        }
      `}</style>

      {showIntro ? (
        <video
          className="intro"
          src="/brand/mether-signature.mp4"
          muted
          playsInline
          autoPlay
          onEnded={() => setPhase("fading")}
          onError={() => setPhase("fading")}
          aria-label="AL METHER"
        />
      ) : null}

      {phase === "form" ? (
        <section className="login-shell">
          <form onSubmit={handleSubmit}>
            <label>
              E-posta
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </label>

            <label>
              Şifre
              <span className="password-field">
                <input
                  name="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={
                    passwordVisible ? "Şifreyi gizle" : "Şifreyi göster"
                  }
                  aria-pressed={passwordVisible}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordVisible ? (
                    <EyeOff aria-hidden="true" size={18} strokeWidth={1.8} />
                  ) : (
                    <Eye aria-hidden="true" size={18} strokeWidth={1.8} />
                  )}
                </button>
              </span>
            </label>

            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              className="submit-button"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>

            <Link className="forgot-link" href="/auth/forgot-password">
              Şifremi Unuttum
            </Link>

            <div className="browser-integrations">
              <p className="browser-integrations-title">
                Tarayıcı Entegrasyonları
              </p>

              <div className="browser-integration-actions">
                <a
                  className="browser-integration-link"
                  href="https://chromewebstore.google.com/detail/mether-uets-bridge/cnmjjlkcmficmebjggonppenbkhpmhda"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  UETS Bridge
                </a>

                <a
                  className="browser-integration-link"
                  href="https://chromewebstore.google.com/detail/mether-celse-uyap-bridge/eeifkhhlennmliiliapibkjhmeoihjhn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  UYAP / CELSE Bridge
                </a>
              </div>

              <p className="browser-integrations-mobile-note">
                Masaüstü Chrome üzerinden kurulabilir
              </p>
            </div>
          </form>
        </section>
      ) : null}
    </main>
  );
}
