/**
 * Content Brief catalogs for Geek Content Creator — aligned to Google's
 * documented Search & Ads terminology.
 *
 * Google-grounded fields cite their source; Tone of Voice and Content Angle
 * are internal editorial controls (Google publishes no such taxonomy) and are
 * marked as such. Human-selected controls — not inferred from SERP HTML.
 */

/** Bump when the ContentBrief shape or catalog values change (drives migration). */
export const BRIEF_VERSION = 2;

/* ------------------------------------------------------------------ *
 * 1.A  Search intent (SEO-standard taxonomy; not a live Google enum)  *
 * ------------------------------------------------------------------ */

export const PRIMARY_INTENTS = [
  { value: "informational", label: "Informational" },
  { value: "navigational", label: "Navigational" },
  { value: "commercial_investigation", label: "Commercial investigation" },
  { value: "transactional", label: "Transactional" },
] as const;

export type PrimaryIntent = (typeof PRIMARY_INTENTS)[number]["value"];

export const SECONDARY_INTENTS = [
  { value: "local", label: "Local" },
  { value: "freebies", label: "Freebies" },
  { value: "comparison", label: "Comparison" },
] as const;

export type SecondaryIntent = (typeof SECONDARY_INTENTS)[number]["value"];

/* ------------------------------------------------------------------ *
 * 1.B  Buying stage → Google Ads Full-Funnel objectives              *
 * ------------------------------------------------------------------ */

export const BUYING_STAGES = [
  { value: "awareness", label: "Awareness (Top of Funnel)" },
  { value: "consideration", label: "Consideration (Middle of Funnel)" },
  { value: "action", label: "Action / Conversion (Bottom of Funnel)" },
] as const;

export type BuyingStage = (typeof BUYING_STAGES)[number]["value"];

/* ------------------------------------------------------------------ *
 * 1.C  Audience Segments (verbatim Google Ads audience segments)     *
 *      https://support.google.com/google-ads/answer/2497941          *
 * ------------------------------------------------------------------ */

export const AUDIENCE_SEGMENTS = [
  { value: "affinity", label: "Affinity Segments" },
  { value: "in_market", label: "In-Market Segments" },
  { value: "life_events", label: "Life Events" },
  { value: "detailed_demographics", label: "Detailed Demographics" },
  { value: "your_data", label: "Your Data Segments (formerly Remarketing)" },
  { value: "custom", label: "Custom Segments" },
] as const;

export type AudienceSegment = (typeof AUDIENCE_SEGMENTS)[number]["value"];

/** Optional multi-select chips describing how the segment is refined. */
/* ------------------------------------------------------------------ *
 * 1.D  Angle for SEO (internal editorial control — NOT a Google      *
 *      attribute; choose to match the dominant SERP intent/format)   *
 * ------------------------------------------------------------------ */

export const CONTENT_ANGLES = [
  { value: "comparative", label: 'The Comparative Angle ("Versus")' },
  { value: "problem_solution", label: "The Problem-Solution Angle" },
  { value: "case_study_data", label: "The Case Study / Data-Driven Angle" },
  { value: "ultimate_guide", label: 'The Comprehensive "Ultimate Guide" Angle' },
] as const;

export type ContentAngle = (typeof CONTENT_ANGLES)[number]["value"];

/* ------------------------------------------------------------------ *
 * 1.E  Discovery CTA Types (Google Ads CallToActionTypeEnum)         *
 *      developers.google.com/google-ads/api/reference/rpc/v21/CallToActionTypeEnum
 * ------------------------------------------------------------------ */

export const CTA_TYPES = [
  { value: "sign_up", label: "Sign Up" },
  { value: "contact_us", label: "Contact Us" },
  { value: "book_now", label: "Book Now" },
  { value: "download", label: "Download" },
  { value: "learn_more", label: "Learn More" },
  { value: "apply_now", label: "Apply Now" },
  { value: "get_quote", label: "Get Quote" },
] as const;

export type CtaType = (typeof CTA_TYPES)[number]["value"];

/* ------------------------------------------------------------------ *
 * 1.F  Tone of Voice + E-E-A-T                                       *
 * ------------------------------------------------------------------ */

