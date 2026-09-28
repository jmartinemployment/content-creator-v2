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

/** What the index said about one URL. Absent means no answer, which is not an index. */
export type IndexAnswer = { indexed: boolean } | undefined;

/** The entered URLs with no index. Empty means the list may be saved. */
export function unindexedUrls(
  urls: readonly string[],
  answers: Readonly<Record<string, IndexAnswer>>,
): string[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    // The same URL typed twice is one URL to crawl, so it is named once.
    if (seen.has(url)) return false;
    seen.add(url);
    return answers[url]?.indexed !== true;
  });
}
