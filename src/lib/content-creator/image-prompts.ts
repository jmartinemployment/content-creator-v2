/**
 * The image prompts inside a generated artifact, pulled out for their own view.
 *
 * v1 showed these on their own tab, grouped by where they came from, because a prompt is something
 * the operator carries to an image generator — not something a reader reads. That is also why they
 * are deliberately absent from the prose (`renderArtifactBody`) and shipped as separate files in the
 * export. Between those two facts they had nowhere to be looked at, so they were generated, paid
 * for, stored, and invisible (Jeff, 2026-09-23: "No Tab for Blog - Image Prompts?").
 *
 * That was first answered with a collapsed "Show image prompts" toggle inside the artifact's own
 * body, which is not a tab and not where v1 put them, so the same question came back on 2026-09-27.
 * The toggle is gone; `ImagePromptsPanel` in `ProjectContentWorkspace` is the tab, reading across every
 * artifact in the create rather than only the one on screen.
 *
 * They live on the document itself — `lede.imagePrompt` and each section's — rather than as
 * artifacts of their own, so this reads them back out of the stored body.
 *
 * A short piece (an email, a social post, an ad) is not a document: it carries one prompt, as an
 * object beside its own fields. Until 2026-10-12 this read documents only, so that prompt was
 * written, paid for, stored and listed here as "carries no image prompts".
 */
export interface ArtifactImagePrompt {
  /** "Hero" for the opening, otherwise the H2 the prompt belongs to. "Image" for a short piece's one. */
  heading: string;
  prompt: string;
}

/** The one prompt a short piece carries: `{ ..., "imagePrompt": { "prompt": string, ... } }`. */
function shortPiecePrompt(parsed: Record<string, unknown>): string | null {
  const held = parsed.imagePrompt;
  if (!held || typeof held !== "object") return null;
  const prompt = (held as Record<string, unknown>).prompt;
  return typeof prompt === "string" && prompt.trim() ? prompt.trim() : null;
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
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const own = shortPiecePrompt(parsed);
      if (own) return [{ heading: "Image", prompt: own }];
    }
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
