export const MAX_UETS_PDF_BYTES = 100_000_000;

export function validateUetsPdfBytes(bytes: Buffer) {
  if (bytes.length > MAX_UETS_PDF_BYTES) {
    throw new Error("PDF analiz sınırı 100 MB'tır.");
  }

  if (bytes.length < 5 || bytes.subarray(0, 5).toString() !== "%PDF-") {
    throw new Error("Aktarılan ek geçerli bir PDF değil.");
  }

  return bytes;
}

export function decodeUetsPdf(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const encoded = value.trim().replace(/^data:application\/pdf;base64,/i, "");

  if (encoded.length > Math.ceil((MAX_UETS_PDF_BYTES * 4) / 3) + 8) {
    throw new Error("PDF analiz sınırı 100 MB'tır.");
  }

  const bytes = Buffer.from(encoded, "base64");

  return validateUetsPdfBytes(bytes);
}
