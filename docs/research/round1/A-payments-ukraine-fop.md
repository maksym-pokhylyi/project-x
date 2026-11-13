# A. Payments and payouts for a Ukrainian FOP (group 3) selling SaaS globally

Research round 1, workstream A. Research date: 2026-11-13. Audience: venture-selection team.

Scope: how a solo founder who is a Ukrainian sole proprietor (ФОП, simplified system, group 3, monobank FOP account)
can legally accept recurring SaaS payments and receive payouts as of November 2026, and what the blockers are.

---

## 0. Read this first: method, coverage and evidence labels

### 0.1 What was actually done

- 37 live web searches were completed on 2026-11-13 (English and Ukrainian), most of them restricted to official
  provider domains (paddle.com, stripe.com, docs.stripe.com, lemonsqueezy.com, polar.sh, docs.creem.io,
  docs.dodopayments.com, freemius.com, monobank.ua).
- **Two hard limits hit this run. Both materially reduce confidence and are not hidden anywhere below.**
  1. **Direct page reading was not possible.** Fetching pages failed for every host tried (www.paddle.com, stripe.com,
     www.lemonsqueezy.com, docs.lemonsqueezy.com) because they are outside this session's allowed network domains.
     So every "quote" below is the search engine's excerpt/rendering of the cited page, not a full read of the page.
     Excerpts can be truncated or stale. Each quote must be re-checked on the live page (URLs are given) before money
     or legal decisions depend on it.
  2. **The web-search budget ran out after 37 lookups** (a per-turn limit shared with other agents), against the 50-80
     planned. Research stopped while part 3 (Ukrainian acquiring) had just started. Parts 4 (marketplaces) and most of
     part 5 (FOP tax rules) therefore contain almost no live-verified facts.
- Where live verification was not possible, this report says so and falls back to the analyst's background knowledge
  (training data up to roughly mid-2026), explicitly labelled and never presented as a sourced fact.

### 0.2 Evidence labels used everywhere below

| Label | Meaning |
|---|---|
| **[F]** | FACT, sourced live on 2026-11-13 from a search excerpt of the cited URL (not a full page read). |
| **[F3]** | Fact sourced live, but from a third-party page (blog, competitor, forum), not the provider/government itself. |
| **[BK-H] / [BK-M] / [BK-L]** | UNVERIFIED background knowledge of the analyst (high / medium / low confidence). Not checked today. Treat as an assumption until verified. |
| **[I]** | INFERENCE: my reasoning from facts. |
| **[A]** | ASSUMPTION made to proceed. |
| **[U]** | UNKNOWN: could not be verified; needs a follow-up check or a question to support/accountant. |

### 0.3 Coverage by question

| Question | Live-verified today | State |
|---|---|---|
| 1. MoR providers | Mostly yes (seller/payout country, payouts, KYC, AUP for Paddle; country eligibility for the rest) | Good for the decision; feature details partly [BK] |
| 2. Stripe | Yes for availability and Managed Payments eligibility; workaround costs not verified | Good for the decision |
| 3. Ukrainian acquiring | Only monobank / plata by mono (fees, tokenization gating) | Partial; other acquirers are [BK] only |
| 4. Marketplace payouts | Only Freemius; two Atlassian forum threads located but not read | Mostly NOT verified |
| 5. FOP group 3 rules | Only the VAT-reform timeline up to July 2026 | Mostly NOT verified; numbers are [BK] |
| 6. Recommendation | Built on the verified part of Q1-Q2 | Usable, with listed unknowns |

A prioritized list of what to re-verify, with URLs and search queries, is in section 8.

---

## 1. Executive summary

**Bottom line: payments are not a blocker for a global B2B SaaS, provided two conditions hold.** The founder can use
Paddle Billing as merchant of record and be paid by SWIFT wire (USD/EUR) to the FOP account.

1. **Primary setup (verified from official Paddle help pages via search excerpts): Paddle Billing as merchant of record.**
   - Ukraine is a supported seller country. Only five Ukrainian regions are excluded: Crimea, Donetsk, Kherson,
     Luhansk and Zaporizhzhia [F].
   - Individuals / sole traders are accepted, with identity verification and domain review only; business verification
     is "not required for individuals or sole traders" [F].
   - Payouts: monthly, by wire transfer or Payoneer, minimum $100, in USD/EUR/GBP among others; a $15 SWIFT fee applies
     when the payout currency is not the bank country's currency (which is always the case for Ukraine) [F].
   - Price: 5% + $0.50 per transaction [F].
   - Sandbox works before any approval [F].
2. **The two conditions.**
   - The founder's registration/residence address must not be in the five excluded regions. Paddle names whole regions,
     so government-controlled Zaporizhzhia or Kherson may also be affected [F for the list; U for the founder's address].
   - The product must fit Paddle's Acceptable Use Policy. Explicitly out: human services/consulting not tied to
     software, marketplaces, regulated financial products and legal/investment advice, mass-marketing/telemarketing
     services, deepfake / impersonation AI [F]. Data or lead-list products are not addressed explicitly [U], so ask
     Paddle before committing to such an idea.
3. **Closed routes (verified).**
   - Stripe: its support page says Stripe "does not support users located in Russia, Ukraine and Belarus" [F].
   - Stripe Managed Payments: seller must be in one of 35 listed locations; Ukraine is not one [F].
   - Polar: pays out through Stripe Connect Express; Ukraine is not on its list [F].
   - Dodo Payments: Ukraine is only "grandfathered" for existing merchants [F]; new Ukrainian sellers reportedly not
     onboarded since 2026-03-23 [F3].
   - Lemon Squeezy: no bank payouts to Ukraine (PayPal only, per a 2023 company reply) and the product is being folded
     into Stripe Managed Payments [F].
4. **Backup MoR candidates (need one written confirmation each before relying on them).**
   - Freemius: its official list names "Ukraine (non-sanctioned regions)" for payouts via PayPal, Payoneer, wire or
     Wise [F]. Best-evidenced backup.
   - Creem: lists Ukraine for bank payouts, with a footnote about possible bank-partner restrictions [F].
   - 2Checkout/Verifone and PayPro Global: payout routes that work for Ukraine exist (wire, Payoneer) [F], but
     Ukrainian seller eligibility was not confirmed from an official page today [U].
5. **Ukrainian customers paying in UAH.** Bank transfer on invoice to the FOP IBAN for businesses, plus plata by mono
   for cards: 1.3% on Ukrainian cards, 2% on foreign cards [F]. Card tokenization for recurring charges exists in the
   API but is switched on by support and "available to a limited group of merchants" [F].
6. **Tax frame (NOT verified today, background knowledge):** single tax 5% + military levy 1% of income, ESV about
   1,902 UAH/month, group 3 limit about 10.09M UAH for 2026 [BK-H]. $10k MRR ($120k/year) is roughly half the limit [I].
7. **VAT reform for FOPs (partially verified):** the mandatory-VAT-above-1M-UAH proposal from December 2025 was not
   enacted as of mid-2026; sources from March-July 2026 describe it as softened (4M UAH threshold discussed), then
   effectively shelved for 2027 [F3]. **The status as of November 2026 could not be verified** [U].

**What this means for venture selection:** prefer ideas that are plainly "software sold as a subscription". Ideas that
depend on a marketplace model, on human services, on regulated financial/legal advice, on lead lists, or on
Stripe-only ecosystems (Stripe Connect payouts) carry payment risk for this founder.

---

## 2. Question 1: merchant-of-record providers

### 2.1 Comparison matrix

| Provider | Ukraine as seller country | Payout route to a Ukrainian FOP | Headline fee | Evidence | Verdict |
|---|---|---|---|---|---|
| **Paddle (Billing)** | Yes, except 5 regions [F] | SWIFT wire USD/EUR/GBP ($15 fee) or Payoneer; min $100; monthly [F] | 5% + $0.50 [F] | Official help center (excerpts) | **Primary** |
| **Freemius** | Yes, "Ukraine (non-sanctioned regions)" [F] | PayPal (default), Payoneer, wire, Wise; min $100; 10th of each month [F] | Not verified [U] | Official docs (excerpts) | **Backup 1** |
| **Creem** | Listed, with a footnote [F] | Bank transfer (partner restrictions possible), USDC; no PayPal [F] | 3.9% + $0.40 [BK-M] | Official docs (excerpt), footnote unread | Backup 2, confirm first |
| **2Checkout / Verifone** | Likely yes [F3] | Bank, PayPal or Payoneer; USD/EUR/GBP [F3] | 2Monetize 6% + $0.60 [BK-M] | Third-party only | Backup 3, confirm first |
| **PayPro Global** | Not confirmed [U] | Wire ($21), Payoneer ($2), PayPal (2%, max $20); 15th monthly [F] | Custom quote [F3] | Official FAQ for payout fees only | Ask sales |
| **FastSpring** | Not confirmed [U] | SWIFT wire, PayPal and others via Payouts Portal; no Payoneer; twice monthly [F] | Not published [F3] | Official docs for methods only | Ask sales |
| **Lemon Squeezy** | Effectively no | No bank payout to Ukraine; PayPal only [F] | 5% + $0.50 + surcharges [F3] | Official docs + company reply (2023) | Avoid |
| **Stripe Managed Payments** | No [F] | Not applicable | +3.5% on top of Stripe fees [F] | Official docs (excerpt) | Closed |
| **Polar** | No [F] | Stripe Connect Express only [F] | 5% + $0.50 per a competitor blog [F3] | Official docs (excerpt) | Closed |
| **Dodo Payments** | No for new sellers [F]/[F3] | Not applicable | 4% + $0.40 [BK-M] | Official docs (excerpt) | Closed |
| **Gumroad** | Not confirmed [U] | Bank in listed countries, else PayPal; no wire/Payoneer [F3] | 10% + $0.50 [F3] | Third-party only | Not suitable |

### 2.2 Paddle (Paddle Billing): the primary candidate

**Seller and payout country**

- [F] "Paddle works with software businesses anywhere in the world with the exception of the unsupported countries
  listed below." The unsupported list includes these Ukrainian regions: Crimea, Donetsk, Kherson, Luhansk,
  Zaporizhzhia. Other unsupported countries include Belarus and Russia among about two dozen.
  Source: https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle
- [F] "Software businesses from Russia/Belarus or any of the sanctioned regions (Crimea, Donetsk, Kherson, Luhansk,
  and Zaporizhzhia) won't be able to sign up for an account." and "Buyers based in the rest of Ukraine will be able to
  complete purchases as usual."
  Source: https://www.paddle.com/help/legal/sanctions/impact-of-sanctions-on-russia-and-belarus
  (the search tool flagged this page as old; the country list page above is the current reference).
