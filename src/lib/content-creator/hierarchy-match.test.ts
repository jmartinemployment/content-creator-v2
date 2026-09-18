import {
  findDuplicateMatches,
  hierarchyMatchId,
  hierarchyMatchKindLabel,
  normalizeHierarchyMatchesFromApi,
} from "./hierarchy-match.ts";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n expected ${JSON.stringify(expected)}\n actual   ${JSON.stringify(actual)}`);
  }
}

// Tools arrive as structure. Five anchors under an H6 come back as one named group with hrefs
// intact — no text slice is parsed to recover them.
const toolMatches = normalizeHierarchyMatchesFromApi([
  {
    path: ["Accounting", "Top 5 Automated Data Entry Processing Tools:"],
    childHeadings: [],
    sourcePageUrl: "https://example.com/accounting",
    matchedHeading: "Top 5 Automated Data Entry Processing Tools:",
    kind: "exact-heading",
    toolsByHeading: [
      {
        heading: "Top 5 Automated Data Entry Processing Tools:",
        tools: [
          { name: "Zapier", href: "/tools/accounting/zapier" },
          { name: "QuickBooks", href: "/tools/accounting/quickbooks" },
          { name: "Lido", href: "/tools/accounting/lido" },
          { name: "Jotform", href: "/tools/accounting/jotform" },
          { name: "UiPath", href: "/tools/accounting/uipath" },
        ],
      },
    ],
  },
]);
assertEqual(toolMatches.length, 1, "one API match");
assertEqual(toolMatches[0]?.toolsByHeading.length, 1, "one tool group");
assertEqual(
  toolMatches[0]?.toolsByHeading[0]?.heading,
  "Top 5 Automated Data Entry Processing Tools:",
  "group heading",
);
assertEqual(toolMatches[0]?.toolsByHeading[0]?.tools.length, 5, "five tools on the H6");
assert(
  toolMatches[0]?.toolsByHeading[0]?.tools.every((t) => typeof t.href === "string" && t.href.length > 0),
  "each tool keeps its href",
);
assertEqual(
  toolMatches[0]?.toolsByHeading[0]?.tools.map((t) => t.name),
  ["Zapier", "QuickBooks", "Lido", "Jotform", "UiPath"],
  "tool names",
);

// A single anchor is not a tool list, and a repeated name is one tool.
const thinTools = normalizeHierarchyMatchesFromApi([
  {
    path: ["Services", "Routing"],
    childHeadings: [],
    sourcePageUrl: "https://example.com/services",
    matchedHeading: "Routing",
    kind: "exact-heading",
    toolsByHeading: [
      { heading: "Routing", tools: [{ name: "Zapier", href: "/tools/zapier" }] },
      {
        heading: "Books",
        tools: [
          { name: "QuickBooks", href: "/tools/quickbooks" },
          { name: "quickbooks", href: "/tools/quickbooks" },
        ],
      },
      { heading: "", tools: [{ name: "A" }, { name: "B" }] },
    ],
  },
]);
assertEqual(thinTools[0]?.toolsByHeading, [], "one-anchor, de-duped and unheaded groups are dropped");

// Pascal-cased payloads normalize identically.
const pascal = normalizeHierarchyMatchesFromApi([
  {
    Path: ["Services", "AI Content Creation Workflow"],
    ChildHeadings: ["Brief", "Generate"],
    SourcePageUrl: "https://geekatyourspot.com/services/ai-content",
    MatchedHeading: "AI Content Creation Workflow",
    Kind: "exact-heading",
    ToolsByHeading: [
      {
        Heading: "AI Content Creation Workflow",
        Tools: [
          { Name: "Brief", Href: "/tools/brief" },
          { Name: "Generate", Href: "/tools/generate" },
        ],
      },
    ],
  },
]);
assertEqual(pascal.length, 1, "one Pascal-cased match");
assertEqual(pascal[0]?.matchedHeading, "AI Content Creation Workflow", "exact heading");
assertEqual(pascal[0]?.kind, "exact-heading", "exact-heading kind");
assertEqual(pascal[0]?.childHeadings, ["Brief", "Generate"], "children");
assertEqual(pascal[0]?.toolsByHeading[0]?.tools.length, 2, "two tools from Pascal payload");

assertEqual(
  normalizeHierarchyMatchesFromApi([]).length,
  0,
  "unknown keyword → empty matches (outside-scope checkbox)",
);
assertEqual(
  normalizeHierarchyMatchesFromApi([{ path: [], childHeadings: [], sourcePageUrl: "", matchedHeading: "" }]).length,
  0,
  "an identity-less row is not a match",
);

// Regression: the exact API payload behind the "6 matches" screen. Same section crawled under
// www + bare host, and twin responsive copies, must all be returned and reported as defects —
// and the richer section must outrank the barren exact-slug one.
const homePath = [
  "Redefine Your Business",
  "Artificial Intelligence Use Cases",
  "Marketing",
  "Automated Ad Spend Optimization",
];
const barrenPath = [
  "AI Marketing Systems",
  "Introduction to AI Marketing Systems",
  "Ad Spend Optimization",
];
const apiSix = normalizeHierarchyMatchesFromApi([
  {
    path: barrenPath,
    childHeadings: ["Predictive Analytics for Advertising"],
    sourcePageUrl: "https://www.geekatyourspot.com/use-cases/marketing/ai-marketing-systems",
    matchedHeading: "Ad Spend Optimization",
    kind: "exact-heading",
    toolsByHeading: [],
  },
  {
    path: barrenPath,
    childHeadings: ["Predictive Analytics for Advertising"],
    sourcePageUrl: "https://geekatyourspot.com/use-cases/marketing/ai-marketing-systems",
    matchedHeading: "Ad Spend Optimization",
    kind: "exact-heading",
    toolsByHeading: [],
  },
  ...["https://www.geekatyourspot.com/", "https://www.geekatyourspot.com/", "https://geekatyourspot.com/", "https://geekatyourspot.com/"].map(
    (url) => ({
      path: homePath,
      childHeadings: [
        "Dynamic Creative Optimization:",
        "Automated Rules & Bidding:",
        "Real-Time Budget Reallocation:",
        "Data Quality Assessments:",
      ],
      sourcePageUrl: url,
      matchedHeading: "Automated Ad Spend Optimization",
      kind: "contains-heading" as const,
      toolsByHeading: [
        {
          heading: "Top AI Dynamic Optimization Tools:",
          tools: [
            { name: "Omneky", href: "/tools/marketing/omneky" },
            { name: "Smartly", href: "/tools/marketing/smartly" },
          ],
        },
      ],
    }),
  ),
]);

assertEqual(apiSix.length, 6, "all 6 API matches are returned - nothing is hidden");
const apiDupes = findDuplicateMatches(apiSix);
assertEqual(apiDupes.length, 2, "two duplicated sections reported");
assertEqual(
  apiDupes.reduce((n, d) => n + d.count, 0),
  6,
  "every duplicate row is accounted for in the report",
);
assertEqual(
  apiSix[0]?.matchedHeading,
  "Automated Ad Spend Optimization",
  "4-child section outranks the 1-child exact-slug match",
);
assertEqual(apiSix[0]?.childHeadings.length, 4, "winner keeps its 4 child headings");
assertEqual(apiSix[0]?.toolsByHeading[0]?.tools.length, 2, "winner keeps its tools");
assertEqual(
  apiSix[apiSix.length - 1]?.matchedHeading,
  "Ad Spend Optimization",
  "barren exact match ranks last",
);

// Identity collapses host and trailing-slash noise; the label is stable per kind.
assertEqual(
  hierarchyMatchId(apiSix[0]!),
  hierarchyMatchId(apiSix[1]!),
  "www and bare host share one match id",
);
assertEqual(hierarchyMatchKindLabel("exact-heading"), "Exact heading", "exact-heading label");
assertEqual(
  hierarchyMatchKindLabel("contains-page"),
  "Page URL contains keyword",
  "contains-page label",
);

console.log("hierarchy-match tests passed");
