"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ALL_PARTNERS,
  DEPARTMENTS,
  emptyEvidenceRow,
  emptyNicheFramingSet,
  evidenceOwners,
  evidenceRowsOf,
  moveEvidenceRow,
  nicheFramingSetHasAny,
  parseEvidenceRows,
  partnerQuestions,
  placedEvidenceRows,
  taxonomyFirstLevel,
  taxonomyPathNamesNoDepartment,
  withEvidenceRows,
  type EvidenceRow,
  type NicheFraming,
  type NicheFramingSet,
  type PartnerQuestion,
  type PlacedEvidenceRow,
} from "@/lib/content-creator/brief-catalog";
import Link from "next/link";
import { getProject } from "@/services/gcc-projects-api";

/**
 * The operator's own framing of a niche: the problem, how it is failed, and what automation answers it.
 *
 * Typed by hand on purpose. The research that produces these three things is run outside the app, with
 * whichever model is best that week, and the roster it returns has to be judged anyway — two models
 * asked the same question returned different tool sets. So an extraction step would have saved typing,
 * not reading, in exchange for a model that could drop a bullet or shift emphasis on the way in.
 *
 * Saved inside the brief through the existing `PATCH creates/{id}/brief-research`. No new route.
 *
 * There is deliberately no partner-program field — Jeff, 2026-10-02: "Partner program text has no place
 * in my output." The brief is prompt input, so not having the field is the only guarantee that cannot
 * regress.
 */
