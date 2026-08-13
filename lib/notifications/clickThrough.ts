const TARGET_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;
const APP_ORIGIN = "https://legal.almether.com";

export function resolveNotificationTarget(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";

  if (!raw) return "/inbox";

  let url: URL;

  try {
    url = new URL(raw, APP_ORIGIN);
  } catch {
    return "/inbox";
  }

  if (url.origin !== APP_ORIGIN) return "/inbox";

  if (url.pathname === "/calendar") {
    const eventId = url.searchParams.get("event")?.trim() || "";

    return eventId && TARGET_ID_PATTERN.test(eventId)
      ? `/calendar?event=${encodeURIComponent(eventId)}`
      : "/calendar";
  }

  if (url.pathname === "/cases") {
    const caseId = url.searchParams.get("case")?.trim() || "";

    return caseId && TARGET_ID_PATTERN.test(caseId)
      ? `/cases?case=${encodeURIComponent(caseId)}`
      : "/cases";
  }

  return url.pathname === "/inbox" ? "/inbox" : "/inbox";
}

type NativeWebViewWindow = Window & {
  chrome?: {
    webview?: {
      postMessage: (message: unknown) => void;
    };
  };
};

export function openNotificationTarget(value: unknown) {
  const target = resolveNotificationTarget(value);
  const nativeWindow = window as NativeWebViewWindow;

  nativeWindow.chrome?.webview?.postMessage({
    source: "METHER_NOTIFICATION_OPEN",
    url: target,
  });

  window.focus();
  window.location.assign(target);
}
