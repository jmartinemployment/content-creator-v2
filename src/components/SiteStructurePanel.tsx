"use client";

import { useEffect, useState } from "react";
import {
  getProjectSiteHierarchy,
  type ProjectSiteHierarchyResponse,
  type SiteHierarchyNode,
} from "@/services/gcc-api";

/** Flatten a heading tree into indented rows. Depth carries the nesting; `level` is the page's. */
function hierarchyRows(
  nodes: readonly SiteHierarchyNode[],
  depth: number,
): Array<{ key: string; depth: number; node: SiteHierarchyNode }> {
  const rows: Array<{ key: string; depth: number; node: SiteHierarchyNode }> = [];
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
  const [data, setData] = useState<ProjectSiteHierarchyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // No synchronous reset here: the parent keys this component by runId, so a different crawl
  // mounts a fresh one rather than clearing state mid-render.
  useEffect(() => {
    let cancelled = false;
    getProjectSiteHierarchy(runId)
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

  const hierarchy = data?.siteHierarchy ?? null;

  return (
    <details className="rounded-md border border-[var(--gcc-line)] bg-white p-3 text-xs">
      <summary className="cursor-pointer font-medium text-[var(--gcc-ink)]">
        Site structure
      </summary>

      {error ? (
        <p className="mt-2 text-red-600">{error}</p>
      ) : data === null ? (
        <p className="mt-2 text-[var(--gcc-muted)]">Loading…</p>
      ) : hierarchy === null ? (
        <p className="mt-2 text-red-600">
          No hierarchy was built for this run — either the seed URL would not normalize, or every
          crawled page was filtered out.
        </p>
      ) : hierarchy.pages.length === 0 ? (
        <p className="mt-2 text-red-600">No page survived the homepage/hub filter.</p>
      ) : (
        <div className="mt-2">
          <p className="break-all text-[var(--gcc-ink)]">
            {hierarchy.homepageUrl} · {hierarchy.pages.length} page
            {hierarchy.pages.length === 1 ? "" : "s"} · {hierarchy.viewport} · built{" "}
            {hierarchy.builtAtUtc}
          </p>
          <p className="mt-0.5 text-[var(--gcc-muted)]">
            Filtered server-side to the homepage, tool/use-case hubs, and pages with 2+ link groups —
            a short list off a large crawl is the filter working, not a broken crawl.
          </p>
          <ul className="mt-2 space-y-2">
            {hierarchy.pages.map((page) => (
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
                      <li
                        key={key}
                        className="text-[var(--gcc-muted)]"
                        style={{ paddingLeft: `${depth * 0.75}rem` }}
                      >
                        H{node.level} {node.headingText || "(no heading text)"}
                        {node.links.length > 0 ? (
                          <span className="text-[var(--gcc-accent-deep)]">
                            {" "}
                            · {node.links.length} link{node.links.length === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}
