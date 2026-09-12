import { expect, test } from "@playwright/test";
import { appOrigin, authenticate, skipIfNoE2eAuth } from "./helpers";
import { e2eAccessToken, e2eRefreshToken } from "./platform";

test.beforeEach(({}, testInfo) => {
  skipIfNoE2eAuth(testInfo);
});

test("BFF rejects missing sessions", async ({ request }) => {
  const unauthorized = await request.get(`${appOrigin}/api/rag/status`);
  expect(unauthorized.status()).toBe(401);
  expect(await unauthorized.json()).toEqual({ error: "Unauthorized — sign in required" });
});

test("BFF rejects object bytes on gcc-v2 upload control routes", async ({ request }) => {
  const response = await request.post(`${appOrigin}/api/gcc-v2/knowledge/uploads`, {
    headers: {
      cookie: `gcc_v2_access=${e2eAccessToken()}`,
      "content-type": "application/octet-stream",
    },
    data: Buffer.alloc(32, 1),
  });
  expect(response.status()).toBe(415);
  await expect(response.json()).resolves.toEqual({
    error: "File bytes must be uploaded directly to the issued storage URL.",
  });
});

test("signed-out SSR redirects to OAuth start", async ({ page }) => {
  const signedOut = await page.request.get(`${appOrigin}/rag`, { maxRedirects: 0 });
  expect(signedOut.status()).toBe(307);
  expect(signedOut.headers().location).toBe("/api/auth/start");
});

test("logout clears both session cookies", async ({ page, context }) => {
  await authenticate(context);
  const refresh = e2eRefreshToken();
  if (refresh) {
    await context.addCookies([
      { name: "gcc_v2_refresh", value: refresh, url: appOrigin, httpOnly: true, sameSite: "Lax" },
    ]);
  }
  const response = await page.request.post(`${appOrigin}/api/auth/logout`, { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  const setCookie = response.headers()["set-cookie"];
  expect(setCookie).toContain("gcc_v2_access=");
  expect(setCookie).toContain("gcc_v2_refresh=");
});
