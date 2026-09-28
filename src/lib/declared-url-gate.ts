/**
 * Whether the URLs declared on a project may be saved: does an index exist for each one?
 *
 * `plans/validate-partner-competitor-urls.md` is the mandate — "Create submit blocked while any
 * entered URL is red. Same rule for both lists: an empty list blocks nothing; a list containing an
 * unindexed URL blocks submit." The lookup, the colouring and the host normalisation all shipped in
 * `fd5c920`; the block did not. Its only submit guard read `siteUrls.length`, never an index answer,
 * so every partner and competitor answer was rendered and consumed by nothing.
 *
 * This lives outside the component for two reasons. The test runner is `node --test` over
 * `src/**` with no DOM (`package.json`), so a verdict computed inside `ProjectForm` could not be
 * tested at all. And partner and competitor are the same rule: one implementation, two call sites,
 * rather than two that can drift.
 */

/** What the index said about one URL. `undefined` means nobody has asked yet, or the ask failed. */
export type IndexAnswer = { indexed: boolean } | undefined;

export type GateVerdict =
  | { ok: true }
  | { ok: false; reason: "unindexed"; urls: string[] }
  | { ok: false; reason: "unchecked"; urls: string[] };

/**
 * The verdict for one declared list.
 *
 * `unindexed` and `unchecked` are deliberately separate. `fd5c920` set the rule and it still holds:
 * "A failed check leaves URLs unmarked ... The check not running is not a verdict about the URL."
 * Both block — a URL nobody could ask about is not evidence that a crawl exists — but only
 * `unindexed` means "go crawl this", and only `unchecked` means the index could not answer.
 *
 * When a list has both, `unindexed` is reported: it is the half the operator can act on.
 */
export function gateDeclaredUrls(
  urls: readonly string[],
  answers: Readonly<Record<string, IndexAnswer>>,
): GateVerdict {
  // An empty list blocks nothing. A client with no declared partners is a client with no declared
  // partners, not a project waiting on evidence.
  if (urls.length === 0) return { ok: true };

  const unindexed: string[] = [];
  const unchecked: string[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    // The same URL typed twice is one URL to crawl, so it is named once in the refusal.
    if (seen.has(url)) continue;
    seen.add(url);

    const answer = answers[url];
    if (answer === undefined) unchecked.push(url);
    else if (!answer.indexed) unindexed.push(url);
  }

  if (unindexed.length > 0) return { ok: false, reason: "unindexed", urls: unindexed };
  if (unchecked.length > 0) return { ok: false, reason: "unchecked", urls: unchecked };
  return { ok: true };
}

/** The refusal, in the operator's terms, naming what to do about it. */
export function describeVerdict(verdict: GateVerdict, label: string): string | null {
  if (verdict.ok) return null;
  const list = verdict.urls.join(", ");
  return verdict.reason === "unindexed"
    ? `${label}: no crawl exists for ${list}. Crawl and index it, then try again.`
    : `${label}: the index could not be reached, so ${list} could not be checked.`;
}
