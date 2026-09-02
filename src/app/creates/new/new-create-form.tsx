"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  BRIEF_VERSION,
  BUYING_STAGES,
  PRIMARY_INTENTS,
  TONES_OF_VOICE,
  type BuyingStage,
  type PrimaryIntent,
  type ToneOfVoice,
} from "../brief-catalog";
import {
  alsoDraftOptionsFor,
  type ContentType,
  type PrimaryDraftType,
  PRIMARY_DRAFT_TYPES,
} from "../content-types";
import {
  hostFromSiteUrl,
  isCrawlRunReady,
  normalizeCrawlPage,
  normalizeSiteUrl,
  siteSectionForApi,
  siteSectionFromCrawlPages,
  type SiteSectionContext,
} from "../site-section";
import {
  createProjectSiteHubConnection,
  joinProjectSiteCrawl,
  onProjectSiteCrawlEvent,
  onProjectSiteHubReconnected,
  type ProjectSiteCrawlEvent,
} from "@/app/auth/project-site-hub";
import {
  normalizeSiteHierarchy,
  SiteHierarchyPanel,
  type SiteHierarchy,
} from "./site-hierarchy-panel";
import { ButtonBusyLabel, LoadingRow } from "@/app/components/loading-indicator";

const selectClass =
  "rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm text-[var(--cc-ink)]";
const inputClass = selectClass;
const labelClass = "text-sm font-medium text-[var(--cc-ink)]";
const fieldClass = "flex flex-col gap-1.5";

const CRAWL_WAIT_MS = 15 * 60 * 1000;

async function loadSectionFromCrawlRun(
  runId: string,
  resolvedSiteUrl: string,
): Promise<SiteSectionContext> {
  const res = await fetch(`/api/gcc-v2/project-site/runs/${encodeURIComponent(runId)}/pages`, {
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : `Could not load crawl pages (HTTP ${res.status})`,
    );
  }
  const rawPages = (body.pages ?? body.Pages ?? []) as Record<string, unknown>[];
  const pages = rawPages.map(normalizeCrawlPage).filter((p): p is NonNullable<typeof p> => p !== null);
  const section = siteSectionFromCrawlPages(runId, resolvedSiteUrl, pages);
  if (section.relatedPages.length === 0) {
    throw new Error(
      "This crawl has no site pages yet — wait for the crawl to finish or start a new one.",
    );
  }
  return section;
}

type PartnerToolRow = {
  name: string;
  url?: string | null;
  source: string;
};

type PartnerToolsPreflight = {
  createId: string;
  matchedHeading?: string | null;
  matchTopic?: string | null;
  path?: string[] | null;
  toolCount: number;
  toolsFound: boolean;
  tools: PartnerToolRow[];
  message?: string;
  externalResearchNote?: string | null;
  partnerResearchWarnings?: string[];
  siteHierarchy?: SiteHierarchy | null;
};

type Step = "url" | "analyzing" | "brief" | "tools";

function parseOperatorTools(text: string): Array<{ name?: string; url: string }> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipe = line.indexOf("|");
      if (pipe >= 0) {
        const name = line.slice(0, pipe).trim();
        const url = line.slice(pipe + 1).trim();
        if (!url) return null;
        return name ? { name, url } : { url };
      }
      return { url: line };
    })
    .filter((row): row is { name?: string; url: string } => row !== null);
}

