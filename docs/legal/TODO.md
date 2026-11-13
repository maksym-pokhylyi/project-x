# Legal pages — what must be confirmed before launch

The pages under `/legal`, the contact page and the trust statements on the marketing site were
written for this product, not copied from a template, but **they have not been reviewed by a
lawyer and are not legal advice**. This list is everything a lawyer or the founder has to
confirm, fill in or switch on. Sources for the compliance items are in
`docs/research/round2/P2-outreach-legal-deliverability.md` (sections in brackets).

Pages: `/legal/terms`, `/legal/privacy`, `/legal/refunds`, `/legal/dpa`,
`/legal/acceptable-use`, `/contact`. Content lives in `src/app/(marketing)/legal/*/page.tsx`;
seller details and facts live in `src/config/site.ts` (`operator`, `legal`, `facts`, `identity`).

**Status on 13 Nov 2026.** The owner supplied the seller identity and it is filled in from one
place (section 2). Still open: the UK representative, the ICO registration, the governing law
and the other markers in section 2, and the lawyer's review. Email delivery is live from
`Bidfolio <hello@bidfolio.co.uk>` (DKIM, SPF and DMARC verified), so "check your inbox" is true
on production.

## 1. Before the first outreach email (blocking)

- [ ] **Appoint a UK representative** under Article 27 UK GDPR (about €35–100 a month) and put
      the name and address in `operator.ukRepresentative` (`src/config/site.ts`). Keep the written
      mandate. Until then every place that must name the representative says "UK representative:
      being appointed — contact hello@bidfolio.co.uk". (P2 §3.2–3.3)
- [ ] **Pay the ICO data-protection fee** (£52 a year, tier 1) or get the ICO's written
      confirmation that it is not due; put the reference in `operator.icoRegistrationNumber`. The
      privacy notice prints the sentence about the registration only once the number is there. (P2 §3.4)
- [ ] **Write, date and sign the legitimate-interests assessment** (two to three pages; outline in
      P2 §2.3). The privacy notice summarises its conclusion in the section "If we contacted your
      business about its public contracts": make sure the two agree.
- [ ] **Get Paddle's position in writing** before going live: send the draft question in P2 §5.3
      and keep the reply. Send it only once every statement in it is true.
- [ ] **Lawyer review of the Terms of Service** and, in the same hour, of the privacy notice's
      Article 14 section, the DPA transfer wording and the questions in P2 §10.
- [ ] `/optout` must exist and work (another engineer is building it). The privacy notice, the
      contact page and the footer link to it. It must add the address or domain to a suppression
      list that is checked before every send and never purged.
- [ ] The first email to a named person must carry the short notice and a link to
      `/legal/privacy#contacted`, and be sent within one month of taking the address. (P2 §2.4)

## 2. Seller identity and placeholders

### Filled in (owner, 13 Nov 2026) — one source: `operator` in `src/config/site.ts`

| Detail | Value | Shown on |
|---|---|---|
| Short name for running text | Maksym Pokhylyi | footer identity line, Contact, e-mails |
| Legal name (sole trader as registered in Ukraine) | FOP Pokhylyi Maksym Ihorovych (ФОП Похилий Максим Ігорович) | Contact, Terms, Privacy notice, Refunds and cancellation, DPA — not the footer |
| Registered address | 14 Stoliarnyi Lane (provulok Stoliarnyi), Kremenchuk, Poltava Oblast, Ukraine | the same pages — not the footer |
| Contact and privacy address | hello@bidfolio.co.uk | everywhere |

The identity line under every public page and in every e-mail (`identity` / `identityText`) reads:
"Bidfolio is operated by Maksym Pokhylyi, an independent sole trader registered in Ukraine
(Kremenchuk). Contact: hello@bidfolio.co.uk · UK representative: being appointed · Payments are
processed by Paddle. · Contains public sector information licensed under the Open Government
Licence v3.0. · Bidfolio is an independent service and is not affiliated with, or endorsed by, the
UK Government."

To confirm with the owner: the privacy contact is the same mailbox as the general one
(`operator.privacyEmail`); change it there if a separate address is set up. No state-register or
tax number is shown (`operator.registrationNumber` is empty): add it if a lawyer says it must be.

### Pending fields (render a plain sentence, never a made-up value)

| Field | Where it shows | Until it is set |
|---|---|---|
| `operator.ukRepresentative` | identity line, Contact, Privacy notice §1 | "UK representative: being appointed" (footer, e-mails); "UK representative: being appointed — contact hello@bidfolio.co.uk" (pages) |
| `operator.icoRegistrationNumber` | Privacy notice §1 | the sentence is left out |

