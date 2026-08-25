"use client";

import { useState, type FormEvent } from "react";
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const selectClass =
  "rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm text-[var(--cc-ink)]";
const inputClass = selectClass;
const labelClass = "text-sm font-medium text-[var(--cc-ink)]";
const fieldClass = "flex flex-col gap-1.5";

export function NewCreateForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<ContentType>("blog");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [primaryIntent, setPrimaryIntent] = useState<PrimaryIntent | "">("");
  const [buyingStage, setBuyingStage] = useState<BuyingStage | "">("");
  const [toneOfVoice, setToneOfVoice] = useState<ToneOfVoice | "">("");
  const [siteAnalysisProfileId, setSiteAnalysisProfileId] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    const profileId = siteAnalysisProfileId.trim();
    if (profileId && !UUID_RE.test(profileId)) {
      setError("Site analysis profile ID must be a UUID");
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
          siteAnalysisProfileId: profileId || undefined,
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
          Site analysis profile ID <span className="font-normal text-[var(--cc-muted)]">(optional)</span>
        </label>
        <input
          id="siteAnalysisProfileId"
          className={`${inputClass} font-mono`}
          value={siteAnalysisProfileId}
          onChange={(e) => setSiteAnalysisProfileId(e.target.value)}
          placeholder="00000000-0000-0000-0000-000000000000"
        />
        <p className="text-xs text-[var(--cc-muted)]">
          When set, GeekAPI derives a provisional brand kit from this Geek-SEO profile.
        </p>
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
