import { imagePromptsFor } from "./image-prompts.ts";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\n expected ${JSON.stringify(expected)}\n actual   ${JSON.stringify(actual)}`);
  }
}

// A page: the hero's prompt, then each section's, in page order.
assertEqual(
  imagePromptsFor(
    JSON.stringify({
      title: "Approvals",
      body: {
        lede: { heading: "", imagePrompt: "a desk at dusk" },
        sections: [
          { heading: "Why approvals stall", imagePrompt: "an inbox", children: [{ heading: "By hand", imagePrompt: null }] },
          { heading: "What routing changes", imagePrompt: "  a branching path  " },
        ],
      },
    }),
  ),
  [
    { heading: "Hero", prompt: "a desk at dusk" },
    { heading: "Why approvals stall", prompt: "an inbox" },
    { heading: "What routing changes", prompt: "a branching path" },
  ],
  "a page's prompts are read off its document",
);

// A short piece is not a document. It carries one prompt, as an object beside its own fields; it was
// written and paid for, and listed on the tab as "carries no image prompts".
assertEqual(
  imagePromptsFor(
    JSON.stringify({
      subject: "Cut approval time",
      body: "Rule-based routing cut approval time by 60%.",
      ctaLabel: "Read the guide",
      imagePrompt: { prompt: "a ledger on a desk", style: "flat vector", aspectRatio: "16:9" },
    }),
  ),
  [{ heading: "Image", prompt: "a ledger on a desk" }],
  "an email's one prompt is read",
);
assertEqual(
  imagePromptsFor(JSON.stringify({ text: "A post.", imagePrompt: { prompt: "a branching path" } })),
  [{ heading: "Image", prompt: "a branching path" }],
  "and a post's",
);

assertEqual(imagePromptsFor(JSON.stringify({ text: "A post." })), [], "a piece saved without one has none");
assertEqual(imagePromptsFor(JSON.stringify({ text: "A post.", imagePrompt: { prompt: "  " } })), [], "an empty prompt is not a prompt");
assertEqual(imagePromptsFor("not json"), [], "a body that cannot be read has none");
