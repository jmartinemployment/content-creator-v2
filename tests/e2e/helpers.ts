import { expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

export const appOrigin = "http://127.0.0.1:3004";
export const platformOrigin = "http://127.0.0.1:4310";

export async function resetPlatform(request: APIRequestContext) {
  const response = await request.post(`${platformOrigin}/__reset`);
  expect(response.ok()).toBeTruthy();
}

export async function authenticate(context: BrowserContext, access = "e2e-access") {
  await context.addCookies([
    {
      name: "gcc_v2_access",
      value: access,
      url: appOrigin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

export async function openAuthenticated(page: Page, path: string) {
  await authenticate(page.context());
  await page.goto(path);
  // Let client effects (draft restoration/status fetch) settle before manipulating controlled inputs.
  await page.waitForTimeout(100);
}
