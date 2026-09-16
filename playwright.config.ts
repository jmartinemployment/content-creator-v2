import { defineConfig, devices } from "@playwright/test";
import { appPort } from "./tests/e2e/ports";
import { nextDevPlatformEnv } from "./tests/e2e/platform";

const appOrigin = `http://127.0.0.1:${appPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: appOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- -p ${appPort}`,
    url: appOrigin,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: nextDevPlatformEnv(appOrigin),
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: process.env.E2E_OUTPUT_DIR ?? `test-results-${appPort}`,
});
