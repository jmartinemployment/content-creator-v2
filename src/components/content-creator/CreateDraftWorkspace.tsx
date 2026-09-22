"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { SiteContextBanner } from "@/components/SiteContextBanner";
import { CONTENT_TYPES, isContentTypeDisabled } from "@/lib/content-types";
import ContentBriefPanel from "./ContentBriefPanel";
import type { HubConnection } from "@microsoft/signalr";
import {
  createWorkflowHubConnection,
  joinGccGenerate,
  onGccGenerateEvent,
  onGccGenerateReconnected,
  onGccGenerateTypeEvent,
} from "@/services/workflow-tools-hub";
import { ApiError } from "@/services/gcc-api";
import {
  approveGccVersion,
  generateGccCreate,
  getGccCreateDetail,
  listGccVersions,
  parseSiteSectionJson,
  parseStaleGroundingError,
  polishGccVersion,
  previewBodyDocument,
  renderArtifactBody,
  reviseGccVersion,
  seoGccVersion,
  type GccArtifact,
  type GccArtifactVersion,
  type GccCreateDetail,
  type GccPolishReport,
  type GccSeoReport,
  type GccStaleGroundingError,
} from "@/services/gcc-api";

export default function CreateDraftWorkspace({
  createId,
  clientId,
  projectId,
  projectSiteRunId,
  onCreateMinted,
}: {
  // Null before a create exists. Mint-through-review is one lifecycle now, in one component, so
  // clientId/projectId/projectSiteRunId are threaded from the caller exactly once regardless of
  // which stage the create is at -- two render paths each needing the same context props is how
  // one of them silently went without it (the missing-projectId refusal bug, 2026-09-22).
  createId: string | null;
  // Only needed to mint a fresh create (the `!effectiveCreateId` branch below) -- once a create
  // exists, the loaded state reads clientId/projectSiteRunId back off the create itself
  // (`detail.clientId`, `detail.projectSiteRunId`), never off these props. Optional so
  // /app/creates/[id], which always already has a createId, doesn't need to supply them.
  clientId?: string;
  projectId?: string;
  projectSiteRunId?: string;
  onCreateMinted?: (createId: string) => void;
}) {
  // The id this workspace actually operates on: the prop once a create exists, or one just minted
  // by the brief panel below, before the parent's own createId state (if it tracks one at all)
  // catches up on its next render.
  const [mintedCreateId, setMintedCreateId] = useState<string | null>(null);
  const effectiveCreateId = createId ?? mintedCreateId;
  const [briefValid, setBriefValid] = useState(false);

  const [detail, setDetail] = useState<GccCreateDetail | null>(null);
  const [artifact, setArtifact] = useState<GccArtifact | null>(null);
  const [version, setVersion] = useState<GccArtifactVersion | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [briefFormComplete, setBriefFormComplete] = useState(false);
  const [briefSavedOnServer, setBriefSavedOnServer] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);
  const [outputTypes, setOutputTypes] = useState<string[]>([]);
  // The one content-type selection in this component. It mints the create (its first entry
  // becomes StartingContentType) and it is what Generate produces -- not two pickers agreeing
  // by hand.
  function toggleOutputType(value: string) {
    setOutputTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }
  const [stalePrompt, setStalePrompt] = useState<GccStaleGroundingError | null>(null);

  const [feedback, setFeedback] = useState("");
  const [scope, setScope] = useState<"full" | "section">("full");
  const [sectionPath, setSectionPath] = useState("");
  const [seo, setSeo] = useState<GccSeoReport | null>(null);
  const [polish, setPolish] = useState<GccPolishReport | null>(null);

  // Which artifact id the operator is currently looking at. Separate from `artifact` itself
  // (the full object) so reload() can tell "no selection yet" (null, pick a default) apart from
  // "the operator picked one, keep it" (a real id) without re-deriving from `artifact`, which
  // reload() is also about to replace.
  const selectedArtifactIdRef = useRef<string | null>(null);
  // The generate job this workspace is following, and the hub connection following it. Generate
  // returns 202 and reports over SignalR -- see plans/generate-async-signalr.md.
  const hubRef = useRef<HubConnection | null>(null);
  const generateJobIdRef = useRef<string | null>(null);

  const loadVersionFor = useCallback(async (a: GccArtifact | null) => {
    setArtifact(a);
    selectedArtifactIdRef.current = a?.id ?? null;
    // SEO/polish reports are per-version -- switching artifacts without clearing them would show
    // a stale report for a different draft as if it applied to the one now on screen.
    setSeo(null);
    setPolish(null);
    if (!a) {
      setVersion(null);
      return;
    }
    try {
      const versions = await listGccVersions(a.id);
      const latest = [...versions].sort((x, y) => y.versionNumber - x.versionNumber)[0] ?? null;
      setVersion(latest);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not load that artifact's versions.",
      );
    }
  }, []);

  const reload = useCallback(async () => {
    if (!effectiveCreateId) return;
    // No synchronous setState before the first await — see the identical fix and its reasoning
    // in creates/[id]/repurpose/page.tsx's `load`. Every path below still ends by setting
    // loadError to its correct value.
    try {
      const d = await getGccCreateDetail(effectiveCreateId);
      setDetail(d);
      setLoadError(null);
      setBriefSavedOnServer(!!d.briefJson);
      // Generate's checkboxes (outputTypes, below) are never seeded from the create's starting
      // type. That type was a decision made at mint time, for Brief; Generate is a separate, later
      // decision about what to produce right now, and pre-checking a box the operator never
      // clicked is exactly the default/fallback content-type pattern removed everywhere else
      // (Jeff, repeatedly, most recently 2026-09-22 after finding Pillar pre-checked here on an
      // existing create). outputTypes starts at [] (its useState above) and only ever changes from
      // the operator's own clicks on the checkboxes below -- reload() must not touch it at all.
      //
      // Same "don't clobber the operator's choice" principle applies to artifact selection: if
      // they've already selected an artifact (an earlier reload, or clicking a switcher tab), a
      // fresh reload must not silently snap back to the auto-picked "primary" one out from under
      // them. A generate that adds new artifacts is the one case reload() itself should move the
      // selection — runGenerate passes the freshly created artifact's id explicitly for that.
      const stillExists = selectedArtifactIdRef.current
        ? d.artifacts.find((a) => a.id === selectedArtifactIdRef.current)
        : undefined;
      // No type preference -- picking "blog" (or any other type) over whatever else exists is
      // exactly the silent default this session removed everywhere else. Whatever the operator
      // most recently generated/selected wins (stillExists, above); absent that, just the first
      // artifact in the list, not the first one that happens to match a preferred type.
      const target = stillExists ?? d.artifacts[0] ?? null;
      await loadVersionFor(target);
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not load create.",
      );
    }
  }, [effectiveCreateId, loadVersionFor]);

  // reload is called through a ref rather than by name so this effect is not itself classified as
  // "a function that sets state" — calling it directly here is exactly the standard load-on-mount
  // (and reload-if-createId-changes) pattern, not the "derive state from a prop" pattern the rule
  // exists to catch. The two effects run in this order on mount (React runs effects in
  // declaration order), so the ref always holds the current reload before it is called.
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);
  useEffect(() => {
    if (!effectiveCreateId) return;
    void reloadRef.current();
  }, [effectiveCreateId]);

  // Close the hub connection when this workspace goes away. The job keeps running server-side --
  // it is not tied to the connection -- and GetJob plus JoinGccGenerate pick it back up.
  useEffect(
    () => () => {
      const conn = hubRef.current;
      hubRef.current = null;
      void conn?.stop();
    },
    [],
  );

  function run(label: string, fn: () => Promise<void>) {
    setActionError(null);
    setActionMsg(null);
    startTransition(async () => {
      try {
        await fn();
        setActionMsg(label);
      } catch (err) {
        setActionError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Action failed.",
        );
      }
    });
  }

  // No create yet. Same single section as below -- one card, one content-type picker, the brief
  // fields, then Generate. Saving the brief is what mints the create; Generate stays inert until
  // it exists, rather than living in a second panel with a second picker of its own.
  if (!effectiveCreateId) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Content Brief &amp; Generate</h2>
        <p className="mt-1 text-sm text-muted">
          Pick what to produce, fill the brief, save it — saving creates the piece. Generate then
          runs against saved server state only.
        </p>

        <ContentTypePicker selected={outputTypes} onToggle={toggleOutputType} />

        <ContentBriefPanel
          clientId={clientId ?? ""}
          projectId={projectId}
          projectSiteRunId={projectSiteRunId}
          targetKeyword=""
          startingContentType={outputTypes[0]}
          onBriefValidityChange={setBriefValid}
          onBriefSaved={(newCreateId) => {
            if (!newCreateId) return;
            setMintedCreateId(newCreateId);
            onCreateMinted?.(newCreateId);
          }}
        />

        <button
          type="button"
          disabled
          className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate content
        </button>
        <p className="mt-2 text-xs text-muted">
          {outputTypes.length === 0
            ? "Select at least one content type, then save the brief."
            : briefValid
              ? "Save the brief above — that creates the piece, then Generate runs."
              : "Complete the brief's required fields, then save it."}
        </p>
      </section>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-red-600">{loadError}</p>
        <Link href="/app/creates" className="mt-4 inline-block text-sm text-brand hover:underline">
          &larr; Back to workflow
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-muted">Loading create…</p>
      </div>
    );
  }

  const briefReady = !!detail.briefJson || briefSavedOnServer;
  const researchReady = !!detail.researchJson;
  const approved = artifact?.status?.toLowerCase() === "approved";
  const siteSection = parseSiteSectionJson(detail.siteSectionJson);
  const canGenerate = briefFormComplete && briefReady;
  // A create grounded on a project-site crawl requires relatedPages on its persisted site
  // section; domain-only grounding (a crawl id with no section) does not.
  const saMissingPages =
    !!detail.projectSiteRunId &&
    !!siteSection &&
    !siteSection.relatedPages.length;
  // GccV2SiteSection.ValidateSiteSectionGate throws "project site crawl required" when the create
  // has no ProjectSiteRunId, and GenerateAsync turns that into a 400 before it looks at content
  // types, grounding or anything else -- and without logging it. Nothing in here checked for it,
  // so Generate was offered as enabled and then failed with an unexplained 400 every time
  // (Jeff, 2026-09-22: two hours of "same error"). Refuse here, in words, instead.
  const missingProjectSiteRun = !detail.projectSiteRunId;

  /**
   * Follow a generate job on the hub. Each content type pushes as it finishes, so artifacts appear
   * progressively rather than all at once when the slowest one lands; the job event is what ends
   * the run. Handlers read reload through its ref so they never close over a stale copy.
   */
  async function attachToGenerateJob(jobId: string) {
    generateJobIdRef.current = jobId;
    let conn = hubRef.current;
    if (!conn) {
      conn = createWorkflowHubConnection();
      hubRef.current = conn;

      onGccGenerateTypeEvent(conn, (evt) => {
        if (evt.jobId !== generateJobIdRef.current) return;
        setGenerateMsg(
          evt.status === "failed"
            ? `${evt.contentType}: ${evt.error ?? "failed"}`
            : `${evt.contentType} ready.`,
        );
        void reloadRef.current();
      });

      onGccGenerateEvent(conn, (evt) => {
        if (evt.jobId !== generateJobIdRef.current) return;
        if (evt.status === "ready") {
          setGenerateMsg("Generate finished.");
          setGenerating(false);
          void reloadRef.current();
        } else if (evt.status === "failed") {
          // The refusal or fault verbatim -- the whole point of the job carrying its error.
          setGenerateMsg(evt.error ?? "Generate failed.");
          setGenerating(false);
        }
      });

      onGccGenerateReconnected(conn, () => generateJobIdRef.current);
    }
    await joinGccGenerate(conn, jobId);
  }

  async function runGenerate(acknowledgeStale = false) {
    if (!effectiveCreateId || !canGenerate || saMissingPages) return;
    setGenerateMsg(null);
    setStalePrompt(null);
    setGenerating(true);
    try {
      const result = await generateGccCreate(effectiveCreateId, {
        outputTypes,
        acknowledgeStaleGrounding: acknowledgeStale,
      });

      // Job shape: generation runs in the background and reports over the hub. `generating` stays
      // true until a terminal job event arrives, so the button reflects real state rather than
      // "the POST returned".
      if (result.jobId) {
        setGenerateMsg(
          outputTypes.length > 1
            ? `Generating ${outputTypes.length} content items — each appears as it finishes.`
            : "Generating — this runs in the background.",
        );
        await attachToGenerateJob(result.jobId);
        return;
      }

      // Inline shapes, for a GeekAPI not yet running the job runner. This frontend deploys first
      // on purpose, so there is never a moment where the two disagree.
      if (result.artifact && result.version) {
        setGenerateMsg(
          `Created ${result.artifact.type} \u201c${result.artifact.name}\u201d v${result.version.versionNumber}.`,
        );
        selectedArtifactIdRef.current = result.artifact.id;
      } else if (result.created?.length) {
        setGenerateMsg(`Generated ${result.created.length} artifact(s).`);
        selectedArtifactIdRef.current = result.created[0]?.artifact.id ?? null;
      } else {
        setGenerateMsg("Generate finished.");
      }
      await reload();
      setGenerating(false);
    } catch (err) {
      const stale = parseStaleGroundingError(err);
      if (stale) {
        setStalePrompt(stale);
        setGenerateMsg(null);
      } else {
        setGenerateMsg(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Generate failed",
        );
      }
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/app/creates" className="text-sm text-brand hover:underline">
        &larr; Back to workflow
      </Link>

      <div className="mb-8 mt-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">
          {detail.startingContentType ?? "no type yet"}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">{detail.topic}</h1>
        <p className="mt-2 text-sm text-muted">
          Create {detail.id}
          {briefReady ? " · brief saved" : " · brief missing"}
          {researchReady ? " · research saved" : ""}
          {detail.projectSiteRunId ? " · grounded on a crawl" : ""}
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-6">
        {siteSection ? <SiteContextBanner siteSection={siteSection} /> : null}
        {saMissingPages ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            This create&rsquo;s project-site grounding is missing related pages — Generate stays
            blocked (no keyword-only path).
          </p>
        ) : null}

        <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Content Brief &amp; Generate</h2>
          <p className="mt-1 text-sm text-muted">
            One section, one content-type selection. Generate reads persisted BriefJson /
            ResearchJson (and site section) from the database only — every checked type is
            generated independently, nothing is derived from another.
          </p>

          <ContentTypePicker selected={outputTypes} onToggle={toggleOutputType} />

          <ContentBriefPanel
            clientId={detail.clientId}
            projectSiteRunId={detail.projectSiteRunId ?? undefined}
            targetKeyword={detail.topic}
            createId={effectiveCreateId}
            startingContentType={outputTypes[0] ?? detail.startingContentType ?? undefined}
            onBriefValidityChange={setBriefFormComplete}
            onBriefSaved={(_id, ok) => {
              setBriefSavedOnServer(ok);
              void reload();
            }}
          />

          <button
            type="button"
            disabled={
              !canGenerate ||
              saMissingPages ||
              missingProjectSiteRun ||
              generating ||
              outputTypes.length === 0
            }
            onClick={() => void runGenerate(false)}
            className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating
              ? "Generating…"
              : outputTypes.length > 1
                ? `Generate ${outputTypes.length} content items`
                : "Generate content"}
          </button>
          {stalePrompt ? (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950">
              <p className="font-medium">{stalePrompt.message}</p>
              <p className="mt-1 text-amber-800">
                Last analyzed {new Date(stalePrompt.lastAnalyzedAtUtc).toLocaleString()} (
                {stalePrompt.analysisAgeDays} day
                {stalePrompt.analysisAgeDays === 1 ? "" : "s"} ago). Threshold:{" "}
                {stalePrompt.staleAfterDays} days.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => void runGenerate(true)}
                  className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50"
                >
                  Proceed with stale grounding
                </button>
              </div>
            </div>
          ) : null}
          {missingProjectSiteRun ? (
            <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              This create has no project-site crawl (Run ID), so GeekAPI refuses every Generate on
              it before it reads the content type. The project it belongs to needs a project-site
              crawl, and the create has to be started while that Run ID is on the project.
            </p>
          ) : null}
          {!canGenerate ? (
            <p className="mt-2 text-xs text-muted">
              Disabled until Content Brief is saved — inline required markers above.
            </p>
          ) : null}
          {generateMsg ? (
            <p className="mt-2 text-sm whitespace-pre-wrap">{generateMsg}</p>
          ) : null}
        </section>
      </div>

      {detail.artifacts.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Generated artifacts">
          {detail.artifacts.map((a) => {
            const selected = a.id === artifact?.id;
            return (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => void loadVersionFor(a)}
                className={
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                  (selected
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-surface text-foreground hover:bg-muted/30")
                }
              >
                {a.type}
                {a.status?.toLowerCase() === "approved" ? " ✓" : ""}
              </button>
            );
          })}
        </div>
      ) : null}

      {!version ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No draft artifact yet. Save the Content Brief, then Generate above.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">
              {artifact?.name || "Draft"}
              {" · "}v{version.versionNumber}
              {approved ? " · approved" : ""}
            </h2>
            <p className="mt-1 text-sm text-muted">{artifact?.type}</p>
            <ArtifactBody bodyDocumentJson={version.bodyDocumentJson} />
          </section>

          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Revise</h2>
            <p className="mt-1 text-sm text-muted">
              Full or Section — each submit creates a new version (not a chat thread).
            </p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              className="mt-4 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="What should change in this draft?"
            />
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={scope === "full"}
                  onChange={() => setScope("full")}
                />
                Full
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={scope === "section"}
                  onChange={() => setScope("section")}
                />
                Section
              </label>
            </div>
            {scope === "section" ? (
              <input
                value={sectionPath}
                onChange={(e) => setSectionPath(e.target.value)}
                placeholder='e.g. "Key Capabilities"'
                className="mt-3 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            ) : null}
            <button
              type="button"
              disabled={pending || !feedback.trim() || (scope === "section" && !sectionPath.trim())}
              onClick={() =>
                run("Revised — new version saved.", async () => {
                  if (!version) return;
                  if (scope === "section" && !sectionPath.trim()) {
                    throw new Error("Section path required for section revise.");
                  }
                  const next = await reviseGccVersion(version.id, {
                    feedback: feedback.trim(),
                    scope,
                    sectionPath: scope === "section" ? sectionPath.trim() : null,
                  });
                  setVersion(next);
                  setSeo(null);
                  setPolish(null);
                  await reload();
                })
              }
              className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Working…" : "Revise"}
            </button>
          </section>

          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">
              On-page SEO &amp; polish
            </h2>
            <p className="mt-1 text-sm text-muted">
              Draft + target keyword only — no research dossier.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pending || !version}
                onClick={() =>
                  run("SEO report ready.", async () => {
                    if (!version || !detail) return;
                    setSeo(await seoGccVersion(version.id, detail.topic));
                  })
                }
                className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/30 disabled:opacity-50"
              >
                Run SEO
              </button>
              <button
                type="button"
                disabled={pending || !version}
                onClick={() =>
                  run("Polish report ready.", async () => {
                    if (!version) return;
                    setPolish(await polishGccVersion(version.id));
                  })
                }
                className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/30 disabled:opacity-50"
              >
                Run polish
              </button>
            </div>
            {seo ? (
              <div className="mt-4 text-sm">
                <p className="font-medium">
                  SEO score {seo.score} · {seo.wordCount} words · density{" "}
                  {seo.keywordDensityPercent.toFixed(1)}%
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                  {seo.checks.map((c) => (
                    <li key={c.id}>
                      {c.passed ? "✓" : "✗"} {c.label}: {c.detail}
                    </li>
                  ))}
                </ul>
                {seo.applyFeedback ? (
                  <button
                    type="button"
                    className="mt-3 text-sm font-semibold text-brand hover:underline"
                    onClick={() => {
                      setFeedback(seo.applyFeedback);
                      setScope("full");
                    }}
                  >
                    Copy SEO fixes into revise
                  </button>
                ) : null}
              </div>
            ) : null}
            {polish ? (
              <div className="mt-4 text-sm">
                <p className="font-medium">
                  Polish score {polish.score}
                  {polish.shipReady ? " · ship-ready heuristic" : ""}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                  {polish.checks.map((c) => (
                    <li key={c.id}>
                      {c.passed ? "✓" : "✗"} {c.label}: {c.detail}
                    </li>
                  ))}
                </ul>
                {polish.applyFeedback ? (
                  <button
                    type="button"
                    className="mt-3 text-sm font-semibold text-brand hover:underline"
                    onClick={() => {
                      setFeedback(polish.applyFeedback);
                      setScope("full");
                    }}
                  >
                    Copy polish fixes into revise
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Content approval</h2>
            <p className="mt-1 text-sm text-muted">
              Approval is on the create artifact (GeekAPI) — required before Repurpose.
            </p>
            {approved ? (
              <p className="mt-4 text-sm font-medium text-green-800">Content approved.</p>
            ) : (
              <button
                type="button"
                disabled={pending || !version}
                onClick={() =>
                  run("Approved.", async () => {
                    if (!version) return;
                    await approveGccVersion(version.id);
                    await reload();
                  })
                }
                className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
              >
                Approve content
              </button>
            )}
          </section>
        </div>
      )}

      {actionError ? (
        <p className="mt-4 text-sm text-red-600 whitespace-pre-wrap">{actionError}</p>
      ) : null}
      {actionMsg ? (
        <p className="mt-4 text-sm text-green-700">{actionMsg}</p>
      ) : null}
    </div>
  );
}

/**
 * The single content-type picker. One definition, used by this component's pre-create and
 * post-create states alike -- Brief and Generate are one section with one selection now, so there
 * is no second grid anywhere to drift from this one. Same grid/input sizing as ProjectWorkPanel's
 * task checkboxes ("Content Type selection should mirror tasks", Jeff). Nothing is ever checked
 * by default.
 */
function ContentTypePicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="mt-4 rounded-md border border-border p-3">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted">
        Content type
      </legend>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        {CONTENT_TYPES.map((o) => {
          const disabled = isContentTypeDisabled(o.value);
          return (
            <label
              key={o.value}
              className={`flex items-center gap-1.5 text-xs font-normal ${disabled ? "text-muted" : "text-foreground"}`}
              title={disabled ? "Disabled pending a written, approved resolve plan" : undefined}
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                disabled={disabled}
                onChange={() => onToggle(o.value)}
                className="h-3.5 w-3.5 rounded border-border text-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
              />
              {o.label}
              {disabled ? " (disabled)" : ""}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Render an artifact body as readable content (CWV2 ContentDocument → HTML, or labeled
 * fields for image-prompt/tool artifacts). Raw JSON is available behind a collapsed toggle
 * for debugging — never the default view.
 */
function ArtifactBody({ bodyDocumentJson }: { bodyDocumentJson: string }) {
  const [showSource, setShowSource] = useState(false);
  const html = renderArtifactBody(bodyDocumentJson);

  return (
    <div className="mt-4">
      {html ? (
        <div
          className="gcc-doc max-h-[32rem] overflow-auto rounded-md border border-border bg-white p-5 text-sm text-foreground [&_a]:text-brand [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:mb-3 [&_p]:leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-white p-4 text-sm text-foreground">
          {previewBodyDocument(bodyDocumentJson, 8000)}
        </pre>
      )}

      <button
        type="button"
        onClick={() => setShowSource((v) => !v)}
        className="mt-2 text-xs text-muted underline"
      >
        {showSource ? "Hide source" : "View source (JSON)"}
      </button>
      {showSource ? (
        <pre className="mt-2 max-h-[20rem] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface-muted p-3 text-xs text-muted">
          {bodyDocumentJson}
        </pre>
      ) : null}
    </div>
  );
}
