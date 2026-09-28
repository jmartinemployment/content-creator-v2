# Validate entered partner and competitor URLs

**Status: Live (2026-09-29).** The lookup, the colouring and the host normalisation shipped in
`fd5c920` (2026-09-17). **The block did not** — that commit's only submit guard read
`siteUrls.length`, never an index answer, and the button it disabled was *crawl the site*, not
create. So every partner and competitor verdict was rendered and consumed by nothing for twelve
days. The block landed 2026-09-29, in the form and on `POST`/`PUT` alike.

## Task

For each URL the operator enters: **does an index exist for it?** Green if yes, red if no.

That is the whole check. One question, one answer.

## Why there is nothing else to check

A malformed URL was never crawled, so no index can exist for it. It returns no index — the same
answer as a well-formed URL that was never crawled, and the operator does the same thing about it.

So syntax checking is redundant. `src/lib/crawl-seeds.ts` and its 18 tests come out. They answer a
question that the index lookup already subsumes, and today they produce the misleading "N URLs ready"
for URLs with nothing behind them.

## How

Ask Qdrant — the index. Every vector in `geek_crawler_chunks` carries an indexed `host` payload
field. Fetch one point filtered on the URL's host; any point means an index exists. Verified live:

```
www.pipedrive.com            index exists
notarealdomain-xyz123.com    no index
```

Whether, not how much — no counts. A count invites a threshold, which is a different question.

Normalize host: `www.x.com` and `x.com` are separate payload values, so both forms must give the same
answer. **Done 2026-09-23**, both directions, in `_host_candidates`
(`Geek-Crawler-Rag/src/geek_crawler_rag/app.py:646-683`) with tests in `tests/test_host_index.py`.
The earlier body stripped `www.` and never added it, so `https://www.medius.com` reported indexed
while `https://medius.com` reported not indexed, for one run, at the same moment.

## Placement

This is a RAG task end to end. Qdrant is RAG's, the question is about RAG's index, and the answer is
RAG's to give. Geek-Crawler is not involved at any layer.

**A controller that answers a RAG question carries RAG in its name** — that is how the separation
stays visible. So:

- the lookup lives in the RAG service, `Geek-Crawler-Rag/src/geek_crawler_rag/app.py`
- GeekAPI exposes it from `RagController` (`GeekAPI/Controllers/Rag/RagController.cs`, `api/rag`)
- not `GccV2ResearchReadinessController`, and nothing on a crawler controller

Constraint: `/v1/query` accepts `host` but requires `runId` (`models.py:68`), so it cannot answer a
host-only question as written.

## Then

- `src/components/content-writer/ProjectForm.tsx` — per URL, green when an index exists, red when
  not. Create submit blocked while any entered URL is red. (This said
  `src/app/app/create/create-client.tsx`, which `2367b08` deleted along with the whole
  `src/app/app/create/` directory. `ProjectForm` is the only place these URLs are entered.)

  The verdict is `src/lib/declared-url-gate.ts`, a pure function, for two reasons: the test runner
  is `node --test` with no DOM, so a verdict computed inside the component could not be tested at
  all; and partner and competitor are one rule, so they get one implementation.

  `submit()` asks the index for anything unanswered **before** deciding. The check fires on blur,
  so pasting URLs and clicking Create would otherwise submit a form nobody ever checked. The
  button's disabled state is the affordance; the awaited check is the gate.

- **The server refuses too**, on `POST` and `PUT` alike
  (`GeekAPI/Controllers/ContentCreator/GccProjectsController.cs`). `CLAUDE.md` §2: a boundary is
  only fail-closed if code rejects the bad input. `updateProject` has no call site in the UI, so
  `PUT` is reachable only by direct API call — exactly what a form gate cannot cover. One helper,
  two call sites, one refusal naming the URLs with no index.
- Same rule for both lists: an empty list blocks nothing; a list containing an unindexed URL blocks
  submit. Whether a list must be non-empty is `GccV2CreateLibraryWriter.cs:212-218` and is untouched.
- Delete `src/lib/crawl-seeds.ts` and `src/lib/crawl-seeds.test.ts`.

## Verify

- An indexed host is green; an unknown host is red; a malformed URL is red.
- `www.` and bare forms of the same domain agree.
- An empty list does not block; a list with one unindexed URL does — partner and competitor alike.
