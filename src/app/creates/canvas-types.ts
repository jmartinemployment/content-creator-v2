/**
 * Wire shapes produced by GeekAPI's Content Creator v2 WRITE/VALIDATE stages. Mirrors the backend's
 * `ContentDocument`/`Section`/`Paragraph` JSON (see `GeekAPI/Services/Workflow/Services/
 * ContentSectionJsonConverter.cs` for the `{"type": "text"|"list", ...}` paragraph wire shape) and
 * the `SectionDrafted`/`SectionRepaired`/`ValidationReport` job-event payloads
 * (`GeekAPI/Services/ContentCreatorV2/Write/GccV2WriteService.cs`,
 * `.../Validate/GccV2ValidateService.cs`). Kept separate from `content-types.ts`, which is about the
 * *create*'s content type (blog/pillar/...), not a drafted document's shape.
 */

export type ContentRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string | null;
};

export type TextParagraphNode = {
  type: "text";
  runs: ContentRun[];
};

export type ListParagraphNode = {
  type: "list";
  ordered: boolean;
  items: ContentRun[][];
};

export type ParagraphNode = TextParagraphNode | ListParagraphNode;

export type SectionNode = {
  tag: string;
  heading: string;
  paragraphs: ParagraphNode[];
  href?: string | null;
  children: SectionNode[];
  imagePrompt?: string | null;
};

/** One drafted/rewritten section as tracked client-side — a flattened view over the
 * `SectionDrafted` / `SectionRepaired` / `SectionRewritten` / `SectionExpanded` / `SectionRetoned`
 * event payloads, keyed by `sectionKey` so a later repair/edit event updates in place. */
export type CanvasSection = {
  sectionKey: string;
  heading: string;
  job: string | null;
  section: SectionNode;
  wordCount: number;
  usedFallbackStub: boolean;
};

/** A named, paraphrase-level duplicate problem/solution pair — `GccV2OverlapGate.OverlapHit`
 * serialized onto the `ValidationReport` event. */
export type OverlapHitView = {
  headingA: string;
  headingB: string;
  sharedClaim: string;
  sectionKeyA: string;
  sectionKeyB: string;
  repairHint: string;
};

/** One named AI-visibility (GEO) heuristic check — `GccV2GeoAnalyzer.GeoCheck` serialized onto the
 * `ValidationReport` event / the AI-visibility snapshot report. Advisory only — never gates
 * `shipReady`. */
export type GeoCheckView = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  fixHint?: string | null;
};

/** `ValidationReport` job-event payload. */
export type ValidationReportView = {
  shipReady: boolean;
  reviewVerdict: string;
  reviewNotes?: string | null;
  seoScore: number;
  polishScore: number;
  polishShipReady: boolean;
  guardrailFlaggedCount?: number;
  guardrailRestructureCount?: number;
  guardrailRestructurePhrases?: string[];
  geoScore?: number;
  geoChecks?: GeoCheckView[];
  geoSummary?: string | null;
  seoChecks?: GeoCheckView[];
  overlapHits: OverlapHitView[];
  outstandingIssues: boolean;
  repairAttempt?: number;
};

/** Published CMS location captured on an AI-visibility snapshot — mirrors
 * `AiVisibilityPublishedUrl` (`GccV2AiVisibilityService`). */
export type AiVisibilityPublishedUrlView = {
  channel: string;
  slug?: string | null;
  publicUrl?: string | null;
  status: string;
  isPublished: boolean;
  publishedAtUtc?: string | null;
};

/** Full report body on a `GET/POST .../ai-visibility` response — `AiVisibilityReport`
 * (`GccV2AiVisibilityService`), serialized. */
export type AiVisibilityReportView = {
  targetKeyword: string;
  seoScore: number;
  geoScore: number;
  geoChecks: GeoCheckView[];
  geoSummary: string;
  overlapHitCount: number;
  shipReady: boolean;
  outstandingIssues: boolean;
  publishedUrls: AiVisibilityPublishedUrlView[];
  generatedAtUtc: string;
};

/** `GET/POST .../creates/{id}/ai-visibility[/refresh]` response shape. `ready: false` means no
 * completed draft exists yet to score (nothing persisted) — `message` explains why. */
export type AiVisibilitySnapshotView =
  | {
      ready: true;
      snapshotId: string;
      createId: string;
      jobId: string | null;
      score: number;
      createdAtUtc: string;
      report: AiVisibilityReportView | null;
    }
  | {
      ready: false;
      createId: string;
      message: string;
    };

/** `SectionDrafted` / `SectionRepaired` / `SectionRewritten` / `SectionExpanded` / `SectionRetoned`
 * job-event payload — `documentJson` is a serialized {@link SectionNode}. */
export type SectionEventPayload = {
  sectionKey: string;
  heading: string;
  job?: string | null;
  documentJson: string;
  wordCount: number;
  usedFallbackStub: boolean;
};

/** `OutlineReady` job-event payload — the PLAN-stage outline Canvas approves before WRITE runs. */
export type OutlineSectionView = {
  key: string;
  heading: string;
  job: string;
  hierarchyChildHeadings: string[];
};

export type OutlineView = {
  sections: OutlineSectionView[];
  hierarchyChildHeadings: string[];
};

/** `BrandKitReady` job-event payload — provisional kit from the crawl for Accept/Reject. */
export type BrandKitReadyView = {
  brandKitId: string;
  derivedFromProfileId?: string;
  voiceStatus?: string;
  companyName?: string | null;
  website?: string | null;
  companyDescription?: string | null;
  tagline?: string | null;
  positioningOneLiner?: string | null;
  voiceSampleCount?: number;
  voiceSamplePreviews?: string[];
  notesCount?: number;
};

export const SECTION_EVENT_TYPES = [
  "SectionDrafted",
  "SectionRepaired",
  "SectionRewritten",
  "SectionExpanded",
  "SectionRetoned",
] as const;
