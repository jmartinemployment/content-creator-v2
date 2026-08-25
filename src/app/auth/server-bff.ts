import { cookies, headers } from "next/headers";

/**
 * Server Component fetch to our own BFF (`/api/gcc-v2/*`) forwarding session cookies so
 * `getAccessTokenWithRefresh` can run in the route handler — avoids calling GeekAPI directly
 * from RSC (which bypasses refresh and hardcodes API URLs).
 */
export async function fetchGccV2(path: string, init?: RequestInit): Promise<Response> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) throw new Error("Cannot resolve app host for BFF fetch.");

  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const url = `${proto}://${host}/api/gcc-v2/${path.replace(/^\//, "")}`;
  return fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
      cookie: cookieHeader,
    },
  });
}
