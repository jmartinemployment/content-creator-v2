const authUrl = (process.env.NEXT_PUBLIC_AUTH_URL ?? "https://auth.geekatyourspot.com").replace(
  /\/$/,
  "",
);
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3004").replace(
  /\/$/,
  "",
);

export const authConfig = {
  authUrl,
  authorizeUrl: `${authUrl}/connect/authorize`,
  tokenUrl: `${authUrl}/connect/token`,
  clientId: process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID?.trim() || "geek-content-creator-v2",
  redirectUri: `${appUrl}/auth/callback`,
  scope: "openid profile email offline_access",
  appUrl,
};

export const apiConfig = {
  baseUrl: (process.env.NEXT_PUBLIC_GEEK_API_URL ?? "https://api.geekatyourspot.com").replace(
    /\/$/,
    "",
  ),
};
