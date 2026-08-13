import {
  Readable,
} from "node:stream";

import nodemailer
  from "nodemailer";

export type OutgoingAttachment = {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
};

export type OutgoingMessage = {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  messageId?: string;
  attachments: OutgoingAttachment[];
};

async function messageToBuffer(
  value: Buffer | Readable
): Promise<Buffer> {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of value) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk)
    );
  }

  return Buffer.concat(chunks);
}

export function nodemailerOptions(
  message: OutgoingMessage
) {
  return {
    from: message.from,
    to: message.to.join(", "),
    cc:
      message.cc.length
        ? message.cc.join(", ")
        : undefined,
    bcc:
      message.bcc.length
        ? message.bcc.join(", ")
        : undefined,
    subject: message.subject,
    text: message.text,
    messageId:
      message.messageId,
    attachments:
      message.attachments.map(
        (attachment) => ({
          filename:
            attachment.filename,
          contentType:
            attachment.contentType,
          content:
            attachment.content,
        })
      ),
  };
}

export async function buildMimeMessage(
  message: OutgoingMessage
) {
  const builder =
    nodemailer
      .createTransport({
        streamTransport:
          true,
        buffer: true,
        newline: "unix",
      });

  const rendered =
    await builder.sendMail(
      nodemailerOptions(
        message
      )
    );

  return messageToBuffer(
    rendered.message
  );
}
