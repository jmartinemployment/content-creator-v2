/** The partner pre-flight's shape, narrowed to what these predicates read. */
export type PreflightPartnerCounts = {
  pagesAttempted: number;
  pagesFailed: number;
};

/**
 * True when extraction failed on every page it attempted, across every partner — a provider fault.
 *
 * **Nothing extracted looks exactly like nothing to extract**: both leave every counter at zero. The
 * backend carries the distinction ("provider call threw -- this is a fault, not a data shortage") but
 * it sits in a detail line under a headline built from the counts, and the headline is what gets read.
 * On 2026-10-03 this panel reported a `400` and then a `429` as five unusable partners.
 *
 * `pagesAttempted > 0` guards the SET, not each partner. Inside `.every()` it meant one partner that
 * attempted nothing — which `AssessPartnerToolReadinessAsync` really does produce, returning
 * `PagesAttempted: 0` for a slice with no retrieved pages — flipped the whole predicate false and
 * reverted the headline to blaming the operator's data, while the other rows still said "extraction
 * failed on all N pages" because the per-partner branch is computed independently.
 */
export function everyPartnerFailedExtraction(
  partners: readonly PreflightPartnerCounts[],
): boolean {
  return (
    partners.some((p) => p.pagesAttempted > 0) &&
    partners.every((p) => p.pagesFailed >= p.pagesAttempted)
  );
}
