"use client";
import { useCallback, useEffect, useState } from "react";

type LicenseUser = {
  id: string; name: string | null; email: string; subscription_status: string;
  trial_started_at: string | null; trial_ends_at: string | null;
  licensed_until: string | null; is_license_owner: boolean;
};

export default function SubscriptionManagement() {
  const [users, setUsers] = useState<LicenseUser[]>([]);
  const [days, setDays] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("Kullanıcılar yükleniyor...");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/subscriptions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setUsers(data.users);
      setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Kullanıcılar yüklenemedi."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function change(userId: string, action: string) {
    setBusy(userId);
    try {
      const response = await fetch("/api/admin/subscriptions", { method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, days: days[userId] ?? 5, licensedUntil: null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await load();
      setMessage("İşlem kaydedildi.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "İşlem tamamlanamadı."); }
    finally { setBusy(""); }
  }

  return <section>
    <p>Demolar yalnızca OWNER onayıyla başlar. Varsayılan süre 5 gündür. Lisans aktivasyonu süresizdir.</p>
    <p role="status">{message}</p>
    {users.map(user => <article key={user.id} style={{ border: "1px solid var(--legal-border)", borderRadius: 12, padding: 16, marginTop: 12 }}>
      <strong>{user.name || user.email}</strong><p>{user.email}</p>
      <p>{user.subscription_status}{user.is_license_owner ? " · OWNER" : ""}</p>
      {user.trial_ends_at && <p>Demo bitişi: {new Date(user.trial_ends_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} (İstanbul)</p>}
      {user.licensed_until && <p>Lisans bitişi: {new Date(user.licensed_until).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} (İstanbul)</p>}
      {!user.is_license_owner && <fieldset disabled={Boolean(busy)} style={{ border: 0, padding: 0, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label>Demo Süresi: <select value={days[user.id] ?? 5} onChange={e => setDays({ ...days, [user.id]: Number(e.target.value) })}>
          {[2, 5, 7].map(day => <option key={day} value={day}>{day} gün</option>)}
        </select></label>
        <button type="button" disabled={user.subscription_status !== "TRIAL_PENDING"} onClick={() => void change(user.id, "approve")}>Demo Onayla</button>
        <button type="button" disabled={!["TRIAL_ACTIVE", "TRIAL_EXPIRED"].includes(user.subscription_status)} onClick={() => void change(user.id, "extend")}>Demo Uzat</button>
        <button type="button" onClick={() => void change(user.id, "activate")}>Lisansı Aktifleştir</button>
        <button type="button" disabled={user.subscription_status === "SUSPENDED"} onClick={() => void change(user.id, "suspend")}>Askıya Al</button>
      </fieldset>}
    </article>)}
  </section>;
}
