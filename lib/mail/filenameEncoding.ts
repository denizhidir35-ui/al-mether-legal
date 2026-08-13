function decodeBytes(
  bytes: Uint8Array,
  charset: string
) {
  const normalized = charset
    .trim()
    .toLowerCase()
    .replace(/^utf8$/, "utf-8")
    .replace(/^iso-8859-9$/, "windows-1254");

  try {
    return new TextDecoder(
      normalized,
      { fatal: true }
    ).decode(bytes);
  } catch {
    return new TextDecoder(
      "utf-8",
      { fatal: false }
    ).decode(bytes);
  }
}

function decodeMimeWord(
  charset: string,
  encoding: string,
  payload: string
) {
  try {
    const bytes =
      encoding.toLowerCase() === "b"
        ? Uint8Array.from(
            Buffer.from(payload, "base64")
          )
        : Uint8Array.from(
            Buffer.from(
              payload
                .replace(/_/g, " ")
                .replace(
                  /=([0-9A-F]{2})/gi,
                  (_, hex) =>
                    String.fromCharCode(
                      Number.parseInt(hex, 16)
                    )
                ),
              "latin1"
            )
          );

    return decodeBytes(bytes, charset);
  } catch {
    return payload;
  }
}

function suspiciousCount(value: string) {
  return (
    value.match(
      /(?:Ã|Â|Ä|Å|â|ð|ï¿½|�)/g
    ) || []
  ).length;
}

const WINDOWS_1252_BYTES =
  new Map<string, number>([
    ["€", 0x80], ["‚", 0x82], ["ƒ", 0x83],
    ["„", 0x84], ["…", 0x85], ["†", 0x86],
    ["‡", 0x87], ["ˆ", 0x88], ["‰", 0x89],
    ["Š", 0x8a], ["‹", 0x8b], ["Œ", 0x8c],
    ["Ž", 0x8e], ["‘", 0x91], ["’", 0x92],
    ["“", 0x93], ["”", 0x94], ["•", 0x95],
    ["–", 0x96], ["—", 0x97], ["˜", 0x98],
    ["™", 0x99], ["š", 0x9a], ["›", 0x9b],
    ["œ", 0x9c], ["ž", 0x9e], ["Ÿ", 0x9f],
  ]);

function windows1252Bytes(value: string) {
  const bytes: number[] = [];

  for (const character of value) {
    const code = character.charCodeAt(0);

    if (code <= 255) {
      bytes.push(code);
      continue;
    }

    const mapped =
      WINDOWS_1252_BYTES.get(character);

    if (mapped === undefined) {
      return null;
    }

    bytes.push(mapped);
  }

  return Uint8Array.from(bytes);
}

function repairUtf8AsLatin1(
  value: string
) {
  let current = value;

  for (let pass = 0; pass < 2; pass += 1) {
    if (
      suspiciousCount(current) === 0
    ) {
      break;
    }

    try {
      const bytes =
        windows1252Bytes(current);

      if (!bytes) {
        break;
      }

      const repaired =
        new TextDecoder(
          "utf-8",
          { fatal: true }
        ).decode(
          bytes
        );

      if (
        suspiciousCount(repaired) >=
        suspiciousCount(current)
      ) {
        break;
      }

      current = repaired;
    } catch {
      break;
    }
  }

  return current;
}

export function decodeAttachmentFilename(
  value: unknown,
  fallback = "dosya"
) {
  const raw = String(value || "")
    .replace(/\r?\n[ \t]+/g, "")
    .trim();

  const mimeDecoded = raw.replace(
    /=\?([^?]+)\?([bq])\?([^?]*)\?=/gi,
    (_, charset, encoding, payload) =>
      decodeMimeWord(
        charset,
        encoding,
        payload
      )
  );

  const repaired =
    repairUtf8AsLatin1(
      mimeDecoded
    )
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim();

  return repaired || fallback;
}
