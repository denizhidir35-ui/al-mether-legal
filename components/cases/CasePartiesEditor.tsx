"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import ActionToast from "@/components/ActionToast";

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
  name: string;
  phone: string;
  email: string;
};

const EMPTY: Draft = {
  role: "muvekkil",
  name: "",
  phone: "",
  email: "",
};

const ROLE_LABELS = {
  muvekkil: "Müvekkil",
  karsi_taraf: "Karşı Taraf",
  vekil: "Vekil",
  kurum: "Kurum",
} as const;

function getUiRole(party: Party) {
  if (party.is_client || party.role === "muvekkil") return "muvekkil";
  if (party.party_type === "organization") return "kurum";
  if (party.role === "vekil") return "vekil";
  return "karsi_taraf";
}

function getApiFields(role: string) {
  if (role === "muvekkil") {
    return { role: "muvekkil", party_type: "person", is_client: true };
  }

  if (role === "vekil") {
    return { role: "vekil", party_type: "person", is_client: false };
  }

  if (role === "kurum") {
    return { role: "diger", party_type: "organization", is_client: false };
  }

  return { role: "davali", party_type: "person", is_client: false };
}

export default function CasePartiesEditor({
  caseId,
  readOnly = false,
}: {
  caseId: string;
  readOnly?: boolean;
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
  const [feedback, setFeedback] =
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
      role: getUiRole(party),
      name: party.name,
      phone: party.phone || "",
      email: party.email || "",
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
          body: JSON.stringify({
            ...draft,
            ...getApiFields(draft.role),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.ok || !data?.party) {
        throw new Error(
          data?.error || "Taraf kaydedilemedi."
        );
      }

      const wasEditing = Boolean(draft.id);
      const savedParty = data.party as Party;

      setParties((current) =>
        wasEditing
          ? current.map((party) =>
              party.id === savedParty.id ? savedParty : party
            )
          : [...current, savedParty]
      );
      setDraft(null);
      setFeedback(wasEditing ? "Taraf güncellendi" : "Taraf eklendi");
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

      setParties((current) =>
        current.filter((item) => item.id !== party.id)
      );
      setFeedback("Taraf kaldırıldı");
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
      {!readOnly && <div className="case-party-header">
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
      </div>}

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
                  {ROLE_LABELS[getUiRole(party)]}
                  {party.phone ? ` · ${party.phone}` : ""}
                  {party.email ? ` · ${party.email}` : ""}
                </small>
              </div>

              {!readOnly && <div className="inline-actions">
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
                  Kaldır
                </button>
              </div>}
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
              <option value="muvekkil">Müvekkil</option>
              <option value="karsi_taraf">Karşı Taraf</option>
              <option value="vekil">Vekil</option>
              <option value="kurum">Kurum</option>
            </select>
          </label>

          <label>
            <span>Ad / Ünvan</span>
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
            <span>Telefon (opsiyonel)</span>
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
            <span>E-posta (opsiyonel)</span>
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

      <ActionToast
        message={feedback}
        onDismiss={() => setFeedback("")}
      />

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
