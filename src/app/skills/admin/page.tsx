import Link from "next/link";
import { fetchGccV2 } from "@/app/auth/server-bff";
import { SkillAdminClient } from "./skill-admin-client";
import type { SkillAdminWorkspace } from "@/app/skills/skill-contract";

export default async function SkillAdminPage() {
  let workspace: SkillAdminWorkspace | null = null;
  let denied = false;
  let error: string | null = null;

  try {
    const response = await fetchGccV2("skills/admin");
    denied = response.status === 401 || response.status === 403;
    if (response.ok) workspace = (await response.json()) as SkillAdminWorkspace;
    else if (!denied) error = `Admin workspace is unavailable (HTTP ${response.status}).`;
  } catch {
    error = "Admin workspace is unavailable.";
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cc-accent)]">Governance</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--cc-ink)]">Skill administration</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--cc-muted)]">
            Import immutable source revisions into quarantine, inspect every file and finding, record
            reviewer dispositions, then publish or deprecate through the backend lifecycle.
          </p>
        </div>
        <Link href="/skills" className="rounded-lg border border-[var(--cc-line)] bg-white px-4 py-2 text-sm font-semibold">
          Catalog
        </Link>
      </div>

      {denied ? (
        <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6" role="alert">
          <h2 className="font-bold text-red-950">Administrator access required</h2>
          <p className="mt-2 text-sm text-red-800">
            GeekAPI denied this account. Catalog visibility does not grant import, quarantine-file,
            review, publication, deprecation, or audit permissions.
          </p>
        </section>
      ) : null}
      {error ? <p className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      {workspace ? <SkillAdminClient initialWorkspace={workspace} /> : null}
    </main>
  );
}
