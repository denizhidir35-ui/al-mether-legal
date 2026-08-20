(() => {
  "use strict";

  if (
    !location.pathname
      .startsWith(
        "/celse-import"
      )
  ) {
    return;
  }

  let acknowledged =
    false;

  let attempts =
    0;

  const MAX_ATTEMPTS =
    30;

  async function deliver() {
    if (
      acknowledged ||
      attempts >= MAX_ATTEMPTS
    ) {
      return;
    }

    attempts++;

    const stored =
      await chrome.storage
        .local
        .get(
          "metherCelseCapture"
        );

    const payload =
      stored
        ?.metherCelseCapture;

    if (!payload) {
      return;
    }

    window.postMessage(
      {
        source:
          "METHER_CELSE_BRIDGE",

        payload
      },
      window.location.origin
    );
  }

  window.addEventListener(
    "message",
    async (event) => {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        event.data?.source !==
          "METHER_CELSE_ACK"
      ) {
        return;
      }

      acknowledged =
        true;

      await chrome.storage
        .local
        .remove(
          "metherCelseCapture"
        );
    }
  );

  void deliver();

  const timer =
    window.setInterval(
      () => {
        if (
          acknowledged ||
          attempts >= MAX_ATTEMPTS
        ) {
          clearInterval(
            timer
          );

          return;
        }

        void deliver();
      },
      500
    );
})();
