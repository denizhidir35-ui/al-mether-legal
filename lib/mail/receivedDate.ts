export type ProviderReceivedDateInput = {
  provider: string;
  internalDate?: unknown;
  receivedDateTime?: unknown;
  headerDate?: unknown;
};

function validIso(
  value: unknown
) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return "";
  }

  const parsed =
    new Date(value.trim());

  return Number.isNaN(
    parsed.getTime()
  )
    ? ""
    : parsed.toISOString();
}

export function resolveProviderReceivedAt(
  input: ProviderReceivedDateInput
) {
  const provider =
    input.provider
      .trim()
      .toLowerCase();

  if (
    provider === "google"
  ) {
    const milliseconds =
      typeof input.internalDate ===
        "string" ||
      typeof input.internalDate ===
        "number"
        ? Number(
            input.internalDate
          )
        : NaN;

    if (
      Number.isFinite(
        milliseconds
      ) &&
      milliseconds > 0
    ) {
      return new Date(
        milliseconds
      ).toISOString();
    }
  }

  if (
    provider === "imap"
  ) {
    const internal =
      validIso(
        input.internalDate
      );

    if (internal) {
      return internal;
    }
  }

  if (
    provider === "microsoft"
  ) {
    const received =
      validIso(
        input.receivedDateTime
      );

    if (received) {
      return received;
    }
  }

  return validIso(
    input.headerDate
  );
}

export function createMailReceivedDedupeKey(
  accountId: string,
  provider: string,
  messageId: string
) {
  return [
    "mail-received",
    accountId.trim(),
    provider.trim()
      .toLowerCase(),
    messageId.trim(),
  ].join(":");
}

export function createMailReceivedEventTitle(
  court: string,
  subject: string
) {
  const context =
    court.trim() ||
    subject.trim() ||
    "Hukuki mail";

  return `E-posta alındı — ${context}`;
}
