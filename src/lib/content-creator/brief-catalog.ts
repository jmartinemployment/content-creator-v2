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
  toneOfVoice: ToneOfVoice | "";
  eeatSignals: EeatSignal[];
  lengthBand: LengthBandKey | "";
  /**
   * The pillar's People Also Ask questions, each with the operator's own answer (2026-10-13). Jeff
   * supplies the answer to each question: nothing is searched for it, the writer says his answer in
   * the Brief's voice in the pillar's People Also Ask section, and a question with no answer is left
   * off the page and reported. Until then this was the questions alone, typed one per line, and each
   * was searched for on every partner's site. A search results page can still offer questions
   * (`serp-lens.ts`); each arrives as a row with no answer.
   */
  paaQuestions: FaqRow[];
  /**
   * The blog's FAQ questions, each with the operator's own answer (the box since 2026-10-08, the
   * answers since 2026-10-13). The pillar has `paaQuestions` for its People Also Ask section; this is
   * the blog's own list, read by GeekAPI as `blogFaqQuestions` and written at the end of the blog.
   * The same rule as the pillar's: nothing is searched, the writer says Jeff's answer in the Brief's
   * voice, and a question with no answer is left off the page and reported.
   */
  blogFaqQuestions: FaqRow[];
  /**
   * The operator's own framing of this niche's problem — researched by hand, per taxonomy leaf.
   *
   * Saved inside the brief deliberately: the brief is already the place operator framing lives
   * (`audienceNotes`, `paaQuestions`), and it persists through the existing
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
   * said "one per line" for a day after that stopped being true, which is the kind of false claim
   * about a live format `.cursor/rules` exists to forbid.
   */
  painPoints: string;
  /**
   * What removes the problem, and the shape of the offer. For the category the form calls it "The
   * automation to pitch"; in a tool's own section it is "The marketing/sales hook to pitch" (Jeff,
   * 2026-10-12), the last part of his research for a partner. One field either way: GeekAPI gives a
   * tool's page its own, or the category's when the tool has none, as what answers the problem.
   */
  automationToPitch: string;
  /**
   * One retrieval question per failure (Geek-Crawler-Rag `plans/retrieval-from-the-brief.md`,
   * 2026-10-08). Each row is asked of the partner's crawl on its own: `solution` goes to the
   * index's meaning half, `terms` to its keyword half. Measured on Tipalti the same day: the
   * brief's pain points found the vendor *describing* three of six failures and the fix for none of
   * those three; solution descriptions in the vendor's own vocabulary found the product page for all
   * six. Per tool, rows are *added* to the category's, like pain points. The form enters them in
   * the tool's own section; the category's are only what an older brief was saved with.
   *
   * Never quoted. Like every other field here it is prompt and retrieval input; quotes still come
   * only from crawled partner pages.
   */
  evidence: EvidenceRow[];
  /**
   * The operator's FAQ questions for one tool, each with his own answer (the box since 2026-10-08,
   * the answers since 2026-10-13). Read only from a tool's own `perTool` entry; the category has no
   * FAQ for a tool page, so the form shows the box per tool only and the category's list stays empty.
   * Jeff supplies the answer to each question: the partner's site is not searched for it, the writer
   * says his answer on that tool's page in the Brief's voice, and a question with no answer is left
   * off the page and reported.
   */
  faqQuestions: FaqRow[];
};

/**
 * One FAQ question and the operator's own answer to it (2026-10-13). The one shape of all three FAQ
 * boxes of the brief: the pillar's People Also Ask (`paaQuestions`), the blog's FAQ
 * (`blogFaqQuestions`) and a tool page's FAQ (`perTool[host].faqQuestions`).
 *
 * Until then each box held questions alone, typed one per line, and GeekAPI searched the partners'
 * sites for each answer. Jeff supplies the answer now: nothing is searched, the writer says his
 * answer in the Brief's voice, and a question with no answer is left off the page and reported.
 */
export type FaqRow = {
  question: string;
  answer: string;
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
  return { coreProblem: "", painPoints: "", automationToPitch: "", evidence: [], faqQuestions: [] };
}

export function emptyEvidenceRow(): EvidenceRow {
  return { problem: "", solution: "", terms: [] };
}

