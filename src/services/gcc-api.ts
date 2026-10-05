/**
 * GeekAPI Content Creator surface (/api/geek-content-creator).
 * Proxied via /api/cw same-origin helper (Bearer forward).
 */

import type { ContentBrief } from "@/lib/content-creator/brief-catalog";
import type { SiteSectionContext } from "@/lib/types";
import type { SavedSerpParseResult } from "@/lib/content-creator/serp-lens";
import type { GccPartnerToolReadiness } from "@/services/workflow-tools-hub";

const API_BASE = "/api/cw";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export interface GccCreate {
  id: string;
  clientId: string;
  ownerUserId: string;
  startingContentType: string | null;
  topic: string;
  notes: string | null;
  department?: string;
  projectSiteRunId: string | null;
  siteSectionJson: string | null;
  briefJson: string | null;
  researchJson: string | null;
  status: string;
  createdAtUtc: string;
  updatedAtUtc: string;
  /** The project that owns this create. Carried by the list route and the create/save responses;
   *  the detail route does not send it. */
  projectId?: string | null;
  /** The row version this copy was read at, sent back as `expectedVersion` on a save so a write from
   *  a stale copy is refused (409) instead of overwriting. Carried by the list route and the
   *  create/save responses; the detail route does not send it. */
  version?: number;
}

export interface GccSerpIndex {
  organicTitles: string[];
  organicUrls: string[];
  peopleAlsoAsk: string[];
  relatedSearches: string[];
}

