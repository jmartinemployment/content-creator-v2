import { CONTENT_TYPES } from "@/lib/content-types";
import { draftWrittenLabel, runRecord } from "@/lib/content-creator/run-display";
import type { GccArtifact } from "@/services/gcc-api";

/**
 * A short piece (an email, a social post, an ad) is written from one page of the project and saved
 * under it, never from the brief alone. Jeff, 2026-10-12: short content types "ARE DERIVED OR
 * REPURPOSED FROM EXISTING CONTENT".
 *
 * Two runs write one. Generate does when the piece is ticked under "Content type" (Jeff, 2026-10-13:
 * "Add my Email, Social, and Ads, back to generate"): from the project's Pillar, the one that run
 * writes or the one already saved, or from its Blog when it has no Pillar. Repurpose, under "Approve &
 * export" on an approved pillar, blog or tool page, writes it again from that page without running
 * Generate. From 2026-10-12 to 2026-10-13 only Repurpose did, and the picker left the three out.
 *
 * What is here is what the screen needs to say about that: which types these are, which page a
 * Generate writes them from, which pieces a page already has, and what a Generate deletes.
 */

/** The short pieces, in the order they are offered. Each is a tab of the Output. */
export const REPURPOSE_TYPES: readonly string[] = ["email-cold-outreach", "social", "ads"];

/** Letters only, lower case: how GeekAPI compares a content type, so "aiTool" and "tool" are one. */
function lettersOf(type: string | null | undefined): string {
  return (type ?? "").replace(/[^a-zA-Z]/g, "").toLowerCase();
}

const REPURPOSE_LETTERS = new Set(REPURPOSE_TYPES.map(lettersOf));
const SOURCE_LETTERS = new Set(["pillar", "blog", "tool", "aitool"]);

/** Whether a content type is a short piece: an email, a social post or an ad, written from a page. */
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
 * The page a Generate writes its ticked short pieces from, by the rule GeekAPI uses
 * (`GccRepurpose.GenerateSourceOf`, GeekBackend): the project's Pillar, the one this run writes when
 * "Pillar" is ticked and otherwise the one already saved; with no Pillar, its Blog by the same rule.
 *
 * Null when no short piece is ticked. `page` is null when one is ticked and the project has neither
 * page and neither is ticked: there is nothing to write it from, and the server refuses the run.
 */
export function generateSourceOf(
  outputTypes: readonly string[],
  artifacts: readonly GccArtifact[],
): { page: "pillar" | "blog" | null; thisRun: boolean } | null {
  if (!outputTypes.some(isRepurposeType)) return null;
  const ticked = new Set(outputTypes.map(kindOf));
  for (const page of ["pillar", "blog"] as const) {
    if (ticked.has(page)) return { page, thisRun: true };
    if (artifacts.some((a) => !a.parentArtifactId && kindOf(a.type) === page)) return { page, thisRun: false };
  }
  return { page: null, thisRun: false };
}

/** The ticked short pieces by the names on the list, joined: "Email — cold outreach, Social". */
function tickedPieces(outputTypes: readonly string[]): string {
  return REPURPOSE_TYPES.filter((t) => outputTypes.some((o) => lettersOf(o) === lettersOf(t)))
    .map(typeLabel)
    .join(", ");
}

/**
 * What Generate says, and is held for, when a short piece is ticked and there is no page to write it
 * from. Null when nothing is ticked that needs one, or when there is one.
 */
export function nothingToWriteFromLine(
  outputTypes: readonly string[],
  artifacts: readonly GccArtifact[],
): string | null {
  const source = generateSourceOf(outputTypes, artifacts);
  if (!source || source.page) return null;
  const several = outputTypes.filter(isRepurposeType).length > 1;
  return `${tickedPieces(outputTypes)} ${several ? "are" : "is"} written from this project's Pillar, or from its Blog when it has no Pillar, and it has neither. Tick Pillar as well.`;
}

/**
 * What a Generate says under its list about what it deletes before it writes. Null when it deletes
 * no piece. A line of text, not a panel and not an extra click: writing again is what was asked for.
 *
 * Two things delete a piece. A page written again loses the pieces written from it, whatever their
 * type. And a short piece that is ticked is written once for the project, so every one of that type
 * the project already has goes first: the one under the Pillar, one Repurpose wrote from another
 * page, and one an older Generate saved under no page. A piece is counted once.
 *
 * When tool pages are ticked for some partners and not all, which tool pages the run writes is the
 * server's to say (it names them from the partners' crawls), so the pieces under them are not counted
 * here and the line says the rule instead of a number that could be wrong.
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
    .map((page) => ({ page, pieces: piecesOf(page, artifacts) }))
    .filter((row) => row.pieces.length > 0);

  const counted = withPieces.filter((row) => !(toolsNarrowed && kindOf(row.page.type) === "tool"));
  const lines: string[] = [];
  if (counted.length > 0) {
    const total = counted.reduce((sum, row) => sum + row.pieces.length, 0);
    const pieces = total === 1 ? "the 1 piece" : `the ${total} pieces`;
    lines.push(
      counted.length === 1
        ? `Writing ${sourceLabel(counted[0].page)} again deletes ${pieces} written from it.`
        : `Writing these pages again deletes ${pieces} written from them: ${counted
            .map((row) => `${row.pieces.length} from ${sourceLabel(row.page)}`)
            .join(", ")}.`,
    );
  }
  if (withPieces.length > counted.length) {
    lines.push("A tool page written this run loses the pieces written from it.");
  }

  // The ticked short pieces the project already has, apart from those counted with a page above.
  const withAPage = new Set(counted.flatMap((row) => row.pieces.map((piece) => piece.id)));
  const already = artifacts.filter(
    (a) => isRepurposeType(a.type) && ticked.has(kindOf(a.type)) && !withAPage.has(a.id),
  ).length;
  if (already > 0) {
    const what = tickedPieces(outputTypes);
    lines.push(
      already === 1
        ? `Writing ${what} again deletes the 1 this project already has.`
        : `Writing ${what} again deletes the ${already} this project already has.`,
    );
  }

  return lines.length > 0 ? lines.join(" ") : null;
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
