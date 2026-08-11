import {
  ImapFlow,
} from "imapflow";

import nodemailer
  from "nodemailer";

import {
  NextResponse,
} from "next/server";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

import {
  encryptMailSecret,
} from "@/lib/mail/credentialCrypto";

import {
  MailProtocol,
  MailServerCandidate,
  assertPublicMailHostname,
  normalizeEmailAddress,
  normalizeMailCandidate,
  uniqueCandidates,
} from "@/lib/mail/discovery";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

export const runtime =
  "nodejs";

const TEST_TIMEOUT =
  10000;

type ImapResultCode =
  | "AUTH_FAILED"
  | "TLS_FAILED"
  | "TIMEOUT"
  | "CONNECTION_REFUSED";

type ImapErrorShape = {
  code?: unknown;
  message?: unknown;
  authenticationFailed?: unknown;
  serverResponseCode?: unknown;
  tlsFailed?: unknown;
};

function classifyImapError(
  error: unknown
): ImapResultCode {
  const details =
    error &&
    typeof error === "object"
      ? error as ImapErrorShape
      : {};

  const code =
    typeof details.code === "string"
      ? details.code.toUpperCase()
      : "";

  const message =
    typeof details.message === "string"
      ? details.message.toLowerCase()
      : "";

  const serverResponseCode =
    typeof details
      .serverResponseCode === "string"
      ? details
          .serverResponseCode
          .toUpperCase()
      : "";

  if (
    details.authenticationFailed ===
      true ||
    serverResponseCode ===
      "AUTHENTICATIONFAILED"
  ) {
    return "AUTH_FAILED";
  }

  if (
    [
      "CONNECT_TIMEOUT",
      "ETIMEDOUT",
      "ETIMEOUT",
      "GREETING_TIMEOUT",
      "UPGRADE_TIMEOUT",
    ].includes(code) ||
    message.includes("timed out")
  ) {
    return "TIMEOUT";
  }

  if (
    [
      "ECONNREFUSED",
      "ENOTFOUND",
      "ENODATA",
      "EAI_AGAIN",
      "EAI_FAIL",
      "EHOSTUNREACH",
      "ENETUNREACH",
    ].includes(code)
  ) {
    return "CONNECTION_REFUSED";
  }

  if (
    details.tlsFailed === true ||
    code.startsWith("ERR_TLS") ||
    code.startsWith("ERR_SSL") ||
    code.startsWith("CERT_") ||
    code.startsWith("DEPTH_") ||
    code === "STARTTLS_INJECTION" ||
    message.includes("certificate") ||
    message.includes("starttls") ||
    message.includes("tls") ||
    message.includes("ssl")
  ) {
    return "TLS_FAILED";
  }

  return "TLS_FAILED";
}

