# Restyle to brand colours — shipped

Content Creator is a **subdomain of geekatyourspot.com**, so the brief is not "use two hex values",
it is "read as the same property". Every colour and both typefaces below were extracted from the
parent's live markup rather than chosen here.

## Source of truth — extracted from geekatyourspot.com

| Hex | as `text-` | as `bg-` | Role |
|---|---|---|---|
| `#0b162a` | 507 | 321 | **Primary navy.** Body text, headings, *and* the dominant section background |
| `#c83803` | 530 | 21 | **Accent orange.** Overwhelmingly a text colour; fill reserved for CTAs |
| `#023059` | 2 | 8 | Secondary blue. Full-bleed alternating sections; dark `theme-color` + `TileColor` |
| `#8c2703` | 0 | 1 | Deep orange, hover/active partner (same 16° hue as `#c83803`) |
| `#e40014` | – | – | The parent's `--destructive` |

**The 530:21 ratio is the rule the app now follows:** orange is a text colour first; a solid orange
fill means "act here" and belongs to one action per view.

Type: the parent sets `html { font-family: var(--font-sans) }` where `--font-sans: "Figtree"`, and
declares `--font-sora: "Sora"` for display. This app now uses that exact pairing, replacing
Fraunces + Source Sans 3. Since both sites already shared the colours, typography was the strongest
remaining tie-together lever.

## Corrections to the previous version of this plan

Two claims in the earlier draft were wrong and are recorded here so they are not repeated:

1. It said the `--color-*` set was used only by `ProjectForm` / `ContentResults`. In fact
   `--color-brand` is consumed through Tailwind's `@theme inline` bridge as `text-brand` / `bg-brand`
   / `hover:bg-brand-dark` — **110 references across 27 files**, making it the *dominant* accent
   channel. The `--gcc-*` set was the smaller of the two (19 refs, 7 files).
2. It proposed `#9e2c02` as an invented hover shade. The parent already ships `#8c2703` for exactly
   that role, so nothing needed inventing.

`--gcc-ink` was `#0b1220`; it is now `#0B162A`, the stated primary.

## What shipped

- `globals.css` — token system rebuilt on the four brand values. Neutrals re-derived at the navy's
  own hue (219°) so greys belong to the brand instead of reading as generic slate. The two token
  systems (`--gcc-*` and `--color-*`) were folded onto shared values so they can no longer drift.
- `--gcc-teal` / `--gcc-teal-deep` renamed to `--gcc-accent` / `--gcc-accent-deep` across 7 files.
- `layout.tsx` — Sora + Figtree.
- `page.tsx` — the radial-glow gradient and crosshatch texture were removed. The parent builds
  sections as flat `bg-[#0b162a]` with no gradients; recolouring the glow orange would also have
  produced a sunset cliché. The hero is now the product's actual subject: a site heading tree with
  one unanswered question marked in orange.
- `AppSidebar.tsx` — navy chrome; active item is an orange left rule, **no fill** (see below).

## Contrast — measured, not assumed

All pairs pass WCAG AA, with two findings:

- The active nav item originally used a `#023059` fill behind the orange rule: **2.56:1**, below the
  3:1 for non-text UI. No lightened fill can clear 3:1 under this orange (the maths caps the
  background at L ≤ 0.017; `#023059` is L 0.028). The fill was therefore dropped — the rule on bare
  navy measures **3.46:1** and passes.
- `--gcc-line` (`#cbd3e2`) on `--gcc-paper` is **1.36:1**. Reaching 3:1 needs roughly `#6b7c96`,
  a border heavy enough to change the app's character, and the border is never the sole indicator of
  a control (inputs are white on a tinted ground, buttons carry labels). Left light, deliberately.

## Open — the semantic-colour collision

Burnt orange sits at hue 16°, **between** the app's existing error red (`red-600`, 0°) and warning
amber (`amber-800` `#92400e`, 23° — nearly identical to `#8c2703`). 30 files use these Tailwind
utilities. Nothing is broken, but the amber panels now read as a foreign visual language.

The fix is to separate by **treatment, not hue**: solid saturated fill belongs to the accent alone,
and warnings/errors become a tinted ground + left rule + navy text. Tokens for that were drafted and
then removed rather than shipped unused — a half-adopted system is worse than none. Values, if
adopted: danger `#e40014` / `#a3000e` / bg `#fef2f2`; warn rule `#e8a317` / bg `#fdf6e3`; ok
`#0f7b4a` / bg `#ecf8f1`.
