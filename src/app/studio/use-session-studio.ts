"use client";

import { useEffect, useState } from "react";
import type { StudioAgentDraft } from "@/app/studio/studio-types";
import { createEmptyStudioDraft } from "@/app/studio/studio-model";

const STORAGE_KEY = "cc-v2-studio-drafts.v1";

function readDrafts(): StudioAgentDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudioAgentDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDrafts(drafts: StudioAgentDraft[]) {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function useSessionStudioDrafts() {
  const [drafts, setDrafts] = useState<StudioAgentDraft[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDrafts(readDrafts());
    setReady(true);
  }, []);

  function save(next: StudioAgentDraft[]) {
    setDrafts(next);
    writeDrafts(next);
  }

  function createDraft() {
    const draft = createEmptyStudioDraft();
    save([draft, ...drafts]);
    return draft;
  }

  function updateDraft(draft: StudioAgentDraft) {
    save(drafts.map((item) => (item.id === draft.id ? draft : item)));
  }

  function getDraft(id: string) {
    return drafts.find((draft) => draft.id === id) ?? null;
  }

  return { drafts, ready, createDraft, updateDraft, getDraft };
}
