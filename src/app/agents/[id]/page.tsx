import Link from "next/link";
import { requireAccessToken } from "@/app/auth/session";
import { fetchGccV2 } from "@/app/auth/server-bff";
import { normalizeAgent, normalizeAgentCatalog } from "@/app/agents/agent-contract";
import { shortDigest } from "@/app/skills/skill-contract";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAccessToken();
  const { id } = await params;
  const response = await fetchGccV2(`agents/${encodeURIComponent(id)}`);
  if (!response.ok) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/agents" className="text-sm text-[var(--cc-accent)]">← Agent Library</Link>
        <h1 className="mt-6 text-2xl font-bold">Specialist unavailable</h1>
        <p className="mt-2 text-sm text-[var(--cc-muted)]">The catalog returned HTTP {response.status}.</p>
      </main>
    );
  }
  let agent = normalizeAgent(await response.json());
  if (!agent.skills.length) {
    const catalogResponse = await fetchGccV2("agents");
    if (catalogResponse.ok) {
      const catalogVersion = normalizeAgentCatalog(await catalogResponse.json()).agents
        .find((item) => item.id === agent.id && item.versionId === agent.versionId);
      if (catalogVersion) agent = { ...agent, skills: catalogVersion.skills };
    }
  }
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/agents" className="text-sm text-[var(--cc-accent)]">← Agent Library</Link>
      <div className="mt-6 rounded-xl border border-[var(--cc-line)] bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-accent)]">
          {agent.specialty} · {[...new Set(agent.participation.map((row) => row.role))].join(" · ") || agent.role}
        </p>
        <h1 className="mt-2 text-3xl font-bold">{agent.name}</h1>
        <p className="mt-3 text-[var(--cc-muted)]">{agent.description}</p>
        {agent.objective ? <p className="mt-4 rounded bg-slate-50 p-3 text-sm"><strong>Objective:</strong> {agent.objective}</p> : null}
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold">Stable catalog ID</dt><dd className="font-mono">{agent.id}</dd></div>
          <div><dt className="font-semibold">Immutable version ID</dt><dd className="font-mono">{agent.versionId}</dd></div>
          <div><dt className="font-semibold">Version</dt><dd>{agent.version}</dd></div>
          <div><dt className="font-semibold">Digest</dt><dd className="font-mono" title={agent.digest}>{shortDigest(agent.digest)}</dd></div>
          <div><dt className="font-semibold">Content types</dt><dd>{agent.supportedContentTypes.join(", ") || "All compatible types"}</dd></div>
          <div><dt className="font-semibold">Stages</dt><dd>{agent.supportedStages.join(", ") || "Backend assigned"}</dd></div>
          <div><dt className="font-semibold">Allowed models</dt><dd>{agent.models.join(", ") || "None returned"}</dd></div>
          <div><dt className="font-semibold">Model policy</dt><dd>{agent.modelPolicyVersion || agent.modelPolicy?.version || "content-model-policy.v1"}</dd></div>
          <div className="sm:col-span-2"><dt className="font-semibold">Allowed tools</dt><dd>{agent.tools.join(", ") || "None returned"}</dd></div>
        </dl>
        <section className="mt-7">
          <h2 className="font-bold">Stage responsibilities</h2>
          <ol className="mt-2 space-y-1 text-sm">
            {[...agent.participation].sort((a, b) => a.order - b.order).map((row) => (
              <li key={`${row.stage}-${row.role}`}><span className="font-mono">{row.order}</span> · {row.stage} · <strong className="capitalize">{row.role}</strong></li>
            ))}
          </ol>
        </section>
        <section className="mt-7">
          <h2 className="font-bold">Exact pinned skills</h2>
          {agent.skills.length ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {agent.skills.map((skill) => (
                <li key={skill.versionId}><Link href={`/skills?agentId=${encodeURIComponent(agent.id)}#skill-${encodeURIComponent(skill.id)}`} className="block rounded bg-slate-100 px-3 py-2 text-xs text-[var(--cc-accent)]"><strong>{skill.name || skill.id} {skill.version}</strong><span className="block font-mono">{skill.versionId} · {shortDigest(skill.digest)}</span></Link></li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-[var(--cc-muted)]">No catalog skills assigned.</p>}
        </section>
      </div>
    </main>
  );
}
