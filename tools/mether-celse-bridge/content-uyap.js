(() => {
  "use strict";

  const HOST =
    "avukat.uyap.gov.tr";

  const LOCAL_MOCK =
    ["localhost", "127.0.0.1"].includes(location.hostname) &&
    location.port === "4173" &&
    location.pathname.endsWith("/mock-uyap.html");

  const BUTTON_ID =
    "mether-celse-bridge-button";

  const STATUS_ID =
    "mether-celse-bridge-status";

  if (
    (location.hostname !== HOST && !LOCAL_MOCK) ||
    window.top !== window ||
    document.getElementById(BUTTON_ID)
  ) {
    return;
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\r/g, "")
      .replace(
        /(^|\n)[^\n]{0,80}(?:şifre|parola|password|access[_ -]?token|refresh[_ -]?token|authorization)[^\n]*/giu,
        "$1[HASSAS BİLGİ AKTARILMADI]"
      )
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function safeSourceUrl() {
    if (LOCAL_MOCK) {
      return document.documentElement.dataset.metherSourceUrl || "";
    }

    const url = new URL(location.href);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.href;
  }

  function collectVisibleText() {
    const candidates = [
      document.querySelector("main"),
      document.querySelector('[role="main"]'),
      document.querySelector("#content"),
      document.querySelector(".content"),
      document.body
    ];

    let best = "";

    for (const node of candidates) {
      if (!node) {
        continue;
      }

      const value =
        cleanText(
          node.innerText ||
          node.textContent ||
          ""
        );

      if (value.length > best.length) {
        best = value;
      }
    }

    /*
     * Aynı origin içindeki iframe varsa
     * sadece görünür metnini eklemeyi dene.
     *
     * Cross-origin frame'lere erişilmez.
     */
    const frameTexts = [];

    for (
      const frame of
      document.querySelectorAll("iframe")
    ) {
      try {
        const frameBody =
          frame.contentDocument?.body;

        if (!frameBody) {
          continue;
        }

        const value =
          cleanText(
            frameBody.innerText ||
            frameBody.textContent ||
            ""
          );

        if (value.length >= 30) {
          frameTexts.push(value);
        }
      }
      catch {
        // Cross-origin iframe: bilinçli olarak atla.
      }
    }

    const combined =
      cleanText(
        [
          best,
          ...frameTexts
        ].join("\n\n")
      );

    return combined.slice(
      0,
      200000
    );
  }

  async function getTargetUrl() {
    const stored =
      await chrome.storage
        .local
        .get(
          "metherCelseTarget"
        );

    return (
      stored
        ?.metherCelseTarget ||
      (LOCAL_MOCK
        ? "http://localhost:3000/celse-import?bridge=1&mock=1"
        : "http://localhost:3000/celse-import?bridge=1")
    );
  }

  function showStatus(
    message,
    isError = false
  ) {
    let status =
      document.getElementById(
        STATUS_ID
      );

    if (!status) {
      status =
        document.createElement(
          "div"
        );

      status.id =
        STATUS_ID;

      status.style.position =
        "fixed";

      status.style.right =
        "24px";

      status.style.bottom =
        "82px";

      status.style.zIndex =
        "2147483647";

      status.style.maxWidth =
        "330px";

      status.style.padding =
        "10px 13px";

      status.style.borderRadius =
        "10px";

      status.style.fontFamily =
        "Arial, sans-serif";

      status.style.fontSize =
        "12px";

      status.style.boxShadow =
        "0 8px 30px rgba(0,0,0,.25)";

      document.documentElement
        .appendChild(
          status
        );
    }

    status.style.background =
      isError
        ? "#7f1d1d"
        : "#10243a";

    status.style.color =
      "#ffffff";

    status.textContent =
      message;

    window.setTimeout(
      () => {
        status?.remove();
      },
      5000
    );
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

  button.style.position =
    "fixed";

  button.style.right =
    "24px";

  button.style.bottom =
    "24px";

  button.style.zIndex =
    "2147483647";

  button.style.padding =
    "13px 18px";

  button.style.border =
    "1px solid rgba(80,220,220,.55)";

  button.style.borderRadius =
    "12px";

  button.style.background =
    "#071827";

  button.style.color =
    "#77e4df";

  button.style.fontFamily =
    "Arial, sans-serif";

  button.style.fontSize =
    "13px";

  button.style.fontWeight =
    "700";

  button.style.cursor =
    "pointer";

  button.style.boxShadow =
    "0 10px 35px rgba(0,0,0,.35)";

  button.addEventListener(
    "click",
    async () => {
      try {
        button.disabled =
          true;

        button.textContent =
          "Hazırlanıyor...";

        const text =
          collectVisibleText();

        if (text.length < 30) {
          throw new Error(
            "Bu sayfada aktarılabilecek yeterli dosya veya duruşma metni bulunamadı."
          );
        }

        const capture = {
          title:
            document.title ||
            "UYAP Avukat Portal",

          url:
            safeSourceUrl(),

          text,

          capturedAt:
            new Date()
              .toISOString(),

          sourceDocument:
            "UYAP Avukat Portal"
        };

        await chrome.storage
          .local
          .set({
            metherCelseCapture:
              capture
          });

        const target =
          await getTargetUrl();

        showStatus(
          "UYAP verisi hazırlandı. METHER Legal açılıyor."
        );

        window.open(
          target,
          "_blank"
        );
      }
      catch (error) {
        showStatus(
          error instanceof Error
            ? error.message
            : "UYAP verisi aktarılamadı.",
          true
        );
      }
      finally {
        button.disabled =
          false;

        button.textContent =
          "METHER'e Aktar";
      }
    }
  );

  document.documentElement
    .appendChild(
      button
    );
})();
