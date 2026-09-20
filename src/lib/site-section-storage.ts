import type { SiteSectionContext } from "@/lib/types";
import type { CuratedSerpSeed } from "@/lib/content-creator/serp-lens";

/** sessionStorage key for Site Analyzer → Content Creator create handoff. */
export const SITE_SECTION_STORAGE_KEY = "gcc.siteSectionContext";

export type SiteSectionHandoff = {
  /** The Geek-Crawler-v2 run the section was read out of. */
  projectSiteRunId: string;
  gapTopic: string;
  /** Gap reason from Site Analyzer (seeds brief notes). */
  gapReason?: string | null;
  /** Gap section path (also on section.gapSectionPath). */
  gapSectionPath?: string | null;
  projectUrl?: string;
  section: SiteSectionContext;
  /** Operator-curated SERP seed for Content Brief fields. */
  curatedSerp?: CuratedSerpSeed | null;
};

/**
 * The run id, whichever of its four historical names a stored handoff carries. sessionStorage
 * outlives a deploy, so a handoff written before the rename is read back here, not lost.
 */
function crawlIdFromUnknown(parsed: {
  projectSiteRunId?: string;
  projectSiteCrawlRunId?: string;
  siteAnalysisProfileId?: string;
  siteAnalysisId?: string;
  section?: {
    projectSiteRunId?: string;
    projectSiteCrawlRunId?: string;
    siteAnalysisProfileId?: string;
    siteAnalysisId?: string;
  };
}): string {
  return (
    parsed.projectSiteRunId ||
    parsed.section?.projectSiteRunId ||
    parsed.projectSiteCrawlRunId ||
    parsed.section?.projectSiteCrawlRunId ||
    parsed.siteAnalysisProfileId ||
    parsed.section?.siteAnalysisProfileId ||
    parsed.siteAnalysisId ||
    parsed.section?.siteAnalysisId ||
    ""
  );
}

export function readSiteSectionHandoff(): SiteSectionHandoff | null {
  try {
    const raw = sessionStorage.getItem(SITE_SECTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SiteSectionHandoff> & {
      projectSiteCrawlRunId?: string;
      siteAnalysisProfileId?: string;
      siteAnalysisId?: string;
      section?: SiteSectionContext & {
        projectSiteCrawlRunId?: string;
        siteAnalysisProfileId?: string;
        siteAnalysisId?: string;
      };
    };
    const section = parsed.section;
    const projectSiteRunId = crawlIdFromUnknown(parsed);
    if (!section || !projectSiteRunId) return null;
    if (!section.relatedPages?.length) return null;
    const gapSectionPath =
      parsed.gapSectionPath ?? section.gapSectionPath ?? null;
    return {
      projectSiteRunId,
      gapTopic: parsed.gapTopic || section.gapTopic || "",
      gapReason: parsed.gapReason ?? null,
      gapSectionPath,
      projectUrl: parsed.projectUrl,
      section: {
        ...section,
        projectSiteRunId: section.projectSiteRunId || projectSiteRunId,
        gapSectionPath: section.gapSectionPath ?? gapSectionPath,
      },
      curatedSerp: parsed.curatedSerp ?? null,
    };
  } catch {
    return null;
  }
}

export function writeSiteSectionHandoff(handoff: SiteSectionHandoff): void {
  sessionStorage.setItem(SITE_SECTION_STORAGE_KEY, JSON.stringify(handoff));
}

export function clearSiteSectionHandoff(): void {
  try {
    sessionStorage.removeItem(SITE_SECTION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Body shape GeekAPI CreateCreate expects for siteSection.
 *
 * The run id goes out as projectSiteCrawlRunId because that is the name SiteSectionContextDto
 * binds (GccV2SiteSection.cs). It was sent as siteAnalysisProfileId, which binds nothing, so every
 * stored section recorded an empty run id.
 */
export function siteSectionForApi(section: SiteSectionContext) {
  return {
    projectSiteCrawlRunId: section.projectSiteRunId,
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

