"use client";

import { createClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const loginWithGoogle = async () => {
    const supabase = createClient();

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes:
          "openid email profile https://www.googleapis.com/auth/gmail.readonly",
      },
    });
  };

  return (
    <main className="min-h-screen bg-[#050816] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <h1 className="text-3xl font-bold mb-2">AL Mether Legal</h1>
        <p className="text-white/60 mb-8">
          Avukatın hukuki süre kaçırmasını engelleyen sistem.
        </p>

        <button
          onClick={loginWithGoogle}
          className="w-full rounded-xl bg-white text-black py-3 font-semibold hover:bg-white/90 transition"
        >
          Google ile Giriş Yap
        </button>

        <p className="text-xs text-white/40 mt-6">
          Sadece yetkilendirilmiş kullanıcılar uygulamaya erişebilir.
        </p>
      </div>
    </main>
  );
}