/** Method 1 — internal editorial control (Google publishes no tone taxonomy). */
export const TONES_OF_VOICE = [
  { value: "consultant_professional", label: "Consultant / Professional Tone" },
  { value: "informational_instructional", label: "Informational / Instructional Tone" },
  { value: "commercial_balanced", label: "Commercial / Balanced Tone" },
] as const;

export type ToneOfVoice = (typeof TONES_OF_VOICE)[number]["value"];

/**
 * Method 2 — E-E-A-T, Google Search Quality Rater framework (four signals).
 * https://developers.google.com/search/blog/2022/12/google-raters-guidelines-e-e-a-t
 */
export const EEAT_SIGNALS = [
  { value: "first_hand_experience", label: "First-Hand Experience" },
  { value: "expertise", label: "Expertise" },
  { value: "authoritativeness", label: "Authoritativeness" },
  { value: "trustworthiness", label: "Trustworthiness" },
] as const;

export type EeatSignal = (typeof EEAT_SIGNALS)[number]["value"];

/**
 * Tone availability gated by Primary Intent ∩ Angle for SEO.
 * Empty intersection → fall back to intent-allow only (see toneAllowed).
 * Secondary intent does not gate voice.
 */
export const TONE_COMPATIBILITY: Record<
  ToneOfVoice,
  { intents: PrimaryIntent[]; angles: ContentAngle[] }
> = {
  consultant_professional: {
    intents: ["informational", "commercial_investigation", "navigational"],
    angles: ["problem_solution", "case_study_data", "ultimate_guide"],
  },
  informational_instructional: {
    intents: ["informational", "navigational"],
    angles: ["problem_solution", "ultimate_guide"],
  },
  commercial_balanced: {
    intents: ["commercial_investigation", "transactional"],
    angles: ["comparative", "case_study_data"],
  },
};

/**
 * Is `tone` allowed given the chosen primary intent and angle?
 * With both set we require intent ∩ angle; if that intersection would be empty
 * for every tone we relax to intent-only so the operator is never fully blocked.
 */
export function toneAllowed(
  tone: ToneOfVoice,
  primaryIntent: PrimaryIntent | "",
  angle: ContentAngle | "",
): boolean {
  const rule = TONE_COMPATIBILITY[tone];
  const intentOk = !primaryIntent || rule.intents.includes(primaryIntent);
  const angleOk = !angle || rule.angles.includes(angle);
  if (intentOk && angleOk) return true;
  // Fallback: if no tone satisfies both for this intent, allow on intent alone.
  const anyToneSatisfiesBoth = (Object.keys(TONE_COMPATIBILITY) as ToneOfVoice[]).some((t) => {
    const r = TONE_COMPATIBILITY[t];
    return (
      (!primaryIntent || r.intents.includes(primaryIntent)) &&
      (!angle || r.angles.includes(angle))
    );
  });
  return anyToneSatisfiesBoth ? false : intentOk;
}

/* ------------------------------------------------------------------ */

/** Max quoteable wiki/.edu/.gov (or tool page) research docs per project. */
export const MAX_QUOTEABLE_RESEARCH_DOCS = 3;

export type LengthBandKey =
  | "pillar"
  | "blog"
  | "tools"
  | "emailColdOutreach"
  | "socialFacebook"
  | "socialLinkedIn"
  | "instagram"
  | "metaAds"
  | "googleAds"
  | "imagePrompt";

export interface ContentBrief {
  briefVersion: number;
  primaryIntent: PrimaryIntent | "";
  secondaryIntent: SecondaryIntent | "";
  buyingStage: BuyingStage | "";
  audienceSegment: AudienceSegment | "";
  audienceNotes: string;
  angle: ContentAngle | "";
  ctaType: CtaType | "";
  ctaLabel: string;
  toneOfVoice: ToneOfVoice | "";
  eeatSignals: EeatSignal[];
  lengthBand: LengthBandKey | "";
  writingNotes: string;
  paaQuestions: string;
  /**
   * The operator's own framing of this niche's problem — researched by hand, per taxonomy leaf.
   *
   * Saved inside the brief deliberately: the brief is already the place operator framing lives
   * (`writingNotes`, `audienceNotes`, `paaQuestions`), and it persists through the existing
   * `PATCH creates/{id}/brief-research` with no new route or store.
   *
   * Read on the backend by `GccNicheFramingReader`, which lands it in the tool page's opening
   * `SectionSlot.Guidance` — a field that was null until 2026-10-02, so the writer invented the
   * problem, its cost and its failure modes on every page.
   *
   * There is deliberately no partner-program field. Jeff, 2026-10-02: "Partner program text has no
   * place in my output." The brief is prompt input, so absence is the only guarantee that cannot
   * regress.
   */
  nicheFraming: NicheFraming;
}

