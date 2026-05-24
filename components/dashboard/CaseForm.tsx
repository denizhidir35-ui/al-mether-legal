type Props = {
  onAdd: (
    item: any
  ) => void;
};

export default function CaseForm({
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

    onAdd({
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
    });

    e.target.reset();
  }

  return (
    <form
      onSubmit={submitForm}
      style={{
        background:
          "rgba(255,255,255,0.04)",
        border:
          "1px solid rgba(255,255,255,0.08)",
        borderRadius: 30,
        padding: 30,
        marginBottom: 24,
      }}
    >
      <h2
        style={{
          fontSize: 28,
          marginBottom: 24,
          color: "white",
        }}
      >
        Yeni Dava
      </h2>

      <div
        style={{
          display: "grid",
          gap: 16,
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
          style={{
            background:
              "#10b981",
            border: "none",
            padding:
              "16px 20px",
            borderRadius: 18,
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          Dava Kaydet
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

  padding: 16,

  color: "white",

  fontSize: 15,

  outline: "none",
};