"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import LegalBackButton from "@/components/LegalBackButton";
import LegalBrand from "@/components/LegalBrand";
import LegalDock from "@/components/LegalDock";
import MobileBridgeHelp from "@/components/MobileBridgeHelp";

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
                    "UETS Tebligatı",
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
                    "UETS Tebligatı",
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
              "UETS tebliğ kaydı oluşturulamadı."
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
              ? "Bu UETS kaydı daha önce aktarılmış."
              : "Tebliğ edilmiş sayılma tarihi takvime kaydedildi; hukuki son gün veya alarm oluşturulmadı."),
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
              "Test belgesi algılandı — ödeme takvimi veya alarm kaydı oluşturulmadı.",
          });
          return;
        }

        if (!dueDate) {
          if (periodText) {
            setCalendarStatus({
              kind: "warning",
              message:
                "Süre metni bulundu; başlangıç tarihi doğrulanamadığı için son tarih oluşturulmadı.",
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
                  "UETS Tebligatı",
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
              "Ödeme takvim kaydı oluşturulamadı."
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
              ? "Bu PDF ödeme kaydı daha önce oluşturulmuş; yeni takvim veya alarm eklenmedi."
              : "PDF ödeme son tarihi takvime ve alarm planına kaydedildi."),
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
         * TEST BELGESİ:
         * API'YE BİLE TAKVİM YAZDIRMIYORUZ.
         */
        if (isTest) {
          setCalendarStatus({
            kind:
              "warning",

            message:
              "Test belgesi algılandı — hiçbir takvim veya alarm kaydı oluşturulmadı.",
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
              "Belgede açık bir duruşma tarihi bulunmadı. Otomatik takvim kaydı oluşturulmadı.",
          });

          return;
        }

        /*
         * Tarih var ama saat yoksa otomatik kayıt yapma.
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
              "Duruşma bulundu ancak tarih/saat bilgisi eksik. İnsan kontrolü olmadan takvime yazılmadı.",
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
              "Belge insan kontrolü gerektiriyor. Duruşma otomatik takvime yazılmadı.",
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
              "Belge otomatik takvim kaydı için güvenli bulunmadı.",
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
              "Takvim kaydı oluşturulamadı."
            );
          }

          const message =
            data.message ||
            "Duruşma takvime kaydedildi.";

          setCalendarStatus({
            kind:
              data.duplicate
                ? "info"
                : "success",

            message,
          });

          /*
           * Sonraki turda Posta ekranı
           * bu bilgiyi küçük bildirim olarak gösterecek.
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
                : "Takvim kaydı oluşturulamadı.",
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
            "UETS belge metni boş geldi."
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
                      "UETS Tebligatı",

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
            window ||
          event.origin !==
            window.location.origin
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

        try {
          const sourceUrl =
            new URL(
              safeText(
                payload.url
              )
            );

          if (
            sourceUrl.origin !==
              "https://ptt.etebligat.gov.tr" ||
            sourceUrl.search ||
            sourceUrl.hash ||
            sourceUrl.username ||
            sourceUrl.password
          ) {
            return;
          }
        } catch {
          return;
        }

        setCapture(
          payload
        );

        /*
         * Extension'a veriyi aldığımızı bildir.
         * Geçici chrome.storage kaydı temizlenebilir.
         */
        window.postMessage(
          {
            source:
              "METHER_UETS_ACK",
          },
          window.location.origin
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
            "var(--legal-success)",
        }
      : calendarStatus?.kind ===
          "error"
        ? {
            border:
              "1px solid rgba(235,90,90,.55)",
            background:
              "rgba(160,40,40,.12)",
            color:
              "var(--legal-danger)",
          }
        : calendarStatus?.kind ===
            "warning"
          ? {
              border:
                "1px solid rgba(205,164,83,.55)",
              background:
                "rgba(170,125,30,.10)",
              color:
                "var(--legal-warning)",
            }
          : {
              border:
                "1px solid rgba(100,130,170,.4)",
              background:
                "rgba(80,110,150,.08)",
              color:
                "var(--legal-muted)",
            };

  return (
    <main
      className="legal-app uets-import-page"
      style={{
        minHeight:
          "100vh",

        background:
          "transparent",

        color:
          "var(--legal-text)",

        padding:
          "18px 76px 28px 18px",
      }}
    >
      <MobileBridgeHelp />
      <div className="desktop-bridge-workspace"
        style={{
          width:
            "min(1180px, 100%)",

          margin:
            "0 auto",

          padding:
            18,

          border:
            "1px solid var(--legal-border)",

          borderRadius:
            24,

          background:
            "color-mix(in srgb, var(--legal-surface) 92%, transparent)",

          boxShadow:
            "var(--legal-shadow-md)",

          backdropFilter:
            "blur(22px)",
        }}
      >
        <div
          style={{
            marginBottom: 10,
          }}
        >
          <LegalBackButton fallback="/" />
        </div>

        <header
          style={{
            display:
              "flex",

            alignItems:
              "center",

            gap:
              14,

            marginBottom:
              16,
          }}
        >
          <LegalBrand />

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
              <h1
                style={{
                  margin:
                    0,

                  fontSize:
                    21,

                  fontWeight:
                    750,
                }}
              >
                UETS Çalışma Alanı
              </h1>
            </div>

            <p
              style={{
                margin:
                  "6px 0 0",

                color:
                  "var(--legal-muted)",

                fontSize:
                  12,
              }}
            >
              Açık tebligatı güvenli browser köprüsünden alın.
            </p>
          </div>
        </header>

        {!capture && (
          <section
            style={{
              border:
                "1px solid var(--legal-border)",

              borderRadius:
                16,

              padding:
                20,

              background:
                "var(--legal-surface)",

              color:
                "var(--legal-muted)",
            }}
          >
            UETS Bridge aktarımı bekleniyor…
          </section>
        )}

        {capture && (
          <section
            style={{
              border:
                "1px solid var(--legal-border)",

              borderRadius:
                16,

              padding:
                16,

              background:
                "var(--legal-surface)",
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
                "UETS Tebligatı"}
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
                  "var(--legal-muted)",
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
                  "var(--legal-border)",

                margin:
                  "14px 0",
              }}
            />

            {loading && (
              <div
                style={{
                  padding:
                    12,

                  border:
                    "1px solid var(--legal-border)",

                  borderRadius:
                    12,

                  background:
                    "var(--legal-surface-2)",

                  color:
                    "var(--legal-gold-dark)",
                }}
              >
                METHER Belge Analizi çalışıyor…
              </div>
            )}

            {error && (
              <div
                style={{
                  padding:
                    12,

                  border:
                    "1px solid rgba(235,90,90,.55)",

                  borderRadius:
                    12,

                  background:
                    "rgba(160,40,40,.12)",

                  color:
                    "var(--legal-danger)",
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
                    "11px 13px",

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
                    "1px solid var(--legal-border)",

                  borderRadius:
                    14,

                  padding:
                    14,

                  background:
                    "var(--legal-surface-2)",
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
                        border: "1px solid var(--legal-border)",
                        borderRadius: 12,
                        background: "var(--legal-surface)",
                        fontSize: 12,
                        lineHeight: 1.7,
                      }}
                    >
                      <strong>Ödeme Bilgisi</strong>
                      <div>
                        {formatPaymentAmount(
                          result.document.payment.paymentAmount,
                          result.document.payment.paymentCurrency
                        ) || "Tutar belirtilmedi"}
                      </div>
                      <div>
                        {result.document.payment.paymentDescription ||
                          "Ödeme açıklaması bulunamadı"}
                      </div>
                      <div>
                        {result.document.payment.paymentDueDate
                          ? `Son tarih: ${result.document.payment.paymentDueDate}`
                          : result.document.payment.paymentPeriodText ||
                            "Son tarih bulunamadı"}
                      </div>
                      <div>
                        {result.document.payment.sourceDocument ||
                          "Kaynak PDF belirtilmedi"}
                      </div>
                      {!result.document.payment.paymentDueDate &&
                        result.document.payment.paymentPeriodText && (
                          <div style={{ color: "#e6c879", marginTop: 5 }}>
                            Süre metni bulundu; başlangıç tarihi doğrulanamadığı için son tarih oluşturulmadı.
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
                      "var(--legal-text)",
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
                  "1px solid var(--legal-border)",

                borderRadius:
                  12,

                padding:
                  "12px 14px",

                background:
                  "var(--legal-surface-2)",
              }}
            >
              <summary
                style={{
                  cursor:
                    "pointer",

                  color:
                  "var(--legal-gold-dark)",

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
                    320,

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
                    "var(--legal-text-soft)",
                }}
              >
                {capture.text}
              </pre>
            </details>
          </section>
        )}
      </div>
      <LegalDock />
    </main>
  );
}
