# Design handoff (visual source of truth)

Received 2026-11-13 from a separate design session run by the owner on the brief in `../BRIEF-for-design-session.md`.
Published canvas (private to the owner): https://claude.ai/artifact/3SN2Sc8h3qP7FFDpDWvX2v

| File | Artboard |
|---|---|
| `Main.dc.html` | Logo and wordmark sheet (mark path, sizes, reversed versions, favicon cut) |
| `Social-1200x630.dc.html` | Social / Open Graph image |
| `Foundations.dc.html` | Foundations as adopted (all five recommendations accepted — see `../DESIGN.md`) |
| `Landing-1440/390` | Landing page (final plans, FAQ and footer copy) |
| `Pricing-1440/390` | Pricing page: Monthly / Annual toggle, four plans, Bid Pass band, comparison table, billing questions |
| `Supplier-1440/390` | Public supplier page |
| `Find-1440/390` | Find your company — search results |
| `FindNoResult-1440/390` | No result → set up a radar manually (trades and regions) |
| `Claim-1440/390` | Claim confirmation step |
| `SignUp-1440/390`, `SignIn-1440/390` | Sign up / sign in |
| `Radar-1440/390` | Radar (signed in): deadlines strip, tabs, filters, match rows, free-plan cap |
| `RadarFirstRun-1440/390` | Radar right after claiming: "Three things to do first" + first matches |
| `NewCheck-1440/390` | New bid check: upload with per-file status |
| `Processing-1440/390` | Bid check in progress: stages and partial results |
| `Brief-1440/390` | Bid brief ("cited bid check") |
| `Editor-1440/390` | Answer editor with evaluator panel |
| `Documents-1440/390` | Documents: company facts and document library |
| `Billing-1440/390` | Billing: plan, usage, pause / cancel, Bid Pass, payment method, receipts, test-mode notice |
| `Digest-640/390` | Weekly digest e-mail |

Second batch (Pricing … Digest, plus revised Landing / Supplier / Brief / Editor / Foundations) received 2026-11-13 ~13:45 UTC
after the reply in `REPLY-to-designer.md`.

`*.dc.html` are the artboard sources: plain HTML with inline styles inside `<x-dc>` — exact colours, sizes and spacing can be read
from them. `render/*.html` are the same artboards as standalone static pages (template bindings resolved to the default state) and `render/*.png` their full-page screenshots.

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
