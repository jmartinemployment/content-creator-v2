"use client";

import { useState } from "react";

export function HealthCheckButton() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/gcc-v2/health");
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        product?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        setStatus(body?.error || `HTTP ${res.status}`);
        return;
      }
      setStatus(body?.ok ? `ok — ${body.product ?? "v2"}` : "unexpected response");
    } catch {
      setStatus("could not reach BFF / GeekAPI");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="w-fit rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Checking…" : "API health"}
      </button>
      {status ? (
        <p className="text-sm text-[var(--cc-muted)]">{status}</p>
      ) : null}
    </div>
  );
}
