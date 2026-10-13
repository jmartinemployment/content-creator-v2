import {
  REPURPOSE_TYPES,
  deletedPiecesLine,
  generateSourceOf,
  isRepurposeSource,
  isRepurposeType,
  lastRepurposeLines,
  nothingToWriteFromLine,
  pageOf,
  pieceButtonLabel,
  pieceOfType,
  piecesOf,
  repurposeSavedLine,
  sourceLabel,
} from "./repurpose.ts";
import type { GccArtifact } from "../../services/gcc-api.ts";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n expected ${JSON.stringify(expected)}\n actual   ${JSON.stringify(actual)}`);
  }
}

function page(id: string, type: string, name: string, status = "approved"): GccArtifact {
  return { id, createId: "c", type, name, status, createdAtUtc: "", updatedAtUtc: "", parentArtifactId: null };
}

function piece(id: string, type: string, from: GccArtifact): GccArtifact {
  return { ...page(id, type, from.name, "draft"), parentArtifactId: from.id };
}

const pillar = page("pillar", "pillar", "Automated Approval Workflows");
const blog = page("blog", "blog", "Automated Approval Workflows");
const ramp = page("ramp", "tool", "Ramp");
const bill = page("bill", "aiTool", "Bill");
// Saved by a Generate before 2026-10-12: an email that is a page of the project's own.
const oldEmail = page("old-email", "email-cold-outreach", "Automated Approval Workflows", "draft");

const pillarEmail = piece("pillar-email", "email-cold-outreach", pillar);
const pillarAd = piece("pillar-ad", "ads", pillar);
const pillarPost = piece("pillar-post", "social", pillar);
const blogEmail = piece("blog-email", "email-cold-outreach", blog);
const rampPost = piece("ramp-post", "social", ramp);

const all = [pillar, blog, ramp, bill, oldEmail, pillarAd, pillarEmail, pillarPost, blogEmail, rampPost];

// ---- which types, and which pages ---------------------------------------------------------------

assertEqual(REPURPOSE_TYPES, ["email-cold-outreach", "social", "ads"], "the three pieces, in the order offered");
assertEqual(
  ["email-cold-outreach", "emailColdOutreach", "social", "Ads"].map(isRepurposeType),
  [true, true, true, true],
  "a type is matched by its letters, as GeekAPI matches it",
);
assertEqual(
  ["pillar", "blog", "tool", "image-prompt", "email-newsletter", "", null].map(isRepurposeType),
  [false, false, false, false, false, false, false],
  "nothing else is a short piece: the other emails are disabled, not written from a page",
);

assertEqual(
  [pillar, blog, ramp, bill].map(isRepurposeSource),
  [true, true, true, true],
  "a pillar, a blog and a tool page can each be written from",
);
assertEqual(isRepurposeSource(pillarEmail), false, "a piece written from a page is not a page to write from");
assertEqual(isRepurposeSource(oldEmail), false, "nor is an email saved as a page of its own");
assertEqual(isRepurposeSource(null), false, "nothing on screen is not a page");

// ---- a page's pieces, and a piece's page --------------------------------------------------------

assertEqual(
  piecesOf(pillar, all).map((a) => a.id),
  ["pillar-email", "pillar-post", "pillar-ad"],
  "a page's pieces, in the order the three are offered, whatever order the list came in",
);
assertEqual(piecesOf(bill, all), [], "a page nothing was written from has none");
assertEqual(pieceOfType(pillar, "email-cold-outreach", all)?.id, "pillar-email", "the page's piece of one type");
assertEqual(pieceOfType(blog, "email-cold-outreach", all)?.id, "blog-email", "and another page's is its own");
assertEqual(pieceOfType(blog, "social", all), null, "a type the page has no piece of");
assertEqual(pieceOfType(pillar, "pillar", all), null, "the page is not a piece of itself");
assertEqual(pageOf(blogEmail, all)?.id, "blog", "a piece knows its page");
assertEqual(pageOf(oldEmail, all), null, "a page of the project's own has none above it");
assertEqual(pageOf(piece("orphan", "social", page("gone", "pillar", "x")), all), null, "a page that is not in the list is not guessed at");

// ---- what a piece and a page are called ---------------------------------------------------------

assertEqual(sourceLabel(pillar), "the Pillar", "the pillar is named by its type: a project has one");
assertEqual(sourceLabel(blog), "the Blog", "and so is the blog");
assertEqual(sourceLabel(ramp), "the Tool page “Ramp”", "a tool page is named with its product: a project has several");
assertEqual(sourceLabel(bill), "the Tool page “Bill”", "whichever way its type was stored");

// The pillar's email and the blog's carry the same name, the keyword. Each button says its page.
assertEqual(
  [pillarEmail, blogEmail, rampPost].map((p) => pieceButtonLabel(p, all)),
  ["From the Pillar", "From the Blog", "From the Tool page “Ramp”"],
  "a piece's button says the page it was written from",
);
assertEqual(pieceButtonLabel(oldEmail, all), "Automated Approval Workflows", "a page of its own keeps its name");

// ---- the page a Generate writes its short pieces from -------------------------------------------

assertEqual(generateSourceOf(["pillar", "blog", "tool"], all), null, "no short piece ticked: nothing to decide");
assertEqual(
  generateSourceOf(["pillar", "social"], []),
  { page: "pillar", thisRun: true },
  "Pillar ticked: the pieces are written from the Pillar this run writes",
);
assertEqual(
  generateSourceOf(["social"], [blog, pillar]),
  { page: "pillar", thisRun: false },
  "Pillar not ticked and the project has one: the saved one",
);
assertEqual(
  generateSourceOf(["blog", "social"], [pillar]),
  { page: "pillar", thisRun: false },
  "the saved Pillar, though Blog is ticked",
);
assertEqual(
  generateSourceOf(["blog", "ads"], [ramp]),
  { page: "blog", thisRun: true },
  "no Pillar: the Blog this run writes",
);
assertEqual(generateSourceOf(["ads"], [blog, ramp]), { page: "blog", thisRun: false }, "no Pillar: the saved Blog");
assertEqual(
  generateSourceOf(["tool", "ads"], [ramp, rampPost, oldEmail, piece("odd", "pillar", ramp)]),
  { page: null, thisRun: false },
  "a tool page, a piece under one and an email saved as a page of its own are not a Pillar or a Blog",
);

assertEqual(nothingToWriteFromLine(["pillar", "blog"], []), null, "no short piece ticked: nothing is said");
assertEqual(nothingToWriteFromLine(["ads"], [pillar]), null, "there is a Pillar: nothing is said");
assertEqual(nothingToWriteFromLine(["pillar", "ads"], []), null, "Pillar is ticked: nothing is said");
assertEqual(
  nothingToWriteFromLine(["tool", "ads"], [ramp]),
  "Ads is written from this project's Pillar, or from its Blog when it has no Pillar, and it has neither. Tick Pillar as well.",
  "one piece ticked with nothing to write it from",
);
assertEqual(
  nothingToWriteFromLine(["social", "email-cold-outreach"], []),
  "Email — cold outreach, Social are written from this project's Pillar, or from its Blog when it has no Pillar, and it has neither. Tick Pillar as well.",
  "several, named as the list names them and in its order",
);

// ---- what a Generate deletes before it writes ---------------------------------------------------

assertEqual(deletedPiecesLine(["pillar"], [pillar, blog], false), null, "a page with no pieces: nothing is said");
assertEqual(deletedPiecesLine([], all, false), null, "nothing ticked: nothing is said");
assertEqual(deletedPiecesLine(["image-prompt"], all, false), null, "a type that is not a page with pieces: nothing is said");
assertEqual(
  deletedPiecesLine(["blog"], all, false),
  "Writing the Blog again deletes the 1 piece written from it.",
  "one page with one piece",
);
assertEqual(
  deletedPiecesLine(["pillar"], all, false),
  "Writing the Pillar again deletes the 3 pieces written from it.",
  "one page with several",
);
assertEqual(
  deletedPiecesLine(["pillar", "blog", "tool"], all, false),
  "Writing these pages again deletes the 5 pieces written from them: 3 from the Pillar, 1 from the Blog, 1 from the Tool page “Ramp”.",
  "several pages: the total, and each page's share",
);
// Tool pages for some partners only: which pages that writes is the server's to say.
assertEqual(
  deletedPiecesLine(["pillar", "tool"], all, true),
  "Writing the Pillar again deletes the 3 pieces written from it. A tool page written this run loses the pieces written from it.",
  "tool pages narrowed to some partners are not counted, and the rule is said",
);
assertEqual(
  deletedPiecesLine(["tool"], all, true),
  "A tool page written this run loses the pieces written from it.",
  "and with nothing else ticked the rule alone is said",
);
assertEqual(deletedPiecesLine(["tool"], [pillar, ramp, bill], true), null, "no tool page has a piece: nothing is said");

// A short piece that is ticked is written once for the project: every one of its type goes first.
assertEqual(deletedPiecesLine(["ads"], [pillar, blog], false), null, "a piece the project has none of: nothing is said");
assertEqual(
  deletedPiecesLine(["email-cold-outreach"], all, false),
  "Writing Email — cold outreach again deletes the 3 this project already has.",
  "the one under the Pillar, the one under the Blog and the one saved under no page",
);
assertEqual(
  deletedPiecesLine(["email-cold-outreach"], [pillar, oldEmail], false),
  "Writing Email — cold outreach again deletes the 1 this project already has.",
  "one",
);
assertEqual(
  deletedPiecesLine(["ads", "social"], all, false),
  "Writing Social, Ads again deletes the 3 this project already has.",
  "several pieces ticked, named in the list's order",
);
assertEqual(
  deletedPiecesLine(["pillar", "email-cold-outreach"], all, false),
  "Writing the Pillar again deletes the 3 pieces written from it. Writing Email — cold outreach again deletes the 2 this project already has.",
  "the Pillar's email is counted once, with the Pillar",
);
assertEqual(
  deletedPiecesLine(["tool", "social"], all, true),
  "A tool page written this run loses the pieces written from it. Writing Social again deletes the 2 this project already has.",
  "tool pages narrowed: the post under one is certain to go, being a ticked piece, and is counted",
);

// ---- a page's last Repurpose, read back ---------------------------------------------------------

const NY = "America/New_York";
const now = new Date("2026-10-12T22:40:00Z");

assertEqual(repurposeSavedLine(0), "It saved no pieces.", "nothing saved");
assertEqual(repurposeSavedLine(1), "It saved 1 piece, listed below.", "one saved");
assertEqual(repurposeSavedLine(3), "It saved 3 pieces, listed below.", "several saved");

assertEqual(
  lastRepurposeLines(
    {
      status: "ready",
      finishedAtUtc: "2026-10-12T22:31:00Z",
      // The record as the server spells it: the saved artifact's id is `Id`.
      resultJson: JSON.stringify({ created: [{ artifact: { Id: "a" } }, { artifact: { Id: "b" } }], refusals: [] }),
    },
    now,
    NY,
    "en-US",
  ),
  ["The last Repurpose of this page finished at 6:31 PM. It saved 2 pieces, listed below."],
  "a finished Repurpose says when, and how many pieces it left",
);
assertEqual(
  lastRepurposeLines({ status: "failed", finishedAtUtc: "2026-10-12T22:31:00Z", error: "social: Refused: the social post states a figure the page it was written from does not: 75%." }, now, NY, "en-US"),
  ["The last Repurpose of this page failed at 6:31 PM: social: Refused: the social post states a figure the page it was written from does not: 75%."],
  "a failed one says why, in the server's words",
);
assertEqual(
  lastRepurposeLines({ status: "ready", finishedAtUtc: null, resultJson: null }, now, NY, "en-US"),
  ["The last Repurpose of this page finished."],
  "a record that cannot be read is not counted from",
);
