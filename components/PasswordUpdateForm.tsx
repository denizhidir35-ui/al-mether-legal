"use client";

import { Eye, EyeOff } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { createClient } from "@/lib/supabaseClient";

type PasswordUpdateFormProps = {
  buttonLabel: string;
  noSessionMessage: string;
  onSuccess?: () => void | Promise<void>;
  signOutAfterUpdate?: boolean;
};

export default function PasswordUpdateForm({
  buttonLabel,
  noSessionMessage,
  onSuccess,
  signOutAfterUpdate = false,
}: PasswordUpdateFormProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function checkSession() {
      const result = await supabase.auth.getUser();
      if (!active) return;

      if (!result.error && result.data.user) {
        setSessionReady(true);
      } else {
        setError(noSessionMessage);
      }
      setChecking(false);
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [noSessionMessage]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }
    if (password !== confirmation) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const result = await supabase.auth.updateUser({ password });

    if (result.error) {
      setError("Şifre güncellenemedi. Lütfen yeniden deneyin.");
      setSubmitting(false);
      return;
    }

    setPassword("");
    setConfirmation("");
    setSuccess("Şifreniz güncellendi.");

    if (signOutAfterUpdate) {
      await supabase.auth.signOut({ scope: "local" });
    }
    if (onSuccess) await onSuccess();
    setSubmitting(false);
  }

  function renderPasswordField(
    label: string,
    value: string,
    visible: boolean,
    setValue: (value: string) => void,
    toggle: () => void
  ) {
    return (
      <label>
        {label}
        <span className="password-field">
          <input
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            required
          />
          <button
            className="password-toggle"
            type="button"
            aria-label={visible ? `${label} gizle` : `${label} göster`}
            aria-pressed={visible}
            onClick={toggle}
          >
            {visible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
          </button>
        </span>
      </label>
    );
  }

  return (
    <form className="password-update-form" onSubmit={handleSubmit}>
      {renderPasswordField("Yeni Şifre", password, passwordVisible, setPassword, () =>
        setPasswordVisible((visible) => !visible)
      )}
      {renderPasswordField(
        "Yeni Şifre Tekrar",
        confirmation,
        confirmationVisible,
        setConfirmation,
        () => setConfirmationVisible((visible) => !visible)
      )}

      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {success ? <p className="form-success" role="status">{success}</p> : null}

      <button className="password-submit" type="submit" disabled={checking || submitting || !sessionReady}>
        {submitting ? "Güncelleniyor..." : buttonLabel}
      </button>

      <style jsx>{`
        .password-update-form { display: grid; gap: 14px; }
        label { display: grid; gap: 7px; color: var(--legal-muted, #a9adb5); font-size: 10px; font-weight: 750; }
        .password-field { position: relative; display: block; }
        input { width: 100%; height: 46px; padding: 0 48px 0 14px; border: 1px solid var(--legal-border, #242b36); border-radius: 12px; outline: none; background: var(--legal-surface-2, rgba(14, 18, 25, 0.96)); color: var(--legal-text, #f5f2eb); font: inherit; font-size: 14px; }
        input:focus { border-color: var(--legal-gold, #c8a45f); box-shadow: 0 0 0 3px rgba(200, 164, 95, 0.12); }
        .password-toggle { position: absolute; top: 50%; right: 4px; display: grid; width: 38px; height: 38px; padding: 0; border: 0; border-radius: 9px; background: transparent; color: var(--legal-muted, #a9adb5); cursor: pointer; place-items: center; transform: translateY(-50%); }
        .password-toggle:hover { color: var(--legal-gold, #d9b86e); }
        .password-submit { height: 46px; border: 1px solid var(--legal-gold, #c8a45f); border-radius: 12px; background: linear-gradient(135deg, #d9b86e, #a97e34); color: #090a0d; cursor: pointer; font-size: 12px; font-weight: 850; }
        .password-submit:disabled { cursor: not-allowed; opacity: 0.58; }
        .form-error, .form-success { margin: -2px 0 0; color: var(--legal-danger, #e58484); font-size: 9px; text-align: center; }
        .form-success { color: var(--legal-success, #75c69a); }
      `}</style>
    </form>
  );
}
