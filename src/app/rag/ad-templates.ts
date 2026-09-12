import type { RagAdTemplate } from "./types";

async function templatesFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`/api/gcc-v2/ad-templates${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
  });
}

type AdTemplateDto = {
  id: string;
  name: string;
  channel?: string | null;
  framework?: string | null;
  body: string;
};

function toRagAdTemplate(dto: AdTemplateDto): RagAdTemplate {
  return {
    id: dto.id,
    name: dto.name,
    channel: dto.channel ?? undefined,
    framework: dto.framework ?? undefined,
    body: dto.body,
  };
}

/** Shared across sessions via GeekRepository — see plans/make-content-creator-workable.md
 * Milestone 1. Replaces the previous localStorage-only corpus. */
export async function loadAdTemplates(): Promise<RagAdTemplate[]> {
  const res = await templatesFetch("");
  if (!res.ok) return [];
  const dtos = (await res.json()) as AdTemplateDto[];
  return dtos.map(toRagAdTemplate);
}

export async function createAdTemplate(input: {
  name: string;
  channel?: string;
  framework?: string;
  body: string;
}): Promise<RagAdTemplate | null> {
  const res = await templatesFetch("", { method: "POST", body: JSON.stringify(input) });
  if (!res.ok) return null;
  return toRagAdTemplate((await res.json()) as AdTemplateDto);
}
