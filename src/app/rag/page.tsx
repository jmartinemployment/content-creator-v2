import Link from "next/link";
import { requireAccessToken } from "@/app/auth/session";
import { RAG_INTENT_VALUES } from "./intents";
import { RagWriterForm } from "./rag-writer-form";
import type { RagWritingIntent } from "./types";

export default async function RagWriterPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; intent?: string }>;
}) {
  await requireAccessToken();
  const params = await searchParams;
  const topic = typeof params.topic === "string" ? params.topic : "";
  const intentRaw = typeof params.intent === "string" ? params.intent : "";
  const initialIntent = RAG_INTENT_VALUES.has(intentRaw as RagWritingIntent)
    ? (intentRaw as RagWritingIntent)
    : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <Link href="/" className="text-sm text-[var(--cc-accent)]">
          ← Home
        </Link>
        <p className="mt-2 text-sm font-medium tracking-wide text-[var(--cc-accent)]">
          Content Creator v2
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--cc-ink)]">
          RAG writing
        </h1>
        <p className="mt-2 text-sm text-[var(--cc-muted)]">
          Intent-routed drafts grounded on partner and competitor crawl RAG via GeekAPI. Long-form
          uses o1/o3 when configured; short-form can apply local ad templates; slides/strategy use
          GraphRAG when enabled.
        </p>
      </div>

      <RagWriterForm initialTopic={topic} initialIntent={initialIntent} />
    </main>
  );
}
