import type { ContentType } from "./content-types";

/** Query/prefill contract for `/creates/new` from task-agent → Create handoffs (M3 W2a). */
export type CreatePrefill = {
  topic?: string;
  contentType?: ContentType;
  /** Multiline `Name | https://…` partner tools. */
  tools?: string;
  /** Multiline competitor URLs. */
  competitors?: string;
  /** Optional writing notes / claims seed. */
  notes?: string;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toolLine(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const name = asString(row.name) ?? asString(row.label) ?? asString(row.title);
  const url = asString(row.url) ?? asString(row.primaryUrl) ?? asString(row.href);
  if (name && url) return `${name} | ${url}`;
  if (url) return url;
  if (name) return name;
  return null;
}

function collectToolLines(payload: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const key of ["operatorTools", "tools", "partners", "recommendedTools"]) {
    const raw = payload[key];
    if (!Array.isArray(raw)) continue;
    for (const entry of raw) {
      const line = toolLine(entry);
      if (line) lines.push(line);
    }
  }
  return [...new Set(lines)];
}

function collectCompetitorLines(payload: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const key of ["competitorUrls", "competitors", "rivalUrls"]) {
    const raw = payload[key];
    if (!Array.isArray(raw)) continue;
    for (const entry of raw) {
      if (typeof entry === "string" && entry.trim()) {
        lines.push(entry.trim());
        continue;
      }
      const line = toolLine(entry);
      if (line) {
        const url = line.includes("|") ? line.split("|").at(-1)?.trim() : line;
        if (url) lines.push(url);
      }
    }
  }
  return [...new Set(lines)];
}

function collectNotes(payload: Record<string, unknown>): string | undefined {
  const chunks: string[] = [];
  for (const key of ["writingNotes", "notes", "summary", "angle"]) {
    const value = asString(payload[key]);
    if (value) chunks.push(value);
  }
  const claims = payload.claims ?? payload.approvedClaims;
  if (Array.isArray(claims)) {
    const claimLines = claims
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (entry && typeof entry === "object") {
          const row = entry as Record<string, unknown>;
          return asString(row.claim) ?? asString(row.text) ?? asString(row.statement);
        }
        return null;
      })
      .filter((line): line is string => Boolean(line));
    if (claimLines.length) {
      chunks.push(`Claims to ground:\n${claimLines.slice(0, 12).map((line) => `- ${line}`).join("\n")}`);
    }
  }
  const joined = chunks.join("\n\n").trim();
  return joined ? joined.slice(0, 4000) : undefined;
}

export function createPrefillFromArtifactPayload(
  payload: Record<string, unknown> | null | undefined,
): CreatePrefill {
  if (!payload) return {};
  const topic =
    asString(payload.topic)
    ?? asString(payload.title)
    ?? asString(payload.primaryKeyword)
    ?? asString(payload.keyword)
    ?? asString(payload.query)
    ?? undefined;
  const tools = collectToolLines(payload);
  const competitors = collectCompetitorLines(payload);
  return {
    topic,
    tools: tools.length ? tools.join("\n") : undefined,
    competitors: competitors.length ? competitors.join("\n") : undefined,
    notes: collectNotes(payload),
  };
}

export function createPrefillSearchParams(prefill: CreatePrefill): URLSearchParams {
  const params = new URLSearchParams();
  if (prefill.contentType) params.set("contentType", prefill.contentType);
  if (prefill.topic) params.set("topic", prefill.topic);
  if (prefill.tools) params.set("tools", prefill.tools);
  if (prefill.competitors) params.set("competitors", prefill.competitors);
  if (prefill.notes) params.set("notes", prefill.notes);
  return params;
}
