import type { RagAdTemplate } from "./types";
import { type LoadResult, readLoadResult } from "@/app/lib/load-result";

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

/** Shared across sessions via GeekRepository. */
export async function loadAdTemplates(): Promise<LoadResult<RagAdTemplate[]>> {
  const res = await templatesFetch("");
  return readLoadResult(res, (body) => {
    const dtos = body as AdTemplateDto[];
    return Array.isArray(dtos) ? dtos.map(toRagAdTemplate) : [];
  });
}

export async function createAdTemplate(input: {
  name: string;
  channel?: string;
  framework?: string;
  body: string;
}): Promise<LoadResult<RagAdTemplate>> {
  const res = await templatesFetch("", { method: "POST", body: JSON.stringify(input) });
  return readLoadResult(res, (body) => toRagAdTemplate(body as AdTemplateDto));
}
