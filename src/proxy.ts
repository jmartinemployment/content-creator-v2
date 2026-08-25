import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOpts } from "@/app/auth/cookies";
import { authConfig } from "@/app/auth/config";

/**
 * Refreshes the access token before the request reaches any Server Component.
 * Proxy runs before rendering and can set response cookies.
 */
export async function proxy(request: NextRequest) {
  const hasAccess = Boolean(request.cookies.get(ACCESS_COOKIE)?.value);
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  if (hasAccess || !refresh) return NextResponse.next();

  let tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  try {
    const res = await fetch(authConfig.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: authConfig.clientId,
        refresh_token: refresh,
      }).toString(),
      cache: "no-store",
    });
    if (!res.ok) {
      const dead = NextResponse.next();
      dead.cookies.set(REFRESH_COOKIE, "", cookieOpts.clear);
      dead.cookies.set(ACCESS_COOKIE, "", cookieOpts.clear);
      return dead;
    }
    tokens = await res.json();
  } catch {
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

export const config = {
  matcher: ["/", "/creates/:path*", "/legacy/:path*", "/api/gcc-v2/:path*"],
};
