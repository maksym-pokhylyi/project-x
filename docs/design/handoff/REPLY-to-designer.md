# Reply to the designer — decisions on placeholders and foundations

Paste the block below into the design session.

---

**Foundations — all five recommendations accepted.**
1. Amber `#B4690E` only for markers, rules and large numerals; amber ink `#925207` for small text.
2. No separate success colour: "met / passed" is brand green with a tick.
3. Line strong `#857F70` for form-control borders only.
4. Info blue `#1F4F8F` labels neutral facts only; links are ink with a green underline.
5. Fonts are self-hosted; tabular figures in tables.

**Corrections to copy already on the artboards**
- Data source is **Find a Tender only**. Remove "Contracts Finder" everywhere ("Tender, award and contract notices from Find a
  Tender, used under the Open Government Licence v3.0.").
- The free deliverable is called a **"cited bid check"** in marketing copy ("Get a free cited bid check", "See a sample check").
  Inside the app the tab can stay "Brief".
- Evaluator panel: replace "Likely score 3 of 5" with **"Marked 3 of 5"** and keep the footer "A reading of the scoring scheme, not
  a forecast of the buyer's decision." (We must not look like we predict scores.) In the scored-questions table the column is
  "Marked", values "4 of 5" / "Not marked".
- Match-reason chips: keep "You have won 3 contracts from this buyer", "Same work as 6 of your wins", "New buyer for you"; **remove
  the "11 miles away" chips** and the phrase "the distance from WF1" (we match on category, buyer and region, not distance).
  Use "West Yorkshire" style region chips instead.
- Each source reference chip gets a small verification state: **Verified** (tick), **Check** (amber dot), **Unverified** (hollow dot).
- Brief header meta line: "Bid check · built 13 Nov 2026 at 09:42 · 6 files, 214 pages read" plus a small "Coverage" link that opens
  a list of files read / skipped.

**Plans (final)** — prices exclude VAT; VAT is added at checkout where it applies; annual billing = two months free.

| Plan | Price | Contents |
|---|---|---|
| Free | £0 | Your supplier page and radar (top 10 matches) · Weekly digest · 1 cited bid check |
| Radar Pro | £29 a month · £290 a year | Full radar and daily alerts · Buyer and competitor watchlists · Export · 1 cited bid check a month · 2 seats |
| Bid Desk (recommended) | £149 a month · £1,490 a year | Everything in Radar Pro · 3 full bids a month: cited check, scored-question matrix, first drafts from your documents, marking against the buyer's scheme, Word export · Unused bids roll over one month · 3 seats · 14-day trial · Pause or cancel in two clicks |
| Bid Desk Plus | £349 a month · £3,490 a year | 10 full bids a month · 10 seats · Separate client workspaces (for bid writers and consultancies) |
| Bid Pass | £99 one-off | One full bid, no subscription. Show it as a first-class option beside the plans, not a footnote: "Bid a few times a year? Pay per bid." |

**FAQ answers**
- *Is this an official government service?* "No. Bidfolio is an independent service. It is not affiliated with, or endorsed by,
  the UK Government. The notices come from the Find a Tender service and are reused under the Open Government Licence v3.0."
- *Where are my documents kept, and who can see them?* "Your tender packs and company documents are stored in the EU (Frankfurt)
  and encrypted in transit and at rest. Only people in your workspace can open them. They are never used to train AI models: we
  send them to AI providers only under zero-data-retention terms, so providers do not keep them after answering. You can delete a
  bid, a document or your whole workspace at any time, and the files are removed from our storage."
- *Does AI write my bid?* "It writes a first draft using only the documents you upload, shows where every claim comes from, and
  marks gaps instead of filling them. You edit, decide and submit. If a buyer asks whether AI was used, say so — public buyers
  allow AI-assisted bids."
- *How do I cancel?* "Pause or cancel in two clicks from Billing. You keep access until the end of the period you have paid for.
  We email a reminder seven days before an annual plan renews. Your first subscription payment, or an unused Bid Pass, is refunded
  on request within 14 days."
- *My company has not won a public contract yet.* "You can still set up a radar by choosing your trades and regions, and run a
  cited bid check on any tender pack."
- *Which parts of the UK are covered?* "UK-wide notices published on Find a Tender."

**Footer** (keep the square-bracket placeholders — the owner will supply them)
"Bidfolio is operated by [Owner's full name], an independent sole trader based in Ukraine. Contact: hello@bidfolio.co.uk ·
UK representative: [name and address] · Payments are processed by Paddle. · Contains public sector information licensed under the
Open Government Licence v3.0. · Bidfolio is an independent service and is not affiliated with, or endorsed by, the UK Government."

**Additional artboards we would use, if you have time** (same foundations, 1440 and 390 each, realistic fictional data)
1. **Pricing page** — the four plans with a monthly/annual toggle, the Bid Pass as a first-class option, comparison table, billing FAQ.
2. **Radar (signed in)** — top bar (Radar · Bids · Documents), tabs Matches / Ending soon / Buyers / Early signals, filters, tender
   rows with Save / Dismiss / "Start a bid check", an "upcoming deadlines" strip, the free-plan cap (item 11+ locked with an inline
   upgrade notice), and the first-run state right after claiming a page.
3. **Find your company** — search results, the "no result — set up a radar manually" state, and the claim confirmation step.
4. **New bid check** — upload drop zone with per-file status, then the processing state with real stages (Reading files → Finding
   requirements → Listing questions → Checking against your company), partial results appearing.
5. **Documents (library)** — company facts form (turnover, insurance levels, accreditations with expiry dates and an "expired"
   warning) and the documents table.
6. **Sign up / sign in** and **Billing** (current plan, usage against limits, pause/cancel, test-mode notice).
7. **Weekly digest e-mail** — plain, text-first: new matches with deadlines, contracts ending soon, one link each.
