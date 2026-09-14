import type { RagCitation } from "./rag-contract";

function isVerified(citation: RagCitation): boolean {
  return citation.verified === true;
}

export function SectionCitations({ citations }: { citations: RagCitation[] }) {
  if (citations.length === 0) return null;

  const verified = citations.filter(isVerified);
  const unverified = citations.filter((c) => !isVerified(c));
  const allVerified = unverified.length === 0;

  return (
    <div className="mt-3 border-t border-[var(--cc-line)] pt-3" aria-label="Citations">
      <p className="text-xs font-semibold text-[var(--cc-ink)]">
        {allVerified ? "Verified citations" : "Citations"}
        {!allVerified ? (
          <span className="ml-2 font-normal text-amber-800">
            {verified.length} verified · {unverified.length} need review
          </span>
        ) : null}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {citations.map((citation, index) => {
          const ok = isVerified(citation);
          return (
            <li key={`${citation.pageId ?? citation.url}-${index}`} className="text-xs">
              <blockquote className="border-l-2 border-[var(--cc-accent)] pl-2 italic">
                “{citation.quote}”
              </blockquote>
              <a
                href={citation.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex text-[var(--cc-accent)] hover:underline"
              >
                {citation.title || citation.url}
              </a>
              <span className={`ml-2 ${ok ? "text-[var(--cc-muted)]" : "font-semibold text-amber-800"}`}>
                {ok ? "verified" : citation.verified === false ? "not verified" : "unverified"}
                {citation.crawlType ? ` · ${citation.crawlType}` : ""}
              </span>
              {citation.assetVersionId || citation.coordinates ? (
                <span className="mt-1 block text-[var(--cc-muted)]">
                  {citation.assetVersionId ? `Exact revision ${citation.assetVersionId}` : "Exact source coordinates"}
                  {citation.coordinates?.page ? ` · page ${citation.coordinates.page}` : ""}
                  {citation.coordinates?.slide ? ` · slide ${citation.coordinates.slide}` : ""}
                  {citation.coordinates?.sheet ? ` · ${citation.coordinates.sheet}${citation.coordinates.cellRange ? ` ${citation.coordinates.cellRange}` : ""}` : ""}
                  {typeof citation.coordinates?.timeStartSeconds === "number" ? ` · ${citation.coordinates.timeStartSeconds}s–${citation.coordinates.timeEndSeconds ?? "?"}s` : ""}
                  {citation.coordinates?.region ? ` · region ${citation.coordinates.region}` : ""}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Count only quote-verified citations for Canvas chrome. */
export function countVerifiedCitations(citations: RagCitation[]): number {
  return citations.filter(isVerified).length;
}
