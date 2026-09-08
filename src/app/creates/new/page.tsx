import { requireAccessToken } from "@/app/auth/session";
import { NewCreateForm } from "./new-create-form";
import { CONTENT_TYPES, type ContentType } from "../content-types";
import type { RagWritingIntent } from "@/app/rag/types";

const INTENT_CONTENT_TYPE: Partial<Record<RagWritingIntent, ContentType>> = {
  "Technical Article": "tech-article",
  "Case Study": "case-study",
  "Social Ad": "ads",
  "Short Form": "social",
  "Competitive Battlecard": "comparison",
  "Pitch Slides": "linkedin-document",
  "Strategy Theme": "linkedin-document",
};

export default async function NewCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; intent?: string; contentType?: string }>;
}) {
  // Redirects to /api/auth/start when there's no session — never renders the form signed out.
  await requireAccessToken();
  const params = await searchParams;
  const explicitType = CONTENT_TYPES.find((item) => item.value === params.contentType)?.value;
  const migratedType = INTENT_CONTENT_TYPE[params.intent as RagWritingIntent];
  const initialContentType = explicitType ?? migratedType ?? "pillar";
  const initialTopic = typeof params.topic === "string" ? params.topic : "";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm font-medium tracking-wide text-[var(--cc-accent)]">
          Content Creator v2
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--cc-ink)]">New content brief</h1>
        <p className="mt-2 text-sm text-[var(--cc-muted)]">
          Enter the project site URL — we crawl it and use its pages for grounding and links, then
          you fill the brief. BrandKit and outline gates run on the canvas.
        </p>
      </div>
      <NewCreateForm initialTopic={initialTopic} initialContentType={initialContentType} />
    </main>
  );
}
