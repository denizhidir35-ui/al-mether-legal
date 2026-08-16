(() => {
  const userAgent = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  document.body.classList.add(isIOS ? "platform-ios" : "platform-android");

  let deferredInstallPrompt = null;
  const installButton = document.querySelector(".pwaInstallButton");

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    document.body.classList.add("can-install");
  });

  installButton?.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.body.classList.remove("can-install");
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    document.body.classList.remove("can-install");
  });
})();
