function trimOrEmpty(value: string | undefined): string {
  return value?.trim() ?? "";
}

function envOr(name: string, fallback: string): string {
  const v = trimOrEmpty(process.env[name]);
  return v.length > 0 ? v.replace(/\/$/, "") : fallback;
}

const defaultAuthUrl = "https://auth.geekatyourspot.com";
const defaultGeekApiUrl = "https://api.geekatyourspot.com";

/** GeekOAuth IdP used by the app BFF and browser OAuth start. */
export const authUrl = envOr("E2E_AUTH_URL", envOr("NEXT_PUBLIC_AUTH_URL", defaultAuthUrl));

/** GeekAPI base — BFF proxy target and default SignalR host. */
export const geekApiUrl = envOr(
  "E2E_GEEK_API_URL",
  envOr("NEXT_PUBLIC_GEEK_API_URL", defaultGeekApiUrl),
);

export const hubUrl = envOr("E2E_GCC_V2_HUB_URL", `${geekApiUrl}/hubs/gcc-v2-realtime`);

export function hasE2eAccessToken(): boolean {
  return trimOrEmpty(process.env.E2E_ACCESS_TOKEN).length > 0;
}

export function e2eAccessToken(): string {
  const token = trimOrEmpty(process.env.E2E_ACCESS_TOKEN);
  if (!token) {
    throw new Error(
      "Set E2E_ACCESS_TOKEN to a valid GeekOAuth access token (see tests/e2e/README.md).",
    );
  }
  return token;
}

export function e2eRefreshToken(): string | undefined {
  const token = trimOrEmpty(process.env.E2E_REFRESH_TOKEN);
  return token.length > 0 ? token : undefined;
}

export function e2eViewerAccessToken(): string | undefined {
  const token = trimOrEmpty(process.env.E2E_VIEWER_ACCESS_TOKEN);
  return token.length > 0 ? token : undefined;
}

/** Playwright `webServer` env for `next dev`. */
export function nextDevPlatformEnv(appOrigin: string): Record<string, string> {
  return {
    NEXT_PUBLIC_APP_URL: appOrigin,
    NEXT_PUBLIC_AUTH_URL: authUrl,
    NEXT_PUBLIC_GEEK_API_URL: geekApiUrl,
    NEXT_PUBLIC_GCC_V2_HUB_URL: hubUrl,
  };
}
