# PDF slide deck

Turn a **ready long-form draft** into a **multi-page PDF slide deck** at **1080×1350** portrait (4:5).

The persisted values `linkedin-document` and `linkedin-carousel` are legacy compatibility
identifiers. They are not product labels and must be displayed as **PDF**.

## Entry points

| Path | When |
|------|------|
| **Canvas → Generate PDF** | Any ready long-form tab (pillar, blog, case-study, guide, …) |
| **Also draft → PDF** | Checked at create; job spawns when the first long-form job on that create reaches `ready` |
| **Export ZIP** | Includes document artifacts from transform or document jobs |

Tool pages, email, social, and ads are **not** valid carousel sources.

## Slide template (LLM transform)

1. **cover** — hook + subtitle  
2. **problem** — why it matters  
3–6. **teach** — one tactical insight each (2–4 bullets)  
7. **framework** — mini-playbook / before-after  
8. **cta** — soft CTA + takeaway  

Plus a **companion summary** (150–250 words) for sharing the PDF.

## PDF spec

| Setting | Value |
|---------|--------|
| Page size | 1080 × 1350 pt (identical every page) |
| Safe zone | 60 pt horizontal, 80 pt vertical padding |
| Format | PDF only (not PPTX/DOCX) |
| v1 visuals | Typographic + BrandKit colors (no embedded images) |
| Filename | Professional snake_case from title (e.g. `AI_Implementation_Framework.pdf`) |
| Max size | Stay well under 100 MB |

## Export paths

| File | Content |
|------|---------|
| `social/linkedin/carousels/{slug}.pdf` | QuestPDF output (legacy storage path) |
| `social/linkedin/carousels/{slug}-caption.txt` | Companion summary + topic tags |
| `social/linkedin/carousels/{slug}-slides.json` | Structured page backup |

## Backend

- `GeekBackend/GeekAPI/Services/ContentCreatorV2/Carousel/` — legacy internal namespace containing the PDF models, parser, prompt, QuestPDF renderer, transform service, and spawn service
- `POST .../transform/pdf` — sync transform from a ready long-form job; the old route remains an alias for existing clients
- `ResultJson.linkedInCarousel` — legacy persisted property containing structured PDF page JSON

## QuestPDF license

QuestPDF Community license applies for companies with less than $1M USD annual revenue. Confirm before production deploy.

## Related

- PDF is an export-only slide-deck format, not a web-page content type
- Channel-specific post text remains `social` short-form
- See [`long-form-content-types.md`](./long-form-content-types.md) for long-form source types
