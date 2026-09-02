import type { OutlineSectionView } from "@/app/creates/canvas-types";

export function isFaqSection(section: OutlineSectionView): boolean {
  return section.job === "faq" || section.key === "people-also-ask";
}

/** Index where a new advance row should be inserted — immediately before FAQ, or at end. */
export function findFaqInsertIndex(sections: OutlineSectionView[]): number {
  for (let i = sections.length - 1; i >= 0; i -= 1) {
    if (isFaqSection(sections[i]!)) return i;
  }
  return sections.length;
}

export function makeAdvanceSection(existingKeys: Iterable<string>, insertIndex: number): OutlineSectionView {
  const keys = new Set(existingKeys);
  let n = insertIndex + 1;
  let key = `section-${n}`;
  while (keys.has(key)) {
    n += 1;
    key = `section-${n}`;
  }
  return {
    key,
    heading: "",
    job: "advance",
    hierarchyChildHeadings: [],
  };
}

export function canRemoveSection(section: OutlineSectionView, index: number): boolean {
  if (index === 0) return false;
  if (isFaqSection(section)) return false;
  return section.job === "advance";
}

export function insertAdvanceSection(sections: OutlineSectionView[]): OutlineSectionView[] {
  const insertIndex = findFaqInsertIndex(sections);
  const newSection = makeAdvanceSection(
    sections.map((s) => s.key),
    insertIndex,
  );
  const next = [...sections];
  next.splice(insertIndex, 0, newSection);
  return next;
}

export function removeSectionAt(sections: OutlineSectionView[], index: number): OutlineSectionView[] {
  const section = sections[index];
  if (!section || !canRemoveSection(section, index)) return sections;
  return sections.filter((_, i) => i !== index);
}

export function isProblemLocked(index: number): boolean {
  return index === 0;
}

export function isRoleLocked(section: OutlineSectionView, index: number): boolean {
  return isProblemLocked(index) || isFaqSection(section);
}

export function supportsAdvanceOutlineRows(contentType: string): boolean {
  const t = contentType.trim().toLowerCase();
  return (
    t === "pillar" ||
    t === "blog" ||
    t === "tool" ||
    t === "comparison" ||
    t === "case-study" ||
    t === "guide" ||
    t === "alternatives" ||
    t === "tech-article" ||
    t === "listicle" ||
    t === "service" ||
    t === "local" ||
    t === "whitepaper" ||
    t === "linkedin-carousel"
  );
}
