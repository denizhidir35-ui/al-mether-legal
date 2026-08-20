(() => {
  "use strict";

  const ALLOWED_APP_ORIGINS =
    new Set([
      "http://localhost:3000",
      "https://legal.almether.com",
    ]);

  const UETS_ORIGIN =
    "https://ptt.etebligat.gov.tr";

  if (
    !ALLOWED_APP_ORIGINS.has(
      location.origin
    ) ||
    !location.pathname
      .startsWith(
        "/uets-import"
      )
  ) {
    return;
  }

  let acknowledged =
    false;

  let attempts =
    0;

  function sanitizeText(
    value
  ) {
    return String(value || "")
      .replace(/\r/g, "")
      .replace(
        /(^|\n)[^\n]{0,80}(?:şifre|parola|password|access[_ -]?token|refresh[_ -]?token|authorization|bearer|cookie|csrf|jwt|session[_ -]?(?:id|token)|api[_ -]?key|oturum[_ -]?(?:anahtarı|token))[^\n]*/giu,
        "$1[HASSAS BİLGİ AKTARILMADI]"
      )
      .slice(0, 1_500_000)
      .trim();
  }

  function sanitizePayload(
    value
  ) {
    if (
      !value ||
      typeof value.text !==
        "string"
    ) {
      return null;
    }

    let sourceUrl;

    try {
      sourceUrl =
        new URL(value.url);
    } catch {
      return null;
    }

    if (
      sourceUrl.origin !==
      UETS_ORIGIN
    ) {
      return null;
    }

    sourceUrl.username = "";
    sourceUrl.password = "";
    sourceUrl.search = "";
    sourceUrl.hash = "";

    const links =
      Array.isArray(value.links)
        ? value.links
            .slice(0, 20)
            .map((item) => {
              const raw =
                typeof item === "string"
                  ? item
                  : item?.href;

              try {
                const url =
                  new URL(raw);

                if (
                  url.origin !==
                  UETS_ORIGIN
                ) {
                  return null;
                }

                url.username = "";
                url.password = "";
                url.search = "";
                url.hash = "";

                return {
                  text:
                    typeof item?.text ===
                      "string"
                      ? item.text.slice(
                          0,
                          300
                        )
                      : "",
                  href: url.href,
                };
              } catch {
                return null;
              }
            })
            .filter(Boolean)
        : [];

    return {
      version: 1,
      capturedAt:
        typeof value.capturedAt ===
          "string"
          ? value.capturedAt
          : "",
      url: sourceUrl.href,
      title:
        typeof value.title ===
          "string"
          ? value.title.slice(
              0,
              500
            )
          : "UETS Tebligatı",
      text:
        sanitizeText(
          value.text
        ),
      links,
    };
  }

  async function deliver() {
    if (
      acknowledged ||
      attempts >= 30
    ) {
      return;
    }

    attempts++;

    const stored =
      await chrome.storage
        .local
        .get(
          "metherUetsCapture"
        );

    const payload =
      sanitizePayload(
        stored
          ?.metherUetsCapture
      );

    if (!payload) {
      return;
    }

    window.postMessage(
      {
        source:
          "METHER_UETS_BRIDGE",

        payload,
      },
      window.location.origin
    );
  }

  window.addEventListener(
    "message",
    async (event) => {
      if (
        event.source !==
          window ||
        event.origin !==
          window.location.origin ||
        event.data?.source !==
          "METHER_UETS_ACK"
      ) {
        return;
      }

      acknowledged =
        true;

      await chrome.storage
        .local
        .remove(
          "metherUetsCapture"
        );
    }
  );

  deliver();

  const timer =
    window.setInterval(
      async () => {
        if (
          acknowledged ||
          attempts >= 30
        ) {
          window.clearInterval(
            timer
          );

          return;
        }

        await deliver();
      },
      500
    );
})();
