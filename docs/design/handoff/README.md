# Design handoff (visual source of truth)

Received 2026-11-13 from a separate design session run by the owner on the brief in `../BRIEF-for-design-session.md`.
Published canvas (private to the owner): https://claude.ai/artifact/3SN2Sc8h3qP7FFDpDWvX2v

| File | Artboard |
|---|---|
| `Main.dc.html` | Logo and wordmark sheet (mark path, sizes, reversed versions, favicon cut) |
| `Social-1200x630.dc.html` | Social / Open Graph image |
| `Foundations.dc.html` | Recommended changes to the foundations (all five accepted — see `../DESIGN.md`) |
| `Landing-1440.dc.html`, `Landing-390.dc.html` | Landing page |
| `Supplier-1440.dc.html`, `Supplier-390.dc.html` | Public supplier page |
| `Brief-1440.dc.html`, `Brief-390.dc.html` | Bid brief ("cited bid check") |
| `Editor-1440.dc.html`, `Editor-390.dc.html` | Answer editor with evaluator panel |

`*.dc.html` are the artboard sources: plain HTML with inline styles inside `<x-dc>` — exact colours, sizes and spacing can be read
from them. `render/*.html` are the same artboards as standalone pages and `render/*.png` their full-page screenshots.

All suppliers, buyers, notices and figures in the artboards are fictional sample data.

## Corrections to apply when implementing (the designer flagged these as drafts)

- Data source is **Find a Tender only** (not Contracts Finder).
- Plans and prices come from `docs/product/SPEC.md` §5: Free; Radar Pro £29; Bid Desk £149 (3 full bids a month, rollover, pause);
  Bid Desk Plus £349; Bid Pass £99 one-off.
- The first deliverable is called a "cited bid check" in marketing copy (the in-app tab may stay "Brief").
- Evaluator output must not read as a prediction: label it "Marked 3 of 5 against the buyer's scheme", keep the footer line
  "A reading of the scoring scheme, not a forecast of the buyer's decision."
- Match-reason chips show only facts we actually have (same category, a buyer you have won from, region) — no distances in miles
  until postcode geocoding exists.
- Footer/company details and support e-mail stay `[[PLACEHOLDERS]]` until the owner supplies them.
