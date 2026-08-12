"use client";

import {
  useEffect,
  useState,
} from "react";

type CalendarWrite = {
  createdAt?: string;
  message?: string;
  duplicate?: boolean;
  date?: string;
  time?: string;
  court?: string;
  fileNo?: string;
  source?: string;
};

const STORAGE_KEY =
  "mether-last-calendar-write";

const SEEN_KEY =
  "mether-last-calendar-write-seen";

function safeParse(
  value: string | null
): CalendarWrite | null {
  if (!value) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(
        value
      );

    if (
      !parsed ||
      typeof parsed !==
        "object"
    ) {
      return null;
    }

    return parsed as
      CalendarWrite;
  }
  catch {
    return null;
  }
}

export default function CalendarWriteToast() {
  const [
    notice,
    setNotice,
  ] =
    useState<CalendarWrite | null>(
      null
    );

  useEffect(
    () => {
      const raw =
        window.localStorage
          .getItem(
            STORAGE_KEY
          );

      const parsed =
        safeParse(
          raw
        );

      if (
        !parsed?.createdAt ||
        !parsed.message
      ) {
        return;
      }

      const created =
        new Date(
          parsed.createdAt
        );

      if (
        Number.isNaN(
          created.getTime()
        )
      ) {
        return;
      }

      /*
       * Çok eski takvim yazımını
       * tekrar tekrar göstermeyelim.
       */
      const ageMs =
        Date.now() -
        created.getTime();

      if (
        ageMs >
        30 * 60 * 1000
      ) {
        return;
      }

      const seen =
        window.localStorage
          .getItem(
            SEEN_KEY
          );

      if (
        seen ===
        parsed.createdAt
      ) {
        return;
      }

      window.localStorage
        .setItem(
          SEEN_KEY,
          parsed.createdAt
        );

      setNotice(
        parsed
      );

      const timer =
        window.setTimeout(
          () => {
            setNotice(
              null
            );
          },
          12000
        );

      return () => {
        window.clearTimeout(
          timer
        );
      };
    },
    []
  );

  if (!notice) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position:
          "fixed",

        right:
          "18px",

        bottom:
          "22px",

        width:
          "min(390px, calc(100vw - 36px))",

        zIndex:
          9999,

        border:
          "1px solid rgba(205,164,83,.55)",

        borderRadius:
          14,

        background:
          "rgba(12,20,30,.97)",

        boxShadow:
          "0 18px 55px rgba(0,0,0,.42)",

        padding:
          "13px 14px",

        color:
          "#f4f5f7",

        backdropFilter:
          "blur(14px)",
      }}
    >
      <div
        style={{
          display:
            "flex",

          alignItems:
            "flex-start",

          justifyContent:
            "space-between",

          gap:
            12,
        }}
      >
        <div
          style={{
            minWidth:
              0,
          }}
        >
          <div
            style={{
              color:
                "#d9b75f",

              fontSize:
                10,

              fontWeight:
                800,

              letterSpacing:
                ".08em",

              textTransform:
                "uppercase",

              marginBottom:
                6,
            }}
          >
            Takvime işlendi
          </div>

          <div
            style={{
              fontSize:
                12,

              fontWeight:
                650,

              lineHeight:
                1.5,

              color:
                "#edf1f5",
            }}
          >
            {notice.message}
          </div>

          {(
            notice.date ||
            notice.time ||
            notice.fileNo
          ) && (
            <div
              style={{
                marginTop:
                  7,

                color:
                  "#8796aa",

                fontSize:
                  10,

                lineHeight:
                  1.5,
              }}
            >
              {[
                notice.date,
                notice.time,
                notice.fileNo
                  ? `Dosya ${notice.fileNo}`
                  : "",
              ]
                .filter(
                  Boolean
                )
                .join(
                  " · "
                )}
            </div>
          )}

          <a
            href="/calendar"
            style={{
              display:
                "inline-block",

              marginTop:
                9,

              color:
                "#d9b75f",

              textDecoration:
                "none",

              fontSize:
                11,

              fontWeight:
                700,
            }}
          >
            Takvimde aç →
          </a>
        </div>

        <button
          type="button"
          aria-label="Bildirimi kapat"
          onClick={() =>
            setNotice(
              null
            )
          }
          style={{
            border:
              0,

            background:
              "transparent",

            color:
              "#7e8da0",

            cursor:
              "pointer",

            fontSize:
              18,

            lineHeight:
              1,

            padding:
              "1px 2px",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}