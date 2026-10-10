# GeekOAuth — Code Audit

**Date:** 2026-10-09

## Scope and method

GeekOAuth is a small, focused repo (~6,000 lines) and was read close to end-to-end on the security-critical surface, given its role as the sign-in provider for every app in this system. Full reads: `TimingSafePasswordVerifier.cs`, `UserAuthenticationService.cs`, `ForwardedHeadersConfiguration.cs`, `SecurityHeadersMiddleware.cs`, `RateLimitExtensions.cs`, `SigningCertificateLoader.cs`, the opening of `AuthorizationController.cs` (PKCE/authorize flow), `UserRepository.cs`'s query layer, and a full grep/read of `OidcPublicClientSeeds.cs` (562 lines) for every registered client's redirect URIs. Not read in this pass: the full `AuthorizationController.cs` token-exchange body, the Razor Pages under `Pages/Account/*`, the EF migrations, and `ClientSeeder.cs`/`ScopeSeeder.cs`'s full bodies.

## What this is

An OpenIddict-based OAuth2/OIDC provider (ASP.NET Core) issuing tokens for every first-party app in this system via Authorization Code + PKCE. Postgres-backed (Dapper for the user store, EF/OpenIddict for client/token state) — this is the one legitimate, intended use of Railway Postgres per the system's own "Postgres is OAuth only" rule (see the GeekRepository report).

## Findings

**Positive — timing-safe login, done correctly.** `TimingSafePasswordVerifier.cs` + `UserAuthenticationService.cs` run a dummy password-hash verification on every login path that doesn't reach a real password check (unknown email, unconfirmed email) — a standard, correctly-applied mitigation against timing-based user enumeration. Confirmed by reading both files in full: the dummy hash is precomputed once at startup, and every early-return path calls `RunDummyVerification` before returning, so a failed lookup and a failed password check take indistinguishable time.

**Positive — forwarded-header trust is opt-in and fails safe.** `ForwardedHeadersConfiguration.cs` only trusts `X-Forwarded-For`/`X-Forwarded-Proto` from an explicitly configured CIDR/IP allowlist (`TRUSTED_PROXY_CIDRS`/`TRUSTED_PROXY_IPS`); with neither set, it falls back to ASP.NET's loopback-only default rather than trusting every client. This is the correct default for a service that can be deployed behind different proxies in different environments.

**Positive — CSP `form-action` is a real allowlist, not a wildcard, confirmed by reading the whole file.** `SecurityHeadersMiddleware.cs` builds a per-request CSP that only reflects a `redirect_uri`'s origin into `form-action` when that origin is either loopback/localhost (explicitly scoped to local development) or an HTTPS host matching a hardcoded list of this system's own apex domain and its known Vercel preview-host patterns (`IsTrustedClientHost`). It does not accept an arbitrary origin from the request.

**Low — the client registry confirms the earlier ID2043 redirect-mismatch bug (referenced in content-creator-v2's project memory) is currently fixed, cross-checked directly rather than assumed.** `OidcPublicClientSeeds.cs`'s `geek-content-creator-v2` client is registered with redirect URI `https://content-creator-v2-phi.vercel.app/auth/callback`, matching content-creator-v2's own `.env.example` exactly. No drift found between any of the nine registered clients (`geek-seo-electron`, `geekseo`, `geek-admin`, `geek-content-workflow`, `geek-content-creator`, `geek-content-creator-v2`, `geek-crawler`, `geek-image-generator`, `content-writer-v3`) and the redirect hosts I could cross-check from other repos' configs in this audit.

**Not independently verified**: SQL-injection risk in the Dapper user-store layer was spot-checked, not fully audited — every query sampled in `UserRepository.cs` (`FindByIdAsync`, `FindByNameAsync`, `FindByEmailAsync`, `CreateAsync`) uses parameterized Dapper calls (`@UserId`, `@Name`, `@Email`) with no string concatenation of user input into SQL text. The remaining ~300 lines of that file were not individually checked for the same pattern.

No Markdown, no Postgres-boundary violation (this is the one service meant to use Postgres), no retry-loop, and no TODO/stub issues found in the files read.

## Recommended action

1. No urgent action from this pass — the security-critical paths read (timing-safe auth, forwarded-header trust, CSP, parameterized SQL, client redirect URIs) are all sound.
2. A deeper pass should finish reading `UserRepository.cs` in full for the same parameterization check, and read `AuthorizationController.cs`'s token-exchange and refresh-token rotation logic, which this pass did not reach.
