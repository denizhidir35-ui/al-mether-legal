"use client";

import { useEffect, useState } from "react";

export type Mail = {
  id: string;
  subject: string;
  sender: string;
  body: string;
  deadline: string;
  type: string;
  risk: string;
};

type Props = {
  onSelectMail?: (mail: Mail) => void;
};

export default function MailInbox({
  onSelectMail,
}: Props) {
  const [mails, setMails] = useState<Mail[]>([]);
  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function loadMails() {
      try {
        const res = await fetch(
          "/api/gmail"
        );

        const data =
          await res.json();

        const formatted =
          data.map((mail: any) => ({
            id: mail.id,

            subject:
              mail.subject ||
              "Konu Yok",

            sender:
              mail.from ||
              "Bilinmeyen",

            body:
              mail.body ||
              "",

            deadline: "-",

            type:
              "Analiz Bekliyor",

            risk:
              "Analiz Bekliyor",
          }));

        setMails(formatted);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadMails();
  }, []);

  return (
    <div
      style={{
        background:
          "rgba(15,23,42,0.65)",

        border:
          "1px solid rgba(255,255,255,0.08)",

        borderRadius: 20,

        padding: 16,
      }}
    >
      <h2
        style={{
          color: "white",
          fontSize: 18,
          marginBottom: 14,
        }}
      >
        📨 Gmail Gelen Kutusu
      </h2>

      {loading && (
        <div
          style={{
            color: "#94a3b8",
          }}
        >
          Mailler yükleniyor...
        </div>
      )}

      {!loading &&
        mails.map((mail) => (
          <div
            key={mail.id}
            onClick={() =>
              onSelectMail?.(mail)
            }
            style={{
              padding: 12,

              marginBottom: 10,

              cursor: "pointer",

              background:
                "rgba(255,255,255,0.03)",

              border:
                "1px solid rgba(255,255,255,0.06)",

              borderRadius: 12,
            }}
          >
            <div
              style={{
                color: "white",

                fontWeight: 700,

                fontSize: 14,

                marginBottom: 4,
              }}
            >
              {mail.subject}
            </div>

            <div
              style={{
                color: "#94a3b8",

                fontSize: 12,

                marginBottom: 6,
              }}
            >
              {mail.sender}
            </div>

            <div
              style={{
                color: "#64748b",

                fontSize: 11,

                marginBottom: 8,

                overflow: "hidden",

                textOverflow:
                  "ellipsis",

                whiteSpace:
                  "nowrap",
              }}
            >
              {mail.body}
            </div>

            <div
              style={{
                display: "flex",

                justifyContent:
                  "space-between",

                fontSize: 12,
              }}
            >
              <span>
                📧 Gmail
              </span>

              <span
                style={{
                  color:
                    "#3b82f6",

                  fontWeight: 700,
                }}
              >
                Analiz Bekliyor
              </span>
            </div>
          </div>
        ))}
    </div>
  );
}