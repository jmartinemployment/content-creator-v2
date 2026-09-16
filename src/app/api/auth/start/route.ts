import { NextResponse } from "next/server";
import { createPkcePair, randomOAuthState } from "@/app/auth/pkce";
import { PKCE_COOKIE, cookieOpts } from "@/app/auth/cookies";
import { authConfig } from "@/app/auth/config";

export const runtime = "nodejs";

/** Start GeekOAuth Authorization Code + PKCE (client of existing IdP). */
export async function GET() {
  try {
    if (!authConfig.authorizeUrl.startsWith("http")) {
      throw new Error(
        `Invalid authorize URL "${authConfig.authorizeUrl}". Set NEXT_PUBLIC_AUTH_URL on Vercel.`,
      );
    }

    const { verifier, challenge } = await createPkcePair();
    const url = new URL(authConfig.authorizeUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", authConfig.clientId);
    url.searchParams.set("redirect_uri", authConfig.redirectUri);
    url.searchParams.set("scope", authConfig.scope);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", randomOAuthState());
    url.searchParams.set("prompt", "login");

    const res = NextResponse.redirect(url.toString());
    res.cookies.set(PKCE_COOKIE, verifier, cookieOpts.pkce);
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth start failed";
    console.error("[auth/start]", message, {
      authorizeUrl: authConfig.authorizeUrl,
      redirectUri: authConfig.redirectUri,
      clientId: authConfig.clientId,
      appUrl: authConfig.appUrl,
    });
    return NextResponse.json(
      {
        error: message,
        redirectUri: authConfig.redirectUri,
        appUrl: authConfig.appUrl,
      },
      { status: 500 },
    );
  }
}
