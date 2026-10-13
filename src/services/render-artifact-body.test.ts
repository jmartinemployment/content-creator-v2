import { deckFacts, renderArtifactBody } from "./gcc-api.ts";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n expected ${JSON.stringify(expected)}\n actual   ${JSON.stringify(actual)}`);
  }
}

// An email is a subject, a body and the text of its button. It drew its body alone, and as markup.
assertEqual(
  renderArtifactBody(
    JSON.stringify({
      subject: "Cut approval time by 60%",
      body: "An invoice waits four days.\n\nRule-based routing cut that by 60%.\nIt took a week to set up.",
      ctaLabel: "Read the guide",
      imagePrompt: { prompt: "a ledger on a desk" },
    }),
  ),
  [
    "<p><strong>Subject:</strong> Cut approval time by 60%</p>",
    "<p>An invoice waits four days.</p>",
    "<p>Rule-based routing cut that by 60%.<br>It took a week to set up.</p>",
    "<p><strong>Button text:</strong> Read the guide</p>",
  ].join("\n"),
  "an email shows its subject, its body as paragraphs and its button text",
);

// What the model wrote is text. Read as markup, a body could put anything on the page.
assertEqual(
  renderArtifactBody(
    JSON.stringify({ subject: "A <b>subject</b>", body: "<img src=x onerror=alert(1)> & more", ctaLabel: "\"Go\"" }),
  ),
  [
    "<p><strong>Subject:</strong> A &lt;b&gt;subject&lt;/b&gt;</p>",
    "<p>&lt;img src=x onerror=alert(1)&gt; &amp; more</p>",
    "<p><strong>Button text:</strong> &quot;Go&quot;</p>",
  ].join("\n"),
  "an email's fields are escaped, never read as markup",
);

// A social post or an ad is its text. It had no drawing at all and showed as raw data.
assertEqual(
  renderArtifactBody(JSON.stringify({ text: "Approvals stall on signatures.\n\nRoute by rule.", imagePrompt: { prompt: "a path" } })),
  "<p>Approvals stall on signatures.</p>\n<p>Route by rule.</p>",
  "a post shows its text as paragraphs",
);
assertEqual(
  renderArtifactBody(JSON.stringify({ text: "A post with <script>." })),
  "<p>A post with &lt;script&gt;.</p>",
  "and its text is escaped",
);

// Nothing else is taken for a short piece.
assertEqual(
  renderArtifactBody(JSON.stringify({ title: "A page", body: { lede: { heading: "", paragraphs: [{ runs: [{ text: "The hook." }] }] }, sections: [] } })),
  "<h1>A page</h1>\n<p>The hook.</p>",
  "a page is still drawn from its document",
);
assertEqual(
  renderArtifactBody(JSON.stringify({ prompt: "a ledger on a desk", negativePrompt: "text" })),
  "<p><strong>Prompt:</strong> a ledger on a desk</p>\n<p><strong>Negative prompt:</strong> text</p>",
  "an image prompt is still drawn as its fields",
);
assertEqual(renderArtifactBody(JSON.stringify({ text: "x", other: 1 })), null, "an object that only happens to hold text is not called a post");

// ---- a PDF / LinkedIn document --------------------------------------------------------------------

/** A deck as GeekAPI saves it: the cover is the document's opening and each slide a section. */
function deck(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    title: "The close that runs on one spreadsheet",
    caption: "Most controllers lose the first week of the month to the close.\n\nThe slides walk through where the hours go.",
    firstComment:
      "Book your free consultation: https://geekatyourspot.com/#consultationAppointment2xl\n\nRamp: https://geekatyourspot.com/tools/accounting/ramp",
    links: [{ label: "Book your free consultation", href: "#consultationAppointment2xl", url: "https://geekatyourspot.com/#consultationAppointment2xl" }],
    slides: [
      { kind: "cover", partner: null },
      { kind: "problem", partner: null },
      { kind: "partner", partner: "Ramp" },
      { kind: "next", partner: null },
    ],
    warnings: [],
    body: {
      lede: {
        heading: "The close that runs on one spreadsheet",
        paragraphs: [{ type: "text", runs: [{ text: "Where the first week of the month goes." }] }],
      },
      sections: [
        {
          heading: "The close waits on one file",
          paragraphs: [{ type: "list", ordered: false, items: [[{ text: "One person holds the file." }], [{ text: "Everyone else waits." }]] }],
        },
        {
          heading: "Approvals that route themselves",
          paragraphs: [{ type: "list", ordered: false, items: [[{ text: "Ramp routes each bill by rule." }]] }],
        },
        {
          heading: "Answer these questions when booking your free consultation",
          paragraphs: [
            { type: "list", ordered: false, items: [[{ text: "How many accounts are reconciled by hand?" }]] },
            { type: "text", runs: [{ text: "geekatyourspot.com" }] },
          ],
        },
      ],
    },
    ...overrides,
  });
}

// Each slide with its number and what it is, then the post, then the links for the first comment.
assertEqual(
  renderArtifactBody(deck()),
  [
    "<p><strong>Slide 1 of 4</strong> · Cover</p>",
    "<h3>The close that runs on one spreadsheet</h3>",
    "<p>Where the first week of the month goes.</p>",
    "<p><strong>Slide 2 of 4</strong> · The problem</p>",
    "<h3>The close waits on one file</h3>",
    "<ul><li>One person holds the file.</li><li>Everyone else waits.</li></ul>",
    "<p><strong>Slide 3 of 4</strong> · Ramp</p>",
    "<h3>Approvals that route themselves</h3>",
    "<ul><li>Ramp routes each bill by rule.</li></ul>",
    "<p><strong>Slide 4 of 4</strong> · What to do next</p>",
    "<h3>Answer these questions when booking your free consultation</h3>",
    "<ul><li>How many accounts are reconciled by hand?</li></ul>",
    "<p>geekatyourspot.com</p>",
    "<h2>The LinkedIn post</h2>",
    "<p>Most controllers lose the first week of the month to the close.</p>\n<p>The slides walk through where the hours go.</p>",
    "<h2>The first comment</h2>",
    "<p><em>Paste this as the first comment under the post. The post itself carries no link.</em></p>",
    "<p>Book your free consultation: https://geekatyourspot.com/#consultationAppointment2xl</p>\n<p>Ramp: https://geekatyourspot.com/tools/accounting/ramp</p>",
  ].join("\n"),
  "a deck shows each slide with its number and what it is, then its post and its first comment",
);

// The post and the comment are what a model and a setting wrote: text, never markup. A link in the
// comment is its address, to copy, and not a link on this page.
const escaped = renderArtifactBody(deck({ caption: "A <b>post</b> & more", firstComment: "<a href=x>Book</a>" })) ?? "";
assertEqual(escaped.includes("<p>A &lt;b&gt;post&lt;/b&gt; &amp; more</p>"), true, "a deck's post is escaped");
assertEqual(escaped.includes("<p>&lt;a href=x&gt;Book&lt;/a&gt;</p>"), true, "and so is its first comment");
assertEqual(/<a\b/.test(renderArtifactBody(deck()) ?? ""), false, "nothing in a deck's drawing is a link");

// A deck with no links has no first comment to show.
assertEqual(
  (renderArtifactBody(deck({ firstComment: "" })) ?? "").includes("The first comment"),
  false,
  "a deck with no first comment shows no heading for one",
);

// What a slide is comes from the saved list, never from where a section stands: a body without the
// list, or with a list that does not match its slides, is drawn as the page it otherwise is.
const asAPage = renderArtifactBody(deck({ slides: undefined })) ?? "";
assertEqual(asAPage.startsWith("<h1>The close that runs on one spreadsheet</h1>"), true, "a body with no list of slides is a page");
assertEqual(asAPage.includes("Slide 1 of"), false, "and is given no slide numbers");
assertEqual(
  (renderArtifactBody(deck({ slides: [{ kind: "cover", partner: null }] })) ?? "").includes("Slide 1 of"),
  false,
  "a list that does not match the slides is not used",
);

// What a deck's tab states about it: its slides, and its post's length. Nothing for a page.
assertEqual(deckFacts(deck()), { slides: 4, postWords: 20, postCharacters: 108 }, "a deck's slides and its post's length");
assertEqual(deckFacts(deck({ slides: undefined })), null, "a page has no such facts");
assertEqual(deckFacts("not a body"), null, "nor has a body that will not parse");

