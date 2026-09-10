import type { CanvasProject } from "@/app/projects/project-types";

export const projectFixtures: readonly CanvasProject[] = [
  {
    id: "launch-campaign",
    name: "Evidence Engine launch",
    description: "A coordinated launch package built from one approved strategy brief.",
    status: "review",
    updatedAt: "2026-09-08T18:42:00.000Z",
    owner: "Jeff Martin",
    collaborators: ["Maya Chen", "Content Producer"],
    persistence: "session-draft",
    assets: [
      {
        id: "launch-brief",
        title: "Launch strategy brief",
        kind: "brief",
        parentAssetIds: [],
        versions: [
          {
            id: "launch-brief-v1",
            version: 1,
            createdAt: "2026-09-03T14:00:00.000Z",
            createdBy: "Jeff Martin",
            status: "draft",
            summary: "Initial positioning, audience, and launch outcomes.",
            evidence: [
              { id: "ev-interviews", label: "Customer interview synthesis", source: "Geek IQ" },
            ],
            provenance: { origin: "human", note: "Authored from stakeholder workshop notes." },
          },
          {
            id: "launch-brief-v2",
            version: 2,
            createdAt: "2026-09-05T16:20:00.000Z",
            createdBy: "Maya Chen",
            status: "approved",
            summary: "Approved positioning with proof points and channel handoffs.",
            evidence: [
              { id: "ev-interviews", label: "Customer interview synthesis", source: "Geek IQ" },
              { id: "ev-benchmark", label: "Campaign benchmark report", source: "Research corpus" },
            ],
            provenance: { origin: "mixed", agent: "Marketing Strategist", model: "o3", note: "Human-edited strategy suggestions." },
          },
        ],
      },
      {
        id: "pillar-article",
        title: "Reliable content operations",
        kind: "article",
        parentAssetIds: ["launch-brief"],
        versions: [
          {
            id: "pillar-article-v1",
            version: 1,
            createdAt: "2026-09-06T13:15:00.000Z",
            createdBy: "Content Producer",
            status: "in-review",
            summary: "Long-form launch narrative with evidence-backed operational guidance.",
            evidence: [
              { id: "ev-benchmark", label: "Campaign benchmark report", source: "Research corpus" },
              { id: "ev-docs", label: "Evidence Engine product notes", source: "Direct upload" },
            ],
            provenance: { origin: "agent", agent: "Content Producer 3.0.0", model: "o1-pro", note: "Generated from launch brief v2; citations verified." },
          },
        ],
      },
      {
        id: "social-carousel",
        title: "Launch carousel",
        kind: "social",
        parentAssetIds: ["pillar-article"],
        versions: [
          {
            id: "social-carousel-v1",
            version: 1,
            createdAt: "2026-09-07T10:05:00.000Z",
            createdBy: "Maya Chen",
            status: "draft",
            summary: "Six-slide narrative adapted from the pillar article.",
            evidence: [
              { id: "ev-docs", label: "Evidence Engine product notes", source: "Direct upload" },
            ],
            provenance: { origin: "mixed", agent: "Content Producer 3.0.0", model: "o3", note: "Adapted from article v1 and edited by Maya." },
          },
        ],
      },
      {
        id: "launch-email",
        title: "Customer launch email",
        kind: "email",
        parentAssetIds: ["launch-brief", "pillar-article"],
        versions: [
          {
            id: "launch-email-v1",
            version: 1,
            createdAt: "2026-09-08T18:42:00.000Z",
            createdBy: "Content Producer",
            status: "in-review",
            summary: "Concise customer announcement with article handoff.",
            evidence: [
              { id: "ev-interviews", label: "Customer interview synthesis", source: "Geek IQ" },
            ],
            provenance: { origin: "agent", agent: "Content Producer 3.0.0", model: "o3", note: "Generated from approved brief and article draft." },
          },
        ],
      },
    ],
    activity: [
      { id: "activity-4", kind: "handoff", actor: "Content Producer", occurredAt: "2026-09-08T18:42:00.000Z", message: "Handed article proof points to Customer launch email" },
      { id: "activity-3", kind: "review", actor: "Maya Chen", occurredAt: "2026-09-07T15:30:00.000Z", message: "Requested review for Reliable content operations" },
      { id: "activity-2", kind: "handoff", actor: "Maya Chen", occurredAt: "2026-09-07T10:05:00.000Z", message: "Adapted article into Launch carousel" },
      { id: "activity-1", kind: "created", actor: "Jeff Martin", occurredAt: "2026-09-03T14:00:00.000Z", message: "Created the project and strategy brief" },
    ],
  },
  {
    id: "customer-education",
    name: "Customer education series",
    description: "A reusable set of onboarding assets for evidence-first content teams.",
    status: "planning",
    updatedAt: "2026-09-02T09:25:00.000Z",
    owner: "Jeff Martin",
    collaborators: ["Technical Authority"],
    persistence: "session-draft",
    assets: [
      {
        id: "education-outline",
        title: "Education series outline",
        kind: "brief",
        parentAssetIds: [],
        versions: [
          {
            id: "education-outline-v1",
            version: 1,
            createdAt: "2026-09-02T09:25:00.000Z",
            createdBy: "Jeff Martin",
            status: "draft",
            summary: "A four-part curriculum and intended learning outcomes.",
            evidence: [],
            provenance: { origin: "human", note: "Early planning draft; evidence selection is pending." },
          },
        ],
      },
    ],
    activity: [
      { id: "education-activity-1", kind: "created", actor: "Jeff Martin", occurredAt: "2026-09-02T09:25:00.000Z", message: "Created the project outline" },
    ],
  },
];

export function cloneProjectFixtures(): CanvasProject[] {
  return structuredClone(projectFixtures) as CanvasProject[];
}
