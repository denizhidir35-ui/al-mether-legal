export const MAX_MAIL_ATTACHMENT_BYTES =
  25 * 1024 * 1024;

export const MAIL_ATTACHMENT_LIMIT_MESSAGE =
  "Eklerin toplam boyutu en fazla 25 MB olabilir.";

type SizedAttachment = {
  size: number;
};

export function attachmentTotalSize(
  attachments: SizedAttachment[]
) {
  return attachments.reduce(
    (total, attachment) =>
      total +
      Math.max(
        0,
        Number(
          attachment.size
        ) || 0
      ),
    0
  );
}

export function attachmentLimitError(
  attachments: SizedAttachment[]
) {
  return attachmentTotalSize(
    attachments
  ) > MAX_MAIL_ATTACHMENT_BYTES
    ? MAIL_ATTACHMENT_LIMIT_MESSAGE
    : "";
}

export function removeAttachmentAt<
  T
>(
  attachments: T[],
  index: number
) {
  return attachments.filter(
    (_, currentIndex) =>
      currentIndex !== index
  );
}
