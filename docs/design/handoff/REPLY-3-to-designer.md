# Third reply to the designer — Chromium check of batch 3, confirmations, last fixes

Paste the block below into the design session.

---

**Chromium check — done on our side for all 48 new boards plus the changed Claim.** Every board rendered without errors: no
template leftovers, no placeholder text, and nothing outside the established colours, type, radii and components. Copy agrees
with the plan facts everywhere. The list below is everything worth changing; the rest is accepted as drawn.

*Layout*
1. **RadarEdit-1440** — the page behind the right-hand panel is blank below the Radar header (no tabs, no list). Show the
   radar underneath, dimmed. Also the word "in" hangs alone at the end of the first chip line.
2. **RadarSignals-390** — the tab row is right-aligned (`justify-content: flex-end`), so "Matches" is cut on the left and, built
   literally, could never be scrolled back. Use the same left-anchored horizontal scroller as Radar-390 and just draw it
   scrolled. The reason-chip rows also run off the right edge of each card — scroll them inside the card as on Radar-390.
3. **RadarEmpty-390, RadarEnding-390, RadarBuyers-390** — the tab row is wider than the frame (fine, it scrolls); add the
   right-edge fade so it reads as scrollable.
4. **FlagMistake-390** — the pre-filled value in "Which contract or detail?" is truncated; let that field wrap to two lines.
5. **Tender-1440 / 390** — the footer link "Flag a mistake" still points nowhere; link it to the Flag a mistake board.
6. Frames taller than their content (the footer stretches): UpgradeFreeUsed-390 (2121 of 2370), UpgradeBidsUsed-390 (2088 of
   2330), SampleCheck-390 (5063 of 5230), BriefLocked-390 (4891 of 5050), EmailCheckReady-390 (1252 of 1400). Trim if you like.

*Copy — decisions*
7. **Trial.** The trial needs a card at the start (through Paddle) and includes **one full bid**, not three.
   - Trial strip: "Trial · 9 days left · 1 full bid included · First payment £149 on 22 Nov 2026" with the link "Manage"
     (not "Add a payment method").
   - UpgradeFreeUsed, trial card: add "One full bid is included in the trial. Card needed to start; nothing is charged for
     14 days."
   - Pricing and Landing, Bid Desk card: "14-day trial" → "14-day trial, one full bid included".
   - CheckoutPlan: replace the row "Receipt: Sent to … by Paddle" (nothing has been charged yet) with "First payment: £149 on
     27 Nov 2026" and "Receipts: Paddle emails one after each payment."
8. **Moving to Plus** (UpgradeBidsUsed): "You pay the difference for the rest of this month." → "You pay the difference for
   the rest of your current billing period."
9. **Allowance follows the billing date** — confirmed. So the labels should not name a calendar month:
   - Billing: "This month · November 2026" → "Your allowance · renews 1 Dec 2026";
   - Bids list and New bid check: "2 of 3 full bids used this month" → "2 of 3 full bids used · renews 1 Dec 2026";
   - UpgradeBidsUsed: "Full bids · November 2026" → "Full bids · renews 1 Dec 2026". "You have used this month's 3 bids" and
     "Your next 3 bids arrive on 1 Dec 2026" stay.
   - The rollover line stays as drawn ("1 unused bid rolled over from October: use it by 30 Nov 2026").
10. **Bid Pass** — "It does not expire while your account is open." Confirmed.
11. **Locked Brief** — keep the button, but it is "Download the check (Word)": the product exports Word, not PDF.
12. **Sample check** — the band is true and stays: the product's sample is built from a real public tender pack; only the
    bidding company is an example. "the example company's 12 documents" is right on both sizes. Please add one small line
    near the band: "Tender documents © the buyer; quoted here to show how a check reads."
13. **Email confirmation link** — 24 hours. Confirmed.
14. **Flag a mistake** — add the "sent" state: heading "Thanks — we have your request", body "We will reply to your work email
    within five working days. Nothing changes on the page until a person has checked it.", link "Back to the page".
15. **Unsubscribe** — add the state before the one you drew, because a link in an email must not change anything by itself
    (mail scanners open links): heading "Stop emails to this address?", the address, one button "Unsubscribe", and for people
    with an account a second choice "Only stop this kind of email". Your "You are unsubscribed" screen then follows the button.
16. **Footer identity** — the owner's details are now known. The footer line reads: "Bidfolio is operated by Maksym Pokhylyi,
    an independent sole trader registered in Ukraine (Kremenchuk). Contact: hello@bidfolio.co.uk · UK representative: being
    appointed · Payments are processed by Paddle. · Contains public sector information licensed under the Open Government
    Licence v3.0. · Bidfolio is an independent service and is not affiliated with, or endorsed by, the UK Government."
    (applies to every board with the legal footer, e-mails included).

*Accepted as drawn* — Tender signed-in showing "Saved"; Bids first row "Drafting 4 of 6 answers"; the new claim-card copy on
the supplier page; "Companies House number" as the company identifier; the Control sizes block on Foundations (we are
mirroring the 44 / 48 / 52 scale in code, with an automated check that a field and its button always share a height).

**Nothing else is needed from design for the first release.** After these fixes the canvas is the complete reference.
