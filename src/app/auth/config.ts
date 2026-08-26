function trimOrEmpty(value: string | undefined): string {
  return value?.trim() ?? "";
}

/** Empty string must not win over defaults (`??` only catches null/undefined). */
function envOr(value: string | undefined, fallback: string): string {
  const v = trimOrEmpty(value);
  return v.length > 0 ? v : fallback;
}

function hostFromEnv(value: string): string {
  return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function resolveAppUrl(): string {
  // Stable origin for OAuth redirect_uri — must match a GeekOAuth-registered URI.
  const explicit = trimOrEmpty(process.env.NEXT_PUBLIC_APP_URL);
  if (explicit) return explicit.replace(/\/$/, "");

  // Phase 0: on Vercel, always use the stable phi host — ephemeral *-hash-*.vercel.app
  // preview URLs break OAuth CSP. Local stays below.
  if (trimOrEmpty(process.env.VERCEL)) {
    return "https://content-creator-v2-phi.vercel.app";
  }

  // Prefer the project production host over ephemeral deployment URLs
  // (VERCEL_URL is often content-creator-v2-<hash>-….vercel.app on previews).
  const production = trimOrEmpty(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (production) return `https://${hostFromEnv(production)}`;

  const vercel = trimOrEmpty(process.env.VERCEL_URL);
  if (vercel) return `https://${hostFromEnv(vercel)}`;

  return "http://localhost:3004";
}

const authUrl = envOr(process.env.NEXT_PUBLIC_AUTH_URL, "https://auth.geekatyourspot.com").replace(
  /\/$/,
  "",
);
const appUrl = resolveAppUrl();

export const authConfig = {
  authUrl,
  authorizeUrl: `${authUrl}/connect/authorize`,
  tokenUrl: `${authUrl}/connect/token`,
  clientId: envOr(process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID, "geek-content-creator-v2"),
  redirectUri: `${appUrl}/auth/callback`,
  scope: "openid profile email offline_access",
  appUrl,
};

export const apiConfig = {
  baseUrl: envOr(process.env.NEXT_PUBLIC_GEEK_API_URL, "https://api.geekatyourspot.com").replace(
    /\/$/,
    "",
  ),
};
