// Compatibility boundary for legacy browser history. No license decision is stored here.
// Leave unowned legacy entries intact: assigning them to the next login could leak data.
const accountKeys = new Set([
  "al-mether-cases", "al_mether_core_calendar_events", "mether-mail-account",
  "mether-last-calendar-write", "mether-last-calendar-write-seen",
]);

export function scopedAccountKey(key: string, userId: string | null): string {
  if (!accountKeys.has(key) && !key.startsWith("legal-alarm-notified:")) return key;
  return `al-mether-account:${userId ?? "signed-out"}:${key}`;
}

let activeUserId: string | null = null;
let installed = false;

export function setAccountStorageScope(userId: string | null) {
  activeUserId = userId;
  if (installed || typeof window === "undefined") return;
  installed = true;
  // Only known legacy account keys are remapped; auth cookies/tokens and theme are untouched.
  // Each tab has its own scope, so two accounts cannot swap each other's local entries.
  const originalGet = Storage.prototype.getItem;
  const originalSet = Storage.prototype.setItem;
  const originalRemove = Storage.prototype.removeItem;
  Storage.prototype.getItem = function(key: string) {
    return originalGet.call(this, scopedAccountKey(String(key), activeUserId));
  };
  Storage.prototype.setItem = function(key: string, value: string) {
    return originalSet.call(this, scopedAccountKey(String(key), activeUserId), value);
  };
  Storage.prototype.removeItem = function(key: string) {
    return originalRemove.call(this, scopedAccountKey(String(key), activeUserId));
  };
}
