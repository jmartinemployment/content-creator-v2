import Link from "next/link";
import { requireAccessToken } from "@/app/auth/session";
import { fetchGccV2 } from "@/app/auth/server-bff";
import { AgentAdminClient } from "./agent-admin-client";
import { normalizeAgentAdminWorkspace, type AgentAdminWorkspace } from "@/app/agents/agent-contract";
import type { SkillCatalog, SkillSummary } from "@/app/skills/skill-contract";

export default async function AgentAdminPage() {
  await requireAccessToken();
  let workspace: AgentAdminWorkspace | null = null;
  let denied = false;
  let error: string | null = null;
  let publishedSkillVersions: SkillSummary[] = [];
  try {
    const response = await fetchGccV2("agents/admin");
    denied = response.status === 401 || response.status === 403;
    if (response.ok) workspace = normalizeAgentAdminWorkspace(await response.json());
    else if (!denied) error = `Agent admin workspace is unavailable (HTTP ${response.status}).`;
    if (!denied) {
      const skillsResponse = await fetchGccV2("skills");
      if (!skillsResponse.ok) throw new Error(`Published skills unavailable (HTTP ${skillsResponse.status}).`);
      const catalog = await skillsResponse.json() as SkillCatalog;
      if (!Array.isArray(catalog.skills)) throw new Error("Published skills response is invalid.");
      publishedSkillVersions = catalog.skills.filter((skill) =>
        skill.reviewStatus.toLowerCase() === "published" && Boolean(skill.versionId),
      );
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Agent admin workspace is unavailable.";
  }
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-accent)]">Governance</p><h1 className="mt-2 text-3xl font-bold">Agent administration</h1><p className="mt-2 max-w-3xl text-sm text-[var(--cc-muted)]">Create immutable specialist versions, test them, review assignments, and control publication, deprecation, and emergency revocation.</p></div><Link href="/agents" className="rounded border px-4 py-2 text-sm font-semibold">Library</Link></div>
      {denied ? <section role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6"><h2 className="font-bold text-red-950">Administrator access required</h2><p className="mt-2 text-sm text-red-800">The backend denied agent lifecycle permissions for this account.</p></section> : null}
      {error ? <p role="alert" className="mt-8 rounded bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      {workspace ? <AgentAdminClient initialWorkspace={workspace} publishedSkillVersions={publishedSkillVersions} /> : null}
    </main>
  );
}
