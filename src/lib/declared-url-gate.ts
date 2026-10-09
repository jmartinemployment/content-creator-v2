/**
 * What the index said about each declared URL, read for display.
 *
 * The form shows every URL's answer as it is entered — green with its page and chunk counts, amber
 * with the server's reason — and names the ones Generate will refuse as things stand. It does not
 * decide what is saved: a project is saved with every URL the operator declared
 * ({@link declaredUrls}), and whether each can be written from is asked again when Generate is
 * pressed, which refuses until every declared URL has a usable crawl. Until 2026-10-09 the save read
 * these answers too, and refused or excluded on them; a URL whose crawl was still being indexed was
 * enough to stop the Profile saving.
 *
 * Here rather than inside `ProjectForm` for two reasons: the test runner is `node --test` with no
 * DOM, so a rule living in the component could not be tested; and partner and competitor are one
 * rule, so they get one implementation.
 */

/**
 * What the index said about one URL. Absent means no answer, which is not evidence.
 *
 * `usable` rather than `indexed`: a crawl that was blocked at its first page still puts a row in
 * the index, so "does an index exist" passes on a corpus a writer can do nothing with. The server
 * decides usability once, from the run's own page and chunk counts and a search of the index.
 */
export type IndexAnswer = { usable: boolean } | undefined;

/** The declared URLs Generate would refuse now: no usable crawl behind them, or no answer yet. */
export function unindexedUrls(
  urls: readonly string[],
  answers: Readonly<Record<string, IndexAnswer>>,
): string[] {
  return declaredUrls(urls).filter((url) => answers[url]?.usable !== true);
}

/**
 * The declared URLs that can be written from now.
 *
 * Pairs with {@link unindexedUrls} over the same answers, so every declared URL lands in exactly one
 * of the two lists and "usable" has one definition rather than two.
 */
export function usableUrls(
  urls: readonly string[],
  answers: Readonly<Record<string, IndexAnswer>>,
): string[] {
  return declaredUrls(urls).filter((url) => answers[url]?.usable === true);
}

/**
 * What the project is saved with: every URL the operator declared, each once, in its first spelling.
 *
 * Compared without regard to case, which is how the server distinguishes them
 * (`GccDeclaredUrlValidator.Clean`) — so the form counts toward the five exactly what the server
 * will count, and a URL re-typed in capitals is not a sixth URL here and a fifth one there.
 */
export function declaredUrls(urls: readonly string[]): string[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    const key = url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
