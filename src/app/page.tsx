import { ACCESS_COOKIE } from "@/app/auth/cookies";
import { cookies } from "next/headers";
import Link from "next/link";
import { fetchGccV2 } from "@/app/auth/server-bff";

type ContentSummary = {
  id: string;
  title: string;
  contentType: string;
  createdAtUtc: string;
};

export default async function HomePage() {
  const jar = await cookies();
  const signedIn = Boolean(jar.get(ACCESS_COOKIE)?.value);

  if (signedIn) {
    let recent: ContentSummary[] = [];
    const res = await fetchGccV2("creates");
    if (res.ok) {
      recent = ((await res.json()) as ContentSummary[]).slice(0, 4);
    }

    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
        <section className="overflow-hidden rounded-2xl bg-[var(--cc-ink)] px-6 py-8 text-white sm:px-9">
          <p className="text-sm font-medium text-teal-200">Your content workspace</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            What will you create today?
          </h1>
          <p className="mt-3 max-w-xl text-sm text-slate-300">
            Turn your site, audience, and goals into researched content ready to review.
          </p>
          <Link
            href="/creates/new"
            className="mt-6 inline-flex rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[var(--cc-ink)] hover:bg-slate-100"
          >
            Start new content
          </Link>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--cc-ink)]">Workspace</h2>
              <p className="mt-1 text-sm text-[var(--cc-muted)]">
                Projects, batch Grid, Studio, Task Agents, and transparent ROI.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Workspace surfaces">
            {[
              {
                href: "/projects",
                label: "Projects",
                detail: "Multi-asset Canvas with review, publish, and handoffs.",
              },
              {
                href: "/grid",
                label: "Grid",
                detail: "Sample/full batches with due schedules.",
              },
              {
                href: "/task-agents",
                label: "Task Agents",
                detail: "Outcome agents with durable runs and artifacts.",
              },
              {
                href: "/studio",
                label: "Studio",
                detail: "Author, dry-run, and publish custom agents.",
              },
              {
                href: "/roi",
                label: "ROI",
                detail: "Projected scenarios vs observed TaskRun and Canvas telemetry.",
              },
              {
                href: "/creates/new",
                label: "Guided create",
                detail: "Evidence-backed content from brief through canvas.",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-[var(--cc-line)] bg-white p-4 transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-sm"
              >
                <p className="font-semibold text-[var(--cc-ink)]">{item.label}</p>
                <p className="mt-2 text-sm leading-5 text-[var(--cc-muted)]">{item.detail}</p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--cc-ink)]">Recent content</h2>
              <p className="mt-1 text-sm text-[var(--cc-muted)]">Continue your latest work.</p>
            </div>
            <Link href="/creates" className="text-sm font-semibold text-[var(--cc-accent)]">
              View library
            </Link>
          </div>
          {recent.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {recent.map((item) => (
                <Link
                  key={item.id}
                  href={`/creates/${item.id}`}
                  className="rounded-xl border border-[var(--cc-line)] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <p className="font-semibold text-[var(--cc-ink)]">{item.title}</p>
                  <p className="mt-2 text-xs text-[var(--cc-muted)]">
                    Updated {new Date(item.createdAtUtc).toLocaleDateString()}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-[var(--cc-line)] bg-white p-8 text-center">
              <p className="font-medium text-[var(--cc-ink)]">Your library is ready</p>
              <p className="mt-1 text-sm text-[var(--cc-muted)]">Start your first guided content workflow.</p>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6">
      <div>
        <p className="text-sm font-medium tracking-wide text-[var(--cc-accent)]">
          Content Creator
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--cc-ink)]">
          Sign in to continue
        </h1>
        <p className="mt-2 text-sm text-[var(--cc-muted)]">
          Plan, research, draft, and review content in one place.
        </p>
      </div>
      <a
        href="/api/auth/start"
        className="inline-flex w-fit rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--cc-accent-hover)]"
      >
        Sign in
      </a>
    </main>
  );
}
