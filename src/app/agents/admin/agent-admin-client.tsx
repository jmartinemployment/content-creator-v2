"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { SkillSummary } from "@/app/skills/skill-contract";
import { shortDigest } from "@/app/skills/skill-contract";
import {
  normalizeAgentAdminWorkspace,
  normalizeAgentTestRun,
  type AdminAgentDetail,
  type AgentAdminWorkspace,
  type AgentStageParticipation,
  type AgentTeamRole,
  type AgentTestRun,
} from "@/app/agents/agent-contract";
import {
  createAgentTestHubConnection,
  joinAgentTest,
  leaveAgentTest,
  onAgentTestEvent,
} from "./agent-test-hub";

const STAGES = ["researchPlanning", "outline", "section", "repair", "validation", "finalSynthesis", "complete"];
const CONTENT_TYPES = ["blog", "pillar", "guide", "tech-article", "listicle", "whitepaper", "tool", "comparison", "alternatives", "case-study", "service", "local", "email", "social", "ads", "linkedin-document", "image-prompt"];
const TOOLS = ["search_corpus", "load_evidence_page", "get_brief_context", "get_outline_context", "get_completed_section_summaries", "get_specialist_artifacts", "activate_skill", "read_skill_resource", "submit_contribution", "submit_review", "submit_research_plan", "submit_outline", "submit_section", "submit_repair", "submit_validation", "submit_final_synthesis"];
const MODELS = ["o3", "o1-pro"];
const MODEL_POLICY_VERSION = "content-model-policy.v1";

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`/api/gcc-v2/agents/admin${path ? `/${path}` : ""}`, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => null) as { error?: string; detail?: string } | null;
  if (!response.ok) throw new Error(body?.error || body?.detail || `Request failed (HTTP ${response.status})`);
  return body;
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function exactTestPassed(agent: AdminAgentDetail, tests: AgentTestRun[]): boolean {
  const latest = tests[0];
  return Boolean(latest && latest.status === "passed" && latest.versionDigest === agent.digest);
}