- [F] Early in the 2022 war (exact date not captured) Paddle's blog described offering more frequent payouts to its
  customers in Ukraine with significant volume. This shows Paddle has had Ukraine-based sellers and paid them. It is
  not a current policy statement. Source: https://www.paddle.com/blog/message-on-ukraine-conflict
- [I] Paddle publishes no separate "payout countries" list. Combining the country list, the generic wire payout and the
  2022 post, payouts to a Ukrainian bank account are expected to work. **This is an inference**: there is no official
  sentence saying "we pay out to Ukrainian banks". It is question 2 in the support list (section 7.4).
- [U] Whether Paddle treats the government-controlled parts of Zaporizhzhia, Kherson and Donetsk oblasts as excluded.
  The wording names whole regions.

**Sole proprietors**

- [F] Verification has three parts: domain review, identity verification, and "business verification (not required for
  individuals or sole traders)". Source: https://www.paddle.com/help/start/account-verification
- [F] For a sole trader "you will be the person required to do the identity verification check". When more is needed
  Paddle asks for "a government-issued ID and a proof of address via our partner Sumsub", sometimes a liveness video.
  Source: https://www.paddle.com/help/start/account-verification/what-is-identity-verification
- [F] For sole proprietors Paddle recommends using the legal (personal) name in the Terms on the website.
  Source: https://www.paddle.com/help/start/account-verification/what-is-domain-verification

**Payouts**

- [F] "Sellers cannot withdraw their balance on demand since there is a monthly payout schedule. If your balance meets
  the minimum threshold, Paddle creates your payout on the 1st and sends the payment by the 15th." Threshold: "$100
  adjustable all the way to $100,000". Methods named: wire transfer or Payoneer. After sending "it can then take up to
  3 working days before it arrives in your account".
  Source: https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid
- [F] Fees: "for most countries, Paddle will not charge you any fees on your payout". Exceptions: a $/EUR/GBP 15 SWIFT
  fee when the payout currency differs from the currency of the bank's country; Payoneer's own fees; a conversion
  margin "of up to 1.5%" if the payout currency differs from the balance currency.
  Source: https://www.paddle.com/help/manage/get-paid/is-there-a-fee-taken-for-payouts
- [F] Payout currencies listed: AUD, GBP, CAD, CNY, CZK, DKK, EUR, HUF, PLN, ZAR, SEK, CHF, USD. No UAH.
- [I] For a Ukrainian FOP every wire payout is a SWIFT payment in USD or EUR, so the $15 fee applies each month, plus
  any correspondent-bank or receiving-bank charges [U for the bank side].
- [I] Cash lag: revenue from month M arrives between the 1st and about the 18th of month M+1.
- [U] PayPal as a Paddle payout method: it appears only on an affiliate-programme page, not in the seller help docs.
  Assume it is not available. Wise is not mentioned.
- [U] Reserve/hold policy for new sellers and chargeback fees.

**Pricing**

- [F] "5% + 50¢ per transaction", no monthly fee; custom pricing for high volume. Source: https://www.paddle.com/pricing
- [I] Effective rate: 6.7% on a $30 charge, 5.5% on $100, 5.2% on $300. At $10k MRR with 100 customers the fee is about
  $550/month.

**Onboarding, KYC and website review**