/** One set of the three things the operator researches. Shared by the category and each tool. */
export type NicheFramingSet = {
  /** The problem the reader has today, in the operator's words. */
  coreProblem: string;
  /**
   * Where it goes wrong — one failure per **paragraph**, separated by a blank line.
   *
   * Not one per line: the research states a failure as a lead plus the paragraph explaining it, and
   * splitting on every newline turned one failure into four fragments too thin to argue from. The
   * backend reader is `GccNicheFramingReader.ReadParagraphs`, which splits on `\n\s*\n` — this comment
   * said "one per line, the same convention as `paaQuestions`" for a day after that stopped being
   * true, which is the kind of false claim about a live format `.cursor/rules` exists to forbid.
   */
  painPoints: string;
  /** What removes the problem, and the shape of the offer. */
  automationToPitch: string;
  /**
   * One retrieval question per failure (Geek-Crawler-Rag `plans/retrieval-from-the-brief.md`,
   * 2026-10-08). Each row is asked of the partner's crawl on its own: `solution` goes to the
   * index's meaning half, `terms` to its keyword half. Measured on Tipalti the same day: the
   * brief's pain points found the vendor *describing* three of six failures and the fix for none of
   * those three; solution descriptions in the vendor's own vocabulary found the product page for all
   * six. Per tool, rows are *added* to the category's, like pain points.
   *
   * Never quoted. Like every other field here it is prompt and retrieval input; quotes still come
   * only from crawled partner pages.
   */
  evidence: EvidenceRow[];
};

export type EvidenceRow = {
  /** The reader's failure, in the reader's words — the same voice as `painPoints`. */
  problem: string;
  /**
   * What the vendor does about it, in the VENDOR'S vocabulary ("self-service supplier onboarding
   * collects W-9 and W-8 forms"). Perplexity-sourced is fine; the operator reviews it.
   */
  solution: string;
  /** Two to five distinctive terms from the vendor's vocabulary, for the keyword half. */
  terms: string[];
};

export type NicheFraming = NicheFramingSet & {
  /**
   * The researched path, e.g. "Accounting -> Cash Flow Forecasting -> Accounts Receivable".
   * Its first level is a department slug, which is what makes the departmental tool directory
   * derivable rather than a field nobody sets.
   */
  taxonomyPath: string;
  /**
   * The practical client diagnosis: discovery questions the page's closing hands the reader to run
   * against their own operation. **One question per line.**
   *
   * One per line, not one per paragraph — the opposite of `painPoints`, and deliberately so. A failure
   * mode is a paragraph; a discovery question is a line. Read by
   * `GccNicheFramingReader.DiagnosisQuestions`, which splits accordingly.
   *
   * On the outer type rather than inside `NicheFramingSet`, which makes it **category-level with no
   * per-tool override** by construction. That is a property of the data, not a simplification: every
   * question is about the reader's own process ("How many invoices per month require someone's
   * approval?") and none names a product, so there is nothing for a partner to override.
   *
   * It reaches `ClosingCallToActionInstruction`, which had always demanded one plain ask while
   * supplying nothing for that ask to be about — so pillar, blog and tool all gain it at once.
   */
  diagnosisQuestions: string;
  /**
   * Per-tool overrides, **keyed by host** ("bill.com"), never by a typed product name.
   * `GccPartnerToolSlices` buckets evidence by host and names pages through `AnchorLookup`, so a
   * key of "Bill" would miss that partner's slice and the framing would reach the wrong page or
   * none — silently, since absent guidance is indistinguishable from none.
   *
   * A tool with no entry inherits the category set. Not every tool needs one: the research states
   * the framing once for the category as often as it states it per tool.
   */
  perTool: Record<string, NicheFramingSet>;
};

export function emptyNicheFramingSet(): NicheFramingSet {
  return { coreProblem: "", painPoints: "", automationToPitch: "", evidence: [] };
}

