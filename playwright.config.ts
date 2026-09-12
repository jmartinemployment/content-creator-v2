import { defineConfig, devices } from "@playwright/test";
import { appPort, platformPort } from "./tests/e2e/ports";

// Overridable so a CLI run can stay clear of an IDE test-server already holding the defaults.
// Duplicate `-p` on dev: npm run dev is `next dev -p 3004`; appending `-p ${appPort}` wins (commander last wins).

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // The fake platform deliberately models one tenant/job; serialize scenarios around that state.
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${appPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: `node tests/e2e/fake-platform.mjs --port ${platformPort}`,
      url: `http://127.0.0.1:${platformPort}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `npm run dev -- -p ${appPort}`,
      url: `http://127.0.0.1:${appPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${appPort}`,
        NEXT_PUBLIC_AUTH_URL: `http://127.0.0.1:${platformPort}`,
        NEXT_PUBLIC_GEEK_API_URL: `http://127.0.0.1:${platformPort}`,
        NEXT_PUBLIC_GCC_V2_HUB_URL: `http://127.0.0.1:${platformPort}/hubs/gcc-v2-realtime`,
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  outputDir: process.env.E2E_OUTPUT_DIR ?? `test-results-${appPort}`,
});
