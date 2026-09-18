export type HierarchyMatchKind = "exact-heading" | "contains-heading" | "exact-page" | "contains-page";

export type ToolsByHeading = {
  heading: string;
  tools: Array<{ name: string; href?: string }>;
};

export type HierarchyMatch = {
  path: string[];
  childHeadings: string[];
  /**
   * Tools under the matched heading, as GeekAPI resolved them from the section tree's
   * anchors. Structured on the wire — never re-derived here from a flattened text slice.
   */
  toolsByHeading: ToolsByHeading[];
  sourcePageUrl: string;
  matchedHeading: string;
  kind: HierarchyMatchKind;
};

const KIND_RANK: Record<HierarchyMatchKind, number> = {
  "exact-heading": 0,
  "exact-page": 1,
  "contains-heading": 2,
  "contains-page": 3,
};

/**
 * Same page under `www.` and bare host, and the twin responsive copies of one section, are the
 * same match. Normalize both axes so the list shows distinct sections, not crawl artefacts.
 */
function dedupeUrl(url: string): string {
  const trimmed = (url || "").trim();
  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "")
      .toLowerCase();
  }
}

function dedupePath(path: readonly string[]): string {
  return path.map((p) => p.replace(/\s+/g, " ").trim().toLowerCase()).join("\0");
}

/** A section that appeared more than once — a crawl defect, reported rather than hidden. */
export type DuplicateMatchGroup = {
  readonly path: string;
  readonly sourcePageUrls: readonly string[];
  readonly count: number;
};

/**
 * Duplicates are an error, not something to collapse.
 *
 * One section must produce one match. More than one means the crawl is wrong — the same page
 * stored under two hostnames (canonical not honoured), or two responsive copies of the markup
 * both indexed. Silently keeping the "best" copy would hide the defect and leave the operator
 * choosing between rows that should not both exist.
 */
export function findDuplicateMatches(matches: readonly HierarchyMatch[]): DuplicateMatchGroup[] {
  const groups = new Map<string, HierarchyMatch[]>();
  for (const m of matches) {
    const key = `${dedupeUrl(m.sourcePageUrl)}\0${dedupePath(m.path)}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }

  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({
      path: g[0]!.path.join(" › "),
      sourcePageUrls: [...new Set(g.map((m) => m.sourcePageUrl))],
      count: g.length,
    }));
}

/**
 * Rank by substance, collapse nothing. An exact-slug heading with 1 child and no tools is not a
 * better answer than a contains-slug heading with 4 children and 17 tools.
 */
export function rankMatches(matches: readonly HierarchyMatch[]): HierarchyMatch[] {
  return [...matches].sort((a, b) => {
    const childDiff = b.childHeadings.length - a.childHeadings.length;
    if (childDiff !== 0) return childDiff;
    const rank = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (rank !== 0) return rank;
    const pathDiff = a.path.join(" › ").localeCompare(b.path.join(" › "));
    if (pathDiff !== 0) return pathDiff;
    return a.sourcePageUrl.localeCompare(b.sourcePageUrl);
  });
}

export function hierarchyMatchId(m: HierarchyMatch): string {
  return `${dedupeUrl(m.sourcePageUrl)}\0${dedupePath(m.path)}\0${m.kind.startsWith("exact") ? "exact" : "contains"}`;
}

export function hierarchyMatchKindLabel(kind: HierarchyMatchKind): string {
  switch (kind) {
    case "exact-heading":
      return "Exact heading";
    case "contains-heading":
      return "Heading contains keyword";
    case "exact-page":
      return "Exact page URL";
    case "contains-page":
      return "Page URL contains keyword";
  }
}

/**
 * Tools arrive as structure, not as text to re-parse.
 *
 * A heading with fewer than two anchors is not a tool list, so an entry that survives trimming
 * but has fewer than two named tools is dropped rather than shown as a one-item group.
 */
function normalizeToolsByHeading(raw: unknown): ToolsByHeading[] {
  if (!Array.isArray(raw)) return [];
  const out: ToolsByHeading[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const heading = String(e.heading ?? e.Heading ?? "").replace(/\s+/g, " ").trim();
    if (!heading) continue;

    const toolsRaw = e.tools ?? e.Tools;
    if (!Array.isArray(toolsRaw)) continue;

    const tools: Array<{ name: string; href?: string }> = [];
    const seen = new Set<string>();
    for (const toolEntry of toolsRaw) {
      if (!toolEntry || typeof toolEntry !== "object") continue;
      const t = toolEntry as Record<string, unknown>;
      const name = String(t.name ?? t.Name ?? "").replace(/\s+/g, " ").trim();
      if (!name || name.length >= 80) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const href = String(t.href ?? t.Href ?? "").trim();
      tools.push({ name, href: href || undefined });
    }
    if (tools.length < 2) continue;
    out.push({ heading, tools });
  }
  return out;
}

/** Normalize GeekAPI hierarchy-match DTO (camel or Pascal) into HierarchyMatch. */
export function normalizeHierarchyMatchFromApi(raw: unknown): HierarchyMatch | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pathRaw = o.path ?? o.Path;
  const path = Array.isArray(pathRaw)
    ? pathRaw.map((p) => String(p)).filter(Boolean)
    : [];
  const childrenRaw = o.childHeadings ?? o.ChildHeadings;
  const childHeadings = Array.isArray(childrenRaw)
    ? childrenRaw.map((c) => String(c)).filter(Boolean)
    : [];
  const sourcePageUrl = String(o.sourcePageUrl ?? o.SourcePageUrl ?? "").trim();
  const matchedHeading = String(o.matchedHeading ?? o.MatchedHeading ?? "").trim();
  const kindRaw = String(o.kind ?? o.Kind ?? "").trim();
  const kind = (
    ["exact-heading", "contains-heading", "exact-page", "contains-page"] as const
  ).includes(kindRaw as HierarchyMatchKind)
    ? (kindRaw as HierarchyMatchKind)
    : "contains-heading";
  if (!sourcePageUrl && path.length === 0 && !matchedHeading) return null;
  return {
    path: path.length > 0 ? path : matchedHeading ? [matchedHeading] : [],
    childHeadings,
    toolsByHeading: normalizeToolsByHeading(o.toolsByHeading ?? o.ToolsByHeading),
    sourcePageUrl,
    matchedHeading: matchedHeading || path[path.length - 1] || "",
    kind,
  };
}

export function normalizeHierarchyMatchesFromApi(body: unknown): HierarchyMatch[] {
  const arr = Array.isArray(body) ? body : [];
  return rankMatches(
    arr.map(normalizeHierarchyMatchFromApi).filter((m): m is HierarchyMatch => m !== null),
  );
}
