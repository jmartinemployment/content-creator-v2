import type { RagWritingIntent } from "./types";

export type RagIntentFamily = "long" | "short" | "battlecard" | "slides";

export const RAG_WRITING_INTENTS: {
  value: RagWritingIntent;
  family: RagIntentFamily;
  label: string;
  help: string;
}[] = [
  {
    value: "Technical Article",
    family: "long",
    label: "Technical article",
    help: "Long-form — prefers parent sections; GeekAPI routes to o1/o3 when enabled.",
  },
  {
    value: "Case Study",
    family: "long",
    label: "Case study",
    help: "Long-form narrative grounded on partner proof points (o1/o3 writer).",
  },
  {
    value: "Social Ad",
    family: "short",
    label: "Social / ad",
    help: "Short-form — prefers child chunks; optional few-shot ad templates.",
  },
  {
    value: "Short Form",
    family: "short",
    label: "Short blurb",
    help: "Short blurbs derived from the same crawl corpus + optional templates.",
  },
  {
    value: "Competitive Battlecard",
    family: "battlecard",
    label: "Battlecard",
    help: "Dual partner vs competitors retrieval for competitive compare.",
  },
  {
    value: "Pitch Slides",
    family: "slides",
    label: "Pitch slides",
    help: "Slide outline — GraphRAG when enabled; else parent hybrid + theme sources.",
  },
  {
    value: "Strategy Theme",
    family: "slides",
    label: "Strategy theme",
    help: "Strategic framing outline with theme-level entity relationships.",
  },
];

/** Phase 0 / D sample topics for UX copy. */
export const RAG_SAMPLE_TOPICS = {
  technical: "How to sync CRM contacts into marketing automation without duplicate records",
  shortForm: "One-line pitch: faster partner onboarding for mid-market SaaS",
  battlecard: "Battlecard: our partner suite vs category alternatives for SMB CRM",
  slides: "Pitch deck outline: partner CRM value for mid-market RevOps buyers",
} as const;

export const RAG_INTENT_VALUES = new Set(
  RAG_WRITING_INTENTS.map((i) => i.value),
);