/** True when a row carries anything at all. A blank row is a row the operator has not written yet. */
export function evidenceRowHasAny(row: EvidenceRow): boolean {
  return Boolean(row.problem.trim() || row.solution.trim() || row.terms.some((t) => t.trim()));
}

export function emptyFaqRow(): FaqRow {
  return { question: "", answer: "" };
}

/** True when a row carries a question, an answer or both. A blank row is one not written yet. */
export function faqRowHasAny(row: FaqRow): boolean {
  return Boolean(row.question.trim() || row.answer.trim());
}

/**
 * True when a row asks a question and has no answer. GeekAPI leaves such a question off the page and
 * reports it, so the form says so under the row and counts it on a tool's closed section.
 */
export function faqRowHasNoAnswer(row: FaqRow): boolean {
  return row.question.trim().length > 0 && row.answer.trim().length === 0;
}

/** The rows that ask a question, answered or not. */
export function faqRowsWithQuestion(rows: readonly FaqRow[]): FaqRow[] {
  return rows.filter((row) => row.question.trim().length > 0);
}

/** The rows that ask a question and have no answer. */
export function faqRowsWithNoAnswer(rows: readonly FaqRow[]): FaqRow[] {
  return rows.filter(faqRowHasNoAnswer);
}

/**
 * Rows as they are saved: each question and each answer trimmed, a row with neither dropped. A row
 * with a question and no answer is saved, and so is a row with an answer and no question, so nothing
 * typed is lost.
 */
export function faqRowsToSaved(rows: readonly FaqRow[]): FaqRow[] {
  return rows
    .map((row) => ({ question: row.question.trim(), answer: row.answer.trim() }))
    .filter(faqRowHasAny);
}

/**
 * One FAQ box read from a stored brief, in any of the three shapes a brief has held it in: questions
 * typed one per line (every brief saved before 2026-10-13), an array of questions (a programmatic
 * writer's), or an array of rows, each a question and its answer (what the form saves now). The two
 * older shapes load as rows with no answer.
 *
 * A value inside a row that is not text counts as empty, and an entry with neither a question nor an
 * answer is dropped. What comes back is trimmed as a save trims it, so a brief read back says what
 * was saved.
 */
