import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  PKCE_COOKIE,
  REFRESH_COOKIE,
  cookieOpts,
} from "@/app/auth/cookies";
import { exchangeAuthorizationCode } from "@/app/auth/tokens";

export async function POST(request: Request) {
  const { code } = (await request.json()) as { code?: string };
  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  const jar = await cookies();
  const verifier = jar.get(PKCE_COOKIE)?.value;
  if (!verifier) {
    // Recoverable, and the only recovery is starting over: the authorization code is single-use and
    // already spent, so there is nothing to retry with. Tell the client to restart rather than
    // leaving it on a dead end.
    return NextResponse.json(
      { error: "Sign-in session expired", restart: true },
      { status: 400 },
    );
  }

  try {
    const tokens = await exchangeAuthorizationCode(code, verifier);
    const res = NextResponse.json({
      ok: true,
      hasRefresh: Boolean(tokens.refresh_token),
    });
    if (tokens.refresh_token) {
      res.cookies.set(REFRESH_COOKIE, tokens.refresh_token, cookieOpts.refresh);
    }
    const maxAge = Math.max(30, Math.min(tokens.expires_in - 60, 60 * 10));
    res.cookies.set(ACCESS_COOKIE, tokens.access_token, {
      ...cookieOpts.access,
      maxAge,
    });
    res.cookies.set(PKCE_COOKIE, "", cookieOpts.clear);
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token exchange failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
