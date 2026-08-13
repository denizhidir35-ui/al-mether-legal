export const GMAIL_FULL_ACCESS_SCOPE =
  "https://mail.google.com/";

export type GmailScopeStatus = {
  trashReady: boolean;
  reconnectRequired: boolean;
};

export function normalizeOAuthScopes(
  value: unknown
) {
  const values =
    Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/\s+/)
        : [];

  return Array.from(
    new Set(
      values
        .map((scope) =>
          String(scope || "").trim()
        )
        .filter(Boolean)
    )
  );
}

export function readStoredGoogleScopes(
  settings:
    | Record<string, unknown>
    | null
    | undefined
) {
  return normalizeOAuthScopes(
    settings?.oauthScopes
  );
}

export function mergeGoogleOAuthScopes(
  settings:
    | Record<string, unknown>
    | null
    | undefined,
  grantedScopes: unknown
) {
  const scopes =
    normalizeOAuthScopes(
      grantedScopes
    );

  if (scopes.length === 0) {
    return settings || {};
  }

  return {
    ...(settings || {}),
    oauthScopes: scopes,
  };
}

export function getGmailScopeStatus(
  scopes: unknown
): GmailScopeStatus {
  const trashReady =
    normalizeOAuthScopes(
      scopes
    ).includes(
      GMAIL_FULL_ACCESS_SCOPE
    );

  return {
    trashReady,
    reconnectRequired:
      !trashReady,
  };
}
