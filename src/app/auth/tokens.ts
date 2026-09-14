import { authConfig } from "@/app/auth/config";

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

/** Seconds before JWT `exp` when we treat the access token as needing refresh. */
export const ACCESS_TOKEN_REFRESH_SKEW_SECONDS = 60;

export async function exchangeAuthorizationCode(
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: authConfig.clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri: authConfig.redirectUri,
  });
  return postToken(body);
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: authConfig.clientId,
    refresh_token: refreshToken,
  });
  return postToken(body);
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(authConfig.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Token request failed (${res.status})`);
  }
  return res.json() as Promise<TokenResponse>;
}

export function isSessionDeadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /invalid_grant|invalid_token|expired_token/i.test(msg);
}

/**
 * Read JWT `exp` (unix seconds) without verifying the signature.
 * Used only to decide refresh timing — GeekAPI still validates the bearer.
 */
export function readAccessTokenExpiryUnix(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(
      parts[1]!.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp
      : null;
  } catch {
    return null;
  }
}

/**
 * True when the access token should still be sent to APIs.
 * JWT: requires `exp` more than skew seconds in the future.
 * Opaque / non-JWT: cannot judge claims — treat as fresh (cookie lifetime is the gate).
 */
export function isAccessTokenFresh(
  token: string,
  nowUnixSeconds: number = Math.floor(Date.now() / 1000),
  skewSeconds: number = ACCESS_TOKEN_REFRESH_SKEW_SECONDS,
): boolean {
  const trimmed = token.trim();
  if (!trimmed) return false;
  const exp = readAccessTokenExpiryUnix(trimmed);
  if (exp === null) return true;
  return exp > nowUnixSeconds + skewSeconds;
}