`pendingOperatorDetails()` lists them; `tests/misc.test.ts` fails if a pending field ever prints a
marker or an empty value.

### Markers still in the text

Every remaining seller-specific detail is marked `[[LIKE_THIS]]` and is rendered highlighted on the
page. A legal page that still contains a marker shows a "Draft for review" notice; a page without
one does not.

| Placeholder | Where | What to put |
|---|---|---|
| `[[GOVERNING_LAW_JURISDICTION]]` | `site.legal.governingLaw` → terms §14 | Lawyer to advise (England and Wales is what UK customers expect) |
| `[[OUTREACH_MAILBOX_PROVIDER]]` | privacy §2 and §6 | The provider hosting the sending mailboxes (a processor) |
| `[[TRANSFER_MECHANISM_UK_TO_OPERATOR_COUNTRY]]` | privacy §7 | Safeguard for access from Ukraine — lawyer |
| `[[TRANSFER_MECHANISM_PROCESSORS: …]]` | privacy §7 | Safeguard per processor (IDTA / Addendum, UK–US data bridge) — lawyer |
| `[[CONFIRM_ANALYTICS_AND_ERROR_MONITORING: …]]` | privacy §6 | List PostHog / Sentry if enabled in production, else delete the line |
| `[[CONFIRM_PRODUCT_ANALYTICS: …]]` | privacy §8 | Describe the analytics identifier, or state that there is none |
| `[[CONFIRM_BACKUP_RETENTION_DAYS]]` | terms §7, DPA §9 | How long deleted content can persist in database backups (Neon history window) |
| `[[CONFIRM_AI_PROVIDER_LOCATIONS]]` | DPA §4 | Where the model providers behind the Vercel AI Gateway process data |
| `[[CONFIRM_SECURITY_MEASURES: …]]` | DPA §5 | Confirm each listed measure is really in place (MFA on production accounts, backups, logging) |
| `[[CONFIRM_TRANSFER_MECHANISMS_WITH_LAWYER]]` | DPA §6 | SCC modules and the UK Addendum |

