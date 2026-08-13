import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
} from "node:crypto";

import { google } from "googleapis";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

import {
  GMAIL_LEGAL_QUERY,
  isLegalMail,
} from "@/lib/mail/legalMailFilter";

import {
  createMailReceivedDedupeKey,
  createMailReceivedEventTitle,
  resolveProviderReceivedAt,
} from "@/lib/mail/receivedDate";

type GmailAttachment = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
};

function stableUuid(
  ...values: string[]
) {
  const hex =
    createHash("sha256")
      .update(
        values.join("\u0000")
      )
      .digest("hex");

  const variant =
    (
      parseInt(hex[16], 16) &
      0x3 |
      0x8
    ).toString(16);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

async function ensureMailReceivedRecord(
  input: {
    supabase: ReturnType<
      typeof getSupabaseAdmin
    >;
    userId: string;
    caseId: string;
    messageId: string;
    subject: string;
    sender: string;
    court: string;
    receivedAt: string;
    accountId: string;
    accountEmail: string;
    provider: string;
  }
) {
  if (
    !input.caseId ||
    !input.messageId ||
    !input.receivedAt
  ) {
    return {
      created: false,
      duplicate: false,
    };
  }

  const mailUpdate =
    await input.supabase
      .from("case_mails")
      .update({
        received_at:
          input.receivedAt,
      })
      .eq(
        "user_id",
        input.userId
      )
      .eq(
        "case_id",
        input.caseId
      )
      .eq(
        "gmail_message_id",
        input.messageId
      );

  if (mailUpdate.error) {
    throw new Error(
      mailUpdate.error.message
    );
  }

  const dedupeKey =
    createMailReceivedDedupeKey(
      input.accountId,
      input.provider,
      input.messageId
    );

  const existing =
    await input.supabase
      .from("calendar_events")
      .select("id")
      .eq(
        "user_id",
        input.userId
      )
      .eq(
        "event_type",
        "mail_received"
      )
      .eq(
        "source_mail_id",
        dedupeKey
      )
      .maybeSingle();

  if (existing.error) {
    throw new Error(
      existing.error.message
    );
  }

  if (existing.data) {
    return {
      created: false,
      duplicate: true,
    };
  }

  const title =
    createMailReceivedEventTitle(
      input.court,
      input.subject
    );

  const inserted =
    await input.supabase
      .from("calendar_events")
      .insert({
        id: stableUuid(
          input.userId,
          dedupeKey,
          "mail-received-event"
        ),
        user_id: input.userId,
        case_id: input.caseId,
        title,
        description: [
          input.sender
            ? `Gönderen: ${input.sender}`
            : "",
          input.subject
            ? `Konu: ${input.subject}`
            : "",
          input.accountEmail
            ? `Hesap: ${input.accountEmail}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        event_type:
          "mail_received",
        start_date:
          input.receivedAt
            .slice(0, 10),
        end_date:
          input.receivedAt
            .slice(0, 10),
        due_date:
          input.receivedAt
            .slice(0, 10),
        status: "active",
        priority: "normal",
        source: "mail",
        source_mail_id:
          dedupeKey,
        raw: {
          informational: true,
          eventType:
            "mail_received",
          providerMessageId:
            input.messageId,
          receivedAt:
            input.receivedAt,
          sender: input.sender,
          subject: input.subject,
          sourceAccount: {
            accountId:
              input.accountId,
            emailAddress:
              input.accountEmail,
            provider:
              input.provider,
          },
        },
      });

  if (
    inserted.error &&
    inserted.error.code !==
      "23505"
  ) {
    throw new Error(
      inserted.error.message
    );
  }

  return {
    created:
      !inserted.error,
    duplicate:
      inserted.error?.code ===
      "23505",
  };
}

function decodeBase64Url(
  data: string
) {
  return Buffer.from(
    data
      .replace(/-/g, "+")
      .replace(/_/g, "/"),
    "base64"
  ).toString("utf-8");
}

function cleanHtml(
  input: string
) {
  return input
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      ""
    )
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      ""
    )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getBody(
  payload: any
): string {
  if (!payload) {
    return "";
  }

  if (payload.body?.data) {
    const decoded =
      decodeBase64Url(
        payload.body.data
      );

    if (
      payload.mimeType ===
      "text/html"
    ) {
      return cleanHtml(decoded);
    }

    return decoded
      .replace(/\s+/g, " ")
      .trim();
  }

  if (
    Array.isArray(
      payload.parts
    )
  ) {
    const plain =
      payload.parts.find(
        (part: any) =>
          part.mimeType ===
          "text/plain"
      );

    if (plain) {
      const text =
        getBody(plain);

      if (text) {
        return text;
      }
    }

    for (
      const part
      of payload.parts
    ) {
      const text =
        getBody(part);

      if (text) {
        return text;
      }
    }
  }

  return "";
}

function collectAttachments(
  payload: any
): GmailAttachment[] {
  const result:
    GmailAttachment[] = [];

  function walk(
    part: any
  ) {
    if (!part) {
      return;
    }

    const filename =
      part.filename || "";

    const attachmentId =
      part.body
        ?.attachmentId ||
      "";

    if (
      filename &&
      attachmentId
    ) {
      result.push({
        filename,

        mimeType:
          part.mimeType ||
          "application/octet-stream",

        size:
          Number(
            part.body?.size ||
            0
          ),

        attachmentId,
      });
    }

    if (
      Array.isArray(
        part.parts
      )
    ) {
      for (
        const child
        of part.parts
      ) {
        walk(child);
      }
    }
  }

  walk(payload);

  return result;
}

export async function POST(
  request: NextRequest
) {
  try {
    const {
      appUser,
      error: userError,
    } =
      await getOrCreateAppUser();

    if (
      userError ||
      !appUser
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            userError ||
            "Kullanıcı bulunamadı.",
        },
        {
          status: 401,
        }
      );
    }

    const supabase =
      getSupabaseAdmin();

    const body =
      await request.json()
        .catch(
          () => null
        );

    const connectionId =
      typeof body
        ?.connectionId ===
        "string"
        ? body.connectionId
            .trim()
        : "";

    if (!connectionId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Google posta hesabı seçilmedi.",
        },
        {
          status: 400,
        }
      );
    }

    const connection =
      await supabase
        .from(
          "mail_connections"
        )
        .select("*")
        .eq(
          "id",
          connectionId
        )
        .eq(
          "user_id",
          appUser.id
        )
        .eq(
          "provider",
          "google"
        )
        .eq(
          "status",
          "connected"
        )
        .maybeSingle();

    if (
      connection.error
    ) {
      throw new Error(
        connection.error.message
      );
    }

    if (
      !connection.data
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Google hesabı bağlı değil.",
        },
        {
          status: 401,
        }
      );
    }

    const oauth2Client =
      new google.auth.OAuth2(
        process.env
          .GOOGLE_CLIENT_ID,
        process.env
          .GOOGLE_CLIENT_SECRET
      );

    oauth2Client.setCredentials({
      access_token:
        connection.data
          .access_token ||
        undefined,

      refresh_token:
        connection.data
          .refresh_token ||
        undefined,

      expiry_date:
        connection.data
          .token_expires_at
          ? new Date(
              connection.data
                .token_expires_at
            ).getTime()
          : undefined,
    });

    const gmail =
      google.gmail({
        version: "v1",
        auth: oauth2Client,
      });

    const messages =
      await gmail.users
        .messages.list({
          userId: "me",
          maxResults: 50,
          labelIds: [
            "INBOX",
          ],
          q:
            GMAIL_LEGAL_QUERY,
        });

    const ids =
      (
        messages.data
          .messages || []
      )
        .map(
          (message) =>
            message.id
        )
        .filter(
          (
            value
          ): value is string =>
            Boolean(value)
        );

    if (
      ids.length === 0
    ) {
      return NextResponse.json({
        ok: true,
        scanned: 0,
        new: 0,
        processed: 0,
      });
    }

    const existing =
      await supabase
        .from("case_mails")
        .select(
          "gmail_message_id"
        )
        .eq(
          "user_id",
          appUser.id
        )
        .in(
          "gmail_message_id",
          ids
        );

    if (
      existing.error
    ) {
      throw new Error(
        existing.error.message
      );
    }

    const existingIds =
      new Set(
        (
          existing.data || []
        )
          .map(
            (row: any) =>
              row.gmail_message_id
          )
          .filter(Boolean)
      );

    const newIds =
      ids.filter(
        (id) =>
          !existingIds.has(id)
      );

    let processed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (
      const messageId
      of newIds
    ) {
      try {
        const detail =
          await gmail.users
            .messages.get({
              userId: "me",
              id: messageId,
              format: "full",
            });

        const headers =
          detail.data
            .payload
            ?.headers ||
          [];

        const subject =
          headers.find(
            (header) =>
              header.name
                ?.toLowerCase() ===
              "subject"
          )?.value || "";

        const sender =
          headers.find(
            (header) =>
              header.name
                ?.toLowerCase() ===
              "from"
          )?.value || "";

        const date =
          headers.find(
            (header) =>
              header.name
                ?.toLowerCase() ===
              "date"
          )?.value || "";

        const providerReceivedAt =
          resolveProviderReceivedAt({
            provider: "google",
            internalDate:
              detail.data
                .internalDate,
            headerDate: date,
          });

        if (!providerReceivedAt) {
          errors.push(
            `${messageId}: Provider geliş tarihi okunamadı.`
          );
          continue;
        }

        const body =
          getBody(
            detail.data.payload
          ) ||
          detail.data
            .snippet ||
          "";

        if (
          !isLegalMail({
            subject,
            sender,
            snippet:
              detail.data
                .snippet ||
              "",
            body,
          })
        ) {
          skipped++;
          continue;
        }

        const attachments =
          collectAttachments(
            detail.data.payload
          );

        const aiUrl =
          new URL(
            "/api/ai",
            request.url
          );

        const aiResponse =
          await fetch(
            aiUrl,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",

                cookie:
                  request.headers
                    .get(
                      "cookie"
                    ) || "",
              },
              body:
                JSON.stringify({
                  subject,
                  sender,
                  date:
                    providerReceivedAt,
                  body,
                  messageId,
                }),
            }
          );

        const aiData =
          await aiResponse
            .json();

        if (
          !aiResponse.ok ||
          !aiData?.ok
        ) {
          errors.push(
            `${messageId}: ${
              aiData?.error ||
              "AI analiz başarısız."
            }`
          );

          continue;
        }

        const analysis =
          aiData.analysis ||
          aiData.data
            ?.analysis ||
          {};

        const uets =
          aiData
            .uetsExtraction ||
          aiData.data
            ?.uetsExtraction ||
          {};

        const isUetsDeemedService =
          Boolean(
            uets.found &&
            uets.deemedServiceDate
          );

        const finalDate =
          isUetsDeemedService
            ? String(
                uets.deemedServiceDate
              )
            : "";

        /*
         * LEGAL SAFETY:
         *
         * AI'nin tek başına çıkardığı sonTarih
         * doğrulanmış hukuki süre değildir.
         *
         * UETS için yalnızca kanuni
         * "tebliğ edilmiş sayılma tarihi"
         * otomatik takvime aktarılır.
         *
         * Duruşma / kesin süre / son gün gibi
         * diğer tarihler ayrıca doğrulanmadan
         * deadline olarak kaydedilmez.
         */
        if (!finalDate) {
          skipped++;
          continue;
        }

        const saveUrl =
          new URL(
            "/api/cases/from-analysis",
            request.url
          );

        const saveResponse =
          await fetch(
            saveUrl,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",

                cookie:
                  request.headers
                    .get(
                      "cookie"
                    ) || "",
              },

              body:
                JSON.stringify({
                  gmail_message_id:
                    messageId,

                  subject,
                  sender,

                  received_at:
                    providerReceivedAt,

                  mail_body:
                    body,

                  snippet:
                    detail.data
                      .snippet ||
                    "",

                  dava_turu:
                    analysis.davaTuru ||
                    "",

                  risk:
                    analysis.risk ||
                    "",

                  son_tarih:
                    finalDate,

                  mahkeme:
                    analysis.mahkeme ||
                    uets.court ||
                    "",

                  dosya_no:
                    analysis.dosyaNo ||
                    uets.fileNo ||
                    "",

                  institution:
                    analysis.kurum ||
                    uets.institution ||
                    "",

                  ai_summary:
                    analysis.ozet ||
                    "",

                  confidence:
                    analysis.confidence ||
                    uets.confidence ||
                    0,

                  arrival_date:
                    uets.arrivalDate ||
                    "",

                  arrival_time:
                    uets.arrivalTime ||
                    "",

                  barcode_no:
                    uets.barcodeNo ||
                    "",

                  record_mode:
                    "deemed_service",

                  deadline_verified:
                    false,

                  attachments,
                }),
            }
          );

        const saveData =
          await saveResponse
            .json();

        if (
          !saveResponse.ok ||
          !saveData?.ok
        ) {
          errors.push(
            `${messageId}: ${
              saveData?.error ||
              "Dava kaydı başarısız."
            }`
          );

          continue;
        }

        // MAIL ATTACHMENT UPLOAD
        const resolvedCaseId =
          saveData?.case?.id ||
          saveData?.calendarEvent?.case_id ||
          "";

        if (resolvedCaseId) {
          await ensureMailReceivedRecord({
            supabase,
            userId:
              appUser.id,
            caseId:
              resolvedCaseId,
            messageId,
            subject,
            sender,
            court:
              analysis.mahkeme ||
              uets.court ||
              "",
            receivedAt:
              providerReceivedAt,
            accountId:
              connection.data.id,
            accountEmail:
              connection.data
                .email || "",
            provider:
              connection.data
                .provider ||
              "google",
          });
        }

        if (
          resolvedCaseId &&
          attachments.length > 0
        ) {
          for (
            const attachment
            of attachments
          ) {
            try {
              const gmailAttachment =
                await gmail.users.messages.attachments.get({
                  userId: "me",
                  messageId,
                  id:
                    attachment.attachmentId,
                });

              const encodedData =
                gmailAttachment.data.data ||
                "";

              if (!encodedData) {
                errors.push(
                  `${messageId}/${attachment.filename}: Gmail ek verisi boş.`
                );

                continue;
              }

              const fileBuffer =
                Buffer.from(
                  encodedData
                    .replace(/-/g, "+")
                    .replace(/_/g, "/"),
                  "base64"
                );

              if (
                fileBuffer.length >
                20 * 1024 * 1024
              ) {
                errors.push(
                  `${messageId}/${attachment.filename}: 20 MB sınırını aşıyor.`
                );

                continue;
              }

              const uploadForm =
                new FormData();

              uploadForm.append(
                "caseId",
                resolvedCaseId
              );

              uploadForm.append(
                "source",
                "mail"
              );

              const blob =
                new Blob(
                  [fileBuffer],
                  {
                    type:
                      attachment.mimeType ||
                      "application/octet-stream",
                  }
                );

              uploadForm.append(
                "file",
                blob,
                attachment.filename
              );

              const uploadUrl =
                new URL(
                  "/api/attachments",
                  request.url
                );

              const uploadResponse =
                await fetch(
                  uploadUrl,
                  {
                    method: "POST",

                    headers: {
                      cookie:
                        request.headers.get(
                          "cookie"
                        ) || "",
                    },

                    body:
                      uploadForm,
                  }
                );

              const uploadData =
                await uploadResponse.json();

              if (
                !uploadResponse.ok ||
                !uploadData?.ok
              ) {
                errors.push(
                  `${messageId}/${attachment.filename}: ${
                    uploadData?.error ||
                    "Evrak yüklenemedi."
                  }`
                );
              }
            } catch (
              attachmentError
            ) {
              errors.push(
                `${messageId}/${attachment.filename}: ${
                  attachmentError instanceof Error
                    ? attachmentError.message
                    : "Evrak indirilemedi."
                }`
              );
            }
          }
        }

        processed++;
      } catch (error) {
        errors.push(
          `${messageId}: ${
            error instanceof Error
              ? error.message
              : "Bilinmeyen hata"
          }`
        );
      }
    }

    return NextResponse.json({
      ok: true,
      scanned:
        ids.length,
      new:
        newIds.length,
      processed,
      skipped,
      errors,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Mail sync başarısız.",
      },
      {
        status: 500,
      }
    );
  }
}

