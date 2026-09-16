/**
 * Geek Content Creator → GeekOAuth → GeekAPI → GeekRepository.
 * Never call GeekRepository from this app.
 */

/**
 * Reads an env var, treating empty and whitespace-only as absent.
 *
 * `??` only falls back on null/undefined, so a var set to "" passes straight through. That is what
 * broke sign-in in production: NEXT_PUBLIC_AUTH_URL is set to an empty string on this project, the
 * default never applied, and authorizeUrl became the bare "/connect/authorize" - which `new URL()`
 * rejects with ERR_INVALID_URL, so /api/auth/start returned 500 on every attempt.
 */
function envOrDefault(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim();
  return (trimmed.length > 0 ? trimmed : fallback).replace(/\/$/, "");
}

const authUrl = envOrDefault(process.env.NEXT_PUBLIC_AUTH_URL, "https://auth.geekatyourspot.com");
// appUrl feeds redirectUri, so a wrong value here is a redirect_uri mismatch at the IdP rather than
// a visible error. When NEXT_PUBLIC_APP_URL is absent or empty, prefer the host Vercel reports over
// the localhost default - otherwise production would send users to http://localhost:3003/auth/callback.
const vercelProductionUrl = (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "").trim();
const appUrl = envOrDefault(
  process.env.NEXT_PUBLIC_APP_URL,
  vercelProductionUrl.length > 0 ? `https://${vercelProductionUrl}` : "http://localhost:3003",
);
const geekApiUrl = envOrDefault(process.env.NEXT_PUBLIC_GEEK_API_URL, "https://api.geekatyourspot.com");

export const authConfig = {
  authUrl,
  authorizeUrl: `${authUrl}/connect/authorize`,
  tokenUrl: `${authUrl}/connect/token`,
  clientId: process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID?.trim() || "geek-content-creator",
  // Always derived from appUrl. The callback lives at src/app/auth/callback, so the path is
  // fixed — an override only creates a second host that can disagree with NEXT_PUBLIC_APP_URL,
  // which is exactly what stranded the PKCE cookie and broke sign-in.
  redirectUri: `${appUrl}/auth/callback`,
  scope: "openid profile email offline_access",
  appUrl,
};

export const apiConfig = {
  baseUrl: geekApiUrl,
  seoHubUrl: envOrDefault(
    process.env.NEXT_PUBLIC_SEO_HUB_URL,
    "https://seo-api.geekatyourspot.com/hubs/seo-realtime",
  ),
  workflowHubUrl: envOrDefault(
    process.env.NEXT_PUBLIC_WORKFLOW_HUB_URL,
    `${geekApiUrl}/hubs/workflow-realtime`,
  ),
};

export const LLM_PROVIDERS = ["OpenAi", "Anthropic"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const STARTING_CONTENT_TYPES = [
  "blog",
  "pillar",
  "techArticle",
  "email",
  "linkedin",
  "x",
  "instagram",
  "imagePrompt",
  "aiTool",
] as const;

export type StartingContentType = (typeof STARTING_CONTENT_TYPES)[number];