export default function NicheFramingPanel({
  projectId,
  value,
  onChange,
}: {
  projectId?: string;
  value: NicheFraming;
  onChange: (next: NicheFraming) => void;
}) {
  const [fetched, setFetched] = useState<{
    projectId: string;
    partners: { host: string; label: string }[];
  } | null>(null);
  const [openHost, setOpenHost] = useState<string | null>(null);

  // Tagged with the project it answers and compared on render, rather than cleared from an effect when
  // projectId changes — the same shape PartnerQuoteFit uses in ContentBriefPanel, and for the same
  // reason: clearing state synchronously in an effect re-renders to say nothing.
  const partners =
    fetched !== null && fetched.projectId === projectId ? fetched.partners : [];

  // The declared partners are what the per-tool overrides key off, and they live on the project.
  // Fetched here rather than drilled through three parents.
  useEffect(() => {
    if (!projectId) return;
    let live = true;
    void (async () => {
      try {
        const project = await getProject(projectId);
        if (!live) return;
        setFetched({
          projectId,
          partners: (project.partnerUrls ?? [])
            .map((url) => ({ host: hostOf(url), label: labelOf(url) }))
            .filter((p) => p.host.length > 0),
        });
      } catch {
        // A project that will not load means no per-tool overrides, not a broken panel. The category
        // set still works, and it is the half that applies to every page.
        if (live) setFetched({ projectId, partners: [] });
      }
    })();
    return () => {
      live = false;
    };
  }, [projectId]);

  function patch(next: Partial<NicheFraming>) {
    onChange({ ...value, ...next });
  }

  function patchPerTool(host: string, next: Partial<NicheFramingSet>) {
    const current = value.perTool[host] ?? emptyNicheFramingSet();
    onChange({
      ...value,
      perTool: { ...value.perTool, [host]: { ...current, ...next } },
    });
  }

  return (
    <section className="mt-6 border-t border-[var(--gcc-border)] pt-5">
      <h3 className="text-sm font-medium text-foreground">Niche framing</h3>
      <p className="mt-1 text-sm text-muted">
        What you researched for this niche. The writer argues from this &mdash; it never cites it, and
        quotes still come only from crawled partner pages.
      </p>

      <label className="mt-4 block">
        <span className="text-sm text-foreground">Taxonomy path</span>
        <input
          type="text"
          value={value.taxonomyPath}
          onChange={(e) => patch({ taxonomyPath: e.target.value })}
          placeholder="Accounting -&gt; Cash Flow Forecasting -&gt; Accounts Receivable"
          className="mt-1 w-full border border-[var(--gcc-border)] bg-transparent px-2 py-1.5 text-sm text-foreground"
        />
        <span className="mt-1 block text-xs text-muted">
          First level is the department, so this is what files the page under the right directory:{" "}
          {DEPARTMENTS.join(", ")}.
        </span>
        {taxonomyPathNamesNoDepartment(value.taxonomyPath) ? (
          <span className="mt-1 block text-xs text-foreground">
            &ldquo;{taxonomyFirstLevel(value.taxonomyPath)}&rdquo; is not a department. Generate will not start
            until the first level is one of those five.
          </span>
        ) : null}
      </label>

      <FramingFields
        legend="For the whole category"
        hint="The one problem the whole niche has — not a collection of each tool's. A tool below overrides only the boxes you fill in."
        value={value}
        onChange={(next) => patch(next)}
      >
        {/* Every row in the brief, the partners' own included, with the partner chosen on the row. It
            sits here because this is where a failure is entered; a partner's section below no longer
            has a second table of the same rows. */}
        <EvidenceRows
          framing={value}
          partners={partners}
          partnersKnown={fetched !== null && fetched.projectId === projectId}
          onChange={onChange}
        />
      </FramingFields>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-foreground">
          Practical client diagnosis &mdash; the closing
        </legend>
        {/* Category-level, with no per-tool override, and that is the data rather than a shortcut:
            every question is about the reader's own operation and none names a product, so there is
            nothing for a partner to override. Hence it sits out here and not in FramingFields. */}
        <p className="mt-0.5 text-xs text-muted">
          The questions you would actually ask a prospect. The page ends by handing these to the reader
          to run against their own operation, so the ask is what they do with the answers &mdash; instead
          of the &ldquo;consider your options&rdquo; ending every draft produced before this field existed.
        </p>

        <label className="mt-3 block">
          <span className="text-sm text-foreground">One question per line</span>
          {/* One per line, unlike the rows above, where a failure is one row with three columns. Said
              plainly because the two sit a few inches apart. */}
          <span className="mt-0.5 block text-xs text-muted">
            One per line. The page adds these to its closing word for word; the writer never sees them.
          </span>
          <textarea
            value={value.diagnosisQuestions}
            onChange={(e) => patch({ diagnosisQuestions: e.target.value })}
            rows={8}
            placeholder={
              "How many invoices per month require someone's approval?\n" +
              "Who approves spending, and what happens when they are unavailable?\n" +
              "Is there an audit trail sufficient to answer \u201cwho approved this payment and why?\u201d"
            }
            className="mt-1 w-full border border-[var(--gcc-border)] bg-transparent px-2 py-1.5 text-sm text-foreground"
          />
        </label>
      </fieldset>

      {partners.length > 0 ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              Per tool &mdash; only where the niche genuinely differs
            </p>
            {/* Available whether or not partners exist. The link in the empty state below only shows
                when there are none, so editing an existing set had no route from here -- which is where
                you are when you notice a wrong partner URL. */}
            {projectId ? (
              <Link
                href={`/app/projects/${projectId}?section=profile&edit=1`}
                className="text-xs font-medium text-brand hover:underline"
              >
                Edit partner URLs &rarr;
              </Link>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            Each tool lists the searches its crawl gets, in order. Leave it alone and they are the
            category&rsquo;s; fill a box here and it replaces the category&rsquo;s. A tool&rsquo;s own
            rows are entered in the table above, with the tool chosen as the row&rsquo;s partner: each
            is added to its searches, or replaces the all-partners row that states the same problem.
          </p>
          <ul className="mt-2 space-y-1.5">
            {partners.map((partner) => {
              const set = value.perTool[partner.host] ?? emptyNicheFramingSet();
              const overridden = nicheFramingSetHasAny(set);
              const questions = partnerQuestions(value, value.perTool[partner.host]);
              const own = questions.filter((q) => q.source === "tool").length;
              const open = openHost === partner.host;
              return (
                <li key={partner.host} className="border border-[var(--gcc-border)]">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenHost(open ? null : partner.host)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm"
                  >
                    <span className="text-foreground">
                      {partner.label}
                      <span className="text-muted"> &mdash; {partner.host}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {questions.length === 0
                        ? "bare keyword only"
                        : `${questions.length} ${questions.length === 1 ? "search" : "searches"}${
                            own > 0 ? ` · ${own} own` : ""
                          }`}
                      {overridden ? "" : " · uses category"}
                    </span>
                  </button>
                  {open ? (
                    <div className="border-t border-[var(--gcc-border)] px-3 pb-3">
                      <SearchList host={partner.host} questions={questions} />
                      <FramingFields
                        legend={`${partner.label}'s own`}
                        hint="Only what this tool owns. Empty boxes keep the category's."
                        value={set}
                        toolHost={partner.host}
                        onChange={(next) => patchPerTool(partner.host, next)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : projectId ? (
        // The fix goes where the problem shows up. Without this the message states a blocker and leaves
        // the form that resolves it in another section, with nothing pointing at it.
        <p className="mt-4 text-xs text-muted">
          This project declares no partner URLs, so there are no tools to override &mdash; and no tool
          pages can be generated without them. The category framing above still reaches every page.{" "}
          <Link
            href={`/app/projects/${projectId}?section=profile&edit=1`}
            className="font-medium text-brand hover:underline"
          >
            Add partner URLs &rarr;
          </Link>
        </p>
      ) : null}
    </section>
  );
}

/**
 * What one partner's crawl is searched with, in order — read-only, computed by `partnerQuestions`
 * from the category set and the tool's own, so the answer to "what is asked of whom" is on the
 * page under the partner's name rather than explained in a paragraph.
 */
function SearchList({ host, questions }: { host: string; questions: PartnerQuestion[] }) {
  return (
    <div className="mt-3">
      <span className="text-xs font-medium text-foreground">
        Searched on {host}, in this order
      </span>
      {questions.length === 0 ? (
        <p className="mt-1 text-xs text-muted">
          Nothing from the framing yet &mdash; the crawl is searched with the target keyword alone.
        </p>
      ) : (
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs">
          {questions.map((q, i) => (
            <li key={i} className="text-foreground">
              <span className="text-muted">
                {q.kind === "core" ? "Core problem" : "Row"} ({q.source === "tool" ? "own" : "category"}):{" "}
              </span>
              {q.need}
              {q.keyword ? <span className="text-muted"> &middot; terms: {q.keyword}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function FramingFields({
  legend,
  hint,
  value,
  toolHost,
  onChange,
  children,
}: {
  legend: string;
  hint: string;
  value: NicheFramingSet;
  /** Set for a tool's own fields: shows the tool page FAQ box, which the category has no use for. */
  toolHost?: string;
  onChange: (next: Partial<NicheFramingSet>) => void;
  /** The table of rows, between the problem and the pitch. The category passes it; a tool does not. */
  children?: ReactNode;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>

      <label className="mt-3 block">
        <span className="text-sm text-foreground">The core problem</span>
        <textarea
          value={value.coreProblem}
          onChange={(e) => onChange({ coreProblem: e.target.value })}
          rows={3}
          placeholder="Revenue is booked when the invoice goes out, but cash arrives whenever the customer gets round to paying."
          className="mt-1 w-full border border-[var(--gcc-border)] bg-transparent px-2 py-1.5 text-sm text-foreground"
        />
      </label>

      {children}

      <label className="mt-3 block">
        <span className="text-sm text-foreground">The automation to pitch</span>
        <textarea
          value={value.automationToPitch}
          onChange={(e) => onChange({ automationToPitch: e.target.value })}
          rows={3}
          placeholder="Invoice-to-cash on a schedule: reminders, payment links, reconciliation, a weekly collection forecast."
          className="mt-1 w-full border border-[var(--gcc-border)] bg-transparent px-2 py-1.5 text-sm text-foreground"
        />
      </label>

      {toolHost ? (
        <label className="mt-3 block">
          <span className="text-sm text-foreground">Tool page FAQ</span>
          <span className="mt-0.5 block text-xs text-muted">
            One question per line. Answered on this tool&rsquo;s page from {toolHost}&rsquo;s pages only; a
            question no page answers is left out and reported.
          </span>
          <textarea
            value={value.faqQuestions}
            onChange={(e) => onChange({ faqQuestions: e.target.value })}
            rows={3}
            placeholder={"Does it sync with QuickBooks Online?\nCan a bookkeeper schedule a payment the owner releases?"}
            className="mt-1 w-full border border-[var(--gcc-border)] bg-transparent px-2 py-1.5 font-mono text-xs text-foreground"
          />
        </label>
      ) : null}
    </fieldset>
  );
}

/**
 * A row's place in the table while the form is open.
 *
 * A row is stored under its owner (every partner, or one partner's host), so the stored order is by
 * owner. A table in that order would move a row out of sight the moment its partner was chosen. So
 * each row object is numbered when it is first seen, in stored order, and the table lists rows by
 * that number: a row stays where it is while its partner is changed or its text is typed, a new row
 * is last, and a brief read again from the server is numbered afresh, by owner.
 */
const rowNumbers = new WeakMap<EvidenceRow, number>();
let nextRowNumber = 0;

function rowNumber(row: EvidenceRow): number {
  const known = rowNumbers.get(row);
  if (known !== undefined) return known;
  const assigned = nextRowNumber;
  nextRowNumber += 1;
  rowNumbers.set(row, assigned);
  return assigned;
}

/** An edited row is a new object; it keeps the place of the one it replaces. */
function editedRow(row: EvidenceRow, next: Partial<EvidenceRow>): EvidenceRow {
  const edited = { ...row, ...next };
  rowNumbers.set(edited, rowNumber(row));
  return edited;
}

/** The rows in the order the table shows them. */
function inTableOrder(placed: PlacedEvidenceRow[]): PlacedEvidenceRow[] {
  // Numbered in stored order first, so rows not seen before fall in by owner among themselves.
  for (const p of placed) rowNumber(p.row);
  return [...placed].sort((a, b) => rowNumber(a.row) - rowNumber(b.row));
}

/**
 * Where they fail, and what the vendor does about each failure: one row per failure, entered once,
 * each for one partner or for all of them.
 *
 * The Partner is which crawl the row searches and which page argues it (Jeff, 2026-10-11: "Row 1 is
 * not associated with vendor/partner X" -- the research is five failures and five remedies per
 * partner, and this table named none, so a remedy written in one vendor's words was searched for on
 * every other vendor's site). A partner's row is that host's own row in the saved brief, exactly
 * what the table inside each partner's section used to write; that second table is gone, so a row
 * has one place.
 *
 * The Problem column is what the writer argues from (it reaches the backend as the pain-point
 * paragraphs, derived from these rows). The Solution and Search terms columns are what retrieval
 * asks the partner's crawl with: the solution to the index's meaning half, the terms to its keyword
 * half, one query per row. Measured on Tipalti, 2026-10-08: problem statements alone found the
 * vendor describing three failures of six and fixing none of those three; solutions written in the
 * vendor's own words found the product page for all six. Nothing here is ever quoted.
 *
 * Rows can be pasted in from a research answer and reviewed before the brief is saved; the
 * conversion is a deterministic split on the table's columns, never a model.
 */
function EvidenceRows({
  framing,
  partners,
  partnersKnown,
  onChange,
}: {
  framing: NicheFraming;
  partners: { host: string; label: string }[];
  /** False until the project's partners have loaded: a host is not called "not a partner" on a guess. */
  partnersKnown: boolean;
  onChange: (next: NicheFraming) => void;
}) {
  const [pasted, setPasted] = useState("");
  // Whose rows a paste makes. Null until chosen; until then it is the last row's partner.
  const [pastedFor, setPastedFor] = useState<string | null>(null);

  const partnerHosts = partners.map((p) => p.host);
  const rows = inTableOrder(placedEvidenceRows(framing, partnerHosts));
  // Who a row can be given to: the project's partners, and any other host a saved row is still under.
  const hosts = evidenceOwners(framing, partnerHosts).filter((owner) => owner !== ALL_PARTNERS);
  // A new row belongs with the one above it, so five rows for one partner are one choice, not five.
  const lastOwner = rows.length > 0 ? rows[rows.length - 1].owner : ALL_PARTNERS;
  const pasteOwner =
    pastedFor !== null && (pastedFor === ALL_PARTNERS || hosts.includes(pastedFor))
      ? pastedFor
      : lastOwner;

  function ownerText(host: string): string {
    const partner = partners.find((p) => p.host === host);
    if (partner) return `${partner.label} — ${partner.host}`;
    return partnersKnown ? `${host} — not a partner of this project` : host;
  }
  function patchRow(placed: PlacedEvidenceRow, next: Partial<EvidenceRow>) {
    const edited = editedRow(placed.row, next);
    onChange(
      withEvidenceRows(
        framing,
        placed.owner,
        evidenceRowsOf(framing, placed.owner).map((row, i) => (i === placed.index ? edited : row)),
      ),
    );
  }
  function removeRow(placed: PlacedEvidenceRow) {
    onChange(
      withEvidenceRows(
        framing,
        placed.owner,
        evidenceRowsOf(framing, placed.owner).filter((_, i) => i !== placed.index),
      ),
    );
  }
  function addRows(owner: string, added: EvidenceRow[]) {
    onChange(withEvidenceRows(framing, owner, [...evidenceRowsOf(framing, owner), ...added]));
  }
  function importPasted() {
    const parsed = parseEvidenceRows(pasted);
    if (parsed.length === 0) return;
    addRows(pasteOwner, parsed);
    setPasted("");
  }

  const inputClass =
    "mt-1 w-full border border-[var(--gcc-border)] bg-transparent px-2 py-1.5 text-sm text-foreground";
  const partnerOptions = (
    <>
      <option value={ALL_PARTNERS}>All partners</option>
      {hosts.map((host) => (
        <option key={host} value={host}>
          {ownerText(host)}
        </option>
      ))}
    </>
  );
  return (
    <div className="mt-4">
      <span className="text-sm text-foreground">Where they fail, and what the vendor does about it</span>
      <span className="mt-0.5 block text-xs text-muted">
        One row per failure, for one partner or for all of them. A partner&rsquo;s row is searched on
        that partner&rsquo;s site only and argued on that partner&rsquo;s tool page only. A row for all
        partners is searched on every partner&rsquo;s site and argued on every page. Nothing here is
        quoted.
      </span>

      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted">
          No rows yet: each partner is searched with the core problem alone.
        </p>
      ) : null}
      <ol className="mt-2 space-y-3">
        {rows.map((placed, position) => (
          <li key={rowNumber(placed.row)} className="border border-[var(--gcc-border)] p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Row {position + 1}</span>
              <button
                type="button"
                onClick={() => removeRow(placed)}
                className="text-xs text-muted hover:text-foreground"
              >
                Remove
              </button>
            </div>
            <label className="mt-1 block">
              <span className="text-xs text-foreground">
                Partner <span className="text-muted">&mdash; whose remedy this is</span>
              </span>
              <select
                value={placed.owner}
                onChange={(e) => onChange(moveEvidenceRow(framing, placed, e.target.value))}
                className={inputClass}
              >
                {partnerOptions}
              </select>
            </label>
            <label className="mt-2 block">
              <span className="text-xs text-foreground">
                Problem <span className="text-muted">&mdash; the writer argues from it</span>
              </span>
              <textarea
                value={placed.row.problem}
                onChange={(e) => patchRow(placed, { problem: e.target.value })}
                rows={2}
                placeholder="Tax forms, vendor details and compliance records are stored inconsistently."
                className={inputClass}
              />
            </label>
            <label className="mt-2 block">
              <span className="text-xs text-foreground">
                Vendor&rsquo;s solution{" "}
                <span className="text-muted">&mdash; in the vendor&rsquo;s words; the meaning search</span>
              </span>
              <textarea
                value={placed.row.solution}
                onChange={(e) => patchRow(placed, { solution: e.target.value })}
                rows={3}
                placeholder="Self-service supplier onboarding collects payment details, preferences and W-9 or W-8 tax forms, with validation and reporting."
                className={inputClass}
              />
            </label>
            <label className="mt-2 block">
              <span className="text-xs text-foreground">
                Search terms{" "}
                <span className="text-muted">&mdash; the exact-word search; comma-separated</span>
              </span>
              <TermsInput
                terms={placed.row.terms}
                onChange={(terms) => patchRow(placed, { terms })}
                className={inputClass}
              />
            </label>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => addRows(lastOwner, [emptyEvidenceRow()])}
        className="mt-2 text-xs font-medium text-brand hover:underline"
      >
        + Add a row
      </button>

      <label className="mt-3 block">
        <span className="text-xs text-foreground">Paste research to make rows</span>
        <span className="mt-0.5 block text-xs text-muted">
          A research table (problem, solution, terms per line) or blank-line blocks. Rows appear above
          to correct; nothing is saved until the brief is.
        </span>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={4}
          placeholder={"International vendors are paid manually through bank wires.\tGlobal payments through Mass Payments: 200+ countries, 120 currencies, 50+ payment methods.\tglobal payments, mass payments, wire"}
          className={inputClass}
        />
      </label>
      <label className="mt-2 block">
        <span className="text-xs text-foreground">
          Partner <span className="text-muted">&mdash; whose remedies the pasted rows are</span>
        </span>
        <select
          value={pasteOwner}
          onChange={(e) => setPastedFor(e.target.value)}
          className={inputClass}
        >
          {partnerOptions}
        </select>
      </label>
      <button
        type="button"
        onClick={importPasted}
        disabled={pasted.trim().length === 0}
        className="mt-1 text-xs font-medium text-brand hover:underline disabled:opacity-50"
      >
        Make rows
      </button>
    </div>
  );
}

/**
 * A row's search terms, typed as a comma list.
 *
 * It holds the text as typed and hands the row the terms in it. Showing the terms joined back
 * together instead dropped a comma the moment it was typed, since a comma with nothing after it is
 * not yet a term: a second term could be pasted in but never typed.
 */
function TermsInput({
  terms,
  onChange,
  className,
}: {
  terms: string[];
  onChange: (terms: string[]) => void;
  className: string;
}) {
  const [text, setText] = useState(terms.join(", "));
  return (
    <input
      type="text"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(
          e.target.value
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0),
        );
      }}
      placeholder="supplier onboarding, W-9 W-8, tax compliance"
      className={className}
    />
  );
}

/**
 * The bucket key, matching `GccRequiredToolMentions.HostKeyOf` on the backend: lowercased host with a
 * leading `www.` removed. The two must agree or an override reaches no page.
 */
function hostOf(url: string): string {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return "";
  }
}

/** A readable label from the host. The authoritative product name is resolved server-side. */
function labelOf(url: string): string {
  const host = hostOf(url);
  if (!host) return url;
  const name = host.split(".")[0] ?? host;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
