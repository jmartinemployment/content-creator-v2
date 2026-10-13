import { CONTENT_TYPES } from "@/lib/content-types";
import { draftWrittenLabel, runRecord } from "@/lib/content-creator/run-display";
import type { GccArtifact } from "@/services/gcc-api";

/**
 * Repurpose: a short piece (an email, a social post, an ad) is written from one approved page of the
 * project and saved under it. Jeff, 2026-10-12: short content types "ARE DERIVED OR REPURPOSED FROM
 * EXISTING CONTENT".
 *
 * Until then "Email — cold outreach", "Social" and "Ads" were ticked on Generate and written from the
 * brief alone, with no page in front of the writer. GeekAPI now refuses them there
 * (`GccRepurpose.GenerateRefusal`, GeekBackend), so the picker does not offer them and each has its
 * place on the page it is written from. What is here is what the screen needs to say about that:
 * which types these are, which pages they can be written from, which pieces a page already has, and
 * what a Generate deletes with a page it writes again.
 */

/** The pieces Repurpose writes, in the order they are offered. Each is a tab of the Output. */
export const REPURPOSE_TYPES: readonly string[] = ["email-cold-outreach", "social", "ads"];

/** Letters only, lower case: how GeekAPI compares a content type, so "aiTool" and "tool" are one. */
function lettersOf(type: string | null | undefined): string {
  return (type ?? "").replace(/[^a-zA-Z]/g, "").toLowerCase();
}

const REPURPOSE_LETTERS = new Set(REPURPOSE_TYPES.map(lettersOf));
const SOURCE_LETTERS = new Set(["pillar", "blog", "tool", "aitool"]);

/** Whether a content type is written by Repurpose, and so is not offered on Generate. */
export function isRepurposeType(type: string | null | undefined): boolean {
  return REPURPOSE_LETTERS.has(lettersOf(type));
}

/**
 * Whether a page is one a piece can be written from: a pillar, a blog or a tool page of the
 * project's own. A piece written from a page is not itself a page to write from.
 */
export function isRepurposeSource(artifact: GccArtifact | null | undefined): boolean {
  return !!artifact && !artifact.parentArtifactId && SOURCE_LETTERS.has(lettersOf(artifact.type));
}

/** The pieces written from a page, in the order they are offered. */
export function piecesOf(page: GccArtifact, artifacts: readonly GccArtifact[]): GccArtifact[] {
  const order = (a: GccArtifact) => {
    const at = REPURPOSE_TYPES.findIndex((t) => lettersOf(t) === lettersOf(a.type));
    return at < 0 ? REPURPOSE_TYPES.length : at;
  };
  return artifacts.filter((a) => a.parentArtifactId === page.id).sort((a, b) => order(a) - order(b));
}

/** The piece of one type written from a page, or null. A page has at most one of each type. */
export function pieceOfType(
  page: GccArtifact,
  type: string,
  artifacts: readonly GccArtifact[],
): GccArtifact | null {
  return artifacts.find((a) => a.parentArtifactId === page.id && lettersOf(a.type) === lettersOf(type)) ?? null;
}

/** The page a piece was written from, or null for a page of the project's own. */
export function pageOf(piece: GccArtifact, artifacts: readonly GccArtifact[]): GccArtifact | null {
  if (!piece.parentArtifactId) return null;
  return artifacts.find((a) => a.id === piece.parentArtifactId) ?? null;
}

/** "pillar", "blog" or "tool" for a page a piece can be written from; the stored letters otherwise. */
function kindOf(type: string | null | undefined): string {
  const letters = lettersOf(type);
  return letters === "aitool" ? "tool" : letters;
}

/** A content type as the screen names it ("Tool page"), or the type as stored when it has no name. */
function typeLabel(type: string): string {
  return CONTENT_TYPES.find((t) => lettersOf(t.value) === kindOf(type))?.label ?? type;
}

