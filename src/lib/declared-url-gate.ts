/**
 * Which declared URLs have no index behind them.
 *
 * `plans/validate-partner-competitor-urls.md`: "does an index exist for it? Green if yes, red if
 * no. That is the whole check. One question, one answer." Indexed, or not. A URL with no answer is
 * not indexed — the operator does the same thing about it either way, which is the reason that plan
 * deleted the syntax layer too.
 *
 * Here rather than inside `ProjectForm` for two reasons: the test runner is `node --test` with no
 * DOM, so a check living in the component could not be tested; and partner and competitor are one
 * rule, so they get one implementation.
 */

/**
 * What the index said about one URL. Absent means no answer, which is not evidence.
 *
 * `usable` rather than `indexed`: a crawl that was blocked at its first page still puts a row in
 * the index, so "does an index exist" passes on a corpus a writer can do nothing with. The server
 * decides usability once, from the run's own page and chunk counts.
 */
export type IndexAnswer = { usable: boolean } | undefined;

/** The entered URLs that cannot be written from. These are excluded, not saved. */
export function unindexedUrls(
  urls: readonly string[],
  answers: Readonly<Record<string, IndexAnswer>>,
): string[] {
  return deduped(urls).filter((url) => answers[url]?.usable !== true);
}

/**
 * The entered URLs that can be written from — the ones the project is actually saved with.
 *
 * The floor of five is measured on this, not on what was typed. Counting declared URLs against the
 * floor while separately requiring every declared URL to be usable is two rules over two different
 * sets, and it meant a sixth partner with no crawl behind it disabled a project that already had
 * five good ones. An extra URL could only ever hurt. Five good partners are five good partners
 * whether a sixth was entered or not.
 *
 * Pairs with {@link unindexedUrls} over the same answers, so every entered URL lands in exactly one
 * of the two lists and "usable" has one definition rather than two.
 */
export function usableUrls(
  urls: readonly string[],
  answers: Readonly<Record<string, IndexAnswer>>,
): string[] {
  return deduped(urls).filter((url) => answers[url]?.usable === true);
}

/** The same URL typed twice is one URL, so it is counted and named once. */
function deduped(urls: readonly string[]): string[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}