async function gccRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("Could not reach GeekAPI Content Creator.", 0);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new ApiError(detail || response.statusText, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function createGccCreate(input: {
  clientId: string;
  projectId?: string | null;
  startingContentType?: string | null;
  topic: string;
  projectSiteRunId?: string | null;
}): Promise<GccCreate> {
  return gccRequest<GccCreate>("/api/geek-content-creator/creates", {
    method: "POST",
    body: JSON.stringify({
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      startingContentType: input.startingContentType ?? null,
      topic: input.topic,
      projectSiteRunId: input.projectSiteRunId ?? null,
      // No department and no notes. Department was hard-coded to "marketing" here, a value nobody
      // chose; GeekAPI derives it from the brief's taxonomy path (GccContentPath.DepartmentFor), and
      // a second derivation here would be a second slug rule to drift. Notes had no field anywhere
      // in this app, so it was always null (D17: the brief and niche framing are the operator's input).
    }),
  });
}

export function listGccCreates(clientId?: string | null): Promise<GccCreate[]> {
  const q = clientId
    ? `?clientId=${encodeURIComponent(clientId)}`
    : "";
  return gccRequest<GccCreate[]>(`/api/geek-content-creator/creates${q}`);
}

export function getGccCreate(id: string): Promise<GccCreate> {
  return gccRequest<GccCreate>(`/api/geek-content-creator/creates/${id}`);
}

/**
 * The create's row version, read from the list route -- the only read that carries it.
 *
 * Null when the create is not in this client's list. A save needs this value to be refused when
 * stale, so a caller that gets null must not save: writing without it is the last-writer-wins
 * overwrite the version exists to prevent.
 */
export async function getGccCreateVersion(clientId: string, createId: string): Promise<number | null> {
  const rows = await listGccCreates(clientId);
  const row = rows.find((r) => r.id === createId);
  return typeof row?.version === "number" ? row.version : null;
}

export function parseSiteSectionJson(
  json: string | null | undefined,
): SiteSectionContext | null {
  if (!json?.trim()) return null;
  try {
    // Sections stored before the rename carry the run id under one of three older names.
    const parsed = JSON.parse(json) as SiteSectionContext & {
      siteAnalysisProfileId?: string;
      siteAnalysisId?: string;
      projectSiteCrawlRunId?: string;
    };
    if (!parsed.relatedPages?.length) return null;
    return {
      ...parsed,
      projectSiteRunId:
        parsed.projectSiteRunId ||
        parsed.projectSiteCrawlRunId ||
        parsed.siteAnalysisProfileId ||
        parsed.siteAnalysisId ||
        "",
    };
  } catch {
    return null;
  }
}

/**
 * Saves the brief, and optionally a corrected `topic`.
 *
 * The keyword previously reached the server only at mint, inside `ensureCreateId`, which returns early
 * once a create exists — so editing it afterwards changed a local input and persisted nothing. `topic`
 * is sent to the create's own column rather than copied into the brief, because Topic is what the SEO
 * score, the descriptor split, the grounding query and artifact naming all read; a second copy would
 * drift.
 */
/** Why a brief was written: a click, the two-second autosave, or a draft recovered from this browser. */
export type BriefSaveKind = "manual" | "autosave" | "recovered";

/**
 * The status GeekAPI answers when the create changed after the caller read it. Nothing was saved.
 */
export const BRIEF_STALE_STATUS = 409;

export function patchBriefResearch(
  createId: string,
  body: {
    briefJson: string;
    topic?: string | null;
    /** The `version` the caller's copy was read at. Required: a save without it cannot be refused
     *  when stale, and would overwrite whatever changed since. */
    expectedVersion: number;
    kind: BriefSaveKind;
  },
): Promise<GccCreate> {
  return gccRequest<GccCreate>(
    `/api/geek-content-creator/creates/${createId}/brief-research`,
    {
      method: "PATCH",
      body: JSON.stringify({
        briefJson: body.briefJson,
        // Omitted rather than nulled when unchanged: null is "leave it" server-side, and sending a
        // blank string on every brief save would be a write nobody asked for.
        topic: body.topic?.trim() || null,
        expectedVersion: body.expectedVersion,
        // Recorded on the revision once GeekAPI writes revisions (fix-persistence SA1).
        kind: body.kind,
      }),
    },
  );
}

/**
 * When the brief a version was generated from was saved, from the version's metadata.
 *
 * The key is this frontend's half of fix-persistence SA3: GeekAPI records the brief revision a
 * generate read on every version's `metadata_json`. Null until it does, and for every version
 * written before it.
 */
export const BRIEF_REVISION_SAVED_AT_KEY = "briefRevisionSavedAtUtc";

export function briefRevisionSavedAt(metadataJson: string | null | undefined): string | null {
  if (!metadataJson) return null;
  try {
    const parsed = JSON.parse(metadataJson) as Record<string, unknown> | null;
    const raw = parsed?.[BRIEF_REVISION_SAVED_AT_KEY];
    return typeof raw === "string" && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

export interface GccArtifact {
  id: string;
  createId: string;
  parentArtifactId?: string | null;
  type: string;
  name: string;
  status: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface GccArtifactVersion {
  id: string;
  artifactId: string;
  versionNumber: number;
  bodyDocumentJson: string;
  metadataJson?: string | null;
  createdAtUtc: string;
}

export interface GccCreateDetail extends GccCreate {
  artifacts: GccArtifact[];
  lastAnalyzedAtUtc?: string | null;
  analysisAgeDays?: number | null;
  analysisStale?: boolean;
}

export interface GccStaleGroundingError {
  error: "stale_site_analysis";
  message: string;
  lastAnalyzedAtUtc: string;
  analysisAgeDays: number;
  staleAfterDays: number;
  domain: string;
  projectSiteRunId?: string;
}

export interface GccGenerateResult {
  /** Present once GeekAPI runs generate as a job: join it on the hub and await events. */
  jobId?: string;
  createId?: string;
  status?: string;
  /* The shapes a synchronous generate returned. Kept so the UI works against a GeekAPI that has
     not yet been deployed with the job runner -- this frontend ships first, deliberately, so
     there is no window where the two disagree. */
  artifact?: GccArtifact;
  version?: GccArtifactVersion;
  created?: Array<{ artifact: GccArtifact; version: GccArtifactVersion }>;
  /**
   * Per-partner refusals, named. One requested type can be several artifacts — tool is one page per
   * declared partner — and a partner that could not be grounded refuses its own page while the
   * others persist.
   *
   * This field is why the two missing tool pages had no explanation on 2026-10-02: the backend
   * computed the reason and sent it, and there was nowhere here to put it, so it was dropped.
   */
  refusals?: string[];
  /** Pieces that were saved with a gap the operator should see, prefixed by type. */
  warnings?: string[];
  /** The tool pre-flight that decided which partners were drafted. Empty for every other type. */
  preflight?: GccPartnerToolReadiness[];
}

export interface GccSeoReport {
  targetKeyword: string;
  score: number;
  wordCount: number;
  sectionCount: number;
  keywordDensityPercent: number;
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
    detail: string;
    fixHint?: string | null;
  }>;
  applyFeedback: string;
}

export interface GccPolishReport {
  score: number;
  shipReady: boolean;
  wordCount: number;
  sentenceCount: number;
  avgSentenceWords: number;
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
    detail: string;
    fixHint?: string | null;
  }>;
  applyFeedback: string;
}

export function getGccCreateDetail(id: string): Promise<GccCreateDetail> {
  return gccRequest<GccCreateDetail>(`/api/geek-content-creator/creates/${id}`);
}

export function listGccVersions(artifactId: string): Promise<GccArtifactVersion[]> {
  return gccRequest<GccArtifactVersion[]>(
    `/api/geek-content-creator/versions?artifactId=${encodeURIComponent(artifactId)}`,
  );
}

/**
 * Download this create's generated content as a zip of HTML documents.
 *
 * Restores the export v1 had (ReviewPublishPanel -> downloadHtmlExport), which in this repo exists
 * but is project-scoped and mounted nowhere. The create-scoped export already exists server-side
 * and is ownership-checked; only a caller was missing.
 *
 * Points at the v1 surface. It briefly pointed at the -v2 export, which reads GccV2 jobs -- a store
 * this path never writes -- so it returned an empty archive for every create. The v1 endpoint reads
 * the artifacts themselves.
 *
 * The archive is foldered by content type with image prompts in their own tree, never mixed into
 * the prose.
 *
 * Not gccRequest: the response is a zip, not JSON.
 */
export async function downloadCreateHtmlExport(createId: string): Promise<void> {
  const path = `/api/geek-content-creator/creates/${encodeURIComponent(createId)}/export/html`;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`);
  } catch {
    throw new ApiError("Could not reach GeekAPI Content Creator.", 0);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new ApiError(detail || response.statusText, response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${createId}-html-export.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

export function generateGccCreate(
  createId: string,
  opts: {
    provider: string;
    outputTypes?: string[];
    acknowledgeStaleGrounding?: boolean;
  },
): Promise<GccGenerateResult> {
  return gccRequest<GccGenerateResult>(
    `/api/geek-content-creator/creates/${createId}/generate`,
    {
      method: "POST",
      body: JSON.stringify({
        provider: opts.provider,
        outputTypes:
          opts.outputTypes && opts.outputTypes.length > 0
            ? opts.outputTypes
            : null,
        acknowledgeStaleGrounding: opts.acknowledgeStaleGrounding === true,
      }),
    },
  );
}

/** Parse a 409 Conflict body from Generate when site grounding is stale. */
export function parseStaleGroundingError(err: unknown): GccStaleGroundingError | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  try {
    const body = JSON.parse(err.message) as Partial<GccStaleGroundingError>;
    if (body.error !== "stale_site_analysis") return null;
    return body as GccStaleGroundingError;
  } catch {
    return null;
  }
}

/* ------------------- create keyword-source uploads ------------------- */

export type GccSerpOrganic = { title: string; url: string; position: number };

export type GccSerpShape = {
  dominantFormats: string[];
  titlePatterns: string[];
  guidance: string;
  hasPeopleAlsoAsk: boolean;
  organicCount: number;
  pageHint: string | null;
};

/** A parsed Keyword (Google SERP) upload — present only for category "KeywordResult". */
export type GccParsedSerpPage = {
  id: string;
  fileName: string;
  organics: GccSerpOrganic[];
  relatedSearches: string[];
  shape: GccSerpShape;
  parseWarning: string | null;
};

/**
 * `provider` is REQUIRED on every call that writes prose.
 *
 * It was optional with a `?? "OpenAi"` default, which is a default substituted over a user-selected
 * value — `.cursor/rules/no-fallbacks.mdc`. Revise is what made that concrete: the Writing model
 * picker did not reach it, so a draft generated on Anthropic was rewritten entirely by OpenAI and the
 * stamp recorded "OpenAi" as though it had been chosen. Required means the type refuses a caller that
 * forgets, instead of the default answering for them.
 */
export function reviseGccVersion(
  versionId: string,
  input: {
    feedback: string;
    scope?: "full" | "section";
    sectionPath?: string | null;
    provider: string;
  },
): Promise<GccArtifactVersion> {
  return gccRequest<GccArtifactVersion>(
    `/api/geek-content-creator/versions/${versionId}/revise`,
    {
      method: "POST",
      body: JSON.stringify({
        feedback: input.feedback,
        scope: input.scope ?? "full",
        sectionPath: input.sectionPath ?? null,
        provider: input.provider,
      }),
    },
  );
}

export function seoGccVersion(
  versionId: string,
  keyword: string,
): Promise<GccSeoReport> {
  const q = encodeURIComponent(keyword);
  return gccRequest<GccSeoReport>(
    `/api/geek-content-creator/versions/${versionId}/seo?keyword=${q}`,
  );
}

export function polishGccVersion(versionId: string): Promise<GccPolishReport> {
  return gccRequest<GccPolishReport>(
    `/api/geek-content-creator/versions/${versionId}/polish`,
  );
}

export function approveGccVersion(
  versionId: string,
  notes?: string | null,
): Promise<{ artifact: GccArtifact }> {
  return gccRequest(`/api/geek-content-creator/versions/${versionId}/approve`, {
    method: "POST",
    body: JSON.stringify({ notes: notes ?? null }),
  });
}

/* --------------------- readable artifact rendering --------------------- */

type SerpRun = { text?: string; bold?: boolean; italic?: boolean; href?: string };
type SerpParagraph = {
  type?: string;
  runs?: SerpRun[];
  ordered?: boolean;
  items?: SerpRun[][];
  /** Source URL on a block quotation. */
  cite?: string;
};
type DocSection = {
  tag?: string;
  heading?: string;
  paragraphs?: SerpParagraph[];
  href?: string;
  children?: DocSection[];
  imagePrompt?: string;
};
type WireDocument = { lede?: DocSection; sections?: DocSection[] };

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderRuns(runs: SerpRun[] | undefined): string {
  return (runs ?? [])
    .map((r) => {
      let t = escHtml(r.text ?? "");
      if (!t) return "";
      if (r.bold) t = `<strong>${t}</strong>`;
      if (r.italic) t = `<em>${t}</em>`;
      if (r.href) {
        t = `<a href="${escHtml(r.href)}" target="_blank" rel="noopener noreferrer">${t}</a>`;
      }
      return t;
    })
    .join("");
}

function renderParagraph(p: SerpParagraph): string {
  // A quote is a real block, not prose that happens to start with "According to". The backend
  // renders <blockquote cite>; without this it would draw here as an ordinary paragraph and the
  // attribution would vanish.
  if (p.type === "quote") {
    const cite = p.cite?.trim()
      ? `<footer><cite>${escHtml(p.cite.trim())}</cite></footer>`
      : "";
    return `<blockquote>${renderRuns(p.runs ?? [])}${cite}</blockquote>`;
  }
  if (p.type === "list" || Array.isArray(p.items)) {
    const tag = p.ordered ? "ol" : "ul";
    const items = (p.items ?? []).map((it) => `<li>${renderRuns(it)}</li>`).join("");
    return `<${tag}>${items}</${tag}>`;
  }
  const inner = renderRuns(p.runs);
  return inner ? `<p>${inner}</p>` : "";
}

function renderSection(s: DocSection, depth: number): string {
  const level = s.tag && /^h[1-6]$/i.test(s.tag)
    ? s.tag.toLowerCase()
    : depth <= 0
      ? "h2"
      : "h3";
  const parts: string[] = [];
  if (s.heading?.trim()) parts.push(`<${level}>${escHtml(s.heading)}</${level}>`);
  for (const p of s.paragraphs ?? []) {
    const r = renderParagraph(p);
    if (r) parts.push(r);
  }
  // Image prompts are deliberately not drawn in the prose. They are production instructions for
  // an image generator, not something a reader reads, and inline they break the page you are trying
  // to judge (Jeff, 2026-09-23: "in line image prompt is specifically said no to"). They ship as
  // their own files in the export, under image-prompts/<type>/, one per H1 and H2.
  for (const c of s.children ?? []) parts.push(renderSection(c, depth + 1));
  return parts.join("\n");
}

function docToHtml(doc: WireDocument): string {
  const blocks: string[] = [];
  if (doc.lede) blocks.push(renderSection(doc.lede, 0));
  for (const s of doc.sections ?? []) blocks.push(renderSection(s, 0));
  return blocks.filter(Boolean).join("\n");
}

function isWireDocument(v: unknown): v is WireDocument {
  return !!v && typeof v === "object" && ("lede" in v || "sections" in v);
}

/**
 * Render a stored artifact body (CWV2 ContentDocument, image-prompt, or tool JSON) into
 * readable HTML for `dangerouslySetInnerHTML`. Returns null when it can't produce a
 * meaningful render (caller can fall back to a collapsed JSON view).
 */
export function renderArtifactBody(bodyDocumentJson: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyDocumentJson);
  } catch {
    return null;
  }

  // Long-form ContentDocument (top-level or nested under .body for tool pages).
  if (isWireDocument(parsed)) return docToHtml(parsed);
  if (parsed && typeof parsed === "object" && isWireDocument((parsed as Record<string, unknown>).body)) {
    const p = parsed as Record<string, unknown>;
    const rows: string[] = [];
    if (typeof p.title === "string" && p.title.trim()) rows.push(`<h2>${escHtml(p.title)}</h2>`);
    // The summary is not drawn here. It sat directly under the title, one generic sentence, in the
    // slot a reader reads as the lede -- and the meta description says nearly the same thing in the
    // header above it, so the page opened with two near-identical one-liners before the actual
    // opening (Jeff, 2026-09-23: "this is the lede ... and is barely one sentence").
    //
    // The lede is the lead paragraph and belongs in that slot: title, then the hook. The summary
    // remains in the envelope for listings and cards, which is what it is for.
    rows.push(docToHtml(p.body as WireDocument));
    return rows.filter(Boolean).join("\n");
  }

  // Field-based artifacts (image prompt, metadata packs): labeled fields, never raw JSON.
  if (parsed && typeof parsed === "object") {
    const p = parsed as Record<string, unknown>;
    const rows: string[] = [];
    const field = (label: string, key: string) => {
      const v = p[key];
      if (typeof v === "string" && v.trim()) {
        rows.push(`<p><strong>${escHtml(label)}:</strong> ${escHtml(v)}</p>`);
      }
    };
    if (typeof p.title === "string" && p.title.trim()) rows.push(`<h2>${escHtml(p.title)}</h2>`);
    field("Prompt", "prompt");
    field("Image prompt", "imagePrompt");
    field("Negative prompt", "negativePrompt");
    field("Meta description", "metaDescription");
    field("Summary", "summary");
    if (typeof p.body === "string" && p.body.trim()) rows.push(p.body); // may already be HTML
    if (rows.length) return rows.join("\n");
  }

  return null;
}

/** Best-effort plain preview from stored body JSON — fail closed to raw/pretty JSON. */
export function previewBodyDocument(bodyDocumentJson: string, max = 1200): string {
  try {
    const parsed = JSON.parse(bodyDocumentJson) as Record<string, unknown>;
    const body =
      (typeof parsed.body === "string" && parsed.body) ||
      (typeof parsed.content === "string" && parsed.content) ||
      "";
    const title = typeof parsed.title === "string" ? parsed.title : "";
    const prompt =
      (typeof parsed.prompt === "string" && parsed.prompt) ||
      (typeof parsed.imagePrompt === "string" && parsed.imagePrompt) ||
      "";
    if (title || body || prompt) {
      const text = [title, prompt, body].filter(Boolean).join("\n\n");
      return text.length > max ? `${text.slice(0, max)}…` : text;
    }
    // Image-prompt / structured artifacts: show pretty JSON (not opaque one-liner).
    const pretty = JSON.stringify(parsed, null, 2);
    return pretty.length > max ? `${pretty.slice(0, max)}…` : pretty;
  } catch {
    return bodyDocumentJson.length > max
      ? `${bodyDocumentJson.slice(0, max)}…`
      : bodyDocumentJson;
  }
}

export function briefToJson(brief: ContentBrief): string {
  return JSON.stringify(brief);
}

export function parseSavedSerp(
  content: string,
  targetKeyword?: string | null,
): Promise<SavedSerpParseResult> {
  return gccRequest<SavedSerpParseResult>("/api/geek-content-creator/serp/parse", {
    method: "POST",
    body: JSON.stringify({
      content,
      targetKeyword: targetKeyword?.trim() || null,
    }),
  });
}

export interface HostIndexed {
  url: string;
  host: string | null;
  indexed: boolean;
  runId: string | null;
  /**
   * Whether this URL can actually be written from — the answer the gate uses.
   *
   * Indexed is not usable. A crawl can complete having been blocked at its first page, or against a
   * site that renders nothing without JavaScript, and still put a row in the index: that passes
   * "does an index exist" and gives a writer nothing. The server decides this once -- from the run's
   * page and chunk counts and from a search of the index itself -- so the form and the project gate
   * cannot answer it differently.
   */
  usable: boolean;
  /** Why not, in the operator's terms. Null when usable. */
  reason: string | null;
  pages: number | null;
  chunks: number | null;
}

/** The list a URL is entered in, as the index names it. */
export type DeclaredUrlList = "project-site" | "partner" | "competitors";

/**
 * Whether each URL can be written from, as a member of the list it is entered in.
 *
 * The only question that decides whether a project can use an entered URL, and the same answer the
 * server gives on save and before Generate. A URL that will not parse has no host and comes back not
 * indexed, so nothing checks syntax separately.
 *
 * The list is required because it is part of the question: Generate searches a URL's crawl as the
 * kind of list it is declared in, so a competitor is only usable if the index holds its pages as a
 * competitor crawl. The server refuses a check that does not say.
 */
export async function checkHostsIndexed(
  urls: string[],
  crawlType: DeclaredUrlList,
): Promise<HostIndexed[]> {
  const res = await gccRequest<{ results: HostIndexed[] }>("/api/rag/hosts-indexed", {
    method: "POST",
    body: JSON.stringify({ urls, crawlType }),
  });
  return res.results ?? [];
}

export interface ProjectSiteReadiness {
  seed: string;
  ready: boolean;
  runId: string | null;
  indexState: string | null;
  reason: string | null;
}

export interface SiteHostReference {
  sectionPath: string[];
  pageUrl: string;
  label: string;
  /**
   * The on-site page this reference passes through, or null when the section links the host
   * directly. A value is the hop that makes a tool page's partner visible.
   */
  viaPageUrl: string | null;
}

export interface SiteCrossReferencedHost {
  host: string;
  references: SiteHostReference[];
}

export interface SiteCrossReference {
  /** Hosts the site reaches, most-referenced first. */
  hosts: SiteCrossReferencedHost[];
  /** Anchors whose href would not resolve. Counted, not dropped. */
  unresolvedAnchors: number;
}

/** One partner's answer to the question the brief's Angle demands of the block quotation. */
export interface PartnerQuoteFinding {
  url: string;
  canAnswer: boolean;
  /** `answered` · `noanswer` · `unavailable` — the last is not a verdict on the partner. */
  outcome: string;
  quote: string | null;
  cite: string | null;
  reason: string | null;
}

export interface PartnerQuoteReadiness {
  angle: string;
  question: string;
  canAnswer: number;
  declared: number;
  results: PartnerQuoteFinding[];
}

/**
 * Whether each declared partner can answer the question this brief's Angle demands of the
 * blockquote — asked before Generate rather than discovered when a paid draft refuses.
 *
 * Distinct from `checkHostsIndexed`, which asks whether a URL has an index behind it at all. That
 * is a volume question, and volume is not fitness: a partner can carry nine thousand chunks and
 * still say nothing that answers `problem_solution` for this keyword.
 *
 * The partner list is read from the project server-side, not sent from here — the declared list is
 * what the content is obliged to name, and it is not the same set as the hosts that happen to be
 * indexed under the `partner` crawl type.
 */
export function checkPartnerQuoteReadiness(
  projectId: string,
  topic: string,
  angle: string,
): Promise<PartnerQuoteReadiness> {
  return gccRequest<PartnerQuoteReadiness>(
    "/api/geek-content-creator/brief/partner-quote-readiness",
    { method: "POST", body: JSON.stringify({ projectId, topic, angle }) },
  );
}
