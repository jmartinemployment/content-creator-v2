function trimOrEmpty(value: string | undefined): string {
  return value?.trim() ?? "";
}

/** Empty string must not win over defaults (`??` only catches null/undefined). */
function envOr(value: string | undefined, fallback: string): string {
  const v = trimOrEmpty(value);
  return v.length > 0 ? v : fallback;
}

function resolveAppUrl(): string {
  const explicit = trimOrEmpty(process.env.NEXT_PUBLIC_APP_URL);
  if (explicit) return explicit.replace(/\/$/, "");

  // Vercel sets VERCEL_URL without a scheme (e.g. content-creator-v2-phi.vercel.app).
  const vercel = trimOrEmpty(process.env.VERCEL_URL);
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }

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
