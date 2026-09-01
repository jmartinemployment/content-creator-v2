/** Project-site crawl section context — mirrors GeekAPI SiteSectionContextDto. */

export type Heading = {
  level: number;
  text: string;
};

export type RelatedPage = {
  url: string;
  title: string;
  headings: Heading[];
  excerpt: string;
};

export type InformationGainNote = {
  thisSiteCovers: string[];
  competitorOpens: string[];
  summary: string;
};

export type SiteSectionContext = {
  projectSiteCrawlRunId: string;
  gapTopic: string;
  gapSectionPath: string | null;
  relatedPages: RelatedPage[];
  topicalNeighbors: string[];
  informationGain?: InformationGainNote | null;
};

/** Body shape GeekAPI CreateCreate expects for siteSection. */
export function siteSectionForApi(section: SiteSectionContext) {
  return {
    projectSiteCrawlRunId: section.projectSiteCrawlRunId,
    gapTopic: section.gapTopic,
    gapSectionPath: section.gapSectionPath,
    relatedPages: section.relatedPages.map((p) => ({
      url: p.url,
      title: p.title,
      headings: p.headings ?? [],
      excerpt: p.excerpt ?? "",
    })),
    topicalNeighbors: section.topicalNeighbors ?? [],
    informationGain: section.informationGain ?? null,
  };
}

/** Build site section from crawled pages for this URL (no content-gap picker). */
export function siteSectionFromCrawlPages(
  runId: string,
  siteUrl: string,
  pages: RelatedPage[],
): SiteSectionContext {
  const relatedPages = pages
    .filter((p) => p.url?.trim())
    .sort((a, b) => toolishScore(b.url, b.title) - toolishScore(a.url, a.title))
    .map((p) => ({
      url: p.url.trim(),
      title: (p.title || p.url).trim(),
      headings: p.headings ?? [],
      excerpt: p.excerpt ?? "",
    }));

  const neighbors = relatedPages.map((p) => p.title).filter(Boolean);

  return {
    projectSiteCrawlRunId: runId,
    gapTopic: hostFromSiteUrl(siteUrl) || siteUrl,
    gapSectionPath: null,
    relatedPages,
    topicalNeighbors: neighbors.length > 0 ? neighbors : [hostFromSiteUrl(siteUrl) || siteUrl],
    informationGain: null,
  };
}

/** Prefer tool / use-case / methodology URLs for Writesonic-style internal link candidates. */
function toolishScore(url: string, title: string): number {
  const u = (url || "").toLowerCase();
  const t = (title || "").toLowerCase();
  let score = 0;
  if (u.includes("/tool")) score += 50;
  if (u.includes("/use-case") || u.includes("/usecase") || u.includes("ai-use")) score += 40;
  if (u.includes("/integration") || t.includes("integration")) score += 30;
  if (u.includes("/methodolog") || t.includes("methodolog")) score += 30;
  if (t.includes("tool") || t.includes("clone yourself") || t.includes("consultation")) score += 20;
  return score;
}

export function normalizeCrawlPage(raw: Record<string, unknown>): RelatedPage | null {
  const url = String(raw.url ?? raw.Url ?? "").trim();
  if (!url) return null;
  const headingsRaw = raw.headings ?? raw.Headings;
  const headings: Heading[] = Array.isArray(headingsRaw)
    ? headingsRaw
        .map((h) => {
          const row = h as Record<string, unknown>;
          const text = String(row.text ?? row.Text ?? "").trim();
          if (!text) return null;
          const level = Number(row.level ?? row.Level ?? 2);
          return { level: Number.isFinite(level) ? level : 2, text };
        })
        .filter((h): h is Heading => h !== null)
    : [];
  return {
    url,
    title: String(raw.title ?? raw.Title ?? url).trim(),
    headings,
    excerpt: String(raw.excerpt ?? raw.Excerpt ?? "").trim(),
  };
}

/** Strip protocol / trailing slash for display. */
export function hostFromSiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProto).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]!
      .toLowerCase();
  }
}

export function normalizeSiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/$/, "");
  return `https://${trimmed}`.replace(/\/$/, "");
}

export function isCrawlRunReady(status: string | null | undefined): boolean {
  if (!status) return false;
  return /^complete$/i.test(status);
}
