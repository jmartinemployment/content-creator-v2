/**
 * This browser's copy of a brief: a crash buffer, never the only copy.
 *
 * The database is where a brief lives (plans/fix-persistence.md, P4). This keeps what the operator
 * typed between autosaves, so a reload or a dropped connection loses nothing -- and on open it is
 * compared with the server copy by time, and the operator chooses when they differ. Neither copy
 * ever silently replaces the other.
 *
 * One key family, `gcc-content-brief:`, one key per project and create. Older drafts were stored
 * under `kw:<keyword>` and a bare keyword or `draft`, as the brief alone with no time; they are read
 * by the recovery list and never written or deleted here.
 */

import {
  CONTENT_BRIEF_STORAGE_PREFIX,
  migrateBrief,
  type ContentBrief,
} from "@/lib/content-creator/brief-catalog";

export type BriefDraft = {
  brief: ContentBrief;
  /** The keyword typed with it -- the create's topic. Empty on drafts stored before it was kept. */
  topic: string;
  /** When the operator last changed it, ISO. Null on drafts stored before the time was kept. */
  changedAtUtc: string | null;
};

/** The draft key for a project's create, or its "new" slot before a create exists. No project, no key. */
export function briefDraftKey(
  projectId: string | undefined,
  createId: string | null | undefined,
): string | null {
  return projectId ? `${projectId}:${createId ?? "new"}` : null;
}

function parseDraft(raw: string): BriefDraft | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    // Current shape: { brief, topic, changedAtUtc }. Older shape: the brief object itself.
    if (obj.brief && typeof obj.brief === "object") {
      return {
        brief: migrateBrief(obj.brief),
        topic: typeof obj.topic === "string" ? obj.topic : "",
        changedAtUtc: typeof obj.changedAtUtc === "string" ? obj.changedAtUtc : null,
      };
    }
    return { brief: migrateBrief(obj), topic: "", changedAtUtc: null };
  } catch {
    return null;
  }
}

export function loadBriefDraft(key: string | null): BriefDraft | null {
  if (typeof window === "undefined" || !key) return null;
  try {
    const raw = localStorage.getItem(CONTENT_BRIEF_STORAGE_PREFIX + key);
    return raw ? parseDraft(raw) : null;
  } catch {
    return null;
  }
}

export function saveBriefDraft(key: string | null, brief: ContentBrief, topic: string): void {
  if (typeof window === "undefined" || !key) return;
  try {
    const draft: BriefDraft = { brief, topic, changedAtUtc: new Date().toISOString() };
    localStorage.setItem(CONTENT_BRIEF_STORAGE_PREFIX + key, JSON.stringify(draft));
  } catch {
    /* quota or disabled storage: the server copy is the record either way */
  }
}

/** Removes the "new" slot once its brief has minted a create and been saved there. Nothing else. */
export function clearNewBriefDraft(projectId: string | undefined): void {
  const key = briefDraftKey(projectId, null);
  if (typeof window === "undefined" || !key) return;
  try {
    localStorage.removeItem(CONTENT_BRIEF_STORAGE_PREFIX + key);
  } catch {
    /* disabled storage */
  }
}

/**
 * What a brief says, as one comparable string: the brief as migrated, plus its topic.
 *
 * `lengthBand` is left out because it is derived from the content type at save time, not typed, so
 * two copies that differ only there say the same thing.
 */
export function briefFingerprint(brief: ContentBrief, topic: string): string {
  const migrated = migrateBrief(brief);
  return JSON.stringify({ ...migrated, lengthBand: "", __topic: topic.trim() });
}

/** Parses a server `brief_json`, or null when there is none or it will not parse. */
export function parseServerBrief(briefJson: string | null | undefined): ContentBrief | null {
  if (!briefJson) return null;
  try {
    return migrateBrief(JSON.parse(briefJson));
  } catch {
    return null;
  }
}

/** True when this browser holds a draft for the create that says something the server copy does not. */
export function localDraftDiffers(
  projectId: string | undefined,
  createId: string,
  serverBriefJson: string | null | undefined,
  serverTopic: string,
): boolean {
  const local = loadBriefDraft(briefDraftKey(projectId, createId));
  if (!local) return false;
  const server = parseServerBrief(serverBriefJson);
  if (!server) return true;
  return (
    briefFingerprint(local.brief, local.topic || serverTopic) !==
    briefFingerprint(server, serverTopic)
  );
}

export type StoredBriefDraft = BriefDraft & {
  /** The key after the prefix, e.g. `kw:accounts payable` or `<projectId>:<createId>`. */
  key: string;
  /** What the operator would recognise it by: the keyword, from the old key or the stored topic. */
  label: string;
  bytes: number;
};

/** Every brief draft this browser holds, newest first where a time is known. Reads only. */
export function listBriefDrafts(): StoredBriefDraft[] {
  if (typeof window === "undefined") return [];
  const out: StoredBriefDraft[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (!fullKey || !fullKey.startsWith(CONTENT_BRIEF_STORAGE_PREFIX)) continue;
      const raw = localStorage.getItem(fullKey);
      if (!raw) continue;
      const draft = parseDraft(raw);
      if (!draft) continue;
      const key = fullKey.slice(CONTENT_BRIEF_STORAGE_PREFIX.length);
      const label = key.startsWith("kw:")
        ? key.slice(3) || "(no keyword)"
        : draft.topic || (key.endsWith(":new") ? "(a brief before its create)" : key);
      out.push({ ...draft, key, label, bytes: raw.length });
    }
  } catch {
    return out;
  }
  return out.sort((a, b) => (b.changedAtUtc ?? "").localeCompare(a.changedAtUtc ?? ""));
}