export function emptyEvidenceRow(): EvidenceRow {
  return { problem: "", solution: "", terms: [] };
}

/** True when a row carries anything at all. A blank row is a row the operator has not written yet. */
export function evidenceRowHasAny(row: EvidenceRow): boolean {
  return Boolean(row.problem.trim() || row.solution.trim() || row.terms.some((t) => t.trim()));
}

export function emptyNicheFraming(): NicheFraming {
  return { ...emptyNicheFramingSet(), taxonomyPath: "", diagnosisQuestions: "", perTool: {} };
}

/** True when a set carries anything at all. An all-blank set is not framing. */
export function nicheFramingSetHasAny(set: NicheFramingSet): boolean {
  return Boolean(
    set.coreProblem.trim() ||
      set.painPoints.trim() ||
      set.automationToPitch.trim() ||
      set.evidence.some(evidenceRowHasAny),
  );
}

/**
 * The writer's "where they fail", derived from the rows: one paragraph per row, the Problem column.
 *
 * Since 2026-10-08 the rows are the one place a failure is entered (Jeff: enter it once). The writer
 * still reads `painPoints` as paragraphs separated by a blank line, so that field is kept and filled
 * from the rows whenever they change; nothing the writer reads changed shape.
 */
export function derivePainPoints(rows: readonly EvidenceRow[]): string {
  return rows
    .map((row) => row.problem.trim())
    .filter((problem) => problem.length > 0)
    .join("\n\n");
}

/** A cell boundary in pasted research: a tab, a pipe with spaces, or three or more spaces. */
const CELL_SPLIT = /\t+| \| |\s{3,}/;

function looksLikeTerms(cell: string): boolean {
  // A terms cell is short phrases separated by commas with no sentence in it.
  return cell.includes(",") && !/[.!?]\s|[.!?]$/.test(cell.trim()) && cell.trim().length <= 120;
}

function isHeaderRow(cells: readonly string[]): boolean {
  const first = cells[0]?.trim().toLowerCase() ?? "";
  return /^(your )?(problem|failure|pain( point)?)s?$/.test(first);
}

/**
 * Rows out of pasted research, for review before the brief is saved. Deterministic: no model.
 *
 * Two shapes are read. A table, one row per line, cells separated by a tab, a " | " or three or
 * more spaces (a research answer's "Your problem · Tipalti solution · What it does · Automation
 * to pitch" pastes this way): the first cell is the problem, a last cell that reads as a comma list
 * is the terms, and everything between is the solution. Or blocks separated by a blank line, two or
 * three lines each: problem, solution, and optionally a comma list of terms. A header row ("Your
 * problem …") is dropped. Lines that fit neither shape are ignored rather than guessed at.
 */
export function parseEvidenceRows(text: string): EvidenceRow[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const tableRows: EvidenceRow[] = [];
  let sawTable = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const cells = line.split(CELL_SPLIT).map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length < 2) continue;
    sawTable = true;
    if (isHeaderRow(cells)) continue;
    const problem = cells[0];
    let terms: string[] = [];
    let solutionCells = cells.slice(1);
    if (solutionCells.length >= 2 && looksLikeTerms(solutionCells[solutionCells.length - 1])) {
      terms = solutionCells[solutionCells.length - 1].split(",").map((t) => t.trim()).filter(Boolean);
      solutionCells = solutionCells.slice(0, -1);
    }
    const row = { problem, solution: solutionCells.join(" "), terms };
    if (evidenceRowHasAny(row)) tableRows.push(row);
  }
  if (sawTable) return tableRows;

  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((l) => l.trim()).filter((l) => l.length > 0))
    .filter((block) => block.length >= 2);
  return blocks.map((block) => {
    const [problem, ...rest] = block;
    let terms: string[] = [];
    let solutionLines = rest;
    if (rest.length >= 2 && looksLikeTerms(rest[rest.length - 1])) {
      terms = rest[rest.length - 1].split(",").map((t) => t.trim()).filter(Boolean);
      solutionLines = rest.slice(0, -1);
    }
    return { problem, solution: solutionLines.join(" "), terms };
  });
}

