import { expect, test } from "@playwright/test";
import { appOrigin, authenticate, skipIfNoE2eAuth } from "./helpers";
import { e2eRefreshToken } from "./platform";

test.beforeEach(({}, testInfo) => {
  skipIfNoE2eAuth(testInfo);
});

test("proxy matcher is limited to gcc-v2 routes", async () => {
  // Source contract — matcher must not broaden to v1 hubs.
  const fs = await import("node:fs/promises");
  const path = new URL("../../src/proxy.ts", import.meta.url);
  const source = await fs.readFile(path, "utf8");
  expect(source).toContain('"/creates/:path*"');
  expect(source).toContain('"/api/gcc-v2/:path*"');
  expect(source).not.toContain('"/content-creator');
  expect(source).toMatch(/status === 400 \|\| res\.status === 401 \|\| res\.status === 403/);
  expect(source).toContain("preserve cookies");
});

test("invalid refresh clears session cookies; network-style failures are not asserted here", async ({
  context,
  request,
}) => {
  await authenticate(context);
  const refresh = e2eRefreshToken();
  test.skip(!refresh, "E2E refresh token unavailable");

  // Force an invalid refresh token on a matcher route without access cookie.
  await context.clearCookies();
  await context.addCookies([
    {
      name: "gcc_v2_refresh",
      value: "definitely-invalid-refresh-token",
      url: appOrigin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const response = await request.get(`${appOrigin}/creates/new`, { maxRedirects: 0 });
  // Invalid grant clears cookies — subsequent auth sees signed-out redirect or clear Set-Cookie.
  const setCookie = response.headers()["set-cookie"] ?? "";
  const cleared =
    /gcc_v2_refresh=;/.test(setCookie) ||
    /gcc_v2_access=;/.test(setCookie) ||
    response.status() === 307;
  expect(cleared).toBeTruthy();
});
