(() => {
  "use strict";

  const storage = {};
  const results = [];
  const status = () => document.getElementById("acceptance-status");
  const realOpen = window.open.bind(window);
  let targetWindow = null;
  let relayTimer = null;

  globalThis.chrome = {
    storage: {
      local: {
        async get(key) {
          return { [key]: storage[key] };
        },
        async set(values) {
          Object.assign(storage, values);
        },
        async remove(key) {
          delete storage[key];
        },
      },
    },
  };

  function renderResult() {
    const first = results[0];
    const second = results[1];
    const sameCase =
      first?.case?.id && first.case.id === second?.case?.id;
    const sameEvent =
      first?.calendarEvent?.id &&
      first.calendarEvent.id === second?.calendarEvent?.id;
    const passed =
      results.length >= 2 &&
      first?.ok === true &&
      second?.ok === true &&
      second?.duplicate === true &&
      sameCase &&
      sameEvent;

    status().textContent = passed
      ? `PASS — aynı dava ve takvim kaydı yeniden kullanıldı.\nDava: ${first.case.id}\nTakvim: ${first.calendarEvent.id}`
      : `${results.length}/2 aktarım tamamlandı. İkinci aktarım bekleniyor.`;
    status().dataset.result = passed ? "pass" : "pending";
  }

  function startRelay() {
    clearInterval(relayTimer);
    let attempts = 0;
    relayTimer = window.setInterval(() => {
      const payload = storage.metherCelseCapture;
      if (!payload || !targetWindow || targetWindow.closed || attempts >= 40) {
        clearInterval(relayTimer);
        return;
      }

      attempts += 1;
      targetWindow.postMessage(
        { source: "METHER_CELSE_BRIDGE", payload },
        "http://localhost:3000"
      );
    }, 300);
  }

  window.open = (url, target) => {
    targetWindow = realOpen(url, target || "metherCelseAcceptance");
    startRelay();
    return targetWindow;
  };

  window.addEventListener("message", (event) => {
    if (
      event.origin !== "http://localhost:3000" ||
      event.source !== targetWindow
    ) {
      return;
    }

    if (event.data?.source === "METHER_CELSE_ACK") {
      clearInterval(relayTimer);
      delete storage.metherCelseCapture;
      status().textContent = "Aktarım alındı; analiz ve kayıt sonucu bekleniyor.";
    }

    if (event.data?.source === "METHER_CELSE_RESULT") {
      results.push(event.data.result);
      renderResult();
    }
  });
})();
