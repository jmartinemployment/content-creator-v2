import { expect, test } from "@playwright/test";
import { appOrigin, authenticate, platformOrigin, resetPlatform } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetPlatform(request);
});

test("GCC and RAG BFFs preserve method, query, body, and bearer token", async ({ request }) => {
  const gcc = await request.post(`${appOrigin}/api/gcc-v2/echo?mode=exact&n=2`, {
    headers: { cookie: "gcc_v2_access=e2e-access", "content-type": "application/json" },
    data: { title: "forward me" },
  });
  expect(gcc.status()).toBe(200);
  expect(await gcc.json()).toMatchObject({
    query: { mode: "exact", n: "2" },
    authorization: "Bearer e2e-access",
  });
  expect(JSON.parse((await gcc.json()).body)).toEqual({ title: "forward me" });

  const rag = await request.put(`${appOrigin}/api/rag/echo?intent=technical`, {
    headers: { cookie: "gcc_v2_access=e2e-access", "content-type": "text/plain" },
    data: "verbatim body",
  });
  expect(await rag.json()).toMatchObject({
    query: { intent: "technical" },
    body: "verbatim body",
    authorization: "Bearer e2e-access",
  });
});

test("BFF preserves upstream non-JSON errors and rejects missing sessions", async ({ request }) => {
  const upstreamError = await request.get(`${appOrigin}/api/gcc-v2/non-json`, {
    headers: { cookie: "gcc_v2_access=e2e-access" },
  });
  expect(upstreamError.status()).toBe(502);
  expect(await upstreamError.text()).toBe("upstream exploded");
  expect(upstreamError.headers()["x-fake-upstream"]).toBe("preserved");

  const unauthorized = await request.get(`${appOrigin}/api/rag/status`);
  expect(unauthorized.status()).toBe(401);
  expect(await unauthorized.json()).toEqual({ error: "Unauthorized — sign in required" });
});

test("BFF refreshes access cookies and clears dead sessions", async ({ request }) => {
  const refreshed = await request.get(`${appOrigin}/api/gcc-v2/echo?refresh=yes`, {
    headers: { cookie: "gcc_v2_refresh=valid-refresh" },
  });
  expect(refreshed.status()).toBe(200);
  expect((await refreshed.json()).authorization).toBe("Bearer refreshed-access");
  expect(refreshed.headers()["set-cookie"]).toContain("gcc_v2_access=refreshed-access");

  const dead = await request.get(`${appOrigin}/api/gcc-v2/echo`, {
    headers: { cookie: "gcc_v2_refresh=dead-refresh" },
  });
  expect(dead.status()).toBe(401);
  expect(dead.headers()["set-cookie"]).toContain("gcc_v2_refresh=");
});

test("signed-out SSR redirects and fake OAuth completes PKCE exchange", async ({ page, context }) => {
  const signedOut = await page.request.get(`${appOrigin}/rag`, { maxRedirects: 0 });
  expect(signedOut.status()).toBe(307);
  expect(signedOut.headers().location).toBe("/api/auth/start");

  await page.goto("/api/auth/start");
  await expect(page).toHaveURL(`${appOrigin}/`);
  const cookies = await context.cookies(appOrigin);
  expect(cookies.find((cookie) => cookie.name === "gcc_v2_access")?.value).toBe("oauth-access");
  expect(cookies.find((cookie) => cookie.name === "gcc_v2_pkce_verifier")).toBeUndefined();

  const log = await (await page.request.get(`${platformOrigin}/__requests`)).json();
  const authorize = log.find((entry: { path: string }) => entry.path === "/connect/authorize");
  const token = log.find((entry: { path: string }) => entry.path === "/connect/token");
  expect(authorize.query.code_challenge_method).toBe("S256");
  expect(authorize.query.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(token.form.code_verifier.length).toBeGreaterThanOrEqual(43);
});

test("logout clears both session cookies", async ({ page, context }) => {
  await authenticate(context);
  await context.addCookies([{ name: "gcc_v2_refresh", value: "valid-refresh", url: appOrigin, httpOnly: true, sameSite: "Lax" }]);
  const response = await page.request.post(`${appOrigin}/api/auth/logout`, { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  const setCookie = response.headers()["set-cookie"];
  expect(setCookie).toContain("gcc_v2_access=");
  expect(setCookie).toContain("gcc_v2_refresh=");
});
