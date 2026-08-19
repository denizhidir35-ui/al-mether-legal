import JSZip from "jszip";

const MAX_UDF_SIZE =
  20 * 1024 * 1024;

const MAX_CONTENT_XML_LENGTH =
  5_000_000;

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

export async function extractLegalUdfText(
  bytes: Buffer
) {
  if (!bytes.length) {
    throw new Error(
      "UDF dosyası boş."
    );
  }

  if (
    bytes.length >
    MAX_UDF_SIZE
  ) {
    throw new Error(
      "UDF dosyası 20 MB sınırını aşıyor."
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
      "UDF arşivi açılamadı."
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
      "UDF içinde content.xml bulunamadı."
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
      "UDF belge içeriği güvenli sınırı aşıyor."
    );
  }

  const text =
    normalizeUdfContentXml(
      xml
    );

  if (text.length < 30) {
    throw new Error(
      "UDF belge metni okunamadı."
    );
  }

  return {
    text,
    engine:
      "udf_content_xml",
  };
}
