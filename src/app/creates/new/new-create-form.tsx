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
  ALSO_DRAFT_TYPES,
  PRIMARY_DRAFT_TYPES,
  type AlsoDraftType,
  type PrimaryDraftType,
} from "../content-types";
import {
  hostFromSiteUrl,
  isProfileReady,
  normalizeCrawlPage,
  normalizeSiteUrl,
  siteSectionForApi,
  siteSectionFromCrawlPages,
  type SiteSectionContext,
} from "../site-section";

type SiteProfileOption = {
  id: string;
  domain: string;
  status: string | null;
  analyzedAt: string | null;
  primaryFocus: string | null;
};

type Step = "url" | "analyzing" | "brief";

const selectClass =
  "rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm text-[var(--cc-ink)]";
const inputClass = selectClass;
const labelClass = "text-sm font-medium text-[var(--cc-ink)]";
const fieldClass = "flex flex-col gap-1.5";

const POLL_MS = 3000;
const POLL_MAX_MS = 10 * 60 * 1000;

function normalizeProfiles(body: unknown): SiteProfileOption[] {
  if (!Array.isArray(body)) return [];
  return body
    .map((raw) => {
      const p = raw as Record<string, unknown>;
      const id = String(p.id ?? p.Id ?? "").trim();
      if (!id) return null;
      return {
        id,
        domain: String(p.domain ?? p.Domain ?? "").trim(),
        status: (p.status ?? p.Status ?? null) as string | null,
        analyzedAt: (p.analyzedAt ?? p.AnalyzedAt ?? null) as string | null,
        primaryFocus: (p.primaryFocus ?? p.PrimaryFocus ?? null) as string | null,
      };
    })
    .filter((p): p is SiteProfileOption => p !== null);
}

function pickReadyProfile(list: SiteProfileOption[]): SiteProfileOption | null {
  return list.find((p) => isProfileReady(p.status)) ?? null;
}

async function fetchProfilesByDomain(domain: string): Promise<SiteProfileOption[]> {
  const res = await fetch(
    `/api/site-analyzer/profiles/by-domain?domain=${encodeURIComponent(domain)}&limit=50`,
    { cache: "no-store" },
  );
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      typeof body?.error === "string" ? body.error : `Could not list profiles (HTTP ${res.status})`,
    );
  }
  return normalizeProfiles(body);
}

/** Load crawled pages for this profile and build site section (relatedPages from the URL). */
async function loadSectionFromSite(
  profileId: string,
  resolvedSiteUrl: string,
): Promise<SiteSectionContext> {
  const res = await fetch(`/api/site-analyzer/${encodeURIComponent(profileId)}`, {
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : `Could not load crawl (HTTP ${res.status})`,
    );
  }
  const rawPages = (body.pages ?? body.Pages ?? []) as Record<string, unknown>[];
  const pages = rawPages.map(normalizeCrawlPage).filter((p): p is NonNullable<typeof p> => p !== null);
  const section = siteSectionFromCrawlPages(profileId, resolvedSiteUrl, pages);
  if (section.relatedPages.length === 0) {
    throw new Error(
      "This crawl has no site pages yet — force a new crawl, or wait for the analysis to finish.",
    );
  }
  return section;
}

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

