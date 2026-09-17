/**
 * Seed URL admission, mirroring GeekCrawlerSeedNormalizer on the server.
 *
 * The server rejects the whole batch on the FIRST bad URL (ValidateRawSeeds returns
 * `Invalid seed URL: {raw}` and stops), so pasting twelve URLs with three problems means three
 * round trips to find them. This checks every line up front and reports each one.
 *
 * These rules are a copy of the server's and must stay a copy. Anything accepted here that the
 * server rejects is a lie told to the operator; anything rejected here that the server accepts is a
 * URL silently dropped. Source: GeekApplication/Models/GeekCrawler/GeekCrawlerSeedNormalizer.cs
 * (TryNormalizeSeedUrl, IsAllowedCrawlUri, StripListPrefix) and GeekCrawlerCaps.MaxSeedsPerRequest.
 */

export const MAX_SEEDS_PER_REQUEST = 25;

const ALLOWED_PORTS = new Set([80, 443]);

export type SeedCheck = {
  /** The line as typed, for showing the operator what to fix. */
  raw: string;
  /** Normalized URL when accepted; null when rejected. */
  url: string | null;
  /** Why it was rejected; null when accepted. */
  reason: string | null;
};

/** Mirrors StripListPrefix: bullets and "1. " numbering are tolerated, not rejected. */
function stripListPrefix(trimmed: string): string {
  if (/^[*\-+] /.test(trimmed)) return trimmed.slice(2).trimStart();
  const m = /^(\d+)\. /.exec(trimmed);
  return m ? trimmed.slice(m[0].length).trimStart() : trimmed;
}

/** Mirrors IsDisallowedAddress for IPv4 literals; IPv6 literals are left to the server. */
function isDisallowedIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const n = parts.map((p) => Number(p));
  if (n.some((v) => !Number.isInteger(v) || v < 0 || v > 255)) return false;
  const [a, b] = n;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local, covers 169.254.169.254 metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  return false;
}

export function checkSeed(raw: string): SeedCheck {
  const trimmed = raw.trim();
  if (!trimmed) return { raw, url: null, reason: "Empty line." };

  let candidate = stripListPrefix(trimmed);

  // A scheme that is present but not http(s) must be named as such. Falling through to the
  // https-prefix branch below would let new URL() parse it and the host check fire first, reporting
  // "Host must be a public DNS name" for what is actually a scheme problem — a correct verdict with
  // a misleading reason, which sends the operator to the wrong part of the line.
  const explicitScheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(candidate);
  if (explicitScheme && !/^https?$/i.test(explicitScheme[1])) {
    return { raw, url: null, reason: "Only http and https schemes are allowed." };
  }

  if (!/^https?:\/\//i.test(candidate)) {
    candidate = candidate.startsWith("//")
      ? `https:${candidate}`
      : `https://${candidate.replace(/^\/+/, "")}`;
  }

  let uri: URL;
  try {
    uri = new URL(candidate);
  } catch {
    return { raw, url: null, reason: "Not a URL." };
  }

  const scheme = uri.protocol.replace(":", "").toLowerCase();
  if (scheme !== "http" && scheme !== "https") {
    return { raw, url: null, reason: "Only http and https schemes are allowed." };
  }

  const port = uri.port ? Number(uri.port) : scheme === "https" ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) {
    return { raw, url: null, reason: `Port ${port} is not allowed for crawl fetches.` };
  }

  const host = uri.hostname.toLowerCase();
  if (!host) return { raw, url: null, reason: "Host is required." };

  if (host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal") {
    return { raw, url: null, reason: "Loopback and metadata hosts are not allowed." };
  }

  const isIpLiteral = /^\d+\.\d+\.\d+\.\d+$/.test(host);
  if (isIpLiteral) {
    if (isDisallowedIpv4(host)) {
      return {
        raw,
        url: null,
        reason: "Private, loopback, link-local, and metadata IP addresses are not allowed.",
      };
    }
  } else if (!host.includes(".")) {
    return { raw, url: null, reason: "Host must be a public DNS name or public IP." };
  }

  // Mirrors GetLeftPart(UriPartial.Query): fragment dropped, query kept.
  let url = `${uri.origin}${uri.pathname}${uri.search}`;
  if (url.endsWith("/") && uri.pathname === "/") url = url.slice(0, -1);

  return { raw, url, reason: null };
}

export type SeedBatch = {
  checks: SeedCheck[];
  /** Normalized, de-duplicated, in input order — what would actually be sent. */
  accepted: string[];
  rejected: SeedCheck[];
  /** Accepted URLs dropped as duplicates of an earlier line. */
  duplicates: SeedCheck[];
  /** Set when the batch exceeds the server's per-request cap. */
  capError: string | null;
};

export function checkSeedBatch(rawText: string): SeedBatch {
  const lines = rawText.split("\n").filter((l) => l.trim().length > 0);
  const checks = lines.map(checkSeed);

  const accepted: string[] = [];
  const duplicates: SeedCheck[] = [];
  const seen = new Set<string>();

  for (const c of checks) {
    if (!c.url) continue;
    const key = c.url.toLowerCase();
    if (seen.has(key)) {
      duplicates.push(c);
      continue;
    }
    seen.add(key);
    accepted.push(c.url);
  }

  const rejected = checks.filter((c) => c.reason !== null);

  // The server counts non-blank raw lines, not accepted URLs, against the cap.
  const capError =
    lines.length > MAX_SEEDS_PER_REQUEST
      ? `At most ${MAX_SEEDS_PER_REQUEST} seed URLs are allowed per request — ${lines.length} given.`
      : null;

  return { checks, accepted, rejected, duplicates, capError };
}
