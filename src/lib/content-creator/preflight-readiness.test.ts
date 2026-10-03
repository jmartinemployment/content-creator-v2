import {
  everyPartnerFailedExtraction,
  type PreflightPartnerCounts,
} from "./preflight-readiness.ts";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

const failed = (n: number): PreflightPartnerCounts => ({ pagesAttempted: n, pagesFailed: n });
const partial = (a: number, f: number): PreflightPartnerCounts => ({ pagesAttempted: a, pagesFailed: f });
const noPages: PreflightPartnerCounts = { pagesAttempted: 0, pagesFailed: 0 };

// The reported failure: a 429 kills four partners while a fifth retrieved nothing for this angle.
// With `pagesAttempted > 0` inside .every(), the fifth returned false and the headline reverted to
// "0 of 5 can be grounded" -- blaming the operator's data for a billing failure.
assert(
  everyPartnerFailedExtraction([failed(21), failed(23), failed(21), failed(22), noPages]),
  "a zero-page partner must not mask a provider fault across the others",
);

// The plain case.
assert(
  everyPartnerFailedExtraction([failed(21), failed(23)]),
  "every partner failing every page is a provider fault",
);

// One partial success is a real mixed signal: something was extracted, so the counts mean something
// and the headline must go back to reporting readiness rather than a fault.
assert(
  !everyPartnerFailedExtraction([failed(21), partial(23, 2)]),
  "a partner with some pages extracted is not a total provider fault",
);

// All-zero is not a provider fault -- nothing was attempted, so nothing failed. Without the `.some()`
// guard this returns true vacuously and claims an outage that did not happen.
assert(
  !everyPartnerFailedExtraction([noPages, noPages]),
  "partners that attempted nothing are not evidence of a fault",
);

// Empty list: no partners, no claim.
assert(!everyPartnerFailedExtraction([]), "an empty preflight asserts nothing");

// A single partner is enough to report a fault when it is the only one.
assert(everyPartnerFailedExtraction([failed(12)]), "one partner, all pages failed, is a fault");

console.log("preflight-readiness.test.ts: all assertions passed");
