import { ACCESS_COOKIE } from "@/app/auth/cookies";
import { cookies } from "next/headers";
import Link from "next/link";
import { HealthCheckButton } from "./health-check-button";
import { JobRunner } from "./job-runner";

export default async function HomePage() {
  const jar = await cookies();
  const signedIn = Boolean(jar.get(ACCESS_COOKIE)?.value);

  if (signedIn) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6">
        <div>
          <p className="text-sm font-medium tracking-wide text-[var(--cc-accent)]">
            Content Creator v2
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--cc-ink)]">
            Signed in
          </h1>
          <p className="mt-2 text-sm text-[var(--cc-muted)]">
            One app — GeekOAuth client. Phase 4 wires the brief UI + brand kits.
          </p>
        </div>
        <Link
          href="/creates/new"
          className="inline-flex w-fit rounded-md bg-[var(--cc-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--cc-accent-hover)]"
        >
          New content brief
        </Link>
        <Link
          href="/creates"
          className="inline-flex w-fit text-sm font-medium text-[var(--cc-accent)] underline-offset-2 hover:underline"
        >
          Your v2 creates
        </Link>
        <Link
          href="/legacy"
          className="inline-flex w-fit text-sm font-medium text-[var(--cc-accent)] underline-offset-2 hover:underline"
        >
          View v1 creates (read-only)
        </Link>
        <HealthCheckButton />
        <details className="rounded-lg border border-[var(--cc-line)] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--cc-ink)]">
            Phase 3 dummy job smoke test
          </summary>
          <div className="mt-3">
            <JobRunner />
          </div>
        </details>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="rounded-md border border-[var(--cc-line)] px-4 py-2 text-sm font-semibold text-[var(--cc-ink)]"
          >
            Sign out
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6">
      <div>
        <p className="text-sm font-medium tracking-wide text-[var(--cc-accent)]">
          Content Creator v2
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--cc-ink)]">
          Sign in to continue
        </h1>
        <p className="mt-2 text-sm text-[var(--cc-muted)]">
          Uses existing GeekOAuth — this app is a client only.
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