function primaryDraftHelperCopy(primary: PrimaryDraftType): string {
  switch (primary) {
    case "tool":
      return "Long-form tool pages: one keyword overview plus a full page per partner tool from supplied URLs. Optionally add pillar/blog under Also draft for a use-case article to ground the overview.";
    case "comparison":
      return "Side-by-side evaluation — outline gets one section per option (from partner tools and competitor URLs). Missing external crawls warn and skip; generate continues.";
    case "alternatives":
      return "Narrative alternatives page (one section per partner tool). Does not auto-spawn partner tool jobs — use Tool page under Also draft for full partner pages.";
    case "case-study":
      return "Proof-led story: context, challenge, approach, implementation, results, and lessons. Optional FAQ when PAA questions are available.";
    case "guide":
      return "Step-by-step how-to with prerequisites and numbered steps. Uses site hierarchy headings when available.";
    case "local":
      return "Local landing page grounded in project site and Geek-Crawler local runs (crawlType: local). Start local crawls in Geek-Crawler — not inline here.";
    case "whitepaper":
      return "Long-form report (export-only — HTML in whitepapers/ folder). Higher word floor at VALIDATE.";
    case "tech-article":
      return "Architecture and implementation depth — article-like WRITE path with TechnicalArticle JSON-LD.";
    case "listicle":
      return "Ranked or numbered picks with blurbs and a verdict section — blog-like WRITE path.";
    case "service":
      return "Commercial service page: shorter target length, CTA clarity emphasized at VALIDATE.";
    case "blog":
      return "Blog-style long-form. Check another long-form under Also draft to write both. Re-Purpose remixes ready drafts into channel packs.";
    default:
      return "Long-form WRITE path (default Pillar). Check other long-form types under Also draft to write both. Re-Purpose on Canvas remixes any ready draft tab into channel packs — not image prompts.";
  }
}

