import {
  NextRequest,
  NextResponse,
} from "next/server";

import { google } from "googleapis";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

type GmailAttachment = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
};

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

    const connection =
      await supabase
        .from(
          "mail_connections"
        )
        .select("*")
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

        const body =
          getBody(
            detail.data.payload
          ) ||
          detail.data
            .snippet ||
          "";

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
                  date,
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

        const finalDate =
          analysis.sonTarih ||
          uets.deemedServiceDate ||
          "";

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
                    date,

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
                    uets.found
                      ? "deemed_service"
                      : "verified_deadline",

                  deadline_verified:
                    true,

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

