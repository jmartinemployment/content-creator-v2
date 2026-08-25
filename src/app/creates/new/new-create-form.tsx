"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import { CONTENT_TYPES, type ContentType } from "../content-types";

type SiteProfileOption = {
  id: string;
  domain: string;
  status: string | null;
  analyzedAt: string | null;
  primaryFocus: string | null;
};

const selectClass =
  "rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm text-[var(--cc-ink)]";
const inputClass = selectClass;
const labelClass = "text-sm font-medium text-[var(--cc-ink)]";
const fieldClass = "flex flex-col gap-1.5";

function formatAnalyzedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function profileLabel(p: SiteProfileOption): string {
  const parts = [p.domain || "Unknown site"];
  const when = formatAnalyzedAt(p.analyzedAt);
  if (when) parts.push(when);
  if (p.primaryFocus?.trim()) parts.push(p.primaryFocus.trim());
  if (p.status && !/^complete|ready$/i.test(p.status)) parts.push(`(${p.status})`);
  return parts.join(" · ");
}

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

export function NewCreateForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<ContentType>("blog");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [primaryIntent, setPrimaryIntent] = useState<PrimaryIntent | "">("");
  const [buyingStage, setBuyingStage] = useState<BuyingStage | "">("");
  const [toneOfVoice, setToneOfVoice] = useState<ToneOfVoice | "">("");
  const [siteAnalysisProfileId, setSiteAnalysisProfileId] = useState("");
  const [profiles, setProfiles] = useState<SiteProfileOption[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setProfilesLoading(true);
      setProfilesError(null);
      try {
        const res = await fetch("/api/gcc-v2/site-analyzer/profiles/recent?limit=50", {
          cache: "no-store",
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            typeof body?.error === "string" ? body.error : `Could not load sites (HTTP ${res.status})`,
          );
        }
        if (!cancelled) setProfiles(normalizeProfiles(body));
      } catch (e) {
        if (!cancelled) {
          setProfiles([]);
          setProfilesError(e instanceof Error ? e.message : "Could not load sites");
        }
      } finally {
        if (!cancelled) setProfilesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setBusy(true);
    try {
      const createRes = await fetch("/api/gcc-v2/creates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), contentType }),
      });
      if (!createRes.ok) {
        const body = (await createRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `create failed: HTTP ${createRes.status}`);
      }
      const create = (await createRes.json()) as { id: string };

      const brief = {
        briefVersion: BRIEF_VERSION,
        primaryIntent,
        buyingStage,
        toneOfVoice,
      };

      const genRes = await fetch(`/api/gcc-v2/creates/${create.id}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetKeyword: targetKeyword.trim() || undefined,
          brief,
          siteAnalysisProfileId: siteAnalysisProfileId || undefined,
        }),
      });
      if (!genRes.ok) {
        const body = (await genRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `generate failed: HTTP ${genRes.status}`);
      }
      const { jobId } = (await genRes.json()) as { jobId: string };

      router.push(`/creates/${create.id}?jobId=${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start job");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
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
        <label className={labelClass} htmlFor="contentType">
          Content type
        </label>
        <select
          id="contentType"
          className={selectClass}
          value={contentType}
          onChange={(e) => setContentType(e.target.value as ContentType)}
        >
          {CONTENT_TYPES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

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

      <div className={fieldClass}>
        <label className={labelClass} htmlFor="siteAnalysisProfileId">
          Site crawl <span className="font-normal text-[var(--cc-muted)]">(optional)</span>
        </label>
        <select
          id="siteAnalysisProfileId"
          className={selectClass}
          value={siteAnalysisProfileId}
          onChange={(e) => setSiteAnalysisProfileId(e.target.value)}
          disabled={profilesLoading}
        >
          <option value="">
            {profilesLoading ? "Loading sites…" : "No site — skip brand kit from crawl"}
          </option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {profileLabel(p)}
            </option>
          ))}
        </select>
        <p className="text-xs text-[var(--cc-muted)]">
          Pick a Geek-SEO crawl by site name. We derive a provisional brand kit from it.
        </p>
        {profilesError ? <p className="text-xs text-amber-700">{profilesError}</p> : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="w-fit rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Starting…" : "Create & generate"}
      </button>
    </form>
  );
}