- [F] Website must show: a clear product description, pricing details or a pricing page ("a screenshot is acceptable if
  the page isn't live yet"), key features. "Terms and Conditions, Refund Policy, and Privacy Policy must be clearly
  accessible via navigation on your website." The company (or legal personal) name must appear in the Terms; the site
  must be live with HTTPS. Source: https://www.paddle.com/help/start/account-verification/what-is-domain-verification
- [F] Developer checklist adds a contact email reachable from the homepage.
  Source: https://developer.paddle.com/build/onboarding/set-up-checklist
- [F] Each domain/subdomain that launches a checkout needs approval; one approved domain is enough to proceed.
- [F] Timing: "Paddle automatically approves most domain submissions. If your submission requires a manual review by our
  team, this is typically completed within an estimated 5-7 business days." Business verification manual review "2-4
  business days". "Identity verification is typically instant ... manual review ... 1-3 business days."
- [F] Possible extra requests: proof of product ownership, a reseller agreement, a processing statement for the last
  3 months ("if you don't have this due to being a new business, we'll take that into account").
- [F] Common rejection reasons: product conflicts with the AUP, domain flagged high-risk, no reply to information
  requests.
- [F] MSA clause 9.1: the seller must provide KYC information on request (owners, financial status, tax status and
  registrations). Paddle may terminate if products fall outside the AUP. Source: https://www.paddle.com/legal/terms

**Acceptable-use restrictions relevant to idea selection**

Source for all [F] items: https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle

| Category we care about | Finding |
|---|---|
| Human services / consulting | [F] Prohibited when not tied to a software offering (pure consulting, legal advice, coaching). "If the primary offering is human services such as consultation, support, or design ... Paddle is not a good fit." |
| Marketplaces | [F] Prohibited: products that let non-Paddle sellers sell to customers. |
| Legal / financial tools | [F] Prohibited: regulated financial products or services "in any jurisdiction", investment advice, credit counseling; legal advice as a human service. [I] A software tool that generates or checks documents is software, so probably acceptable, but anything that reads as advice or a regulated service is at risk. Ask before building. |
| AI-generated output | [F] Prohibited: deepfakes, voice impersonation, use of a likeness without explicit consent, automated categorization of people. Image-generation tools are not banned but get extra checks. [F] Paddle runs an official "Lovable Payments, powered by Paddle" integration page, which signals general openness to AI-built SaaS. |
| Data / lead lists | [U] Not explicitly addressed in what was retrieved. Adjacent prohibitions exist: advertising services, mass marketing, telemarketing. Treat as high rejection risk until Paddle confirms in writing. |
| Pre-launch products | [F] A live HTTPS site is required; a pricing screenshot is acceptable if the pricing page is not live. [U] Pre-orders and products not yet usable were not addressed. |

**Subscription features and developer experience** (not verified today except the sandbox line)

- [F] "Sandbox testing doesn't require approval."
- [BK-H] Separate sandbox account with test cards; full API parity for products, prices, checkout, subscriptions,
  webhooks (with a webhook simulator).
- [BK-H] Subscriptions with trials, upgrades/downgrades with proration modes, pause/resume, scheduled changes.
- [BK-M] Dunning: built-in payment retries plus Paddle Retain for recovery and cancellation flows. Whether Retain is
  included in the 5% + $0.50 was not checked [U].
- [BK-M] Hosted customer portal (update card, invoices, cancel).
- [BK-H] Tax-inclusive or tax-exclusive pricing per country; checkout collects VAT IDs and issues invoices to the
  buyer in Paddle's name, applying reverse charge for valid EU VAT IDs. Invoicing with bank-transfer payment exists
  for larger B2B deals.
- [BK-H] Official `@paddle/paddle-js` and `@paddle/paddle-node-sdk` packages and an official Next.js starter kit.
- [I] Because Paddle is the seller on the customer's invoice and card statement, some enterprise procurement teams will
  ask why the vendor is "Paddle.com". Normal for MoR; mention it in the FAQ.

### 2.3 Lemon Squeezy

- [F] Status: on 2026-01-28 Lemon Squeezy published a "2026 update" saying its future is built through Stripe Managed
  Payments, with a goal of an easy migration path. Source: https://www.lemonsqueezy.com/blog/2026-update
- [F3] No shutdown has been announced. Reports on new signups conflict: some 2026 sources say signups are open, others
  say access became waitlist- or invite-gated around mid-2026 (the source itself marks this as unconfirmed).
  Sources: https://dodopayments.com/blogs/lemonsqueezy-review (competitor),
  https://resources.rework.com/tools/billing-revenue/paddle-vs-lemon-squeezy
- [F] Ukraine is not in the bank-payout country list. The page says: "if your country isn't listed by PayPal or in the
  list below, you can't use Lemon Squeezy as a merchant or affiliate". PayPal payouts are offered in "200+ countries".
  Source: https://docs.lemonsqueezy.com/help/getting-started/supported-countries
- [F] In December 2023 a Ukrainian developer complained that payouts to Ukraine were no longer supported; the company
  replied: "That refers to bank payouts. You can still use PayPal". Source: https://twitter.com/lmsqueezy/status/1738152348906672133
- [F3] Ukrainian PayPal accounts are personal accounts limited to person-to-person transfers and cannot receive
  commercial payments. Source: PayPal Community thread
  https://www.paypal-community.com/t5/Transactions/account-from-Ukraine-receiving-payments/m-p/3162489
- [I] Verdict: not usable. The only payout route is PayPal, which is not a legitimate channel for business income of a
  Ukrainian FOP, and the platform's end state (Stripe Managed Payments) excludes Ukraine.
- [F3] Fees: 5% + $0.50 plus surcharges for international cards, PayPal and subscriptions.

### 2.4 Stripe Managed Payments (the Lemon Squeezy successor)

Covered in section 3.2. Not available to Ukraine-based sellers [F].

### 2.5 Polar.sh

- [F] "Polar uses Stripe Connect Express to issue payouts to residents or businesses in any of the countries below."
  "If yours isn't listed during onboarding, we can't currently issue payouts there." The list runs from Albania to
  Vietnam; the search of the page found Uruguay and Uzbekistan but not Ukraine.
  Source: https://polar.sh/docs/merchant-of-record/supported-countries
- [F] Polar on X (2025-04): "Since Polar is the Merchant of Record and uses Stripe Connect Express for payouts, we're
  only able to support sellers in all of the countries listed here". Source: https://x.com/polar_sh/status/1915379610809782428
- [F] Stripe's own docs say self-serve cross-border payouts are limited to listed regions; Ukraine was not found in them.
  Source: https://docs.stripe.com/connect/cross-border-payouts
- Verdict: closed for a Ukraine-resident founder. [U] residual: the full country list was not read line by line.

### 2.6 Creem

- [F] The supported-countries page lists Ukraine in its bank-transfer table, marked with a footnote. A third-party
  guide describes that mark as: countries that "may face restrictions from Creem's bank transfer partner". Crimea,
  Donetsk, Kherson, Luhansk and Zaporizhzhia are excluded for purchases.
  Source: https://docs.creem.io/merchant-of-record/supported-countries (search tool dated the page about 4 months old).
- [F] "Creem does not currently support PayPal for merchant payouts." Options: bank transfer, Alipay, USDC on Polygon.
  Source: https://docs.creem.io/guides/faq
- [F3] Payout fees reported: international payouts $7 or 1%, whichever is higher; stablecoin 2%. A newer pricing page
  reportedly shows 0% for several methods; the figures conflict.
- [I] A USDC payout is not a workable route for a group-3 FOP: single-tax payers must settle in money, and crypto
  receipts are not money on a bank account. Only the bank-transfer route counts.
- [BK-M] Fee 3.9% + $0.40; young company (launched 2024-2025); test mode available; positions itself for AI products.
- Verdict: possible backup, but the footnote must be resolved with support first.

### 2.7 Dodo Payments

- [F] Payouts are supported only in listed countries. Ukraine appears in the list of countries "currently
  grandfathered": "Merchants who were receiving services in a country before it was added to the prohibited list will
  not be affected, and may continue transacting under enhanced monitoring".
  Source: https://docs.dodopayments.com/miscellaneous/accepted-countries-and-territories
- [F3] "Since 23 March 2026, Dodo no longer onboards new sellers from Bangladesh, Egypt, Morocco, Nigeria or Ukraine
  (existing merchants are kept)." Source: https://agentaos.ai/dodo-payments-alternative (dated 2026-10-06).
- Verdict: closed for a new Ukrainian seller.

### 2.8 FastSpring

- [F] Payout methods: PayPal, Venmo (US only), direct deposit/ACH, paper check, SWIFT international wire, MoneyGram
  cash pickup. "Payoneer is not a supported transfer method." Available options depend on the country and currency
  chosen in the Payouts Portal. Source: https://developer.fastspring.com/docs/set-up-your-payout-account
- [F] Payouts twice a month (15th and end of month). Source: https://developer.fastspring.com/docs/welcome-to-fastspring
- [F3] Reviews mention a 45-day monitoring hold on new accounts and a $100 minimum; pricing is not published.
- [U] Whether a Ukrainian sole proprietor is accepted as a seller and whether SWIFT to Ukraine is offered.
- Verdict: unknown; sales-led onboarding. Only worth a query if Paddle and Freemius both fail.

### 2.9 Verifone / 2Checkout

- [F3] Ecwid's help center lists 2Checkout (Verifone) among providers a merchant located in Ukraine can use.
  Source: https://support.ecwid.com/hc/en-us/articles/360003067820-Payment-options-for-Ukraine
- [F3] Payout accounts can be a bank account, PayPal or Payoneer; payouts in USD, EUR or GBP; approval of a payout
  account takes about two business days. Sources: https://www.jotform.com/2checkout/faq/ and
  https://verifone.cloud/docs/2checkout/Onboarding/Payouts (official, only partly excerpted).
- [BK-M] Plans: 2Sell 3.5% + $0.35 (not MoR), 2Subscribe 4.5% + $0.45, 2Monetize 6% + $0.60 (MoR for digital goods).
  The search did not confirm these numbers.
- [BK-M] Reputation: slower support, rolling reserves and account reviews are common complaints.
- [U] Official current confirmation that Ukraine-registered sole proprietors are accepted.
- Verdict: plausible backup with the highest fee; confirm eligibility in writing.

### 2.10 PayPro Global

- [F] Payout fees per transaction: Payoneer $2, wire transfer $21, ACH (US) $3; PayPal free for US/Canada and 2%
  internationally with a $20 maximum. Payouts processed on the 15th of each month for the previous month's balance.
  Sources: https://payproglobal.com/faq/ and https://developers.payproglobal.com/docs/platform-overview/withdrawal-options/
- [F3] No public price list; custom pricing.
- [I] PayPro Global maintains a Ukrainian-language website section, which suggests it markets to Ukrainian vendors.
- [U] Official statement on Ukrainian sole-proprietor eligibility; fee level.
- Verdict: ask sales; plausible backup.

### 2.11 Freemius

- [F] The official supported-countries page lists "Ukraine (non-sanctioned regions)" among payout countries and
  "Ukraine (sanctioned regions)" among unsupported ones. Payout methods: "PayPal (default payment method, using PayPal
  MassPay), Payoneer, wire transfer, and Wise".
  Source: https://freemius.com/help/documentation/selling-with-freemius/supported-countries/
  (the search tool dated the page more than a year old; the newer pricing page names PayPal, Payoneer or bank wire only).
- [F] Payouts are processed automatically on the 10th of each month; minimum $100.
  Source: https://freemius.com/help/documentation/selling-with-freemius/your-earnings/
- [F] Freemius has a dedicated SaaS offering page. Source: https://freemius.com/freemius-for-saas/
- [U] Current fee for SaaS, whether individuals/sole proprietors are accepted without a company, SaaS feature depth
  (proration, dunning, portal), sandbox before approval, product-category rules.
- Verdict: best-evidenced backup. Open an account in parallel and confirm the unknowns.

### 2.12 Gumroad

- [F3] Fee 10% + $0.50 on direct sales. Payouts by bank deposit in supported countries, otherwise PayPal (2% fee).
  No Payoneer, Wise or wire. One comparison says Gumroad "has payout issues for creators in countries without Stripe
  support". Ukraine was not named in any source found.
- Verdict: not suitable for B2B SaaS at this price, and payout to Ukraine is unconfirmed.

### 2.13 Other MoR names (not researched; listed only so a follow-up can check them)

Cleverbridge, Reach, Nexway (enterprise, volume minimums) [BK-L]; Whop, Fungies, Payhip, Sellfy (creator-oriented,
payout rails often Stripe/PayPal) [BK-L]; Xsolla (games) [BK-L]. None was checked today [U].

---

## 3. Question 2: Stripe

### 3.1 Is Ukraine supported in November 2026?

**No.** Three concordant sources; stripe.com/global itself could not be opened in this session.

- [F] Stripe support: "Stripe currently does not support users located in Russia, Ukraine and Belarus."
  Source: https://support.stripe.com/questions/sanctions-on-russia-and-belarus (search tool showed the page as
  refreshed about 11 days before 2026-11-13).
- [F] The Managed Payments eligibility page lists supported business locations and Ukraine is absent (section 3.2).
- [F3] "Stripe in Ukraine 2026: questions and answers" states there is no official launch and that Ukraine is not on
  Stripe's global availability page. Source: https://westernbid.com/en/?p=23497 (a vendor of an alternative service,
  so commercially interested).
- [F3] On 2025-11-28 dev.ua reported that the National Bank of Ukraine said Stripe and PayPal had never applied for a
  licence to operate in Ukraine. Source: https://dev.ua/en/news/nbu-zaiavyv-shcho-stripe-i-paypal-zhodnoho-razu-ne-prosyly-litsenziiu-dlia-roboty-v-ukraini-1764321864
- [F] No Stripe newsroom item about a Ukraine launch, preview or invite programme was found.
- [U] Whether stripe.com/global shows Ukraine under any "preview / invite-only" label. Not opened. Nothing found
  suggests it does.
