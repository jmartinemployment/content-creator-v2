import { renderArtifactBody } from "./gcc-api.ts";

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
