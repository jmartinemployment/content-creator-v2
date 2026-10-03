"use client";

import { useEffect, useState } from "react";
import {
  emptyNicheFramingSet,
  nicheFramingSetHasAny,
  type NicheFraming,
  type NicheFramingSet,
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
          First level is the department, so this is what files the page under the right directory.
        </span>
      </label>

      <FramingFields
        legend="For the whole category"
        hint="The one problem the whole niche has — not a collection of each tool's. Every page uses this; a tool below overrides only the boxes you fill in."
        value={value}
        onChange={(next) => patch(next)}
      />

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
            Leave a tool alone and it uses the category framing above. Override it when that tool owns a
            distinct slice of the problem &mdash; a segment, a stage, a scale. Core Problem and Automation
            replace the category&rsquo;s; pain points are <em>added</em> to them, since the category&rsquo;s
            are true of every tool in the niche. Leave a box empty and nothing changes for that tool.
          </p>
          <ul className="mt-2 space-y-1.5">
            {partners.map((partner) => {
              const set = value.perTool[partner.host] ?? emptyNicheFramingSet();
              const overridden = nicheFramingSetHasAny(set);
              const open = openHost === partner.host;
              return (
                <li key={partner.host} className="border border-[var(--gcc-border)]">
                  <button
                    type="button"
                    onClick={() => setOpenHost(open ? null : partner.host)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
                  >
                    <span className="text-foreground">
                      {partner.label}
                      <span className="text-muted"> &mdash; {partner.host}</span>
                    </span>
                    <span className="text-xs text-muted">
                      {overridden ? "overridden" : "uses category"}
                    </span>
                  </button>
                  {open ? (
                    <div className="border-t border-[var(--gcc-border)] px-3 pb-3">
                      <FramingFields
                        legend={`${partner.label}'s niche`}
                        hint="What slice of the category problem does this tool own? Leave a box empty to keep the category's."
                        value={set}
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

function FramingFields({
  legend,
  hint,
  value,
  onChange,
}: {
  legend: string;
  hint: string;
  value: NicheFramingSet;
  onChange: (next: Partial<NicheFramingSet>) => void;
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

      <label className="mt-3 block">
        <span className="text-sm text-foreground">Where they fail</span>
        {/* Shape-agnostic on purpose. The research arrives three different ways -- several bolded
            failures each with a paragraph, terse one-liners, or a single unbroken paragraph (Jeff's
            Bill.com example, 2026-10-03: "They all do not come formatted in that way") -- so demanding
            any one structure is wrong most of the time. A blank line separates entries when there are
            several; text without one is a single entry, which is the right reading of a paragraph. */}
        <span className="mt-0.5 block text-xs text-muted">
          Paste it however it came. If it is several distinct failures, put a blank line between them;
          one paragraph stays one point.
        </span>
        <textarea
          value={value.painPoints}
          onChange={(e) => onChange({ painPoints: e.target.value })}
          rows={8}
          placeholder={"They treat approval as an email reply, a verbal instruction, or access to the company bank account. That creates slow approvals, late fees, duplicate payments and no defensible approval history."}
          className="mt-1 w-full border border-[var(--gcc-border)] bg-transparent px-2 py-1.5 text-sm text-foreground"
        />
      </label>

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
    </fieldset>
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