export function NewCreateForm() {
  const router = useRouter();
  const crawlAbortRef = useRef<AbortController | null>(null);
  const hubRef = useRef<ReturnType<typeof createProjectSiteHubConnection> | null>(null);

  const [step, setStep] = useState<Step>("url");
  const [siteUrlInput, setSiteUrlInput] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [forceRecrawl, setForceRecrawl] = useState(false);
  const [analyzingLabel, setAnalyzingLabel] = useState<string | null>(null);

  const [projectSiteCrawlRunId, setProjectSiteCrawlRunId] = useState<string | null>(null);
  const [section, setSection] = useState<SiteSectionContext | null>(null);

  const [title, setTitle] = useState("");
  const [primaryDraft, setPrimaryDraft] = useState<PrimaryDraftType>("pillar");
  const [alsoDrafts, setAlsoDrafts] = useState<Set<ContentType>>(() => new Set());
  const [targetKeyword, setTargetKeyword] = useState("");
  const [operatorToolsText, setOperatorToolsText] = useState("");
  const [paaQuestionsText, setPaaQuestionsText] = useState("");
  const [competitorUrlsText, setCompetitorUrlsText] = useState("");
  const [primaryIntent, setPrimaryIntent] = useState<PrimaryIntent | "">("");
  const [buyingStage, setBuyingStage] = useState<BuyingStage | "">("");
  const [toneOfVoice, setToneOfVoice] = useState<ToneOfVoice | "">("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCreateId, setPendingCreateId] = useState<string | null>(null);
  const [toolsPreflight, setToolsPreflight] = useState<PartnerToolsPreflight | null>(null);
  const [siteHierarchy, setSiteHierarchy] = useState<SiteHierarchy | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      crawlAbortRef.current?.abort();
      void hubRef.current?.stop();
    };
  }, []);

  async function loadSiteHierarchyFromRun(runId: string) {
    setHierarchyLoading(true);
    setHierarchyError(null);
    try {
      const res = await fetch(
        `/api/gcc-v2/project-site/runs/${encodeURIComponent(runId)}/site-hierarchy`,
        { cache: "no-store" },
      );
      const body = (await res.json().catch(() => null)) as {
        siteHierarchy?: unknown;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(body?.error || `hierarchy failed: HTTP ${res.status}`);
      }
      const normalized = normalizeSiteHierarchy(body?.siteHierarchy);
      setSiteHierarchy(normalized);
      if (!normalized) {
        setHierarchyError("Mobile hierarchy was not attached from the project-site crawl.");
      }
    } catch (err) {
      setSiteHierarchy(null);
      setHierarchyError(err instanceof Error ? err.message : "Could not load site hierarchy");
    } finally {
      setHierarchyLoading(false);
    }
  }

  const applyReadyCrawl = useCallback(async (runId: string, resolvedSiteUrl: string) => {
    setAnalyzingLabel("Loading pages from this site…");
    const loaded = await loadSectionFromCrawlRun(runId, resolvedSiteUrl);
    setProjectSiteCrawlRunId(runId);
    setSiteUrl(resolvedSiteUrl);
    setSection(loaded);
    setStep("brief");
    setAnalyzingLabel("Loading mobile site hierarchy…");
    setBusy(false);
    void loadSiteHierarchyFromRun(runId).finally(() => setAnalyzingLabel(null));
  }, []);

  async function waitForCrawlComplete(
    runId: string,
    resolvedSiteUrl: string,
    signal: AbortSignal,
  ): Promise<void> {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const connection = createProjectSiteHubConnection();
      hubRef.current = connection;

      const cleanup = () => {
        offEvent();
        offReconnect();
        void connection.stop();
        hubRef.current = null;
      };

      const finishReady = () => {
        cleanup();
        resolve();
      };

      const finishError = (message: string) => {
        cleanup();
        reject(new Error(message));
      };

      const handleEvent = (evt: ProjectSiteCrawlEvent) => {
        if (evt.runId !== runId) return;
        if (isCrawlRunReady(evt.status)) {
          void applyReadyCrawl(runId, resolvedSiteUrl).then(finishReady).catch(reject);
          return;
        }
        if (/^failed$/i.test(evt.status)) {
          finishError(evt.errorSummary || "Project-site crawl failed.");
          return;
        }
        setAnalyzingLabel(
          typeof evt.pageCount === "number" && evt.pageCount > 0
            ? `Crawling… ${evt.pageCount} page(s) so far`
            : "Crawling project site…",
        );
        if (Date.now() - started > CRAWL_WAIT_MS) {
          finishError("Project-site crawl timed out — try again.");
        }
      };

      const offEvent = onProjectSiteCrawlEvent(connection, handleEvent);
      const offReconnect = onProjectSiteHubReconnected(connection, () => runId);

      signal.addEventListener(
        "abort",
        () => {
          cleanup();
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );

      void (async () => {
        try {
          await joinProjectSiteCrawl(connection, runId);
          const snapRes = await fetch(
            `/api/gcc-v2/project-site/runs/${encodeURIComponent(runId)}`,
            { cache: "no-store", signal },
          );
          const snap = (await snapRes.json().catch(() => ({}))) as ProjectSiteCrawlEvent;
          if (isCrawlRunReady(snap.status)) {
            await applyReadyCrawl(runId, resolvedSiteUrl);
            finishReady();
          } else if (/^failed$/i.test(snap.status ?? "")) {
            finishError(snap.errorSummary || "Project-site crawl failed.");
          }
        } catch (err) {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            cleanup();
            reject(err);
          }
        }
      })();
    });
  }

  async function resolveSite(force: boolean) {
    setError(null);
    const normalized = normalizeSiteUrl(siteUrlInput);
    if (!normalized) {
      setError("Enter a site URL or domain (required).");
      return;
    }

    crawlAbortRef.current?.abort();
    const ac = new AbortController();
    crawlAbortRef.current = ac;

    setBusy(true);
    setStep("analyzing");
    setAnalyzingLabel(force ? "Starting a new crawl…" : "Looking up existing crawl…");
    setSection(null);
    setProjectSiteCrawlRunId(null);
    setSiteHierarchy(null);
    setHierarchyError(null);
    setToolsPreflight(null);

    try {
      if (!force) {
        const latestRes = await fetch(
          `/api/gcc-v2/project-site/runs/latest?siteUrl=${encodeURIComponent(normalized)}`,
          { cache: "no-store", signal: ac.signal },
        );
        if (latestRes.ok) {
          const latest = (await latestRes.json()) as { runId?: string };
          if (latest.runId) {
            await applyReadyCrawl(latest.runId, normalized);
            return;
          }
        }
      }

      setAnalyzingLabel("Starting project-site crawl…");
      const crawlRes = await fetch("/api/gcc-v2/project-site/crawl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteUrl: normalized }),
        signal: ac.signal,
      });
      const crawlBody = await crawlRes.json().catch(() => ({}));
      if (!crawlRes.ok) {
        throw new Error(
          typeof crawlBody.error === "string"
            ? crawlBody.error
            : `Crawl start failed (HTTP ${crawlRes.status})`,
        );
      }

      const runId = String(crawlBody.runId ?? crawlBody.RunId ?? "").trim();
      if (!runId) throw new Error("Crawl start returned no runId");

      setAnalyzingLabel("Crawling project site…");
      await waitForCrawlComplete(runId, normalized, ac.signal);
    } catch (err) {
      if (ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        setStep("url");
        setAnalyzingLabel(null);
        return;
      }
      setError(err instanceof Error ? err.message : "Project-site crawl failed");
      setStep("url");
      setAnalyzingLabel(null);
    } finally {
      setBusy(false);
    }
  }

  function buildBriefPayload() {
    const also = alsoDraftOptionsFor(primaryDraft)
      .map((o) => o.value)
      .filter((v) => alsoDrafts.has(v));
    const contentTypes = [primaryDraft, ...also];
    const operatorTools = parseOperatorTools(operatorToolsText);
    return {
      contentTypes,
      brief: {
        briefVersion: BRIEF_VERSION,
        title: title.trim(),
        primaryDraft,
        contentTypes,
        primaryIntent,
        buyingStage,
        toneOfVoice,
        operatorTools,
        paaQuestions: paaQuestionsText,
        competitorUrls: competitorUrlsText,
        // Prefer early mobile crawl so preflight does not re-fetch (avoids cold-start fail + twin noise).
        ...(siteHierarchy ? { siteHierarchy } : {}),
      },
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!projectSiteCrawlRunId || !section || !section.relatedPages.length) {
      setError("Resolve a project site URL with crawled pages first.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setBusy(true);
    try {
      const createRes = await fetch("/api/gcc-v2/creates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          contentType: primaryDraft,
          siteUrl,
          siteSection: siteSectionForApi(section),
        }),
      });
      if (!createRes.ok) {
        const body = (await createRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `create failed: HTTP ${createRes.status}`);
      }
      const create = (await createRes.json()) as { id: string };
      const { brief } = buildBriefPayload();

      const preRes = await fetch(`/api/gcc-v2/creates/${create.id}/partner-tools/preflight`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetKeyword: targetKeyword.trim() || undefined,
          brief,
          projectSiteCrawlRunId,
        }),
      });
      if (!preRes.ok) {
        const body = (await preRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `tool preflight failed: HTTP ${preRes.status}`);
      }
      const preflight = (await preRes.json()) as PartnerToolsPreflight;
      setPendingCreateId(create.id);
      const hierarchyFromPre =
        normalizeSiteHierarchy(preflight.siteHierarchy) ?? siteHierarchy;
      if (hierarchyFromPre) setSiteHierarchy(hierarchyFromPre);
      setToolsPreflight({
        ...preflight,
        createId: create.id,
        siteHierarchy: hierarchyFromPre,
      });
      setStep("tools");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve partner tools");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAndGenerate() {
    if (!pendingCreateId || !projectSiteCrawlRunId) {
      setError("Missing create — go back to the brief and try again.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { contentTypes, brief } = buildBriefPayload();
      const genRes = await fetch(`/api/gcc-v2/creates/${pendingCreateId}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetKeyword: targetKeyword.trim() || undefined,
          brief,
          projectSiteCrawlRunId,
          contentTypes,
          partnerToolsConfirmed: true,
        }),
      });
      if (!genRes.ok) {
        const body = (await genRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `generate failed: HTTP ${genRes.status}`);
      }
      const data = (await genRes.json()) as {
        jobId?: string;
        jobIds?: string[];
        partnerResearchWarnings?: string[];
      };
      const jobId = data.jobId ?? data.jobIds?.[0];
      if (!jobId) throw new Error("generate returned no jobId");
      if (data.partnerResearchWarnings && data.partnerResearchWarnings.length > 0) {
        sessionStorage.setItem(
          `gcc-v2-research-warnings:${pendingCreateId}`,
          JSON.stringify(data.partnerResearchWarnings),
        );
      }
      router.push(`/creates/${pendingCreateId}?jobId=${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start job");
      setBusy(false);
    }
  }

  async function recheckTools() {
    if (!pendingCreateId || !projectSiteCrawlRunId) return;
    setError(null);
    setBusy(true);
    try {
      const { brief } = buildBriefPayload();
      const preRes = await fetch(`/api/gcc-v2/creates/${pendingCreateId}/partner-tools/preflight`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetKeyword: targetKeyword.trim() || undefined,
          brief,
          projectSiteCrawlRunId,
        }),
      });
      if (!preRes.ok) {
        const body = (await preRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `tool preflight failed: HTTP ${preRes.status}`);
      }
      const preflight = (await preRes.json()) as PartnerToolsPreflight;
      const hierarchyFromPre =
        normalizeSiteHierarchy(preflight.siteHierarchy) ?? siteHierarchy;
      if (hierarchyFromPre) setSiteHierarchy(hierarchyFromPre);
      setToolsPreflight({
        ...preflight,
        createId: pendingCreateId,
        siteHierarchy: hierarchyFromPre,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not re-check tools");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-wrap gap-2 text-xs text-[var(--cc-muted)]">
        {(
          [
            ["url", "1. Site URL"],
            ["brief", "2. Brief"],
            ["tools", "3. Confirm tools"],
          ] as const
        ).map(([key, label]) => (
          <li
            key={key}
            className={`rounded-full px-2.5 py-1 ${
              step === key || (step === "analyzing" && key === "url")
                ? "bg-[var(--cc-accent)]/15 font-semibold text-[var(--cc-accent)]"
                : "bg-black/5"
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      {(step === "url" || step === "analyzing") && (
        <div className="flex flex-col gap-4">
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="siteUrl">
              Project site URL
            </label>
            <input
              id="siteUrl"
              className={inputClass}
              value={siteUrlInput}
              onChange={(e) => setSiteUrlInput(e.target.value)}
              placeholder="https://example.com or example.com"
              disabled={busy || step === "analyzing"}
              required
            />
            <p className="text-xs text-[var(--cc-muted)]">
              Required. We crawl this domain and use its pages for BrandKit and internal links —
              then you fill the brief.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--cc-ink)]">
            <input
              type="checkbox"
              checked={forceRecrawl}
              onChange={(e) => setForceRecrawl(e.target.checked)}
              disabled={busy || step === "analyzing"}
            />
            Force new crawl (ignore existing complete run)
          </label>

          {step === "analyzing" && analyzingLabel ? (
            <LoadingRow label={analyzingLabel} />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !siteUrlInput.trim()}
              onClick={() => void resolveSite(forceRecrawl)}
              className="w-fit rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <ButtonBusyLabel
                busy={step === "analyzing" || busy}
                busyLabel="Working…"
                idleLabel="Continue"
              />
            </button>
            {step === "analyzing" ? (
              <button
                type="button"
                onClick={() => {
                  crawlAbortRef.current?.abort();
                  setStep("url");
                  setAnalyzingLabel(null);
                  setBusy(false);
                }}
                className="rounded-md border border-[var(--cc-line)] px-4 py-2 text-sm font-semibold text-[var(--cc-ink)]"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      )}

      {step === "brief" && section && (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="rounded-md border border-[var(--cc-line)] bg-black/[0.02] px-3 py-2 text-sm">
            <p className="text-[var(--cc-ink)]">
              Writing for: <span className="font-medium">{siteUrl}</span>
            </p>
            <p className="mt-1 text-xs text-[var(--cc-muted)]">
              {section.relatedPages.length} page
              {section.relatedPages.length === 1 ? "" : "s"} from this crawl for links and grounding
            </p>
            <button
              type="button"
              onClick={() => {
                setStep("url");
                setSection(null);
                setProjectSiteCrawlRunId(null);
                setSiteHierarchy(null);
                setHierarchyError(null);
                setToolsPreflight(null);
              }}
              className="mt-2 text-xs font-semibold text-[var(--cc-accent)] underline"
            >
              Change URL
            </button>
          </div>

          {hierarchyLoading ? (
            <LoadingRow label="Loading mobile site hierarchy…" />
          ) : (
            <SiteHierarchyPanel hierarchy={siteHierarchy} />
          )}
          {hierarchyError && !siteHierarchy ? (
            <p className="text-xs text-amber-800">{hierarchyError}</p>
          ) : null}

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Best CRMs for small teams"
              required
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="primaryDraft">
              Primary draft
            </label>
            <select
              id="primaryDraft"
              className={selectClass}
              value={primaryDraft}
              onChange={(e) => {
                const next = e.target.value as PrimaryDraftType;
                setPrimaryDraft(next);
                setAlsoDrafts(new Set());
              }}
            >
              {PRIMARY_DRAFT_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--cc-muted)]">
              {primaryDraftHelperCopy(primaryDraft)}
            </p>
          </div>

          <fieldset className={fieldClass}>
            <legend className={labelClass}>Also draft</legend>
            <div className="flex flex-wrap gap-3 pt-1">
              {alsoDraftOptionsFor(primaryDraft).map((o) => {
                const checked = alsoDrafts.has(o.value);
                return (
                  <label
                    key={o.value}
                    className="flex cursor-pointer items-center gap-2 text-sm text-[var(--cc-ink)]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setAlsoDrafts((prev) => {
                          const next = new Set(prev);
                          if (next.has(o.value)) next.delete(o.value);
                          else next.add(o.value);
                          return next;
                        });
                      }}
                    />
                    {o.label}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-[var(--cc-muted)]">
              Each checked type gets its own WRITE job. Image prompts auto-queue when that job
              finishes (§3.1 — pillar/blog get hero + per H2; tool/email/social/ads get one each) —
              not listed here.
            </p>
          </fieldset>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="targetKeyword">
              Target keyword
            </label>
            <input
              id="targetKeyword"
              className={inputClass}
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="e.g. best crm for small teams"
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="operatorTools">
              Partner tool URLs
            </label>
            <textarea
              id="operatorTools"
              className={`${inputClass} min-h-[88px] font-mono text-xs`}
              value={operatorToolsText}
              onChange={(e) => setOperatorToolsText(e.target.value)}
              placeholder={
                "Optional — Name | URL (excerpt destinations only)\nBotPenguin | https://botpenguin.com/\nManyChat | https://manychat.com/"
              }
            />
            <p className="text-xs text-[var(--cc-muted)]">
              Optional. Destination pages for weave excerpts — not the tool list. Tools come from
              the site hierarchy for this use case. Prefer Name | URL.
            </p>
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="paaQuestions">
              People Also Ask
            </label>
            <textarea
              id="paaQuestions"
              className={`${inputClass} min-h-[88px] font-mono text-xs`}
              value={paaQuestionsText}
              onChange={(e) => setPaaQuestionsText(e.target.value)}
              placeholder={"Optional — one question per line\nWhat is the best CRM for small teams?\nHow much does CRM software cost?"}
            />
            <p className="text-xs text-[var(--cc-muted)]">
              Operator-curated PAA questions become the FAQ section (People Also Ask) in pillar/blog
              outlines. Never auto-filled from SERP uploads.
            </p>
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="competitorUrls">
              Competitor page URLs
            </label>
            <textarea
              id="competitorUrls"
              className={`${inputClass} min-h-[72px] font-mono text-xs`}
              value={competitorUrlsText}
              onChange={(e) => setCompetitorUrlsText(e.target.value)}
              placeholder={"Optional — one absolute URL per line\nhttps://competitor.com/alternative-guide"}
            />
            <p className="text-xs text-[var(--cc-muted)]">
              Optional rival pages for polite crawl — differentiation notes only. Never used as inline
              CTAs or outline must-mentions.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className={fieldClass}>
              <label className={labelClass} htmlFor="primaryIntent">
                Intent
              </label>
              <select
                id="primaryIntent"
                className={selectClass}
                value={primaryIntent}
                onChange={(e) => setPrimaryIntent(e.target.value as PrimaryIntent | "")}
              >
                <option value="">Select…</option>
                {PRIMARY_INTENTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="buyingStage">
                Buying stage
              </label>
              <select
                id="buyingStage"
                className={selectClass}
                value={buyingStage}
                onChange={(e) => setBuyingStage(e.target.value as BuyingStage | "")}
              >
                <option value="">Select…</option>
                {BUYING_STAGES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="toneOfVoice">
                Tone of voice
              </label>
              <select
                id="toneOfVoice"
                className={selectClass}
                value={toneOfVoice}
                onChange={(e) => setToneOfVoice(e.target.value as ToneOfVoice | "")}
              >
                <option value="">Select…</option>
                {TONES_OF_VOICE.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-fit rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <ButtonBusyLabel busy={busy} busyLabel="Finding tools…" idleLabel="Find partner tools" />
          </button>
        </form>
      )}

      {step === "tools" && toolsPreflight && (
        <div className="flex flex-col gap-4">
          <SiteHierarchyPanel hierarchy={toolsPreflight.siteHierarchy ?? siteHierarchy} />

          <div className={fieldClass}>
            <h2 className="text-base font-semibold text-[var(--cc-ink)]">Confirm partner tools</h2>
            <p className="text-sm text-[var(--cc-muted)]">
              {toolsPreflight.message ??
                (toolsPreflight.toolsFound
                  ? `Found ${toolsPreflight.toolCount} partner tool(s). Each gets a full tool page from its supplied URL, plus a keyword overview page linking to them on-site.`
                  : "No partner tools found.")}
            </p>
            {toolsPreflight.externalResearchNote ? (
              <p className="rounded-md border border-[var(--cc-line)] bg-[var(--cc-surface)] px-3 py-2 text-xs text-[var(--cc-muted)]">
                <span className="font-medium text-[var(--cc-ink)]">External partner research — </span>
                {toolsPreflight.externalResearchNote}
              </p>
            ) : null}
            {toolsPreflight.partnerResearchWarnings && toolsPreflight.partnerResearchWarnings.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p className="font-medium">Some partner research was skipped</p>
                <ul className="mt-1 list-disc pl-4">
                  {toolsPreflight.partnerResearchWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-[var(--cc-muted)]">
              Destination URLs (Name | URL) are fetched for excerpts when weaving tool text into a
              paragraph.
            </p>
            {toolsPreflight.matchedHeading ? (
              <p className="text-xs text-[var(--cc-muted)]">
                Matched site heading:{" "}
                <span className="font-medium text-[var(--cc-ink)]">{toolsPreflight.matchedHeading}</span>
                {toolsPreflight.matchTopic ? ` (via “${toolsPreflight.matchTopic}”)` : null}
                {toolsPreflight.path && toolsPreflight.path.length > 0 ? (
                  <>
                    <br />
                    Path:{" "}
                    <span className="font-medium text-[var(--cc-ink)]">
                      {toolsPreflight.path.join(" › ")}
                    </span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>

          {toolsPreflight.tools.length > 0 ? (
            <ul className="flex flex-col gap-2 rounded-md border border-[var(--cc-line)] bg-white p-3 text-sm">
              {toolsPreflight.tools.map((t) => (
                <li key={`${t.source}-${t.name}-${t.url ?? ""}`} className="flex flex-col gap-0.5">
                  <span className="font-medium text-[var(--cc-ink)]">{t.name}</span>
                  <span className="text-xs text-[var(--cc-muted)]">
                    {t.source === "crawl" ? "From site crawl" : "Pasted"}
                    {t.url ? (
                      <>
                        {" · "}
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--cc-accent)] underline-offset-2 hover:underline"
                        >
                          {t.url}
                        </a>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No crawl or pasted partner tools resolved. You can add URLs on the brief step and re-check,
              or continue without partner tools (drafts may invent fewer product links).
            </p>
          )}

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="operatorToolsRecheck">
              Partner tool URLs (edit &amp; re-check)
            </label>
            <textarea
              id="operatorToolsRecheck"
              className={`${inputClass} min-h-[88px] font-mono text-xs`}
              value={operatorToolsText}
              onChange={(e) => setOperatorToolsText(e.target.value)}
              placeholder={
                "Optional — Name | URL for excerpts\nBotPenguin | https://botpenguin.com/"
              }
              disabled={busy}
            />
            <p className="text-xs text-[var(--cc-muted)]">
              Attaches excerpt destinations to crawl tools. Does not add new tools.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void recheckTools()}
              className="rounded-md border border-[var(--cc-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--cc-ink)] disabled:opacity-60"
            >
              <ButtonBusyLabel busy={busy} busyLabel="Checking…" idleLabel="Re-check tools" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStep("brief");
                setError(null);
              }}
              className="rounded-md border border-[var(--cc-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--cc-ink)] disabled:opacity-60"
            >
              Back to brief
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmAndGenerate()}
              className="rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <ButtonBusyLabel
                busy={busy}
                busyLabel="Starting…"
                idleLabel={
                  toolsPreflight.toolsFound
                    ? "Confirm tools & generate"
                    : "Continue without partner tools"
                }
              />
            </button>
          </div>
        </div>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
