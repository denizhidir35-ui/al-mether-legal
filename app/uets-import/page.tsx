"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import LegalBackButton from "@/components/LegalBackButton";

type BridgeCapture = {
  title?: string;
  url?: string;
  text?: string;
  capturedAt?: string;
  links?: string[];
  pdfBase64?: string;
  sourceDocument?: string;
};

type Hearing = {
  found?: boolean;
  date?: string;
  time?: string;
  location?: string;
  evidence?: string;
};

type UetsDocument = {
  documentType?: string;
  court?: string;
  fileNo?: string;
  decisionNo?: string;
  summary?: string;

  hearing?: Hearing;

  deadlines?: Array<{
    label?: string;
    explicitDate?: string;
    durationText?: string;
    startBasis?: string;
    evidence?: string;
    isExplicitFinalDate?: boolean;
  }>;

  tasks?: Array<{
    text?: string;
    evidence?: string;
  }>;

  parties?: string;
  subject?: string;

  payment?: {
    paymentAmount?: number | null;
    paymentCurrency?: string;
    paymentDescription?: string;
    paymentDueDate?: string;
    paymentPeriodText?: string;
    sourceDocument?: string;
  };

  uets?: {
    arrivalDate?: string;
    arrivalTime?: string;
    deemedServiceDate?: string;
    barcodeNo?: string;
  };

  needsHumanReview?: boolean;
  calendarSafe?: boolean;
};

type AnalyzeResponse = {
  ok?: boolean;

  error?: string;

  source?: {
    type?: string;
    title?: string;
    url?: string;
    isTestDocument?: boolean;
  };

  document?: UetsDocument;
};

type CommitResponse = {
  ok?: boolean;
  skipped?: boolean;
  duplicate?: boolean;
  reason?: string;
  message?: string;
  error?: string;

  calendarWrite?: {
    type?: string;
    date?: string;
    time?: string;
    court?: string;
    fileNo?: string;
  };
};

type CalendarStatus = {
  kind:
    | "success"
    | "warning"
    | "error"
    | "info";

  message: string;
};

