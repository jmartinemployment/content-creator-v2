import Link from "next/link";
import { fetchGccV2 } from "@/app/auth/server-bff";
import { shortDigest, type SkillCatalog } from "@/app/skills/skill-contract";

export default async function SkillsPage() {
  let catalog: SkillCatalog | null = null;
  let error: string | null = null;
  try {
    const response = await fetchGccV2("skills");
    if (response.ok) catalog = (await response.json()) as SkillCatalog;
    else error = `Skills catalog is unavailable (HTTP ${response.status}).`;
  } catch {
    error = "Skills catalog is unavailable.";
  }

  const skillsById = new Map(catalog?.skills.map((skill) => [skill.id, skill]) ?? []);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-accent)]">Quality system</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--cc-ink)]">Skills</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--cc-muted)]">
            Reviewed instructions applied automatically to research, outlining, writing, validation, and repair.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/skills/admin" className="rounded-lg border border-[var(--cc-line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--cc-ink)]">
            Admin review
          </Link>
          <Link href="/creates/new" className="rounded-lg bg-[var(--cc-accent)] px-4 py-2.5 text-sm font-semibold text-white">
            Create content
          </Link>
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4" aria-label="Automatic skill selection">
        <p className="font-semibold text-blue-950">Automatic and read-only</p>
        <p className="mt-1 text-sm text-blue-900">
          The backend selects the approved set for each content type and persists it with the job.
          Operators cannot install or inject skills at runtime. Every run uses an immutable,
          backend-resolved snapshot.
        </p>
        {catalog ? <p className="mt-2 text-xs text-blue-800">Catalog {catalog.catalogVersion}</p> : null}
      </section>

      {error ? <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}

      {catalog ? (
        <>
          <section className="mt-10">
            <h2 className="text-xl font-bold text-[var(--cc-ink)]">Recommended bundles by goal</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {catalog.recommendedBundles.map((bundle) => (
                <article key={bundle.id} className="rounded-xl border border-[var(--cc-line)] bg-white p-5">
                  <h3 className="font-bold text-[var(--cc-ink)]">{bundle.name}</h3>
                  <p className="mt-1 text-sm text-[var(--cc-muted)]">{bundle.goal}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bundle.skillIds.map((id) => (
                      <span key={id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                        {skillsById.get(id)?.name ?? id}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-bold text-[var(--cc-ink)]">Governed catalog</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {catalog.skills.map((skill) => (
                <article id={`skill-${skill.id}`} key={skill.id} className="scroll-mt-20 rounded-xl border border-[var(--cc-line)] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-[var(--cc-ink)]">{skill.name}</h3>
                      <p className="mt-1 text-sm text-[var(--cc-muted)]">{skill.contribution}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      skill.deprecatedAtUtc || skill.reviewStatus.toLowerCase() === "deprecated"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-emerald-50 text-emerald-700"
                    }`}>
                      {skill.reviewStatus}
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-3 text-xs text-[var(--cc-muted)] sm:grid-cols-2">
                    <div><dt className="font-semibold text-[var(--cc-ink)]">Immutable version</dt><dd>{skill.version}</dd></div>
                    <div><dt className="font-semibold text-[var(--cc-ink)]">Origin</dt><dd>{skill.origin === "first-party" ? "First party" : "Community"}</dd></div>
                    <div><dt className="font-semibold text-[var(--cc-ink)]">Package digest</dt><dd className="font-mono" title={skill.packageDigest}>{shortDigest(skill.packageDigest)}</dd></div>
                    <div><dt className="font-semibold text-[var(--cc-ink)]">License</dt><dd>{skill.license}</dd></div>
                    <div><dt className="font-semibold text-[var(--cc-ink)]">Compatibility</dt><dd>{skill.compatibility}</dd></div>
                    <div><dt className="font-semibold text-[var(--cc-ink)]">Reviewed by</dt><dd>{skill.reviewer || "Pending"}</dd></div>
                    <div className="sm:col-span-2">
                      <dt className="font-semibold text-[var(--cc-ink)]">Imported artifact</dt>
                      <dd className="break-all">
                        <a href={skill.source.repositoryUrl} target="_blank" rel="noreferrer" className="text-[var(--cc-accent)] underline">
                          {skill.source.repositoryUrl}
                        </a>
                        <span className="block font-mono">{shortDigest(skill.source.commit)} · {skill.source.path}</span>
                        {skill.source.discoveryUrl ? <span className="block">Discovery metadata is not the imported artifact.</span> : null}
                      </dd>
                    </div>
                    <div className="sm:col-span-2"><dt className="font-semibold text-[var(--cc-ink)]">Applicable stages</dt><dd>{skill.supportedStages.join(", ") || "None"}</dd></div>
                    <div className="sm:col-span-2"><dt className="font-semibold text-[var(--cc-ink)]">Content types</dt><dd>{skill.supportedContentTypes.join(", ") || "None"}</dd></div>
                    <div className="sm:col-span-2"><dt className="font-semibold text-[var(--cc-ink)]">Requested tools</dt><dd>{skill.requestedTools.join(", ") || "No tools"}</dd></div>
                    <div className="sm:col-span-2">
                      <dt className="font-semibold text-[var(--cc-ink)]">Used by specialists</dt>
                      <dd className="flex flex-wrap gap-2">
                        {skill.assignedAgentIds?.length ? skill.assignedAgentIds.map((agentId) => (
                          <Link key={agentId} href={`/agents/${encodeURIComponent(agentId)}`} className="text-[var(--cc-accent)] underline">{agentId}</Link>
                        )) : <Link href="/agents" className="text-[var(--cc-accent)] underline">View agent assignments</Link>}
                      </dd>
                    </div>
                    {skill.deprecatedAtUtc ? <div className="sm:col-span-2"><dt className="font-semibold text-amber-900">Deprecation</dt><dd>Deprecated {skill.deprecatedAtUtc}{skill.supersededByVersionId ? ` · superseded by ${skill.supersededByVersionId}` : ""}</dd></div> : null}
                  </dl>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