- [F] Side note: Stripe Tax can collect Ukrainian VAT on digital services. That is for foreign sellers selling into
  Ukraine and says nothing about Ukrainian sellers. Source: https://docs.stripe.com/tax/supported-countries/europe/ukraine

### 3.2 Stripe Managed Payments

- [F] It is Stripe's merchant-of-record product. API support was added in the 2026-04-22 release per the docs
  changelog; secondary sources describe a public preview in February 2026 and general availability in April 2026 [F3].
  Source: https://docs.stripe.com/changelog/dahlia/2026-04-22/managed-payments
- [F] It handles indirect tax in 80+ countries, fraud, disputes and customer support for digital products (SaaS,
  software, digital content). The customer sees "Link" as the seller ("Sold through Link").
  Source: https://docs.stripe.com/payments/managed-payments
- [F] Pricing: "Managed Payments adds 3.5% per successful transaction to your standard Stripe processing fees."
  Source: https://stripe.com/managed-payments
- [F] Eligibility: "Stripe determines access to Managed Payments based on an eligibility review that considers factors
  such as business type and geography." Direct integrations only (no Connect platforms or Express accounts).
  Supported business locations: CA, US; AT, BE, BG, CH, CY, CZ, DE, DK, EE, ES, FI, FR, GB, GI, GR, HR, HU, IE, IT, LI,
  LT, LU, LV, MT, NL, NO, PL, PT, RO, SE, SI, SK; AU, HK. That is 35 locations, **without Ukraine**.
  Source: https://docs.stripe.com/payments/managed-payments/eligibility
- [F3] It works only with Stripe-hosted flows (Checkout, Payment Links).
  Source: https://freemius.com/blog/stripe-merchant-of-record/ (competitor).
- Verdict: unusable from Ukraine. It becomes usable only together with a foreign company (section 3.3).

### 3.3 Workarounds through a foreign company (later option only)

None of the numbers in this subsection was verified today. All are [BK-M] unless marked otherwise. Treat them as
orders of magnitude and re-check before acting.

| Route | Rough cost | What it unlocks | Main consequences for a Ukrainian tax resident |
|---|---|---|---|
| US LLC or C-corp via Stripe Atlas | $500 one-time; about $100/year registered agent after year 1; Delaware LLC tax $300/year (C-corp franchise tax from about $400/year plus a $50 report); US tax filing $300-1,500/year | Stripe US, Managed Payments, Polar, Lemon Squeezy, PayPal Business | A foreign-owned single-member LLC must file Form 5472 with a pro-forma 1120 every year (penalty $25,000 if missed). In Ukraine the LLC is a controlled foreign company: notification and annual CFC report, possible Ukrainian tax on its profit. |
| Estonian OÜ via e-Residency | e-Residency fee about EUR 150; registration about EUR 265; contact person and address EUR 200-400/year; accounting EUR 80-200/month | Stripe Estonia, Managed Payments (EE is on the list) | Estonian corporate tax about 22% only on distributed profit. Same Ukrainian CFC duties. Risk that a company managed from Ukraine is treated as Ukrainian tax resident (place of effective management). |
| UK LTD | Incorporation about GBP 50-100; registered office GBP 50-100/year; accounting GBP 500-1,500/year | Stripe UK, Managed Payments (GB is on the list) | UK corporation tax 19-25% on profit. Director identity verification at Companies House. Same Ukrainian CFC and management-place risks. |

Common points [BK-M]:

- Money reaches the founder either as dividends (taxed in Ukraine at about 9% personal income tax plus 5% military levy
  for foreign dividends) or as service fees paid by the foreign company to the Ukrainian FOP (single tax 5% + 1%).
  The second structure is common but must be defended as a real service relationship.
- CFC duties: notify the tax office of acquiring a foreign company (60 days), file an annual CFC report with the
  income declaration. CFC profit can be exempt from Ukrainian tax when total CFC income is under EUR 2M, but the
  reporting still applies. Penalties for missed notifications and reports are large (hundreds of thousands of UAH).
- Wartime currency restrictions limit moving capital out of Ukraine to fund a foreign company [BK-L on current state].
- [I] A foreign entity adds about $1.5k-4k/year in fixed cost and two tax systems. It is reasonable to defer until
  revenue justifies it or a specific Stripe-only capability is needed.

---

## 4. Question 3: Ukrainian acquiring for subscriptions

Live verification covered only monobank. Everything else in this section is background knowledge and is flagged.

### 4.1 monobank acquiring / plata by mono (partly verified)

- [F] Fees: 1.3% per transaction; 2% for payments from abroad (foreign cards). Source: https://monobank.ua/plata-by-mono
  and https://monobank.ua/en/knowledge-base/acquiring/index
- [F] Onboarding: needs a FOP (or legal-entity) account at mono; the acquiring tool is added in the business cabinet
  and the application is signed in the app. Source: same pages. A partner blog describes connection in about ten
  minutes [F3]: https://shop-express.ua/ukr/blog/acquiring-from-monobank/
- [F] The product page mentions subscription payments and payment by token (repeat payments without re-entering card
  details).
- [F] API: invoice creation accepts a `saveCardData` object with `saveCard` (boolean) and optional `walletId`.
  Tokenization is not on by default: "to enable the feature, contact monobank's support service", and it is
  "available to a limited group of merchants". A zero-amount verification with `saveCard: true` exists. Webhooks fire
  on tokenized-card status changes.
  Sources: https://monobank.ua/en/api-docs/acquiring/extras/tokens/post--api--merchant--invoice--create and
  https://api.monobank.ua/docs/acquiring.html
- [F3] Third-party SDKs describe the flow: first invoice with `saveCardData`, webhook returns a card token, later
  charges via `POST /api/merchant/wallet/payment`; card list via `GET /api/merchant/wallet`. One SDK also describes a
  subscription object where the bank charges automatically at each interval.
  Sources: https://pkg.go.dev/github.com/stremovskyy/go-monobank and
  https://pkg.go.dev/github.com/OlexiyOdarchuk/go-monobank-sdk/v2/acquiring
- [BK-M] Apple Pay and Google Pay are available on the payment page. Hold (pre-authorisation) payments exist.
  Webhooks are signed (ECDSA) and a test token is available for integration testing.
- [U] Settlement currency. The API has a currency parameter that defaults to UAH [BK-M]. Whether a FOP can price and
  settle in USD/EUR was not verified. Assume UAH-only settlement until confirmed.
- [U] Payout timing to the FOP account, chargeback process and fees, limits.
- [U] Whether the official API exposes a managed "subscription" object or only merchant-initiated token charges.
- [I] **Gating risk:** recurring billing on plata by mono depends on support enabling tokenization for this merchant.
  Request it before designing the Ukrainian billing flow.

### 4.2 Other Ukrainian options (NOT verified today)

| Provider | Recurring / tokens | Currencies | Fee | Notes |
|---|---|---|---|---|
| LiqPay (PrivatBank) | [BK-H] Yes: subscription action with periodicity, card tokens | [BK-M] UAH, USD, EUR as charge currencies | [BK-M] about 1.5% domestic; foreign-card rate [U] | [BK-H] Needs a PrivatBank business account. Apple/Google Pay [BK-M]. |
| WayForPay | [BK-H] Yes: regular payments mode and recurring tokens | [BK-M] UAH, USD, EUR | [BK-L] about 2%; more for foreign/currency payments | [BK-M] Fast FOP onboarding. [BK-L] Was linked to a 2023 investigation into gambling payment flows; check current regulatory standing. |
| Fondy | [BK-M] Historically yes | [BK-M] multi-currency | [U] | [BK-M] Its Ukrainian licensed entity lost its NBU licence in 2023 and the UK entity entered special administration around 2024-2025. Treat as not operational until proven otherwise. |
| Hutko | [U] | [U] | [U] | [BK-L] Reported as the successor used by the former Fondy Ukraine team and merchants. Unverified. |
| Portmone | [BK-M] Yes | [BK-L] mainly UAH | [BK-L] about 2-2.75% | Long-established. Unverified. |
| RozetkaPay, NovaPay, Tranzzo, UAPAY, iPay.ua, EasyPay, Platon | [U] | [U] | [U] | Named for a follow-up only. |
| Solidgate | [BK-M] Strong subscription tooling | multi-currency | custom | [BK-M] Ukrainian-founded but serves companies with EU/UK/US entities and meaningful volume. Not a route for a FOP. |

### 4.3 Using Ukrainian acquiring to sell subscriptions to foreign B2B customers: pros and cons

Reasoning, not sourced facts, except where marked.

| Aspect | Assessment |
|---|---|
| Cost | [F] 2% on foreign cards at plata by mono versus 5% + $0.50 at Paddle. Cheaper on paper. |
| Tax compliance abroad | [I] The FOP becomes the seller. EU B2C sales of digital services require EU VAT registration (non-Union OSS) from the first euro; EU B2B needs VAT-ID validation and reverse-charge invoices; UK and other countries have their own rules; US states have economic-nexus thresholds for sales tax. A MoR removes all of this. This is the main reason not to use local acquiring for global sales. |
| Currency display | [U]/[I] If settlement is UAH-only, foreign customers are charged in UAH and their bank converts. That is poor for B2B trust and for accounting. |
| Decline rates | [I] Cross-border charges from a Ukrainian merchant are likely to see more issuer declines and 3-D Secure friction than a UK/US MoR. No data found. |
| Trust | [I] US/EU business buyers expect a familiar checkout and an invoice from a known entity. |
| Chargebacks | [I] The FOP carries dispute handling and losses. With a MoR, the MoR handles them. |
| Recurring | [F] Token charging is gated at monobank. Other acquirers offer it [BK]. |
| Income base for tax | [BK-H] The FOP's taxable income is the gross amount paid by the customer; the acquirer's commission is not deductible on the single tax. |
| Fiscal receipts | [U] Whether card payments through internet acquiring require a software cash register (ПРРО) for a FOP selling services is a known grey area. Ask the accountant. |

