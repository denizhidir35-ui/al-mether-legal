"use client";

export default function FileViewer({
  files,
}: any) {
  return (
    <div
      style={{
        background:
          "rgba(15,23,42,0.78)",

        border:
          "1px solid rgba(255,255,255,0.05)",

        borderRadius: 18,

        padding: 16,
      }}
    >
      <h2
        style={{
          color: "white",

          marginTop: 0,
        }}
      >
        📂 Dosya Önizleme
      </h2>

      {!files ||
      files.length === 0 ? (
        <p
          style={{
            color:
              "#94a3b8",
          }}
        >
          Dosya bulunamadı.
        </p>
      ) : (
        files.map(
          (
            file: any,
            index: number
          ) => (
            <div
              key={index}
              style={{
                marginBottom: 20,
              }}
            >
              <p
                style={{
                  color:
                    "white",

                  marginBottom: 10,
                }}
              >
                {file.file_name}
              </p>

              {file.file_url?.includes(
                ".pdf"
              ) ? (
                <iframe
                  src={
                    file.file_url
                  }
                  width="100%"
                  height="700"
                  style={{
                    border:
                      "none",

                    borderRadius: 14,
                  }}
                />
              ) : (
                <a
                  href={
                    file.file_url
                  }
                  target="_blank"
                  style={{
                    color:
                      "#60a5fa",
                  }}
                >
                  Dosyayı Aç
                </a>
              )}
            </div>
          )
        )
      )}
    </div>
  );
}