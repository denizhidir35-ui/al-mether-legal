"use client";
import { signOutLegalSession } from "@/components/LegalSessionControl";

export default function SubscriptionAccessScreen({ message, expired = false }: { message: string; expired?: boolean }) {
  return (
    <main className="account-approval-screen" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <section style={{ width: "min(100%, 460px)", padding: 28, border: "1px solid var(--legal-border)", borderRadius: 18, background: "var(--legal-surface)", textAlign: "center" }}>
        <p style={{ color: "var(--legal-gold)", letterSpacing: ".12em", fontSize: 12 }}>AL METHER LEGAL</p>
        <h1 style={{ fontSize: 22, margin: "20px 0" }}>{message}</h1>
        <p style={{ lineHeight: 1.6 }}>Hesabınız ve verileriniz korunur. Erişiminiz onaylandığında aynı hesapla devam edebilirsiniz.</p>
        <p><a href="mailto:info@almether.com?subject=AL%20METHER%20Legal%20Lisans%20Talebi">{expired ? "Lisans Talebi" : "İletişim"}</a></p>
        <p><a href="mailto:info@almether.com">info@almether.com</a></p>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 16, marginTop: 24 }}>
          <button type="button" onClick={() => window.location.reload()}>Durumu Yenile</button>
          <button type="button" onClick={() => void signOutLegalSession()}>Çıkış Yap</button>
        </div>
      </section>
    </main>
  );
}
