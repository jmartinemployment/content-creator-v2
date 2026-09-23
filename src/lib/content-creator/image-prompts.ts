/**
 * The image prompts inside a generated artifact, pulled out for their own view.
 *
 * v1 showed these on their own tab, grouped by where they came from, because a prompt is something
 * the operator carries to an image generator — not something a reader reads. That is also why they
 * are deliberately absent from the prose (`renderArtifactBody`) and shipped as separate files in the
 * export. Between those two facts they had nowhere to be looked at, so they were generated, paid
 * for, stored, and invisible (Jeff, 2026-09-23: "No Tab for Blog - Image Prompts?").
 *
 * They live on the document itself — `lede.imagePrompt` and each section's — rather than as
 * artifacts of their own, so this reads them back out of the stored body.
 */
export interface ArtifactImagePrompt {
  /** "Hero" for the opening, otherwise the H2 the prompt belongs to. */
  heading: string;
  prompt: string;
}

type WireSection = {
  heading?: string;
  imagePrompt?: string | null;
  children?: WireSection[] | null;
};

type WireDoc = { lede?: WireSection | null; sections?: WireSection[] | null };

/**
 * Every prompt in a stored artifact body, in page order: the hero first, then one per H2.
 * Empty when the body carries none — which is a body generated before prompts were attached, not
 * an error.
 */
export function imagePromptsFor(bodyDocumentJson: string): ArtifactImagePrompt[] {
  let doc: WireDoc | null = null;
  try {
    const parsed = JSON.parse(bodyDocumentJson) as Record<string, unknown>;
    // Tool and blog bodies are an envelope with the document under `body`; a pillar may be bare.
    const candidate = (parsed?.body ?? parsed) as WireDoc | undefined;
    if (candidate && typeof candidate === "object") doc = candidate;
  } catch {
    return [];
  }
  if (!doc) return [];

  const out: ArtifactImagePrompt[] = [];
  const push = (heading: string, prompt?: string | null) => {
    const text = prompt?.trim();
    if (text) out.push({ heading, prompt: text });
  };

  // The lede has no heading of its own — it is the lead paragraph under the title — so its prompt
  // is labelled by what it is rather than by a heading that does not exist.
  push("Hero", doc.lede?.imagePrompt);

  const walk = (sections: WireSection[] | null | undefined) => {
    for (const section of sections ?? []) {
      push(section.heading?.trim() || "Untitled section", section.imagePrompt);
      walk(section.children);
    }
  };
  walk(doc.sections);

  return out;
}
