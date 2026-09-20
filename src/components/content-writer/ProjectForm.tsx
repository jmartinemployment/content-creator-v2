"use client";

import { useEffect, useState } from "react";
import { PROVIDER_OPTIONS, type CategoryOption, type LlmProviderType, type ProjectSummary } from "@/lib/types";
import {
  createProject,
  getGeekBackendCategories,
  ApiError,
  defaultLlmProvider,
} from "@/services/content-writer-api";
import { checkHostsIndexed, type HostIndexed } from "@/services/gcc-api";

/** One URL per line; blanks dropped. Parsing only — validity is the index's answer. */
function parseLines(raw: string): string[] {
  return raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

/**
 * Whether an index exists for each entered URL. Green yes, red no.
 *
 * One check, because it subsumes the rest: a URL that will not parse was never crawled, so no index
 * can exist for it, and it lands red beside a well-formed URL that was never crawled. The operator
 * does the same thing about both.
 */
function IndexReport({
  urls,
  results,
  checking,
  error,
}: {
  urls: string[];
  results: Record<string, HostIndexed>;
  checking: boolean;
  error: string | null;
}) {
  if (urls.length === 0) return null;
  if (checking) return <p className="text-xs text-muted">Checking the index…</p>;
  if (error) return <p className="text-xs text-red-600">{error}</p>;

  const seen = urls.filter((u) => results[u] !== undefined);
  if (seen.length === 0) return null;

  return (
    <div className="space-y-1 text-xs font-normal">
      {seen.map((u) => {
        const r = results[u];
        return (
          <p key={u} className={r.indexed ? "text-green-700" : "text-red-600"}>
            <span className="font-mono">{u}</span> —{" "}
            {r.indexed ? "indexed" : "no index — crawl it first"}
            {r.indexed && !r.runId ? (
              <span className="text-red-600"> · no run id — nothing to read</span>
            ) : null}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Everything needed to start a project, on one form.
 *
 * The project site URL is checked against the index here rather than on a step before it. That
 * check is the gate: a project cannot be created until its URL resolves to a Run ID, because the
 * Run ID names the crawl everything downstream grounds on. Refusing at the button, with the reason
 * beside it, is stronger than refusing on a screen the operator has already walked past.
 *
 * Nothing here crawls. Content Creator passes a Run ID; crawling is Geek-Crawler-v2's.
 */
export default function ProjectForm({
  clientId,
  onCreated,
}: {
  clientId: string;
  onCreated: (project: ProjectSummary) => void;
}) {
  const [name, setName] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [department, setDepartment] = useState("");
  const [categories, setCategories] = useState<CategoryOption[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [preferredProvider, setPreferredProvider] = useState<LlmProviderType>(defaultLlmProvider);
  const [useExactKeywordAsTitle, setUseExactKeywordAsTitle] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Declared partners and competitors, saved with the project. The index check beside each one
  // reports whether a crawl exists; it does not gate the declaration. A partner the client really
  // has, with no crawl yet, is a fact worth recording — and the gap between what is declared and
  // what is crawled is exactly the thing worth being able to see.
  const [partnerSeeds, setPartnerSeeds] = useState("");
  const [competitorSeeds, setCompetitorSeeds] = useState("");
  const [indexed, setIndexed] = useState<Record<string, HostIndexed>>({});
  const [checkingIndex, setCheckingIndex] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);

  const projectUrls = parseLines(projectUrl);
  const partnerUrls = parseLines(partnerSeeds);
  const competitorUrls = parseLines(competitorSeeds);

  // The Run ID for the project site. The index check already returns it; nothing else resolves one.
  const projectRow = projectUrls[0] ? indexed[projectUrls[0]] : undefined;
  const projectRunId = projectRow?.indexed ? projectRow.runId : null;

  useEffect(() => {
    let cancelled = false;
    getGeekBackendCategories(clientId)
      .then((options) => {
        if (!cancelled) setCategories(options);
      })
      .catch(() => {
        if (!cancelled) setCategoriesError("Could not load departments.");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function checkIndex(urls: string[]) {
    const pending = urls.filter((u) => indexed[u] === undefined);
    if (pending.length === 0) return;
    setCheckingIndex(true);
    setIndexError(null);
    try {
      const rows = await checkHostsIndexed(pending);
      setIndexed((prev) => {
        const next = { ...prev };
        for (const r of rows) next[r.url] = r;
        return next;
      });
    } catch (e) {
      // The check failing is not a verdict on the URL. Leave it unmarked rather than red.
      setIndexError(e instanceof Error ? e.message : "Could not reach the index.");
    } finally {
      setCheckingIndex(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectRunId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const project = await createProject({
        clientId,
        name,
        projectUrl: projectUrls[0] ?? projectUrl,
        targetKeyword,
        department,
        preferredProvider,
        useExactKeywordAsTitle,
        siteAnalysisProfileId: projectRunId,
        partnerUrls,
        competitorUrls,
      });
      onCreated(project);
      setName("");
      setProjectUrl("");
      setTargetKeyword("");
      setPartnerSeeds("");
      setCompetitorSeeds("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create project. Is the API running?");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "rounded-md border border-border bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">New Project</h2>
      <p className="mt-1 text-sm text-muted">
        Content Creator does not crawl — Geek-Crawler does. Each URL below is checked against the
        index when you leave the field, to confirm evidence already exists.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
          Project URL
          <input
            required
            type="url"
            value={projectUrl}
            onChange={(e) => setProjectUrl(e.target.value)}
            onBlur={() => void checkIndex(projectUrls)}
            placeholder="https://client-site.com"
            className={inputClass}
          />
          <IndexReport
            urls={projectUrls}
            results={indexed}
            checking={checkingIndex}
            error={indexError}
          />
          {projectRunId ? (
            <span className="break-all text-xs font-normal text-muted">
              Run <span className="font-mono">{projectRunId}</span> — the crawl this content will be
              grounded on.
            </span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Project Name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme HVAC - AI Chatbot Launch"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Target Keyword
          <input
            required
            value={targetKeyword}
            onChange={(e) => setTargetKeyword(e.target.value)}
            placeholder="ai chatbot implementation cost"
            className={inputClass}
          />
        </label>

        {/* Beside the keyword, because it qualifies the keyword: it decides whether that exact
            phrase becomes the title. Alone at the foot of the form it read as a project setting. */}
        <label className="flex items-end gap-2 pb-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={useExactKeywordAsTitle}
            onChange={(e) => setUseExactKeywordAsTitle(e.target.checked)}
            className="mb-0.5 h-4 w-4 rounded border-border text-brand focus:ring-2 focus:ring-brand/20"
          />
          Use exact keyword as title
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Department
          {categoriesError ? (
            <span className="text-xs text-red-600">{categoriesError}</span>
          ) : (
            <select
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={categories === null}
              className={inputClass}
            >
              <option value="">{categories === null ? "Loading departments..." : "Select a department"}</option>
              {categories?.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name ?? c.slug}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          LLM Provider
          <select
            value={preferredProvider}
            onChange={(e) => setPreferredProvider(e.target.value as LlmProviderType)}
            className={inputClass}
          >
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

      </div>

      <fieldset className="mt-6 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium text-foreground">
          Partners &amp; competitors
        </legend>
        <p className="mb-3 text-xs text-muted">
          Saved with the project. Each is checked against the index as you leave the field — a red
          line means no crawl exists for it yet, which is worth knowing but does not stop you
          declaring it.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Partner URLs
          <span className="text-xs font-normal text-muted">Products you sell or recommend.</span>
          <textarea
            value={partnerSeeds}
            onChange={(e) => setPartnerSeeds(e.target.value)}
            onBlur={() => void checkIndex(partnerUrls)}
            rows={4}
            placeholder={"https://partner.example/pricing\nhttps://partner.example/docs"}
            className={`${inputClass} font-mono text-xs`}
          />
          <IndexReport
            urls={partnerUrls}
            results={indexed}
            checking={checkingIndex}
            error={indexError}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Competitor URLs
          <span className="text-xs font-normal text-muted">Rivals writing on the same topics.</span>
          <textarea
            value={competitorSeeds}
            onChange={(e) => setCompetitorSeeds(e.target.value)}
            onBlur={() => void checkIndex(competitorUrls)}
            rows={4}
            placeholder={"https://rival.example/services\nhttps://rival.example/about"}
            className={`${inputClass} font-mono text-xs`}
          />
          <IndexReport
            urls={competitorUrls}
            results={indexed}
            checking={checkingIndex}
            error={indexError}
          />
        </label>
        </div>
      </fieldset>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={isSubmitting || !projectRunId}
          className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {isSubmitting ? "Creating..." : "Create Project"}
        </button>
        {/* The refusal, at the point of action and with its reason. A project with no Run ID has no
            crawl to ground on, and creating one would only defer the failure to generate time. */}
        {!projectRunId ? (
          <span className="text-xs text-amber-800">
            Enter a project URL with crawl evidence — the Run ID is what the content is grounded on.
          </span>
        ) : null}
      </div>
    </form>
  );
}
