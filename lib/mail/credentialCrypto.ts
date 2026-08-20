import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";

function getKey() {
  const encoded =
    process.env
      .MAIL_CREDENTIALS_KEY ||
    "";

  const key =
    Buffer.from(
      encoded,
      "base64"
    );

  if (
    key.length !==
    32
  ) {
    throw new Error(
      "MAIL_CREDENTIALS_KEY geçersiz."
    );
  }

  return key;
}

export function assertMailCredentialsKey() {
  getKey();
}

export function encryptMailSecret(
  value: string
) {
  const iv =
    randomBytes(12);

  const cipher =
    createCipheriv(
      "aes-256-gcm",
      getKey(),
      iv
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        value,
        "utf8"
      ),

      cipher.final(),
    ]);

  const tag =
    cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString(
      "base64url"
    ),
  ].join(".");
}

export function decryptMailSecret(
  value: string
) {
  const [
    version,
    ivText,
    tagText,
    encryptedText,
  ] =
    value.split(".");

  if (
    version !== "v1" ||
    !ivText ||
    !tagText ||
    !encryptedText
  ) {
    throw new Error(
      "Mail kimlik bilgisi çözülemedi."
    );
  }

  const decipher =
    createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(
        ivText,
        "base64url"
      )
    );

  decipher.setAuthTag(
    Buffer.from(
      tagText,
      "base64url"
    )
  );

  return Buffer.concat([
    decipher.update(
      Buffer.from(
        encryptedText,
        "base64url"
      )
    ),

    decipher.final(),
  ]).toString("utf8");
}

export function isEncryptedMailSecret(
  value: unknown
) {
  if (
    typeof value !== "string"
  ) {
    return false;
  }

  const parts =
    value.split(".");

  return (
    parts.length === 4 &&
    parts[0] === "v1" &&
    parts.slice(1).every(Boolean)
  );
}

export function decryptStoredMailSecret(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return null;
  }

  assertMailCredentialsKey();

  return isEncryptedMailSecret(
    value
  )
    ? decryptMailSecret(value)
    : value;
}

export function encryptStoredMailSecret(
  value:
    | string
    | null
    | undefined
) {
  return value
    ? encryptMailSecret(value)
    : null;
}