export function emptyContentBrief(): ContentBrief {
  return {
    briefVersion: BRIEF_VERSION,
    primaryIntent: "",
    secondaryIntent: "",
    buyingStage: "",
    audienceSegment: "",
    audienceNotes: "",
    angle: "",
    ctaType: "",
    ctaLabel: "",
    toneOfVoice: "",
    // Always the full set — not a per-piece choice. E-E-A-T applies to virtually every piece, and
    // the picker that used to let an operator narrow it was removed entirely (2026-09-21), not
    // just defaulted, so there is nothing left to persist here beyond the constant set itself.
    eeatSignals: EEAT_SIGNALS.map((s) => s.value),
    lengthBand: "",
    writingNotes: "",
    paaQuestions: "",
    nicheFraming: emptyNicheFraming(),
  };
}

/* --------------------------- legacy migration --------------------------- */

const PRIMARY_INTENT_VALUES = PRIMARY_INTENTS.map((o) => o.value) as string[];
const SECONDARY_INTENT_VALUES = SECONDARY_INTENTS.map((o) => o.value) as string[];

const LEGACY_BUYING_STAGE: Record<string, BuyingStage> = {
  awareness: "awareness",
  tof_interest: "awareness",
  consideration: "consideration",
  mof_consideration: "consideration",
  action: "action",
  decision: "action",
  bof_actions: "action",
  retention: "action",
  advocacy: "action",
};

const LEGACY_AUDIENCE_SEGMENT: Record<string, AudienceSegment> = {
  affinity: "affinity",
  interest_affinity: "affinity",
  cold_prospect: "affinity",
  in_market: "in_market",
  life_events: "life_events",
  detailed_demographics: "detailed_demographics",
  your_data: "your_data",
  engaged_visitor: "your_data",
  lead: "your_data",
  customer: "your_data",
  lapsed: "your_data",
  lookalike: "your_data",
  custom: "custom",
  account_based: "custom",
  local_geo: "custom",
};

const LEGACY_ANGLE: Record<string, ContentAngle> = {
  comparative: "comparative",
  comparison: "comparative",
  problem_solution: "problem_solution",
  case_study_data: "case_study_data",
  case_study: "case_study_data",
  ultimate_guide: "ultimate_guide",
  howto_workflow: "ultimate_guide",
  explainer: "ultimate_guide",
  listicle: "ultimate_guide",
  objection_faq: "ultimate_guide",
};

const LEGACY_CTA: Record<string, CtaType> = {
  sign_up: "sign_up",
  start_trial: "sign_up",
  subscribe: "sign_up",
  contact_us: "contact_us",
  book_now: "book_now",
  book_demo: "book_now",
  download: "download",
  learn_more: "learn_more",
  read_related: "learn_more",
  apply_now: "apply_now",
  get_quote: "get_quote",
  contact_quote: "get_quote",
  buy: "get_quote",
};

const TONE_VALUES = TONES_OF_VOICE.map((o) => o.value) as string[];

/**
 * Normalize any persisted brief (legacy or current) into the canonical shape.
 * Runs on every read of a stored brief so stale values
 * never reach the prompt.
 */
