import { notFound } from "next/navigation";

/**
 * Product `/rag` is removed. Create (`/creates/new`) is the only authoring path.
 * BFF `/api/rag/*` remains for Create research helpers.
 */
export default function LegacyRagGone() {
  notFound();
}
