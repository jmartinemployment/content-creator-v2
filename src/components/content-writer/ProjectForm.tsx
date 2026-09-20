"use client";

import { useEffect, useState } from "react";
import { PROVIDER_OPTIONS, type CategoryOption, type LlmProviderType, type ProjectSummary } from "@/lib/types";
import {
  createProject,
  getGeekBackendCategories,
  ApiError,
  defaultLlmProvider,
} from "@/services/content-writer-api";
import { useWorkflowGate } from "@/components/WorkflowGate";

function qsSiteAnalysisProfileId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = new URLSearchParams(window.location.search).get("siteAnalysisProfileId");
    return v?.trim() || null;
  } catch {
    return null;
  }
}

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
  const [siteAnalysisProfileId, setSiteAnalysisProfileId] = useState<string | null>(null);
  const { siteAnalysisProfileId: gateProfileId, domain: gateDomain } = useWorkflowGate();

  useEffect(() => {
    const fromQs = qsSiteAnalysisProfileId();
    const profileId = fromQs || gateProfileId || null;
    setSiteAnalysisProfileId(profileId);
    if (gateDomain && !projectUrl) {
      const domain = gateDomain.startsWith("http")
        ? gateDomain
        : `https://${gateDomain}`;
      setProjectUrl(domain);
    }
    // seed once from query string (sidebar) or in-memory gate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const profileId =
        qsSiteAnalysisProfileId() ||
        siteAnalysisProfileId ||
        gateProfileId ||
        null;
      const project = await createProject({
        clientId,
        name,
        projectUrl,
        targetKeyword,
        department,
        preferredProvider,
        useExactKeywordAsTitle,
        siteAnalysisProfileId: profileId,
      });
      onCreated(project);
      setName("");
      setProjectUrl("");
      setTargetKeyword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create project. Is the API running?");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">New Project</h2>
      <p className="mt-1 text-sm text-muted">
        Enter the client site URL and the primary keyword. Hierarchy match uses the crawl Run ID
        carried in from the project site check.
      </p>
      {/* The query param is still spelled siteAnalysisProfileId, but since 4f7d540 the value is a
          Geek-Crawler run id. Renaming the param is a coordinated change across WorkflowGate,
          workflowHref, this form and CreateStartForm — the label tells the truth meanwhile. */}
      {siteAnalysisProfileId ? (
        <p className="mt-2 break-all text-xs text-muted">Run ID: {siteAnalysisProfileId}</p>
      ) : (
        <p className="mt-2 text-xs text-amber-800">
          No Run ID yet — confirm a project site has crawl evidence, then return here.
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Project Name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme HVAC - AI Chatbot Launch"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
          Target Keyword
          <input
            required
            value={targetKeyword}
            onChange={(e) => setTargetKeyword(e.target.value)}
            placeholder="ai chatbot implementation cost"
            className="rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
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
              className="rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
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

        {/* Not editable. The Run ID above names a crawl of one specific URL; letting this be
            retyped would let a project claim a site its own evidence does not cover, and nothing
            would catch it. It is carried from the Project site step, not entered here. */}
        <div className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
          Project URL
          <p className="break-all rounded-md border border-border bg-surface-muted px-3 py-2 text-sm font-normal text-muted">
            {projectUrl || "None carried in — return to the Project site step."}
          </p>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
          LLM Provider
          <select
            value={preferredProvider}
            onChange={(e) => setPreferredProvider(e.target.value as LlmProviderType)}
            className="rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-foreground sm:col-span-2">
          <input
            type="checkbox"
            checked={useExactKeywordAsTitle}
            onChange={(e) => setUseExactKeywordAsTitle(e.target.checked)}
            className="h-4 w-4 rounded border-border text-brand focus:ring-2 focus:ring-brand/20"
          />
          Use exact keyword as title
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {isSubmitting ? "Creating..." : "Create Project"}
      </button>
    </form>
  );
}