export function faqRowsFromStored(raw: unknown): FaqRow[] {
  const text = (v: unknown): string => (typeof v === "string" ? v : "");
  const questions = (lines: string): FaqRow[] =>
    lines.split("\n").map((question) => ({ question, answer: "" }));

  if (typeof raw === "string") return faqRowsToSaved(questions(raw));
  if (!Array.isArray(raw)) return [];
  return faqRowsToSaved(
    raw.flatMap((entry): FaqRow[] => {
      if (typeof entry === "string") return questions(entry);
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Record<string, unknown>;
      return [{ question: text(row.question), answer: text(row.answer) }];
    }),
  );
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
      set.evidence.some(evidenceRowHasAny) ||
      set.faqQuestions.some(faqRowHasAny),
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

/**
 * Who a row belongs to: one partner's host, or every partner. A row for one partner is that host's
 * `perTool` entry's, entered in that tool's own section of the form; a row for every partner is the
 * category's `evidence`. GeekAPI reads each from there.
 *
 * The form enters rows per tool only (Jeff, 2026-10-12: one section a tool, holding everything
 * researched for it). A brief saved with rows for every partner still shows them, under the
 * category, where each can be given to a tool or removed.
 */
export const ALL_PARTNERS = "";

/** The rows one owner holds: the category's for `ALL_PARTNERS`, else that host's own. */
export function evidenceRowsOf(framing: NicheFraming, owner: string): EvidenceRow[] {
  return owner === ALL_PARTNERS ? framing.evidence : (framing.perTool[owner]?.evidence ?? []);
}

/**
 * The hosts a saved brief holds entries under that are not partners of the project: a partner whose
 * address was changed or removed since. Listed so nothing saved is hidden.
 *
 * Everything a tool has in the brief is filed under its host, and changing a partner's address in
 * the Profile moves none of it. On 2026-10-12 a partner's address was corrected and its five rows,
 * its pain point, its hook and its FAQ stayed under the old one: the new site was searched once
 * where the others were searched six times, and its tool page was refused.
 */
export function hostsWithNoPartner(framing: NicheFraming, partnerHosts: readonly string[]): string[] {
  return Object.keys(framing.perTool).filter(
    (host) => !partnerHosts.includes(host) && nicheFramingSetHasAny(framing.perTool[host]),
  );
}

/**
 * Everything saved under one host given to a partner: its rows after the partner's own, its FAQ
 * rows after the partner's own, and its pain point and its hook where the partner has none.
 *
 * A FAQ row is given with its answer (2026-10-13): the partner's rows first, then the host's rows
 * whose question, trimmed, the partner does not already ask. A question both ask is not added twice.
 * Its answer follows the rule for the pain point and the hook: the partner's row takes the host's
 * answer where it has none, and where the two have different answers the host's row stays where it
 * was.
 *
 * Nothing is overwritten. A pain point, a hook or an answer the partner already has stays, and the
 * other stays where it was, still shown, for the operator to choose between. A host left with nothing
 * is dropped.
 */
export function giveToolEntriesTo(framing: NicheFraming, from: string, to: string): NicheFraming {
  const source = framing.perTool[from];
  if (!source || from === to || to === ALL_PARTNERS) return framing;
  const target = framing.perTool[to] ?? emptyNicheFramingSet();

  const takesProblem = target.coreProblem.trim().length === 0;
  const takesPitch = target.automationToPitch.trim().length === 0;
  const evidence = [...target.evidence, ...source.evidence];

  const faqQuestions = [...target.faqQuestions];
  const faqLeft: FaqRow[] = [];
  for (const row of source.faqQuestions.filter(faqRowHasAny)) {
    const question = row.question.trim();
    // An answer typed with no question matches no row: it is given as it is.
    const at = question ? faqQuestions.findIndex((own) => own.question.trim() === question) : -1;
    if (at < 0) {
      faqQuestions.push(row);
      continue;
    }
    const answer = row.answer.trim();
    const ownAnswer = faqQuestions[at].answer.trim();
    if (!answer || answer === ownAnswer) continue;
    if (!ownAnswer) faqQuestions[at] = { ...faqQuestions[at], answer: row.answer };
    else faqLeft.push(row);
  }

  const given: NicheFramingSet = {
    coreProblem: takesProblem ? source.coreProblem : target.coreProblem,
    automationToPitch: takesPitch ? source.automationToPitch : target.automationToPitch,
    evidence,
    painPoints: derivePainPoints(evidence),
    faqQuestions,
  };
  const left: NicheFramingSet = {
    ...emptyNicheFramingSet(),
    coreProblem: takesProblem ? "" : source.coreProblem,
    automationToPitch: takesPitch ? "" : source.automationToPitch,
    faqQuestions: faqLeft,
  };

  const perTool = { ...framing.perTool, [to]: given };
  if (nicheFramingSetHasAny(left)) perTool[from] = left;
  else delete perTool[from];
  return { ...framing, perTool };
}

/** One owner's rows replaced, with that owner's "where they fail" derived from them as ever. */
export function withEvidenceRows(
  framing: NicheFraming,
  owner: string,
  rows: EvidenceRow[],
): NicheFraming {
  const painPoints = derivePainPoints(rows);
  if (owner === ALL_PARTNERS) return { ...framing, evidence: rows, painPoints };
  const current = framing.perTool[owner] ?? emptyNicheFramingSet();
  return {
    ...framing,
    perTool: { ...framing.perTool, [owner]: { ...current, evidence: rows, painPoints } },
  };
}

/** A row given to another owner: taken out of where it was, added after that owner's last row. */
export function moveEvidenceRow(
  framing: NicheFraming,
  from: { owner: string; index: number },
  to: string,
): NicheFraming {
  if (from.owner === to) return framing;
  const source = evidenceRowsOf(framing, from.owner);
  const row = source[from.index];
  if (!row) return framing;
  const taken = withEvidenceRows(
    framing,
    from.owner,
    source.filter((_, i) => i !== from.index),
  );
  return withEvidenceRows(taken, to, [...evidenceRowsOf(taken, to), row]);
}

/** One search of a partner's crawl, as GeekAPI will make it. */
export type PartnerQuestion = {
  kind: "core" | "row";
  /** Whose text it is: the tool's own box or row, or the category's. */
  source: "tool" | "category";
  /** What the meaning half searches for. */
  need: string;
  /** What the keyword half searches for; empty means the need text is used. */
  keyword: string;
};

/**
 * The searches a partner's crawl gets, in order, from the category framing and that tool's own —
 * the same rule as GeekAPI's `GccToolFraming.Problems` and `RowsToSearch`, read by
 * `GccGroundingResolver.PartnerQuestions`: each statement of the problem first, the tool's own pain
 * point and then the category's core problem, then one search per row — the category's rows, with a
 * tool row that restates the same problem replacing that row in place, and the tool's other rows
 * added after. A row searches on its solution; a row with no solution searches on its problem.
 * Nothing when both sets are empty (GeekAPI then uses the bare keyword). Shown per tool so what is
 * asked of whom is read off the page, not inferred.
 *
 * Both problems since 2026-10-12 (Jeff: "it is not an OR it is both PAIN POINTS"). Until then a tool
 * with a pain point of its own was searched with that in the category's place. One statement typed
 * in both boxes is one search.
 */
export function partnerQuestions(
  category: NicheFramingSet,
  tool: NicheFramingSet | undefined,
): PartnerQuestion[] {
  const out: PartnerQuestion[] = [];
  const toolCore = (tool?.coreProblem ?? "").trim();
  const categoryCore = category.coreProblem.trim();
  if (toolCore) out.push({ kind: "core", source: "tool", need: toolCore, keyword: "" });
  if (categoryCore && categoryCore.toLowerCase() !== toolCore.toLowerCase()) {
    out.push({ kind: "core", source: "category", need: categoryCore, keyword: "" });
  }

  const key = (row: EvidenceRow) => row.problem.trim().toLowerCase();
  const toolRows = (tool?.evidence ?? []).filter(evidenceRowHasAny);
  const merged: { row: EvidenceRow; source: "tool" | "category" }[] = [];
  for (const row of category.evidence.filter(evidenceRowHasAny)) {
    const own = toolRows.find((t) => key(t) && key(t) === key(row));
    merged.push(own ? { row: own, source: "tool" } : { row, source: "category" });
  }
  for (const row of toolRows) {
    if (!merged.some((m) => m.row === row)) merged.push({ row, source: "tool" });
  }
  for (const { row, source } of merged) {
    const need = row.solution.trim() || row.problem.trim();
    if (!need) continue;
    out.push({ kind: "row", source, need, keyword: row.terms.map((t) => t.trim()).filter(Boolean).join(" ") });
  }
  return out;
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
    toneOfVoice: "",
    // Always the full set — not a per-piece choice. E-E-A-T applies to virtually every piece, and
    // the picker that used to let an operator narrow it was removed entirely (2026-09-21), not
    // just defaulted, so there is nothing left to persist here beyond the constant set itself.
    eeatSignals: EEAT_SIGNALS.map((s) => s.value),
    lengthBand: "",
    paaQuestions: [],
    blogFaqQuestions: [],
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
  // The pillar's and the blog's FAQ boxes, in whichever shape the brief was saved with them: questions
  // typed one per line, an array of questions, or rows of a question and its answer (2026-10-13).
  // The older shapes load as rows with no answer, for the operator to answer.
  base.paaQuestions = faqRowsFromStored(p.paaQuestions);
  base.blogFaqQuestions = faqRowsFromStored(p.blogFaqQuestions);
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
  // The tool's FAQ box, read as the pillar's and the blog's are: lines, an array of questions, or rows
  // of a question and its answer (2026-10-13). The older shapes load as rows with no answer.
  set.faqQuestions = faqRowsFromStored(p.faqQuestions);
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

/**
 * The departments a page can be filed under, as the operator types them. GeekAPI's `Departments` is
 * the list Generate checks the taxonomy path against; this is the form's copy of it, as
 * `contentBriefMissingFields` is the form's copy of the fields Generate requires.
 */
export const DEPARTMENTS = ["Accounting", "Customer Service", "Human Resource", "Marketing", "Sales"] as const;

/** Lowercase letters and digits with single hyphens between: GeekAPI's `GccContentPath.Slugify`. */
function departmentSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The first level of a taxonomy path, or "" when the path is empty. Split as GeekAPI splits it
 * (`GccNicheFramingReader.TaxonomyPath`): on "->", ">", "›" or "→".
 */
export function taxonomyFirstLevel(path: string): string {
  const levels = path
    .replaceAll("->", ">")
    .replaceAll("›", ">")
    .replaceAll("→", ">")
    .split(">")
    .map((level) => level.trim())
    .filter((level) => level.length > 0);
  return levels[0] ?? "";
}

/**
 * True when a taxonomy path cannot file a page: it has a first level and that level is not a
 * department. An empty path is not refused. GeekAPI refuses the same paths before a run starts
 * (`GccContentPath.DepartmentRefusal`); until 2026-10-10 it filed such a page under "marketing"
 * without a word.
 */
export function taxonomyPathNamesNoDepartment(path: string): boolean {
  const first = taxonomyFirstLevel(path);
  if (!first) return false;
  const slug = departmentSlug(first);
  return !DEPARTMENTS.some((department) => departmentSlug(department) === slug);
}

/** Required fields for fail-closed Generate (inline validation). */
export function contentBriefMissingFields(brief: ContentBrief): string[] {
  const missing: string[] = [];
  if (!brief.primaryIntent) missing.push("Primary intent");
  if (!brief.buyingStage) missing.push("Buying stage");
  if (!brief.audienceSegment) missing.push("Audience segment");
  if (!brief.audienceNotes.trim()) missing.push("Audience notes");
  if (!brief.angle) missing.push("Angle");
  if (!brief.toneOfVoice) missing.push("Tone of voice");
  if (taxonomyPathNamesNoDepartment(brief.nicheFraming.taxonomyPath)) {
    missing.push(`a department as the taxonomy path's first level (${DEPARTMENTS.join(", ")})`);
  }
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
 * The brief as a Save writes it. Each of the three FAQ boxes is written as an array of rows, a
 * question and its answer, each trimmed, a row with neither left out (`faqRowsToSaved`): the pillar's
 * `paaQuestions`, the blog's `blogFaqQuestions` and each tool's `nicheFraming.perTool[host].faqQuestions`.
 * This is the shape GeekAPI reads since 2026-10-13, when Jeff began supplying the answer to each
 * question. A brief saved before then holds lines, and becomes rows the first time it is saved again.
 *
 * Nothing else in the brief is changed. The form holds a row the operator has added and not yet
 * typed in; this is where such a row is left out of what is saved.
 */
export function briefAsSaved(brief: ContentBrief): ContentBrief {
  const perTool: Record<string, NicheFramingSet> = {};
  for (const [host, set] of Object.entries(brief.nicheFraming.perTool)) {
    perTool[host] = { ...set, faqQuestions: faqRowsToSaved(set.faqQuestions) };
  }
  return {
    ...brief,
    paaQuestions: faqRowsToSaved(brief.paaQuestions),
    blogFaqQuestions: faqRowsToSaved(brief.blogFaqQuestions),
    nicheFraming: {
      ...brief.nicheFraming,
      faqQuestions: faqRowsToSaved(brief.nicheFraming.faqQuestions),
      perTool,
    },
  };
}

/**
 * What a brief says, as one comparable string: the brief as migrated, plus its keyword. Used to tell
 * whether the form differs from what the server holds. `lengthBand` is left out: the brief carries
 * none (it is derived per output type at generate time), and older copies that still hold one say the
 * same thing as copies that do not.
 *
 * A FAQ row is compared as it would be saved, trimmed and with blank rows left out, because the
 * migration reads rows that way. So a row added and not yet typed in is not an unsaved change.
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
 * share a band, and "social"/"ads" pick the closest platform-specific band rather than naming one
 * exactly.
 *
 * The PDF / LinkedIn document has no band. It was given the LinkedIn post's, which is a post's
 * length and not a deck's; a deck is held to its slides (a title and a few lines each), and what its
 * tab states is how many slides it has and how long its post is.
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
};

/**
 * "" for no content type chosen yet, one outside the twenty known values, or the PDF / LinkedIn
 * document, which has none -- no default band.
 * `ContentBrief.lengthBand` is already typed `LengthBandKey | ""` for exactly this state; every
 * real caller resolves a real content type before this result is ever persisted.
 */
export function lengthBandForContentType(startingContentType: string): LengthBandKey | "" {
  return LENGTH_BAND_BY_CONTENT_TYPE[startingContentType] ?? "";
}
