/**
 * Seed URL admission, mirroring GeekCrawlerSeedNormalizer on the server.
 *
 * One bad URL does not spoil the list: the usable seeds are admitted and the rest are reported with
 * their reasons, matching AdmitSeeds on the server. This checks every line up front so the problems
 * are visible before the list is submitted anywhere.
 *
 * These rules are a copy of the server's and must stay a copy. Anything accepted here that the
 * server rejects is a lie told to the operator; anything rejected here that the server accepts is a
 * URL silently dropped. Source: GeekApplication/Models/GeekCrawler/GeekCrawlerSeedNormalizer.cs
 * (AdmitSeeds, TryNormalizeSeedUrl, IsAllowedCrawlUri, StripListPrefix) and
 * GeekCrawlerCaps.MaxSeedsPerRequest.
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
  /**
   * Always null. Kept so callers compile; the cap is reported per URL now, because a list over the
   * limit still crawls the seeds that fit rather than failing whole.
   */
  capError: null;
};

export function checkSeedBatch(rawText: string): SeedBatch {
  const lines = rawText.split("\n").filter((l) => l.trim().length > 0);

  const checks: SeedCheck[] = [];
  const accepted: string[] = [];
  const duplicates: SeedCheck[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const c = checkSeed(line);

    if (!c.url) {
      checks.push(c);
      continue;
    }

    const key = c.url.toLowerCase();
    if (seen.has(key)) {
      // A duplicate is not a failure and does not count against the cap -- the server dedupes
      // before counting, so the same URL typed twice is one seed.
      duplicates.push(c);
      checks.push(c);
      continue;
    }

    if (accepted.length >= MAX_SEEDS_PER_REQUEST) {
      // Over the cap is rejected per URL, not as a batch error. The allowed seeds still go.
      const over: SeedCheck = {
        raw: c.raw,
        url: null,
        reason: `Over the limit of ${MAX_SEEDS_PER_REQUEST} seed URLs per request.`,
      };
      checks.push(over);
      continue;
    }

    seen.add(key);
    accepted.push(c.url);
    checks.push(c);
  }

  return {
    checks,
    accepted,
    rejected: checks.filter((c) => c.reason !== null),
    duplicates,
    capError: null,
  };
}
