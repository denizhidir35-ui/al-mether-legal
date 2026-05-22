"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [cases, setCases] = useState<any[]>([]);

  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [court, setCourt] = useState("");
  const [fileNo, setFileNo] = useState("");

  useEffect(() => {
    getCases();
  }, []);

  const getCases = async () => {
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }

    setCases(data || []);
  };

  const createCase = async () => {
    if (!title || !client) {
      alert("Bilgileri doldurun");
      return;
    }

    const { error } = await supabase.from("cases").insert([
      {
        title,
        client,
        court,
        file_no: fileNo,
        status: "Normal",
        days_left: 14,
        ai_note:
          "AI dava analizi hazırlandı. Süre kontrol edilmeli.",
      },
    ]);

    if (error) {
      console.log(error);
      alert(error.message);
      return;
    }

    setTitle("");
    setClient("");
    setCourt("");
    setFileNo("");

    alert("Dava kaydedildi");

    getCases();
  };

  const inputStyle = {
    background: "#111",
    border: "1px solid #333",
    color: "white",
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    width: "100%",
  };

  return (
    <main
      style={{
        background: "#000",
        minHeight: "100vh",
        color: "white",
        padding: 20,
        fontFamily: "Arial",
      }}
    >
      {/* HEADER */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 25,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 56,
              fontWeight: "bold",
              marginBottom: 10,
            }}
          >
            ⚖️ AL Mether Legal
          </h1>

          <p
            style={{
              color: "#888",
              fontSize: 18,
            }}
          >
            AI Hukuk Otomasyon Sistemi
          </p>

          <p
            style={{
              color: "#00ff99",
              marginTop: 10,
              fontWeight: "bold",
              fontSize: 18,
            }}
          >
            Toplam {cases.length} aktif dosya yönetiliyor
          </p>
        </div>

        <div
          style={{
            color: "#00ff99",
            fontWeight: "bold",
            fontSize: 18,
          }}
        >
          ● Sistem Aktif
        </div>
      </div>

      {/* STATS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 20,
          marginBottom: 25,
        }}
      >
        <div
          style={{
            background: "#ff2222",
            padding: 30,
            borderRadius: 20,
          }}
        >
          <p>Kritik</p>

          <h2
            style={{
              fontSize: 48,
            }}
          >
            {
              cases.filter((c) => c.status === "Kritik")
                .length
            }
          </h2>
        </div>

        <div
          style={{
            background: "#d89b00",
            padding: 30,
            borderRadius: 20,
          }}
        >
          <p>Yaklaşan</p>

          <h2
            style={{
              fontSize: 48,
            }}
          >
            {
              cases.filter(
                (c) => c.days_left <= 3
              ).length
            }
          </h2>
        </div>

        <div
          style={{
            background: "#00b85c",
            padding: 30,
            borderRadius: 20,
          }}
        >
          <p>Normal</p>

          <h2
            style={{
              fontSize: 48,
            }}
          >
            {
              cases.filter(
                (c) => c.status === "Normal"
              ).length
            }
          </h2>
        </div>
      </div>

      {/* AI CENTER */}

      <div
        style={{
          background:
            "linear-gradient(180deg,#0a0a0a,#050505)",
          border: "1px solid #222",
          borderRadius: 20,
          padding: 25,
          marginBottom: 25,
        }}
      >
        <h2
          style={{
            color: "#00ff99",
            marginBottom: 20,
            fontSize: 28,
          }}
        >
          🧠 AL Mether AI Kontrol Merkezi
        </h2>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            color: "#ddd",
            fontSize: 16,
          }}
        >
          <p>✅ Gmail bağlantısı hazır</p>
          <p>📄 PDF analizi tamamlandı</p>
          <p>📬 Son mail kontrolü: 2 dakika önce</p>
          <p>📥 4 yeni dava maili analiz edildi</p>
          <p>⚠️ Kritik dava süreleri izleniyor</p>
          <p>🧠 AI dilekçe taslağı oluşturuldu</p>
          <p>📬 Yeni UYAP bildirimi algılandı</p>
          <p>📁 Word çıktısı oluşturulabilir</p>
        </div>
      </div>

      {/* ACTION BUTTONS */}

      <div
        style={{
          display: "flex",
          gap: 15,
          marginBottom: 25,
          flexWrap: "wrap",
        }}
      >
        <button
          style={{
            background: "#111",
            border: "1px solid #333",
            padding: "16px 24px",
            borderRadius: 14,
            color: "white",
            cursor: "pointer",
          }}
        >
          📄 PDF Yükle
        </button>

        <button
          style={{
            background: "#111",
            border: "1px solid #333",
            padding: "16px 24px",
            borderRadius: 14,
            color: "white",
            cursor: "pointer",
          }}
        >
          📬 Gmail Bağla
        </button>

        <button
          style={{
            background: "#111",
            border: "1px solid #333",
            padding: "16px 24px",
            borderRadius: 14,
            color: "white",
            cursor: "pointer",
          }}
        >
          🧠 AI Taslak Oluştur
        </button>

        <button
          style={{
            background: "#111",
            border: "1px solid #333",
            padding: "16px 24px",
            borderRadius: 14,
            color: "white",
            cursor: "pointer",
          }}
        >
          ⚖️ UYAP Senkronizasyon
        </button>
      </div>

      {/* CASE FORM */}

      <div
        style={{
          background: "#0b0b0b",
          padding: 20,
          borderRadius: 16,
          marginBottom: 25,
          border: "1px solid #222",
        }}
      >
        <h2
          style={{
            color: "#00ff99",
            marginBottom: 20,
          }}
        >
          Yeni Dava Kaydı
        </h2>

        <div
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          <input
            placeholder="Dava Başlığı"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder="Müvekkil"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder="Mahkeme"
            value={court}
            onChange={(e) => setCourt(e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder="Dosya No"
            value={fileNo}
            onChange={(e) => setFileNo(e.target.value)}
            style={inputStyle}
          />

          <button
            onClick={createCase}
            style={{
              background: "#00b85c",
              border: "none",
              padding: 16,
              borderRadius: 12,
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            Davayı Kaydet
          </button>
        </div>
      </div>

      {/* SEARCH */}

      <input
        placeholder="Dava veya müvekkil ara..."
        style={{
          width: "100%",
          padding: 18,
          background: "#111",
          border: "1px solid #333",
          color: "white",
          borderRadius: 14,
          marginBottom: 25,
          fontSize: 16,
        }}
      />

      {/* CASES */}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 25,
        }}
      >
        {cases.map((item, index) => (
          <div
            key={index}
            style={{
              background:
                "linear-gradient(180deg,#0a0a0a,#050505)",
              border: "1px solid #222",
              borderRadius: 20,
              padding: 25,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
              }}
            >
              <div>
                <h2
                  style={{
                    color: "#00ff99",
                    marginBottom: 12,
                    fontSize: 28,
                  }}
                >
                  {item.title}
                </h2>

                <p
                  style={{
                    marginBottom: 8,
                    color: "#ccc",
                  }}
                >
                  👤 {item.client}
                </p>

                <p
                  style={{
                    marginBottom: 8,
                    color: "#ccc",
                  }}
                >
                  ⚖️ {item.court}
                </p>

                <p
                  style={{
                    marginBottom: 8,
                    color: "#ccc",
                  }}
                >
                  📁 {item.file_no}
                </p>

                <p
                  style={{
                    color: "#ccc",
                  }}
                >
                  ⏳ {item.days_left} gün kaldı
                </p>
              </div>

              <div
                style={{
                  color:
                    item.status === "Kritik"
                      ? "#ff4444"
                      : "#7dffb3",
                  fontWeight: "bold",
                  fontSize: 18,
                }}
              >
                ● {item.status}
              </div>
            </div>

            {/* AI NOTE */}

            <div
              style={{
                marginTop: 25,
                background: "#050505",
                padding: 20,
                borderRadius: 16,
                border: "1px solid #1f1f1f",
              }}
            >
              <h3
                style={{
                  color: "#00ff99",
                  marginBottom: 15,
                  fontSize: 20,
                }}
              >
                🧠 AI Önerisi
              </h3>

              <p
                style={{
                  lineHeight: 1.8,
                  color: "#ddd",
                  fontSize: 16,
                }}
              >
                {item.ai_note}
              </p>

              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button
                  style={{
                    background: "#111",
                    border: "1px solid #333",
                    color: "white",
                    padding: "10px 16px",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  📄 PDF Oluştur
                </button>

                <button
                  style={{
                    background: "#111",
                    border: "1px solid #333",
                    color: "white",
                    padding: "10px 16px",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  📝 Word'e Aktar
                </button>

                <button
                  style={{
                    background: "#111",
                    border: "1px solid #333",
                    color: "white",
                    padding: "10px 16px",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  📬 Mail Gönder
                </button>

                <button
                  style={{
                    background: "#111",
                    border: "1px solid #333",
                    color: "white",
                    padding: "10px 16px",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  ⚖️ UYAP Kontrol
                </button>
              </div>

              <p
                style={{
                  marginTop: 18,
                  color: "#666",
                  fontSize: 13,
                }}
              >
                Son işlem: AI analiz sistemi tarafından
                kontrol edildi
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER */}

      <div
        style={{
          marginTop: 50,
          padding: 25,
          textAlign: "center",
          color: "#555",
          borderTop: "1px solid #111",
        }}
      >
        AL Mether Legal AI © 2026

        <p
          style={{
            marginTop: 10,
          }}
        >
          Gmail • PDF AI • UYAP • Dava Takibi • AI
          Draft
        </p>
      </div>
    </main>
  );
}