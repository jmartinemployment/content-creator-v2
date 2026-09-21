"use client";

import { useState } from "react";
import { createClient, deleteClient, ApiError } from "@/services/content-writer-api";
import type { Client } from "@/lib/types";

export default function ClientsPanel({
  clients,
  selectedClientId,
  onSelect,
  onCreated,
  onDeleted,
}: {
  clients: Client[];
  selectedClientId: string | null;
  onSelect: (clientId: string) => void;
  onCreated: (client: Client) => void;
  onDeleted: (clientId: string) => void;
}) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function handleDelete(client: Client) {
    setError(null);
    setDeletingId(client.id);
    try {
      await deleteClient(client.id);
      onDeleted(client.id);
      setConfirmingId(null);
    } catch (err) {
      // The server no longer 409s on projects — it cascades. A failure here is a real failure,
      // so show what the server said rather than a generic message.
      setError(err instanceof ApiError ? err.message : `Could not delete “${client.name}”.`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const client = await createClient({ name });
      onCreated(client);
      setName("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create client.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Clients</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-sm font-medium text-brand hover:underline"
        >
          {showForm ? "Cancel" : "+ New client"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Client Name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
              className="rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
          >
            {isSubmitting ? "Creating..." : "Create"}
          </button>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {clients.length === 0 && <p className="text-sm text-muted">No clients yet — create one to get started.</p>}
        {clients.map((client) => {
          const selected = selectedClientId === client.id;
          return (
            <span
              key={client.id}
              className={`inline-flex items-center gap-1 rounded-full pl-3 pr-1.5 py-1.5 text-sm font-medium transition-colors ${
                selected ? "bg-brand text-white" : "bg-background text-foreground hover:bg-border/50"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setConfirmingId(null);
                  onSelect(client.id);
                }}
                className="font-medium"
              >
                {client.name}
                {!client.publishTarget && (
                  <span className="ml-1.5 text-xs opacity-70" title="No PublishTarget configured — publish will fail">
                    ⚠
                  </span>
                )}
              </button>
              {/* This used to have no confirmation, because the server refused while the client
                  had projects — the destructive case was unreachable by a stray click. The server
                  now cascades: projects, their linked creates, and those creates' artifacts and
                  versions all go. So the guard has to be here instead. */}
              {confirmingId === client.id ? (
                <button
                  type="button"
                  onClick={() => void handleDelete(client)}
                  disabled={deletingId === client.id}
                  className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingId === client.id ? "Deleting…" : "Delete all?"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(client.id)}
                  aria-label={`Delete ${client.name}`}
                  title={`Delete ${client.name} and all its projects`}
                  className={`rounded-full px-1.5 text-xs leading-none opacity-60 hover:opacity-100 ${
                    selected ? "hover:bg-white/20" : "hover:bg-border"
                  }`}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
