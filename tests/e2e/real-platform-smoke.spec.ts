import { expect, test } from "@playwright/test";
import { openAuthenticated, skipIfNoE2eAuth } from "./helpers";
import { authUrl, geekApiUrl } from "./platform";

test("real platform env targets production GeekOAuth and GeekAPI", async () => {
  expect(authUrl).toMatch(/^https:\/\//);
  expect(geekApiUrl).toMatch(/^https:\/\//);
});

test("signed-in dashboard loads against live GeekAPI", async ({ page }, testInfo) => {
  skipIfNoE2eAuth(testInfo);
  await openAuthenticated(page, "/");
  await expect(page.getByRole("heading", { name: "What will you create today?" })).toBeVisible();
});
