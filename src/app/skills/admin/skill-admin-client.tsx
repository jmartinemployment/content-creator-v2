"use client";

import { useState, type FormEvent } from "react";
import {
  assertSafeSkillImportFields,
  shortDigest,
  type AdminSkillDetail,
  type SkillAdminWorkspace,
} from "@/app/skills/skill-contract";

async function adminRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`/api/gcc-v2/skills/admin/${path}`, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => null) as { error?: string; detail?: string } | null;
  if (!response.ok) throw new Error(body?.error || body?.detail || `Request failed (HTTP ${response.status})`);
  return body;
}

export function SkillAdminClient({ initialWorkspace }: { initialWorkspace: SkillAdminWorkspace }) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [selectedId, setSelectedId] = useState(initialWorkspace.skills[0]?.versionId ?? initialWorkspace.skills[0]?.id ?? "");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [commit, setCommit] = useState("");
  const [skillPath, setSkillPath] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = workspace.skills.find((skill) => (skill.versionId ?? skill.id) === selectedId)
    ?? workspace.skills[0];

  async function refresh(preferredId?: string) {
    const response = await fetch("/api/gcc-v2/skills/admin", { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not refresh admin workspace (HTTP ${response.status})`);
    const next = (await response.json()) as SkillAdminWorkspace;
    setWorkspace(next);
    if (preferredId) setSelectedId(preferredId);
  }

  async function mutate(label: string, path: string, body?: unknown) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const result = await adminRequest(path, {
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body),
      }) as { versionId?: string } | null;
      await refresh(result?.versionId ?? selectedId);
      setNotice(label);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `${label} failed`);
    } finally {
      setBusy(null);
    }
  }

  async function importSkill(event: FormEvent) {
    event.preventDefault();
    const validation = assertSafeSkillImportFields([repositoryUrl, commit, skillPath]);
    if (validation) {
      setError(validation);
      return;
    }
    await mutate("Import completed", "import", {
      repositoryUrl: repositoryUrl.trim(),
      immutableRef: commit.trim(),
      skillPath: skillPath.trim(),
    });
  }

  async function dispositionFinding(skill: AdminSkillDetail, findingId: string, disposition: string) {
    const rationale = window.prompt("Reviewer rationale (required)")?.trim();
    if (!rationale) return;
    setBusy(`finding-${findingId}`);
    setError(null);
    try {
      await adminRequest(`${encodeURIComponent(skill.versionId ?? skill.id)}/findings/${encodeURIComponent(findingId)}`, {
        method: "PATCH",
        body: JSON.stringify({ disposition, reviewerRationale: rationale }),
      });
      await refresh(skill.versionId ?? skill.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Finding update failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-5">
        <form onSubmit={importSkill} className="rounded-xl border border-[var(--cc-line)] bg-white p-4">
          <h2 className="font-bold text-[var(--cc-ink)]">Import to quarantine</h2>
          <p className="mt-1 text-xs text-[var(--cc-muted)]">
            Repository URL, immutable commit, and skill path only. Marketplace listings are discovery metadata.
            Hosted parsing services, cloud parsers, install commands, and runtime installation are rejected.
          </p>
          <label className="mt-4 block text-xs font-semibold">Source repository
            <input aria-label="Source repository" required value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--cc-line)] px-3 py-2 text-sm" placeholder="https://github.com/org/repo" />
          </label>
          <label className="mt-3 block text-xs font-semibold">Immutable commit
            <input aria-label="Immutable commit" required value={commit} onChange={(event) => setCommit(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--cc-line)] px-3 py-2 font-mono text-sm" />
          </label>
          <label className="mt-3 block text-xs font-semibold">Skill path
            <input aria-label="Skill path" required value={skillPath} onChange={(event) => setSkillPath(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--cc-line)] px-3 py-2 font-mono text-sm" placeholder="skills/example" />
          </label>
          <button disabled={busy !== null} className="mt-4 rounded-md bg-[var(--cc-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy === "Import completed" ? "Importing…" : "Import safely"}
          </button>
        </form>

        <section className="rounded-xl border border-[var(--cc-line)] bg-white p-4">
          <h2 className="font-bold text-[var(--cc-ink)]">Quarantine queue</h2>
          <ul className="mt-3 space-y-2">
            {workspace.skills.map((skill) => {
              const id = skill.versionId ?? skill.id;
              return (
                <li key={id}>
                  <button onClick={() => setSelectedId(id)} className={`w-full rounded-md border p-3 text-left text-sm ${id === selectedId ? "border-[var(--cc-accent)] bg-[var(--cc-accent)]/5" : "border-[var(--cc-line)]"}`}>
                    <span className="block font-semibold">{skill.name} {skill.version}</span>
                    <span className="text-xs capitalize text-[var(--cc-muted)]">{skill.reviewStatus.replaceAll("_", " ")}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>

      <section className="min-w-0 rounded-xl border border-[var(--cc-line)] bg-white p-5">
        {error ? <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        {notice ? <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
        {!selected ? <p className="text-sm text-[var(--cc-muted)]">No quarantined skill versions.</p> : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{selected.name} <span className="font-mono text-sm">{selected.version}</span></h2>
                <p className="mt-1 text-sm text-[var(--cc-muted)]">{selected.contribution}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">{selected.reviewStatus.replaceAll("_", " ")}</span>
            </div>
            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
              <div><dt className="font-semibold">Repository / commit</dt><dd className="break-all">{selected.source.repositoryUrl}<br/><span className="font-mono">{selected.source.commit}</span></dd></div>
              <div><dt className="font-semibold">Digests</dt><dd className="font-mono">package {shortDigest(selected.packageDigest)}<br/>manifest {shortDigest(selected.manifestDigest)}</dd></div>
              <div><dt className="font-semibold">License / compatibility</dt><dd>{selected.license} · {selected.compatibility}</dd></div>
              <div><dt className="font-semibold">Applicability / tools</dt><dd>{selected.supportedStages.join(", ")} · {selected.supportedContentTypes.join(", ")}<br/>{selected.requestedTools.join(", ") || "No tools"}</dd></div>
            </dl>

            <h3 className="mt-7 font-bold">Deterministic findings</h3>
            {selected.findings.length ? <ul className="mt-2 space-y-2">{selected.findings.map((finding) => (
              <li key={finding.id} className="rounded-md border border-[var(--cc-line)] p-3 text-xs">
                <div className="flex gap-2"><strong className="uppercase">{finding.severity}</strong><span>{finding.rule}</span><span className="ml-auto capitalize">{finding.disposition ?? "open"}</span></div>
                <p className="mt-1">{finding.message}</p>
                {finding.filePath ? <p className="mt-1 font-mono text-[var(--cc-muted)]">{finding.filePath}{finding.line ? `:${finding.line}` : ""}</p> : null}
                {finding.reviewerRationale ? <p className="mt-1 text-[var(--cc-muted)]">Rationale: {finding.reviewerRationale}</p> : (
                  <div className="mt-2 flex gap-2">
                    <button disabled={busy !== null} onClick={() => void dispositionFinding(selected, finding.id, "resolved")} className="rounded border px-2 py-1">Resolve</button>
                    <button disabled={busy !== null} onClick={() => void dispositionFinding(selected, finding.id, "false_positive")} className="rounded border px-2 py-1">False positive</button>
                  </div>
                )}
              </li>
            ))}</ul> : <p className="mt-2 text-sm text-[var(--cc-muted)]">No findings.</p>}

            <h3 className="mt-7 font-bold">Quarantined files</h3>
            <div className="mt-2 space-y-2">{selected.files.map((file) => (
              <details key={file.path} className="rounded-md border border-[var(--cc-line)] p-3 text-xs">
                <summary className="cursor-pointer font-mono font-semibold">{file.path} · {file.byteCount} bytes · {shortDigest(file.digest)}</summary>
                <p className="mt-2 text-[var(--cc-muted)]">{file.mediaType}{file.executable ? " · blocked executable" : " · inert review artifact"}</p>
                {file.content ? <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-slate-100">{file.content}</pre> : <p className="mt-2">Content withheld by backend policy.</p>}
              </details>
            ))}</div>

            <div className="mt-7 rounded-md border border-[var(--cc-line)] p-3">
              <label className="text-xs font-semibold">Review notes
                <textarea aria-label="Review notes" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded border border-[var(--cc-line)] p-2 text-sm" />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={busy !== null} onClick={() => void mutate("Review approved", `${encodeURIComponent(selected.versionId ?? selected.id)}/review`, { decision: "approve", notes: reviewNotes })} className="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Approve review</button>
                <button disabled={busy !== null} onClick={() => void mutate("Review rejected", `${encodeURIComponent(selected.versionId ?? selected.id)}/review`, { decision: "reject", notes: reviewNotes })} className="rounded border border-red-300 px-3 py-2 text-xs font-semibold text-red-800">Reject</button>
                <button disabled={busy !== null || selected.reviewStatus.toLowerCase() !== "approved"} onClick={() => void mutate("Skill published", `${encodeURIComponent(selected.versionId ?? selected.id)}/publish`)} className="rounded bg-[var(--cc-accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Publish immutable version</button>
                <button disabled={busy !== null || selected.reviewStatus.toLowerCase() !== "published"} onClick={() => void mutate("Skill deprecated", `${encodeURIComponent(selected.versionId ?? selected.id)}/deprecate`, { reason: reviewNotes || "Superseded by governance review" })} className="rounded border px-3 py-2 text-xs font-semibold disabled:opacity-40">Deprecate</button>
              </div>
            </div>

            <h3 className="mt-7 font-bold">Audit history</h3>
            <ol className="mt-2 space-y-2 text-xs">{selected.audit.map((entry) => (
              <li key={entry.id} className="rounded-md bg-slate-50 p-3">
                <strong>{entry.action}</strong> · {entry.actor} · {entry.atUtc}
                {entry.beforeStatus || entry.afterStatus ? <span> · {entry.beforeStatus ?? "—"} → {entry.afterStatus ?? "—"}</span> : null}
                {entry.detail ? <p className="mt-1">{entry.detail}</p> : null}
              </li>
            ))}</ol>
          </>
        )}
      </section>
    </div>
  );
}
