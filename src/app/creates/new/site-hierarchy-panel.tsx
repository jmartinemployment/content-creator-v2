"use client";

export type SiteHierarchyLink = {
  text: string;
  href: string;
  rel?: string;
};

export type SiteHierarchyNode = {
  level: number;
  headingText: string;
  paragraphs?: string[];
  links?: SiteHierarchyLink[];
  children?: SiteHierarchyNode[];
};

export type SiteHierarchyPage = {
  pageUrl: string;
  roots: SiteHierarchyNode[];
};

export type SiteHierarchy = {
  homepageUrl: string;
  viewport: string;
  builtAtUtc: string;
  pages: SiteHierarchyPage[];
};

function countNodes(nodes: SiteHierarchyNode[]): number {
  let n = 0;
  for (const node of nodes) {
    n += 1;
    if (node.children?.length) n += countNodes(node.children);
  }
  return n;
}

function countLinks(nodes: SiteHierarchyNode[]): number {
  let n = 0;
  for (const node of nodes) {
    n += node.links?.length ?? 0;
    if (node.children?.length) n += countLinks(node.children);
  }
  return n;
}

function HierarchyNodeView({ node }: { node: SiteHierarchyNode }) {
  const pad = Math.max(0, (node.level - 1) * 12);
  return (
    <li className="flex flex-col gap-1">
      <div style={{ paddingLeft: pad }} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-[var(--cc-muted)]">
          h{node.level}
        </span>
        <span className="text-sm font-medium text-[var(--cc-ink)]">
          {node.headingText || "(empty heading)"}
        </span>
      </div>
      {node.links && node.links.length > 0 ? (
        <ul
          style={{ paddingLeft: pad + 28 }}
          className="flex list-disc flex-col gap-0.5 text-xs text-[var(--cc-muted)]"
        >
          {node.links.map((link, i) => (
            <li key={`${link.href}-${link.text}-${i}`}>
              <span className="text-[var(--cc-ink)]">{link.text}</span>
              {" · "}
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="break-all text-[var(--cc-accent)] underline-offset-2 hover:underline"
              >
                {link.href}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {node.children && node.children.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {node.children.map((child, i) => (
            <HierarchyNodeView key={`${child.level}-${child.headingText}-${i}`} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function HierarchyPageView({ page }: { page: SiteHierarchyPage }) {
  const roots = page.roots ?? [];
  const nodeCount = countNodes(roots);
  const linkCount = countLinks(roots);

  return (
    <section className="flex flex-col gap-2 rounded-md border border-[var(--cc-line)] bg-white p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-[var(--cc-muted)]">
        <a
          href={page.pageUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-[var(--cc-accent)] underline-offset-2 hover:underline"
        >
          {page.pageUrl}
        </a>
        <span>
          · {nodeCount} heading{nodeCount === 1 ? "" : "s"} · {linkCount} anchor
          {linkCount === 1 ? "" : "s"}
        </span>
      </div>
      {roots.length === 0 ? (
        <p className="text-xs text-[var(--cc-muted)]">No headings on this page.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {roots.map((node, i) => (
            <HierarchyNodeView key={`${node.level}-${node.headingText}-${i}`} node={node} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function SiteHierarchyPanel({ hierarchy }: { hierarchy: SiteHierarchy | null | undefined }) {
  if (!hierarchy) {
    return (
      <div className="flex flex-col gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
        <h3 className="text-sm font-semibold text-amber-950">Site hierarchy</h3>
        <p className="text-xs text-amber-900">
          Mobile hierarchy was not attached (browser unavailable or fetch soft-failed). Partner
          tools may still come from the project-site crawl.
        </p>
      </div>
    );
  }

  const pages = hierarchy.pages ?? [];
  const totalNodes = pages.reduce((sum, p) => sum + countNodes(p.roots ?? []), 0);
  const totalLinks = pages.reduce((sum, p) => sum + countLinks(p.roots ?? []), 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-[var(--cc-ink)]">Site hierarchy (mobile crawl)</h3>
        <p className="text-xs text-[var(--cc-muted)]">
          Per-page heading trees with anchors kept under their headings — used for partner-tool
          matching. Intentional mobile vs desktop differences (e.g. no hero) are expected.
        </p>
        <p className="text-xs text-[var(--cc-muted)]">
          <span className="font-medium text-[var(--cc-ink)]">{hierarchy.viewport || "mobile"}</span>
          {" · "}
          <span className="font-medium text-[var(--cc-ink)]">{hierarchy.homepageUrl}</span>
          {" · "}
          {pages.length} page{pages.length === 1 ? "" : "s"}
          {" · "}
          {totalNodes} heading{totalNodes === 1 ? "" : "s"}
          {" · "}
          {totalLinks} anchor{totalLinks === 1 ? "" : "s"}
          {hierarchy.builtAtUtc ? (
            <>
              {" · "}
              built {new Date(hierarchy.builtAtUtc).toLocaleString()}
            </>
          ) : null}
        </p>
      </div>

      {pages.length === 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Hierarchy attached but no tool-relevant pages were found in the crawl.
        </p>
      ) : (
        <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
          {pages.map((page) => (
            <HierarchyPageView key={page.pageUrl} page={page} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Normalize API casing (camel or Pascal) into the frontend shape. */
export function normalizeSiteHierarchy(raw: unknown): SiteHierarchy | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const homepageUrl = String(o.homepageUrl ?? o.HomepageUrl ?? "").trim();
  const viewport = String(o.viewport ?? o.Viewport ?? "mobile").trim() || "mobile";
  const builtAtUtc = String(o.builtAtUtc ?? o.BuiltAtUtc ?? "").trim();
  const pagesRaw = o.pages ?? o.Pages;
  if (!Array.isArray(pagesRaw)) return null;

  const pages: SiteHierarchyPage[] = pagesRaw.map((page) => {
    const p = (page ?? {}) as Record<string, unknown>;
    return {
      pageUrl: String(p.pageUrl ?? p.PageUrl ?? homepageUrl).trim(),
      roots: normalizeNodes(p.roots ?? p.Roots),
    };
  });

  if (!homepageUrl && pages.length === 0) return null;
  return {
    homepageUrl: homepageUrl || pages[0]?.pageUrl || "",
    viewport,
    builtAtUtc,
    pages,
  };
}

function normalizeNodes(raw: unknown): SiteHierarchyNode[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const n = (item ?? {}) as Record<string, unknown>;
    const linksRaw = n.links ?? n.Links;
    const links: SiteHierarchyLink[] = Array.isArray(linksRaw)
      ? linksRaw.map((l) => {
          const link = (l ?? {}) as Record<string, unknown>;
          return {
            text: String(link.text ?? link.Text ?? "").trim(),
            href: String(link.href ?? link.Href ?? "").trim(),
            rel: String(link.rel ?? link.Rel ?? "").trim() || undefined,
          };
        })
      : [];
    return {
      level: Number(n.level ?? n.Level ?? 0) || 0,
      headingText: String(n.headingText ?? n.HeadingText ?? "").trim(),
      paragraphs: Array.isArray(n.paragraphs ?? n.Paragraphs)
        ? ((n.paragraphs ?? n.Paragraphs) as unknown[]).map((x) => String(x))
        : [],
      links,
      children: normalizeNodes(n.children ?? n.Children),
    };
  });
}
