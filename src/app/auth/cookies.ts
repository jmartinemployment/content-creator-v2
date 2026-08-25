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
    maxAge: 600,
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
