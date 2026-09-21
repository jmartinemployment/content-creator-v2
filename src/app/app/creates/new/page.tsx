"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ClientsPanel from "@/components/content-writer/ClientsPanel";
import { ApiError } from "@/services/content-writer-api";
import { listClients, type GccClient } from "@/services/gcc-projects-api";
import { createGccCreate } from "@/services/gcc-api";
import { CONTENT_TYPES, DEFAULT_CONTENT_TYPE } from "@/lib/content-types";

/**
 * Start a create directly, without crawling first.
 *
 * Crawling remains the grounded path: it attaches real site-section context, which is what
 * lets generation cite the site's own structure. This page exists because that was the *only* way
 * in - if a topic was not surfaced as a gap, there was no way to write about it at all.
 *
 * A create started here carries no site section. That is deliberate and visible: generation will
 * refuse rather than invent site grounding it does not have, so the operator finds out here, not
 * after a draft that reads like filler.
 */
export default function NewCreatePage() {
  const router = useRouter();
  const [clients, setClients] = useState<GccClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [startingContentType, setStartingContentType] =
    useState<string>(DEFAULT_CONTENT_TYPE);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listClients()
      .then((list) => {
        setClients(list);
        if (list[0]) setSelectedClientId(list[0].id);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load clients."),
      );
  }, []);

  const canStart = selectedClientId !== null && topic.trim().length > 0;

  async function submit() {
    if (!selectedClientId) {
      setError("Select a client first.");
      return;
    }
    const trimmedTopic = topic.trim();
    if (trimmedTopic.length === 0) {
      setError("Enter what this piece is about.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const created = await createGccCreate({
        clientId: selectedClientId,
        startingContentType,
        topic: trimmedTopic,
        notes: notes.trim() || null,
      });
      router.push(`/app/creates/${created.id}`);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not start the create.",
      );
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          Content Creator
        </p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">New create</h1>
        <p className="mt-2 text-sm text-muted">
          Start from a topic you already have. For site-grounded writing — where the draft
          cites your own section structure —{" "}
          <Link href="/app/create" className="font-semibold text-brand">
            crawl the site first
          </Link>.
        </p>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div className="mb-6">
        <ClientsPanel
          clients={clients}
          selectedClientId={selectedClientId}
          onSelect={setSelectedClientId}
          onCreated={(client) => {
            setClients((prev) => [...prev, client]);
            setSelectedClientId(client.id);
          }}
                  onDeleted={(clientId) => {
            setClients((prev) => prev.filter((c) => c.id !== clientId));
            setSelectedClientId((prev) => (prev === clientId ? null : prev));
          }}
        />
      </div>

      <label className="block text-sm font-medium text-foreground">
        What is this piece about?
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={creating}
          placeholder="Accounts payable automation for mid-market construction"
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:opacity-50"
        />
      </label>

      <label className="mt-5 block text-sm font-medium text-foreground">
        Content type
        <select
          value={startingContentType}
          onChange={(e) => setStartingContentType(e.target.value)}
          disabled={creating}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:opacity-50"
        >
          {CONTENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-5 block text-sm font-medium text-foreground">
        Notes <span className="font-normal text-muted">(optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={creating}
          rows={3}
          placeholder="Angle, audience, anything the brief should carry."
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:opacity-50"
        />
      </label>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={creating || !canStart}
          className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {creating ? "Starting…" : "Start create"}
        </button>
        <Link href="/app/creates" className="text-sm font-medium text-muted">
          Cancel
        </Link>
      </div>
    </div>
  );
}
