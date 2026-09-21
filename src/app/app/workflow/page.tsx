"use client";

import { useEffect, useState } from "react";
import ClientsPanel from "@/components/content-writer/ClientsPanel";
import CreateForm from "@/components/content-creator/CreateForm";
import CreateDraftWorkspace from "@/components/content-creator/CreateDraftWorkspace";
import { getClients } from "@/services/content-writer-api";
import { listGccCreates, type GccCreate } from "@/services/gcc-api";
import type { Client } from "@/lib/types";

/**
 * Client → create → brief → generate → revise → approve, on one page.
 *
 * There is no project. A project sat between the client and the thing being written and carried
 * nothing of its own: its URL resolved to a Run ID, its keyword became the create's topic, its
 * department was a passthrough. GccCreate holds all three, so the create is the unit of work.
 */
function mostRecent(creates: GccCreate[], clientId: string | null): string | null {
  if (!clientId) return null;
  const mine = creates.filter((c) => c.clientId === clientId);
  if (mine.length === 0) return null;
  return mine.reduce((newest, c) =>
    new Date(c.createdAtUtc) > new Date(newest.createdAtUtc) ? c : newest,
  ).id;
}

export default function WorkflowPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [creates, setCreates] = useState<GccCreate[]>([]);
  const [createId, setCreateId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createsError, setCreatesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getClients()
      .then(async (clientList) => {
        if (cancelled) return;
        setClients(clientList);
        const firstClient = clientList[0] ?? null;
        setSelectedClientId(firstClient?.id ?? null);
        if (!firstClient) return;

        // Listing is what lets the page reopen yesterday's work. It failing is not fatal — the
        // form below still starts a new one — so it reports itself and leaves the rest usable.
        try {
          const list = await listGccCreates(firstClient.id);
          if (cancelled) return;
          setCreates(list);
          setCreateId(mostRecent(list, firstClient.id));
        } catch (err) {
          if (cancelled) return;
          setCreatesError(
            err instanceof Error ? err.message : "Could not list existing work.",
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Could not reach the Content Writer API.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function selectClient(clientId: string | null) {
    setSelectedClientId(clientId);
    setCreateId(null);
    setCreatesError(null);
    if (!clientId) return;
    try {
      const list = await listGccCreates(clientId);
      setCreates(list);
      setCreateId(mostRecent(list, clientId));
    } catch (err) {
      setCreatesError(
        err instanceof Error ? err.message : "Could not list existing work.",
      );
    }
  }

  function handleClientCreated(client: Client) {
    setClients((prev) => [...prev, client]);
    setSelectedClientId(client.id);
    setCreateId(null);
    setCreatesError(null);
  }

  function handleCreated(create: GccCreate) {
    setCreates((prev) => [create, ...prev]);
    setCreateId(create.id);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          Content Writer v2
        </p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">Workflow</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Grounded in the crawl Geek-Crawler already performed for this site. Add research, generate
          a pillar article + companion content, run editorial review, and publish.
        </p>
      </div>

      {loadError ? <p className="mb-6 text-sm text-red-600">{loadError}</p> : null}

      <div className="flex flex-col gap-6">
        <ClientsPanel
          clients={clients}
          selectedClientId={selectedClientId}
          onSelect={(clientId) => void selectClient(clientId)}
          onCreated={handleClientCreated}
          onDeleted={(clientId) => {
            const remaining = clients.filter((c) => c.id !== clientId);
            setClients(remaining);
            setCreates((prev) => prev.filter((c) => c.clientId !== clientId));
            // Deleting the selected client has to hand the selection on. Everything below is
            // gated on a client, so leaving it null empties the page from here down.
            if (selectedClientId === clientId) {
              void selectClient(remaining[0]?.id ?? null);
            }
          }}
        />

        {selectedClientId ? (
          <CreateForm clientId={selectedClientId} onCreated={handleCreated} />
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-background p-6 text-sm text-muted">
            Select a client above to start. Everything below is scoped to it.
          </p>
        )}

        {createsError ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {createsError} Starting new work above still functions.
          </p>
        ) : null}

        {/* Never render nothing. Empty and broken have to look different. */}
        {selectedClientId && !createId && !createsError ? (
          <p className="rounded-xl border border-dashed border-border bg-background p-6 text-sm text-muted">
            Nothing written for this client yet. Use the form above — the brief, generate and
            review steps open here once it exists.
          </p>
        ) : null}

        {createId ? <CreateDraftWorkspace createId={createId} /> : null}
      </div>
    </div>
  );
}
