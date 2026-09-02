# LinkedIn document (PDF)

Turn a **ready long-form draft** into a **multi-page PDF** for LinkedIn document posts — swipeable slides at **1080×1350** portrait (4:5).

## Entry points

| Path | When |
|------|------|
| **Canvas → Generate PDF** | Any ready long-form tab (pillar, blog, case-study, guide, …) |
| **Also draft → LinkedIn document** | Checked at create; job spawns when the first long-form job on that create reaches `ready` |
| **Export ZIP** | Includes document artifacts from transform or document jobs |

Tool pages, email, social, and ads are **not** valid carousel sources.

## Slide template (LLM transform)

1. **cover** — hook + subtitle  
2. **problem** — why it matters  
3–6. **teach** — one tactical insight each (2–4 bullets)  
7. **framework** — mini-playbook / before-after  
8. **cta** — soft CTA + takeaway  

Plus a **caption** (150–250 words) for the feed post that accompanies the PDF upload.

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
| `social/linkedin/carousels/{slug}.pdf` | QuestPDF output |
| `social/linkedin/carousels/{slug}-caption.txt` | Feed caption + hashtags |
| `social/linkedin/carousels/{slug}-slides.json` | Structured slide backup |

## Backend

- `GeekBackend/GeekAPI/Services/ContentCreatorV2/LinkedInDocument/` — models, parser, prompt, QuestPDF renderer, transform service, spawn service  
- `POST .../transform/linkedin-document` — sync transform from ready long-form job  
- `ResultJson.linkedInDocument` — persisted slide JSON on source job after transform  

## QuestPDF license

QuestPDF Community license applies for companies with less than $1M USD annual revenue. Confirm before production deploy.

## Related

- Generic LinkedIn **post text** remains `social` short-form — not replaced by carousel  
- Re-Purpose LinkedIn channel remains single-post snippets — carousel is a separate pipeline  
- See [`long-form-content-types.md`](./long-form-content-types.md) for long-form source types
