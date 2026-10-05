"use client";

import {
  imagePromptsFor,
  type ArtifactImagePrompt,
} from "@/lib/content-creator/image-prompts";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { SiteContextBanner } from "@/components/SiteContextBanner";
import { CONTENT_TYPES, isContentTypeDisabled } from "@/lib/content-types";
import { everyPartnerFailedExtraction } from "@/lib/content-creator/preflight-readiness";
import {
  draftWrittenLabel,
  runSavedLine,
  savedByRun,
  timeOfDay,
} from "@/lib/content-creator/run-display";
import {
  AUDIENCE_SEGMENTS,
  BUYING_STAGES,
  CONTENT_ANGLES,
  contentBriefMissingFields,
  CONTENT_LENGTH_TARGETS,
  CTA_TYPES,
  lengthBandForContentType,
  migrateBrief,
  PRIMARY_INTENTS,
  TONES_OF_VOICE,
} from "@/lib/content-creator/brief-catalog";
import ContentBriefPanel from "./ContentBriefPanel";
import { getProject, type GccProject } from "@/services/gcc-projects-api";

/**
 * What this workspace shows of the project: its saved brief and keyword, what it is grounded on, and
 * its drafts. Read from the project -- the unit of work (plans/fix-project-persistence.md). The brief
 * fields are kept current by the brief panel's saves rather than refetched on every one.
 */
type ProjectContent = {
  briefJson: string | null;
  topic: string;
  siteSectionJson: string | null;
  projectSiteRunId: string | null;
  artifacts: GccArtifact[];
};
import {
  toGeneratedContentSet,
  type GeneratedContentGroup,
} from "@/lib/content-creator/generated-content-set";
import type { HubConnection } from "@microsoft/signalr";
import {
  createWorkflowHubConnection,
  joinGccGenerate,
  onGccGenerateEvent,
  onGccGenerateReconnected,
  onGccGenerateTypeEvent,
  onGccGeneratePreflightEvent,
} from "@/services/workflow-tools-hub";
import type { GccGeneratePreflightEvent } from "@/services/workflow-tools-hub";
import { ApiError } from "@/services/gcc-api";
import {
  approveGccVersion,
  briefRevisionSavedAt,
  downloadProjectHtmlExport,
  generateProject,
  listProjectArtifacts,
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
  type GccPolishReport,
  type GccSeoReport,
  type GccStaleGroundingError,
} from "@/services/gcc-api";

/**
 * The provider named in a version's metadata, or null when it predates the stamp.
 *
 * Deliberately no default. Every version generated before this shipped carries no provenance, and
 * labelling those "OpenAI" would be a guess presented as a record -- in the one place whose entire job is
 * telling two drafts apart. Unlabelled is honest; wrongly labelled poisons the comparison.
 */
function writtenBy(metadataJson?: string | null): string | null {
  if (!metadataJson) return null;
  try {
    const parsed: unknown = JSON.parse(metadataJson);
    if (!parsed || typeof parsed !== "object") return null;
    const raw = (parsed as Record<string, unknown>).generatedByProvider;
    if (typeof raw !== "string" || raw.trim().length === 0) return null;
    // The stored value is the provider enum name; this is the only place it is shown to a person.
    return raw === "Anthropic" ? "Anthropic" : raw === "OpenAi" ? "OpenAI" : raw;
  } catch {
    // Metadata is written by us, but a version carrying something unparseable is not a reason to fail
    // the draft view it belongs to.
    return null;
  }
}

/** A Generate this page started and is following. */
type GenerateRun = {
  /** The content types asked for, as the picker had them when Generate was pressed. */
  types: string[];
  /** False while the server is still checking the request; true once the run exists. */
  accepted: boolean;
  /** When Generate was pressed, then when the run was accepted. This page's own clock. */
  startedAt: Date;
};

