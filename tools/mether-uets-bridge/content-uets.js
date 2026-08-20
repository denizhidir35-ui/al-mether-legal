(() => {
  "use strict";

  const BUTTON_ID =
    "mether-uets-bridge-button";

  const UETS_ORIGIN =
    "https://ptt.etebligat.gov.tr";

  const LOCAL_TARGET =
    "http://localhost:3000/uets-import?bridge=1";

  const PRODUCTION_TARGET =
    "https://legal.almether.com/uets-import?bridge=1";

  if (
    location.origin !==
      UETS_ORIGIN ||
    window.top !== window ||
    document.getElementById(
      BUTTON_ID
    )
  ) {
    return;
  }

  function isLoginPage() {
    const path =
      location.pathname
        .toLowerCase();

    const body =
      (
        document.body
          ?.innerText ||
        ""
      )
        .slice(0, 4000)
        .toLowerCase();

    return (
      path.includes(
        "/login"
      ) ||
      (
        body.includes(
          "uets şifresi"
        ) &&
        body.includes(
          "giriş"
        )
      )
    );
  }

  if (isLoginPage()) {
    return;
  }

  function cleanText(
    value
  ) {
    return String(
      value || ""
    )
      .replace(
        /\r/g,
        ""
      )
      .replace(
        /(^|\n)[^\n]{0,80}(?:şifre|parola|password|access[_ -]?token|refresh[_ -]?token|authorization|bearer|cookie|csrf|jwt|session[_ -]?(?:id|token)|api[_ -]?key|oturum[_ -]?(?:anahtarı|token))[^\n]*/giu,
        "$1[HASSAS BİLGİ AKTARILMADI]"
      )
      .replace(
        /[ \t]+\n/g,
        "\n"
      )
      .replace(
        /\n{4,}/g,
        "\n\n"
      )
      .trim();
  }

  function iframeText() {
    const result = [];

    for (
      const frame
      of document.querySelectorAll(
        "iframe"
      )
    ) {
      try {
        const text =
          frame
            .contentDocument
            ?.body
            ?.innerText;

        if (text) {
          result.push(
            cleanText(text)
          );
        }
      } catch {
        // Cross-origin iframe okunmaz.
      }
    }

    return result;
  }

  function collectLinks() {
    const output = [];
    const seen =
      new Set();

    const elements = [
      ...document
        .querySelectorAll(
          "a[href]"
        ),
      ...document
        .querySelectorAll(
          "embed[src],object[data]"
        ),
    ];

    for (
      const element
      of elements
    ) {
      const raw =
        element.getAttribute(
          "href"
        ) ||
        element.getAttribute(
          "src"
        ) ||
        element.getAttribute(
          "data"
        ) ||
        "";

      if (!raw) {
        continue;
      }

      let url;

      try {
        url = new URL(
          raw,
          location.href
        );
      } catch {
        continue;
      }

      if (
        url.origin !==
        UETS_ORIGIN
      ) {
        continue;
      }

      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";

      const href =
        url.href;

      if (
        seen.has(href)
      ) {
        continue;
      }

      seen.add(href);

      output.push({
        text:
          cleanText(
            element.textContent ||
            element.getAttribute(
              "title"
            ) ||
            ""
          ).slice(
            0,
            300
          ),

        href,
      });

      if (
        output.length >=
        20
      ) {
        break;
      }
    }

    return output;
  }

  function safeSourceUrl() {
    const url =
      new URL(location.href);

    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";

    return url.href;
  }

  function collectCapture() {
    const mainText =
      cleanText(
        document.body
          ?.innerText ||
        ""
      );

    const frames =
      iframeText();

    const fullText =
      [
        mainText,
        ...frames,
      ]
        .filter(Boolean)
        .join(
          "\n\n--- METHER FRAME ---\n\n"
        )
        .slice(
          0,
          1_500_000
        );

    return {
      version: 1,

      capturedAt:
        new Date()
          .toISOString(),

      url:
        safeSourceUrl(),

      title:
        document.title ||
        "UETS Tebligatı",

      text:
        fullText,

      links:
        collectLinks(),
    };
  }

  async function targetUrl() {
    const stored =
      await chrome.storage
        .local
        .get(
          "metherTarget"
        );

    const target =
      stored
        ?.metherTarget;

    return target ===
      PRODUCTION_TARGET ||
      target === LOCAL_TARGET
      ? target
      : LOCAL_TARGET;
  }

  const button =
    document.createElement(
      "button"
    );

  button.id =
    BUTTON_ID;

  button.type =
    "button";

  button.textContent =
    "METHER'e Aktar";

  button.title =
    "Açık UETS tebligatını METHER Legal'e aktar";

  button.addEventListener(
    "click",
    async () => {
      try {
        button.disabled =
          true;

        button.textContent =
          "Aktarılıyor...";

        const capture =
          collectCapture();

        if (
          capture.text.length <
          30
        ) {
          throw new Error(
            "Açık tebligat içeriği okunamadı."
          );
        }

        await chrome.storage
          .local
          .set({
            metherUetsCapture:
              capture,
          });

        const target =
          await targetUrl();

        window.open(
          target,
          "_blank",
          "noopener"
        );

        button.textContent =
          "METHER açıldı";

        window.setTimeout(
          () => {
            button.disabled =
              false;

            button.textContent =
              "METHER'e Aktar";
          },
          2500
        );
      } catch (error) {
        button.disabled =
          false;

        button.textContent =
          "Aktarım başarısız";

        console.error(
          "METHER UETS BRIDGE:",
          error instanceof Error
            ? error.message
            : "Bilinmeyen hata"
        );

        window.setTimeout(
          () => {
            button.textContent =
              "METHER'e Aktar";
          },
          2500
        );
      }
    }
  );

  document.body.appendChild(
    button
  );
})();