function safeText(
  value: unknown
) {
  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function formatCapturedAt(
  value?: string
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date
    .toLocaleString(
      "tr-TR"
    );
}

function formatPaymentAmount(
  amount?: number | null,
  currency?: string
) {
  if (typeof amount !== "number") {
    return "";
  }

  const currencyLabel = currency === "TRY" ? "TL" : currency || "";

  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)}${currencyLabel ? ` ${currencyLabel}` : ""}`;
}

export default function UetsImportPage() {
  const [
    capture,
    setCapture,
  ] =
    useState<BridgeCapture | null>(
      null
    );

  const [
    result,
    setResult,
  ] =
    useState<AnalyzeResponse | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    calendarStatus,
    setCalendarStatus,
  ] =
    useState<CalendarStatus | null>(
      null
    );

  const commitUets =
    useCallback(
      async (
        payload: BridgeCapture,
        analysis: AnalyzeResponse
      ) => {
        const document =
          analysis.document;

        const uets =
          document?.uets;

        const arrivalDate =
          safeText(
            uets?.arrivalDate
          );

        const deemedServiceDate =
          safeText(
            uets
              ?.deemedServiceDate
          );

        if (
          analysis.source
            ?.isTestDocument ===
            true ||
          !arrivalDate ||
          !deemedServiceDate
        ) {
          return;
        }

        const response =
          await fetch(
            "/api/cases/from-analysis",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  record_mode:
                    "deemed_service",
                  case_number:
                    document
                      ?.fileNo ||
                    "",
                  court_name:
                    document
                      ?.court ||
                    "",
                  case_title:
                    payload.title ||
                    "UETS TebligatÄ±",
                  institution:
                    "PTT UETS",
                  arrival_date:
                    arrivalDate,
                  arrival_time:
                    uets?.arrivalTime ||
                    "",
                  deemed_service_date:
                    deemedServiceDate,
                  calculated_due_date:
                    deemedServiceDate,
                  barcode_no:
                    uets?.barcodeNo ||
                    "",
                  subject:
                    payload.title ||
                    "UETS TebligatÄ±",
                  sender:
                    "PTT UETS",
                  mail_body:
                    payload.text ||
                    "",
                  summary:
                    document
                      ?.summary ||
                    "",
                  source_url:
                    payload.url ||
                    "",
                  payment_amount:
                    document?.payment
                      ?.paymentAmount ??
                    null,
                  payment_currency:
                    document?.payment
                      ?.paymentCurrency ||
                    "",
                  payment_description:
                    document?.payment
                      ?.paymentDescription ||
                    "",
                  payment_due_date:
                    document?.payment
                      ?.paymentDueDate ||
                    "",
                  payment_period_text:
                    document?.payment
                      ?.paymentPeriodText ||
                    "",
                  source_document:
                    document?.payment
                      ?.sourceDocument ||
                    payload.sourceDocument ||
                    "",
                }),
            }
          );

        const data =
          (await response
            .json()) as
            CommitResponse;

        if (
          !response.ok ||
          !data.ok
        ) {
          throw new Error(
            data.error ||
              "UETS tebliÄŸ kaydÄ± oluÅŸturulamadÄ±."
          );
        }

        setCalendarStatus({
          kind:
            data.duplicate
              ? "info"
              : "success",
          message:
            data.message ||
            (data.duplicate
              ? "Bu UETS kaydÄ± daha Ã¶nce aktarÄ±lmÄ±ÅŸ."
              : "TebliÄŸ edilmiÅŸ sayÄ±lma tarihi takvime kaydedildi; hukuki son gÃ¼n veya alarm oluÅŸturulmadÄ±."),
        });
      },
      []
    );

  const commitPayment =
    useCallback(
      async (
        payload: BridgeCapture,
        analysis: AnalyzeResponse
      ) => {
        const document =
          analysis.document;
        const payment =
          document?.payment;
        const dueDate =
          safeText(
            payment?.paymentDueDate
          );
        const periodText =
          safeText(
            payment?.paymentPeriodText
          );
        const hasPayment =
          typeof payment
            ?.paymentAmount ===
            "number" ||
          Boolean(
            safeText(
              payment
                ?.paymentDescription
            ) ||
              dueDate ||
              periodText
          );

        if (!hasPayment) {
          return;
        }

        if (
          analysis.source
            ?.isTestDocument ===
          true
        ) {
          setCalendarStatus({
            kind: "warning",
            message:
              "Test belgesi algÄ±landÄ± â€” Ã¶deme takvimi veya alarm kaydÄ± oluÅŸturulmadÄ±.",
          });
          return;
        }

        if (!dueDate) {
          if (periodText) {
            setCalendarStatus({
              kind: "warning",
              message:
                "SÃ¼re metni bulundu; baÅŸlangÄ±Ã§ tarihi doÄŸrulanamadÄ±ÄŸÄ± iÃ§in son tarih oluÅŸturulmadÄ±.",
            });
          }
          return;
        }

        const response =
          await fetch(
            "/api/cases/from-analysis",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                record_mode:
                  "payment_deadline",
                case_number:
                  document?.fileNo ||
                  "",
                court_name:
                  document?.court ||
                  "",
                case_title:
                  payload.title ||
                  "UETS TebligatÄ±",
                institution:
                  "PTT UETS",
                arrival_date:
                  document?.uets
                    ?.arrivalDate ||
                  "",
                arrival_time:
                  document?.uets
                    ?.arrivalTime ||
                  "",
                deemed_service_date:
                  document?.uets
                    ?.deemedServiceDate ||
                  "",
                barcode_no:
                  document?.uets
                    ?.barcodeNo ||
                  "",
                payment_amount:
                  payment
                    ?.paymentAmount ??
                  null,
                payment_currency:
                  payment
                    ?.paymentCurrency ||
                  "",
                payment_description:
                  payment
                    ?.paymentDescription ||
                  "",
                payment_due_date:
                  dueDate,
                payment_period_text:
                  periodText,
                source_document:
                  payment
                    ?.sourceDocument ||
                  payload.sourceDocument ||
                  "",
                source_url:
                  payload.url ||
                  "",
                summary:
                  document?.summary ||
                  "",
              }),
            }
          );

        const data =
          (await response.json()) as
            CommitResponse;

        if (
          !response.ok ||
          !data.ok
        ) {
          throw new Error(
            data.error ||
              "Ã–deme takvim kaydÄ± oluÅŸturulamadÄ±."
          );
        }

        setCalendarStatus({
          kind:
            data.duplicate
              ? "info"
              : "success",
          message:
            data.message ||
            (data.duplicate
              ? "Bu PDF Ã¶deme kaydÄ± daha Ã¶nce oluÅŸturulmuÅŸ; yeni takvim veya alarm eklenmedi."
              : "PDF Ã¶deme son tarihi takvime ve alarm planÄ±na kaydedildi."),
        });
      },
      []
    );

  const commitHearing =
    useCallback(
      async (
        payload: BridgeCapture,
        analysis: AnalyzeResponse
      ) => {
        const document =
          analysis.document;

        const hearing =
          document?.hearing;

        if (
          safeText(
            document?.uets
              ?.deemedServiceDate
          )
        ) {
          return;
        }

        const isTest =
          analysis.source
            ?.isTestDocument ===
          true;

        /*
         * TEST BELGESÄ°:
         * API'YE BÄ°LE TAKVÄ°M YAZDIRMIYORUZ.
         */
        if (isTest) {
          setCalendarStatus({
            kind:
              "warning",

            message:
              "Test belgesi algÄ±landÄ± â€” hiÃ§bir takvim veya alarm kaydÄ± oluÅŸturulmadÄ±.",
          });

          return;
        }

        if (
          !hearing?.found
        ) {
          setCalendarStatus({
            kind:
              "info",

            message:
              "Belgede aÃ§Ä±k bir duruÅŸma tarihi bulunmadÄ±. Otomatik takvim kaydÄ± oluÅŸturulmadÄ±.",
          });

          return;
        }

        /*
         * Tarih var ama saat yoksa otomatik kayÄ±t yapma.
         * Avukat inceleyecek.
         */
        if (
          !safeText(
            hearing.date
          ) ||
          !safeText(
            hearing.time
          )
        ) {
          setCalendarStatus({
            kind:
              "warning",

            message:
              "DuruÅŸma bulundu ancak tarih/saat bilgisi eksik. Ä°nsan kontrolÃ¼ olmadan takvime yazÄ±lmadÄ±.",
          });

          return;
        }

        if (
          document
            ?.needsHumanReview ===
          true
        ) {
          setCalendarStatus({
            kind:
              "warning",

            message:
              "Belge insan kontrolÃ¼ gerektiriyor. DuruÅŸma otomatik takvime yazÄ±lmadÄ±.",
          });

          return;
        }

        if (
          document
            ?.calendarSafe !==
          true
        ) {
          setCalendarStatus({
            kind:
              "warning",

            message:
              "Belge otomatik takvim kaydÄ± iÃ§in gÃ¼venli bulunmadÄ±.",
          });

          return;
        }

        try {
          const response =
            await fetch(
              "/api/uets/commit",
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    isTest:
                      false,

                    court:
                      document
                        ?.court ||
                      "",

                    fileNo:
                      document
                        ?.fileNo ||
                      "",

                    date:
                      hearing.date,

                    time:
                      hearing.time,

                    evidence:
                      hearing.evidence ||
                      "",

                    sourceUrl:
                      payload.url ||
                      "",

                    capturedText:
                      payload.text ||
                      "",
                  }),
              }
            );

          const data =
            (await response
              .json()) as
              CommitResponse;

          if (
            !response.ok ||
            !data.ok
          ) {
            throw new Error(
              data.error ||
              "Takvim kaydÄ± oluÅŸturulamadÄ±."
            );
          }

          const message =
            data.message ||
            "DuruÅŸma takvime kaydedildi.";

          setCalendarStatus({
            kind:
              data.duplicate
                ? "info"
                : "success",

            message,
          });

          /*
           * Sonraki turda Posta ekranÄ±
           * bu bilgiyi kÃ¼Ã§Ã¼k bildirim olarak gÃ¶sterecek.
           */
          if (
            typeof window !==
            "undefined"
          ) {
            window.localStorage
              .setItem(
                "mether-last-calendar-write",
                JSON.stringify({
                  createdAt:
                    new Date()
                      .toISOString(),

                  message,

                  duplicate:
                    data.duplicate ===
                    true,

                  date:
                    data
                      .calendarWrite
                      ?.date ||
                    hearing.date,

                  time:
                    data
                      .calendarWrite
                      ?.time ||
                    hearing.time,

                  court:
                    data
                      .calendarWrite
                      ?.court ||
                    document
                      ?.court ||
                    "",

                  fileNo:
                    data
                      .calendarWrite
                      ?.fileNo ||
                    document
                      ?.fileNo ||
                    "",

                  source:
                    "uets_bridge",
                })
              );
          }
        }
        catch (commitError) {
          setCalendarStatus({
            kind:
              "error",

            message:
              commitError instanceof
              Error
                ? commitError.message
                : "Takvim kaydÄ± oluÅŸturulamadÄ±.",
          });
        }
      },
      []
    );

  const analyzeCapture =
    useCallback(
      async (
        payload: BridgeCapture
      ) => {
        const capturedText =
          safeText(
            payload.text
          );

        if (!capturedText) {
          setError(
            "UETS belge metni boÅŸ geldi."
          );

          return;
        }

        setLoading(
          true
        );

        setError(
          ""
        );

        setResult(
          null
        );

        setCalendarStatus(
          null
        );

        try {
          const response =
            await fetch(
              "/api/uets/document-analyze",
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    title:
                      payload.title ||
                      "UETS TebligatÄ±",

                    url:
                      payload.url ||
                      "",

                    text:
                      capturedText,

                    pdfBase64:
                      payload.pdfBase64 ||
                      "",

                    sourceDocument:
                      payload.sourceDocument ||
                      "",
                  }),
              }
            );

          const data =
            (await response
              .json()) as
              AnalyzeResponse;

          if (
            !response.ok ||
            !data.ok
          ) {
            throw new Error(
              data.error ||
              "Tebligat analiz edilemedi."
            );
          }

          setResult(
            data
          );

          await commitUets(
            payload,
            data
          );

          await commitHearing(
            payload,
            data
          );

          await commitPayment(
            payload,
            data
          );
        }
        catch (analysisError) {
          setError(
            analysisError instanceof
            Error
              ? analysisError.message
              : "Tebligat analiz edilemedi."
          );
        }
        finally {
          setLoading(
            false
          );
        }
      },
      [
        commitHearing,
        commitPayment,
        commitUets,
      ]
    );

  useEffect(
    () => {
      function handleBridgeMessage(
        event: MessageEvent
      ) {
        if (
          event.source !==
          window
        ) {
          return;
        }

        const message =
          event.data;

        if (
          message?.source !==
          "METHER_UETS_BRIDGE"
        ) {
          return;
        }

        const payload =
          message
            ?.payload as
            BridgeCapture;

        if (
          !payload ||
          !safeText(
            payload.text
          )
        ) {
          return;
        }

        setCapture(
          payload
        );

        /*
         * Extension'a veriyi aldÄ±ÄŸÄ±mÄ±zÄ± bildir.
         * GeÃ§ici chrome.storage kaydÄ± temizlenebilir.
         */
        window.postMessage(
          {
            source:
              "METHER_UETS_ACK",
          },
          "*"
        );

        void analyzeCapture(
          payload
        );
      }

      window.addEventListener(
        "message",
        handleBridgeMessage
      );

      return () => {
        window.removeEventListener(
          "message",
          handleBridgeMessage
        );
      };
    },
    [
      analyzeCapture,
    ]
  );

  const statusStyle =
    calendarStatus?.kind ===
      "success"
      ? {
          border:
            "1px solid rgba(50,180,115,.55)",
          background:
            "rgba(25,120,80,.12)",
          color:
            "#8ce0b8",
        }
      : calendarStatus?.kind ===
          "error"
        ? {
            border:
              "1px solid rgba(235,90,90,.55)",
            background:
              "rgba(160,40,40,.12)",
            color:
              "#ff9b9b",
          }
        : calendarStatus?.kind ===
            "warning"
          ? {
              border:
                "1px solid rgba(205,164,83,.55)",
              background:
                "rgba(170,125,30,.10)",
              color:
                "#e6c879",
            }
          : {
              border:
                "1px solid rgba(100,130,170,.4)",
              background:
                "rgba(80,110,150,.08)",
              color:
                "#b8c8db",
            };

  return (
    <main
      style={{
        minHeight:
          "100vh",

        background:
          "#070c12",

        color:
          "#f4f5f7",

        padding:
          "34px 22px 70px",
      }}
    >
      <div
        style={{
          width:
            "min(1120px, 100%)",

          margin:
            "0 auto",
        }}
      >
        <div
          style={{
            marginBottom: 16,
          }}
        >
          <LegalBackButton fallback="/dashboard" />
        </div>

        <header
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              18,

            marginBottom:
              24,
          }}
        >
          <img
            src="/icon.png"
            alt="METHER Legal"
            width={42}
            height={42}
            style={{
              objectFit:
                "contain",
            }}
          />

          <div>
            <div
              style={{
                display:
                  "flex",

                alignItems:
                  "baseline",

                gap:
                  16,

                flexWrap:
                  "wrap",
              }}
            >
              <strong
                style={{
                  fontSize:
                    13,

                  letterSpacing:
                    ".04em",
                }}
              >
                METHER LEGAL
              </strong>

              <h1
                style={{
                  margin:
                    0,

                  fontSize:
                    23,

                  fontWeight:
                    500,
                }}
              >
                UETS Ã‡alÄ±ÅŸma AlanÄ±
              </h1>
            </div>

            <p
              style={{
                margin:
                  "6px 0 0",

                color:
                  "#8290a3",

                fontSize:
                  12,
              }}
            >
              AÃ§Ä±k tebligatÄ± gÃ¼venli browser kÃ¶prÃ¼sÃ¼nden alÄ±n.
            </p>
          </div>
        </header>

        {!capture && (
          <section
            style={{
              border:
                "1px solid #202c3b",

              borderRadius:
                18,

              padding:
                28,

              background:
                "#0d141e",

              color:
                "#8997aa",
            }}
          >
            UETS Bridge aktarÄ±mÄ± bekleniyorâ€¦
          </section>
        )}

        {capture && (
          <section
            style={{
              border:
                "1px solid #263244",

              borderRadius:
                18,

              padding:
                18,

              background:
                "#0d141e",
            }}
          >
            <h2
              style={{
                margin:
                  0,

                fontSize:
                  16,
              }}
            >
              {capture.title ||
                "UETS TebligatÄ±"}
            </h2>

            <div
              style={{
                marginTop:
                  7,

                fontSize:
                  11,

                lineHeight:
                  1.7,

                color:
                  "#7f90a7",
              }}
            >
              <div>
                {capture.url}
              </div>

              <div>
                {formatCapturedAt(
                  capture
                    .capturedAt
                )}
              </div>
            </div>

            <div
              style={{
                height:
                  1,

                background:
                  "#273242",

                margin:
                  "18px 0",
              }}
            />

            {loading && (
              <div
                style={{
                  padding:
                    15,

                  border:
                    "1px solid #293646",

                  borderRadius:
                    12,

                  background:
                    "#111a25",

                  color:
                    "#d2b765",
                }}
              >
                METHER Belge Analizi Ã§alÄ±ÅŸÄ±yorâ€¦
              </div>
            )}

            {error && (
              <div
                style={{
                  padding:
                    15,

                  border:
                    "1px solid rgba(235,90,90,.55)",

                  borderRadius:
                    12,

                  background:
                    "rgba(160,40,40,.12)",

                  color:
                    "#ff9b9b",
                }}
              >
                {error}
              </div>
            )}

            {calendarStatus && (
              <div
                style={{
                  ...statusStyle,

                  padding:
                    "13px 15px",

                  borderRadius:
                    12,

                  marginBottom:
                    14,

                  fontSize:
                    13,

                  fontWeight:
                    600,
                }}
              >
                {calendarStatus.message}
              </div>
            )}

            {result?.document && (
              <section
                style={{
                  border:
                    "1px solid #253143",

                  borderRadius:
                    14,

                  padding:
                    16,

                  background:
                    "#111a25",
                }}
              >
                <strong
                  style={{
                    display:
                      "block",

                    marginBottom:
                      12,

                    fontSize:
                      14,
                  }}
                >
                  METHER Analizi
                </strong>

                {result.document.payment &&
                  (typeof result.document.payment.paymentAmount === "number" ||
                    result.document.payment.paymentDescription ||
                    result.document.payment.paymentDueDate ||
                    result.document.payment.paymentPeriodText) && (
                    <div
                      style={{
                        marginBottom: 14,
                        padding: 13,
                        border: "1px solid #35425a",
                        borderRadius: 12,
                        background: "#0d1621",
                        fontSize: 12,
                        lineHeight: 1.7,
                      }}
                    >
                      <strong>Ã–deme Bilgisi</strong>
                      <div>
                        {formatPaymentAmount(
                          result.document.payment.paymentAmount,
                          result.document.payment.paymentCurrency
                        ) || "Tutar belirtilmedi"}
                      </div>
                      <div>
                        {result.document.payment.paymentDescription ||
                          "Ã–deme aÃ§Ä±klamasÄ± bulunamadÄ±"}
                      </div>
                      <div>
                        {result.document.payment.paymentDueDate
                          ? `Son tarih: ${result.document.payment.paymentDueDate}`
                          : result.document.payment.paymentPeriodText ||
                            "Son tarih bulunamadÄ±"}
                      </div>
                      <div>
                        {result.document.payment.sourceDocument ||
                          "Kaynak PDF belirtilmedi"}
                      </div>
                      {!result.document.payment.paymentDueDate &&
                        result.document.payment.paymentPeriodText && (
                          <div style={{ color: "#e6c879", marginTop: 5 }}>
                            SÃ¼re metni bulundu; baÅŸlangÄ±Ã§ tarihi doÄŸrulanamadÄ±ÄŸÄ± iÃ§in son tarih oluÅŸturulmadÄ±.
                          </div>
                        )}
                    </div>
                  )}

                <pre
                  style={{
                    margin:
                      0,

                    whiteSpace:
                      "pre-wrap",

                    wordBreak:
                      "break-word",

                    fontSize:
                      12,

                    lineHeight:
                      1.6,

                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",

                    color:
                      "#edf0f5",
                  }}
                >
                  {JSON.stringify(
                    result.document,
                    null,
                    2
                  )}
                </pre>
              </section>
            )}

            <details
              style={{
                marginTop:
                  14,

                border:
                  "1px solid #253143",

                borderRadius:
                  12,

                padding:
                  "12px 14px",

                background:
                  "#0e1621",
              }}
            >
              <summary
                style={{
                  cursor:
                    "pointer",

                  color:
                    "#d6b45f",

                  fontSize:
                    12,

                  fontWeight:
                    700,
                }}
              >
                Yakalanan tebligat metni
              </summary>

              <pre
                style={{
                  margin:
                    "14px 0 0",

                  maxHeight:
                    420,

                  overflow:
                    "auto",

                  whiteSpace:
                    "pre-wrap",

                  wordBreak:
                    "break-word",

                  fontSize:
                    12,

                  lineHeight:
                    1.65,

                  color:
                    "#dce2e9",
                }}
              >
                {capture.text}
              </pre>
            </details>
          </section>
        )}
      </div>
    </main>
  );
}
