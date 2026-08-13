export type MailAccountSource = {
  id: string;
  user_id?: string;
  provider: string;
  email?: string | null;
  status?: string | null;
  display_name?: string | null;
  settings?: Record<string, unknown> | null;
};

export type MailAccountDTO = {
  id: string;
  accountId: string;
  provider: string;
  email: string;
  emailAddress: string;
  displayName: string;
  status: string;
  connectionStatus: string;
};

function cleanText(
  value: unknown
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

export function normalizeMailAccountEmail(
  value: unknown
) {
  return cleanText(value)
    .toLocaleLowerCase("tr-TR");
}

export function toMailAccountDTO(
  connection: MailAccountSource
): MailAccountDTO {
  const email =
    normalizeMailAccountEmail(
      connection.email
    );

  const settingsName =
    cleanText(
      connection.settings
        ?.displayName
    );

  const displayName =
    cleanText(
      connection.display_name
    ) ||
    settingsName ||
    email;

  const status =
    cleanText(
      connection.status
    ) || "connected";

  return {
    id: connection.id,
    accountId:
      connection.id,
    provider:
      connection.provider,
    email,
    emailAddress: email,
    displayName,
    status,
    connectionStatus:
      status,
  };
}

export function addSourceAccount<
  T extends Record<string, unknown>
>(
  value: T,
  connection: MailAccountSource
) {
  return {
    ...value,
    sourceAccount:
      toMailAccountDTO(
        connection
      ),
  };
}

export function findOwnedConnectedAccount(
  connections: MailAccountSource[],
  userId: string,
  accountId: string
) {
  return connections.find(
    (connection) =>
      connection.id ===
        accountId &&
      connection.user_id ===
        userId &&
      connection.status ===
        "connected"
  ) || null;
}

export function resolveComposerAccountId(
  connections: MailAccountSource[],
  requestedAccountId: string,
  fallbackAccountId = ""
) {
  if (
    connections.some(
      (connection) =>
        connection.id ===
        requestedAccountId
    )
  ) {
    return requestedAccountId;
  }

  if (
    connections.some(
      (connection) =>
        connection.id ===
        fallbackAccountId
    )
  ) {
    return fallbackAccountId;
  }

  return connections[0]
    ?.id || "";
}
