import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOpts } from "@/app/auth/cookies";
import { authConfig } from "@/app/auth/config";
import { isAccessTokenFresh } from "@/app/auth/tokens";

/**
 * Refreshes the access token before the request reaches any Server Component.
 * Proxy runs before rendering and can set response cookies.
 *
 * Session policy:
 * - Refresh when access cookie is missing OR JWT is expired / within skew
 * - 2xx: rotate access (+ refresh if rotated)
 * - 400/401/403: clear cookies (invalid/denied refresh)
 * - network / 5xx: preserve refresh; clear stale access so we do not send a dead bearer
 */
export async function proxy(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const accessFresh = Boolean(access && isAccessTokenFresh(access));

  if (accessFresh) return NextResponse.next();

  if (!refresh) {
    if (access && !accessFresh) {
      const dead = NextResponse.next();
      dead.cookies.set(ACCESS_COOKIE, "", cookieOpts.clear);
      return dead;
    }
    return NextResponse.next();
  }

  let tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  try {
    const res = await fetchTokenOnce(refresh);
    if (!res.ok) {
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        const dead = NextResponse.next();
        dead.cookies.set(REFRESH_COOKIE, "", cookieOpts.clear);
        dead.cookies.set(ACCESS_COOKIE, "", cookieOpts.clear);
        return dead;
      }
      // 5xx / other: preserve refresh — do not treat as invalid grant.
      // Drop stale access so RSC/BFF do not present an expired bearer as signed-in.
      if (access && !accessFresh) {
        const degraded = NextResponse.next();
        degraded.cookies.set(ACCESS_COOKIE, "", cookieOpts.clear);
        return degraded;
      }
      return NextResponse.next();
    }
    tokens = await res.json();
  } catch {
    if (access && !accessFresh) {
      const degraded = NextResponse.next();
      degraded.cookies.set(ACCESS_COOKIE, "", cookieOpts.clear);
      return degraded;
    }
    return NextResponse.next();
  }

  const headers = new Headers(request.headers);
  const jar = request.cookies;
  jar.set(ACCESS_COOKIE, tokens.access_token);
  if (tokens.refresh_token) jar.set(REFRESH_COOKIE, tokens.refresh_token);
  headers.set("cookie", jar.toString());

  const response = NextResponse.next({ request: { headers } });
  const maxAge = Math.max(30, Math.min(tokens.expires_in - 60, 60 * 10));
  response.cookies.set(ACCESS_COOKIE, tokens.access_token, {
    ...cookieOpts.access,
    maxAge,
  });
  if (tokens.refresh_token) {
    response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, cookieOpts.refresh);
  }
  return response;
}

async function fetchTokenOnce(refresh: string): Promise<Response> {
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: authConfig.clientId,
      refresh_token: refresh,
    }).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  };
  try {
    return await fetch(authConfig.tokenUrl, init);
  } catch (first) {
    // One bounded retry for transient network blips.
    try {
      return await fetch(authConfig.tokenUrl, init);
    } catch {
      throw first;
    }
  }
}

export const config = {
  matcher: [
    "/",
    "/creates/:path*",
    "/crawls/:path*",
    "/agents/:path*",
    "/skills/:path*",
    "/legacy/:path*",
    "/api/gcc-v2/:path*",
    "/api/geek-crawler/:path*",
    "/api/rag/:path*",
  ],
};
