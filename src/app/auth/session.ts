import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  cookieOpts,
} from "@/app/auth/cookies";
import {
  isAccessTokenFresh,
  isSessionDeadError,
  refreshAccessToken,
} from "@/app/auth/tokens";

/**
 * Read-only session lookup, safe in Server Components.
 * Cookie refresh belongs in proxy.ts (cannot write cookies during RSC render).
 * Stale JWT access cookies are treated as missing so pages fail closed to sign-in.
 */
export const getAccessToken = cache(async (): Promise<string | null> => {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value ?? null;
  if (!token || !isAccessTokenFresh(token)) return null;
  return token;
});

/** Route Handlers only — may write cookies. Refreshes when access is missing or stale. */
export async function getAccessTokenWithRefresh(): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(ACCESS_COOKIE)?.value;
  if (existing && isAccessTokenFresh(existing)) return existing;

  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (!refresh) {
    if (existing) {
      jar.set(ACCESS_COOKIE, "", cookieOpts.clear);
    }
    return null;
  }

  try {
    const tokens = await refreshAccessToken(refresh);
    if (tokens.refresh_token) {
      jar.set(REFRESH_COOKIE, tokens.refresh_token, cookieOpts.refresh);
    }
    const maxAge = Math.max(30, Math.min(tokens.expires_in - 60, 60 * 10));
    jar.set(ACCESS_COOKIE, tokens.access_token, {
      ...cookieOpts.access,
      maxAge,
    });
    return tokens.access_token;
  } catch (error) {
    if (isSessionDeadError(error)) {
      jar.set(REFRESH_COOKIE, "", cookieOpts.clear);
      jar.set(ACCESS_COOKIE, "", cookieOpts.clear);
    } else if (existing && !isAccessTokenFresh(existing)) {
      // Stale access with a transient refresh failure — do not keep serving the dead bearer.
      jar.set(ACCESS_COOKIE, "", cookieOpts.clear);
    }
    return null;
  }
}

export async function requireAccessToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) redirect("/api/auth/start");
  return token;
}