export function migrateBrief(raw: unknown): ContentBrief {
  const base = emptyContentBrief();
  if (!raw || typeof raw !== "object") return base;
  const p = raw as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");

  // Intent: split legacy single `intent` into primary/secondary.
  const legacyIntent = str(p.intent);
  let primaryIntent = str(p.primaryIntent);
  let secondaryIntent = str(p.secondaryIntent);
  if (!primaryIntent && legacyIntent) {
    if (PRIMARY_INTENT_VALUES.includes(legacyIntent)) primaryIntent = legacyIntent;
    else if (SECONDARY_INTENT_VALUES.includes(legacyIntent) && !secondaryIntent)
      secondaryIntent = legacyIntent;
  }
  base.primaryIntent = PRIMARY_INTENT_VALUES.includes(primaryIntent)
    ? (primaryIntent as PrimaryIntent)
    : "";
  base.secondaryIntent = SECONDARY_INTENT_VALUES.includes(secondaryIntent)
    ? (secondaryIntent as SecondaryIntent)
    : "";

  base.buyingStage = LEGACY_BUYING_STAGE[str(p.buyingStage)] ?? "";

  const seg = str(p.audienceSegment) || str(p.audiencePrimary);
  base.audienceSegment = LEGACY_AUDIENCE_SEGMENT[seg] ?? "";

  // Notes: prefer new field; fold legacy detail + exclude in on load.
  const notes = str(p.audienceNotes) || str(p.audienceDetail);
  const exclude = str(p.audienceExclude).trim();
  base.audienceNotes = exclude
    ? `${notes}${notes ? "\n" : ""}Exclude: ${exclude}`.trim()
    : notes;

  base.angle = LEGACY_ANGLE[str(p.angle)] ?? "";
  base.ctaType = LEGACY_CTA[str(p.ctaType)] ?? "";
  base.ctaLabel = str(p.ctaLabel);

  // Tone: legacy was a numeric Record; unknown/object → commercial_balanced.
  const toneRaw = p.toneOfVoice;
  base.toneOfVoice = typeof toneRaw === "string" && TONE_VALUES.includes(toneRaw)
    ? (toneRaw as ToneOfVoice)
    : toneRaw && typeof toneRaw === "object"
      ? "commercial_balanced"
      : "";

  // No longer a choice the operator makes (removed from the form 2026-09-21) — always the full
  // set, regardless of what an older, editable-era brief happened to have persisted.
  base.eeatSignals = EEAT_SIGNALS.map((s) => s.value);

  base.lengthBand = (str(p.lengthBand) as LengthBandKey) || "";
  // Normalize writing notes: collapse consecutive duplicate lines (one-time migration for stale storage)
  const rawNotes = str(p.writingNotes);
  base.writingNotes = rawNotes
    .split("\n")
    .reduce((acc: string[], line) => {
      if (acc.length === 0 || acc[acc.length - 1] !== line) {
        acc.push(line);
      }
      return acc;
    }, [])
    .join("\n");
  base.paaQuestions = str(p.paaQuestions);
  // Read back explicitly, like every other field. migrateBrief rebuilds from emptyContentBrief, so a
  // field missing here is saved to the server and then silently wiped on the next load.
  base.nicheFraming = migrateNicheFraming(p.nicheFraming);
  base.briefVersion = BRIEF_VERSION;
  return base;
}

function migrateNicheFramingSet(raw: unknown): NicheFramingSet {
  const set = emptyNicheFramingSet();
  if (!raw || typeof raw !== "object") return set;
  const p = raw as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");

  set.coreProblem = str(p.coreProblem);
  set.automationToPitch = str(p.automationToPitch);
  // Accepts an array as well as lines, matching what the backend reader accepts — a programmatic
  // writer (a later paste-and-extract acquisition) may store either.
  // Joined on a BLANK line, because a blank line is the separator: each entry is one failure and may
  // itself be a paragraph. Joining on a single newline would merge the whole array into one item the
  // next time it is read back.
  set.painPoints = Array.isArray(p.painPoints)
    ? p.painPoints.filter((x): x is string => typeof x === "string").join("\n\n")
    : str(p.painPoints);
  // Rows read back explicitly, like every other field: a shape not read here is saved once and
  // wiped on the next load. `terms` accepts an array or a comma-separated string, matching the
  // backend reader. Blank rows are dropped; the form adds its own blank row to edit.
  set.evidence = Array.isArray(p.evidence)
    ? p.evidence
        .map((row): EvidenceRow | null => {
          if (!row || typeof row !== "object") return null;
          const r = row as Record<string, unknown>;
          const terms = Array.isArray(r.terms)
            ? r.terms.filter((x): x is string => typeof x === "string")
            : typeof r.terms === "string"
              ? r.terms.split(",")
              : [];
          return {
            problem: str(r.problem),
            solution: str(r.solution),
            terms: terms.map((t) => t.trim()).filter((t) => t.length > 0),
          };
        })
        .filter((row): row is EvidenceRow => row !== null && evidenceRowHasAny(row))
    : [];
  // A brief saved before rows existed: its "where they fail" paragraphs become rows with the
  // problem filled and the solution and terms left for the operator. Entered once, from then on.
  if (set.evidence.length === 0 && set.painPoints.trim()) {
    set.evidence = set.painPoints
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((problem) => ({ problem, solution: "", terms: [] }));
  }
  return set;
}

