import {
  hostFromSiteUrl,
  isProfileReady,
  normalizeCrawlPage,
  normalizeSiteUrl,
  siteSectionFromCrawlPages,
  type SiteSectionContext,
} from "@/app/creates/site-section";

export type SiteProfileOption = {
  id: string;
  domain: string;
  status: string | null;
  analyzedAt: string | null;
  primaryFocus: string | null;
};

export type SiteAnalyzeResult = {
  profileId: string;
  siteUrl: string;
  section: SiteSectionContext;
};

const POLL_MS = 3000;
const POLL_MAX_MS = 10 * 60 * 1000;

function normalizeProfiles(body: unknown): SiteProfileOption[] {
  if (!Array.isArray(body)) return [];
  return body
    .map((raw) => {
      const p = raw as Record<string, unknown>;
      const id = String(p.id ?? p.Id ?? "").trim();
      if (!id) return null;
      return {
        id,
        domain: String(p.domain ?? p.Domain ?? "").trim(),
        status: (p.status ?? p.Status ?? null) as string | null,
        analyzedAt: (p.analyzedAt ?? p.AnalyzedAt ?? null) as string | null,
        primaryFocus: (p.primaryFocus ?? p.PrimaryFocus ?? null) as string | null,
      };
    })
    .filter((p): p is SiteProfileOption => p !== null);
}

function pickReadyProfile(list: SiteProfileOption[]): SiteProfileOption | null {
  return list.find((p) => isProfileReady(p.status)) ?? null;
}

export async function fetchProfilesByDomain(domain: string): Promise<SiteProfileOption[]> {
  const res = await fetch(
    `/api/site-analyzer/profiles/by-domain?domain=${encodeURIComponent(domain)}&limit=50`,
    { cache: "no-store" },
  );
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      typeof body?.error === "string" ? body.error : `Could not list profiles (HTTP ${res.status})`,
    );
  }
  return normalizeProfiles(body);
}

/** Load crawled pages for this profile and build site section (relatedPages from the URL). */
export async function loadSectionFromSite(
  profileId: string,
  resolvedSiteUrl: string,
): Promise<SiteSectionContext> {
  const res = await fetch(`/api/site-analyzer/${encodeURIComponent(profileId)}`, {
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : `Could not load crawl (HTTP ${res.status})`,
    );
  }
  const rawPages = (body.pages ?? body.Pages ?? []) as Record<string, unknown>[];
  const pages = rawPages.map(normalizeCrawlPage).filter((p): p is NonNullable<typeof p> => p !== null);
  const section = siteSectionFromCrawlPages(profileId, resolvedSiteUrl, pages);
  if (section.relatedPages.length === 0) {
    throw new Error(
      "This crawl has no site pages yet — force a new crawl, or wait for the analysis to finish.",
    );
  }
  return section;
}

async function pollUntilReady(
  domain: string,
  signal: AbortSignal,
  onWaiting?: (label: string) => void,
): Promise<SiteProfileOption> {
  const started = Date.now();
  while (!signal.aborted) {
    const list = await fetchProfilesByDomain(domain);
    const ready = pickReadyProfile(list);
    if (ready) return ready;
    if (Date.now() - started > POLL_MAX_MS) {
      throw new Error("Site analysis timed out — try again or re-analyze.");
    }
    onWaiting?.("Waiting for crawl to finish…");
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(resolve, POLL_MS);
      signal.addEventListener(
        "abort",
        () => {
          window.clearTimeout(t);
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    });
  }
  throw new DOMException("Aborted", "AbortError");
}

export async function resolveSiteAnalysis(
  siteUrlInput: string,
  force: boolean,
  signal: AbortSignal,
  onProgress?: (label: string) => void,
): Promise<SiteAnalyzeResult> {
  const normalized = normalizeSiteUrl(siteUrlInput);
  const domain = hostFromSiteUrl(siteUrlInput);
  if (!domain) {
    throw new Error("Enter a site URL or domain (required).");
  }

  if (!force) {
    onProgress?.("Looking up existing crawl…");
    const existing = await fetchProfilesByDomain(domain);
    const ready = pickReadyProfile(existing);
    if (ready) {
      onProgress?.("Loading pages from this site…");
      const section = await loadSectionFromSite(ready.id, normalized);
      return { profileId: ready.id, siteUrl: normalized, section };
    }
  }

  onProgress?.("Starting site analysis…");
  const analyzeRes = await fetch("/api/site-analyzer/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ domain, force }),
    signal,
  });
  const analyzeBody = await analyzeRes.json().catch(() => ({}));
  if (!analyzeRes.ok) {
    throw new Error(
      typeof analyzeBody.error === "string"
        ? analyzeBody.error
        : `Analyze failed (HTTP ${analyzeRes.status})`,
    );
  }

  onProgress?.("Crawl queued — waiting for ready profile…");
  const ready = await pollUntilReady(domain, signal, onProgress);
  onProgress?.("Loading pages from this site…");
  const section = await loadSectionFromSite(ready.id, normalized);
  return { profileId: ready.id, siteUrl: normalized, section };
}
