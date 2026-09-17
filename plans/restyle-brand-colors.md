# Restyle to brand colours

## Context

The deployed UI is teal. The brand is deep navy `#0B162A` with burnt orange `#c83803` for buttons and
accents. Nothing in the app uses either.

**This is smaller than it looks.** No component hardcodes a colour — every one reads a CSS variable,
and the only literal hex values in `src/` are the token definitions in `src/app/globals.css`. The
reskin is a token change; components are not touched.

Verified: `0d9488` / `0f766e` appear only at `globals.css:23-25`. 114 token references across 13
files, all indirect.

## Two parallel token systems

Both exist in `globals.css` and both hardcode the same teal. Missing either leaves half the UI teal:

| Set | Used by | Teal appears as |
|---|---|---|
| `--gcc-*` | most of the app — 114 refs | `--gcc-teal`, `--gcc-teal-deep`, `--gcc-glow` |
| `--color-*` | CWV2 theme: `ProjectForm`, `ContentResults` | `--color-accent`, `--color-accent-hover`, `--color-brand` |

`--color-brand-dark` maps back to `--gcc-teal-deep`, so the two are already entangled.

## Changes — all in `src/app/globals.css`

```
--gcc-teal:        #0d9488  ->  #c83803    burnt orange, buttons and accents
--gcc-teal-deep:   #0f766e  ->  #9e2c02    hover/active, darker orange
--gcc-glow:        rgba(13,148,136,.18) -> rgba(200,56,3,.18)
--gcc-ink:         #0b1220  ->  #0B162A    the stated primary
--color-accent:    #0d9488  ->  #c83803
--color-accent-hover: #0f766e -> #9e2c02
--color-brand:     #0d9488  ->  #c83803
```

`#9e2c02` is a proposed hover shade, not a brand value — replace it if there is an official one.

## Decide first

**1. `--gcc-ink` is `#0b1220`; the brand primary is `#0B162A`.** Near-identical, not the same. They
differ by a few points of blue. Either the token predates the brand value or one is a typo. Confirm
before changing — this is text colour across the whole app.

**2. The token names will lie.** `--gcc-teal: #c83803` is a name that actively misleads the next
person, and misleading names are what cost most of today. Options:

- **Leave them.** One-line diff, names stay wrong forever.
- **Rename to semantic** — `--gcc-accent`, `--gcc-accent-deep`. Correct, but touches 37 references
  across 13 files. Mechanical, no behaviour change.

Recommend renaming. The names outlive the colour.

**3. Contrast.** Burnt orange on white is fine for buttons with white text. Check anywhere the teal is
used as *text* rather than a background — `--gcc-teal-deep` appears as a text colour in
`SiteHeadingHierarchy`'s summary, and `#9e2c02` on white needs verifying against WCAG AA rather than
assumed.

## Verify

1. `npx tsc --noEmit`, `npm run build`.
2. `grep -rn "0d9488\|0f766e\|teal" src/` returns nothing.
3. Walk `/app/crawl`, `/app/create`, `/app/creates`, `/app/workflow`, `/app/projects/[id]` — the CWV2
   pages are the ones that break if only the `--gcc-*` set is changed.
4. Check disabled states: several buttons use `disabled:opacity-50` over the accent, which reads
   differently on orange than on teal.
