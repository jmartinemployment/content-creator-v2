import type { RagCitation } from "./rag-contract";

export function SectionCitations({ citations }: { citations: RagCitation[] }) {
  if (citations.length === 0) return null;

  return (
    <div className="mt-3 border-t border-[var(--cc-line)] pt-3">
      <p className="text-xs font-semibold text-[var(--cc-ink)]">
        Verified citations
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {citations.map((citation, index) => (
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
            <span className="ml-2 text-[var(--cc-muted)]">
              {citation.verified === false ? "verification warning" : "verified"}
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
        ))}
      </ul>
    </div>
  );
}
