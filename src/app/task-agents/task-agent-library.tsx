"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  resolveDiscoveryFacets,
  type TaskAgentDiscoveryFacets,
} from "@/app/task-agents/discovery-facets";
import {
  fetchLibraryState,
  putLibraryState,
  visibilityScopeFromFacets,
  type LibrarySavedConfig,
  type TaskAgentLibraryState,
} from "@/app/task-agents/library-preferences";

export type TaskAgentLibraryItem = {
  id: string;
  definitionId: string;
  displayName: string;
  description: string;
  versionId: string;
  version: string;
  digest: string;
  workflowGroup: string;
  facets: Record<string, unknown>;
  visibilityScope?: "public" | "workspace" | "custom";
};

const WORKFLOW_LABELS: Record<TaskAgentDiscoveryFacets["workflow"], string> = {
  originate: "Originate",
  optimize: "Optimize",
  outrank: "Outrank",
};

const WORKFLOW_ORDER: TaskAgentDiscoveryFacets["workflow"][] = [
  "originate",
  "optimize",
  "outrank",
];

const VISIBILITY_LABELS = {
  public: "Public",
  workspace: "Workspace",
  custom: "Custom",
} as const;

function facetValues(
  agents: Array<TaskAgentLibraryItem & { discovery: TaskAgentDiscoveryFacets }>,
  key: keyof Omit<TaskAgentDiscoveryFacets, "workflow">,
) {
  return [...new Set(agents.flatMap((agent) => agent.discovery[key]))].sort();
}

function matchesFilter(values: string[], selected: string) {
  return !selected || values.includes(selected);
}

function emptyLibraryState(): TaskAgentLibraryState {
  return {
    contractVersion: "gcc-task-agent-library.v1",
    favorites: [],
    recent: [],
    savedConfigs: [],
  };
}

