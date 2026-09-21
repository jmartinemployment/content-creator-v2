"use client";

import { useEffect, useState } from "react";
import { getGeekBackendCategories, ApiError } from "@/services/content-writer-api";
import { createGccCreate, type GccCreate } from "@/services/gcc-api";
import { checkHostsIndexed, type HostIndexed } from "@/services/gcc-api";
import type { CategoryOption } from "@/lib/types";

/** One URL per line; blanks dropped. Parsing only — validity is the index's answer. */
function parseLines(raw: string): string[] {
  return raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

/**
 * Whether an index exists for each entered URL. Green yes, red no.
 *
 * One check, because it subsumes the rest: a URL that will not parse was never crawled, so no
 * index can exist for it, and it lands red beside a well-formed URL that was never crawled.
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
 * Everything needed to start writing, on one form.
 *
 * This replaces the New Project form. A project was a layer between the client and the thing being
 * written that carried nothing of its own: the URL resolved to a Run ID, the keyword became the
 * topic, and the department was a passthrough. GccCreate already holds all three, so the create is
 * made directly and there is no project.
 *
 * The URL is checked against the index here, and that check is the gate: nothing is created until
 * it resolves to a Run ID, because the Run ID is what the content is grounded on.
 *
 * Nothing here crawls. Content Creator passes a Run ID; crawling is Geek-Crawler-v2's.
 */
export default function CreateForm({
  clientId,
  onCreated,
}: {
  clientId: string;
  onCreated: (create: GccCreate) => void;
}) {
  const [projectUrl, setProjectUrl] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [department, setDepartment] = useState("");
  const [categories, setCategories] = useState<CategoryOption[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [indexed, setIndexed] = useState<Record<string, HostIndexed>>({});
  const [checkingIndex, setCheckingIndex] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);

  const siteUrls = parseLines(projectUrl);
  const siteRow = siteUrls[0] ? indexed[siteUrls[0]] : undefined;
  const projectSiteRunId = siteRow?.indexed ? siteRow.runId : null;

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
    if (!projectSiteRunId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const create = await createGccCreate({
        clientId,
        topic: targetKeyword.trim(),
        projectSiteRunId,
        department,
      });
      onCreated(create);
      setProjectUrl("");
      setTargetKeyword("");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not start writing. Is the API running?",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "rounded-md border border-border bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Start writing</h2>
      <p className="mt-1 text-sm text-muted">
        Content Creator does not crawl — Geek-Crawler does. The site URL is checked against the
        index when you leave the field, to confirm evidence already exists.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
          Site URL
          <input
            required
            type="url"
            value={projectUrl}
            onChange={(e) => setProjectUrl(e.target.value)}
            onBlur={() => void checkIndex(siteUrls)}
            placeholder="https://client-site.com"
            className={inputClass}
          />
          <IndexReport
            urls={siteUrls}
            results={indexed}
            checking={checkingIndex}
            error={indexError}
          />
          {projectSiteRunId ? (
            <span className="break-all text-xs font-normal text-muted">
              Run <span className="font-mono">{projectSiteRunId}</span> — the crawl this content
              will be grounded on.
            </span>
          ) : null}
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
              <option value="">
                {categories === null ? "Loading departments..." : "Select a department"}
              </option>
              {categories?.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name ?? c.slug}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={isSubmitting || !projectSiteRunId}
          className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {isSubmitting ? "Starting..." : "Start writing"}
        </button>
        {/* The refusal, at the point of action and with its reason. Without a Run ID there is no
            crawl to ground on, and starting would only defer the failure to generate time. */}
        {!projectSiteRunId ? (
          <span className="text-xs text-amber-800">
            Enter a site URL with crawl evidence — the Run ID is what the content is grounded on.
          </span>
        ) : null}
      </div>
    </form>
  );
}
