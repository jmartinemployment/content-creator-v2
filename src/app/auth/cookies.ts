export const REFRESH_COOKIE = "gcc_v2_refresh";
export const ACCESS_COOKIE = "gcc_v2_access";
export const PKCE_COOKIE = "gcc_v2_pkce_verifier";

const secure =
  process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

export const cookieOpts = {
  pkce: {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    // The verifier must outlive the whole IdP round trip. prompt=login forces a full
    // re-authentication - password, MFA, consent - which regularly takes longer than ten minutes if
    // the operator is interrupted. When it expires the exchange fails with "Sign-in session expired"
    // and the authorization code is already spent, so the only recovery is starting over.
    maxAge: 60 * 30,
  },
  refresh: {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  },
  access: {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 5,
  },
  clear: {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  },
};
