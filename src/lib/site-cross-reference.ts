import type { SiteStructure, SiteStructureNode } from "@/services/gcc-api";

/**
 * Cross-reference of a crawl's own links, built entirely from the site-structure response.
 *
 * Every anchor on the site is either **internal** — it points at another page in this same run — or
 * **external**, a host the site reaches out to. Classifying them makes two questions answerable that
 * the tree alone cannot answer:
 *
 *   section → hosts    which outside parties a section leads to, directly or one hop through an
 *                      on-site page
 *   host    → sections where a given outside party is referenced from
 *
 * The second is the cross-reference proper. A tool page like `/tools/accounting/melio` is an
 * internal anchor, so the section that links it looks self-contained; the partner it actually names
 * is one hop further on, in that page's own anchors. Following that hop is the whole point.
 *
 * No storage and no second request: the structure response already carries every page and every
 * anchor in the run.
 */

/** Same page under `www.` and a trailing slash is the same page. */
function pageKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

/** `href` may be relative; it only means anything against the page it appeared on. */
function absolute(href: string, pageUrl: string): string | null {
  try {
    return new URL(href, pageUrl).toString();
  } catch {
    return null;
  }
}

function walk(nodes: readonly SiteStructureNode[], path: string[]): Array<{ node: SiteStructureNode; path: string[] }> {
  const out: Array<{ node: SiteStructureNode; path: string[] }> = [];
  for (const node of nodes) {
    const next = [...path, node.headingText];
    out.push({ node, path: next });
    out.push(...walk(node.children ?? [], next));
  }
  return out;
}

export interface HostReference {
  /** The section that leads here, as a heading path. */
  sectionPath: string[];
  /** The page that section is on. */
  pageUrl: string;
  /** The anchor's own text, as written on the page. */
  label: string;
  /**
   * The on-site page this reference passes through, when it is not direct.
   *
   * Null means the section links the host itself. A value means the section links this internal
   * page, and that page is what names the host — the hop that makes a tool page's partner visible.
   */
  viaPageUrl: string | null;
}

export interface CrossReferencedHost {
  host: string;
  references: HostReference[];
}

export interface SiteCrossReference {
  /** Hosts the site reaches, most-referenced first. */
  hosts: CrossReferencedHost[];
  /** Anchors whose href would not parse even against their page. Reported, not dropped. */
  unresolvedAnchors: number;
}

export function buildCrossReference(structure: SiteStructure): SiteCrossReference {
  const pages = new Map<string, { pageUrl: string; nodes: Array<{ node: SiteStructureNode; path: string[] }> }>();
  for (const page of structure.pages) {
    pages.set(pageKey(page.pageUrl), { pageUrl: page.pageUrl, nodes: walk(page.roots, []) });
  }

  // The run's own hosts. A link is internal when it lands on a page this crawl holds.
  const siteHosts = new Set<string>();
  for (const page of structure.pages) {
    const host = hostOf(page.pageUrl);
    if (host) siteHosts.add(host);
  }

  const byHost = new Map<string, HostReference[]>();
  let unresolved = 0;

  const record = (host: string, reference: HostReference) => {
    const list = byHost.get(host);
    if (list) list.push(reference);
    else byHost.set(host, [reference]);
  };

  for (const page of structure.pages) {
    for (const { node, path } of walk(page.roots, [])) {
      for (const link of node.links) {
        const resolved = absolute(link.href, page.pageUrl);
        if (!resolved) {
          unresolved++;
          continue;
        }

        const host = hostOf(resolved);
        if (!host) {
          unresolved++;
          continue;
        }

        if (!siteHosts.has(host)) {
          record(host, {
            sectionPath: path,
            pageUrl: page.pageUrl,
            label: link.label,
            viaPageUrl: null,
          });
          continue;
        }

        // Internal. Follow one hop: the page it points at is in this run, and its own outbound
        // anchors are what name the outside party. One hop only — beyond that the association
        // stops being something the section can be said to reference.
        const target = pages.get(pageKey(resolved));
        if (!target) continue;

        for (const hop of target.nodes) {
          for (const onward of hop.node.links) {
            const onwardResolved = absolute(onward.href, target.pageUrl);
            if (!onwardResolved) {
              unresolved++;
              continue;
            }
            const onwardHost = hostOf(onwardResolved);
            if (!onwardHost || siteHosts.has(onwardHost)) continue;

            record(onwardHost, {
              sectionPath: path,
              pageUrl: page.pageUrl,
              label: link.label,
              viaPageUrl: target.pageUrl,
            });
          }
        }
      }
    }
  }

  const hosts = [...byHost.entries()]
    .map(([host, references]) => ({ host, references }))
    .sort((a, b) => b.references.length - a.references.length || a.host.localeCompare(b.host));

  return { hosts, unresolvedAnchors: unresolved };
}
