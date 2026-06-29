export function normalizeCalendarError(error: unknown, fallback = "Takvim işlemi sırasında hata oluştu.") {
  if (error instanceof Error) return error.message;

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}
