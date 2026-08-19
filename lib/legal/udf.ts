import JSZip from "jszip";

const MAX_ARCHIVE_SIZE =
  20 * 1024 * 1024;

const MAX_CONTENT_XML_LENGTH =
  5_000_000;

export type LegalOpenDocumentFormat =
  | "udf"
  | "odt"
  | "odf";

const FORMAT_LABELS:
  Record<
    LegalOpenDocumentFormat,
    string
  > = {
    udf: "UDF",
    odt: "ODT",
    odf: "ODF",
  };

function decodeXmlEntities(
  value: string
) {
  return value
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, hex: string) =>
        String.fromCodePoint(
          Number.parseInt(hex, 16)
        )
    )
    .replace(
      /&#(\d+);/g,
      (_, decimal: string) =>
        String.fromCodePoint(
          Number.parseInt(decimal, 10)
        )
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

export function normalizeUdfContentXml(
  xml: string
) {
  return decodeXmlEntities(
    xml
      .replace(
        /<!\[CDATA\[([\s\S]*?)\]\]>/g,
        "$1"
      )
      .replace(
        /<!--[\s\S]*?-->/g,
        ""
      )
      .replace(
        /<\?[\s\S]*?\?>/g,
        ""
      )
      .replace(
        /<br\s*\/?>/gi,
        "\n"
      )
      .replace(
        /<\/(?:p|paragraph|div|li|tr|section|text:p|text:h)>/gi,
        "\n"
      )
      .replace(
        /<text:tab\b[^>]*\/?>/gi,
        " "
      )
      .replace(
        /<text:line-break\b[^>]*\/?>/gi,
        "\n"
      )
      .replace(
        /<[^>]+>/g,
        ""
      )
  )
    .replace(/\r/g, "")
    .split("\n")
    .map((line) =>
      line
        .replace(/[ \t]+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractLegalOpenDocumentText(
  bytes: Buffer,
  format: LegalOpenDocumentFormat
) {
  const label =
    FORMAT_LABELS[format];

  if (!bytes.length) {
    throw new Error(
      `${label} dosyası boş.`
    );
  }

  if (
    bytes.length >
    MAX_ARCHIVE_SIZE
  ) {
    throw new Error(
      `${label} dosyası 20 MB sınırını aşıyor.`
    );
  }

  let zip: JSZip;

  try {
    zip =
      await JSZip.loadAsync(
        bytes
      );
  } catch {
    throw new Error(
      `${label} arşivi açılamadı.`
    );
  }

  const contentEntry =
    Object.values(
      zip.files
    ).find((entry) => {
      if (entry.dir) {
        return false;
      }

      const normalized =
        entry.name
          .replace(/\\/g, "/")
          .toLocaleLowerCase(
            "tr-TR"
          );

      return (
        normalized ===
          "content.xml" ||
        normalized.endsWith(
          "/content.xml"
        )
      );
    });

  if (!contentEntry) {
    throw new Error(
      `${label} içinde content.xml bulunamadı.`
    );
  }

  const xml =
    await contentEntry.async(
      "string"
    );

  if (
    xml.length >
    MAX_CONTENT_XML_LENGTH
  ) {
    throw new Error(
      `${label} belge içeriği güvenli sınırı aşıyor.`
    );
  }

  const text =
    normalizeUdfContentXml(
      xml
    );

  if (text.length < 30) {
    throw new Error(
      `${label} belge metni okunamadı.`
    );
  }

  return {
    text,
    engine:
      `${format}_content_xml`,
  };
}

export async function extractLegalUdfText(
  bytes: Buffer
) {
  return extractLegalOpenDocumentText(
    bytes,
    "udf"
  );
}