/**
 * What a page is called where a piece says where it came from: "the Pillar", "the Blog", and for a
 * tool page its product, "the Tool page “Ramp”", because a project has several tool pages.
 */
export function sourceLabel(page: GccArtifact): string {
  const label = typeLabel(page.type);
  return kindOf(page.type) === "tool" ? `the ${label} \u201c${page.name}\u201d` : `the ${label}`;
}

/**
 * The name on a piece's button in its tab. A piece carries its page's name, and a pillar and a blog
 * are both named for the keyword, so two emails would read alike: each says its page.
 */
export function pieceButtonLabel(piece: GccArtifact, artifacts: readonly GccArtifact[]): string {
  const page = pageOf(piece, artifacts);
  if (!page) return piece.name || piece.type;
  return `From ${sourceLabel(page)}`;
}

/**
 * What a Generate says under its list when a page it is about to write again has pieces under it:
 * they are deleted with it. Null when no ticked page has any. A line of text, not a panel and not an
 * extra click: writing the page again is what was asked for.
 *
 * When tool pages are ticked for some partners and not all, which tool pages the run writes is the
 * server's to say (it names them from the partners' crawls), so their pieces are not counted here
 * and the line says the rule instead of a number that could be wrong.
 */
export function deletedPiecesLine(
  outputTypes: readonly string[],
  artifacts: readonly GccArtifact[],
  /** True when tool pages are ticked for some of the project's partners and not all. */
  toolsNarrowed: boolean,
): string | null {
  const ticked = new Set(outputTypes.map(kindOf));
  const withPieces = artifacts
    .filter((a) => isRepurposeSource(a) && ticked.has(kindOf(a.type)))
    .map((page) => ({ page, pieces: piecesOf(page, artifacts).length }))
    .filter((row) => row.pieces > 0);

  const counted = withPieces.filter((row) => !(toolsNarrowed && kindOf(row.page.type) === "tool"));
  const toolRule = withPieces.length > counted.length
    ? "A tool page written this run loses the pieces Repurpose wrote from it."
    : "";

  if (counted.length === 0) return toolRule || null;

  const total = counted.reduce((sum, row) => sum + row.pieces, 0);
  const pieces = total === 1 ? "the 1 piece" : `the ${total} pieces`;
  const line = counted.length === 1
    ? `Writing ${sourceLabel(counted[0].page)} again deletes ${pieces} Repurpose wrote from it.`
    : `Writing these pages again deletes ${pieces} Repurpose wrote from them: ${counted
        .map((row) => `${row.pieces} from ${sourceLabel(row.page)}`)
        .join(", ")}.`;
  return toolRule ? `${line} ${toolRule}` : line;
}

/**
 * A page's last Repurpose, as the page says it when it opens: that it ended, when, and what it left.
 * What it refused, and why, is in the record's own lists.
 */
export function lastRepurposeLines(
  run: { status: string; finishedAtUtc?: string | null; resultJson?: string | null; error?: string | null },
  now: Date = new Date(),
  timeZone?: string,
  locale?: string,
): string[] {
  const when = run.finishedAtUtc ? draftWrittenLabel(run.finishedAtUtc, now, timeZone, locale) : "";
  const at = when ? ` at ${when}` : "";

  if (run.status === "failed") {
    return [`The last Repurpose of this page failed${at}: ${run.error?.trim() || "no reason was recorded."}`];
  }

  const saved = runRecord(run.resultJson)?.savedIds ?? null;
  if (saved === null) return [`The last Repurpose of this page finished${at}.`];
  return [`The last Repurpose of this page finished${at}. ${repurposeSavedLine(saved.length)}`];
}

/** What a finished Repurpose left under its page, in a sentence. */
export function repurposeSavedLine(saved: number): string {
  if (saved === 0) return "It saved no pieces.";
  return saved === 1 ? "It saved 1 piece, listed below." : `It saved ${saved} pieces, listed below.`;
}
