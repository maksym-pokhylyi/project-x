# Second reply to the designer — visual check, assumptions, third batch

Paste the block below into the design session.

---

**Visual check — done on our side, no full re-run needed.** All 37 artboards were rendered in Chromium at their declared widths
and reviewed one by one: nothing is clipped, nothing is empty, every new screen is in the same language as the first batch. The
Monthly / Annual switch on Pricing reads correctly in the source (prices, "a month / a year" and the notes all follow the state).
Only three frames are shorter than their content — please extend them:

| Artboard | Frame height | Content height |
|---|---|---|
| Supplier-1440 | 2930 | 2960 |
| Editor-1440 | 2100 | 2114 |
| Editor-390 | 3760 | 3780 |

**Assumptions**

1. Bid Desk Plus includes the one-month rollover; the 14-day trial is on Bid Desk only — **confirmed**.
2. Free has 1 seat — **confirmed**.
3. A Bid Pass can be bought on any plan, Free included — **confirmed**.
4. Reference states (Verified = quote matched word for word; Check = found but not an exact match; Unverified = could not be
   matched) — **confirmed**, this is exactly what the product computes.
5. Claim — **one change**. Sign-in is email and password, so for a new visitor the Claim form is also the sign-up:
   - add a **Password** field under "Work email" (same field as on Sign up);
   - helper under the email: "We send a confirmation link to this address. Your radar opens once you confirm it.";
   - primary button: "Create account and claim";
   - a second state for a visitor who is already signed in: company card, the "I am authorised to act for this company" tick
     and the button "Confirm and open my radar" (no name / email / password fields);
   - in "What claiming gives you, free" replace "Correct the details on your page" with "Ask us to correct or hide details on
     your page" (corrections are requests we review, not direct edits).
   We do not check on screen that the email belongs to the company; claiming never changes the public page, and there is no
   public "claimed" badge — the "Claimed" chip on the first-run screen is private to the user. That part is right as drawn.
6. Sign-in by email and password — **confirmed**.
7. Digest goes out on Mondays (07:30 UK time) — **confirmed**.
8. Radar filter chip "Closing within: 90 days" — fine.
9. Editor block "What a 4 needs" — **approved**, better than the old wording.

**Third batch — please make these** (same foundations, 1440 and 390 each unless noted, realistic fictional data, same company
and tenders as the other screens)

1. **Bids list** (the "Bids" item in the top bar): a table of the workspace's bids — tender, buyer, deadline marker, stage
   (Check in progress · Check ready · Drafting 3 of 6 answers · Marked · Exported), verdict chip, last activity; a "New bid
   check" button; a usage line ("2 of 3 full bids used this month"); and the **empty state** for a new workspace (with "See a
   sample check").
2. **Tender page**, public and signed-in variants: one notice — title, buyer, notice-type chip and reference, estimated value,
   dates (published, questions to buyer by, closes — with the deadline marker), lots, categories and regions as chips, the
   buyer's description; signed-in only: "Why this matches you" and "Who won similar work from this buyer" (supplier, value,
   date). Actions: "Start a bid check", "Save", and "Open the official notice on Find a Tender" (always visible, always free).
3. **Radar, the other three tabs**: Ending soon (contract, held by, buyer, value, end date, extension option); Buyers (buyer,
   contracts you have won from them, awards in your trade, median value, share won by small firms, open tenders); Early signals
   (planned procurements with the expected publication date). Plus the **no-matches empty state** and the **"Edit trades and
   regions"** panel that the "Edit" link opens.
4. **Upgrade moments**: (a) New bid check when the free check is already used — inline panel offering a Bid Pass (£99) or the
   14-day Bid Desk trial; (b) Bid Desk with this month's 3 bids used — Bid Pass or move to Plus; (c) a brief on Free / Radar
   Pro where the scored-question matrix and drafts are locked — what stays visible and where the offer sits; (d) the
   confirmation after checkout ("You are on Bid Desk" / "Bid Pass added"); (e) the trial strip under the top bar ("Trial · 9
   days left · Add a payment method").
5. **Emails in the Digest family** (640 and 390): "Your bid check is ready" (verdict, counts, one link); deadline reminder
   ("Closes in 3 days"); "Confirm your email"; annual-renewal reminder (sent 7 days before).
6. **Public sample check**: the Brief in read-only public mode — a band at the top ("A sample check, built from a real public
   tender pack"), actions disabled, and a persistent "Get a free cited bid check" call to action.
7. **Small pages**: unsubscribe / opt-out confirmation (one click, what we hold and how to have it removed); "Flag a mistake"
   request form; 404.
