import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createPkcePair } from "@/app/auth/pkce";
import { PKCE_COOKIE, cookieOpts } from "@/app/auth/cookies";
import { authConfig } from "@/app/auth/config";

/** Start GeekOAuth Authorization Code + PKCE (client of existing IdP). */
export async function GET() {
  const { verifier, challenge } = createPkcePair();
  const url = new URL(authConfig.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", authConfig.clientId);
  url.searchParams.set("redirect_uri", authConfig.redirectUri);
  url.searchParams.set("scope", authConfig.scope);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", randomBytes(16).toString("base64url"));
  url.searchParams.set("prompt", "login");

  const res = NextResponse.redirect(url.toString());
  res.cookies.set(PKCE_COOKIE, verifier, cookieOpts.pkce);
  return res;
}