function migrateNicheFraming(raw: unknown): NicheFraming {
  const framing = emptyNicheFraming();
  if (!raw || typeof raw !== "object") return framing;
  const p = raw as Record<string, unknown>;

  Object.assign(framing, migrateNicheFramingSet(p));
  framing.diagnosisQuestions = Array.isArray(p.diagnosisQuestions)
    ? p.diagnosisQuestions.filter((x): x is string => typeof x === "string").join("\n")
    : typeof p.diagnosisQuestions === "string"
      ? p.diagnosisQuestions
      : "";
  framing.taxonomyPath = typeof p.taxonomyPath === "string"
    ? p.taxonomyPath
    : Array.isArray(p.taxonomyPath)
      ? p.taxonomyPath.filter((x): x is string => typeof x === "string").join(" -> ")
      : "";

  if (p.perTool && typeof p.perTool === "object") {
    for (const [host, value] of Object.entries(p.perTool as Record<string, unknown>)) {
      const key = host.trim().toLowerCase();
      if (!key) continue;
      framing.perTool[key] = migrateNicheFramingSet(value);
    }
  }

  return framing;
}

/** Required fields for fail-closed Generate (inline validation). */
export function contentBriefMissingFields(brief: ContentBrief): string[] {
  const missing: string[] = [];
  if (!brief.primaryIntent) missing.push("Primary intent");
  if (!brief.buyingStage) missing.push("Buying stage");
  if (!brief.audienceSegment) missing.push("Audience segment");
  if (!brief.audienceNotes.trim()) missing.push("Audience notes");
  if (!brief.angle) missing.push("Angle");
  if (!brief.ctaType) missing.push("Call to action");
  if (!brief.toneOfVoice) missing.push("Tone of voice");
  // Neither E-E-A-T signals nor Length is asked for here — E-E-A-T is always the full set (no
  // longer a choice the operator makes), and Length is derived from starting content type
  // (lengthBandForContentType). Neither can be blank once a content type is known.
  return missing;
}

export function isContentBriefComplete(brief: ContentBrief): boolean {
  return contentBriefMissingFields(brief).length === 0;
}

/** Parses a stored `brief_json`, or null when there is none or it will not parse. */
export function parseBriefJson(briefJson: string | null | undefined): ContentBrief | null {
  if (!briefJson) return null;
  try {
    return migrateBrief(JSON.parse(briefJson));
  } catch {
    return null;
  }
}

/**
 * What a brief says, as one comparable string: the brief as migrated, plus its keyword. Used to tell
 * whether the form differs from what the server holds. `lengthBand` is left out: the brief carries
 * none (it is derived per output type at generate time), and older copies that still hold one say the
 * same thing as copies that do not.
 */
export function briefFingerprint(brief: ContentBrief, topic: string): string {
  return JSON.stringify({ ...migrateBrief(brief), lengthBand: "", __topic: topic.trim() });
}

/* ------------------------------------------------------------------ *
 * Content Length Targets (merged from lib/content-writer/types.ts)   *
 * ------------------------------------------------------------------ */

export const CONTENT_LENGTH_TARGETS = {
  pillar: {
    min: 3000,
    max: 5000,
    label: "3,000–5,000+",
    definition:
      "Exhaustive macro-level entry points for massive topics — multiple subsections that link out to cluster articles.",
  },
  blog: {
    // Raised with GeekBackend's ContentLengthTargets on 2026-09-23 -- blog landed 300-400 words
    // under target run after run. These numbers exist twice, here and in C#, and only the backend
    // half moved, so the badge kept reading 1,800-2,500 against a generator already writing to
    // 2,000-2,700. Two copies of one fact is how that happens; change both together.
    min: 2000,
    max: 2700,
    label: "2,000–2,700",
    definition:
      "Deep-dive articles aimed at outranking competitors — substantive depth in every section, not surface summaries.",
  },
  emailColdOutreach: {
    min: 50,
    max: 125,
    label: "50–125",
    definition: "High response rates; pitch a single, clear call-to-action.",
  },
  tools: {
    min: 3000,
    max: 5000,
    label: "3,000–5,000+",
    definition:
      "Comprehensive single-platform guides — deep implementation context, capabilities, and when to use it.",
  },
  imagePrompt: {
    min: 20,
    max: 400,
    label: "20–400",
  },
  socialFacebook: {
    minWords: 30,
    maxWords: 50,
    maxChars: 250,
    label: "~40 words, under 250 chars",
  },
  socialLinkedIn: {
    minWords: 200,
    maxWords: 300,
    minChars: 1300,
    maxChars: 1900,
    label: "200–300 words, 1,300–1,900 chars",
  },
  instagram: {
    minWords: 50,
    maxWords: 150,
    maxChars: 2200,
    label: "50–150 words, under 2,200 chars",
    definition: "Instagram caption — scannable, one clear ask, hashtags optional and sparse.",
  },
  metaAds: {
    minWords: 15,
    maxWords: 40,
    primaryTextMaxChars: 125,
    headlineMaxChars: 40,
    label: "Primary ~125 chars · headline ~40 chars",
    definition: "Meta feed/story ad — short primary text, punchy headline, single CTA.",
  },
  googleAds: {
    minWords: 8,
    maxWords: 30,
    headlineMaxChars: 30,
    descriptionMaxChars: 90,
    label: "Headlines ≤30 chars · descriptions ≤90 chars",
    definition: "Google Search/RSA-style — tight headlines and descriptions, keyword-aligned.",
  },
} as const;