function cleanSecret(
  value: unknown
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function candidateList(
  body: Record<string, unknown>,
  protocol: MailProtocol
) {
  const discovery =
    body.discovery &&
    typeof body.discovery ===
      "object"
      ? body.discovery as Record<
          string,
          unknown
        >
      : {};

  const key =
    protocol === "imap"
      ? "imapCandidates"
      : "smtpCandidates";

  const received =
    Array.isArray(body[key])
      ? body[key]
      : Array.isArray(
            discovery[key]
          )
        ? discovery[key]
        : [];

  const normalized = received
    .slice(0, 8)
    .map(
      (candidate) =>
        normalizeMailCandidate(
          candidate,
          protocol
        )
    )
    .filter(
      (
        candidate
      ): candidate is MailServerCandidate =>
        Boolean(candidate)
    );

  if (normalized.length > 0) {
    return uniqueCandidates(
      normalized
    );
  }

  const hostKey =
    protocol === "imap"
      ? "imapHost"
      : "smtpHost";

  const portKey =
    protocol === "imap"
      ? "imapPort"
      : "smtpPort";

  const secureKey =
    protocol === "imap"
      ? "imapSecure"
      : "smtpSecure";

  const secure =
    body[secureKey] === true;

  const manual =
    normalizeMailCandidate(
      {
        host: body[hostKey],
        port: body[portKey],
        secure,
        starttls: !secure,
      },
      protocol
    );

  return manual
    ? [manual]
    : [];
}

async function testImapCandidates(
  candidates: MailServerCandidate[],
  email: string,
  password: string
) {
  for (const candidate of candidates) {
    let client:
      ImapFlow |
      null = null;

    console.info(
      `IMAP TRY: ${candidate.host}:${candidate.port} secure=${candidate.secure} starttls=${candidate.starttls}`
    );

    try {
      const host =
        await assertPublicMailHostname(
          candidate.host
        );

      client = new ImapFlow({
        host,
        port: candidate.port,
        secure: candidate.secure,
        doSTARTTLS:
          candidate.starttls,
        auth: {
          user: email,
          pass: password,
        },
        connectionTimeout:
          TEST_TIMEOUT,
        greetingTimeout:
          TEST_TIMEOUT,
        socketTimeout:
          12000,
        logger: false,
      });

      await client.connect();
      await client.logout();
      client = null;

      console.info(
        "IMAP RESULT: PASS"
      );

      return {
        candidate: {
          ...candidate,
          host,
        },
        authFailed: false,
      };
    } catch (error: unknown) {
      const resultCode =
        classifyImapError(error);

      console.info(
        `IMAP RESULT: ${resultCode}`
      );

      try {
        client?.close();
      } catch {}

      if (
        resultCode === "AUTH_FAILED"
      ) {
        return {
          candidate: null,
          authFailed: true,
        };
      }
    }
  }

  return {
    candidate: null,
    authFailed: false,
  };
}

async function testSmtpCandidates(
  candidates: MailServerCandidate[],
  email: string,
  password: string
) {
  for (const candidate of candidates) {
    let transport:
      ReturnType<
        typeof nodemailer.createTransport
      > |
      null = null;

    try {
      const host =
        await assertPublicMailHostname(
          candidate.host
        );

      transport =
        nodemailer.createTransport({
          host,
          port: candidate.port,
          secure: candidate.secure,
          requireTLS:
            candidate.starttls,
          auth: {
            user: email,
            pass: password,
          },
          connectionTimeout:
            TEST_TIMEOUT,
          greetingTimeout:
            TEST_TIMEOUT,
          socketTimeout:
            12000,
        });

      await transport.verify();
      transport.close();
      transport = null;

      return {
        ...candidate,
        host,
      };
    } catch {
      transport?.close();
    }
  }

  return null;
}

export async function POST(
  request: Request
) {
  const {
    appUser,
    error,
  } = await getOrCreateAppUser();

  if (
    error ||
    !appUser
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error ||
          "Oturum bulunamadı.",
      },
      {
        status: 401,
      }
    );
  }

  let body: Record<
    string,
    unknown
  >;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Bağlantı bilgileri geçersiz.",
      },
      {
        status: 400,
      }
    );
  }

  const parsedEmail =
    normalizeEmailAddress(
      body.email
    );

  const password =
    cleanSecret(body.password);

  const imapCandidates =
    candidateList(
      body,
      "imap"
    );

  const smtpCandidates =
    candidateList(
      body,
      "smtp"
    );

  if (
    !parsedEmail ||
    !password ||
    imapCandidates.length === 0 ||
    smtpCandidates.length === 0
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "E-posta, parola ve geçerli mail sunucusu bilgileri zorunludur.",
      },
      {
        status: 400,
      }
    );
  }

  const email =
    parsedEmail.email;

  const imapResult =
    await testImapCandidates(
      imapCandidates,
      email,
      password
    );

  if (imapResult.authFailed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "E-posta adresi veya parola doğrulanamadı.",
      },
      {
        status: 422,
      }
    );
  }

  const imap =
    imapResult.candidate;

  if (!imap) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "IMAP sunucusuna güvenli bağlantı kurulamadı.",
      },
      {
        status: 422,
      }
    );
  }

  const smtp =
    await testSmtpCandidates(
      smtpCandidates,
      email,
      password
    );

  if (!smtp) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SMTP bağlantısı doğrulanamadı.",
      },
      {
        status: 422,
      }
    );
  }

  let secretEncrypted: string;

  try {
    secretEncrypted =
      encryptMailSecret(password);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Mail kimlik bilgisi güvenli biçimde saklanamadı.",
      },
      {
        status: 500,
      }
    );
  }

  const saved =
    await getSupabaseAdmin()
      .from("mail_connections")
      .upsert(
        {
          user_id: appUser.id,
          provider: "imap",
          email,
          status: "connected",
          access_token: null,
          refresh_token: null,
          token_expires_at:
            null,
          settings: {
            imapHost: imap.host,
            imapPort: imap.port,
            imapSecure:
              imap.secure,
            imapStarttls:
              imap.starttls,
            smtpHost: smtp.host,
            smtpPort: smtp.port,
            smtpSecure:
              smtp.secure,
            smtpStarttls:
              smtp.starttls,
          },
          secret_encrypted:
            secretEncrypted,
          updated_at:
            new Date()
              .toISOString(),
        },
        {
          onConflict:
            "user_id,provider",
        }
      )
      .select(
        "id,provider,email,status,updated_at"
      )
      .single();

  if (saved.error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Mail bağlantısı kaydedilemedi.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    ok: true,
    connection: saved.data,
  });
}