[I] Conclusion: Ukrainian acquiring is the right tool for Ukrainian customers paying in UAH, and the wrong primary tool
for US/UK/EU customers.

---

## 5. Question 4: marketplace payouts to Ukraine

**Almost nothing in this section was verified today** (search budget ran out). The table gives background knowledge
with confidence levels so that a follow-up can verify quickly. Do not select or reject a marketplace-based idea on
this table alone.

| Marketplace | Payable to a Ukraine-based FOP? | How | Revenue share | Tax forms / notes |
|---|---|---|---|---|
| Atlassian Marketplace | [F3] Community threads from Ukrainian sole proprietors exist and the search summary says payouts to Ukrainian accounts are supported "in some cases". Threads not read. [BK-M] Many Ukraine-based vendors sell there. | [BK-M] Bank transfer, monthly | [BK-M] Atlassian keeps about 15-17% on cloud apps; a 0% share on the first $1M for Forge apps was announced for 2026 [BK-L] | [U] |
| Shopify App Store / Partners | [U] Critical unknown: partner payouts are by PayPal or by bank in listed countries [BK-M]; whether Ukraine has a bank route was not checked. PayPal cannot receive commercial funds in Ukraine [F3]. | [U] | [BK-M] 0% on the first $1M lifetime, then 15%; plus processing fee | [U] |
| Microsoft Partner Center / AppSource / Teams (transactable SaaS) | [BK-M] Yes, Ukraine is believed to be on the supported publisher/payout list | [BK-M] Bank transfer | [BK-M] 3% agency fee on transactable SaaS | [BK-M] Tax profile with W-8 form in Partner Center |
| monday.com apps marketplace | [U] | [U] | [U] | [U] |
| Wix App Market | [U] | [U] | [BK-L] about 20% | [U] |
| GoHighLevel app marketplace | [U] If payouts run on Stripe Connect, Ukraine is excluded [I] | [U] | [BK-L] about 15% | [U] |
| Zendesk Marketplace | [BK-M] Paid-app payouts required a Stripe account, which excludes Ukraine [I] | Stripe | [BK-M] about 20% | [U] Current state of built-in billing |
| JetBrains Marketplace | [BK-M] Yes | [BK-M] Wire transfer; JetBrains is the reseller | [BK-M] 15% | [U] Minimum payout, KYC |
| Zoom App Marketplace | [U] | [U] | [U] | [U] Whether native monetization is generally available |
| WordPress plugins via Freemius | [F] Yes: "Ukraine (non-sanctioned regions)" | [F] PayPal, Payoneer, wire, Wise; $100 minimum; 10th of month | [U] | Source in section 2.11 |
| Chrome Web Store | No native payments [BK-H] (Chrome Web Store payments were shut down in 2020-2021) | Use own billing (a MoR) | n/a | n/a |
| Google Workspace Marketplace | No native billing [BK-H] | Own billing | n/a | n/a |
| Slack | No native billing [BK-H] | Own billing | n/a | n/a |
| HubSpot App Marketplace | No native billing [BK-M] | Own billing | [U] Any partner fee | n/a |

Sources located today (titles only, content not read):

- https://community.developer.atlassian.com/t/payouts-to-ukraine-bank-account-for-individual-developer-sole-proprietor-supported/102880
- https://community.developer.atlassian.com/t/marketplace-payouts-for-a-partner-based-in-ukraine-sole-proprietor/103157

[I] Practical reading for idea selection: marketplaces without native billing (Chrome, Google Workspace, Slack, HubSpot)
are neutral, because the founder bills through Paddle anyway. Marketplaces that force their own billing are safe only
when the payout rail to Ukraine is confirmed. Any marketplace that pays through Stripe Connect or PayPal should be
assumed closed until proven otherwise.

---

## 6. Question 5: FOP group 3 rules for 2026

**Verification status: only the VAT-reform timeline (6.8) has live sources. Everything else here is the analyst's
background knowledge of the Tax Code and NBU rules, not checked today against tax.gov.ua, zakon.rada.gov.ua or
bank.gov.ua.** The founder's accountant should confirm each number before the first tax quarter.

### 6.1 Rates and amounts

| Item | Value | Label |
|---|---|---|
| Single tax, group 3, not a VAT payer | 5% of income | [BK-H] Tax Code art. 293.3 |
| Single tax, group 3, VAT payer | 3% of income plus VAT | [BK-H] |
| Military levy for group 3 single-tax payers | 1% of income, same base and deadlines as the single tax (in force since 2025-01-01, Law 4015-IX) | [BK-H]; end date of the levy [U] |
| Minimum wage on 2026-01-01 | 8,647 UAH | [BK-H] State Budget 2026 |
| ESV (unified social contribution), minimum | 22% of minimum wage = 1,902.34 UAH/month, 5,707.02 per quarter, 22,828.08 per year | [BK-H]; obligatory again since 2025 |
| Group 3 annual income limit 2026 | 1,167 minimum wages = 10,091,049 UAH | [BK-H] |
| Limit in USD | about $224k-240k | [A] exchange rate assumed in the 42-45 UAH/USD range; check bank.gov.ua |
| Reporting | Quarterly declaration within 40 days after the quarter; tax paid within 10 days after that deadline | [BK-H] |
| Above the limit | 15% on the excess and loss of the simplified system | [BK-H] |

[I] Check against the target: $10k MRR is $120k/year, about 5.0-5.4M UAH, roughly half the limit. Effective burden on
received income is about 6% plus about $45/month ESV. The limit for 2027 depends on the 2027 minimum wage [U].

### 6.2 Does income from a MoR / reseller fit group 3?

- [BK-H] Group 3 may sell services and goods to any customers, including non-residents, and may receive foreign
  currency by bank transfer. Prohibited activities (art. 291.5) do not include software or IT services.
- [BK-H] Single-tax payers must settle only in money, cash or non-cash (art. 291.6). Barter, netting and payment in
  crypto are outside the regime. [I] This is why a USDC payout (Creem) is not a usable route.
