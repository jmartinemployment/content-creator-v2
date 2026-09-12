import {
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { appPort } from "./ports";
import {
  e2eAccessToken,
  e2eRefreshToken,
  e2eViewerAccessToken,
  hasE2eAccessToken,
} from "./platform";

export const appOrigin = `http://127.0.0.1:${appPort}`;

export type GccV2RequestEntry = {
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: string;
};

const requestLogs = new WeakMap<Page, GccV2RequestEntry[]>();

function recordGccV2Request(page: Page, entry: GccV2RequestEntry) {
  const log = requestLogs.get(page);
  if (log) log.push(entry);
}

function ensureRequestLog(page: Page) {
  if (requestLogs.has(page)) return;
  const entries: GccV2RequestEntry[] = [];
  requestLogs.set(page, entries);
  page.on("request", (request) => {
    const url = new URL(request.url());
    const prefix = "/api/gcc-v2/";
    if (!url.pathname.startsWith(prefix)) return;
    const upstreamPath =
      `/api/geek-content-creator-v2/${url.pathname.slice(prefix.length)}${url.search}`;
    recordGccV2Request(page, {
      method: request.method(),
      path: upstreamPath.split("?")[0] ?? upstreamPath,
      query: Object.fromEntries(url.searchParams),
      body: request.postData() ?? undefined,
    });
  });
}

export function skipIfNoE2eAuth(testInfo: TestInfo) {
  if (!hasE2eAccessToken()) {
    testInfo.skip(true, "Set E2E_ACCESS_TOKEN for real-platform e2e (tests/e2e/README.md).");
  }
}

/** Fault-injection hooks existed only on the removed fake platform. */
export function skipIfScenarioInjectionRequired(testInfo: TestInfo) {
  testInfo.skip(
    true,
    "Scenario injection is not available on the real platform.",
  );
}

export function skipIfNoViewerToken(testInfo: TestInfo) {
  if (!e2eViewerAccessToken()) {
    testInfo.skip(true, "Set E2E_VIEWER_ACCESS_TOKEN for viewer-role e2e.");
  }
}

/** @deprecated No-op — real platform state is not reset between tests. */
export async function resetPlatform(_request: APIRequestContext) {
  // intentionally empty
}

export function getGccV2RequestLog(page: Page): GccV2RequestEntry[] {
  return requestLogs.get(page) ?? [];
}

export async function authenticate(context: BrowserContext) {
  const access = e2eAccessToken();
  const cookies: Array<{
    name: string;
    value: string;
    url: string;
    httpOnly: boolean;
    sameSite: "Lax";
  }> = [
    {
      name: "gcc_v2_access",
      value: access,
      url: appOrigin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ];
  const refresh = e2eRefreshToken();
  if (refresh) {
    cookies.push({
      name: "gcc_v2_refresh",
      value: refresh,
      url: appOrigin,
      httpOnly: true,
      sameSite: "Lax",
    });
  }
  await context.addCookies(cookies);
}

export async function authenticateViewer(context: BrowserContext) {
  const access = e2eViewerAccessToken();
  if (!access) {
    throw new Error("Set E2E_VIEWER_ACCESS_TOKEN for viewer-role e2e.");
  }
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
  ensureRequestLog(page);
  await authenticate(page.context());
  await page.goto(path);
  // Let client effects (draft restoration/status fetch) settle before manipulating controlled inputs.
  await page.waitForTimeout(100);
}

export function expectRequestLogContains(
  page: Page,
  predicate: (entry: GccV2RequestEntry) => boolean,
) {
  const match = getGccV2RequestLog(page).find(predicate);
  expect(match).toBeTruthy();
  return match as GccV2RequestEntry;
}
