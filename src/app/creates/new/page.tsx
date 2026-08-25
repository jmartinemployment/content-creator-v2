import { requireAccessToken } from "@/app/auth/session";
import { NewCreateForm } from "./new-create-form";

export default async function NewCreatePage() {
  // Redirects to /api/auth/start when there's no session — never renders the form signed out.
  await requireAccessToken();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-medium tracking-wide text-[var(--cc-accent)]">
          Content Creator v2
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--cc-ink)]">New content brief</h1>
        <p className="mt-2 text-sm text-[var(--cc-muted)]">
          Creates a brief + job, then jumps to the live event stream.
        </p>
      </div>
      <NewCreateForm />
    </main>
  );
}
