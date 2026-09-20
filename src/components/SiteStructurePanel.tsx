"use client";

import { useEffect, useState } from "react";
import {
  getProjectSiteStructure,
  type SiteStructure,
  type SiteStructureNode,
} from "@/services/gcc-api";

/** Flatten a heading tree into indented rows. Depth carries the nesting; `level` is the page's. */
function hierarchyRows(
  nodes: readonly SiteStructureNode[],
  depth: number,
): Array<{ key: string; depth: number; node: SiteStructureNode }> {
  const rows: Array<{ key: string; depth: number; node: SiteStructureNode }> = [];
  nodes.forEach((node, index) => {
    const key = `${depth}-${index}-${node.level}-${node.headingText}`;
    rows.push({ key, depth, node });
    for (const child of hierarchyRows(node.children ?? [], depth + 1)) {
      rows.push({ ...child, key: `${key}/${child.key}` });
    }
  });
  return rows;
}

/**
 * The structure of the crawl behind a Run ID, shown where the Run ID is obtained.
 *
 * TEMPORARY placement on the Project site step. It answers "is this the site I meant, and did the
 * crawl capture it?" at the moment the operator confirms the URL — before anything downstream is
 * grounded on it. Where it lives once the wizard is settled is a separate decision.
 */
export function SiteStructurePanel({ runId }: { runId: string }) {
  const [data, setData] = useState<SiteStructure | null>(null);
  const [error, setError] = useState<string | null>(null);

  // No synchronous reset here: the parent keys this component by runId, so a different crawl
  // mounts a fresh one rather than clearing state mid-render.
  useEffect(() => {
    let cancelled = false;
    getProjectSiteStructure(runId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load the site structure.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  // Collapsed. It was open while proving the crawl comes back readable; that is established, and
  // on the wizard's first step the subject is the URL, not the tree. Still one click away.
  return (
    <details className="rounded-md border border-[var(--gcc-line)] bg-white p-3 text-xs">
      <summary className="cursor-pointer font-medium text-[var(--gcc-ink)]">
        Site structure
      </summary>

      {error ? (
        <p className="mt-2 text-red-600">{error}</p>
      ) : data === null ? (
        <p className="mt-2 text-[var(--gcc-muted)]">Loading…</p>
      ) : (
        <div className="mt-2">
          <p className="text-[var(--gcc-ink)]">
            {data.pagesConsidered} page{data.pagesConsidered === 1 ? "" : "s"} crawled ·{" "}
            {data.pages.length} with structure · built {data.builtAtUtc}
          </p>

          {/* An extraction failure, not an empty site — said plainly rather than shown as a short tree. */}
          {data.pagesWithoutBlocks > 0 ? (
            <p className="mt-1 text-red-600">
              {data.pagesWithoutBlocks} page
              {data.pagesWithoutBlocks === 1 ? " was" : "s were"} excluded for having no blocks —
              extraction produced nothing for {data.pagesWithoutBlocks === 1 ? "it" : "them"}.
            </p>
          ) : null}

          {data.pages.length === 0 ? (
            <p className="mt-1 text-red-600">No page in this run yielded any headings.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {data.pages.map((page) => (
                <li key={page.pageUrl}>
                  <details>
                    <summary className="cursor-pointer break-all font-medium text-[var(--gcc-ink)]">
                      {page.pageUrl}{" "}
                      <span className="font-normal text-[var(--gcc-muted)]">
                        — {page.roots.length} root{page.roots.length === 1 ? "" : "s"}
                      </span>
                    </summary>
                    <ul className="mt-1">
                      {hierarchyRows(page.roots, 0).map(({ key, depth, node }) => (
                        <li key={key} style={{ paddingLeft: `${depth * 0.75}rem` }}>
                          <span className="text-[var(--gcc-muted)]">
                            H{node.level} {node.headingText || "(no heading text)"}
                          </span>

                          {/* The prose under this heading, in full and unclipped. The meaning is
                              the point — a scroll box or an ellipsis would make this a preview of
                              the crawl rather than the crawl, and you could not tell which. */}
                          {node.paragraphs.length > 0 ? (
                            <ul className="mt-0.5 pl-4">
                              {node.paragraphs.map((text, i) => (
                                <li key={`${key}-p-${i}`} className="text-[var(--gcc-slate)]">
                                  {text}
                                </li>
                              ))}
                            </ul>
                          ) : null}

                          {/* The anchors themselves, not just a count. They are what the heading
                              actually links to, and the reason structure is read from blocks —
                              the flat text projection cannot carry them. */}
                          {node.links.length > 0 ? (
                            <ul className="mt-0.5 mb-1 pl-4">
                              {node.links.map((link, i) => (
                                <li
                                  key={`${key}-link-${i}-${link.href}`}
                                  className="break-all text-[var(--gcc-muted)]"
                                >
                                  <span className="text-[var(--gcc-accent-deep)]">↳</span>{" "}
                                  {link.text || "(no link text)"}{" "}
                                  <span className="font-mono">{link.href}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </details>
  );
}
