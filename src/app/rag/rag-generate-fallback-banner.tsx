"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchRagStatus } from "@/app/rag/rag-generate-client";

type Props = {
  /** Prefills /rag?topic=… when opening the writer. */
  topic?: string;
  /** Compact banner for brief / create flows. */
  compact?: boolean;
};

/**
 * Soft-detects GeekAPI RAG generate. When available, prefer that path for
 * intent-routed partner/competitor drafts; otherwise point operators at the
 * existing create → research resolver WRITE path.
 */
export function RagGenerateFallbackBanner({ topic = "", compact = false }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await fetchRagStatus();
      if (cancelled) return;
      if (!status) {
        setAvailable(false);
        setReason("Could not reach RAG status.");
        return;
      }
      setAvailable(status.available);
      setReason(status.reason ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (available === null) return null;

  const href =
    topic.trim().length > 0
      ? `/rag?topic=${encodeURIComponent(topic.trim())}`
      : "/rag";

  if (available) {
    return (
      <div
        className={
          compact
            ? "rounded-md border border-[var(--cc-line)] bg-white px-3 py-2 text-sm"
            : "rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-950"
        }
      >
        <p className="font-medium text-[var(--cc-ink)]">RAG generate available</p>
        <p className="mt-1 text-[var(--cc-muted)]">
          Prefer intent-routed drafts from partner + competitor crawl RAG
          {compact ? " (citations included)." : " with visible citations."} Full create WRITE still
          uses the research resolver when you generate a brief.
        </p>
        <Link
          href={href}
          className="mt-2 inline-flex text-sm font-semibold text-[var(--cc-accent)] underline-offset-2 hover:underline"
        >
          Open RAG writing
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <p className="font-medium">RAG generate soft-disabled</p>
      <p className="mt-1 text-amber-900/90">
        {reason ?? "Geek-Crawler-Rag is not configured."} Falling back to the existing create →
        generate research path (partner/competitor excerpts via resolver).
      </p>
      <Link
        href="/creates/new"
        className="mt-2 inline-flex text-sm font-semibold text-[var(--cc-accent)] underline-offset-2 hover:underline"
      >
        Continue with new brief
      </Link>
    </div>
  );
}