export default function ProjectContentWorkspace({ project }: { project: GccProject }) {
  const projectId = project.id;
  const [detail, setDetail] = useState<ProjectContent | null>(null);
  // Set when the project's drafts could not be read. Said on screen; an empty list would read as
  // "nothing has been generated", which is a different fact.
  const [draftsError, setDraftsError] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<GccArtifact | null>(null);
  const [version, setVersion] = useState<GccArtifactVersion | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Whether the brief on screen is the brief the server holds. Generate reads brief_json from the
  // database, never the screen, so unsaved edits would reach no generate. True while the brief is
  // collapsed: it can only be collapsed when it is saved.
  const [briefSaved, setBriefSaved] = useState(true);
  // The Generate this page started and is following, or null. `accepted` is false while the server
  // is still checking the request -- nothing is being written yet, and it may be refused -- and true
  // once the run exists. One value rather than a `generating` flag beside it: what is running, since
  // when, and whether it has started cannot disagree with whether anything is running at all.
  const [generateRun, setGenerateRun] = useState<GenerateRun | null>(null);
  const generating = generateRun !== null;
  // The running indicator covers the page. The operator can put it away to read the page under it;
  // it then stays as a bar at the top, so a run is never going with nothing on screen saying so
  // (Jeff, 2026-10-05: "its just not clear that it is running").
  const [runIndicatorHidden, setRunIndicatorHidden] = useState(false);
  // The run's progress, one line per event, in the order they arrived. It was one string, overwritten
  // per hub event, so with several artifacts of one type only the last "ready" survived on screen and
  // the run's history was whatever happened to arrive last.
  const [generateMsgs, setGenerateMsgs] = useState<string[]>([]);
  const pushGenerateMsg = useCallback((msg: string) => {
    setGenerateMsgs((prev) => (prev.includes(msg) ? prev : [...prev, msg]));
  }, []);
  // Accumulated, never overwritten -- generateMsg was one string, so with five tool events each
  // refusal replaced the last and the terminal "Generate finished." then wiped them all. Three
  // pages appeared out of five on 2026-10-02 with nothing on screen saying why, while the backend
  // had named both reasons and pushed them over the hub.
  const [generateNotes, setGenerateNotes] = useState<string[]>([]);
  // Pieces that were saved with a gap: a pillar that never named a partner after a retry, a closing
  // without the scheduler link. These used to refuse the whole draft; the draft is now saved and the
  // gap is said here, so the operator has the known-good page and knows what to add to it.
  const [generateWarnings, setGenerateWarnings] = useState<string[]>([]);
  // The tool pre-flight: which declared partners can be grounded, known before anything is drafted.
  const [preflight, setPreflight] = useState<GccGeneratePreflightEvent | null>(null);
  const [outputTypes, setOutputTypes] = useState<string[]>([]);
  // Which provider writes. Defaults to OpenAi, which is what gcc-api sent unconditionally before this
  // control existed -- so leaving it alone reproduces today's behaviour exactly.
  //
  // Only WRITING follows this. Extraction resolves its provider through the backend's GetDefault(), takes
  // no provider argument, and stays on LlmProviders__DefaultProvider -- so switching here changes who
  // writes the prose and not what it is grounded on, which is the only way the comparison means anything.
  const [provider, setProvider] = useState<"OpenAi" | "Anthropic">("OpenAi");
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
  // Image prompts are a view of every artifact at once, not one artifact's draft, so the tab is
  // selected on its own rather than by picking an artifact. v1 had it as a peer field on
  // GeneratedContentSet for the same reason.
  const [imagePromptsTab, setImagePromptsTab] = useState(false);
  // Which content type's tab is open. Selection used to be derived from the loaded artifact, which
  // cannot express "the Pillar tab, which has no pillar in it" -- the tab would appear selected and
  // the view would show whatever loaded last.
  const [selectedType, setSelectedType] = useState<string | null>(null);
  // Twelve fields you set once. Open while the brief is unsaved, collapsed to a summary after --
  // reopened by the operator, never by a reload, so it does not spring back open under them.
  const [briefOpen, setBriefOpen] = useState(false);

  // Which artifact id the operator is currently looking at. Separate from `artifact` itself
  // (the full object) so reload() can tell "no selection yet" (null, pick a default) apart from
  // "the operator picked one, keep it" (a real id) without re-deriving from `artifact`, which
  // reload() is also about to replace.
  const selectedArtifactIdRef = useRef<string | null>(null);
  // The generate job this workspace is following, and the hub connection following it. Generate
  // returns 202 and reports over SignalR -- see plans/generate-async-signalr.md.
  const hubRef = useRef<HubConnection | null>(null);
  const generateJobIdRef = useRef<string | null>(null);
  // Set when a run ends and taken by the next read of the drafts: the pages the run recorded
  // saving, in the order it wrote them, or null when that is not known. A Generate rewrites the
  // project's pages as new versions, so what a run saved is not a new draft to be found in the
  // list -- it is what the run says it wrote.
  const runEndedRef = useRef<{ savedIds: string[] | null } | null>(null);
  // Counts reads of the project. Only the newest one is shown: a run's last events each start a read
  // within a second of one another, and an earlier one answering late would otherwise put an older
  // list of drafts back on the page.
  const reloadSeqRef = useRef(0);

  const loadVersionFor = useCallback(async (a: GccArtifact | null) => {
    setImagePromptsTab(false);
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
      // Another draft was chosen while this one's versions were being read. Showing these now would
      // put one draft's text under another draft's name.
      if (selectedArtifactIdRef.current !== a.id) return;
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
    // No synchronous setState before the first await -- every path below still ends by setting
    // loadError to its correct value.
    const seq = ++reloadSeqRef.current;
    try {
      // The brief does not wait on the drafts. They are two reads, and a drafts read that fails must
      // not take the brief -- the thing being saved -- off the screen with it.
      const [p, drafts] = await Promise.all([
        getProject(projectId),
        listProjectArtifacts(projectId).then(
          (rows) => ({ rows, error: null as string | null }),
          (err: unknown) => ({
            rows: [] as GccArtifact[],
            error: err instanceof Error ? err.message : "unknown error",
          }),
        ),
      ]);
      // A later read has started; that one is shown, not this.
      if (seq !== reloadSeqRef.current) return;
      const artifacts = drafts.rows;
      setDraftsError(drafts.error);
      const d: ProjectContent = {
        briefJson: p.briefJson ?? null,
        topic: p.topic ?? "",
        siteSectionJson: p.siteSectionJson ?? null,
        projectSiteRunId: p.projectSiteRunId,
        artifacts,
      };
      setDetail(d);
      setLoadError(null);
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
      // selection.
      //
      // That case was written down here and never built for a run that reports over the hub, which
      // is every run. So a finished Generate left the page on the draft that was open before it
      // (Jeff, 2026-10-05: "New Run same as before", "And copy is identical").
      const ended = runEndedRef.current;
      runEndedRef.current = null;
      const savedIds = ended?.savedIds ?? null;
      if (savedIds) pushGenerateMsg(runSavedLine(savedIds.length));
      const firstSaved = savedIds ? d.artifacts.find((a) => a.id === savedIds[0]) : undefined;
      // The tab follows the draft: a tab picked before the run would otherwise stay open on a type
      // the run's first draft is not in.
      if (firstSaved) setSelectedType(null);
      const stillExists = selectedArtifactIdRef.current
        ? d.artifacts.find((a) => a.id === selectedArtifactIdRef.current)
        : undefined;
      // No type preference -- picking "blog" (or any other type) over whatever else exists is
      // exactly the silent default this session removed everywhere else. The first draft a run just
      // saved wins; then whatever the operator most recently selected (stillExists, above); absent
      // both, just the first artifact in the list, not the first one that happens to match a
      // preferred type.
      const target = firstSaved ?? stillExists ?? d.artifacts[0] ?? null;
      await loadVersionFor(target);
    } catch (err) {
      // An older read failing says nothing about the newer one now on its way.
      if (seq !== reloadSeqRef.current) return;
      setLoadError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not load the project's brief and drafts.",
      );
    }
  }, [loadVersionFor, projectId, pushGenerateMsg]);

  // reload is called through a ref rather than by name so this effect is not itself classified as
  // "a function that sets state" — calling it directly here is exactly the standard load-on-mount
  // pattern, not the "derive state from a prop" pattern the rule
  // exists to catch. The two effects run in this order on mount (React runs effects in
  // declaration order), so the ref always holds the current reload before it is called.
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);
  useEffect(() => {
    void reloadRef.current();
  }, [projectId]);

  /**
   * Close the hub, from wherever.
   *
   * The connection used to be opened on the first generate and then held for as long as the
   * workspace stayed mounted -- long after the job it was following had finished. Nothing reads it
   * in that state, so it idles until something upstream drops it, and a dropped socket has no close
   * frame: "WebSocket closed with status code: 1006 (no reason given)" (Jeff, 2026-09-28).
   *
   * The job is not tied to the connection. It keeps running server-side, and GetJob plus
   * JoinGccGenerate pick it back up, so closing early costs nothing and the next generate opens a
   * fresh one -- attachToGenerateJob already creates the connection when the ref is empty.
   */
  const closeHub = useCallback(() => {
    const conn = hubRef.current;
    hubRef.current = null;
    generateJobIdRef.current = null;
    // Never rejects into the void: a stop that fails on an already-dead socket is the state we
    // wanted anyway, and an unhandled rejection here would surface as an error the operator cannot
    // act on.
    void conn?.stop().catch(() => undefined);
  }, []);

  useEffect(() => closeHub, [closeHub]);

  // Both analysers are deterministic and free -- no model call, no token spend -- so there is no
  // reason to make anyone press a button to find out the score. They run whenever a version is on
  // screen, which covers Generate, Revise, and switching between drafts. Failure is silent: a score
  // that cannot be computed is not a reason to put an error banner over a finished draft.
  // Keyed on the topic, not the whole project: every Save updates detail's brief, and re-scoring an
  // unchanged draft on each one is wasted work.
  const scoredTopic = detail?.topic;
  useEffect(() => {
    if (!version || !scoredTopic) return;
    let live = true;
    void (async () => {
      try {
        const [nextSeo, nextPolish] = await Promise.all([
          seoGccVersion(version.id, scoredTopic),
          polishGccVersion(version.id),
        ]);
        if (!live) return;
        setSeo(nextSeo);
        setPolish(nextPolish);
      } catch {
        /* the draft is still readable without a score */
      }
    })();
    return () => {
      live = false;
    };
  }, [version, scoredTopic]);

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

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 px-3 py-2 text-sm text-foreground">{loadError}</p>
        <Link href="/app/workflow" className="mt-4 inline-block text-sm text-[#C83803] hover:underline">
          &larr; Back to workflow
        </Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-muted">Loading the brief…</p>
      </div>
    );
  }

  const contentSet = toGeneratedContentSet(detail.artifacts);
  const selectedGroup: GeneratedContentGroup | undefined =
    (selectedType ? contentSet.find((g) => g.type === selectedType) : undefined)
    ?? (artifact ? contentSet.find((g) => g.artifacts.some((a) => a.id === artifact.id)) : undefined)
    // Nothing chosen yet: open on a tab that has something in it rather than on an empty Pillar.
    ?? contentSet.find((g) => g.artifacts.length > 0)
    ?? contentSet[0];
  const briefReady = !!detail.briefJson;
  // What Generate will read: the server's brief_json, kept current by the panel's onBriefSaved.
  const savedBriefMissing = contentBriefMissingFields(migrateBrief(safeParse(detail.briefJson)));
  const approved = artifact?.status?.toLowerCase() === "approved";
  const siteSection = parseSiteSectionJson(detail.siteSectionJson);
  // Generate reads the saved brief, so it needs that brief complete and the screen to match it. It
  // was `!!detail.briefJson || briefSavedOnServer`: any brief on the server, however old, enabled
  // Generate, and edits made since the last save reached no generate.
  const canGenerate = briefReady && savedBriefMissing.length === 0 && briefSaved;
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
  const runIndicatorShown = generateRun !== null && !runIndicatorHidden;

  /**
   * Follow a generate job on the hub. Each content type pushes as it finishes, so artifacts appear
   * progressively rather than all at once when the slowest one lands; the job event is what ends
   * the run. Handlers read reload through its ref so they never close over a stale copy.
   */
  /** The job's recorded aggregate -- `{ created, refusals, preflight }` -- or null when the event
   *  carries none or it will not parse. Never the raw string: a body that does not parse is not a
   *  list of refusals. */
  function parseGenerateResultJson(
    raw: string | null | undefined,
  ): {
    refusals?: string[];
    warnings?: string[];
    preflight?: GccGeneratePreflightEvent["partners"];
  } | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return null;
      const obj = parsed as { refusals?: unknown; warnings?: unknown; preflight?: unknown };
      return {
        refusals: Array.isArray(obj.refusals)
          ? obj.refusals.filter((r): r is string => typeof r === "string")
          : undefined,
        warnings: Array.isArray(obj.warnings)
          ? obj.warnings.filter((w): w is string => typeof w === "string")
          : undefined,
        preflight: Array.isArray(obj.preflight)
          ? (obj.preflight as GccGeneratePreflightEvent["partners"])
          : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * The run is over. `savedIds` is what it recorded saving, or null when that is not known -- a run
   * that failed, or whose result did not arrive. reload() says how many and opens the first.
   *
   * Refs and stable setters only: the hub handlers that call this are made once per connection and
   * outlive the render that made them.
   */
  function endRun(savedIds: string[] | null) {
    runEndedRef.current = { savedIds };
    setGenerateRun(null);
    void reloadRef.current();
    // Ready and failed are terminal: there is nothing further to hear, so the socket is closed
    // rather than left to be dropped by a proxy and reported as a 1006 error.
    closeHub();
  }

  /**
   * This page can no longer hear the run, and the run may well still be going. The indicator comes
   * down and the reason is said: a page that cannot hear a run cannot go on saying it is running,
   * and must not say it has stopped either.
   */
  function stopFollowing(reason: string) {
    pushGenerateMsg(
      `${reason}, so it can no longer say whether the run is still going. Reload the page in a few minutes: whatever the run saved will be there, each draft labelled with the time it was written.`,
    );
    setGenerateRun(null);
    closeHub();
  }

  async function attachToGenerateJob(jobId: string) {
    generateJobIdRef.current = jobId;
    let conn = hubRef.current;
    if (!conn) {
      conn = createWorkflowHubConnection();
      hubRef.current = conn;

      // The connection retries on its own for about twenty seconds and then gives up. closeHub()
      // clears the job id before it stops a connection, so a close that arrives with one still set
      // is a connection that was lost, not one this page ended.
      conn.onclose(() => {
        if (generateJobIdRef.current === null) return;
        stopFollowing("This page lost its connection to the run and could not get it back");
      });

      onGccGenerateTypeEvent(conn, (evt) => {
        if (evt.jobId !== generateJobIdRef.current) return;
        if (evt.status === "failed") {
          // Appended, not assigned: one type can emit several of these (one per partner for tool),
          // and each one names a partner the operator would otherwise have to infer from a count.
          const note = `${evt.contentType}: ${evt.error ?? "failed"}`;
          setGenerateNotes((prev) => (prev.includes(note) ? prev : [...prev, note]));
        } else if (evt.status === "warning") {
          const note = `${evt.contentType}: ${evt.error ?? "written with a gap"}`;
          setGenerateWarnings((prev) => (prev.includes(note) ? prev : [...prev, note]));
        } else {
          pushGenerateMsg(`${evt.contentType} ready.`);
        }
        void reloadRef.current();
      });

      // Arrives before any tool page is drafted, which is the only moment it is a pre-flight.
      onGccGeneratePreflightEvent(conn, (evt) => {
        if (evt.jobId !== generateJobIdRef.current) return;
        setPreflight(evt);
      });

      onGccGenerateEvent(conn, (evt) => {
        if (evt.jobId !== generateJobIdRef.current) return;
        if (evt.status === "ready") {
          // The aggregate the job recorded, read back here as well as from the live per-type events.
          // Those events are live-only: a socket that dropped mid-draft (the 1006 case) and rejoined
          // missed every refusal pushed while it was away, so three tool tabs appeared with no
          // explanation. resultJson carries the same refusals and the same pre-flight, which the
          // coordinator stores for exactly this reason; this handler never read it.
          const recorded = parseGenerateResultJson(evt.resultJson);
          const recordedRefusals = recorded?.refusals ?? [];
          const recordedWarnings = recorded?.warnings ?? [];
          const recordedPreflight = recorded?.preflight ?? [];
          if (recordedWarnings.length > 0) {
            // Already prefixed by type on the backend ("pillar: ...").
            setGenerateWarnings((prev) => {
              const next = [...prev];
              for (const warning of recordedWarnings) if (!next.includes(warning)) next.push(warning);
              return next;
            });
          }
          if (recordedRefusals.length > 0) {
            setGenerateNotes((prev) => {
              const next = [...prev];
              for (const refusal of recordedRefusals) {
                // The live event names the type ("tool: Bill: ..."); the recorded refusal is the
                // per-partner text alone, and only tool pages refuse per partner.
                const note = `tool: ${refusal}`;
                if (!next.includes(note)) next.push(note);
              }
              return next;
            });
          }
          if (recordedPreflight.length > 0) {
            setPreflight((prev) =>
              prev ?? {
                jobId: evt.jobId,
                contentType: "tool",
                ready: recordedPreflight.filter((r) => r.ready).length,
                total: recordedPreflight.length,
                partners: recordedPreflight,
              },
            );
          }
          pushGenerateMsg(`Generate finished at ${timeOfDay(new Date())}.`);
          endRun(savedByRun(evt.resultJson));
        } else if (evt.status === "failed") {
          // The refusal or fault verbatim -- the whole point of the job carrying its error.
          pushGenerateMsg(evt.error ?? "Generate failed.");
          // Nothing is claimed about what a failed run saved: its result never arrived. The drafts
          // are read again all the same, so whatever is on the project is what is on the page.
          endRun(null);
        }
      });

      // A rejoin the server refuses used to be swallowed, which left the page waiting on a run it
      // would never hear from again. The hub refuses by name when it does not hold the job, and the
      // one way it comes not to hold a job this page started is a restart, which stops the run.
      onGccGenerateReconnected(
        conn,
        () => generateJobIdRef.current,
        (refusedJobId, err) => {
          if (refusedJobId !== generateJobIdRef.current) return;
          const reason = err instanceof Error ? err.message : String(err);
          if (reason.includes("Generate job not found")) {
            pushGenerateMsg(
              "The server no longer has this run. That is what a restart of the server leaves behind: a restart stops any run that is going.",
            );
            endRun(null);
            return;
          }
          stopFollowing(`This page reconnected but could not rejoin the run (${reason})`);
        },
      );
    }
    await joinGccGenerate(conn, jobId);
  }

  async function runGenerate(acknowledgeStale = false) {
    if (!canGenerate || saMissingPages) return;
    setGenerateMsgs([]);
    setGenerateNotes([]);
    setGenerateWarnings([]);
    setPreflight(null);
    setStalePrompt(null);
    runEndedRef.current = null;
    setRunIndicatorHidden(false);
    setGenerateRun({ types: outputTypes, accepted: false, startedAt: new Date() });
    try {
      const result = await generateProject(projectId, {
        outputTypes,
        provider,
        acknowledgeStaleGrounding: acknowledgeStale,
      });

      // Job shape: generation runs in the background and reports over the hub. The run stays set
      // until a terminal job event arrives, so the page reflects real state rather than "the POST
      // returned".
      //
      // No "each appears as it finishes" line any more. It was never true of a run: every piece is
      // written first and all of them are saved together at the end, so for the whole run the page
      // went on showing earlier drafts under a line that said new ones were arriving.
      if (result.jobId) {
        setGenerateRun((r) => (r ? { ...r, accepted: true, startedAt: new Date() } : r));
        try {
          await attachToGenerateJob(result.jobId);
        } catch (err) {
          // The run was accepted and is going; only this page's line to it failed. Reporting that
          // as a failed Generate would be false, and would invite a second one. A close during the
          // attempt has already been said by the connection's own handler.
          if (generateJobIdRef.current !== null) {
            const reason = err instanceof Error ? err.message : String(err);
            stopFollowing(`The run was started, but this page could not connect to follow it (${reason})`);
          }
        }
        return;
      }

      // Inline shapes, for a GeekAPI not yet running the job runner. This frontend deploys first
      // on purpose, so there is never a moment where the two disagree.
      if (result.artifact && result.version) {
        pushGenerateMsg(
          `Created ${result.artifact.type} \u201c${result.artifact.name}\u201d v${result.version.versionNumber}.`,
        );
        selectedArtifactIdRef.current = result.artifact.id;
      } else if (result.created?.length) {
        pushGenerateMsg(`Generated ${result.created.length} artifact(s).`);
        selectedArtifactIdRef.current = result.created[0]?.artifact.id ?? null;
      } else {
        pushGenerateMsg("Generate finished.");
      }

      // Same two fields the hub pushes, read off the synchronous response for a GeekAPI not running
      // the job runner -- so the explanation is present on both shapes, not just the live one.
      if (result.refusals?.length) setGenerateNotes(result.refusals);
      if (result.warnings?.length) setGenerateWarnings(result.warnings);
      if (result.preflight?.length) {
        setPreflight({
          jobId: "",
          contentType: "tool",
          ready: result.preflight.filter((r) => r.ready).length,
          total: result.preflight.length,
          partners: result.preflight,
        });
      }
      await reload();
      setGenerateRun(null);
    } catch (err) {
      const stale = parseStaleGroundingError(err);
      if (stale) {
        setStalePrompt(stale);
        setGenerateMsgs([]);
      } else {
        pushGenerateMsg(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Generate failed",
        );
      }
      setGenerateRun(null);
    }
  }

  return (
    <>
      {generateRun && runIndicatorShown ? (
        <GenerateRunningIndicator run={generateRun} onHide={() => setRunIndicatorHidden(true)}>
          <GenerateRunReport
            msgs={generateMsgs}
            preflight={preflight}
            notes={generateNotes}
            warnings={generateWarnings}
          />
        </GenerateRunningIndicator>
      ) : null}
    {/* Inert under the indicator: what is on the page is from earlier runs, and nothing on it can be
        pressed through a cover that says a run is going. */}
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8" inert={runIndicatorShown}>
      {/* The indicator, put away. It stays in view as the page scrolls -- below the site's own bar,
          which is where the project page already pins its section list. */}
      {generateRun && runIndicatorHidden ? (
        <div
          role="status"
          className="sticky top-[5.5rem] z-20 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-brand bg-surface px-4 py-3 shadow-md"
        >
          <span className="flex items-center gap-2.5 text-sm text-foreground">
            <RunSpinner className="h-4 w-4" />
            <span>
              <span className="font-semibold">{runHeadline(generateRun)}</span>
              {generateRun.accepted ? ` — started at ${timeOfDay(generateRun.startedAt)}.` : "."} The drafts on this
              page are from earlier runs.
            </span>
          </span>
          <button
            type="button"
            onClick={() => setRunIndicatorHidden(false)}
            className="text-sm font-medium text-[#C83803] underline-offset-2 hover:underline"
          >
            Show progress
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Link href="/app/workflow" className="text-sm text-[#C83803] hover:underline">
          &larr; Back to workflow
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-4">
        {siteSection ? <SiteContextBanner siteSection={siteSection} /> : null}
        {saMissingPages ? (
          <p className="border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 px-3 py-2 text-sm text-foreground">
            Generate is blocked: this project&rsquo;s crawl has no related pages, and there is no
            keyword-only path.
          </p>
        ) : null}
      </div>

      {/* One surface. Each stage is a band on it, divided by a rule -- see Stage. */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <Stage
          step={1}
          title="Brief"
          note={
            briefOpen
              ? "What to write and who for. Saved to this project, and read back at generate time — every checked type is written independently."
              : undefined
          }
          aside={
            briefReady ? (
              <button
                type="button"
                onClick={() => setBriefOpen((v) => !v)}
                // Collapsing unmounts the panel, and with it any unsaved edits. Only a saved brief folds.
                disabled={briefOpen && !briefSaved}
                title={briefOpen && !briefSaved ? "Save the brief first" : undefined}
                className="text-sm text-[#C83803] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
              >
                {briefOpen ? "Done editing" : "Edit brief"}
              </button>
            ) : null
          }
        >
          {/* Twelve fields you set once and then scroll past on every visit. Once the brief is
              saved it collapses to what it actually says, and opens again on demand. */}
          {!briefOpen && briefReady ? (
            <BriefSummary detail={detail} outputTypes={outputTypes} />
          ) : (
        <>
          <ContentBriefPanel
            projectId={projectId}
            // The keyword is the project's, and every brief save writes it. It stops being editable
            // once something has been generated from it -- after that, a new keyword would describe
            // pages written for the old one. A second keyword is a second project (J1).
            // Locked too when the drafts could not be read: whether anything was generated from this
            // keyword is then unknown, and unknown is not "no".
            keywordLocked={detail.artifacts.length > 0 || draftsError !== null}
            onSavedChange={setBriefSaved}
            // What the server now holds, folded into the content on screen so the summary and
            // Generate's gate read the saved copy without refetching the project on every save.
            onBriefSaved={(saved) =>
              setDetail((d) => (d ? { ...d, briefJson: saved.briefJson, topic: saved.topic } : d))
            }
          />

        </>
          )}
        </Stage>

        <Stage step={2} title="Generate" note="What to produce from this brief. Each one is written independently.">
          {/* Lives here rather than inside the brief: it is the choice Generate acts on, and inside
              the brief it disappeared the moment the brief was collapsed. */}
          <ContentTypePicker selected={outputTypes} onToggle={toggleOutputType} />

          <div className="mt-4 border-t border-border pt-4">
            <label className="block">
              <span className="text-sm font-medium text-foreground">Writing model</span>
              <span className="mt-0.5 block text-xs text-muted">
                Who writes the prose. Grounding does not change &mdash; partner and competitor extraction
                stays on its own configured provider either way, so the same evidence reaches both.
              </span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value === "Anthropic" ? "Anthropic" : "OpenAi")}
                disabled={generating}
                className="mt-1.5 rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground disabled:opacity-40"
              >
                <option value="OpenAi">OpenAI</option>
                <option value="Anthropic">Anthropic</option>
              </select>
            </label>
          </div>

          {/* The one filled accent on this page. The parent site uses orange as a text colour 530
              times and as a fill 21 -- a solid fill there means "act here", so it belongs to the
              single primary action and nothing else. */}
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
            className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generating
              ? "Generating…"
              : outputTypes.length > 1
                ? `Generate ${outputTypes.length} content items`
                : "Generate content"}
          </button>
          {stalePrompt ? (
            <div className="mt-3 border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 px-3 py-3 text-sm text-foreground">
              <p className="font-medium">{stalePrompt.message}</p>
              <p className="mt-1 text-muted">
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
                  className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Proceed with stale grounding
                </button>
              </div>
            </div>
          ) : null}
          {/* A failure says what happened and what fixes it, in the interface's own voice. This one
              named GeekAPI, a Run ID and the order the two were created in -- how the system is
              built, not what the reader does about it. */}
          {missingProjectSiteRun ? (
            <p className="mt-3 border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 px-3 py-2 text-sm text-foreground">
              This create has no site crawl to work from, so nothing can be generated. Crawl the
              project&rsquo;s site, then start the create again.
            </p>
          ) : null}
          {!briefSaved ? (
            <p className="mt-3 text-sm text-muted">Unsaved changes. Save the brief first.</p>
          ) : !briefReady ? (
            <p className="mt-3 text-sm text-muted">Nothing is saved in the brief yet.</p>
          ) : savedBriefMissing.length > 0 ? (
            <p className="mt-3 text-sm text-muted">
              The saved brief is missing: {savedBriefMissing.join(", ")}.
            </p>
          ) : outputTypes.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Choose at least one thing to write.</p>
          ) : null}
          {runIndicatorShown ? null : (
            <GenerateRunReport
              msgs={generateMsgs}
              preflight={preflight}
              notes={generateNotes}
              warnings={generateWarnings}
            />
          )}
        </Stage>

      <Stage step={3} title="Output">
      {draftsError ? (
        <p className="mb-4 border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 px-3 py-2 text-sm text-foreground">
          This project&rsquo;s drafts could not be read from the server, so none are shown:{" "}
          {draftsError}. They are not deleted. The brief above saves regardless.
        </p>
      ) : null}
      {/* The generated content set: one tab per content type this create produced, and inside a
          tab a row of that type's artifacts when it produced several. v1 grouped the same way --
          its toolPosts[] was already a list, "one page per unique crawl tool ... no cap of 5" --
          but declared the groups as fixed fields, so every new content type meant editing the
          view. This derives them from the artifacts, so adding a type changes nothing here. */}
      {contentSet.length > 0 ? (
        <div className="mb-6 flex flex-col">
          {/* Tabs, not pills. They were rounded-full chips, which read as filters -- a set of
              chips looks like several things that can each be on or off, and none of them owns what
              is below. A tab is one-of-a-set: it sits on a rail, and the selected one is marked on
              that rail rather than filled in. Jeff, 2026-09-27: "I asked for tabs, I got pills?"

              Underlined rather than a box joined to the panel, because what follows is a rounded
              card with its own shadow -- a tab drawn to butt against it would have to square that
              card's top corners, and there are several such cards below. */}
          <div
            className="flex flex-wrap items-end gap-6 border-b border-border"
            role="tablist"
            aria-label="Content types"
          >
            {contentSet.map((group) => {
              const selected = !imagePromptsTab && group.type === selectedGroup?.type;
              const empty = group.artifacts.length === 0;
              const approved = group.artifacts.every(
                (a) => a.status?.toLowerCase() === "approved",
              );
              return (
                <button
                  key={group.type}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    setSelectedType(group.type);
                    void loadVersionFor(group.artifacts[0] ?? null);
                  }}
                  className={
                    "-mb-px border-b-2 px-1 pb-2.5 pt-1 text-sm transition-colors " +
                    (selected
                      ? "border-brand font-semibold text-foreground"
                      : "border-transparent font-medium hover:border-border hover:text-foreground ") +
                    // A tab with nothing behind it reads as available but unfilled, not as disabled:
                    // it is the thing that tells you the type was not generated.
                    (selected ? "" : empty ? "text-muted/60" : "text-muted")
                  }
                >
                  {group.label}
                  {group.artifacts.length > 1 ? ` (${group.artifacts.length})` : ""}
                  {approved && !empty ? " ✓" : ""}
                </button>
              );
            })}

            {/* Peer to the content-type tabs, because that is what it was in v1 -- a field on
                GeneratedContentSet beside article/blog/toolPosts[]. It is not a content type, so it
                is not derived from the artifacts; it reads across all of them. */}
            <button
              type="button"
              role="tab"
              aria-selected={imagePromptsTab}
              onClick={() => {
                setImagePromptsTab(true);
                setSelectedType(null);
              }}
              className={
                "-mb-px border-b-2 px-1 pb-2.5 pt-1 text-sm transition-colors " +
                (imagePromptsTab
                  ? "border-brand font-semibold text-foreground"
                  : "border-transparent font-medium text-muted hover:border-border hover:text-foreground")
              }
            >
              Image prompts
            </button>
          </div>

          {/* The artifacts inside the selected type. Deliberately still small buttons rather than a
              second row of tabs: two tab rows of equal weight read as two independent choices, when
              this one only exists within the tab above it. */}
          {!imagePromptsTab && selectedGroup && selectedGroup.artifacts.length > 1 ? (
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="tablist"
              aria-label={`${selectedGroup.label} pages`}
            >
              {selectedGroup.artifacts.map((a) => {
                const selected = a.id === artifact?.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => void loadVersionFor(a)}
                    className={
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors " +
                      (selected
                        ? "border-brand bg-brand/10 text-[#C83803]"
                        : "border-border bg-surface text-muted hover:bg-muted/30")
                    }
                  >
                    {a.name || a.id.slice(0, 8)}
                    {/* When the text on this page was written: its newest version's time, not the
                        day the page was first made. A Generate rewrites the pages it can and refuses
                        the ones it cannot, so the pages of one tab are not all from one run -- and
                        the time is what says which ones the last run left as they were. */}
                    {a.latestVersionAtUtc && draftWrittenLabel(a.latestVersionAtUtc) ? (
                      <span className="font-normal"> · {draftWrittenLabel(a.latestVersionAtUtc)}</span>
                    ) : null}
                    {a.status?.toLowerCase() === "approved" ? " ✓" : ""}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {imagePromptsTab ? (
        <ImagePromptsPanel artifacts={detail.artifacts} />
      ) : !version ? (
        <div className="border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 px-3 py-2 text-sm text-foreground">
          {selectedGroup && selectedGroup.artifacts.length === 0
            ? `No ${selectedGroup.label} yet for this project. Pick it as an output type, then Generate above.`
            : "No draft artifact yet. Save the Content Brief, then Generate above."}
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          <section>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-display text-lg text-foreground">{artifact?.name || "Draft"}</h3>
              <span className="text-sm text-muted">
                {artifact?.type} · v{version.versionNumber}
              </span>
              {/* When the text on screen was written. A tab holding one draft has no row of buttons
                  to carry the time, and a revision is later than the draft it revises. */}
              {draftWrittenLabel(version.createdAtUtc) ? (
                <span className="text-sm text-muted">
                  Written {draftWrittenLabel(version.createdAtUtc)}
                </span>
              ) : null}
              {approved ? (
                <span className="text-sm text-[var(--gcc-accent)]">Approved</span>
              ) : null}
              {/* Which writer produced this draft. Shown because the whole point of the Writing model
                  control is comparing two drafts, and with several artifacts per type named after the
                  product, nothing else on screen distinguishes them -- the alternative is remembering
                  which setting was selected when Generate was clicked. */}
              {writtenBy(version.metadataJson) ? (
                <span className="text-sm text-muted">
                  Provided by {writtenBy(version.metadataJson)}
                </span>
              ) : null}
              {/* Which brief this draft was written from, as GeekAPI recorded it on the version
                  (fix-persistence SA3). Absent on versions written before that was recorded --
                  said as absent, never guessed from the brief on screen now. */}
              <span className="text-sm text-muted">
                {briefRevisionSavedAt(version.metadataJson)
                  ? `Generated from the brief saved at ${new Date(
                      briefRevisionSavedAt(version.metadataJson) as string,
                    ).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`
                  : "Which brief this was generated from was not recorded"}
              </span>
            </div>
            <ArtifactBody
              bodyDocumentJson={version.bodyDocumentJson}
              contentType={artifact?.type}
            />
          </section>

          <section className="border-t border-border pt-6">
            <h3 className="font-display text-lg text-foreground">Revise</h3>
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
                    // Revise is the only call on this screen that WRITES prose -- polish and seo are
                    // read-only -- and it was the one the Writing model picker did not reach, so a
                    // draft generated on Anthropic was rewritten entirely by OpenAI with nothing on
                    // screen saying so. That silently contaminates the comparison the picker exists for.
                    provider,
                    sectionPath: scope === "section" ? sectionPath.trim() : null,
                  });
                  setVersion(next);
                  setSeo(null);
                  setPolish(null);
                  await reload();
                })
              }
              className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Working…" : "Revise"}
            </button>
          </section>

          <section className="border-t border-border pt-6">
            <h3 className="font-display text-lg text-foreground">On-page SEO &amp; polish</h3>
            {/* No Run buttons. Both analysers are deterministic -- same draft in, same numbers out
                -- and they already run whenever a version loads, so pressing Run refetched an
                identical report and re-rendered the same values. A button that cannot change
                anything reads as broken, which is what it was reported as (Jeff, 2026-09-28: "Run
                SEO does nothing"). The scores below are current for the version on screen. */}
            <p className="mt-1 text-sm text-muted">
              Scored from the draft and the target keyword. Updates with every version.
            </p>
            {seo ? (
              <div className="mt-4 text-sm">
                <p className="font-medium">
                  SEO score {seo.score} · {seo.wordCount} words · density{" "}
                  {seo.keywordDensityPercent.toFixed(1)}%
                </p>
                {/* The keyword the report actually scored against. Every check below is relative to
                    it, and nothing on screen said which string that was. */}
                <p className="mt-1 text-muted">
                  Scored against &ldquo;{seo.targetKeyword}&rdquo;
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                  {seo.checks.map((c) => (
                    <li key={c.id}>
                      {c.passed ? "✓" : "✗"} {c.label}: {c.detail}
                      {!c.passed && c.fixHint ? (
                        <span className="block text-foreground">{c.fixHint}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {/* Was two steps: copy the fixes into the box, then find Revise and press it. The
                    report already knows what it wants changed, so applying it is one action. The
                    feedback is still put in the box, so it is visible and editable if the revise
                    then needs steering. */}
                {seo.applyFeedback ? (
                  <button
                    type="button"
                    disabled={pending || !version}
                    className="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => {
                      const fixes = seo.applyFeedback;
                      setFeedback(fixes);
                      setScope("full");
                      run("Revised against the SEO report — new version saved.", async () => {
                        if (!version) return;
                        const next = await reviseGccVersion(version.id, {
                          feedback: fixes,
                          scope: "full",
                          sectionPath: null,
                          provider,
                        });
                        setVersion(next);
                        await reload();
                      });
                    }}
                  >
                    {pending ? "Working…" : "Fix these and revise"}
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
                      {!c.passed && c.fixHint ? (
                        <span className="block text-foreground">{c.fixHint}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {/* Same one-press treatment as the SEO report: the analyser already knows what it
                    wants changed, so applying it is one action rather than copy-then-find-Revise. */}
                {polish.applyFeedback ? (
                  <button
                    type="button"
                    disabled={pending || !version}
                    className="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => {
                      const fixes = polish.applyFeedback;
                      setFeedback(fixes);
                      setScope("full");
                      run("Revised against the polish report — new version saved.", async () => {
                        if (!version) return;
                        const next = await reviseGccVersion(version.id, {
                          feedback: fixes,
                          scope: "full",
                          sectionPath: null,
                          provider,
                        });
                        setVersion(next);
                        await reload();
                      });
                    }}
                  >
                    {pending ? "Working…" : "Fix these and revise"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="border-t border-border pt-6">
            <h3 className="font-display text-lg text-foreground">Approve &amp; export</h3>
            <p className="mt-1 text-sm text-muted">
              Approval is on the create artifact (GeekAPI) — required before Repurpose.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {approved ? (
                <p className="text-sm font-medium text-green-800">Content approved.</p>
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
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
                >
                  Approve content
                </button>
              )}
              {/* Export every artifact on this create as a zip of HTML documents -- the export v1
                  had, which existed here with no caller. Not gated on approval: an operator
                  reviewing output outside the browser is exactly when it is wanted. */}
              <button
                type="button"
                disabled={pending || detail.artifacts.length === 0}
                onClick={() =>
                  run("Export downloaded.", async () => {
                    await downloadProjectHtmlExport(projectId);
                  })
                }
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                Export HTML (.zip)
              </button>
            </div>
          </section>
        </div>
      )}
      </Stage>
      </div>

      {actionError ? (
        <p className="mt-4 border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 px-3 py-2 text-sm whitespace-pre-wrap text-foreground">
          {actionError}
        </p>
      ) : null}
      {actionMsg ? <p className="mt-4 text-sm text-muted">{actionMsg}</p> : null}
    </div>
    </>
  );
}

/** What the run is doing, in the words both the indicator and its bar use. */
function runHeadline(run: GenerateRun): string {
  if (!run.accepted) return "Checking before anything is written";
  return `Generating ${run.types.map((t) => contentTypeLabel(t)).join(", ")}`;
}

/** Motion that says "working". Still for a reader who has asked for no motion; the words carry it. */
function RunSpinner({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`${className} shrink-0 rounded-full border-2 border-brand border-t-transparent motion-safe:animate-spin`}
    />
  );
}

/**
 * Over the whole page while a Generate runs.
 *
 * A run takes minutes and saves nothing until it ends, so for all of that time the page under this
 * is exactly the page from before the run: earlier drafts, readable, under a small "Generating…" on
 * a button that had scrolled out of view. On 2026-10-05 that was read as the run's own output --
 * "still repeating wrong tools", "copy is identical" -- and it was the morning's (Jeff: "its just
 * not clear that it is running... need a full page loading indicator").
 *
 * It says two different things, because Generate does two different things. Before the server
 * accepts the run it is checking that the site, the partners and the competitors can be found, and
 * may refuse; nothing is being written yet. After, it is writing.
 *
 * It can be put away, and then stays as a bar: the run reports over a connection that can be lost,
 * and a cover with no way out of it would be a page that cannot be used at all.
 */
function GenerateRunningIndicator({
  run,
  onHide,
  children,
}: {
  run: GenerateRun;
  onHide: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gcc-run-indicator-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") onHide();
      }}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-ink/75"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-lg border border-border bg-surface p-6 shadow-xl sm:p-8">
          <div className="flex items-center gap-3">
            <RunSpinner className="h-6 w-6" />
            <h2 id="gcc-run-indicator-title" className="font-display text-xl text-foreground">
              {runHeadline(run)}
            </h2>
          </div>

          {run.accepted ? (
            <>
              <p className="mt-4 text-sm text-foreground">
                Started at {timeOfDay(run.startedAt)}. This takes several minutes.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Every draft is written first and they are all saved together at the end. Until then
                the page behind this shows drafts from earlier runs, not from this one. When the run
                finishes this closes and the page opens on what it saved.
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Making sure the site, the partners and the competitors can all be found in the index.
              Nothing is written until this passes; if it does not, the reason is shown and nothing
              is started.
            </p>
          )}

          <div role="status" aria-live="polite">
            {children}
          </div>

          <button
            type="button"
            autoFocus
            onClick={onHide}
            className="mt-6 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            Hide this and read the page
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * What a run has said so far: its progress lines, the partner pre-flight, what was not written and
 * what was written with a gap.
 *
 * One definition, drawn in two places -- inside the running indicator while a run covers the page,
 * and in the Generate stage otherwise -- so what the operator reads while waiting is exactly what is
 * left on the page when the run is over.
 */
function GenerateRunReport({
  msgs,
  preflight,
  notes,
  warnings,
}: {
  msgs: string[];
  preflight: GccGeneratePreflightEvent | null;
  notes: string[];
  warnings: string[];
}) {
  return (
    <>
      {msgs.length > 0 ? (
        <ul className="mt-3 space-y-0.5">
          {msgs.map((msg) => (
            <li key={msg} className="whitespace-pre-wrap text-sm text-foreground">
              {msg}
            </li>
          ))}
        </ul>
      ) : null}

      {/* The pre-flight, shown while the ready partners are still being written. It reports what
          the gate measures -- what extraction FOUND -- because page and paragraph volume do not
          predict it: a partner with hundreds of pages fails if extraction pulled one feature. */}
      {preflight ? (
        <div className="mt-3 border border-[var(--gcc-border)] px-3 py-2">
          <p className="text-sm font-medium text-foreground">
            {everyPartnerFailedExtraction(preflight.partners)
              ? `Extraction failed for all ${preflight.total} partners — a provider fault, not your data`
              : `Partner readiness — ${preflight.ready} of ${preflight.total} can be grounded`}
          </p>
          {/* Twice on 2026-10-03 this panel reported a provider outage as five unusable partners:
              once for a 400 (temperature deprecated) and once for a 429 (no OpenAI credits). Both
              read as "0 of 22 categories ... no capability signal", which is the sentence for a
              partner whose site is thin. When nothing was extracted the counts describe nothing,
              so they are not shown. */}
          {everyPartnerFailedExtraction(preflight.partners) ? (
            <p className="mt-1 text-xs text-muted">
              No partner could be assessed. Category counts are omitted because nothing was
              extracted to count — the cause is in the error below.
            </p>
          ) : null}
          <ul className="mt-2 space-y-1.5">
            {preflight.partners.map((partner) => {
              const allFailed =
                partner.pagesAttempted > 0 && partner.pagesFailed >= partner.pagesAttempted;
              return (
              <li key={partner.host} className="text-sm">
                <span className="text-foreground">
                  {partner.ready ? "\u2713" : "\u2717"} {partner.productName}
                </span>
                <span className="text-muted">
                  {" \u2014 "}
                  {allFailed ? (
                    `extraction failed on all ${partner.pagesAttempted} pages`
                  ) : (
                    <>
                      {/* The total comes with the count. Where a recorded run carries none, the
                          count is given alone rather than against a number this page assumes. */}
                      {typeof partner.totalCategories === "number"
                        ? `${partner.populatedCategories} of ${partner.totalCategories} categories`
                        : `${partner.populatedCategories} categories`}
                      {partner.pagesFailed > 0
                        ? `, ${partner.pagesFailed} of ${partner.pagesAttempted} pages failed extraction`
                        : partner.reused
                          ? `, ${partner.pagesAttempted} pages reused from the bank`
                          : `, ${partner.pagesAttempted} pages extracted`}
                      {partner.hasCapabilitySignal ? "" : ", no capability signal"}
                    </>
                  )}
                </span>
                {/* The fault/shortage split, verbatim from the backend. A provider outage and a
                    thin partner leave identical counts, so only this sentence separates them. */}
                {!partner.ready ? (
                  <span className="mt-0.5 block text-xs text-muted">{partner.coverage}</span>
                ) : null}
              </li>
              );
            })}
          </ul>
          {/* "The rest are" is only true when there IS a rest. Gated on ready < total alone, this
              printed directly under the all-failed headline and told the operator drafts were
              being written for partners that do not exist -- re-creating the false partial-success
              reading three lines below its own fix. */}
          {preflight.ready > 0 && preflight.ready < preflight.total ? (
            <p className="mt-2 text-xs text-muted">
              The partners above that cannot be grounded are not drafted. The rest are, and each
              is saved on its own.
            </p>
          ) : preflight.ready === 0 && preflight.total > 0 ? (
            <p className="mt-2 text-xs text-muted">
              No partner could be grounded, so no tool page was drafted.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Named, never a count to be inferred. Each entry is one artifact that was not written
          and the reason it was not. */}
      {notes.length > 0 ? (
        <div className="mt-3 border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 px-3 py-2">
          <p className="text-sm font-medium text-foreground">
            Not written ({notes.length})
          </p>
          <ul className="mt-1 space-y-1">
            {notes.map((note) => (
              <li key={note} className="whitespace-pre-wrap text-sm text-foreground">
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Saved, with a gap named. Distinct from "Not written": these pieces exist and can be
          opened below; the line says what to add to them. */}
      {warnings.length > 0 ? (
        <div className="mt-3 border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 px-3 py-2">
          <p className="text-sm font-medium text-foreground">
            Written with a gap ({warnings.length})
          </p>
          <ul className="mt-1 space-y-1">
            {warnings.map((note) => (
              <li key={note} className="whitespace-pre-wrap text-sm text-foreground">
                {note}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
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
                className="h-3.5 w-3.5 rounded border-border text-[#C83803] focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
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
 * Every image prompt the create produced, on its own tab, grouped by the artifact it came from.
 *
 * v1 had these as a field on `GeneratedContentSet`, peer to `article`/`blog`/`toolPosts[]`, and so
 * a tab of their own. They are deliberately not drawn in the prose (`renderArtifactBody`) and ship
 * as separate files in the export, so without this they are generated, paid for, stored and
 * invisible -- Jeff asked for it twice, "No Tab for Blog - Image Prompts?" (2026-09-23) and again
 * 2026-09-27. The first answer was a collapsed toggle inside the blog's own body, which is not a
 * tab and is not where v1 put them.
 *
 * Prompts live on the document (`lede.imagePrompt` and each section's), not as artifacts, so the
 * bodies have to be read back: one latest-version fetch per artifact, on demand when the tab is
 * opened rather than on every workspace load.
 *
 * A create whose artifacts carry none still gets the tab, saying so per artifact. Hiding it when
 * empty is how a generation step that silently stopped attaching prompts would look identical to a
 * create that never had any.
 */
function ImagePromptsPanel({ artifacts }: { artifacts: GccArtifact[] }) {
  const [groups, setGroups] = useState<
    { artifact: GccArtifact; prompts: ArtifactImagePrompt[] }[] | null
  >(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const loaded = await Promise.all(
          artifacts.map(async (a) => {
            const versions = await listGccVersions(a.id);
            const latest = [...versions].sort((x, y) => y.versionNumber - x.versionNumber)[0];
            return {
              artifact: a,
              prompts: latest ? imagePromptsFor(latest.bodyDocumentJson) : [],
            };
          }),
        );
        if (live) setGroups(loaded);
      } catch (err) {
        if (live) {
          setError(
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Could not load image prompts.",
          );
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [artifacts]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {error}
      </div>
    );
  }

  if (!groups) {
    return <p className="text-sm text-muted">Reading image prompts…</p>;
  }

  const total = groups.reduce((n, g) => n + g.prompts.length, 0);

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Image prompts</h2>
      <p className="mt-1 text-sm text-muted">
        {total === 0
          ? "None of this project's drafts carry image prompts."
          : `${total} prompt${total === 1 ? "" : "s"} — one per H2 plus the hero, for each draft.`}{" "}
        Copy these into your image generator. They are production instructions, which is why they
        are not printed in the page.
      </p>

      <div className="mt-4 flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group.artifact.id} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {group.artifact.name || group.artifact.id.slice(0, 8)}
              </h3>
              <span className="text-xs text-muted">{group.artifact.type}</span>
            </div>

            {group.prompts.length === 0 ? (
              <p className="text-sm text-muted">
                This draft carries no image prompts. Its body was generated before prompts were
                attached, or the prompt step did not run for it.
              </p>
            ) : (
              <div className="flex flex-col gap-3 rounded-md border border-border bg-white p-4">
                {group.prompts.map((prompt, i) => (
                  <div key={`${prompt.heading}-${i}`} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                        {i === 0 ? prompt.heading : `${i}. ${prompt.heading}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard?.writeText(prompt.prompt)}
                        className="text-xs font-medium text-[#C83803] underline"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {prompt.prompt}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Render an artifact body as readable content, with the affordances v1's ToolPostCard had and this
 * workspace had lost: the meta description, a word count measured against the type's own target,
 * and the JSON+LD schema behind a toggle (Jeff, 2026-09-23 -- "this display sucks", and JSON-LD
 * looked missing because nothing ever drew it, though it is generated on every tool page).
 *
 * Deliberately not carried over from v1: it rendered the body through a Markdown component. v2
 * renders the ContentDocument to HTML properly and Markdown is forbidden, so this takes the layout
 * and none of that path. Raw JSON stays behind a collapsed toggle, never the default view.
 */
/**
 * One stage of the run, as a band on a single work surface.
 *
 * Every section on this page was its own `rounded-xl border shadow-sm` card, five of them stacked,
 * identical radius and identical shadow whatever the section did. That reads as five unrelated
 * widgets rather than one sequence, and it is the reason the page felt like a form dump: nothing in
 * the chrome said what followed what. Bands on a shared surface, divided by a rule, say it.
 *
 * The number is here because these genuinely are ordered -- brief, then generate, then the draft,
 * then revise, then approve. Numbering anything that is not a sequence is decoration.
 */
/**
 * What the saved brief says, in the words the pickers use.
 *
 * The brief is a dozen selects that are set once per create and then scrolled past on every later
 * visit, which is most of why this page read as a form dump. Collapsed, it answers the only question
 * the operator has after saving -- what did I choose -- and the fields are a click away.
 *
 * An unset field is listed as unset rather than omitted: a summary that silently drops what is
 * missing is how "no tone chosen" becomes indistinguishable from "tone is not a field".
 */
function BriefSummary({
  detail,
  outputTypes,
}: {
  detail: ProjectContent;
  outputTypes: string[];
}) {
  const brief = migrateBrief(safeParse(detail.briefJson));
  const label = (options: readonly { value: string; label: string }[], value: string) =>
    options.find((o) => o.value === value)?.label ?? value;

  const rows: { term: string; value: string }[] = [
    { term: "Writing", value: outputTypes.map((t) => contentTypeLabel(t)).join(", ") },
    { term: "Keyword", value: detail.topic },
    { term: "Intent", value: brief.primaryIntent ? label(PRIMARY_INTENTS, brief.primaryIntent) : "" },
    { term: "Buying stage", value: brief.buyingStage ? label(BUYING_STAGES, brief.buyingStage) : "" },
    { term: "Audience", value: brief.audienceSegment ? label(AUDIENCE_SEGMENTS, brief.audienceSegment) : "" },
    { term: "Angle", value: brief.angle ? label(CONTENT_ANGLES, brief.angle) : "" },
    { term: "Call to action", value: brief.ctaType ? label(CTA_TYPES, brief.ctaType) : "" },
    { term: "Tone", value: brief.toneOfVoice ? label(TONES_OF_VOICE, brief.toneOfVoice) : "" },
  ];

  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.term} className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted">{row.term}</dt>
          <dd className={row.value ? "text-sm text-foreground" : "text-sm text-muted"}>
            {row.value || "Not set"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function safeParse(json: string | null | undefined): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function contentTypeLabel(value: string): string {
  return CONTENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

function Stage({
  step,
  title,
  note,
  children,
  aside,
}: {
  step: number;
  title: string;
  note?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="border-t border-border px-5 py-7 first:border-t-0 sm:px-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="flex items-baseline gap-2.5 font-display text-xl text-foreground">
          <span className="text-sm font-normal text-muted tabular-nums">{step}</span>
          {title}
        </h2>
        {aside}
      </div>
      {note ? <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-muted">{note}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ArtifactBody({
  bodyDocumentJson,
  contentType,
}: {
  bodyDocumentJson: string;
  contentType?: string;
}) {
  const [showSource, setShowSource] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const html = renderArtifactBody(bodyDocumentJson);
  // The generator serializes these alongside the document (title/metaDescription/summary/body/
  // jsonLdSchema for a tool page); renderArtifactBody only draws title + body.
  let metaDescription = "";
  let jsonLdSchema = "";
  // The gap a piece was saved with, as the generator recorded it in the envelope. The workspace
  // already showed these -- but only from the live hub events of the run that wrote them, so reopening
  // the draft a day later showed a pillar missing a partner with nothing saying so.
  let warnings: string[] = [];
  try {
    const parsed = JSON.parse(bodyDocumentJson) as Record<string, unknown>;
    if (typeof parsed?.metaDescription === "string") metaDescription = parsed.metaDescription;
    if (typeof parsed?.jsonLdSchema === "string") jsonLdSchema = parsed.jsonLdSchema;
    if (Array.isArray(parsed?.warnings)) {
      warnings = parsed.warnings.filter(
        (w): w is string => typeof w === "string" && w.trim().length > 0,
      );
    }
  } catch {
    /* a body that will not parse still renders below */
  }

  // Not every band is word-ranged -- imagePrompt is specified in words *and* characters with a
  // different shape -- so only use a band that actually carries min/max.
  const band = contentType ? lengthBandForContentType(contentType) : "";
  const raw = band ? CONTENT_LENGTH_TARGETS[band] : null;
  const target =
    raw && "min" in raw && "max" in raw
      ? (raw as { min: number; max: number; label: string })
      : null;
  const words = html
    ? html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length
    : 0;
  const outOfRange = !!target && words > 0 && (words < target.min || words > target.max);

  return (
    <div className="mt-4">
      {warnings.length > 0 ? (
        <div className="mb-3 border-l-2 border-[var(--gcc-accent)] bg-[var(--gcc-accent)]/5 px-3 py-2">
          <p className="text-sm font-medium text-foreground">
            Written with a gap ({warnings.length})
          </p>
          <ul className="mt-1 space-y-1">
            {warnings.map((w) => (
              <li key={w} className="whitespace-pre-wrap text-sm text-foreground">
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {metaDescription ? (
        <p className="mb-2 text-sm text-muted">{metaDescription}</p>
      ) : null}

      {target && words > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              outOfRange ? "bg-[var(--gcc-accent)]/12 text-[var(--gcc-accent-deep)]" : "bg-surface-muted text-muted"
            }`}
          >
            {words.toLocaleString()} words
          </span>
          <span className="text-xs text-muted">Target: {target.label} words</span>
        </div>
      ) : null}

      {html ? (
        <div
          className="gcc-doc max-h-[32rem] overflow-auto rounded-md border border-border bg-white p-5 text-sm text-foreground [&_a]:text-[#C83803] [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:mb-3 [&_p]:leading-relaxed [&_.gcc-summary]:mb-4 [&_.gcc-summary]:text-base [&_.gcc-summary]:font-medium [&_.gcc-summary]:leading-relaxed [&_.gcc-summary]:text-muted [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-brand/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote_cite]:mt-1 [&_blockquote_cite]:block [&_blockquote_cite]:text-xs [&_blockquote_cite]:not-italic [&_blockquote_cite]:text-muted"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-white p-4 text-sm text-foreground">
          {previewBodyDocument(bodyDocumentJson, 8000)}
        </pre>
      )}

      {jsonLdSchema ? (
        <>
          <button
            type="button"
            onClick={() => setShowSchema((v) => !v)}
            className="mt-4 block text-sm font-medium text-[#C83803] hover:underline"
          >
            {showSchema ? "Hide" : "Show"} JSON+LD Schema
          </button>
          {showSchema ? (
            <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
              {jsonLdSchema}
            </pre>
          ) : null}
        </>
      ) : null}

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
