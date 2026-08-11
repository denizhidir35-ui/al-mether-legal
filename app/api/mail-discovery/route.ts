import {
  resolveCname,
  resolveMx,
  resolveSrv,
} from "node:dns/promises";

import {
  NextResponse,
} from "next/server";

import {
  MailServerCandidate,
  normalizeEmailAddress,
  normalizeMailHostname,
  uniqueCandidates,
} from "@/lib/mail/discovery";

export const runtime =
  "nodejs";

type SrvRecord = Awaited<
  ReturnType<typeof resolveSrv>
>[number];

async function emptyOnDnsError<T>(
  query: Promise<T[]>
) {
  try {
    return await query;
  } catch {
    return [];
  }
}

function sortedSrvCandidates(
  records: SrvRecord[],
  port: number,
  secure: boolean,
  starttls: boolean
) {
  return records
    .filter(
      (record) =>
        record.port === port
    )
    .sort(
      (left, right) =>
        left.priority -
          right.priority ||
        right.weight -
          left.weight
    )
    .map(
      (record) => ({
        host:
          normalizeMailHostname(
            record.name
          ),
        port,
        secure,
        starttls,
      })
    )
    .filter(
      (
        candidate
      ): candidate is MailServerCandidate =>
        Boolean(candidate.host)
    );
}

function fallbackCandidates(
  domain: string,
  protocol: "imap" | "smtp",
  mxHosts: string[]
) {
  const specs =
    protocol === "imap"
      ? [
          ["imap", 993, true, false],
          ["mail", 993, true, false],
          ["imap", 143, false, true],
          ["mail", 143, false, true],
        ] as const
      : [
          ["smtp", 465, true, false],
          ["mail", 465, true, false],
          ["smtp", 587, false, true],
          ["mail", 587, false, true],
        ] as const;

  const candidates = specs.map(
    ([
      prefix,
      port,
      secure,
      starttls,
    ]) => ({
      host: `${prefix}.${domain}`,
      port,
      secure,
      starttls,
    })
  );

  const usesHostinger =
    mxHosts.some(
      (host) =>
        host === "mx1.hostinger.com" ||
        host === "mx2.hostinger.com"
    );

  if (!usesHostinger) {
    return candidates;
  }

  return [
    ...candidates,
    ...(protocol === "imap"
      ? [
          {
            host:
              "imap.hostinger.com",
            port: 993,
            secure: true,
            starttls: false,
          },
        ]
      : [
          {
            host:
              "smtp.hostinger.com",
            port: 465,
            secure: true,
            starttls: false,
          },
          {
            host:
              "smtp.hostinger.com",
            port: 587,
            secure: false,
            starttls: true,
          },
        ]),
  ];
}

function discoveryResponse(
  provider:
    | "google"
    | "microsoft"
    | "imap"
    | "unknown",
  body: Record<string, unknown>,
  status = 200
) {
  console.info(
    `MAIL DISCOVERY: ${provider}`
  );

  return NextResponse.json(
    {
      ok: provider !== "unknown",
      provider,
      ...body,
    },
    {
      status,
    }
  );
}

export async function POST(
  request: Request
) {
  let body: Record<
    string,
    unknown
  >;

  try {
    body = await request.json();
  } catch {
    return discoveryResponse(
      "unknown",
      {
        error:
          "Geçerli bir e-posta adresi girin.",
      },
      400
    );
  }

  const parsed =
    normalizeEmailAddress(
      body.email
    );

  if (!parsed) {
    return discoveryResponse(
      "unknown",
      {
        error:
          "Geçerli bir e-posta adresi girin.",
      },
      400
    );
  }

  const {
    email,
    domain,
  } = parsed;

  const [
    mx,
    imaps,
    imap,
    submissions,
    submission,
    autodiscover,
  ] = await Promise.all([
    emptyOnDnsError(
      resolveMx(domain)
    ),
    emptyOnDnsError(
      resolveSrv(
        `_imaps._tcp.${domain}`
      )
    ),
    emptyOnDnsError(
      resolveSrv(
        `_imap._tcp.${domain}`
      )
    ),
    emptyOnDnsError(
      resolveSrv(
        `_submissions._tcp.${domain}`
      )
    ),
    emptyOnDnsError(
      resolveSrv(
        `_submission._tcp.${domain}`
      )
    ),
    emptyOnDnsError(
      resolveCname(
        `autodiscover.${domain}`
      )
    ),
  ]);

  const mxHosts = mx
    .map(
      (record) =>
        normalizeMailHostname(
          record.exchange
        )
    )
    .filter(Boolean);

  const cnameHosts =
    autodiscover
      .map(normalizeMailHostname)
      .filter(Boolean);

  const google =
    mxHosts.some(
      (host) =>
        host ===
          "smtp.google.com" ||
        host ===
          "aspmx.l.google.com" ||
        host.endsWith(
          ".aspmx.l.google.com"
        )
    );

  if (google) {
    return discoveryResponse(
      "google",
      {
        action: "oauth",
        email,
      }
    );
  }

  const microsoft =
    mxHosts.some(
      (host) =>
        host.endsWith(
          ".mail.protection.outlook.com"
        )
    ) ||
    cnameHosts.includes(
      "autodiscover.outlook.com"
    );

  if (microsoft) {
    return discoveryResponse(
      "microsoft",
      {
        action: "oauth",
        email,
      }
    );
  }

  const imapFromSrv = [
    ...sortedSrvCandidates(
      imaps,
      993,
      true,
      false
    ),
    ...sortedSrvCandidates(
      imap,
      143,
      false,
      true
    ),
  ];

  const smtpFromSrv = [
    ...sortedSrvCandidates(
      submissions,
      465,
      true,
      false
    ),
    ...sortedSrvCandidates(
      submission,
      587,
      false,
      true
    ),
  ];

  const imapCandidates =
    uniqueCandidates(
      imapFromSrv.length > 0
        ? imapFromSrv
        : fallbackCandidates(
            domain,
            "imap",
            mxHosts
          )
    );

  const smtpCandidates =
    uniqueCandidates(
      smtpFromSrv.length > 0
        ? smtpFromSrv
        : fallbackCandidates(
            domain,
            "smtp",
            mxHosts
          )
    );

  if (
    imapCandidates.length === 0 ||
    smtpCandidates.length === 0
  ) {
    return discoveryResponse(
      "unknown",
      {
        email,
        error:
          "Sunucu ayarları otomatik bulunamadı.",
      }
    );
  }

  return discoveryResponse(
    "imap",
    {
      action: "credentials",
      email,
      imapCandidates,
      smtpCandidates,
    }
  );
}
