"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getAssetLineage,
  getProjectEdges,
  latestVersion,
} from "@/app/projects/project-model";
import {
  addProjectAssetComment,
  appendProjectAssetVersion,
  approveProjectAsset,
  convertProjectAssetToGrid,
  getProject,
  publishProjectAsset,
  requestProjectAssetApproval,
  sendProjectAssetToAgent,
  type SendToAgentCapability,
} from "@/app/projects/projects-api";
import { listGrids } from "@/app/grid/grid-api";
import type { GridSummary } from "@/app/grid/grid-types";
import type { AssetKind, AssetStatus, CanvasProject } from "@/app/projects/project-types";

const assetGlyph = { brief: "▤", article: "¶", social: "▦", image: "▧", email: "✉", report: "▣" } as const;
const statusStyles: Record<AssetStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  "in-review": "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  published: "border-blue-200 bg-blue-50 text-blue-800",
};

const sendAgentOptions: ReadonlyArray<{ id: SendToAgentCapability; label: string }> = [
  { id: "faq-generator", label: "FAQ Generator" },
  { id: "pillar-outline", label: "Pillar Article Outline" },
  { id: "citable-claims", label: "Citable Claims" },
];

function defaultSendCapability(kind: AssetKind): SendToAgentCapability {
  return kind === "article" || kind === "brief" ? "pillar-outline" : "faq-generator";
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<CanvasProject | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [batchNotice, setBatchNotice] = useState<{ gridId: string; gridName: string } | null>(null);
  const [sendCapability, setSendCapability] = useState<SendToAgentCapability>("faq-generator");
  const [grids, setGrids] = useState<GridSummary[]>([]);
  const [gridsLoading, setGridsLoading] = useState(false);
  const [targetGridId, setTargetGridId] = useState("");

  useEffect(() => {
    void getProject(projectId)
      .then((next) => {
        setProject(next);
        setSelectedAssetId(next.assets[0]?.id ?? null);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load project."))
      .finally(() => setReady(true));
  }, [projectId]);

  useEffect(() => {
    setGridsLoading(true);
    void listGrids()
      .then((items) => {
        setGrids(items);
        setTargetGridId((current) => current || items[0]?.id || "");
      })
      .catch(() => setGrids([]))
      .finally(() => setGridsLoading(false));
  }, [projectId]);

  const selectedAsset = useMemo(() => {
    if (!project) return null;
    return project.assets.find((asset) => asset.id === selectedAssetId) ?? project.assets[0] ?? null;
  }, [project, selectedAssetId]);

  useEffect(() => {
    if (selectedAsset) {
      setSendCapability(defaultSendCapability(selectedAsset.kind));
    }
  }, [selectedAsset?.id, selectedAsset?.kind]);

  if (!ready) {
    return <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-[var(--cc-muted)]">Loading project…</main>;
  }

  if (!project) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold text-[var(--cc-accent)]">Canvas</p>
        <h1 className="mt-2 text-2xl font-semibold">Project not found</h1>
        <p className="mt-3 text-sm text-[var(--cc-muted)]">{error ?? "This project is not available."}</p>
        <Link href="/projects" className="mt-6 inline-block text-sm font-semibold text-[var(--cc-accent)]">
          ← Back to projects
        </Link>
      </main>
    );
  }

  const lineage = selectedAsset ? getAssetLineage(project, selectedAsset.id) : null;
  const currentVersion = selectedAsset ? latestVersion(selectedAsset) : null;
  const edges = getProjectEdges(project);

  async function addVersion() {
    if (!selectedAsset || !currentVersion || !project) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await appendProjectAssetVersion(project.id, selectedAsset.id, {
        createdAt: new Date().toISOString(),
        createdBy: "You",
        status: "draft",
        summary: `Successor draft based on v${currentVersion.version}.`,
        evidence: currentVersion.evidence,
        provenance: {
          origin: "human",
          note: `Created successor of ${currentVersion.id}; content editing is not connected yet.`,
        },
      });
      setProject(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create version.");
    } finally {
      setSaving(false);
    }
  }

  async function requestApproval() {
    if (!selectedAsset || !currentVersion || !project) return;
    if (currentVersion.status !== "draft") return;
    setSaving(true);
    setError(null);
    try {
      const updated = await requestProjectAssetApproval(project.id, selectedAsset.id, {
        createdAt: new Date().toISOString(),
        createdBy: "You",
        summary: `Submitted v${currentVersion.version} for review.`,
        evidence: currentVersion.evidence,
        provenance: {
          origin: "human",
          note: `Requested approval from ${currentVersion.id}.`,
        },
      });
      setProject(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not request approval.");
    } finally {
      setSaving(false);
    }
  }

  async function approveAsset() {
    if (!selectedAsset || !currentVersion || !project) return;
    if (currentVersion.status !== "in-review") return;
    setSaving(true);
    setError(null);
    try {
      const updated = await approveProjectAsset(project.id, selectedAsset.id, {
        createdAt: new Date().toISOString(),
        createdBy: "You",
        summary: `Approved v${currentVersion.version}.`,
        evidence: currentVersion.evidence,
        provenance: {
          origin: "human",
          note: `Approved from ${currentVersion.id}.`,
        },
      });
      setProject(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not approve asset.");
    } finally {
      setSaving(false);
    }
  }

  async function publishAsset() {
    if (!selectedAsset || !currentVersion || !project) return;
    if (currentVersion.status !== "approved") return;
    setSaving(true);
    setError(null);
    try {
      const updated = await publishProjectAsset(project.id, selectedAsset.id, {
        createdAt: new Date().toISOString(),
        createdBy: "You",
        summary: `Published v${currentVersion.version}.`,
        evidence: currentVersion.evidence,
        provenance: {
          origin: "human",
          note: `Published from ${currentVersion.id}.`,
        },
      });
      setProject(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not publish asset.");
    } finally {
      setSaving(false);
    }
  }

  async function addComment() {
    if (!selectedAsset || !project) return;
    const message = commentDraft.trim();
    if (!message) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await addProjectAssetComment(project.id, selectedAsset.id, {
        message,
        createdBy: "You",
      });
      setProject(updated);
      setCommentDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add comment.");
    } finally {
      setSaving(false);
    }
  }

  async function convertToBatch() {
    if (!selectedAsset || !project) return;
    setSaving(true);
    setError(null);
    setBatchNotice(null);
    try {
      const result = await convertProjectAssetToGrid(project.id, selectedAsset.id, {
        createdBy: "You",
      });
      setProject(result.project);
      setBatchNotice({ gridId: result.gridId, gridName: result.gridName });
      setGrids((current) => {
        if (current.some((grid) => grid.id === result.gridId)) return current;
        return [
          {
            id: result.gridId,
            name: result.gridName,
            description: "",
            status: "ready",
            updatedAt: new Date().toISOString(),
            owner: "You",
            rowCount: result.rowCount,
            lastRunStatus: null,
            persistence: "server",
          },
          ...current,
        ];
      });
      setTargetGridId(result.gridId);
      router.push(`/grid/${result.gridId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not convert to batch.");
    } finally {
      setSaving(false);
    }
  }

  async function appendToExistingBatch() {
    if (!selectedAsset || !project || !targetGridId) return;
    setSaving(true);
    setError(null);
    setBatchNotice(null);
    try {
      const result = await convertProjectAssetToGrid(project.id, selectedAsset.id, {
        createdBy: "You",
        targetGridId,
      });
      setProject(result.project);
      setBatchNotice({ gridId: result.gridId, gridName: result.gridName });
      router.push(`/grid/${result.gridId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not append to batch.");
    } finally {
      setSaving(false);
    }
  }

  async function sendToAgent() {
    if (!selectedAsset || !project) return;
    setSaving(true);
    setError(null);
    try {
      const result = await sendProjectAssetToAgent(project.id, selectedAsset.id, {
        capabilityId: sendCapability,
        createdBy: "You",
      });
      setProject(result.project);
      router.push(result.redirectPath);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send to agent.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/projects" className="text-sm font-semibold text-[var(--cc-accent)] hover:underline">
        ← Projects
      </Link>

      <header className="mt-4 rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--cc-accent)]">Project canvas</p>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                Server-backed
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--cc-ink)]">{project.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cc-muted)]">{project.description}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <dt className="text-[var(--cc-muted)]">Owner</dt>
            <dd className="font-medium text-[var(--cc-ink)]">{project.owner}</dd>
            <dt className="text-[var(--cc-muted)]">Assets</dt>
            <dd className="font-medium text-[var(--cc-ink)]">{project.assets.length}</dd>
          </dl>
        </div>
        {error ? <p role="alert" className="mt-4 text-sm text-red-800">{error}</p> : null}
        {batchNotice ? (
          <p className="mt-4 text-sm text-[var(--cc-ink)]">
            Converted to{" "}
            <Link href={`/grid/${batchNotice.gridId}`} className="font-semibold text-[var(--cc-accent)] hover:underline">
              {batchNotice.gridName}
            </Link>
            .
          </p>
        ) : null}
      </header>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <section aria-labelledby="relationship-heading" className="overflow-hidden rounded-2xl border border-[var(--cc-line)] bg-[#f3f7f6] shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--cc-line)] bg-white px-5 py-4">
              <div>
                <h2 id="relationship-heading" className="font-semibold text-[var(--cc-ink)]">Asset relationships</h2>
                <p className="mt-0.5 text-xs text-[var(--cc-muted)]">Select an asset to inspect its immutable history and lineage.</p>
              </div>
              <p className="text-xs text-[var(--cc-muted)]">{edges.length} handoff{edges.length === 1 ? "" : "s"}</p>
            </div>
            <ul aria-label="Project asset canvas" className="grid gap-3 p-5 sm:grid-cols-2">
              {project.assets.map((asset) => {
                const version = latestVersion(asset);
                const selected = selectedAsset?.id === asset.id;
                return (
                  <li key={asset.id}>
                    <button
                      type="button"
                      aria-label={`Select ${asset.title}`}
                      onClick={() => setSelectedAssetId(asset.id)}
                      className={`w-full rounded-xl border bg-white p-4 text-left transition ${
                        selected
                          ? "border-[var(--cc-accent)] ring-2 ring-[var(--cc-accent)]/20"
                          : "border-[var(--cc-line)] hover:border-teal-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-lg" aria-hidden>{assetGlyph[asset.kind]}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyles[version.status]}`}>
                          {version.status}
                        </span>
                      </div>
                      <p className="mt-3 font-semibold text-[var(--cc-ink)]">{asset.title}</p>
                      <p className="mt-1 text-xs text-[var(--cc-muted)]">
                        v{version.version} · {asset.parentAssetIds.length} parent{asset.parentAssetIds.length === 1 ? "" : "s"}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {selectedAsset && currentVersion && lineage ? (
            <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--cc-ink)]">{selectedAsset.title}</h2>
                  <p className="mt-1 text-sm text-[var(--cc-muted)]">
                    {lineage.parents.length} parent artifact{lineage.parents.length === 1 ? "" : "s"} · {lineage.children.length} child artifact{lineage.children.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void addVersion()}
                  className="rounded-lg bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Creating…" : "Create next version"}
                </button>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--cc-muted)]">{currentVersion.summary}</p>
              {currentVersion.provenance.note ? (
                <p className="mt-3 text-xs text-[var(--cc-muted)]">{currentVersion.provenance.note}</p>
              ) : null}
              {currentVersion.provenance.sourceArtifactVersionId ? (
                <p className="mt-2 font-mono text-[0.7rem] text-[var(--cc-muted)]" data-testid="attached-artifact-ref">
                  source artifact {currentVersion.provenance.sourceArtifactVersionId}
                  {currentVersion.provenance.artifactType
                    ? ` · ${currentVersion.provenance.artifactType}`
                    : ""}
                </p>
              ) : null}

              <h3 className="mt-6 text-sm font-semibold text-[var(--cc-ink)]">Version history</h3>
              <ul
                aria-label={`${selectedAsset.title} version history`}
                className="mt-3 space-y-3"
              >
                {[...selectedAsset.versions].reverse().map((version) => (
                  <li key={version.id} className="rounded-lg border border-[var(--cc-line)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Version {version.version}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusStyles[version.status]}`}>
                        {version.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--cc-muted)]">{version.summary}</p>
                    <p className="mt-2 text-xs text-[var(--cc-muted)]">
                      {version.createdBy} · {new Date(version.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-5 space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--cc-ink)]">Comment</span>
                  <textarea
                    aria-label="Asset comment"
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Leave editorial feedback on this asset…"
                    className="mt-1 w-full rounded-lg border border-[var(--cc-line)] bg-white px-3 py-2 text-sm text-[var(--cc-ink)] outline-none focus:border-[var(--cc-accent)]"
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={saving || commentDraft.trim().length === 0}
                    onClick={() => void addComment()}
                    className="rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Add comment"}
                  </button>
                  <button
                    type="button"
                    disabled={saving || currentVersion.status !== "draft"}
                    onClick={() => void requestApproval()}
                    className="rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Request approval
                  </button>
                  <button
                    type="button"
                    disabled={saving || currentVersion.status !== "in-review"}
                    onClick={() => void approveAsset()}
                    className="rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={saving || currentVersion.status !== "approved"}
                    onClick={() => void publishAsset()}
                    className="rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Publish
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void convertToBatch()}
                    className="rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Convert to batch
                  </button>
                  <div className="flex flex-wrap items-end gap-2" data-testid="append-to-existing-batch">
                    <label className="text-xs font-semibold text-[var(--cc-ink)]">
                      Existing batch
                      <select
                        aria-label="Existing batch grid"
                        className="mt-1 block min-w-[14rem] rounded-lg border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
                        value={targetGridId}
                        disabled={saving || gridsLoading || grids.length === 0}
                        onChange={(event) => setTargetGridId(event.target.value)}
                      >
                        {grids.length === 0 ? (
                          <option value="">No grids yet</option>
                        ) : (
                          grids.map((grid) => (
                            <option key={grid.id} value={grid.id}>{grid.name}</option>
                          ))
                        )}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={saving || !targetGridId || grids.length === 0}
                      onClick={() => void appendToExistingBatch()}
                      className="rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      Add to existing batch
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="sr-only">Send to agent</span>
                    <select
                      aria-label="Send to agent"
                      value={sendCapability}
                      onChange={(event) => setSendCapability(event.target.value as SendToAgentCapability)}
                      disabled={saving}
                      className="rounded-lg border border-[var(--cc-line)] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      {sendAgentOptions.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void sendToAgent()}
                    className="rounded-lg border border-[var(--cc-line)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Send to agent
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-[var(--cc-line)] bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-[var(--cc-ink)]">Activity</h2>
            <ul className="mt-4 space-y-3">
              {project.activity.map((item) => (
                <li key={item.id} className="text-sm">
                  <p className="font-medium text-[var(--cc-ink)]">{item.message}</p>
                  <p className="mt-1 text-xs text-[var(--cc-muted)]">
                    {item.actor} · {new Date(item.occurredAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