export function NewCreateForm() {
  const router = useRouter();
  const pollAbortRef = useRef<AbortController | null>(null);

  const [step, setStep] = useState<Step>("url");
  const [siteUrlInput, setSiteUrlInput] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [forceReanalyze, setForceReanalyze] = useState(false);
  const [analyzingLabel, setAnalyzingLabel] = useState<string | null>(null);

  const [siteAnalysisProfileId, setSiteAnalysisProfileId] = useState<string | null>(null);
  const [section, setSection] = useState<SiteSectionContext | null>(null);

  const [title, setTitle] = useState("");
  const [primaryDraft, setPrimaryDraft] = useState<PrimaryDraftType>("pillar");
  const [alsoDrafts, setAlsoDrafts] = useState<Set<AlsoDraftType>>(() => new Set());
  const [targetKeyword, setTargetKeyword] = useState("");
  const [operatorToolsText, setOperatorToolsText] = useState("");
  const [primaryIntent, setPrimaryIntent] = useState<PrimaryIntent | "">("");
  const [buyingStage, setBuyingStage] = useState<BuyingStage | "">("");
  const [toneOfVoice, setToneOfVoice] = useState<ToneOfVoice | "">("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
    };
  }, []);

  const applyReadyProfile = useCallback(async (profileId: string, resolvedSiteUrl: string) => {
    setAnalyzingLabel("Loading pages from this site…");
    const loaded = await loadSectionFromSite(profileId, resolvedSiteUrl);
    setSiteAnalysisProfileId(profileId);
    setSiteUrl(resolvedSiteUrl);
    setSection(loaded);
    setStep("brief");
    setAnalyzingLabel(null);
  }, []);

  async function pollUntilReady(domain: string, signal: AbortSignal): Promise<SiteProfileOption> {
    const started = Date.now();
    while (!signal.aborted) {
      const list = await fetchProfilesByDomain(domain);
      const ready = pickReadyProfile(list);
      if (ready) return ready;
      if (Date.now() - started > POLL_MAX_MS) {
        throw new Error("Site analysis timed out — try again or re-analyze.");
      }
      setAnalyzingLabel("Waiting for crawl to finish…");
      await new Promise<void>((resolve, reject) => {
        const t = window.setTimeout(resolve, POLL_MS);
        signal.addEventListener(
          "abort",
          () => {
            window.clearTimeout(t);
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });
    }
    throw new DOMException("Aborted", "AbortError");
  }

  async function resolveSite(force: boolean) {
    setError(null);
    const normalized = normalizeSiteUrl(siteUrlInput);
    const domain = hostFromSiteUrl(siteUrlInput);
    if (!domain) {
      setError("Enter a site URL or domain (required).");
      return;
    }

    pollAbortRef.current?.abort();
    const ac = new AbortController();
    pollAbortRef.current = ac;

    setBusy(true);
    setStep("analyzing");
    setAnalyzingLabel(force ? "Starting a new crawl…" : "Looking up existing crawl…");
    setSection(null);
    setSiteAnalysisProfileId(null);

    try {
      if (!force) {
        const existing = await fetchProfilesByDomain(domain);
        const ready = pickReadyProfile(existing);
        if (ready) {
          await applyReadyProfile(ready.id, normalized);
          return;
        }
      }

      setAnalyzingLabel("Starting site analysis…");
      const analyzeRes = await fetch("/api/site-analyzer/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain, force }),
        signal: ac.signal,
      });
      const analyzeBody = await analyzeRes.json().catch(() => ({}));
      if (!analyzeRes.ok) {
        throw new Error(
          typeof analyzeBody.error === "string"
            ? analyzeBody.error
            : `Analyze failed (HTTP ${analyzeRes.status})`,
        );
      }

      setAnalyzingLabel("Crawl queued — polling for ready profile…");
      const ready = await pollUntilReady(domain, ac.signal);
      await applyReadyProfile(ready.id, normalized);
    } catch (err) {
      if (ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        setStep("url");
        setAnalyzingLabel(null);
        return;
      }
      setError(err instanceof Error ? err.message : "Site analysis failed");
      setStep("url");
      setAnalyzingLabel(null);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!siteAnalysisProfileId || !section || !section.relatedPages.length) {
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

      const also = ALSO_DRAFT_TYPES.map((o) => o.value).filter((v) => alsoDrafts.has(v));
      const contentTypes = [primaryDraft, ...also];
      const operatorTools = parseOperatorTools(operatorToolsText);

      const brief = {
        briefVersion: BRIEF_VERSION,
        title: title.trim(),
        primaryDraft,
        contentTypes,
        primaryIntent,
        buyingStage,
        toneOfVoice,
        operatorTools,
      };

      const genRes = await fetch(`/api/gcc-v2/creates/${create.id}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetKeyword: targetKeyword.trim() || undefined,
          brief,
          siteAnalysisProfileId,
          contentTypes,
        }),
      });
      if (!genRes.ok) {
        const body = (await genRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `generate failed: HTTP ${genRes.status}`);
      }
      const data = (await genRes.json()) as { jobId?: string; jobIds?: string[] };
      const jobId = data.jobId ?? data.jobIds?.[0];
      if (!jobId) throw new Error("generate returned no jobId");

      router.push(`/creates/${create.id}?jobId=${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start job");
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
              checked={forceReanalyze}
              onChange={(e) => setForceReanalyze(e.target.checked)}
              disabled={busy || step === "analyzing"}
            />
            Force new crawl (ignore existing ready profile)
          </label>

          {step === "analyzing" && analyzingLabel ? (
            <p className="text-sm text-[var(--cc-muted)]">{analyzingLabel}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !siteUrlInput.trim()}
              onClick={() => void resolveSite(forceReanalyze)}
              className="w-fit rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {step === "analyzing" ? "Working…" : "Continue"}
            </button>
            {step === "analyzing" ? (
              <button
                type="button"
                onClick={() => {
                  pollAbortRef.current?.abort();
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
                setSiteAnalysisProfileId(null);
              }}
              className="mt-2 text-xs font-semibold text-[var(--cc-accent)] underline"
            >
              Change URL
            </button>
          </div>

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
              onChange={(e) => setPrimaryDraft(e.target.value as PrimaryDraftType)}
            >
              {PRIMARY_DRAFT_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--cc-muted)]">
              Long-form WRITE path (default Pillar). Use Re-Purpose on a ready draft for channel packs.
            </p>
          </div>

          <fieldset className={fieldClass}>
            <legend className={labelClass}>Also draft</legend>
            <div className="flex flex-wrap gap-3 pt-1">
              {ALSO_DRAFT_TYPES.map((o) => {
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
              Each checked type gets its own WRITE job (same site, brief, and BrandKit).
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
              Partner / tool URLs (optional)
            </label>
            <textarea
              id="operatorTools"
              className={`${inputClass} min-h-[88px] font-mono text-xs`}
              value={operatorToolsText}
              onChange={(e) => setOperatorToolsText(e.target.value)}
              placeholder={"One per line — URL or Name | URL\nhttps://example.com/tools/intercom\nTidio | https://example.com/tools/tidio"}
            />
            <p className="text-xs text-[var(--cc-muted)]">
              Saved on the brief. Extra partners to weave in (plus crawl links under your keyword).
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
            {busy ? "Starting…" : "Create & generate"}
          </button>
        </form>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
