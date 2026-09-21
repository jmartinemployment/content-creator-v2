"use client";

import { useState } from "react";
import {
  createClient,
  deleteClient,
  ApiError,
  type ClientDetailsInput,
  type GccClient,
} from "@/services/gcc-projects-api";

/** What a new client starts as. Currency has no default here for the same reason it has none in the
 *  database: a currency everyone silently shares is how the wrong one reaches an invoice. */
const EMPTY: ClientDetailsInput = {
  name: "",
  contactName: "",
  contactEmail: "",
  billingEmail: "",
  paymentTermsDays: 30,
  currency: "",
  rate: null,
};

export default function ClientsPanel({
  clients,
  selectedClientId,
  onSelect,
  onCreated,
  onDeleted,
}: {
  clients: GccClient[];
  selectedClientId: string | null;
  onSelect: (clientId: string) => void;
  onCreated: (client: GccClient) => void;
  onDeleted: (clientId: string) => void;
}) {
  const [form, setForm] = useState<ClientDetailsInput>(EMPTY);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function set<K extends keyof ClientDetailsInput>(key: K, value: ClientDetailsInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleDelete(client: GccClient) {
    setError(null);
    setDeletingId(client.id);
    try {
      await deleteClient(client.id);
      onDeleted(client.id);
      setConfirmingId(null);
    } catch (err) {
      // A client with projects is refused by the database, and that refusal is the right answer —
      // the alternative is deleting their projects to make this button work. Say which it was.
      setError(
        err instanceof ApiError && err.status >= 500
          ? `Could not delete “${client.name}” — it still has projects. Delete or reassign those first.`
          : err instanceof ApiError
            ? err.message
            : `Could not delete “${client.name}”.`,
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const client = await createClient(form);
      onCreated(client);
      setForm(EMPTY);
      setShowForm(false);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 403
          ? "Your sign-in predates client access. Sign out and back in, then try again."
          : err instanceof ApiError
            ? err.message
            : "Could not create client.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "rounded-md border border-border bg-white px-3 py-2 text-sm font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  const canSubmit =
    form.name.trim().length > 0 &&
    form.contactName.trim().length > 0 &&
    form.contactEmail.trim().length > 0 &&
    form.billingEmail.trim().length > 0 &&
    /^[A-Za-z]{3}$/.test(form.currency.trim()) &&
    form.paymentTermsDays >= 0;

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
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
            Client Name
            <input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Acme Corp"
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Contact Name
            <input
              required
              value={form.contactName}
              onChange={(e) => set("contactName", e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Contact Email
            <input
              required
              type="email"
              value={form.contactEmail}
              onChange={(e) => {
                const next = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  contactEmail: next,
                  // Prefilled as an editable copy, never a read-time fallback: the billing address
                  // is stored in its own right, so it can diverge later without surprising anyone.
                  billingEmail: prev.billingEmail.trim() === "" ? next : prev.billingEmail,
                }));
              }}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Billing Email
            <span className="text-xs font-normal text-muted">Stored separately, even if identical.</span>
            <input
              required
              type="email"
              value={form.billingEmail}
              onChange={(e) => set("billingEmail", e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Contact Phone
            <span className="text-xs font-normal text-muted">Optional.</span>
            <input
              value={form.contactPhone ?? ""}
              onChange={(e) => set("contactPhone", e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Payment Terms
            <span className="text-xs font-normal text-muted">Days; 0 is due on receipt.</span>
            <input
              required
              type="number"
              min={0}
              value={form.paymentTermsDays}
              onChange={(e) => set("paymentTermsDays", Number(e.target.value))}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Currency
            <span className="text-xs font-normal text-muted">Three-letter ISO code, e.g. USD.</span>
            <input
              required
              value={form.currency}
              onChange={(e) => set("currency", e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="USD"
              className={`${inputClass} uppercase`}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground sm:col-span-2">
            Hourly Rate
            <span className="text-xs font-normal text-muted">
              Optional — but a client with no rate cannot have billable time logged against it.
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.rate ?? ""}
              onChange={(e) => set("rate", e.target.value === "" ? null : Number(e.target.value))}
              className={inputClass}
            />
          </label>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
            >
              {isSubmitting ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {clients.length === 0 && (
          <p className="text-sm text-muted">No clients yet — create one to get started.</p>
        )}
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
                  <span
                    className="ml-1.5 text-xs opacity-70"
                    title="No publish target configured — publish will fail"
                  >
                    ⚠
                  </span>
                )}
              </button>
              {/* A client with projects cannot be deleted at all — the database refuses it. This
                  confirm is for the case where one can: a client created by mistake, with nothing
                  under it yet. The label names its scope, because "Delete all?" on a per-client
                  chip reads as "delete all clients", the opposite end of the blast radius. */}
              {confirmingId === client.id ? (
                <button
                  type="button"
                  onClick={() => void handleDelete(client)}
                  disabled={deletingId === client.id}
                  className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingId === client.id ? "Deleting…" : "Delete this client?"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(client.id)}
                  aria-label={`Delete ${client.name}`}
                  title={`Delete ${client.name}`}
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
