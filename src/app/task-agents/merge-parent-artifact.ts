/**
 * Map a parent task-agent artifact (+ optional parent run taskInputs)
 * into schema form values for a follow-on capability.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function queryTexts(payload: Record<string, unknown>): string[] {
  const queries = payload.queries;
  if (!Array.isArray(queries)) return [];
  const out: string[] = [];
  for (const item of queries) {
    const row = asRecord(item);
    const text = asString(row?.query) || asString(row?.text);
    if (text) out.push(text);
  }
  return out;
}

function visibleFromTaskInputs(taskInputs: unknown): string {
  const input = asRecord(taskInputs);
  if (!input) return "";
  const document = asRecord(input.document);
  if (document) {
    const visible = asString(document.visibleContent);
    if (visible) return visible;
  }
  const sourceDocument = asRecord(input.sourceDocument);
  if (sourceDocument) {
    const visible = asString(sourceDocument.visibleContent);
    if (visible) return visible;
  }
  return asString(input.sourceContent) || asString(input.visibleContent);
}

function faqPairsMarkdown(payload: Record<string, unknown>): string {
  const pairs = payload.pairs;
  if (!Array.isArray(pairs)) return "";
  const blocks: string[] = [];
  for (const item of pairs) {
    const row = asRecord(item);
    if (!row) continue;
    const question = asString(row.question);
    const answer = asString(row.answer);
    if (!question && !answer) continue;
    blocks.push(`## ${question || "Question"}\n\n${answer}`);
  }
  return blocks.join("\n\n");
}

export type ParentArtifactMerge = {
  values: Record<string, string>;
  notice: string;
};

export function mergeParentArtifactIntoForm(
  targetCapabilityId: string,
  parentArtifactType: string,
  parentPayload: unknown,
  parentTaskInputs?: unknown,
): ParentArtifactMerge | null {
  const payload = asRecord(parentPayload);
  if (!payload) return null;
  const type = asString(parentArtifactType) || asString(payload.artifactType);
  const values: Record<string, string> = {};
  const notices: string[] = [];

  if (type === "queryPlan.v1" && targetCapabilityId === "faq-generator") {
    const queries = queryTexts(payload);
    if (queries.length === 0) return null;
    values.faqQuestions = queries.join("\n");
    values.topic = queries[0]!.slice(0, 120);
    notices.push(`Imported ${queries.length} planned quer${queries.length === 1 ? "y" : "ies"} from Query Planner.`);
  } else if (
    type === "queryPlan.v1"
    && (targetCapabilityId === "pillar-outline" || targetCapabilityId === "pillar-article")
  ) {
    const queries = queryTexts(payload);
    if (queries.length === 0) return null;
    values.topic = queries[0]!.slice(0, 120);
    values.relatedQueries = queries.join("\n");
    notices.push(`Imported ${queries.length} planned quer${queries.length === 1 ? "y" : "ies"} into pillar inputs.`);
  } else if (type === "pillarOutline.v1" && targetCapabilityId === "pillar-article") {
    const topic = asString(payload.topic);
    const sections = Array.isArray(payload.sections) ? payload.sections : [];
    const related: string[] = [];
    const bodies: string[] = [];
    if (topic) bodies.push(`# ${topic}`);
    for (const entry of sections) {
      const row = asRecord(entry);
      if (!row) continue;
      const heading = asString(row.heading);
      const objective = asString(row.objective);
      const answerFirst = asString(row.answerFirstPrompt);
      if (Array.isArray(row.relatedQueries)) {
        for (const query of row.relatedQueries) {
          if (typeof query === "string" && query.trim()) related.push(query.trim());
        }
      }
      if (heading) {
        bodies.push(`## ${heading}`);
        if (answerFirst) bodies.push(answerFirst);
        else if (objective) bodies.push(objective);
      }
    }
    const supporting = Array.isArray(payload.supportingContentPlan)
      ? payload.supportingContentPlan
      : [];
    const hints: string[] = [];
    for (const entry of supporting) {
      const row = asRecord(entry);
      const title = asString(row?.title);
      if (title) hints.push(title);
    }
    if (!topic && bodies.length === 0) return null;
    if (topic) values.topic = topic;
    if (related.length) values.relatedQueries = [...new Set(related)].join("\n");
    if (hints.length) values.supportingContentHints = hints.join("\n");
    if (bodies.length) values.sourceContent = bodies.join("\n\n");
    notices.push("Imported Pillar Outline topic, sections, and supporting plan into Pillar Article.");
  } else if (type === "faqSet.v1" && targetCapabilityId === "schema-markup") {
    const markdown = faqPairsMarkdown(payload);
    const topic = asString(payload.topic);
    if (!markdown) return null;
    values.visibleContent = topic ? `# ${topic}\n\n${markdown}` : markdown;
    if (topic) values.topic = topic;
    notices.push("Imported FAQ pairs as visible content for Schema Markup.");
  } else if (
    type === "faqSet.v1"
    && (targetCapabilityId === "pillar-outline" || targetCapabilityId === "pillar-article")
  ) {
    const topic = asString(payload.topic);
    const markdown = faqPairsMarkdown(payload);
    if (!topic && !markdown) return null;
    if (topic) values.topic = topic;
    if (markdown) values.sourceContent = markdown;
    notices.push("Imported FAQ topic and pairs for pillar drafting.");
  } else if (
    (type === "readinessScore.v1"
      || type === "factDensityReport.v1"
      || type === "entityMap.v1"
      || type === "schemaMarkup.v1"
      || type === "claimLedger.v1")
    && (
      targetCapabilityId === "faq-generator"
      || targetCapabilityId === "schema-markup"
      || targetCapabilityId === "citable-claims"
      || targetCapabilityId === "fact-density"
      || targetCapabilityId === "entity-mapper"
    )
  ) {
    const visible = visibleFromTaskInputs(parentTaskInputs);
    if (!visible) return null;
    if (targetCapabilityId === "faq-generator") {
      values.sourceContent = visible;
      values.topic = values.topic || "Follow-on from diagnostic";
      notices.push("Imported parent run page content into FAQ source.");
    } else if (targetCapabilityId === "citable-claims") {
      values.sourceContent = visible;
      values.vagueStatements = visible;
      notices.push("Imported parent run page content into Citable Claims.");
    } else {
      values.visibleContent = visible;
      values.sourceContent = visible;
      notices.push("Imported parent run page content into the form.");
    }
  } else {
    return null;
  }

  return {
    values,
    notice: notices.join(" "),
  };
}

export function findArtifactVersionPayload(
  result: {
    artifacts?: Array<{
      artifactType?: string;
      versions?: Array<{ id?: string; payloadJson?: string }>;
    }>;
    taskInputs?: unknown;
  },
  artifactVersionId: string,
): { artifactType: string; payload: unknown; taskInputs: unknown } | null {
  for (const artifact of result.artifacts ?? []) {
    for (const version of artifact.versions ?? []) {
      if (version.id !== artifactVersionId) continue;
      let payload: unknown = null;
      if (typeof version.payloadJson === "string") {
        try {
          payload = JSON.parse(version.payloadJson);
        } catch {
          payload = null;
        }
      }
      return {
        artifactType: artifact.artifactType ?? "",
        payload,
        taskInputs: result.taskInputs ?? null,
      };
    }
  }
  return null;
}
