const ZERO_WIDTH_CHARACTERS =
  /[\u200B-\u200D\u2060\uFEFF]/g;

export function normalizeAuthEmail(
  value: unknown
) {
  return String(value || "")
    .normalize("NFKC")
    .replace(
      ZERO_WIDTH_CHARACTERS,
      ""
    )
    .trim()
    .toLowerCase();
}
