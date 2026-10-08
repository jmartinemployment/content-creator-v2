/**
 * A browser for the component tests. Loaded before the tests by the test script (`--import`), so a
 * test that renders a component finds `window` and `document` where React expects them.
 *
 * Every property of the jsdom window that node does not already define is exposed on the global as
 * a live getter, so the two never hold different objects. What node defines -- `fetch`, `navigator`,
 * `URL`, the timers -- stays node's: a test stubs `fetch` on the global and the page's requests go
 * through the stub.
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

const page = dom.window as unknown as Record<string, unknown>;
const global = globalThis as unknown as Record<string, unknown>;

for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (key in global) continue;
  Object.defineProperty(globalThis, key, {
    configurable: true,
    enumerable: true,
    get: () => page[key],
  });
}

// React warns, and testing-library's `render` refuses to wrap updates in `act`, without this flag.
global.IS_REACT_ACT_ENVIRONMENT = true;