Resolved since the first draft: the Bid Pass expiry (it does not expire while the account is open:
`BID_PASS.expires` in `src/config/plans.ts`, terms §4), the support address (hello@bidfolio.co.uk,
the owner's), the footer's company line (replaced by the identity line).

## 3. Statements on the site that must be literally true

These are made in the marketing copy, the pricing page and the legal pages. If one is not
true on launch day, change the product or change the words.

| Statement | Where | To confirm |
|---|---|---|
| Files and data are stored in the EU (Frankfurt) | landing, /free-bid-check, terms, privacy, DPA (`site.facts.hostingRegion`) | Vercel function region fra1 and Neon eu-central-1 are set; **check the region of the Vercel Blob store** |
| Files are never used to train AI models | landing, /free-bid-check, terms §7, privacy §4, DPA §3 | The terms of the AI Gateway and of each model provider used; zero-retention mode where offered |
| Deleted on request; deleted with the workspace | same | Deletion path implemented for files, extracted text, drafts and library; backup window stated |
| Only members of the workspace can open the files | landing, privacy | Covered by tenant-isolation tests; keep it true for every new file route |
| Notices are refreshed every 10 minutes | landing, FAQ (`site.facts.dataRefreshMinutes`) | The cron schedule in production |
| Public pages show no names, emails or phone numbers | FAQ, privacy §2 and §5 | Ingestion drops contact-person fields; sole traders handled (P2 §4.3) |
| Reminder email 7 days before an annual renewal | landing, pricing, terms §4, refunds | The reminder is actually sent (Paddle setting or our own job) |
| Pause for 1–3 months and cancel "in two clicks" | landing, pricing, terms, refunds | The Paddle customer portal allows pause and cancel; count the clicks |
| 14-day trial on Bid Desk, card required, nothing charged for 14 days; **the trial includes one full bid** | pricing (plan card and billing questions), terms, refunds, the trial strip in the app (`PLANS.pro.trialDays`, `trialFullBids`) | `pnpm paddle:setup` puts the trial on both Bid Desk prices; the bids module gives one full bid for the whole trial |
| Unused bids roll over for one month | pricing, terms | Implemented in the bid-credit logic |
| 7 days' grace after a failed payment, then Free; data kept | pricing FAQ, terms | `BILLING_PAST_DUE_GRACE_DAYS=7` in production |
| Prices exclude VAT; VAT added at checkout | pricing, Billing, sign-up (`billingCopy.vat`) | `pnpm paddle:setup` creates every price with tax mode "external" (net of tax) and replaces a price that has another mode. Run it against production and check one checkout |
| Prices are in pounds | everywhere | Resolved in code: the catalogue sync creates every price in `PLAN_CURRENCY` (GBP), including the one-off Bid Pass. Run `pnpm paddle:setup` once per Paddle environment and set the printed `PADDLE_PRICE_*` variables |
| A Bid Pass "does not expire while your account is open" | pricing, Billing, terms §4, refunds | The pass is granted without an expiry (`grantBidPass`), and revoked only when an unused pass is refunded |
| "You pay the difference for the rest of your current billing period" (upgrade) | Billing confirm panel | Paddle proration mode on plan changes is prorated-immediately |
| The allowance renews on the billing date; unused bids carry over one month | Billing ("Your allowance · renews …"), Usage | The bids module's windows (`src/features/bids/allowance.ts`) |
| Refund in full within 14 days of the first payment; Bid Pass refunded if unused | pricing FAQ, refunds, terms | Founder's decision; Paddle's own refund terms do not conflict |
| Refund requests confirmed within two working days | refunds §7 | A promise: keep it or soften it |
| Corrections and removals of public pages within five working days | terms §8, privacy §5, contact | A promise: needs a monitored mailbox and a removal procedure (P2 §4.5) |
| Complaints acknowledged within 30 days | privacy §11, contact | Legal duty since 19 June 2026 (DPA 2018 s. 164A); needs a log |
| Non-responders deleted after 90 days; opt-outs kept on a suppression list | privacy §2 and §9 (`site.facts.outreachRetentionDays`) | The retention job exists and runs |
| No tracking pixels in emails; the link carries a visit-counting code | privacy §8 | Our own e-mails load nothing when opened: no images, no web fonts (`tests/email-templates.test.ts`). Open tracking must also stay off in the sending tool; lawyer to confirm the link code is fine under PECR reg. 6 (P2 §10 Q9) |
| "Built and run by one person, Maksym Pokhylyi", an independent sole trader registered in Ukraine | contact, privacy, the identity line | True today |
| Verification links work for 24 hours, reset links for 1 hour, invitations for 7 days | the e-mails, the "check your inbox" page | The values in `src/lib/auth.ts` (`VERIFICATION_LINK_TTL_SECONDS`, `resetPasswordTokenExpiresIn`, `invitationExpiresIn`) |
| "UK guidance (PPN 017) lets buyers ask suppliers to disclose AI use" | landing FAQ | PPN 017, February 2025 |
| "…get a compliant first draft in hours, not days" | landing hero, social image, FAQ ("a compliant first draft and an honest mark") | The designer's headline, kept as delivered. It must stay a claim about the draft following the pack's requirements, never "100% compliant" or a promise of a pass: lawyer to confirm the wording is safe |
| "Marked 3 of 5 against the buyer's scheme" | landing (step 3), /styleguide | A reading of the scoring scheme, never a forecast: the product must carry the line "A reading of the scoring scheme, not a forecast of the buyer's decision" wherever a mark is shown |
| Built from Find a Tender only; other portals (Contracts Finder, Public Contracts Scotland, Sell2Wales) "not included yet" | landing strip, questions, independence band, footer | The ingestion sources in production |
| "If a notice is wrong or missing, you can flag it from your page" | landing questions | The supplier page has a working "Flag a mistake" route |
| "Your page is free and needs no account"; "No account needed to look" | landing | /find and the supplier pages are public |
| "each claim carries a marker back to the document and page it came from"; a "labelled gap" instead of guessing | landing questions | The drafting pipeline really refuses unsupported claims |

## 4. Decisions for the lawyer

- Liability cap in terms §12 (greater of 12 months' fees and £100) and the exclusion of loss of
  contracts and bids: enforceable under the chosen governing law?
- Whether the business-only clause (terms §1) is enough to keep consumer law out, given that
  sole traders may sign up.
- Paddle's required merchant-of-record wording is included in terms §4: check it against
  Paddle's current seller guidance.
- Ownership of AI-assisted output (terms §7, last paragraphs).
- The acceptable use policy's ban on bulk copying of pages built from OGL data: the data itself
  remains free to reuse from the official source, and the policy says so.
- Whether Ukrainian personal-data law adds anything to the privacy notice (P2 §3.5).
- Whether a UK trading-disclosure rule requires a postal address in outreach emails (P2 §10 Q8).

## 5. Wording rules the copy follows (keep them when editing)

- Never promise wins, win rates, "100% compliant", "submission-ready" or score prediction.
  The evaluator's marking is described as "a second read, not a prediction".
- Never suggest official status: no "official", "register", "notification"; the independence
  line is in the footer of every marketing page.
- Describe the product as software. No income claims. No human bid-writing services through Paddle.
- No customer counts, logos or testimonials until they are real.