/** Length bands offered on the Content Brief (keyed for generate guidance). */
export const LENGTH_BAND_OPTIONS: {
  value: keyof typeof CONTENT_LENGTH_TARGETS;
  label: string;
}[] = [
  { value: "pillar", label: `Pillar — ${CONTENT_LENGTH_TARGETS.pillar.label}` },
  { value: "blog", label: `Blog — ${CONTENT_LENGTH_TARGETS.blog.label}` },
  { value: "tools", label: `AI Tools page — ${CONTENT_LENGTH_TARGETS.tools.label}` },
  {
    value: "emailColdOutreach",
    label: `Cold email — ${CONTENT_LENGTH_TARGETS.emailColdOutreach.label}`,
  },
  {
    value: "socialFacebook",
    label: `Facebook — ${CONTENT_LENGTH_TARGETS.socialFacebook.label}`,
  },
  {
    value: "socialLinkedIn",
    label: `LinkedIn — ${CONTENT_LENGTH_TARGETS.socialLinkedIn.label}`,
  },
  { value: "instagram", label: `Instagram — ${CONTENT_LENGTH_TARGETS.instagram.label}` },
  { value: "metaAds", label: `Meta ads — ${CONTENT_LENGTH_TARGETS.metaAds.label}` },
  { value: "googleAds", label: `Google ads — ${CONTENT_LENGTH_TARGETS.googleAds.label}` },
  {
    value: "imagePrompt",
    label: `Image prompt — ${CONTENT_LENGTH_TARGETS.imagePrompt.label}`,
  },
];

/**
 * Length is derived from the create's starting content type, not chosen separately — the two were
 * never independent facts, and asking the operator to pick a length band by hand risked one that
 * quietly disagreed with the type already set at creation. `startingContentType` (content-types.ts,
 * twenty values) and `LengthBandKey` (ten bands) do not line up one-to-one — several content types
 * share a band, and "social"/"ads"/"linkedin-document" pick the closest platform-specific band
 * rather than naming one exactly — but every value has a real destination, and callers no longer
 * need a blank/unmapped case.
 */
const LENGTH_BAND_BY_CONTENT_TYPE: Record<string, LengthBandKey> = {
  pillar: "pillar",
  blog: "blog",
  "tech-article": "blog",
  tool: "tools",
  comparison: "blog",
  alternatives: "blog",
  "case-study": "blog",
  guide: "blog",
  listicle: "blog",
  service: "blog",
  local: "blog",
  whitepaper: "blog",
  "email-cold-outreach": "emailColdOutreach",
  "email-newsletter": "emailColdOutreach",
  "email-story-nurture": "emailColdOutreach",
  "email-transactional": "emailColdOutreach",
  social: "socialLinkedIn",
  "image-prompt": "imagePrompt",
  ads: "googleAds",
  "linkedin-document": "socialLinkedIn",
};

/**
 * "" for no content type chosen yet, or one outside the twenty known values -- no default band.
 * `ContentBrief.lengthBand` is already typed `LengthBandKey | ""` for exactly this state; every
 * real caller resolves a real content type before this result is ever persisted.
 */
export function lengthBandForContentType(startingContentType: string): LengthBandKey | "" {
  return LENGTH_BAND_BY_CONTENT_TYPE[startingContentType] ?? "";
}
