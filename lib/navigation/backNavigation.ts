export const SAFE_HISTORY_KEY =
  "mether-safe-back-path";

export function markSafeAppNavigation(
  destination: string
) {
  try {
    window.sessionStorage.setItem(
      SAFE_HISTORY_KEY,
      destination
    );
  } catch {}
}

export function hasSafeAppHistory(
  currentPath: string,
  referrer: string,
  historyLength: number,
  markedPath: string,
  currentOrigin: string
) {
  if (historyLength <= 1) return false;
  if (markedPath === currentPath) return true;
  if (!referrer) return false;

  try {
    return (
      new URL(referrer).origin ===
      currentOrigin
    );
  } catch {
    return false;
  }
}