export function AgentAdminClient({
  initialWorkspace,
  publishedSkillVersions,
}: {
  initialWorkspace: AgentAdminWorkspace;
  publishedSkillVersions: SkillSummary[];
}) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [selectedId, setSelectedId] = useState(initialWorkspace.agents[0]?.versionId ?? "");
  const [editingAgent, setEditingAgent] = useState<AdminAgentDetail | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [semanticVersion, setSemanticVersion] = useState("1.0.0");
  const [instructions, setInstructions] = useState("");
  const [skillVersionIds, setSkillVersionIds] = useState<string[]>([]);
  const [stageParticipation, setStageParticipation] = useState<AgentStageParticipation[]>([
    { stage: "researchPlanning", role: "contributor", order: 0 },
  ]);
  const [contentTypes, setContentTypes] = useState<string[]>(["blog"]);
  const [allowedTools, setAllowedTools] = useState<string[]>(["search_corpus", "load_evidence_page", "get_brief_context", "activate_skill", "read_skill_resource", "submit_contribution"]);
  const [allowedModels, setAllowedModels] = useState<string[]>(["o3"]);
  const [testScenario, setTestScenario] = useState<"contract" | "rag-smoke">("contract");
  const [testHistory, setTestHistory] = useState<AgentTestRun[]>([]);
  const [activeTest, setActiveTest] = useState<AgentTestRun | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = workspace.agents.find((agent) => agent.versionId === selectedId) ?? workspace.agents[0];

  async function refresh(preferredId?: string) {
    const next = normalizeAgentAdminWorkspace(await api(""));
    setWorkspace(next);
    if (preferredId) setSelectedId(preferredId);
  }

  async function loadTests(versionId: string) {
    const body = await api(`${encodeURIComponent(versionId)}/tests`);
    if (!Array.isArray(body)) throw new Error("Agent test history response must be an array.");
    setTestHistory(body.map(normalizeAgentTestRun));
  }

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void api(`${encodeURIComponent(selectedId)}/tests`)
      .then((body) => {
        if (!cancelled) {
          if (!Array.isArray(body)) throw new Error("Agent test history response must be an array.");
          setTestHistory(body.map(normalizeAgentTestRun));
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load test history");
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  useEffect(() => {
    if (!activeTest?.id) return;
    const connection = createAgentTestHubConnection();
    let disposed = false;
    const off = onAgentTestEvent(connection, (event) => {
      if (disposed || event.testRunId !== activeTest.id) return;
      const next = normalizeAgentTestRun({
        ...event,
        id: event.testRunId,
        scenario: activeTest.scenario,
      });
      setActiveTest(next);
      setTestHistory((current) => [next, ...current.filter((run) => run.id !== next.id)]);
      if (["passed", "failed", "cancelled"].includes(next.status)) {
        void refresh(selectedId);
      }
    }, (contractError) => setError(contractError.message));
    void joinAgentTest(connection, activeTest.id).catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Could not join agent test updates"),
    );
    return () => {
      disposed = true;
      off();
      void leaveAgentTest(connection, activeTest.id).catch(() => undefined).finally(() => connection.stop());
    };
  }, [activeTest?.id, activeTest?.scenario, selectedId]);

  const configPayload = useMemo(() => ({
    semanticVersion,
    objective: objective.trim(),
    instructions: instructions.trim(),
    skillVersionIds,
    stageParticipation,
    contentTypes,
    allowedTools,
    allowedModels,
    modelPolicyVersion: MODEL_POLICY_VERSION,
    modelPolicy: { version: MODEL_POLICY_VERSION, allowedModels },
  }), [allowedModels, allowedTools, contentTypes, instructions, objective, semanticVersion, skillVersionIds, stageParticipation]);

  async function submitConfiguration(event: FormEvent) {
    event.preventDefault();
    setBusy("save");
    setError(null);
    setNotice(null);
    try {
      if (!objective.trim() || !skillVersionIds.length || !stageParticipation.length || !contentTypes.length || !allowedTools.length || !allowedModels.length) {
        throw new Error("Objective and at least one exact skill version, stage, content type, tool, and model are required.");
      }
      const body = editingAgent
        ? configPayload
        : {
            slug: slug.trim() || undefined,
            displayName: name.trim(),
            description: description.trim(),
            ...configPayload,
          };
      const path = editingAgent?.agentId ? `${encodeURIComponent(editingAgent.agentId)}/versions` : "";
      const result = await api(path, { method: "POST", body: JSON.stringify(body) }) as Record<string, unknown>;
      await refresh(typeof result.versionId === "string" ? result.versionId : undefined);
      setNotice(editingAgent ? "Successor draft created" : "Agent draft created");
      setEditingAgent(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save agent configuration");
    } finally {
      setBusy(null);
    }
  }

  function nextPatchVersion(version: string): string {
    const parts = version.split(".").map(Number);
    return parts.length === 3 && parts.every(Number.isInteger)
      ? `${parts[0]}.${parts[1]}.${parts[2] + 1}`
      : "";
  }

  function createSuccessor(agent: AdminAgentDetail) {
    if (!agent.agentId) {
      setError("Backend response omitted agentId; a new version cannot be addressed.");
      return;
    }
    setEditingAgent(agent);
    setName(agent.name);
    setSlug(agent.id);
    setDescription(agent.description);
    setSemanticVersion(nextPatchVersion(agent.version));
    setObjective(agent.objective);
    setInstructions(agent.instructions ?? "");
    setSkillVersionIds(agent.skills.map((skill) => skill.versionId));
    setStageParticipation(agent.participation);
    setContentTypes(agent.supportedContentTypes);
    setAllowedTools(agent.tools);
    setAllowedModels(agent.models);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function dispositionFinding(findingId: string, disposition: "resolved" | "accepted" | "false_positive") {
    if (!selected) return;
    const rationale = window.prompt("Reviewer rationale (required)")?.trim();
    if (!rationale) return;
    setBusy(`finding-${findingId}`);
    setError(null);
    try {
      await api(`${encodeURIComponent(selected.versionId)}/findings/${encodeURIComponent(findingId)}`, {
        method: "PATCH",
        body: JSON.stringify({ disposition, reviewerRationale: rationale }),
      });
      await refresh(selected.versionId);
      setNotice("Finding disposition saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not disposition finding");
    } finally {
      setBusy(null);
    }
  }

  async function mutate(label: string, path: string, body?: unknown) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const result = await api(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }) as Record<string, unknown>;
      await refresh(typeof result.versionId === "string" ? result.versionId : selectedId);
      if (selectedId) await loadTests(selectedId);
      setNotice(label);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `${label} failed`);
    } finally {
      setBusy(null);
    }
  }

  async function runTest() {
    if (!selected) return;
    setBusy("test");
    setError(null);
    try {
      const body = await api(`${encodeURIComponent(selected.versionId)}/test`, {
        method: "POST",
        body: JSON.stringify({ scenario: testScenario, input: {} }),
      }) as Record<string, unknown>;
      if (typeof body.runId !== "string" || typeof body.status !== "string" || !body.testRun) {
        throw new Error("Agent test queue response must include runId, status, and testRun.");
      }
      const run = normalizeAgentTestRun(body.testRun);
      if (run.id !== body.runId || run.status !== body.status) throw new Error("Agent test queue envelope does not match testRun.");
      setActiveTest(run);
      setTestHistory((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      setNotice("Agent test queued");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not queue agent test");
    } finally {
      setBusy(null);
    }
  }

  async function cancelTest() {
    if (!activeTest) return;
    setBusy("cancel-test");
    try {
      const run = normalizeAgentTestRun(await api(`test-runs/${encodeURIComponent(activeTest.id)}/cancel`, { method: "POST" }));
      setActiveTest(run);
      setTestHistory((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      setNotice("Test cancellation requested");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not cancel test");
    } finally {
      setBusy(null);
    }
  }

  const latestPassed = selected ? exactTestPassed(selected, testHistory) : false;
  const blockingFindings = selected?.findings.filter((finding) =>
    finding.blocking && !["resolved", "accepted", "false_positive"].includes(finding.disposition ?? "open"),
  ) ?? [];
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="space-y-5">
        <form onSubmit={submitConfiguration} className="rounded-xl border border-[var(--cc-line)] bg-white p-4">
          <h2 className="font-bold">{editingAgent ? `Create successor draft for ${editingAgent.name}` : "Create specialist draft"}</h2>
          {editingAgent ? <><p className="mt-1 text-xs text-[var(--cc-muted)]">The selected {editingAgent.status} version remains immutable. This creates a separate draft version.</p><button type="button" onClick={() => setEditingAgent(null)} className="mt-1 text-xs text-[var(--cc-accent)] underline">Cancel successor</button></> : null}
          {!editingAgent ? (
            <>
              <label className="mt-3 block text-xs font-semibold">Display name<input aria-label="Agent name" required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded border p-2 text-sm" /></label>
              <label className="mt-3 block text-xs font-semibold">Stable slug<input aria-label="Agent slug" value={slug} onChange={(event) => setSlug(event.target.value)} className="mt-1 w-full rounded border p-2 text-sm" /></label>
              <label className="mt-3 block text-xs font-semibold">Description<textarea aria-label="Agent description" required value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-16 w-full rounded border p-2 text-sm" /></label>
            </>
          ) : null}
          <label className="mt-3 block text-xs font-semibold">Semantic version<input aria-label="Semantic version" required pattern="\d+\.\d+\.\d+" value={semanticVersion} onChange={(event) => setSemanticVersion(event.target.value)} className="mt-1 w-full rounded border p-2 font-mono text-sm" /></label>
          <label className="mt-3 block text-xs font-semibold">Objective<textarea aria-label="Agent objective" required value={objective} onChange={(event) => setObjective(event.target.value)} className="mt-1 min-h-16 w-full rounded border p-2 text-sm" /></label>
          <label className="mt-3 block text-xs font-semibold">Instructions<textarea aria-label="Agent instructions" required value={instructions} onChange={(event) => setInstructions(event.target.value)} className="mt-1 min-h-24 w-full rounded border p-2 font-mono text-xs" /></label>

          <fieldset className="mt-4"><legend className="text-xs font-bold">Published skill versions</legend><div className="mt-2 space-y-2">{publishedSkillVersions.map((skill) => (
            <label key={skill.versionId} className="flex gap-2 rounded border p-2 text-xs"><input type="checkbox" aria-label={`${skill.name} ${skill.version}`} checked={skillVersionIds.includes(skill.versionId!)} onChange={() => setSkillVersionIds((current) => toggle(current, skill.versionId!))} /><span><strong>{skill.name} {skill.version}</strong><span className="block font-mono">{skill.versionId} · {shortDigest(skill.packageDigest)}</span></span></label>
          ))}</div></fieldset>

          <fieldset className="mt-4"><legend className="text-xs font-bold">Stage participation</legend><div className="mt-2 space-y-2">{STAGES.map((stage) => {
            const row = stageParticipation.find((item) => item.stage === stage);
            return <div key={stage} className="grid grid-cols-[1fr_110px_60px] items-center gap-2 text-xs"><label className="flex items-center gap-2"><input type="checkbox" aria-label={`${stage} enabled`} checked={Boolean(row)} onChange={() => setStageParticipation((current) => row ? current.filter((item) => item.stage !== stage) : [...current, { stage, role: "contributor", order: current.length }])} />{stage}</label><select aria-label={`${stage} role`} disabled={!row} value={row?.role ?? "contributor"} onChange={(event) => setStageParticipation((current) => current.map((item) => item.stage === stage ? { ...item, role: event.target.value as AgentTeamRole } : item))} className="rounded border p-1"><option value="contributor">Contributor</option><option value="producer">Producer</option><option value="reviewer">Reviewer</option></select><input aria-label={`${stage} order`} disabled={!row} type="number" min="0" value={row?.order ?? 0} onChange={(event) => setStageParticipation((current) => current.map((item) => item.stage === stage ? { ...item, order: Number(event.target.value) } : item))} className="w-full rounded border p-1" /></div>;
          })}</div></fieldset>

          <fieldset className="mt-4"><legend className="text-xs font-bold">Supported content types</legend><div className="mt-2 flex flex-wrap gap-2">{CONTENT_TYPES.map((type) => <label key={type} className="text-xs"><input type="checkbox" aria-label={`${type} content type`} checked={contentTypes.includes(type)} onChange={() => setContentTypes((current) => toggle(current, type))} /> {type}</label>)}</div></fieldset>
          <fieldset className="mt-4"><legend className="text-xs font-bold">Allowed tools</legend><div className="mt-2 grid gap-1">{TOOLS.map((tool) => <label key={tool} className="text-xs"><input type="checkbox" aria-label={`${tool} tool`} checked={allowedTools.includes(tool)} onChange={() => setAllowedTools((current) => toggle(current, tool))} /> {tool}</label>)}</div></fieldset>
          <fieldset className="mt-4"><legend className="text-xs font-bold">Allowed models</legend><p className="text-xs text-[var(--cc-muted)]">Policy {MODEL_POLICY_VERSION}</p><div className="mt-2 flex gap-4">{MODELS.map((model) => <label key={model} className="text-xs"><input type="checkbox" aria-label={`${model} model`} checked={allowedModels.includes(model)} onChange={() => setAllowedModels((current) => toggle(current, model))} /> {model}</label>)}</div></fieldset>
          <button disabled={busy !== null} className="mt-4 rounded bg-[var(--cc-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === "save" ? "Saving…" : editingAgent ? "Save successor draft" : "Create draft"}</button>
        </form>

        <section className="rounded-xl border border-[var(--cc-line)] bg-white p-4"><h2 className="font-bold">Versions</h2><ul className="mt-3 space-y-2">{workspace.agents.map((agent) => <li key={agent.versionId}><button onClick={() => setSelectedId(agent.versionId)} className={`w-full rounded border p-3 text-left text-sm ${agent.versionId === selectedId ? "border-[var(--cc-accent)] bg-blue-50" : "border-[var(--cc-line)]"}`}><strong>{agent.name} {agent.version}</strong><span className="block text-xs capitalize">{agent.status.replaceAll("_", " ")}</span></button></li>)}</ul></section>
      </aside>

      <section className="min-w-0 rounded-xl border border-[var(--cc-line)] bg-white p-5">
        {error ? <p role="alert" className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        {notice ? <p role="status" className="mb-4 rounded bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
        {!selected ? <p>No agent drafts.</p> : <>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{selected.name} {selected.version}</h2><p className="mt-1 text-sm text-[var(--cc-muted)]">{selected.description}</p></div><div className="flex gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize">{selected.status.replaceAll("_", " ")}</span><button onClick={() => createSuccessor(selected)} className="rounded border px-2 py-1 text-xs font-semibold">{["published", "deprecated", "revoked"].includes(selected.status) ? "Create successor draft" : "Create superseding draft"}</button></div></div>
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            <div><dt className="font-semibold">Stable / version IDs</dt><dd className="font-mono">{selected.id}<br />{selected.versionId}</dd></div>
            <div><dt className="font-semibold">Digest</dt><dd className="font-mono">{selected.digest}</dd></div>
            <div className="sm:col-span-2"><dt className="font-semibold">Objective</dt><dd>{selected.objective}</dd></div>
            <div><dt className="font-semibold">Content types</dt><dd>{selected.supportedContentTypes.join(", ") || "None"}</dd></div>
            <div><dt className="font-semibold">Allowed models / policy</dt><dd>{selected.models.join(", ") || "None"} · {selected.modelPolicyVersion}</dd></div>
            <div className="sm:col-span-2"><dt className="font-semibold">Allowed tools</dt><dd>{selected.tools.join(", ") || "None"}</dd></div>
          </dl>
          <h3 className="mt-5 font-bold">Exact pinned skills</h3><ul className="mt-2 space-y-1 text-xs">{selected.skills.map((skill) => <li key={skill.versionId}><strong>{skill.name || skill.id} {skill.version}</strong> · <span className="font-mono">{skill.versionId} · {shortDigest(skill.digest)}</span></li>)}</ul>
          <h3 className="mt-5 font-bold">Stage responsibilities</h3><ol className="mt-2 space-y-1 text-xs">{[...selected.participation].sort((a, b) => a.order - b.order).map((row) => <li key={`${row.stage}-${row.role}`}><span className="font-mono">{row.order}</span> · {row.stage} · <strong className="capitalize">{row.role}</strong></li>)}</ol>
          {selected.instructions ? <pre className="mt-5 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-white">{selected.instructions}</pre> : null}

          <section className="mt-6">
            <h3 className="font-bold">Review findings</h3>
            {selected.findings.length ? <ul className="mt-2 space-y-2">{selected.findings.map((finding) => (
              <li key={finding.id} className={`rounded border p-3 text-xs ${finding.blocking && (finding.disposition ?? "open") === "open" ? "border-red-200 bg-red-50" : "border-[var(--cc-line)] bg-slate-50"}`}>
                <div className="flex flex-wrap gap-2"><strong className="uppercase">{finding.severity}</strong><span>{finding.rule}</span>{finding.blocking ? <span className="font-semibold text-red-800">Blocking</span> : null}<span className="ml-auto capitalize">{finding.disposition ?? "open"}</span></div>
                <p className="mt-1">{finding.message}</p>
                <p className="mt-1 text-[var(--cc-muted)]">Scanner: {finding.scanner}</p>
                {finding.reviewerRationale ? <p className="mt-1">Rationale: {finding.reviewerRationale}</p> : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button disabled={busy !== null} onClick={() => void dispositionFinding(finding.id, "resolved")} className="rounded border px-2 py-1">Resolve</button>
                    <button disabled={busy !== null} onClick={() => void dispositionFinding(finding.id, "accepted")} className="rounded border px-2 py-1">Accept risk</button>
                    <button disabled={busy !== null} onClick={() => void dispositionFinding(finding.id, "false_positive")} className="rounded border px-2 py-1">False positive</button>
                  </div>
                )}
              </li>
            ))}</ul> : <p className="mt-2 text-xs text-[var(--cc-muted)]">No persisted findings.</p>}
          </section>

          <label className="mt-5 block text-xs font-semibold">Review notes<textarea aria-label="Agent review notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded border p-2 text-sm" /></label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy !== null || selected.status !== "draft" || blockingFindings.length > 0} onClick={() => void mutate("Review approved", `${encodeURIComponent(selected.versionId)}/review`, { approve: true, decision: "approve", notes })} className="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Approve review</button>
            <select aria-label="Agent test scenario" value={testScenario} onChange={(event) => setTestScenario(event.target.value as "contract" | "rag-smoke")} className="rounded border px-2 text-xs"><option value="contract">Contract</option><option value="rag-smoke">RAG smoke</option></select>
            <button disabled={busy !== null || !["approved", "published", "deprecated"].includes(selected.status)} onClick={() => void runTest()} className="rounded border px-3 py-2 text-xs font-semibold disabled:opacity-40">Run durable test</button>
            <button disabled={busy !== null || selected.status !== "approved" || !latestPassed || blockingFindings.length > 0} title={blockingFindings.length ? "Resolve blocking findings before publishing" : !latestPassed ? "Latest test must pass for this exact version digest" : undefined} onClick={() => void mutate("Agent published", `${encodeURIComponent(selected.versionId)}/publish`)} className="rounded bg-[var(--cc-accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Publish version</button>
            <button disabled={busy !== null || selected.status !== "published"} onClick={() => void mutate("Agent deprecated", `${encodeURIComponent(selected.versionId)}/deprecate`, { reason: notes || "Superseded" })} className="rounded border px-3 py-2 text-xs font-semibold disabled:opacity-40">Deprecate</button>
            <button disabled={busy !== null || !["published", "deprecated"].includes(selected.status)} onClick={() => void mutate("Agent revoked", `${encodeURIComponent(selected.versionId)}/revoke`, { reason: notes || "Governance revocation" })} className="rounded border border-red-300 px-3 py-2 text-xs font-semibold text-red-800 disabled:opacity-40">Revoke</button>
          </div>

          {activeTest ? <section aria-label="Active agent test" className="mt-5 rounded border border-blue-200 bg-blue-50 p-3 text-xs"><div className="flex justify-between"><strong>{activeTest.scenario} · {activeTest.status}</strong><span>{activeTest.progressPercent}%</span></div><progress aria-label="Agent test progress" className="mt-2 w-full" max="100" value={activeTest.progressPercent} /><p className="mt-1">Phase: {activeTest.phase}</p>{activeTest.message ? <p>{activeTest.message}</p> : null}{activeTest.resultJson ? <pre className="mt-2 whitespace-pre-wrap">{activeTest.resultJson}</pre> : null}{activeTest.error ? <p className="mt-2 text-red-800">{activeTest.error}</p> : null}{!["passed", "failed", "cancelled"].includes(activeTest.status) ? <button disabled={busy !== null} onClick={() => void cancelTest()} className="mt-2 rounded border px-2 py-1 font-semibold">Cancel test</button> : null}</section> : null}
          <section className="mt-6"><h3 className="font-bold">Test history</h3>{testHistory.length ? <ol className="mt-2 space-y-2 text-xs">{testHistory.map((test) => <li key={test.id} className="rounded bg-slate-50 p-2"><strong>{test.scenario} · {test.status}</strong> · {test.progressPercent}% · {test.phase}<span className="block font-mono">{test.id} · digest {shortDigest(test.versionDigest)}</span>{test.error ? <span className="text-red-700">{test.error}</span> : null}</li>)}</ol> : <p className="mt-2 text-xs text-[var(--cc-muted)]">No durable tests.</p>}</section>
          {selected.audit?.length ? <section className="mt-6"><h3 className="font-bold">Audit history</h3><ol className="mt-2 space-y-2 text-xs">{selected.audit.map((entry) => <li key={entry.id} className="rounded bg-slate-50 p-2"><strong>{entry.action}</strong> · {entry.actor} · {entry.atUtc}{entry.detail ? <p>{entry.detail}</p> : null}</li>)}</ol></section> : null}
        </>}
      </section>
    </div>
  );
}
