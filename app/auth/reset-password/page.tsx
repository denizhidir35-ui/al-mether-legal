"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

import PasswordUpdateForm from "@/components/PasswordUpdateForm";

export default function ResetPasswordPage() {
  const router = useRouter();

  async function finishReset() {
    await signOut({ redirect: false });
    router.replace("/login");
  }

  return (
    <main className="auth-page">
      <section>
        <h1>Şifre Sıfırlama</h1>
        <PasswordUpdateForm
          buttonLabel="Şifreyi Güncelle"
          noSessionMessage="Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş."
          signOutAfterUpdate
          onSuccess={finishReset}
        />
      </section>

      <style jsx>{`
        .auth-page { min-height: 100dvh; display: grid; padding: 24px; background: #02050d; color: #f5f2eb; place-items: center; }
        section { width: min(380px, 100%); }
        h1 { margin: 0 0 22px; color: #d9b86e; font-size: 22px; text-align: center; }
      `}</style>
    </main>
  );
}
