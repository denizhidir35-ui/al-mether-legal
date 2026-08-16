import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const installScript = readFileSync(
  new URL("../public/download-install.js", import.meta.url),
  "utf8",
);

function runInstallScript({ userAgent, platform = "", maxTouchPoints = 0 }) {
  const bodyClasses = new Set();
  const windowListeners = new Map();
  const buttonListeners = new Map();

  const context = {
    navigator: { userAgent, platform, maxTouchPoints },
    document: {
      body: {
        classList: {
          add: (...names) => names.forEach((name) => bodyClasses.add(name)),
          remove: (...names) => names.forEach((name) => bodyClasses.delete(name)),
        },
      },
      querySelector: () => ({
        addEventListener: (name, listener) => buttonListeners.set(name, listener),
      }),
    },
    window: {
      addEventListener: (name, listener) => windowListeners.set(name, listener),
    },
  };

  vm.runInNewContext(installScript, context);

  return { bodyClasses, buttonListeners, windowListeners };
}

test("iPhone ve dokunmatik iPad iOS kurulum açıklamasını seçer", () => {
  const iphone = runInstallScript({ userAgent: "Mozilla/5.0 (iPhone)" });
  assert.equal(iphone.bodyClasses.has("platform-ios"), true);

  const ipad = runInstallScript({
    userAgent: "Mozilla/5.0 (Macintosh)",
    platform: "MacIntel",
    maxTouchPoints: 5,
  });
  assert.equal(ipad.bodyClasses.has("platform-ios"), true);
});

test("Android destek yokken fallback durumunda kalır", () => {
  const android = runInstallScript({ userAgent: "Mozilla/5.0 (Linux; Android 16)" });
  assert.equal(android.bodyClasses.has("platform-android"), true);
  assert.equal(android.bodyClasses.has("can-install"), false);
});

test("beforeinstallprompt varsa yükleme düğmesini açar ve istemi çalıştırır", async () => {
  const android = runInstallScript({ userAgent: "Mozilla/5.0 (Linux; Android 16)" });
  let prevented = false;
  let prompted = false;
  const event = {
    preventDefault: () => {
      prevented = true;
    },
    prompt: () => {
      prompted = true;
    },
    userChoice: Promise.resolve({ outcome: "accepted" }),
  };

  android.windowListeners.get("beforeinstallprompt")(event);
  assert.equal(prevented, true);
  assert.equal(android.bodyClasses.has("can-install"), true);

  await android.buttonListeners.get("click")();
  assert.equal(prompted, true);
  assert.equal(android.bodyClasses.has("can-install"), false);
});

test("mobil açma bağlantıları güvenli inbox akışına gider", () => {
  const routeSource = readFileSync(
    new URL("../app/download/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(routeSource, /href="\/inbox">Telefonda Aç/);
  assert.match(routeSource, /href="\/inbox">Web'de Aç/);
});