export function TaskAgentLibrary({ agents }: { agents: TaskAgentLibraryItem[] }) {
  const [query, setQuery] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [marketingFunction, setMarketingFunction] = useState("");
  const [contentType, setContentType] = useState("");
  const [funnelStage, setFunnelStage] = useState("");
  const [process, setProcess] = useState("");
  const [visibility, setVisibility] = useState("");
  const [library, setLibrary] = useState<TaskAgentLibraryState>(emptyLibraryState);
  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [busyFavorite, setBusyFavorite] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchLibraryState()
      .then((state) => {
        if (!cancelled) setLibrary(state);
      })
      .catch((cause) => {
        if (!cancelled) {
          setLibraryError(cause instanceof Error ? cause.message : "Library preferences unavailable.");
        }
      })
      .finally(() => {
        if (!cancelled) setLibraryReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enriched = useMemo(
    () => agents.flatMap((agent) => {
      const discovery = resolveDiscoveryFacets(agent.id, agent.facets);
      if (!discovery) return [];
      const scope = agent.visibilityScope
        ?? visibilityScopeFromFacets(agent.facets);
      return [{ ...agent, discovery, visibilityScope: scope }];
    }),
    [agents],
  );

  const byId = useMemo(
    () => new Map(enriched.map((agent) => [agent.id, agent])),
    [enriched],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return enriched.filter((agent) => {
      if (workflow && agent.discovery.workflow !== workflow) return false;
      if (visibility && agent.visibilityScope !== visibility) return false;
      if (!matchesFilter(agent.discovery.marketingFunction, marketingFunction)) return false;
      if (!matchesFilter(agent.discovery.contentType, contentType)) return false;
      if (!matchesFilter(agent.discovery.funnelStage, funnelStage)) return false;
      if (!matchesFilter(agent.discovery.process, process)) return false;
      if (!needle) return true;
      return `${agent.displayName} ${agent.description}`.toLowerCase().includes(needle);
    });
  }, [enriched, query, workflow, marketingFunction, contentType, funnelStage, process, visibility]);

  const groups = WORKFLOW_ORDER.map((key) => ({
    key,
    label: WORKFLOW_LABELS[key],
    entries: filtered.filter((agent) => agent.discovery.workflow === key),
  })).filter((group) => group.entries.length > 0);

  const favoriteAgents = library.favorites
    .map((id) => byId.get(id))
    .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent));

  const recentAgents = library.recent
    .map((entry) => {
      const agent = byId.get(entry.capabilityId);
      return agent ? { agent, lastRunAtUtc: entry.lastRunAtUtc } : null;
    })
    .filter((entry): entry is { agent: NonNullable<(typeof enriched)[number]>; lastRunAtUtc: string } => Boolean(entry))
    .slice(0, 6);

  const savedConfigs = library.savedConfigs
    .slice()
    .sort((a, b) => b.updatedAtUtc.localeCompare(a.updatedAtUtc))
    .slice(0, 8);

  async function persist(next: { favorites: string[]; savedConfigs: LibrarySavedConfig[] }) {
    setLibraryError(null);
    const state = await putLibraryState(next);
    setLibrary(state);
  }

  async function toggleFavorite(capabilityId: string) {
    setBusyFavorite(capabilityId);
    try {
      const favorites = library.favorites.includes(capabilityId)
        ? library.favorites.filter((id) => id !== capabilityId)
        : [...library.favorites, capabilityId];
      await persist({ favorites, savedConfigs: library.savedConfigs });
    } catch (cause) {
      setLibraryError(cause instanceof Error ? cause.message : "Could not update favorites.");
    } finally {
      setBusyFavorite(null);
    }
  }

  async function removeSavedConfig(configId: string) {
    try {
      await persist({
        favorites: library.favorites,
        savedConfigs: library.savedConfigs.filter((entry) => entry.id !== configId),
      });
    } catch (cause) {
      setLibraryError(cause instanceof Error ? cause.message : "Could not remove saved config.");
    }
  }

  function renderAgentRow(
    agent: TaskAgentLibraryItem & { discovery: TaskAgentDiscoveryFacets; visibilityScope: "public" | "workspace" | "custom" },
    options?: { showFavorite?: boolean },
  ) {
    const favorited = library.favorites.includes(agent.id);
    return (
      <li
        key={agent.versionId}
        className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 max-w-2xl border-l-2 border-[var(--cc-accent)] pl-4">
          <h3 className="text-lg font-semibold text-[var(--cc-ink)]">{agent.displayName}</h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--cc-muted)]">{agent.description}</p>
          <p className="mt-2 text-xs text-[var(--cc-muted)]">
            {agent.discovery.marketingFunction.join(" · ")}
            {" · "}
            {agent.discovery.contentType.join(" · ")}
            {" · "}
            {VISIBILITY_LABELS[agent.visibilityScope]}
          </p>
          <p className="mt-1 font-mono text-[0.7rem] text-[var(--cc-muted)]">
            v{agent.version} · {agent.digest.slice(0, 12)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {options?.showFavorite !== false ? (
            <button
              type="button"
              disabled={!libraryReady || busyFavorite === agent.id}
              aria-pressed={favorited}
              aria-label={favorited ? `Unfavorite ${agent.displayName}` : `Favorite ${agent.displayName}`}
              onClick={() => void toggleFavorite(agent.id)}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold text-[var(--cc-ink)] disabled:opacity-50"
            >
              {favorited ? "Favorited" : "Favorite"}
            </button>
          ) : null}
          <Link
            href={`/task-agents/${encodeURIComponent(agent.id)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cc-accent)]"
          >
            Open agent
          </Link>
        </div>
      </li>
    );
  }

  return (
    <div>
      <form
        className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Agent discovery filters"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="block text-sm font-semibold sm:col-span-2 lg:col-span-3">
          Search outcomes
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="audit fact density, comparison brief…"
            className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="block text-sm font-semibold">
          Workflow
          <select
            value={workflow}
            onChange={(event) => setWorkflow(event.target.value)}
            className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-normal"
          >
            <option value="">All</option>
            {WORKFLOW_ORDER.map((value) => (
              <option key={value} value={value}>{WORKFLOW_LABELS[value]}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Visibility
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value)}
            className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-normal"
          >
            <option value="">All</option>
            {(Object.keys(VISIBILITY_LABELS) as Array<keyof typeof VISIBILITY_LABELS>).map((value) => (
              <option key={value} value={value}>{VISIBILITY_LABELS[value]}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Marketing function
          <select
            value={marketingFunction}
            onChange={(event) => setMarketingFunction(event.target.value)}
            className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-normal"
          >
            <option value="">All</option>
            {facetValues(enriched, "marketingFunction").map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Content type
          <select
            value={contentType}
            onChange={(event) => setContentType(event.target.value)}
            className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-normal"
          >
            <option value="">All</option>
            {facetValues(enriched, "contentType").map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Funnel stage
          <select
            value={funnelStage}
            onChange={(event) => setFunnelStage(event.target.value)}
            className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-normal"
          >
            <option value="">All</option>
            {facetValues(enriched, "funnelStage").map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Process
          <select
            value={process}
            onChange={(event) => setProcess(event.target.value)}
            className="mt-2 w-full rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-normal"
          >
            <option value="">All</option>
            {facetValues(enriched, "process").map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
      </form>

      {libraryError ? (
        <p role="alert" className="mt-4 text-sm text-red-800">{libraryError}</p>
      ) : null}

      <p className="mt-4 text-sm text-[var(--cc-muted)]" data-testid="agent-library-count">
        {filtered.length} agent{filtered.length === 1 ? "" : "s"}
      </p>

      {libraryReady && favoriteAgents.length > 0 ? (
        <section className="mt-10" aria-label="Favorites">
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Favorites</h2>
          <ul className="mt-3 divide-y divide-[var(--cc-line)] border-y border-[var(--cc-line)]" data-testid="agent-library-favorites">
            {favoriteAgents.map((agent) => renderAgentRow(agent))}
          </ul>
        </section>
      ) : null}

      {libraryReady && recentAgents.length > 0 ? (
        <section className="mt-10" aria-label="Recently used">
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Recently used</h2>
          <ul className="mt-3 divide-y divide-[var(--cc-line)] border-y border-[var(--cc-line)]" data-testid="agent-library-recent">
            {recentAgents.map(({ agent }) => renderAgentRow(agent))}
          </ul>
        </section>
      ) : null}

      {libraryReady && savedConfigs.length > 0 ? (
        <section className="mt-10" aria-label="Saved configurations">
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">Saved configurations</h2>
          <ul className="mt-3 divide-y divide-[var(--cc-line)] border-y border-[var(--cc-line)]" data-testid="agent-library-saved-configs">
            {savedConfigs.map((config) => {
              const agent = byId.get(config.capabilityId);
              return (
                <li key={config.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 border-l-2 border-[var(--cc-line)] pl-4">
                    <p className="font-semibold text-[var(--cc-ink)]">{config.name}</p>
                    <p className="mt-1 text-sm text-[var(--cc-muted)]">
                      {agent?.displayName ?? config.capabilityId}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      href={`/task-agents/${encodeURIComponent(config.capabilityId)}?savedConfigId=${encodeURIComponent(config.id)}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Restore
                    </Link>
                    <button
                      type="button"
                      onClick={() => void removeSavedConfig(config.id)}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold text-[var(--cc-ink)]"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {groups.length === 0 ? (
        <p className="mt-6 border border-[var(--cc-line)] bg-white px-4 py-5 text-sm text-[var(--cc-muted)]">
          No agents match these filters.
        </p>
      ) : null}

      {groups.map((group) => (
        <section key={group.key} className="mt-10" aria-label={group.label}>
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">{group.label}</h2>
          <ul className="mt-3 divide-y divide-[var(--cc-line)] border-y border-[var(--cc-line)]">
            {group.entries.map((agent) => renderAgentRow(agent))}
          </ul>
        </section>
      ))}
    </div>
  );
}
