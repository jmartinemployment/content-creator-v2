# Restyle to brand colours — shipped

Content Creator is a **subdomain of geekatyourspot.com**. The brand values below were extracted from
that site's live markup rather than chosen here, so the two properties match by construction.

## Source of truth — extracted from geekatyourspot.com

| Hex | as `text-` | as `bg-` | Role |
|---|---|---|---|
| `#0b162a` | 507 | 321 | **Primary navy.** Body text, headings, and section backgrounds |
| `#c83803` | 530 | 21 | **Accent orange.** Overwhelmingly a text colour; fill reserved for CTAs |
| `#023059` | 2 | 8 | Secondary blue. Full-bleed sections; dark `theme-color` + `TileColor` |
| `#8c2703` | 0 | 1 | Deep orange, hover/active (same 16° hue as `#c83803`) |
| `#e40014` | – | – | The parent's `--destructive` |

## Corrections to the previous version of this plan

1. It said the `--color-*` set was used only by `ProjectForm` / `ContentResults`. In fact
   `--color-brand` is consumed through Tailwind's `@theme inline` bridge as `text-brand` / `bg-brand`
   / `hover:bg-brand-dark` — **110 references across 27 files**, making it the *dominant* accent
   channel. The `--gcc-*` set was the smaller of the two (19 refs, 7 files).
2. It proposed `#9e2c02` as an invented hover shade. The parent already ships `#8c2703` for exactly
   that role, so nothing needed inventing.

## What shipped — colour values only

This is a token-level reskin. No component structure, typography, or copy was changed.

- `--gcc-ink`: `#0b1220` → `#0b162a` (the stated primary)
- `--gcc-teal` / `--gcc-teal-deep` → renamed `--gcc-accent` / `--gcc-accent-deep`, set to
  `#c83803` / `#8c2703`
- `--gcc-glow`: teal → `rgba(200, 56, 3, 0.18)`
- `--color-accent` / `--color-accent-hover` / `--color-brand` / `--color-brand-dark` → the same
  accent pair
- `--gcc-navy-raised`: `#023059` added; used as the landing page background
- Landing page gradient stops moved onto the brand navy/blue so the blue reads through

Neutrals (`--gcc-muted`, `--gcc-line`, `--gcc-paper`, and the `--color-*` greys) were deliberately
left at their existing values.

## Contrast — measured

Accent on white 5.22:1, accent on page ground 4.74:1, accent-deep on white 8.73:1, white on accent
5.22:1, navy on page ground 16.39:1, muted on page ground 4.68:1 — all pass AA.

Known deviation: `--gcc-line` on `--gcc-paper` is 1.36:1. Reaching 3:1 needs roughly `#6b7c96`, a
border heavy enough to change the app's character, and the border is never the sole indicator of a
control. Left as-is (this is unchanged from before the reskin).

## Open — the semantic-colour collision

Burnt orange sits at hue 16°, **between** the app's existing error red (`red-600`, 0°) and warning
amber (`amber-800` `#92400e`, 23° — nearly identical to `#8c2703`). 30 files use these Tailwind
utilities, so warning panels read as a slightly foreign visual language next to the new buttons.

Reviewed and **declined** — no sweep. If it is ever picked up, the fix is to separate by *treatment*
rather than hue: solid saturated fill belongs to the accent alone, warnings/errors become a tinted
ground + left rule + navy text. Values: danger `#e40014` / `#a3000e` / bg `#fef2f2`; warn rule
`#e8a317` / bg `#fdf6e3`; ok `#0f7b4a` / bg `#ecf8f1`.
