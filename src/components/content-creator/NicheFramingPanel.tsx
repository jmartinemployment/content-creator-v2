"use client";

import { useEffect, useState } from "react";
import {
  ALL_PARTNERS,
  DEPARTMENTS,
  emptyEvidenceRow,
  emptyNicheFramingSet,
  evidenceRowHasAny,
  evidenceRowsOf,
  giveToolEntriesTo,
  hostsWithNoPartner,
  moveEvidenceRow,
  partnerQuestions,
  taxonomyFirstLevel,
  taxonomyPathNamesNoDepartment,
  withEvidenceRows,
  type EvidenceRow,
  type NicheFraming,
  type NicheFramingSet,
  type PartnerQuestion,
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
 * **One section a tool** (Jeff, 2026-10-12: "incorporate the new section into old or accordian section
 * and add the Sales pitch to each tool"). The research is one core problem for every partner and then,
 * per partner, a core pain point, the failures with the tool's remedy for each, and the marketing/sales
 * hook to pitch. So the category holds the one problem, and each tool's section holds everything that
 * is that tool's: its pain point, its rows, its hook and its page's FAQ. For a day the rows of every
 * tool sat in one table above the tools, a partner chosen on each row, and a tool's pain point and hook
 * sat in its section below: one partner's research was entered in two places.
 *
 * Saved inside the brief when the operator clicks Save. No new field: a tool's hook is its
 * `automationToPitch`, which the form called "The automation to pitch". GeekAPI tells that tool's page
 * the category's and the tool's own, both, and the same for the problem and a tool's pain point
 * (2026-10-12; until then a tool's own was used in the category's place).
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
    partners: Partner[];
  } | null>(null);
  const [openHost, setOpenHost] = useState<string | null>(null);

  // Tagged with the project it answers and compared on render, rather than cleared from an effect when
  // projectId changes — the same shape PartnerQuoteFit uses in ContentBriefPanel, and for the same
  // reason: clearing state synchronously in an effect re-renders to say nothing.
  const partnersKnown = fetched !== null && fetched.projectId === projectId;
  const partners = fetched !== null && fetched.projectId === projectId ? fetched.partners : [];
  // A host is not called "not a partner" on a guess: nothing is listed as one until the project's
  // partners have loaded.
  const others = partnersKnown ? hostsWithNoPartner(value, partners.map((p) => p.host)) : [];

  // The declared partners are what the per-tool sections key off, and they live on the project.
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
        // A project that will not load means no per-tool sections, not a broken panel. The category
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

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-foreground">For the whole category</legend>
        <p className="mt-0.5 text-xs text-muted">
          The one problem every partner sets out to solve, and what answers it. What is one
          tool&rsquo;s own goes in that tool&rsquo;s section below.
        </p>
        <TextBox
          label="The core problem"
          value={value.coreProblem}
          onChange={(coreProblem) => patch({ coreProblem })}
          placeholder="Revenue is booked when the invoice goes out, but cash arrives whenever the customer gets round to paying."
        />
        {/* Only a brief saved with rows for every partner has these. They still search every
            partner's site, and every page is told their failure and their remedy, so they are shown,
            not hidden; a new row is entered in a tool's section. */}
        {value.evidence.length > 0 ? (
          <EvidenceRows framing={value} owner={ALL_PARTNERS} partners={partners} onChange={onChange} />
        ) : null}
        <TextBox
          label="The automation to pitch"
          value={value.automationToPitch}
          onChange={(automationToPitch) => patch({ automationToPitch })}
          placeholder="Invoice-to-cash on a schedule: reminders, payment links, reconciliation, a weekly collection forecast."
        />
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-foreground">
          Practical client diagnosis &mdash; the closing
        </legend>
        {/* Category-level, with no per-tool override, and that is the data rather than a shortcut:
            every question is about the reader's own operation and none names a product, so there is
            nothing for a partner to override. */}
        <p className="mt-0.5 text-xs text-muted">
          The questions you would actually ask a prospect. The page ends by handing these to the reader
          to run against their own operation, so the ask is what they do with the answers &mdash; instead
          of the &ldquo;consider your options&rdquo; ending every draft produced before this field existed.
        </p>

        <label className="mt-3 block">
          <span className="text-sm text-foreground">One question per line</span>
          {/* One per line, unlike a tool's rows below, where a failure is one row with three boxes. */}
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
              "Is there an audit trail sufficient to answer “who approved this payment and why?”"
            }
            className="mt-1 w-full border border-[var(--gcc-border)] bg-transparent px-2 py-1.5 text-sm text-foreground"
          />
        </label>
      </fieldset>

      {partners.length > 0 || others.length > 0 ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Per tool</p>
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
            One section a tool, holding everything you researched for it, in this order: its core
            pain point, where small businesses fail and what the tool does about each, the automation
            to pitch (its marketing/sales hook), and its tool page FAQ. A tool&rsquo;s pain point and
            its pitch are used beside the category&rsquo;s, never in place of them.
          </p>
          <ul className="mt-2 space-y-1.5">
            {partners.map((partner) => (
              <ToolSection
                key={partner.host}
                framing={value}
                host={partner.host}
                partner={partner}
                partners={partners}
                open={openHost === partner.host}
                onToggle={() => setOpenHost(openHost === partner.host ? null : partner.host)}
                onChange={onChange}
              />
            ))}
            {others.map((host) => (
              <ToolSection
                key={host}
                framing={value}
                host={host}
                partner={null}
                partners={partners}
                open={openHost === host}
                onToggle={() => setOpenHost(openHost === host ? null : host)}
                onChange={onChange}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {partnersKnown && partners.length === 0 && projectId ? (
        // The fix goes where the problem shows up. Without this the message states a blocker and leaves
        // the form that resolves it in another section, with nothing pointing at it.
        <p className="mt-4 text-xs text-muted">
          This project declares no partner URLs, so there are no tools to enter research for &mdash; and
          no tool pages can be generated without them. The category framing above still reaches every
          page.{" "}
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

type Partner = { host: string; label: string };

const boxClass =
  "mt-1 w-full border border-[var(--gcc-border)] bg-transparent px-2 py-1.5 text-sm text-foreground";

/** One labelled box of the framing. */
function TextBox({
  label,
  hint,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** A list typed one item a line, shown in a fixed-width face. */
  mono?: boolean;
}) {
  return (
    <label className="mt-3 block">
      <span className="text-sm text-foreground">{label}</span>
      {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className={mono ? `${boxClass} font-mono text-xs` : boxClass}
      />
    </label>
  );
}

/**
 * Everything the brief holds for one tool, in the order the research gives it: the core pain point,
 * where small businesses fail and the tool's remedy for each, the marketing/sales hook to pitch, and
 * the tool page's FAQ. Then what that tool's crawl is searched with, which follows from them.
 *
 * `partner` is null for a host the brief holds entries under that is not a partner of the project: a
 * partner whose address was changed or removed. GeekAPI reads nothing filed under such a host, so the
 * section says so and offers to give what it holds to a partner. It is listed so nothing saved is
 * hidden; it used to be that only its rows were shown, and its pain point, hook and FAQ were not.
 */
function ToolSection({
  framing,
  host,
  partner,
  partners,
  open,
  onToggle,
  onChange,
}: {
  framing: NicheFraming;
  host: string;
  partner: Partner | null;
  partners: Partner[];
  open: boolean;
  onToggle: () => void;
  onChange: (next: NicheFraming) => void;
}) {
  const set = framing.perTool[host] ?? emptyNicheFramingSet();
  const questions = partnerQuestions(framing, framing.perTool[host]);
  const rows = set.evidence.filter(evidenceRowHasAny).length;
  const name = partner ? partner.label : host;

  function patchSet(next: Partial<NicheFramingSet>) {
    onChange({ ...framing, perTool: { ...framing.perTool, [host]: { ...set, ...next } } });
  }

  return (
    <li className="border border-[var(--gcc-border)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm"
      >
        <span className="text-foreground">
          {partner ? (
            <>
              {partner.label}
              <span className="text-muted"> &mdash; {host}</span>
            </>
          ) : (
            `${host} — not a partner of this project`
          )}
        </span>
        {/* What is entered, read off the closed section: a tool with no pitch or no FAQ says so here. */}
        <span className="shrink-0 text-xs text-muted">
          {rows === 0 ? "no rows" : `${rows} ${rows === 1 ? "row" : "rows"}`}
          {set.automationToPitch.trim() ? " · pitch" : " · no pitch"}
          {set.faqQuestions.trim() ? " · FAQ" : " · no FAQ"}
          {partner
            ? questions.length === 0
              ? " · bare keyword only"
              : ` · ${questions.length} ${questions.length === 1 ? "search" : "searches"}`
            : " · used by no page"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-[var(--gcc-border)] px-3 pb-3">
          {partner ? null : (
            <GiveToPartner
              host={host}
              partners={partners}
              onGive={(to) => onChange(giveToolEntriesTo(framing, host, to))}
            />
          )}
          <TextBox
            label="Core pain point"
            hint={`${name}'s own. ${host} is searched with it and with the category's core problem, both. Its page is told both and opens on this one. The pillar and the blog are told it under ${name}'s name.`}
            value={set.coreProblem}
            onChange={(coreProblem) => patchSet({ coreProblem })}
            placeholder="Fractional CFOs lose twenty hours a month rebuilding the same forecast in a spreadsheet."
          />
          <EvidenceRows framing={framing} owner={host} partners={partners} onChange={onChange} />
          <TextBox
            label="The automation to pitch — the marketing/sales hook"
            hint={`What you would say to sell ${name}. Its page is told it beside the category's automation to pitch, both, in every section. The pillar and the blog are told it under ${name}'s name, to argue in their own words.`}
            value={set.automationToPitch}
            onChange={(automationToPitch) => patchSet({ automationToPitch })}
            placeholder="Stop rebuilding the forecast every Monday. A rolling 52-week view of cash in five minutes, with no formulas."
          />
          <TextBox
            label="Tool page FAQ"
            hint={`One question per line. Answered on this tool's page from ${host}'s pages only; a question no page answers is left out and reported.`}
            value={set.faqQuestions}
            onChange={(faqQuestions) => patchSet({ faqQuestions })}
            placeholder={"Does it sync with QuickBooks Online?\nCan a bookkeeper schedule a payment the owner releases?"}
            mono
          />
          {partner ? <SearchList host={host} questions={questions} /> : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * What a host that is not a partner holds, given to the partner it belongs to. Its rows and its FAQ
 * questions are added to that partner's; its pain point and its hook go where that partner has none,
 * and stay here, still shown, where it has one. Nothing is saved until the brief is.
 */
function GiveToPartner({
  host,
  partners,
  onGive,
}: {
  host: string;
  partners: Partner[];
  onGive: (to: string) => void;
}) {
  const [to, setTo] = useState("");
  const chosen = partners.some((p) => p.host === to) ? to : "";
  return (
    <div className="mt-3 border border-[var(--gcc-border)] p-2">
      <p className="text-xs text-foreground">
        {host} is not a partner of this project, so no search and no page uses what is entered here.
        If its address was changed, give this to the partner it now is.
      </p>
      {partners.length === 0 ? (
        <p className="mt-1 text-xs text-muted">The project has no partner to give it to.</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="block grow">
            <span className="text-xs text-foreground">Give everything here to</span>
            <select value={chosen} onChange={(e) => setTo(e.target.value)} className={boxClass}>
              <option value="">Choose a partner</option>
              {partners.map((p) => (
                <option key={p.host} value={p.host}>
                  {p.label} — {p.host}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={chosen === ""}
            onClick={() => onGive(chosen)}
            className="pb-2 text-xs font-medium text-brand hover:underline disabled:opacity-50"
          >
            Give
          </button>
        </div>
      )}
    </div>
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
                {searchLabel(q)}:{" "}
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

/**
 * Whose box a search comes from, by the box's own name on this form: a tool's "Core pain point", the
 * category's "The core problem", or a row of either.
 */
function searchLabel(q: PartnerQuestion): string {
  if (q.kind === "core") return q.source === "tool" ? "Core pain point (own)" : "The core problem (category)";
  return q.source === "tool" ? "Row (own)" : "Row (all partners)";
}

/**
 * A row's identity while the form is open, for React's key. A row is stored by its place in its
 * owner's list, and a box keyed by place keeps the text typed into the row that was there before a
 * row above it was removed. So each row object is numbered when it is first seen.
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

/** An edited row is a new object; it keeps the number of the one it replaces. */
function editedRow(row: EvidenceRow, next: Partial<EvidenceRow>): EvidenceRow {
  const edited = { ...row, ...next };
  rowNumbers.set(edited, rowNumber(row));
  return edited;
}

/**
 * Where small businesses fail, and what the tool does about each: one row per failure, in the
 * section of the tool it is for.
 *
 * The failure is what the writer argues from (it reaches GeekAPI as that tool's pain-point
 * paragraphs, derived from these rows). The remedy and the search terms are what retrieval asks that
 * tool's crawl with: the remedy to the index's meaning half, the terms to its keyword half, one
 * search per row. The remedy is also told to the writers beside its failure, as the operator's note
 * of what answers it (2026-10-12): to that tool's page, the pillar and the blog. Measured on Tipalti, 2026-10-08: problem statements alone found the vendor
 * describing three failures of six and fixing none of those three; remedies written in the vendor's
 * own words found the product page for all six. Nothing here is ever quoted.
 *
 * `owner` is a tool's host, or `ALL_PARTNERS` for the rows a brief was saved with for every partner.
 * Those are listed under the category with the tool each can be given to, and none can be added: a
 * failure is entered under the tool whose remedy it has.
 */
function EvidenceRows({
  framing,
  owner,
  partners,
  onChange,
}: {
  framing: NicheFraming;
  owner: string;
  partners: Partner[];
  onChange: (next: NicheFraming) => void;
}) {
  const forAll = owner === ALL_PARTNERS;
  const rows = evidenceRowsOf(framing, owner);

  function patchRow(index: number, next: Partial<EvidenceRow>) {
    onChange(withEvidenceRows(framing, owner, rows.map((row, i) => (i === index ? editedRow(row, next) : row))));
  }
  function removeRow(index: number) {
    onChange(withEvidenceRows(framing, owner, rows.filter((_, i) => i !== index)));
  }
  function addRows(added: EvidenceRow[]) {
    onChange(withEvidenceRows(framing, owner, [...rows, ...added]));
  }

  const inputClass = boxClass;
  return (
    <div className="mt-4">
      <span className="text-sm text-foreground">
        {forAll ? "Rows saved for all partners" : "Where small businesses fail, and the tool’s remedy"}
      </span>
      <span className="mt-0.5 block text-xs text-muted">
        {forAll
          ? "Each is searched on every partner’s site, and every page is told its failure and its remedy, under no tool’s name. Give a row to the tool whose remedy it is, or remove it. A new row is entered in a tool’s section below."
          : `One row per failure. Each is searched on ${owner} only. This tool’s page is told the failure and the remedy in every section, and the pillar and the blog are told them under this tool’s name. Nothing here is quoted.`}
      </span>

      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted">No rows yet: this tool is searched for the problem alone, and for no failure.</p>
      ) : null}
      <ol className="mt-2 space-y-3">
        {rows.map((row, index) => (
          <li key={rowNumber(row)} className="border border-[var(--gcc-border)] p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Row {index + 1}</span>
              <button
                type="button"
                onClick={() => removeRow(index)}
                className="text-xs text-muted hover:text-foreground"
              >
                Remove
              </button>
            </div>
            {forAll && partners.length > 0 ? (
              <label className="mt-1 block">
                <span className="text-xs text-foreground">
                  Give to <span className="text-muted">&mdash; the tool whose remedy this is</span>
                </span>
                <select
                  value={ALL_PARTNERS}
                  onChange={(e) => onChange(moveEvidenceRow(framing, { owner, index }, e.target.value))}
                  className={inputClass}
                >
                  <option value={ALL_PARTNERS}>All partners</option>
                  {partners.map((p) => (
                    <option key={p.host} value={p.host}>
                      {p.label} — {p.host}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="mt-2 block">
              <span className="text-xs text-foreground">
                Where they fail <span className="text-muted">&mdash; the writer argues from it</span>
              </span>
              <textarea
                value={row.problem}
                onChange={(e) => patchRow(index, { problem: e.target.value })}
                rows={2}
                placeholder="Tax forms, vendor details and compliance records are stored inconsistently."
                className={inputClass}
              />
            </label>
            <label className="mt-2 block">
              <span className="text-xs text-foreground">
                The tool&rsquo;s remedy{" "}
                <span className="text-muted">&mdash; in the vendor&rsquo;s words; the meaning search</span>
              </span>
              <textarea
                value={row.solution}
                onChange={(e) => patchRow(index, { solution: e.target.value })}
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
                terms={row.terms}
                onChange={(terms) => patchRow(index, { terms })}
                className={inputClass}
              />
            </label>
          </li>
        ))}
      </ol>
      {forAll ? null : (
        <button
          type="button"
          onClick={() => addRows([emptyEvidenceRow()])}
          className="mt-2 text-xs font-medium text-brand hover:underline"
        >
          + Add a row
        </button>
      )}
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
