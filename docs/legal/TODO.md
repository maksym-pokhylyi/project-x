# Legal pages — what must be confirmed before launch

The pages under `/legal`, the contact page and the trust statements on the marketing site were
written for this product, not copied from a template, but **they have not been reviewed by a
lawyer and are not legal advice**. This list is everything a lawyer or the founder has to
confirm, fill in or switch on. Sources for the compliance items are in
`docs/research/round2/P2-outreach-legal-deliverability.md` (sections in brackets).

Pages: `/legal/terms`, `/legal/privacy`, `/legal/refunds`, `/legal/dpa`,
`/legal/acceptable-use`, `/contact`. Content lives in `src/app/(marketing)/legal/*/page.tsx`;
seller details and facts live in `src/config/site.ts`.

## 1. Before the first outreach email (blocking)

- [ ] **Appoint a UK representative** under Article 27 UK GDPR (about €35–100 a month) and put
      the name and address in `site.company.ukRepresentative`. Keep the written mandate. (P2 §3.2–3.3)
- [ ] **Pay the ICO data-protection fee** (£52 a year, tier 1) or get the ICO's written
      confirmation that it is not due; put the reference in `site.company.icoRegistrationNumber`. (P2 §3.4)
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

## 2. Placeholders to fill in

Every seller-specific detail is marked `[[LIKE_THIS]]` and is rendered highlighted on the page.
While any value in `site.company` is a placeholder, every legal page shows a "Draft for review"
notice.

| Placeholder | Where | What to put |
|---|---|---|
| `[[COMPANY_LEGAL_NAME]]` | `site.ts` → all legal pages, contact | Legal name of the seller (the FOP / sole proprietor) |
| `[[COMPANY_REGISTERED_ADDRESS]]` | `site.ts` → terms, privacy, contact | A postal address where post is received (not a home address if avoidable) |
| `[[COMPANY_COUNTRY]]` | `site.ts` → privacy | Ukraine |
| `[[COMPANY_REGISTRATION_NUMBER]]` | `site.ts` → terms, contact | State register entry / tax number |
| `[[COMPANY_TAX_ID]]` | `site.ts` (not shown yet) | Tax number, if it must be displayed |
| `[[GOVERNING_LAW_JURISDICTION]]` | `site.ts` → terms §14 | Lawyer to advise (England and Wales is what UK customers expect) |
| `[[PRIVACY_CONTACT_EMAIL]]` | `site.ts` → privacy, DPA, contact | A monitored mailbox, e.g. privacy@bidfolio.co.uk |
| `[[UK REPRESENTATIVE NAME AND ADDRESS]]` | `site.ts` → privacy §1, contact | From the representative's mandate |
| `[[ICO_REGISTRATION_NUMBER]]` | `site.ts` → privacy §1 | From the ICO registration |
| `[[OUTREACH_MAILBOX_PROVIDER]]` | privacy §2 and §6 | The provider hosting the sending mailboxes (a processor) |
| `[[TRANSFER_MECHANISM_UK_TO_OPERATOR_COUNTRY]]` | privacy §7 | Safeguard for access from Ukraine — lawyer |
| `[[TRANSFER_MECHANISM_PROCESSORS: …]]` | privacy §7 | Safeguard per processor (IDTA / Addendum, UK–US data bridge) — lawyer |
| `[[CONFIRM_ANALYTICS_AND_ERROR_MONITORING: …]]` | privacy §6 | List PostHog / Sentry if enabled in production, else delete the line |
| `[[CONFIRM_PRODUCT_ANALYTICS: …]]` | privacy §8 | Describe the analytics identifier, or state that there is none |
| `[[CONFIRM_BACKUP_RETENTION_DAYS]]` | terms §7, DPA §9 | How long deleted content can persist in database backups (Neon history window) |
| `[[CONFIRM_BID_PASS_EXPIRY: …]]` | terms §4 | How long an unused Bid Pass stays valid |
| `[[CONFIRM_AI_PROVIDER_LOCATIONS]]` | DPA §4 | Where the model providers behind the Vercel AI Gateway process data |
| `[[CONFIRM_SECURITY_MEASURES: …]]` | DPA §5 | Confirm each listed measure is really in place (MFA on production accounts, backups, logging) |
| `[[CONFIRM_TRANSFER_MECHANISMS_WITH_LAWYER]]` | DPA §6 | SCC modules and the UK Addendum |

Also confirm that `support@bidfolio.co.uk` exists and is read (it is shown on every page).

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
| 14-day trial on Bid Desk, card required, nothing charged until day 15 | pricing, terms, refunds (`site.facts.trialDays`) | Trial period configured on the Bid Desk prices in Paddle |
| Unused bids roll over for one month | pricing, terms | Implemented in the bid-credit logic |
| 7 days' grace after a failed payment, then Free; data kept | pricing FAQ, terms | `BILLING_PAST_DUE_GRACE_DAYS=7` in production |
| Prices exclude VAT; VAT added at checkout | pricing | Paddle prices set as tax-exclusive |
| Prices are in pounds | everywhere | **The Paddle catalogue sync still creates prices in USD** (`src/lib/billing/paddle-catalogue.ts`, `currencyCode: "USD"`); switch it to `PLAN_CURRENCY` from `src/config/plans.ts` and update its test fixtures |
| Refund in full within 14 days of the first payment; Bid Pass refunded if unused | pricing FAQ, refunds, terms | Founder's decision; Paddle's own refund terms do not conflict |
| Refund requests confirmed within two working days | refunds §7 | A promise: keep it or soften it |
| Corrections and removals of public pages within five working days | terms §8, privacy §5, contact | A promise: needs a monitored mailbox and a removal procedure (P2 §4.5) |
| Complaints acknowledged within 30 days | privacy §11, contact | Legal duty since 19 June 2026 (DPA 2018 s. 164A); needs a log |
| Non-responders deleted after 90 days; opt-outs kept on a suppression list | privacy §2 and §9 (`site.facts.outreachRetentionDays`) | The retention job exists and runs |
| No tracking pixels in emails; the link carries a visit-counting code | privacy §8 | Open tracking off in the sending tool; lawyer to confirm the link code is fine under PECR reg. 6 (P2 §10 Q9) |
| "One independent founder, based in Ukraine" | landing ("Straight answers"), contact, privacy | True today; consider adding the founder's name and a photo for trust |
| "A bid takes a small firm about five days" | landing | FSB, December 2025 (cited on the page). Re-check the wording against the report |
| "About four in ten UK procedures are direct awards" | landing | Open Contracting Partnership, first year of Procurement Act data (cited on the page) |
| "UK guidance (PPN 017) lets buyers ask suppliers to disclose AI use" | landing FAQ | PPN 017, February 2025 |

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