- [BK-H] Income is recognised on the date money is received, at the NBU official rate of that date (art. 292).
- [I] **Gross or net?** Under a reseller contract the FOP sells to the MoR, and the price of that supply is what the
  MoR pays (the amount on Paddle's reverse invoice). Income is then the payout received. Under an agency contract,
  income would be the full amount customers paid and the fee would not be deductible. Paddle describes itself as a
  reseller and issues reverse invoices [BK-M], which supports the net treatment, but the tax office's view of a
  particular contract cannot be assumed. Accountant question 1.
- [I] **Royalty risk.** The Tax Code excludes passive income, including royalties, from a FOP's single-tax income
  (art. 292.1); such income is taxed as personal income at 18% plus 5% military levy [BK-H]. Payments for end-user
  use of software and for services are not royalties (definition in art. 14.1.225) [BK-M]. A SaaS subscription is a
  service, so the exposure is lower than for downloadable software licences, but a contract that speaks of licensing
  intellectual property to a reseller could invite the argument. Accountant question 2.

### 6.3 Documents for foreign-currency income from a non-resident MoR

- [BK-H] For export of services (other than transport) a foreign-economic contract can be concluded by accepting a
  public offer, by exchanging electronic messages, or by issuing an invoice, including an electronic one (Law on
  Foreign Economic Activity, art. 6, as amended in 2016). An invoice is a valid primary document for such services.
- [I] Working document set for Paddle: (1) the Master Services Agreement accepted online, saved as PDF with the
  acceptance date; (2) each monthly reverse invoice / payout statement; (3) the bank statement showing the SWIFT
  credit; (4) a short internal register of income by date and NBU rate.
- [F] Paddle has a help article on the statements a seller receives: https://paddle.com/support/what-statements-will-i-receive
  (title located; content not read).
- [U] Whether monobank requires a Ukrainian translation or a signed copy for its currency-supervision file.

### 6.4 Currency supervision

- [BK-H] Export operations under 400,000 UAH equivalent are outside currency supervision of settlement deadlines.
- [BK-H] The settlement deadline for exports of goods is 180 days under the wartime NBU rules (365 days before).
- [BK-M] Exports of services (other than transport and insurance), works and intellectual-property rights are not
  subject to the settlement deadline at all. Exact paragraph in NBU Regulation No. 5 / Resolution No. 18 not
  re-checked.
- [BK-M] Mandatory sale of foreign-currency proceeds was abolished in June 2019 and has not been reintroduced. The FOP
  may keep USD/EUR on the account or sell it.
- [I] At $10k MRR a monthly payout is close to or above 400,000 UAH, so the bank will run its currency-supervision and
  financial-monitoring routine on each payout. Expect to upload the agreement and the reverse invoice in the app.
- [BK-M] When currency is sold, a positive difference between the sale rate and the NBU rate may count as additional
  income. Accountant question 7.

### 6.5 KVED codes

- [BK-H] Typical set for SaaS under KVED-2010: 63.11 (data processing, hosting and related activities; the usual code
  for SaaS access), 62.01 (computer programming), 62.02 (IT consulting), 62.03 (computer facilities management),
  62.09 (other IT services), 58.29 (publishing of other software, for licence sales).
- [U] Ukraine has been moving to a new activity classifier aligned with NACE Rev. 2.1; whether the register already
  uses new codes in November 2026 was not checked.

### 6.6 PayPal, Payoneer, Wise

| Channel | Assessment |
|---|---|
| Direct SWIFT to the FOP bank account | [I] Cleanest: income date and amount are unambiguous. Recommended. |
| Payoneer | [F3] Widely used by Ukrainian FOPs; commonly described as compatible with group 3 when the account is used for business and funds are withdrawn to the FOP bank account. Sources conflict on the income date: one says the tax service counts income at the NBU rate on the date funds reach Payoneer, another advises withdrawing to the Ukrainian bank before the period ends. Sources: https://i.factor.ua/ukr/journals/nibu/2026/february/issue-13/article-136119.html (Feb 2026, accounting journal, not read in full) and https://murashko-accounting.com.ua/blog/payoneer-fop-opodatkuvannya/ . [BK-M] Fees to withdraw to a Ukrainian bank are around 1-2%. Use as a backup route only. |
| PayPal | [F3] Ukrainian accounts are personal and limited to person-to-person transfers; commercial receipts are not allowed. [I] Not a compliant channel for FOP income. |
| Wise | [BK-M] No business accounts for Ukraine-registered sole proprietors; a personal account is not a business channel. [U] Not checked today. Freemius lists Wise as a payout method [F], but whether that works for a Ukrainian recipient is unknown. |

### 6.7 VAT under current law

- [BK-H] Mandatory VAT registration applies when taxable supplies exceed 1,000,000 UAH in the last 12 months, but
  art. 181.1 excludes single-tax payers of groups 1-3. A group 3 FOP at 5% is therefore not obliged to register.
- [BK-H] The threshold counts supplies taxable in Ukraine (including zero-rated and exempt). Supplies whose place of
  supply is outside Ukraine are not an object of Ukrainian VAT and do not count.
- [BK-H] Place of supply (art. 186.3): for software supply, data processing and other IT services provided to a
  business customer, it is the place where the recipient is registered. Services to a non-resident MoR or to a
  foreign business are therefore outside Ukrainian VAT.
- [I] Under the MoR model the FOP's only customer is the foreign MoR, so Ukrainian VAT does not arise on sales.
- [BK-M] Cost side: foreign suppliers of electronic services (cloud, AI APIs, SaaS tools) charge 20% Ukrainian VAT to
  customers who are not VAT-registered. Budget for it.

### 6.8 Reform: mandatory VAT for simplified-system FOPs above 1M UAH from 2027 (partly verified)

Timeline from live sources (all third-party press and accounting publications):

| When | What | Source |
|---|---|---|
| Dec 2025 | Ministry of Finance published a draft law making simplified-system FOPs with income above 1M UAH mandatory VAT payers from 2027, as part of IMF-related commitments | https://zaxid.net/minfin_opublikuvav_skandalniy_zakonoproyekt_pro_obovyazkoviy_pdv_dlya_fopiv_n1626303 ; https://dev.ua/news/pdv-dlia-fopiv-nastupnoho-roku-1766054710 (2025-12-18) |
| Early 2026 | A second version of the draft was published | https://dou.ua/lenta/news/tax-bill-second-attempt/ |
| Mar 2026 | Reports that the 1M threshold was being abandoned in favour of 4M UAH from 2027-01-01 | https://thepage.ua/ua/news/pdv-dlya-fop-chi-stane-4-mln-grn-novim-porogom-oborotu ; https://i.factor.ua/ukr/news/pdv-dlya-fop-z-2027-novi-pravila-ta-porogi/ |
| Apr 2026 | The Prime Minister said the IMF did not insist on mandatory VAT registration for single-tax payers; the publication asks whether this is cancellation or postponement | https://i.factor.ua/ukr/news/ohrana-otmena-pdv-dla-fop-na-edinomu-podatku-ne-bude |
| Jul 2026 | A tax expert writes that, judging by the Budget Declaration for 2027-2029 approved by the government in June, there will be no changes to VAT registration of single-tax payers in 2027 | https://i.factor.ua/ukr/journals/nibu/2026/july/issue-53/article-138189.html |

- [F3] As of July 2026 the reform was **not enacted** and was not expected to apply in 2027.
- [U] **Status in November 2026: not verified.** No source dated after July 2026 was retrieved. Budget-season tax
  bills are often adopted in November-December, so this must be re-checked on the parliament site before year end.
- [I] Exposure if a version passes later: for a FOP whose income is exports of services to a non-resident MoR, sales
  stay outside Ukrainian VAT; the cost is administration (VAT returns, electronic administration account). Whether
  out-of-scope exports count toward a new threshold depends on the wording. Not a reason to change the payment setup.

### 6.9 Other 2026-2027 changes

- [U] Platform-income reporting (a DAC7-style law implementing the OECD exchange of information on digital-platform
  income): a bill was in parliament in late 2025 [BK-M]; whether it is enacted was not verified. [I] It targets
  platforms that intermediate goods, personal services and rentals. A reseller MoR that is itself the seller of a
  SaaS subscription is unlikely to be the intended case.
- [U] Any change to group 3 rates, limits or the military levy for 2027.

---

## 7. Question 6: recommendation

### 7.1 (a) Global B2B SaaS at $30-$300/month, monthly and annual plans

**Primary: Paddle Billing as merchant of record, payouts by SWIFT wire in USD to the monobank FOP USD account.**

Why:

- It is the only option where seller eligibility, sole-trader acceptance, payout method, minimum, schedule, fee and
  site requirements were each found on the provider's own pages [F].
- It removes EU VAT, UK VAT and US sales tax from the founder [BK-H for how MoR works].
- The FOP has one foreign counterparty, a bank-transfer income trail and a monthly document. That is the simplest
  possible picture for a group 3 FOP [I].
- Cost at $10k MRR is about $550/month in Paddle fees plus $15 per payout [I].

**Backup, in this order:**

1. **Freemius** as a second MoR. Open and verify an account in parallel and leave it dormant. Official docs name
   Ukraine for payouts [F]. Confirm fee, sole-proprietor acceptance and SaaS feature fit first [U].
2. **Payoneer as a second payout route** inside Paddle (and Freemius), in case a SWIFT route to the Ukrainian bank is
   interrupted [F for availability as a method; BK-M for Ukraine].
3. **Creem, 2Checkout/Verifone or PayPro Global** only after written confirmation that a Ukrainian sole proprietor is
   accepted and paid by bank transfer [U].
4. **Later option:** a foreign company (US LLC, Estonian OÜ or UK LTD) to unlock Stripe, when revenue justifies the
   overhead (section 3.3).

**Engineering note:** put billing behind a thin internal interface (create checkout, read subscription state, handle
webhook events, open portal). Switching MoR then costs days, not weeks [I].

### 7.2 (b) Customers that are Ukrainian businesses paying in UAH

- **Default for the first customers:** let them pay through the same Paddle checkout. Paddle accepts buyers in
  Ukraine outside the five regions [F]. One billing system, no extra integration [I]. Downsides: the invoice comes
  from a foreign company, pricing is in USD [U for UAH pricing], and Ukrainian VAT is likely added for buyers that are
  not VAT-registered [BK-M].
- **When a Ukrainian business asks for local paperwork:** issue an invoice and accept a bank transfer to the FOP's UAH
  IBAN, with an act of services and a public-offer contract on the site [BK-H as common practice]. No acquiring fee.
  Access is provisioned manually or by a small admin tool.
- **When Ukrainian card volume justifies it:** add plata by mono. 1.3% on Ukrainian cards [F]. Ask support to enable
  tokenization for recurring charges [F that it is gated]. Until enabled, send a payment link each period.
  LiqPay or WayForPay are the alternatives with long-standing recurring features [BK].
- Open questions before taking UAH card payments: fiscal-receipt (ПРРО) duty and gross-income treatment (accountant
  questions 9 and 1).

### 7.3 (c) Step-by-step plan

| Step | Action | Time | Cost | Label |
|---|---|---|---|---|
| 1 | Confirm the founder's registration and proof-of-address region is not Crimea, Donetsk, Kherson, Luhansk or Zaporizhzhia | minutes | 0 | [F] rule; [U] the founder's address |
| 2 | Check the FOP record: group 3 at 5%, KVED codes 63.11, 62.01, 62.02, 62.09, 58.29; add missing codes | about 1 day | 0 | [BK-M] |
| 3 | In monobank, open USD and EUR FOP accounts and copy the SWIFT details | minutes | 0 | [BK-M] |
| 4 | Create a Paddle **sandbox** account and start the integration | same day | 0 | [F] no approval needed |
| 5 | Register the domain and publish the site with the content listed in 7.3.2 | 2-5 days | domain fee | [F] requirements |
| 6 | Send the pre-check questions to Paddle support (7.4) describing the product | day 1 | 0 | [I] |
| 7 | Create the Paddle **live** account as individual / sole trader; pass identity verification (ID, proof of address, possibly liveness video via Sumsub); submit the domain | instant to 5-7 business days | 0 | [F] |
| 8 | Set payout method: wire, USD, FOP account; set threshold ($100 or higher) | minutes | $15 per payout | [F] |
| 9 | In parallel: open a Payoneer business account as backup route; apply to Freemius as backup MoR | 1-2 weeks | 0 | [BK-M] |
| 10 | Go live: one real purchase and refund; verify webhooks in production | 1 day | card fee | [I] |
| 11 | First payout: between the 1st and 15th of the next month; upload agreement and reverse invoice if the bank asks | next month | bank fees [U] | [F] schedule |
| 12 | Monthly routine: download reverse invoice and payout statement; record income at the NBU rate on the credit date; quarterly declaration and ESV | ongoing | 5% + 1% + ESV | [BK-H] |

[I] Realistic total from zero to first live charge: one to two weeks when the site is ready, dominated by site
preparation and a possible manual domain review.

#### 7.3.1 What can be tested in the sandbox before live approval

- [F] The sandbox requires no domain or identity approval.
- [BK-H] Testable: product and price catalogue (monthly and annual), overlay and inline checkout with test cards,
  trials, upgrades and downgrades with proration, pause/cancel, failed-payment states, webhooks, customer portal,
  tax-inclusive versus exclusive display, invoice documents, the Node SDK in a Next.js app.
- [I] Not testable: real issuer behaviour and 3-D Secure by country, the outcome of identity and domain review, the
  real payout to the Ukrainian bank, the bank's document requests. Plan one small live transaction and wait for one
  real payout before scaling marketing.

#### 7.3.2 What the site must contain to pass Paddle's domain review

All [F] from Paddle's help center and developer checklist:

- Live site on HTTPS.
- Clear description of the product and its key features.
- Pricing page or pricing details (a screenshot can be submitted if the page is not yet live).
- Terms and Conditions, Privacy Policy and Refund Policy, reachable from the site navigation.
- The seller's legal name in the Terms; for a sole proprietor, the personal legal name.
- A contact email reachable from the homepage.
- Every domain or subdomain that will open a checkout submitted for approval.

[I] Also sensible: a working demo or screenshots, and wording that makes the product read as software rather than a
service performed by a person.

### 7.4 (d) Questions to send

#### To Paddle support (before or during verification)

1. I am a sole proprietor ("FOP", individual entrepreneur) registered in [oblast, city], Ukraine. Can I open a Paddle
   Billing seller account as an individual / sole trader? Is my region supported?
2. Do you pay out by SWIFT wire in USD and in EUR to a Ukrainian bank account (JSC Universal Bank / monobank)? What
   are your fees, and are intermediary-bank fees deducted from the amount?
3. Must the payout beneficiary name match my personal name exactly? My bank account is titled as "FOP [Surname Name]".
4. Can my reverse invoices and payout statements show my entrepreneur status, tax number and registered address?
5. Please confirm the legal model: Paddle buys from me and resells to customers, and the reverse invoice documents my
   supply to Paddle at the payout amount. Which Paddle entity is my counterparty?
6. Product pre-check: [two-sentence description, including any AI-generated output, document generation, or data
   features]. Does it comply with the Acceptable Use Policy? What extra information will you need?
7. Can the domain be approved while the product is in private beta, if the site has the description, pricing and the
   three policies?
8. Is Payoneer available as a payout method for a Ukraine-based seller, and can I switch methods later?
9. For a new seller: is there a reserve or payout hold, and what are the chargeback and refund fees?
10. Can customers in Ukraine buy in UAH, and how is Ukrainian VAT handled on those sales?
11. Do you require any tax forms from a non-US sole trader?

#### To Freemius (backup)

1. Do you accept a Ukrainian sole proprietor as a seller of a SaaS product (not a WordPress plugin)?
2. Which payout methods work for a recipient in Ukraine today: bank wire in USD/EUR, Payoneer, Wise?
3. What is the current fee for SaaS, and are trials, proration, dunning, a customer portal and VAT-ID invoices
   supported?

#### To monobank support

1. Fees for incoming SWIFT in USD and EUR to a FOP account; which correspondent banks.
2. Which documents are requested for incoming payments from a foreign reseller, and from what amount.
3. For plata by mono: can tokenization and recurring charges be enabled for my FOP; which currencies can I charge and
   settle in; payout timing; chargeback rules.

#### To the accountant

1. Under Paddle's reseller agreement, is my single-tax income the payout received (reverse-invoice amount) or the
   gross customer payments? Which tax-service consultations support your answer?
2. Is there any risk that payments from a reseller are treated as royalties and taxed outside the single tax? How
   should the activity be described to avoid it?
3. Which KVED codes should be on my record for SaaS, and is the new classifier already in use?
4. Which documents do I keep: accepted agreement, reverse invoices, payout statements, bank statements? Translation
   or signatures needed?
5. Please confirm that export of services has no settlement deadline and tell me what the bank will ask for above
   400,000 UAH.
6. If I ever use Payoneer: on which date and in which amount is income recognised; must I report the foreign account?
7. Is there taxable income when I sell USD at a rate above the NBU rate?
8. Confirm that I am not obliged to register for VAT, that services to a non-resident are outside Ukrainian VAT, and
   the current status of the proposal to make FOPs above 1M (or 4M) UAH VAT payers from 2027.
9. For Ukrainian customers paying by card through internet acquiring: do I need a software cash register (ПРРО) and
   fiscal receipts? And for bank transfers on invoice?
10. Confirm 2026 numbers: 5% + 1%, ESV, income limit; and what changes for 2027.
11. If I later own a foreign company: CFC notification and reporting, place-of-management risk, tax on dividends,
    and whether my FOP can invoice that company.
12. Is the platform-income reporting law enacted, and does it touch income received through a reseller?

### 7.5 (e) Blockers and unknowns

**Blockers (would stop or reshape the plan)**

| # | Blocker | Status |
|---|---|---|
| B1 | Founder registered in Crimea, Donetsk, Kherson, Luhansk or Zaporizhzhia region: Paddle cannot onboard | [F] rule; founder's region [U] |
| B2 | Product category outside Paddle's AUP: marketplace, human services, regulated financial or legal advice, mass-marketing/telemarketing, deepfake-type AI | [F] |
| B3 | Data / lead-list products: not explicitly covered; assume high rejection risk until confirmed | [U] |
| B4 | No Stripe, no Stripe Managed Payments, no Polar, no Dodo, no usable Lemon Squeezy from Ukraine | [F] |
| B5 | Any marketplace whose payouts run only through Stripe Connect or PayPal | [I]; per-marketplace status mostly [U] |
| B6 | Single-provider dependency: Paddle may terminate when a product falls outside the AUP | [F] MSA |
| B7 | Recurring card charging at plata by mono is gated by support | [F] |
| B8 | Cash lag: monthly payouts, first money about 2-6 weeks after first sale; $100 minimum | [F] |

**Unknowns (need verification or an answer)**

1. No official sentence confirming Paddle wire payouts to Ukrainian banks; inferred only.
2. Whether Paddle excludes government-controlled parts of the five named regions.
3. Paddle's stance on data/lead-list products and on pre-launch or pre-order sales.
4. Paddle reserve/hold policy, chargeback fees, and whether Retain is included in the base fee.
5. Lemon Squeezy's real signup status (conflicting reports); not decision-relevant because payouts fail anyway.
6. Freemius: fee, sole-proprietor acceptance, SaaS features, sandbox.
7. Creem: meaning of the Ukraine footnote. 2Checkout, PayPro Global, FastSpring: Ukrainian seller eligibility and fees.
8. monobank: settlement currencies, payout timing, incoming SWIFT fees, whether a managed subscription API exists.
9. All other Ukrainian acquirers: not verified at all; Fondy/Hutko status in particular.
10. All marketplace payout rules except Freemius.
11. All 2026 tax numbers and currency rules: background knowledge only.
12. Status of the VAT reform after July 2026 and of the platform-income reporting law.
13. Whether stripe.com/global shows any preview label for Ukraine (page not opened; nothing suggests it does).
14. Current NBU exchange rate, used for USD equivalents.
15. Costs and current rules for the foreign-company routes.

---

## 8. Verification backlog for a follow-up run

Ordered by decision value. Each item needs a full page read, which this session could not do.

| Priority | Check | Where |
|---|---|---|
| 1 | VAT reform status after July 2026; any FOP-related tax law adopted in autumn 2026 | Search: "ПДВ для ФОП 2027 закон ухвалено листопад 2026"; parliament bill cards on rada.gov.ua; tax.gov.ua news |
| 2 | 2026 numbers: minimum wage, ESV, group 3 limit, military levy | tax.gov.ua; zakon.rada.gov.ua (Tax Code art. 291-293, State Budget 2026); buhgalter911, taxer.ua |
| 3 | Currency rules: services exempt from settlement deadlines, 400k UAH threshold, no mandatory sale | bank.gov.ua: NBU Regulation No. 5 and Resolution No. 18 |
| 4 | Paddle: full read of supported countries, payouts, fees, AUP, verification pages | URLs in section 9 |
| 5 | stripe.com/global full read | https://stripe.com/global |
| 6 | Freemius: pricing, SaaS docs, seller requirements | https://freemius.com/pricing/ ; https://freemius.com/freemius-for-saas/ |
| 7 | monobank acquiring docs: currencies, subscription endpoints, payout timing; FOP SWIFT tariffs | https://monobank.ua/api-docs/acquiring ; https://api.monobank.ua/docs/acquiring.html ; monobank FOP tariff page |
| 8 | Marketplace payout docs, each one | Atlassian threads in section 5; Shopify Partners "getting paid" help page; Microsoft Partner Center payout and supported-country pages; JetBrains Marketplace payout docs; monday, Wix, GoHighLevel, Zendesk, Zoom developer docs |
| 9 | WayForPay, LiqPay, Portmone, Hutko, Fondy: recurring, currencies, fees, licence status | Provider docs; NBU register of payment-service providers |
| 10 | Creem footnote; 2Checkout, PayPro Global, FastSpring eligibility | Provider docs and sales |
| 11 | Payoneer and Wise rules for Ukrainian FOPs; tax-service position on income date | payoneer.com/uk; the i.factor.ua article in section 6.6; tax.gov.ua knowledge base |
| 12 | Platform-income reporting law status | rada.gov.ua; dtkt.ua, ligazakon.net |

---

## 9. Sources

All accessed 2026-11-13 through search-engine excerpts. "Read" means only the excerpt was seen, never the whole page.

### Official provider pages

| URL | Supports |
|---|---|
| https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle | Paddle seller countries; five excluded Ukrainian regions |
| https://www.paddle.com/help/legal/sanctions/impact-of-sanctions-on-russia-and-belarus | Sellers from sanctioned regions cannot sign up; buyers in the rest of Ukraine can purchase (older page) |
| https://www.paddle.com/blog/message-on-ukraine-conflict | 2022: Paddle had sellers in Ukraine and adjusted their payouts |
| https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid | Monthly payout, 1st to 15th, $100 threshold, wire or Payoneer |
| https://www.paddle.com/help/manage/get-paid/is-there-a-fee-taken-for-payouts | $15 SWIFT fee, up to 1.5% conversion margin |
| https://www.paddle.com/pricing | 5% + $0.50 |
| https://www.paddle.com/help/start/account-verification | Three verification steps; business verification not required for sole traders; timings |
| https://www.paddle.com/help/start/account-verification/what-is-identity-verification | ID and proof of address via Sumsub |
| https://www.paddle.com/help/start/account-verification/what-is-domain-verification | Site requirements; pricing screenshot; rejection reasons |
| https://developer.paddle.com/build/onboarding/set-up-checklist | Policies and contact email; sandbox |
| https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle | Acceptable Use Policy categories |
| https://www.paddle.com/legal/terms | MSA: KYC duty (9.1), termination for AUP |
| https://developer.paddle.com/get-started/ai/lovable/ | Paddle's official integration with an AI app builder |
| https://support.stripe.com/questions/sanctions-on-russia-and-belarus | Stripe does not support users located in Ukraine |
| https://docs.stripe.com/payments/managed-payments/eligibility | Managed Payments supported locations (35, no Ukraine) |
| https://docs.stripe.com/payments/managed-payments ; https://stripe.com/managed-payments | What Managed Payments is; 3.5% fee |
| https://docs.stripe.com/changelog/dahlia/2026-04-22/managed-payments | General availability date |
| https://docs.stripe.com/connect/cross-border-payouts | Limits of cross-border payouts |
| https://docs.stripe.com/tax/supported-countries/europe/ukraine | Stripe Tax collects Ukrainian VAT for foreign sellers |
| https://www.lemonsqueezy.com/blog/2026-update | Lemon Squeezy direction: Stripe Managed Payments (2026-01-28) |
| https://docs.lemonsqueezy.com/help/getting-started/supported-countries | Bank payout countries (no Ukraine); PayPal 200+ |
| https://twitter.com/lmsqueezy/status/1738152348906672133 | Company reply: bank payouts not available for Ukraine, PayPal is (Dec 2023) |
| https://polar.sh/docs/merchant-of-record/supported-countries | Payouts via Stripe Connect Express; country list |
| https://x.com/polar_sh/status/1915379610809782428 | Polar can support only listed countries |
| https://docs.creem.io/merchant-of-record/supported-countries ; https://docs.creem.io/guides/faq | Ukraine listed with footnote; payout methods |
| https://docs.dodopayments.com/miscellaneous/accepted-countries-and-territories | Ukraine grandfathered only |
| https://freemius.com/help/documentation/selling-with-freemius/supported-countries/ | "Ukraine (non-sanctioned regions)"; payout methods |
| https://freemius.com/help/documentation/selling-with-freemius/your-earnings/ | Payout on the 10th; $100 minimum |
| https://developer.fastspring.com/docs/set-up-your-payout-account | FastSpring payout methods |
| https://payproglobal.com/faq/ ; https://developers.payproglobal.com/docs/platform-overview/withdrawal-options/ | PayPro payout fees and schedule |
| https://verifone.cloud/docs/2checkout/Onboarding/Payouts | 2Checkout payouts (partly excerpted) |
| https://monobank.ua/plata-by-mono ; https://monobank.ua/en/knowledge-base/acquiring/index | plata by mono fees and onboarding |
| https://monobank.ua/en/api-docs/acquiring/extras/tokens/post--api--merchant--invoice--create ; https://api.monobank.ua/docs/acquiring.html | Tokenization fields; gated access |

### Third-party pages

| URL | Supports | Caveat |
|---|---|---|
| https://westernbid.com/en/?p=23497 | No Stripe launch in Ukraine in 2026 | Sells an alternative service |
| https://dev.ua/en/news/nbu-zaiavyv-shcho-stripe-i-paypal-zhodnoho-razu-ne-prosyly-litsenziiu-dlia-roboty-v-ukraini-1764321864 | NBU: Stripe and PayPal never applied for a licence (2025-11-28) | Headline only |
| https://agentaos.ai/dodo-payments-alternative | Dodo stopped onboarding Ukrainian sellers on 2026-03-23 | Competitor comparison |
| https://dodopayments.com/blogs/lemonsqueezy-review ; https://resources.rework.com/tools/billing-revenue/paddle-vs-lemon-squeezy | Lemon Squeezy status in 2026 | Conflicting; one is a competitor |
| https://freemius.com/blog/stripe-merchant-of-record/ | Managed Payments limited to hosted flows | Competitor |
| https://www.paypal-community.com/t5/Transactions/account-from-Ukraine-receiving-payments/m-p/3162489 | Ukrainian PayPal accounts cannot receive commercial payments | Forum |
| https://support.ecwid.com/hc/en-us/articles/360003067820-Payment-options-for-Ukraine | 2Checkout usable by merchants in Ukraine | Integration guide |
| https://www.jotform.com/2checkout/faq/ | 2Checkout payout accounts | Integration FAQ |
| https://pkg.go.dev/github.com/stremovskyy/go-monobank ; https://pkg.go.dev/github.com/OlexiyOdarchuk/go-monobank-sdk/v2/acquiring | monobank wallet and subscription flow | Unofficial SDKs |
| https://community.developer.atlassian.com/t/payouts-to-ukraine-bank-account-for-individual-developer-sole-proprietor-supported/102880 ; https://community.developer.atlassian.com/t/marketplace-payouts-for-a-partner-based-in-ukraine-sole-proprietor/103157 | Atlassian payouts to Ukrainian sole proprietors discussed | Not read |
| https://i.factor.ua/ukr/journals/nibu/2026/february/issue-13/article-136119.html ; https://murashko-accounting.com.ua/blog/payoneer-fop-opodatkuvannya/ | Payoneer for group 3 FOPs | Conflicting on income date |
| https://zaxid.net/minfin_opublikuvav_skandalniy_zakonoproyekt_pro_obovyazkoviy_pdv_dlya_fopiv_n1626303 ; https://dev.ua/news/pdv-dlia-fopiv-nastupnoho-roku-1766054710 ; https://dou.ua/lenta/news/tax-bill-second-attempt/ | VAT-for-FOP drafts, Dec 2025 to early 2026 | Press |
| https://thepage.ua/ua/news/pdv-dlya-fop-chi-stane-4-mln-grn-novim-porogom-oborotu ; https://i.factor.ua/ukr/news/pdv-dlya-fop-z-2027-novi-pravila-ta-porogi/ | 4M UAH threshold discussed, March 2026 | Press |
| https://i.factor.ua/ukr/news/ohrana-otmena-pdv-dla-fop-na-edinomu-podatku-ne-bude | PM: IMF did not insist, April 2026 | Accounting publication |
| https://i.factor.ua/ukr/journals/nibu/2026/july/issue-53/article-138189.html | No VAT-registration change expected for 2027, July 2026 | Expert opinion |

Dating note: the dates given for the two dev.ua items and for the X/Twitter posts were derived from timestamps
embedded in their URLs or post IDs, not read from the pages.

### Not sourced at all

Sections 3.3, 4.2, most of 5 and most of 6 rest on background knowledge. They carry [BK] labels and appear in the
verification backlog.

### Access problems to fix before a follow-up run

- Page fetching failed for www.paddle.com, stripe.com, www.lemonsqueezy.com and docs.lemonsqueezy.com: these hosts
  (and in practice the other provider, government and accounting sites) have to be allowed in the session's network
  settings before full pages can be read.
- The web-search budget for the turn was exhausted after 37 lookups. A follow-up message, or a higher search limit,
  is needed to finish parts 3-5.
