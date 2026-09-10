"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  resolveDiscoveryFacets,
  type TaskAgentDiscoveryFacets,
} from "@/app/task-agents/discovery-facets";

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

function facetValues(
  agents: Array<TaskAgentLibraryItem & { discovery: TaskAgentDiscoveryFacets }>,
  key: keyof Omit<TaskAgentDiscoveryFacets, "workflow">,
) {
  return [...new Set(agents.flatMap((agent) => agent.discovery[key]))].sort();
}

function matchesFilter(values: string[], selected: string) {
  return !selected || values.includes(selected);
}

export function TaskAgentLibrary({ agents }: { agents: TaskAgentLibraryItem[] }) {
  const [query, setQuery] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [marketingFunction, setMarketingFunction] = useState("");
  const [contentType, setContentType] = useState("");
  const [funnelStage, setFunnelStage] = useState("");
  const [process, setProcess] = useState("");

  const enriched = useMemo(
    () => agents.flatMap((agent) => {
      const discovery = resolveDiscoveryFacets(agent.id, agent.facets);
      return discovery ? [{ ...agent, discovery }] : [];
    }),
    [agents],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return enriched.filter((agent) => {
      if (workflow && agent.discovery.workflow !== workflow) return false;
      if (!matchesFilter(agent.discovery.marketingFunction, marketingFunction)) return false;
      if (!matchesFilter(agent.discovery.contentType, contentType)) return false;
      if (!matchesFilter(agent.discovery.funnelStage, funnelStage)) return false;
      if (!matchesFilter(agent.discovery.process, process)) return false;
      if (!needle) return true;
      return `${agent.displayName} ${agent.description}`.toLowerCase().includes(needle);
    });
  }, [enriched, query, workflow, marketingFunction, contentType, funnelStage, process]);

  const groups = WORKFLOW_ORDER.map((key) => ({
    key,
    label: WORKFLOW_LABELS[key],
    entries: filtered.filter((agent) => agent.discovery.workflow === key),
  })).filter((group) => group.entries.length > 0);

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

      <p className="mt-4 text-sm text-[var(--cc-muted)]" data-testid="agent-library-count">
        {filtered.length} agent{filtered.length === 1 ? "" : "s"}
      </p>

      {groups.length === 0 ? (
        <p className="mt-6 border border-[var(--cc-line)] bg-white px-4 py-5 text-sm text-[var(--cc-muted)]">
          No agents match these filters.
        </p>
      ) : null}

      {groups.map((group) => (
        <section key={group.key} className="mt-10" aria-label={group.label}>
          <h2 className="text-sm font-semibold text-[var(--cc-ink)]">{group.label}</h2>
          <ul className="mt-3 divide-y divide-[var(--cc-line)] border-y border-[var(--cc-line)]">
            {group.entries.map((agent) => (
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
                  </p>
                  <p className="mt-1 font-mono text-[0.7rem] text-[var(--cc-muted)]">
                    v{agent.version} · {agent.digest.slice(0, 12)}
                  </p>
                </div>
                <Link
                  href={`/task-agents/${encodeURIComponent(agent.id)}`}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cc-accent)]"
                >
                  Open agent
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
