import "server-only";

import {
  lookup,
} from "node:dns/promises";

import {
  BlockList,
  isIP,
} from "node:net";

import {
  domainToASCII,
} from "node:url";

export type MailProtocol =
  | "imap"
  | "smtp";

export type MailServerCandidate = {
  host: string;
  port: number;
  secure: boolean;
  starttls: boolean;
};

const blockedAddresses =
  new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedAddresses.addSubnet(
    network,
    prefix,
    "ipv4"
  );
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:2::", 48],
  ["2001:db8::", 32],
] as const) {
  blockedAddresses.addSubnet(
    network,
    prefix,
    "ipv6"
  );
}

const blockedSuffixes = [
  ".local",
  ".localhost",
  ".localdomain",
  ".internal",
  ".intranet",
  ".private",
  ".lan",
  ".home",
  ".corp",
  ".onion",
  ".test",
  ".invalid",
  ".example",
];

function isValidHostname(
  hostname: string
) {
  if (
    hostname.length < 4 ||
    hostname.length > 253 ||
    !hostname.includes(".")
  ) {
    return false;
  }

  return hostname
    .split(".")
    .every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(
          label
        )
    );
}

export function normalizeMailHostname(
  value: unknown
) {
  if (typeof value !== "string") {
    return "";
  }

  const raw = value
    .trim()
    .replace(/\.+$/, "")
    .toLowerCase();

  if (!raw || isIP(raw)) {
    return "";
  }

  const hostname =
    domainToASCII(raw)
      .toLowerCase();

  if (
    !isValidHostname(hostname) ||
    hostname === "localhost" ||
    blockedSuffixes.some(
      (suffix) =>
        hostname.endsWith(
          suffix
        )
    )
  ) {
    return "";
  }

  return hostname;
}

export function normalizeEmailAddress(
  value: unknown
) {
  if (typeof value !== "string") {
    return null;
  }

  const email = value
    .trim()
    .toLowerCase();

  const separator =
    email.lastIndexOf("@");

  if (
    separator <= 0 ||
    separator !==
      email.indexOf("@") ||
    separator ===
      email.length - 1
  ) {
    return null;
  }

  const local =
    email.slice(0, separator);

  const domain =
    normalizeMailHostname(
      email.slice(separator + 1)
    );

  if (
    !domain ||
    local.length > 64 ||
    !/^[^\s<>]+$/.test(local)
  ) {
    return null;
  }

  return {
    email: `${local}@${domain}`,
    domain,
  };
}

function isPublicAddress(
  address: string,
  family: number
) {
  if (family === 4) {
    return !blockedAddresses.check(
      address,
      "ipv4"
    );
  }

  if (family === 6) {
    const mapped =
      address.match(
        /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i
      );

    if (mapped) {
      return !blockedAddresses.check(
        mapped[1],
        "ipv4"
      );
    }

    return !blockedAddresses.check(
      address,
      "ipv6"
    );
  }

  return false;
}

export async function assertPublicMailHostname(
  value: unknown
) {
  const hostname =
    normalizeMailHostname(value);

  if (!hostname) {
    throw new Error(
      "Geçersiz mail sunucusu."
    );
  }

  const addresses =
    await lookup(hostname, {
      all: true,
      verbatim: true,
    });

  if (
    addresses.length === 0 ||
    addresses.some(
      ({
        address,
        family,
      }) =>
        !isPublicAddress(
          address,
          family
        )
    )
  ) {
    throw new Error(
      "Mail sunucusu public bir adrese çözülmüyor."
    );
  }

  return hostname;
}

export function normalizeMailCandidate(
  value: unknown,
  protocol: MailProtocol
): MailServerCandidate | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const candidate =
    value as Record<
      string,
      unknown
    >;

  const host =
    normalizeMailHostname(
      candidate.host
    );

  const port =
    Number(candidate.port);

  const secure =
    candidate.secure === true;

  const starttls =
    candidate.starttls === true;

  const validTransport =
    protocol === "imap"
      ? (port === 993 &&
          secure &&
          !starttls) ||
        (port === 143 &&
          !secure &&
          starttls)
      : (port === 465 &&
          secure &&
          !starttls) ||
        (port === 587 &&
          !secure &&
          starttls);

  if (
    !host ||
    !validTransport
  ) {
    return null;
  }

  return {
    host,
    port,
    secure,
    starttls,
  };
}

export function uniqueCandidates(
  values: MailServerCandidate[]
) {
  const seen =
    new Set<string>();

  return values.filter(
    (candidate) => {
      const key = [
        candidate.host,
        candidate.port,
        candidate.secure,
        candidate.starttls,
      ].join(":");

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    }
  );
}
