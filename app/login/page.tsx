"use client";

import {
  signIn,
  useSession,
} from "next-auth/react";

import {
  useRouter,
} from "next/navigation";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

export default function LoginPage() {
  const router =
    useRouter();

  const {
    data: session,
    status,
  } = useSession();

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  useEffect(() => {
    if (
      status ===
        "authenticated" &&
      session?.user
    ) {
      router.replace(
        "/dashboard"
      );
    }
  }, [
    status,
    session,
    router,
  ]);

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const formData =
      new FormData(
        event.currentTarget
      );

    const result =
      await signIn(
        "credentials",
        {
          email:
            formData.get(
              "email"
            ),

          password:
            formData.get(
              "password"
            ),

          redirect:
            false,
        }
      );

    if (result?.ok) {
      router.replace(
        "/dashboard"
      );
      router.refresh();
      return;
    }

    setError(
      "E-posta veya şifre hatalı."
    );
    setSubmitting(false);
  }

  return (
    <main className="login-page">
      <style jsx>{`
        .login-page {
          min-height: 100vh;
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding:
            max(24px, env(safe-area-inset-top))
            20px
            max(24px, env(safe-area-inset-bottom));
          overflow: hidden;
          background: #02050d;
          color: #f5f2eb;
        }

        .login-shell {
          width: min(360px, 100%);
          text-align: center;
        }

        .signature {
          display: block;
          width: min(310px, 92vw);
          aspect-ratio: 16 / 9;
          margin: 0 auto;
          border: 0;
          object-fit: contain;
          background: #02050d;
        }

        .legal-word {
          margin: 7px 0 34px;
          color: #c8a45f;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.58em;
          text-indent: 0.58em;
        }

        form {
          display: grid;
          gap: 16px;
          text-align: left;
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
          background:
            rgba(14, 18, 25, 0.94);
          color: #f5f2eb;
          font: inherit;
          font-size: 14px;
          transition:
            border-color 140ms ease,
            box-shadow 140ms ease;
        }

        input:focus {
          border-color: #c8a45f;
          box-shadow:
            0 0 0 3px
            rgba(200, 164, 95, 0.12);
        }

        input:-webkit-autofill {
          -webkit-text-fill-color:
            #f5f2eb;
          box-shadow:
            0 0 0 1000px
            #0e1219 inset;
        }

        button {
          width: 100%;
          height: 48px;
          margin-top: 4px;
          border: 1px solid #c8a45f;
          border-radius: 12px;
          background:
            linear-gradient(
              135deg,
              #d9b86e,
              #a97e34
            );
          color: #090a0d;
          cursor: pointer;
          font-size: 12px;
          font-weight: 850;
          letter-spacing: 0.04em;
          transition:
            filter 140ms ease,
            transform 140ms ease;
        }

        button:hover {
          filter: brightness(1.08);
        }

        button:active {
          transform: translateY(1px);
        }

        button:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        .error {
          margin: -4px 0 0;
          color: #e58484;
          font-size: 10px;
          text-align: center;
        }

        @media (max-width: 500px) {
          .login-shell {
            width: min(330px, 100%);
          }

          .signature {
            width: min(280px, 86vw);
          }

          .legal-word {
            margin-bottom: 28px;
          }
        }
      `}</style>

      <section className="login-shell">
        <video
          className="signature"
          src="/brand/mether-signature.mp4"
          muted
          playsInline
          autoPlay
          aria-label="AL METHER"
        />

        <div className="legal-word">
          LEGAL
        </div>

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
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? (
            <p
              className="error"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={
              submitting ||
              status === "loading"
            }
          >
            {submitting
              ? "Giriş yapılıyor..."
              : "Giriş Yap"}
          </button>
        </form>
      </section>
    </main>
  );
}
