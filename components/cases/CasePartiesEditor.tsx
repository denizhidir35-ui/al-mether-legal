"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Party = {
  id: string;
  role: string;
  party_type: string;
  name: string;
  is_client: boolean;
  identity_no?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
};

type Draft = {
  id?: string;
  role: string;
  party_type: string;
  name: string;
  is_client: boolean;
  identity_no: string;
  phone: string;
  email: string;
  note: string;
};

const EMPTY: Draft = {
  role: "davaci",
  party_type: "person",
  name: "",
  is_client: false,
  identity_no: "",
  phone: "",
  email: "",
  note: "",
};

const ROLE_LABELS: Record<string, string> = {
  muvekkil: "Müvekkil",
  davaci: "Davacı",
  davali: "Davalı",
  sanik: "Sanık",
  supheli: "Şüpheli",
  katilan: "Katılan",
  feri_mudahil: "Feri Müdahil",
  vekil: "Vekil",
  diger: "Diğer",
};

export default function CasePartiesEditor({
  caseId,
}: {
  caseId: string;
}) {
  const [parties, setParties] =
    useState<Party[]>([]);
  const [draft, setDraft] =
    useState<Draft | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [error, setError] =
    useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/cases/${encodeURIComponent(caseId)}/parties`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || "Taraflar alınamadı."
        );
      }

      setParties(
        Array.isArray(data.parties)
          ? data.parties
          : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Taraflar alınamadı."
      );
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(party: Party) {
    setDraft({
      id: party.id,
      role: party.role,
      party_type: party.party_type,
      name: party.name,
      is_client: party.is_client,
      identity_no: party.identity_no || "",
      phone: party.phone || "",
      email: party.email || "",
      note: party.note || "",
    });
    setError("");
  }

  async function save() {
    if (!draft || !draft.name.trim()) {
      setError("Ad / ünvan zorunludur.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `/api/cases/${encodeURIComponent(caseId)}/parties`,
        {
          method: draft.id ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draft),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || "Taraf kaydedilemedi."
        );
      }

      setDraft(null);
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Taraf kaydedilemedi."
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(party: Party) {
    if (
      !window.confirm(
        `${party.name} bu davadan çıkarılsın mı?`
      )
    ) {
      return;
    }

    try {
      setError("");

      const response = await fetch(
        `/api/cases/${encodeURIComponent(caseId)}/parties?partyId=${encodeURIComponent(party.id)}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || "Taraf çıkarılamadı."
        );
      }

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Taraf çıkarılamadı."
      );
    }
  }

  return (
    <div className="case-party-editor">
      <div className="case-party-header">
        <div>
          <strong>Taraflar ve Müvekkiller</strong>
          <small>
            Davaya bağlı kişi ve kurumları yönetin.
          </small>
        </div>

        {!draft && (
          <button
            type="button"
            onClick={() =>
              setDraft({ ...EMPTY })
            }
          >
            + Taraf Ekle
          </button>
        )}
      </div>

      {loading ? (
        <div className="inline-empty">
          Taraflar yükleniyor...
        </div>
      ) : parties.length === 0 && !draft ? (
        <div className="inline-empty">
          Bu davaya henüz taraf veya müvekkil eklenmemiş.
        </div>
      ) : (
        <div className="case-party-list">
          {parties.map((party) => (
            <div
              key={party.id}
              className="case-party-item"
            >
              <div>
                <strong>{party.name}</strong>
                <small>
                  {ROLE_LABELS[party.role] ||
                    party.role}
                  {party.is_client
                    ? " · Müvekkil"
                    : ""}
                  {" · "}
                  {party.party_type ===
                  "organization"
                    ? "Kurum"
                    : "Kişi"}
                </small>
              </div>

              <div className="inline-actions">
                <button
                  type="button"
                  onClick={() =>
                    startEdit(party)
                  }
                >
                  Düzenle
                </button>

                <button
                  type="button"
                  className="danger"
                  onClick={() =>
                    void remove(party)
                  }
                >
                  Çıkar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="case-party-form">
          <label>
            <span>Rol</span>
            <select
              value={draft.role}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  role: event.target.value,
                })
              }
            >
              <option value="davaci">Davacı</option>
              <option value="davali">Davalı</option>
              <option value="muvekkil">Müvekkil</option>
              <option value="sanik">Sanık</option>
              <option value="supheli">Şüpheli</option>
              <option value="katilan">Katılan</option>
              <option value="feri_mudahil">
                Feri Müdahil
              </option>
              <option value="vekil">Vekil</option>
              <option value="diger">Diğer</option>
            </select>
          </label>

          <label>
            <span>Tip</span>
            <select
              value={draft.party_type}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  party_type:
                    event.target.value,
                })
              }
            >
              <option value="person">Kişi</option>
              <option value="organization">
                Kurum
              </option>
            </select>
          </label>

          <label>
            <span>Ad Soyad / Ünvan</span>
            <input
              value={draft.name}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  name: event.target.value,
                })
              }
            />
          </label>

          <label>
            <span>
              <input
                type="checkbox"
                checked={draft.is_client}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    is_client:
                      event.target.checked,
                  })
                }
              />
              {" "}Bu taraf müvekkilim
            </span>
          </label>

          <label>
            <span>TCKN / VKN</span>
            <input
              value={draft.identity_no}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  identity_no:
                    event.target.value,
                })
              }
            />
          </label>

          <label>
            <span>Telefon</span>
            <input
              value={draft.phone}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  phone: event.target.value,
                })
              }
            />
          </label>

          <label>
            <span>E-posta</span>
            <input
              type="email"
              value={draft.email}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  email: event.target.value,
                })
              }
            />
          </label>

          <label>
            <span>Not</span>
            <textarea
              value={draft.note}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  note: event.target.value,
                })
              }
            />
          </label>

          <div className="manual-reminder-actions">
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                setDraft(null)
              }
            >
              Vazgeç
            </button>

            <button
              type="button"
              className="save-reminder"
              disabled={
                saving || !draft.name.trim()
              }
              onClick={() => void save()}
            >
              {saving
                ? "Kaydediliyor..."
                : "Tarafı Kaydet"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="manual-reminder-message error">
          {error}
        </div>
      )}

      <style jsx>{`
        .case-party-editor {
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid
            rgba(148, 163, 184, 0.18);
        }

        .case-party-header,
        .case-party-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .case-party-header small,
        .case-party-item small {
          display: block;
          margin-top: 4px;
          opacity: 0.72;
        }

        .case-party-list {
          display: grid;
          gap: 10px;
          margin-top: 14px;
        }

        .case-party-item {
          padding: 12px;
          border-radius: 14px;
          border: 1px solid
            rgba(148, 163, 184, 0.16);
        }

        .case-party-form {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }

        .case-party-form label {
          display: grid;
          gap: 6px;
        }

        .case-party-form input,
        .case-party-form select,
        .case-party-form textarea {
          width: 100%;
        }

        @media (max-width: 640px) {
          .case-party-header,
          .case-party-item {
            align-items: stretch;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
