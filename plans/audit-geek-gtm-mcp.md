# Geek-GTM-MCP — Code Audit

**Date:** 2026-10-09

## Scope

Small enough to read in full: 1,484 tracked lines across 14 C# source files plus a shell script and a README. Every source file was read. This repo has no relationship to the Content Creator v2 / RAG pipeline audited in the other reports — it is a separate tool — so the RAG-specific rules (no Markdown, no Postgres-in-crawling, RAG never generates) don't apply here and weren't checked.

## What this is

A standalone Model Context Protocol (MCP) server that lets an operator or an AI agent manage Google Tag Manager containers — list accounts/containers/triggers/tags, audit link-click tracking conventions, and publish a new container version (gated behind an explicit `confirm=true`, previewing otherwise). It authenticates via Google OAuth and stores refresh tokens either in GeekAPI (via `GeekApiIdentityStore`, encrypted) or, as an offline dev fallback, in a local JSON file. It has no code path that touches content generation, RAG, or crawling.

## Findings

**Medium — the dev-fallback identity store writes a high-privilege OAuth refresh token to disk in plaintext.** `FileIdentityStore.cs` (`src/GeekGtmMcp.Infrastructure/Identity/FileIdentityStore.cs:59-72`) serializes the raw `RefreshToken` straight to `~/.gtm-mcp/accounts/<key>/tokens.json` with no encryption. The token carries `tagmanager.edit.containers` and `tagmanager.publish` scope — enough to modify and publish a live GTM container, which is customer-facing tracking configuration. Contrast with `GeekApiIdentityStore.cs`, used in the non-fallback path, which correctly calls `SeoCredentialProtector.Decrypt`/encrypts at rest. The file store is explicitly commented as an "offline dev fallback when GEEK_API_URL is unavailable," so the exposure is scoped to local developer machines rather than a shared server, which lowers but does not remove the risk — a stolen laptop or a misconfigured backup would leak a token that can alter live tracking.

**Low — a cross-repo dependency on Geek-SEO for a single encryption helper.** `GeekApiIdentityStore.cs` imports `GeekSeo.Application.Infrastructure` for `SeoCredentialProtector`. This repo's own scope note elsewhere in this audit (`AGENTS.md`'s "What Postgres is for" section, read while auditing GeekRepository) records that several other direct consumers of Geek-SEO internals were found unauthorized and deleted on 2026-09-29. This dependency was not evaluated against that same standard — it may be a legitimate, narrow, shared utility rather than the kind of coupling that was removed elsewhere, but it's worth the same scrutiny given the pattern.

No Markdown, Postgres, retry-loop, or stub/TODO issues found in this repo — confirmed by reading every file, not by grep alone, given the small size.

## Recommended action

1. Encrypt the refresh token at rest in `FileIdentityStore`, even for the dev-only fallback — OS keychain integration or a simple local symmetric key would close the gap at low cost.
2. Confirm whether `GeekSeo.Application.Infrastructure`'s `SeoCredentialProtector` is an intentionally shared utility or a leftover coupling from before Geek-SEO's unauthorized-consumer cleanup; if the latter, extract the encryption helper to a neutral shared location instead.
