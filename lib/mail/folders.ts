export type MailFolder =
  | "inbox"
  | "sent"
  | "drafts"
  | "trash";

export function parseMailFolder(
  value: unknown
): MailFolder {
  const normalized =
    String(value || "")
      .trim()
      .toLowerCase();

  if (normalized === "sent") {
    return "sent";
  }

  if (normalized === "drafts") {
    return "drafts";
  }

  if (normalized === "trash") {
    return "trash";
  }

  return "inbox";
}

export function googleLabelForFolder(
  folder: MailFolder
) {
  switch (folder) {
    case "sent":
      return "SENT";

    case "drafts":
      return "DRAFT";

    case "trash":
      return "TRASH";

    default:
      return "INBOX";
  }
}

export function microsoftFolderForFolder(
  folder: MailFolder
) {
  switch (folder) {
    case "sent":
      return "sentitems";

    case "drafts":
      return "drafts";

    case "trash":
      return "deleteditems";

    default:
      return "inbox";
  }
}

function normalize(
  value: unknown
) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

function leafName(
  value: unknown
) {
  const normalized =
    normalize(value);

  const parts =
    normalized
      .split(/[\/\\.]+/)
      .filter(Boolean);

  return (
    parts[
      parts.length - 1
    ] || normalized
  );
}

function specialUseValue(
  item: any
) {
  if (
    Array.isArray(
      item?.specialUse
    )
  ) {
    return item.specialUse
      .map(normalize);
  }

  if (item?.specialUse) {
    return [
      normalize(
        item.specialUse
      ),
    ];
  }

  return [];
}

export async function resolveImapMailbox(
  client: any,
  folder: MailFolder
) {
  if (folder === "inbox") {
    return "INBOX";
  }

  const mailboxes =
    await client.list();

  const wantedSpecial =
    folder === "sent"
      ? "\\sent"
      : folder === "drafts"
        ? "\\drafts"
        : "\\trash";

  const bySpecial =
    mailboxes.find(
      (item: any) =>
        specialUseValue(
          item
        ).includes(
          wantedSpecial
        )
    );

  if (bySpecial?.path) {
    return bySpecial.path;
  }

  const names =
    folder === "sent"
      ? [
          "sent",
          "sent items",
          "sent messages",
          "sent mail",
          "gönderilen",
          "gönderilmiş",
          "gönderilmiş öğeler",
        ]
      : folder === "drafts"
        ? [
            "draft",
            "drafts",
            "taslak",
            "taslaklar",
          ]
        : [
            "trash",
            "bin",
            "deleted",
            "deleted items",
            "deleted messages",
            "çöp",
            "çöp kutusu",
            "silinmiş öğeler",
          ];

  const byName =
    mailboxes.find(
      (item: any) => {
        const path =
          normalize(
            item?.path
          );

        const name =
          normalize(
            item?.name
          );

        const leaf =
          leafName(
            item?.path
          );

        return names.some(
          (wanted) =>
            path === wanted ||
            name === wanted ||
            leaf === wanted ||
            path.endsWith(
              `/${wanted}`
            ) ||
            path.endsWith(
              `.${wanted}`
            )
        );
      }
    );

  if (byName?.path) {
    return byName.path;
  }

  throw new Error(
    folder === "sent"
      ? "Gönderilen klasörü bulunamadı."
      : folder === "drafts"
        ? "Taslaklar klasörü bulunamadı."
        : "Çöp klasörü bulunamadı."
  );
}