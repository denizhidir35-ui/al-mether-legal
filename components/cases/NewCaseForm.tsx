"use client";

type Props = {
  onAdd: (item: any) => void;
};

export default function NewCaseForm({
  onAdd,
}: Props) {

  function submitForm(
    e: any
  ) {

    e.preventDefault();

    const form =
      new FormData(
        e.target
      );

    const newCase = {

      id:
        Date.now(),

      title:
        form.get("title"),

      client:
        form.get("client"),

      court:
        form.get("court"),

      deadline:
        form.get(
          "deadline"
        ),

      createdAt:
        new Date()
          .toLocaleString(),
    };

    const current =
      JSON.parse(
        localStorage.getItem(
          "al-mether-cases"
        ) || "[]"
      );

    current.unshift(
      newCase
    );

    localStorage.setItem(
      "al-mether-cases",
      JSON.stringify(
        current
      )
    );

    onAdd(
      newCase
    );

    e.target.reset();
  }

  return (

    <form
      onSubmit={submitForm}
      style={{

        background:
          "rgba(15,23,42,0.65)",

        border:
          "1px solid rgba(255,255,255,0.08)",

        borderRadius: 28,

        padding: 24,
      }}
    >

      <h2
        style={{
          color: "white",
          marginBottom: 20,
        }}
      >
        📂 Yeni Dava
      </h2>

      <div
        style={{
          display: "grid",
          gap: 14,
        }}
      >

        <input
          name="title"
          placeholder="Dava Başlığı"
          required
          style={inputStyle}
        />

        <input
          name="client"
          placeholder="Müvekkil"
          required
          style={inputStyle}
        />

        <input
          name="court"
          placeholder="Mahkeme"
          required
          style={inputStyle}
        />

        <input
          name="deadline"
          type="date"
          required
          style={inputStyle}
        />

        <button
          type="submit"
          style={buttonStyle}
        >
          💾 Dava Kaydet
        </button>

      </div>

    </form>
  );
}

const inputStyle = {

  background:
    "#0f172a",

  border:
    "1px solid rgba(255,255,255,0.08)",

  borderRadius: 16,

  padding: 14,

  color: "white",

  fontSize: 14,

  outline: "none",
};

const buttonStyle = {

  background:
    "#10b981",

  border: "none",

  borderRadius: 16,

  padding: 14,

  color: "white",

  fontWeight: 700,

  cursor: "pointer",
};