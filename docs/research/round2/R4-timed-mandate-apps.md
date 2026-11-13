# R4 — "Timed mandate" apps: is being early in an app store before a legal deadline a repeatable route to $10k MRR?

Research date: **2026-11-13**. Decision context: solo founder, Ukraine-based sole proprietor (monobank business account, no Stripe), product built by an AI coding agent in ~1 day and iterated, target USD 10,000 MRR within 12 months.

Evidence labels: **FACT** = read today on the primary page named (URL in the source list, section 7). **FACT-3P** = read today on a third-party data page (e.g. Store Leads crawler); the number is that vendor's estimate, not an official one. **INFERENCE** = my reasoning. **ASSUMPTION** = unverified premise used in a calculation. **UNKNOWN** = could not verify.

Limits of this run: 23 of the 35 allowed web searches were used; everything else was fetched directly from primary pages. EUR-Lex returned a bot challenge and the EU Publications Office returned HTTP 500 today, so EU dates are verified on European Commission pages or, where marked, taken from secondary sources. Shopify publishes no install counts; install figures come from Store Leads' public crawler pages and are labelled FACT-3P.

## 0. Bottom line

1. **The hypothesis is half right.** Timing and search rank decided the withdrawal-button race, and the platform's own answer came one day before the deadline. But the effect needed two more conditions that the hypothesis does not name: the mandate must require a **function with a back office** (form, e-mail, log), not a static notice, and the jurisdiction must have **credible private enforcement** (German warning letters). The next mandate of the same family — the EU guarantee notice, three months later, same merchants — produced 2–3% of the reviews.
2. **Even the winner plausibly earns around $10k MRR, not a multiple of it.** 2,325 reviews do not mean 100,000 installs: 58% of sampled reviews were written within minutes of install, and Store Leads detects the app on 3,715 stores. My central estimate for the winner is ~700 paying merchants and ~$8,500 MRR (range $1,700–$40,000).
3. **No opportunity available today meets all six criteria and plausibly reaches $10k MRR in 12 months.** I checked 36 rules and platform deadlines. The 2027 EU calendar contains no storefront function that hits all merchants. Every trigger with a date is already squatted on Shopify by zero-review apps — except one.
4. **The one empty shelf: India's Consumer Protection (E-Commerce) (Amendment) Rules, 2026**, in force 1 January 2027 (official gazette text read today). 130,450 Shopify stores are in India (Store Leads), more than in Germany. The rules require a displayed dark-pattern self-audit certificate, a "prior price" (30-day lowest) next to every announced price cut, grievance-officer details with a 48-hour acknowledgement duty, and GST/MSME numbers. One single-feature, zero-review app exists. It formally passes criteria (a)–(f), but price points in India ($5) and regulator-only enforcement put a realistic month-12 result at **about $150–$3,600 MRR (central ≈ $750)**, not $10k.
5. **Second: UK (1 Jan 2027) and Australia (1 Jul 2027) subscription rules.** Firm dates, but only ~17,000 UK and ~10,500 Australian Shopify stores run a subscription app, the subscription apps own the data (Shopify's API lets an app read only its own subscription contracts), and two zero-review apps are already listed.
6. **Getting paid from Ukraine through Shopify is plausible but not confirmed for 2026.** Shopify pays through Hyperwallet to PayPal or a real bank account; its only statement naming Ukraine is from November 2021; the actual rails are visible only inside the partner dashboard. New since 10 November 2026: identity verification (through Stripe's ID check) is mandatory before submitting a new app, only one new app may be in review at a time, and a second app needs 10 paid installs on the first.

---

## 1. Anatomy of the winners (question 1)

### 1.1 EU withdrawal button (Directive (EU) 2023/2673, applies 19 June 2026)

**Shopify App Store, search "widerrufsbutton": 92 apps (FACT, apps.shopify.com search, 2026-11-13).** Leaders, with launch date and plans from each listing page:

| App (developer, country) | Launched | Lead time before 19 Jun 2026 | Reviews / rating | Plans | Built for Shopify badge | Listing languages |
|---|---|---|---|---|---|---|
| EW: EU Withdrawal Button & Form (401layers UG, Hilden, DE) | 2026-01-09 | 161 days | 2,325 / 4.9 | Free; $9.99; $29.99 | yes | DE, EN, ES, NL, FR |
| Revoq – EU Withdrawal Button (BuschBytes) | 2026-03-11 | 100 days | 583 / 4.8 | Free; $9; $25 | yes | 11 languages |
| Anviara EU Withdrawal Button (Anviara LLC) | 2026-05-06 | 44 days | 108 / 4.8 | Free; $7.99 | yes | 24 languages |
| EU Withdrawal Button Free (Nayvo, IN) | 2026-06-03 | 16 days | 74 / 4.8 | Free; $7.99; $22 | no | 13 languages |
| EU Widerrufsbutton Pro (Visionz GmbH) | 2026-05-12 | 38 days | 51 / 5.0 | Free; $5.99; $24.99 | yes | DE only |
| Avada EU Withdrawal Button (Avada, SG — large multi-app publisher) | 2026-06-12 | 7 days | 36 / 5.0 | Free | yes | 6 languages |
| Händlerbund Widerrufs-Button (Händlerbund Legal Tech GmbH — a large German e-commerce trade association and legal-text provider) | 2026-05-13 | 37 days | 5 / 4.0 | Free | no | DE |
| Existing apps that added the feature: easyReturns (2021) 87 / 4.4; Complimus Omnibus & Withdrawal (2022) 75 / 5.0 | — | — | — | $14.99–59 | — | — |
| Tail: ~80 apps | May–Nov 2026 | ≤ 40 days or after | 0–18 | mostly Free + $5–20 | — | — |

**When the reviews actually arrived (FACT — my sampling of the leader's review pages sorted by date, 22 of 233 pages, 2026-11-13):**

| Date | Cumulative reviews of EW (approx.) | Comment |
|---|---|---|
| 2026-01-09 | 0 | launch |
| 2026-02-05 | ~4 | first reviews 26 Jan – 5 Feb |
| 2026-04-17 | ~35 | 3 months live, 2 months before deadline |
| 2026-05-12 | ~85 | |
| 2026-05-20 | ~135 | |
| 2026-05-31 | ~235 | |
| 2026-06-05 | ~335 | |
| 2026-06-12 | ~535 | |
| 2026-06-14 | ~735 | |
| 2026-06-16 | ~935 | |
| 2026-06-17 | ~1,135 | |
| 2026-06-18 | ~1,335–1,535 | ~300–400 reviews in one day |
| 2026-06-19 | ~1,735 | deadline day |
| 2026-06-20 | ~1,935 | |
| 2026-06-23 | ~2,135 | |
| 2026-06-29 | ~2,175 | |
| 2026-08-12 | ~2,255 | |
| 2026-11-12 | 2,325 | ~10 reviews per 15 days now |

- **About 69% of the leader's reviews arrived in the 12 days from 12 to 23 June, and about 86% in the five weeks from 20 May to 23 June** (INFERENCE from the table). The first 19 weeks after launch produced ~135 reviews (6%); the 20 weeks since 23 June produced ~190 (8%). Being early did **not** produce early revenue; it produced the #1 search position, the Built for Shopify badge and a review base *before the wave*, and the wave then went to whoever was ranked first.
- The second app (Revoq) shows the same shape: launched 11 March, ~40 reviews by 6 May, ~90 by 11 June, ~290 by 18 June, ~390 by 23 June, 583 today (FACT, 10 of 59 review pages sampled).
- **The demand is German** (FACT): of 210 sampled EW reviews, 153 are from Germany (73%), 15 Austria, 9 France, 6 Netherlands. Store Leads' crawler puts 79.5% of detected EW installs in Germany and 5.2% in Austria (FACT-3P). INFERENCE: the driver is Germany's private-enforcement culture (competitor/association warning letters, "Abmahnung"; the listing and reviews cite § 356a BGB), not the EU-wide rule as such. The same rule in France, Spain or Italy produced far less visible demand for the leader.
- **Reviews were harvested at onboarding** (FACT): 125 of 214 sampled EW reviews (58%) were written after "N minutes using the app", another 36 within hours. For Anviara the share is 17 of 48. Review counts therefore overstate scale compared with ordinary apps, where reviews come after weeks of use (two honest developers in report D got ~100 reviews in three years).

**What the winner did differently (FACT from listing unless marked):**
1. **Launched 161 days early** and was alone in the search results for months. No other dedicated app existed before 11 March.
2. **German keyword in the URL handle** (`eu-widerrufsbutton`) and "EU 2023/2673" in the title; the listing leads with "without login requirement", the exact legal pain point (guest orders).
3. **A free plan that fully satisfies the law** (button, form, unlimited withdrawals, confirmation e-mail, all EU languages). Paid tiers sell paperwork and comfort: data-processing agreement, custom e-mail templates, own branding ($9.99); Shopify Returns sync, adjustable periods, hide from non-EU visitors ($29.99).
4. **Built for Shopify badge**, theme-editor integration, "All 24 EU languages".
5. German company (UG) with a German address on the listing — a trust signal for a legal product in Germany (INFERENCE).
6. No legal-partnership badge is visible on the listing (FACT). The trade association Händlerbund launched its own free app five weeks before the deadline and got 5 reviews — **brand and legal authority did not beat timing and ranking**.

**Did a late entrant break through?** Partly, and it matters:
- By reviews, no: every app launched ≤ 45 days before the deadline has ≤ 108 reviews, and the ~80-app tail has 0–18.
- By installs, the **second mover may be bigger than the first**: Store Leads detects Revoq on **15,792** stores (Italy 18.7%, Germany 13.6%, US 9.9%, Netherlands 9.5%) against **3,715** for EW (FACT-3P, report pages updated 2026-11-06). Detection depends on each app's storefront footprint, so the two numbers are not strictly comparable (ASSUMPTION: EW is under-detected to an unknown degree). INFERENCE: Revoq won the non-German, multi-language long tail (11 listing languages) with far fewer review prompts; EW won Germany and the review count.
- A multi-app publisher with existing distribution (Avada) entering 7 days before the deadline with a fully free app got 36 reviews.

**How many paying merchants might 2,325 reviews imply?** There is no public install or revenue figure (UNKNOWN). Method and ranges:

| Step | Low | Central | High | Basis |
|---|---|---|---|---|
| Current installs of EW | 3,715 | ~9,000 | ~20,000 | Low = Store Leads detection (FACT-3P). High = 2,325 reviews ÷ ~12% review rate. ASSUMPTION: review rate 12–60% because reviews are prompted at onboarding; for ordinary apps 1–3% would apply and would give an implausible 80,000–230,000 installs, more than all German Shopify stores (104,744 per Store Leads, FACT-3P) |
| Share on a paid plan | 4% | 8% | 15% | ASSUMPTION — the free plan is legally sufficient; reviews repeatedly praise the free plan (Shopify's review summary on the listing: "Many small shops value the free plan for basic compliance") |
| Paying merchants | ~150 | ~700 | ~3,000 | product of the rows |
| Average price | $11 | $12 | $14 | most payers on $9.99, a minority on $29.99 (ASSUMPTION) |
| **MRR of the single best-case winner** | **~$1,700** | **~$8,500** | **~$40,000** | wide; central estimate is *below* the $10k target |

Retention note (FACT-3P): Store Leads shows EW installs +2.9% and Revoq +2.2% quarter over quarter — a legally required, always-visible element is not uninstalled after the deadline. The revenue, once won, appears durable.

**Platform response (FACT, Shopify merchant changelog):** Shopify shipped native "Self-serve returns now support cancellations", explicitly "to support the EU right to withdraw regulation", on **18 June 2026 — one day before the deadline**, filed under "Customer accounts" (INFERENCE: it presupposes the customer-account flow, which the dedicated apps avoid with their "no login" forms), and added it to Managed Markets on 16 July 2026. INFERENCE: Shopify does respond to EU consumer-law mandates, but late and only partially; a third-party app has roughly the last 5 months before a deadline to itself.

**WooCommerce / WordPress.org (FACT, plugin API today; see also report D/E):** leader is the plugin from vendidero, the makers of Germanized (6,000+ active installs, added 2026-03-26), then Fernando Tellado's (2,000+, a well-known Spanish WordPress author), WebToffee (1,000+). All free. About 75 dedicated plugins, 33 with fewer than 10 installs. **Winners = vendors with existing distribution; no paid newcomer.**

**Wix (FACT, report D):** 15 apps for "withdrawal", the two best have 4 reviews each. No market.

### 1.2 EU harmonised legal-guarantee notice and durability label (Directive (EU) 2024/825, applies 27 Sept 2026; design fixed by Implementing Regulation (EU) 2025/1960)

Shopify, searches "gewährleistungslabel" / "garantielabel" / "legal guarantee" (FACT, 2026-11-13). About 15 dedicated apps:

| App (developer) | Launched | Lead time before 27 Sep 2026 | Reviews / rating | Plans | Store Leads detected installs (FACT-3P) |
|---|---|---|---|---|---|
| EU Warranty & GARAN Label (Münster/Rau/Schoolmann GbR, DE) | 2026-08-05 | 53 days | 50 / 5.0 | Free; $4.99 | 553 (83% Germany) |
| Consentico EU Warranty & GARAN | 2026-08-26 | 32 days | 49 / 5.0 | Free; $4.99; $9.99; $24.99 | not shown |
| EU Warranty Label & GARAN (TG-AI Apps, DE) | 2026-06-24 | 95 days | 37 / 4.5 | Free; $4.99; $9.99; $19.99 | 1 |
| EU Warranty Label GARAN (Appsentials, DE) | 2026-07-22 | 67 days | 17 / 5.0 | Free; $6.99; $19.99 | not shown |
| Pandectes EU Warranty & GARAN (Pandectes — its cookie app has 3,116 reviews) | 2026-09-18 | 9 days | 14 / 5.0 | Free; $9 | not shown |
| EU GARAN Legal Guarantee (Sevns Webdesign) | 2026-07-07 | 82 days | 14 / 4.8 | Free; $4.90 | — |
| GARAN & EU Legal Guarantee (Selluxe, NL) | 2026-10-14 | after | 12 / 5.0 | Free; $2.99 | — |
| Complimus Omnibus & Withdrawal (2022 app that added the label) | 2022-09-12 | — | 75 / 5.0 | Free; $14.99; $99.99 | 685 (41% Poland) |

WordPress.org (FACT, plugin API): the best dedicated guarantee-notice plugins have 200+, 100+ and 50+ active installs; the largest carrier of the feature is a withdrawal plugin that added it (2,000+).

**Reading (INFERENCE):** the guarantee notice is the closest possible twin of the withdrawal button — same directive family, same affected population (every EU B2C goods seller), three months later, also storefront-visible — and it produced roughly **2–3% of the withdrawal button's reviews** (best app 50 vs 2,325) and perhaps 5–15% of its installs. The natural experiment did **not** repeat. Likely reasons, in my order of weight:
1. **No function, only a picture.** The notice is a static, standardised graphic and text. A merchant can paste it into the theme without an app; the withdrawal button needs a form, e-mail confirmation and record-keeping. An app's value is the workflow, not the display.
2. **Nobody was 5 months early.** The first app appeared 95 days before the date and the eventual leaders 30–55 days before; the winner of the first wave (401layers) did not ship a guarantee app. No one held the ranking position when the (smaller) wave came.
3. **Compliance fatigue and weaker warning-letter pressure** three months after the withdrawal scramble (ASSUMPTION — not verified).
4. **Supply was instant**: 15 apps before the deadline, most with free tiers at $2.99–4.99 — prices already one-half of the withdrawal apps'.

### 1.3 What the two cases say about the hypothesis

- **Confirmed:** rank #1 before the wave matters far more than brand; the wave is extremely concentrated (two weeks); the platform's native answer arrives at the deadline or later; installs persist afterwards.
- **Not confirmed:** "storefront-visible + mandatory + many merchants" is not sufficient. The mandate must require a *function with a back-office* (form, e-mail, log), and the jurisdiction must have *credible private enforcement* (Germany). Remove either and demand drops by 1–2 orders of magnitude.
- **Uncomfortable arithmetic:** even the one clear winner of the best case in years plausibly earns in the region of $2k–$40k MRR with a central estimate under $10k; the #3 app (108 reviews) is plausibly at a few hundred dollars.


---

## 2. Pipeline of obligations, December 2026 – December 2027, plus recent ones (question 2)

How to read the tables. "Date/status" carries the evidence label: **[F]** primary page read today, **[F-E]** primary page read today by report E (round 1), **[S]** secondary source read today (law firm, trade association, legal publisher) — treat as unverified against the legal text, **[B]** my background knowledge, not verified. "Apps today" = my searches on apps.shopify.com, the Wix App Market and the WordPress.org plugin API on 2026-11-13; "0-rev" means zero reviews. Shopify store counts per country are Store Leads figures (FACT-3P): US 1,269,853; UK 244,832; Canada 149,947; Australia 142,651; India 130,450; France 116,064; Germany 104,744; Spain 70,349; Netherlands 68,353; Italy 61,467.

### 2.1 European Union and Germany

| # | Rule | What a merchant must change | Who / how many | Date and status | Solved natively? | Apps today (Shopify unless stated) | Reading |
|---|---|---|---|---|---|---|---|
| 1 | Withdrawal function, Dir. (EU) 2023/2673 | Permanent "withdraw from contract" function, form, confirmation on a durable medium | Every online B2C seller to EU consumers; ≥ 420,000 Shopify stores in the five largest EU countries alone | Applied 19 Jun 2026 [F, Commission] | Partly, late: Shopify self-serve cancellations 18 Jun 2026 [F] | 92; leaders 2,325 / 583 / 108. Wix 16 (best 4). WordPress ~75 dedicated (leader 6,000+ installs) | Won. Detected installs of the two leaders (3,715 + 15,792) are < 5% of EU-5 stores, so penetration is low, but the ranking is locked |
| 2 | Legal-guarantee notice and durability label, Dir. (EU) 2024/825 | Show the harmonised notice "in a prominent manner"; label where a durability guarantee exists | Every EU B2C goods seller | Applied 27 Sep 2026 [F, Commission] | No | ~15; best 50 / 49 / 37. Wix 3 (0–1 reviews). WordPress best 200+ installs | Weak: a static graphic |
| 3 | Bans on generic environmental claims and uncertified sustainability labels (same directive; German UWG amendment) | Remove or substantiate "eco-friendly", "climate neutral" etc. | Any store making such claims | 27 Sep 2026 [F for the directive date; German details S] | No | 5 checkers; best 5 reviews. A German developer's scanner at $19.99–49.99, launched 20 Jul 2026, has 1 review. WordPress 2 checkers, 0 installs | Demand not visible 7 weeks after the date, despite real warning-letter risk in Germany |
| 4 | Right to repair, Dir. (EU) 2024/1799 | Information on repair options; one-year guarantee extension after repair | Sellers of repairable goods | 31 Jul 2026 [B; listed among 2026 changes by Händlerbund, S] | — | "RepairProof EU" 0-rev | Text in terms and conditions, no function |
| 5 | Consumer Credit Directive 2 (BNPL, instalments) | Warnings and standard information where credit is advertised; stricter credit checks | Stores advertising instalment / pay-later offers | 20 Nov 2026 [S, Händlerbund 28 Sep 2026] | Yes — payment providers' own widgets and checkout flows (INFERENCE; Händlerbund's to-do is "coordinate with your payment provider") | None found for "consumer credit" / "BNPL notice" | Provider-solved |
| 6 | Product Liability Directive (EU) 2024/2853 | None on the storefront; supply-chain documentation | All shops | 9 Dec 2026 [S] | — | — | Not app-shaped |
| 7 | Deforestation Regulation (EUDR) | Importers: due-diligence statements; downstream traders: keep supplier data and reference numbers 5 years | Sellers of wood, cocoa, coffee, rubber, leather goods | 30 Dec 2026 large/medium; 30 Jun 2027 micro/small [F-E]; twice postponed | Official EU information system for filings | 5+, all 0-rev. WordPress 1, 0 installs | Record-keeping; delay history; no demand |
| 8 | Germany, B2B e-invoices (UStG § 27(38)) | Issue XRechnung / ZUGFeRD for domestic B2B invoices | Only B2B sellers with prior-year turnover > €800,000 from 2027; all from 2028. B2C invoices and invoices ≤ €250 exempt [S] | 1 Jan 2027 / 1 Jan 2028 [F-E] | No | "zugferd" 48 results: invoice incumbents list it (Vify 1,218 reviews, Avada 714, Sufio 472, Oxilayer 185); dedicated newcomers 0–2 reviews. WordPress: 9 dedicated, all 0 installs | Incumbents with distribution already carry the feature |
| 9 | France, B2B e-invoicing | Issue through a state-registered platform | SMEs issue from 1 Sep 2027 [S / B] | Rolling since 1 Sep 2026 [F-E] | — | — | Registration barrier (report E) |
| 10 | Batteries Regulation: battery passport; user-replaceable batteries | QR-linked passport per LMT / industrial / EV battery; removability information | E-bike, scooter and industrial battery sellers only | 18 Feb 2027; no postponement found [S]; original text [F-E] | No | 2 apps (0 and 2 reviews). WordPress 3, 0 installs | Small N; long-lived hosting duty |
| 11 | Textile and footwear producer responsibility, Dir. (EU) 2025/1892 | Registration and fees; no storefront element yet | Fashion sellers | Transposition by 17 Jun 2027 [S] | — | — | National law still to come |
| 12 | Cyber Resilience Act | Show end of support period (month, year) at purchase for connected products [S]; distributor checks | Sellers of connected devices and software | 11 Dec 2027 [F-E] | No | None found | Product-data field; edge of window |
| 13 | Forced Labour Regulation | None on the storefront | All shops | 14 Dec 2027 [S] | — | — | Not app-shaped |
| 14 | AI Act Art. 50 transparency | Disclose AI chat; label certain AI-generated media | Stores using AI chat or synthetic imagery | Aug 2026 [F-E] | Chat vendors disclose in their widgets (INFERENCE) | 4+ apps, best 1 review (report D); "AI Disclosure" apps 0-rev | No visible demand |
| 15 | Packaging Regulation (PPWR) and national producer registers | Registration, authorised representative per Member State | Cross-border EU sellers | 12 Aug 2026 [F-E] | — | 7+ report tools, 0–4 reviews | A service business, not a widget |
| 16 | €3 customs duty on low-value parcels | Non-EU sellers: price duty in, or collect at checkout | Non-EU stores shipping to EU consumers | 1 Jul 2026 [S]; sources conflict on whether the carrier or the seller's IOSS scheme collects | Shopify Markets / Managed Markets handle duties (B) | Duty and tax incumbents: Zonos 159 @ 4.4, EAS 78 @ 4.0 | Tax engine, not a 1–3 day build |
| 17 | Digital Fairness Act | Dark patterns, subscriptions, influencer marketing | — | Proposal scheduled 11 Nov 2026; not in force before end-2028 [S] | — | — | Outside the window. Watch: an EU-wide cancellation button would be the next "function" mandate |
| 18 | European Accessibility Act | Accessible shop and checkout; statement | Non-micro sellers | Since 28 Jun 2025 [B] | Themes | 159 apps in category (report D); statement generator 1 review | Window passed |

A German deadline calendar for October 2026 – December 2027 published by an agency on 13 October 2026, built on EUR-Lex and the Händlerbund overview of 24 September 2026, lists rows 6–8, 10–13 plus the Data Act cloud-switching rule and pay-transparency reporting, and **no consumer-facing storefront function for 2027** [S]. I found none either.

### 2.2 United Kingdom, Australia, United States, Canada

| # | Rule | What a merchant must change | Who / how many | Date and status | Solved natively? | Apps today | Reading |
|---|---|---|---|---|---|---|---|
| 19 | UK DMCC Act subscription regime; draft Consumer Subscription Contracts (Cancellation and Information) Regulations 2026 | Key pre-contract information, reminder notices, easy online exit, 14-day cooling-off after trial or long renewal | Any trader with UK consumer subscriptions, including "subscribe and save". UK Shopify stores with a subscription app: Recharge 5,008, Seal 3,751, Appstle 3,636, Shopify Subscriptions 2,051, Kaching 1,880, Loop 497, Subi 228 = **~17,000** before overlap (FACT-3P) | **1 Jan 2027** [F: draft regulations on legislation.gov.uk say "come into force on 1st January 2027"; gov.uk press release 9 Aug 2026]. Applies to contracts entered into from that date [S]. Still a draft awaiting approval | By the subscription apps (INFERENCE; no vendor statement found). Shopify's API gives an app access only to subscription contracts "that belong to your app" [F] — a third-party tool cannot send reminders or cancel for another app | Shopify: SubGuard (launched 27 Oct 2026, $0/9/19, 0-rev), Upfront – DMCC Compliance (1 Sep 2026, $9.99, 0-rev), Subnotice [S]. WordPress: 1 plugin, 0 installs | Firm date, but small N, squatted, and the incumbents hold the data |
| 20 | UK misleading "was" prices; fake reviews and drip pricing | Honest reference prices; all-in prices | All UK retailers | Fake reviews / drip pricing in force since Apr 2025 [S]; "was"-price ban: consultation "this autumn" [F, gov.uk 9 Aug 2026] — **no date** | No | Upfront (0-rev) | Watch item for 2027–28; would be a price-history function for 244,832 UK stores |
| 21 | UK marketplace VAT (Oct 2027), low-value import duty (to 2028) | Marketplace- and customs-side | — | [S] | — | — | Not app-shaped |
| 22 | Australia, Competition and Consumer Amendment (Unfair Trading Practices) Act 2026 | Subscriptions: pre-contract disclosure, reminders (by regulation), easy online cancellation. Drip pricing: show mandatory per-transaction fees with the base price. General ban on unfair practices | All 142,651 Australian stores for the general ban; subscriptions: Recharge 3,317, Appstle 2,546, Seal 1,873, Kaching 1,316, Shopify Subscriptions 982, Loop 304, Subi 165 = **~10,500** (FACT-3P) | Royal Assent 6 Jul 2026, commences **1 Jul 2027** [S, several law firms; content confirmed in the Parliamentary Library Bills Digest, F] | Same as row 19 | None found ("unfair trading", "drip pricing") | Lead time fits the hypothesis (launch Jan–Mar 2027), but same structural problem as row 19 |
| 23 | US FTC negative-option ("click-to-cancel") rule | — | — | Vacated July 2025; new advance notice of proposed rulemaking 11 Mar 2026; no proposed rule found [S] | — | — | No federal date in the window |
| 24 | US state auto-renewal laws | Disclosures, reminders, cancellation channel | US stores with a subscription app: ~78,000 before overlap (FACT-3P sum of five apps) | Louisiana 1 Jan 2027; New York City 1 Oct 2026; Connecticut and Virginia 1 Jul 2026; Maryland Jun 2026; Colorado 16 Feb 2026 [S] | Subscription apps | No dedicated app found | Patchwork without a single date; no wave |
| 25 | US state privacy laws; California browser opt-out signal (AB 566) | Honour opt-out signals; notices | Oklahoma and Louisiana 1 Jan 2027, Alabama 1 May 2027; California browsers must offer the signal from 1 Jan 2027 [S] | Thresholds exclude most small merchants [B] | Shopify privacy settings and consent apps (Pandectes 3,116 reviews, Consentmo 2,035) | Saturated | No gap |
| 26 | US state chatbot disclosure laws | Tell users they talk to AI | Washington, Oregon, Colorado from 1 Jan 2027 [S] | Customer-service bots are carved out in most [S] | Chat vendors | 0-rev apps | Does not reach store chat widgets |
| 27 | Connecticut ban on surveillance pricing | No storefront element | All retail sellers | 1 Jul 2027 [S] | — | — | Not app-shaped |
| 28 | California Proposition 65 new short-form warnings | Updated warning text on product pages | Sellers of listed-chemical products to California | 1 Jan 2028 [B, not verified] | No | 3 dedicated apps, 0-rev; one general warning app 18 reviews | Just outside the window; already squatted |
| 29 | Québec warranty of good working order (Bill 29) | Show warranty duration near the advertised price, also online | Sellers of listed appliances and electronics to Québec | 5 Oct 2026 [S] | No | 1 app (launched 9 Oct 2026, $0.99, 0-rev) | Tiny N |

### 2.3 India and Shopify platform deadlines

| # | Rule | What a merchant must change | Who / how many | Date and status | Solved natively? | Apps today | Reading |
|---|---|---|---|---|---|---|---|
| 30 | **India, Consumer Protection (E-Commerce) (Amendment) Rules, 2026 (G.S.R. 789(E))** | (i) Display legal name, addresses, customer-care and grievance-officer contacts; grievance officer acknowledges within 48 hours and resolves within one month. (ii) On any announced price cut, show the "prior price" = lowest price in the preceding 30 days. (iii) Comply with the 2023 dark-pattern guidelines, "conduct yearly self-audit … and a certificate to this effect shall be displayed prominently". (iv) Importer details and country of origin for imported goods. (v) Sellers disclose GST or MSME registration numbers. (vi) Accurate return, refund, warranty, delivery, payment information | "Every e-commerce entity"; the 2020 rules define this as anyone operating a platform for e-commerce, including "inventory e-commerce entities" that sell their own stock directly, and foreign entities that "systematically" sell to Indian consumers [F]. **India has 130,450 Shopify stores** (FACT-3P) | Notified 9 Sep 2026; "shall come into force with effect from 1st January, 2027" **[F — official PDF on consumeraffairs.gov.in, page image read]**. No public draft preceded it [S] | No (INFERENCE): Shopify's merchant changelog has no entry for "omnibus", "price history" or "lowest price" in 1,658 posts (F), i.e. four years after the EU's 30-day price rule there is still no native price-history display | Shopify: **1** — "India Prior Price" (launched 2 Nov 2026, free, 0-rev, price history only). Nothing for the certificate, grievance desk or storefront registration numbers under eleven keyword searches (only GST invoice apps and cookie banners come up). WordPress: 0. EU "Omnibus" price-history apps exist (best 75 reviews) and could re-label | **The only un-squatted trigger found.** Weak points: regulator-only enforcement, self-certification, $5 price anchor |
| 31 | India, Legal Metrology (Packaged Commodities) Amendment Rules 2026 | Searchable and sortable country-of-origin filter for imported products | E-commerce entities selling imported packaged goods | 1 Jul 2026 [S] | Largely: Shopify's free Search & Discovery app filters on product metafields [B] | 1 label app, 0-rev | Folds into row 30 |
| 32 | India, Digital Personal Data Protection rules | Itemised consent notice, withdrawal, data-rights requests | All Indian stores | ≈ May 2027 (report D, official source) | Consent apps will add templates (INFERENCE) | 7 apps, best 2 reviews. WordPress 3, 0 installs | Second wave for a row-30 product |
| 33 | Shopify ScriptTag shut-off | Activate app embeds; replace legacy scripts | 22 of 28 sampled brand storefronts still load ScriptTag scripts (report D) | Creation blocked 1 Oct 2026; scripts stop **1 Mar 2027** [F, shopify.dev] | App vendors must migrate their own customers | 5–6 audit apps, all 0-rev | A lead-generation hook, not paid demand |
| 34 | Shopify legacy customer accounts | Migrate to new customer accounts | Stores on legacy accounts | Deprecated 26 Feb 2026; "final sunset date" not announced [F] | Shopify's own upgrade path; "ask Sidekick" [F] | ~7 apps, 101 / 74 / 38 reviews (report D) | No date |
| 35 | Shopify developer-side deadlines | Expiring offline tokens (1 Jan 2027: delisting), IP allowlists, Polaris 2.0 for Built for Shopify by 1 May 2027, UCP tool migration 15 Jan 2027 | App developers | [F] | — | — | Cost for the founder, not an opportunity |
| 36 | Shopify merchant-side minor migrations | POS Liquid receipts to the new editor by 1 Jan 2027; market-driven shipping for all by 1 Jul 2027; Knowledge Base app retired 15 Jan 2027 | Subsets of merchants | [F] | Yes, native replacements | — | No gap |

### 2.4 What the pipeline shows

- **Every dated trigger is pre-squatted** by zero-review apps launched in September–November 2026, down to a Québec warranty label at $0.99 (FACT). Being "first" is no longer available by default; being first *and credible* (reviews, badge) still is in most rows, because no squatter has traction.
- **The squatting is continuous.** Of the 72 newest apps in Shopify's Legal category today, 69 have zero reviews and 3 have one (FACT, category page sorted by newest, pages 1–3). They target one rule each: guarantee labels, consumer-credit notices, Croatian price lists, textile passports, deforestation filings, AI image labels. Exactly one of the 72 targets India's e-commerce rules ("India Prior Price").
- **No 2027 EU or German rule has the withdrawal-button shape** (function + all merchants + warning-letter exposure). The German compliance calendar for 2027 is supply-chain, tax and product-data work.
- **The subscription cluster is real but belongs to the subscription apps**: UK January 2027, Australia July 2027, Louisiana January 2027, later the EU Digital Fairness Act.
- **India is the outlier**: firm date, large base, no draft period (so few had notice), almost no supply.

---

## 3. Getting paid and getting listed (question 3)

### 3.1 Shopify

| Item | Finding | Label |
|---|---|---|
| Payout methods | "Partners can receive payouts by PayPal or Bank Account. Access to specific payout methods depends on your country or region and the currency." Payments are delivered through Hyperwallet. The list of methods for a country is shown only inside the dashboard after choosing country and currency | FACT, help.shopify.com |
| Ukraine | Shopify's partner blog, 17 Nov 2021: "we can issue payouts in many more regions, now including countries such as Ukraine, Turkey, Bangladesh, Nigeria, and Pakistan." No 2026 Shopify page names Ukraine or its rails | FACT for the 2021 statement; **UNKNOWN** whether a USD wire or UAH transfer to a Ukrainian IBAN is offered today — check in the dashboard before building |
| Bank account type | "You need to use a real bank account. Virtual bank accounts, such as Payoneer, aren't supported." A monobank business account is an ordinary bank account (INFERENCE: acceptable) | FACT + INFERENCE |
| PayPal route | PayPal cannot receive commercial payments in Ukraine | Round-1 report A |
| Currency | Payouts are issued in USD; conversion by Hyperwallet costs 0.50% | FACT |
| Threshold and schedule | $25 minimum; twice monthly: earnings of the 1st–10th are paid 5 business days after the 15th; the rest 5 business days after month end | FACT |
| Limits | Bank up to $500,000 per payout, PayPal $100,000 (lower in some countries) | FACT |
| Identity and compliance | Sole proprietors "might be required to provide identity verification details when your earnings reach a certain threshold"; Hyperwallet or the bank may hold a payout for more information | FACT |
| Revenue share | 0% on the first $1,000,000 lifetime gross app revenue (counted from 1 Jan 2025), 15% above; 2.9% processing fee and applicable sales tax on all billing; $19 one-time registration | FACT, shopify.dev |
| Tax | "Shopify might charge you taxes on its fees"; depends on the tax details entered for the business entity | FACT; Ukrainian specifics UNKNOWN |
| **New submission rules, 10 Nov 2026** | (1) Only one new app in review at a time. (2) Each existing app needs 10+ installs on full-priced stores before another app can be listed. (3) Escalating cooldowns after rejections. (4) "Identity verification is now a required step for developers who submit new apps". (5) Apps with zero installs after six months are removed | FACT, shopify.dev changelog and review guide |
| Identity check mechanics | The partner identity verification launched 9 Jul 2026 "is completed through Stripe and requires a government-issued photo ID and a selfie or liveness check" | FACT. UNKNOWN whether Ukrainian documents pass without friction |
| Review lead time | Developers on 10–11 Nov 2026: "waited 10 business days for my first review"; after a rejection "sent to the back of the queue … nearly a month" | FACT, community.shopify.dev (anecdotal) |
| Built for Shopify | 50+ net installs from active paid shops, 5+ reviews, minimum recent rating, LCP ≤ 2.5 s, CLS ≤ 0.1, INP threshold; admin UI must match Polaris 2.0 by 1 May 2027 | FACT |
| Review rules | Since 6 Jul 2026 a dedicated requirement bans "offering, unlocking, or withholding app features in exchange for a merchant leaving a review"; violators lose "a significant portion" of reviews | FACT. The withdrawal-button winner's onboarding-time reviews would be riskier to imitate now |
| Other technical requirements | Expiring offline tokens for all public apps by 1 Jan 2027; billing through Shopify; mandatory privacy webhooks (B, standard requirement, not re-read today) | FACT / B |

**Time from build to first money (INFERENCE from the facts above):** build 1–3 days → identity verification and listing assets 2–4 days → first review ~10 business days → published in week 3–4 if it passes first time, week 6–8 after one rejection → first merchant charge after any trial → payout 5 business days after the 15th or month end once $25 has accrued. **Earliest first payout: about 7–9 weeks after starting; realistic: 10–14 weeks.** Starting 16 November 2026, a first-time pass means a listing in the first week of December and a first payout in late January or February 2027.

### 3.2 Wix (brief)

- Round-1 report D (read 2026-11-13): developer keeps 100% for the first 12 months, then 80/20; payouts through Tipalti, monthly, $200 minimum, about two months after the sale; Wix states payments "are not issued to banks located in Russia and Pakistan" and names no other exclusion. Ukraine is therefore likely supported but not confirmed by name. I could not re-open the Wix developer pages today (404 on guessed URLs) — not re-verified.
- Market check today (FACT): "withdrawal" 16 apps, best 4 reviews; "garan" 3 apps, 0–1 reviews. A mandate that produced 2,325 reviews on Shopify produced 4 on Wix. **Not a channel for this hypothesis.**

### 3.3 WordPress / WooCommerce through Freemius (brief)

- Freemius' supported-countries page lists "Ukraine (non-sanctioned regions)" for payouts (FACT, re-read today). Round-1 reports: wire, Wise, Payoneer or PayPal; $100 minimum; 3.8% + $0.50 per transaction plus gateway fees.
- Market check (FACT): the withdrawal-button winners are free plugins from vendors with existing distribution; guarantee-notice plugins peak at 200+ installs; for 2027 triggers (UK subscriptions, e-invoices, DPDP, EUDR, battery passport, green claims) every dedicated plugin shows 0 installs. For India's e-commerce rules there is no plugin at all. WooCommerce's India base is UNKNOWN.

---

## 4. Verdict (question 4)

### 4.1 Scoring against the six criteria

| Criterion | India e-commerce rules kit (row 30, later 32) | UK + Australia subscription rules (rows 19, 22) | ScriptTag shut-off audit (row 33) | For reference: German e-invoices (row 8) |
|---|---|---|---|---|
| (a) Firm and dated | Yes — notified, 1 Jan 2027 | Yes — 1 Jan 2027 (UK draft regulations), 1 Jul 2027 (Australia) | Yes — 1 Mar 2027 | Yes — 1 Jan 2027 |
| (b) ≥ 50,000 merchants on one platform | Yes — 130,450 Indian Shopify stores (FACT-3P); share that is dormant UNKNOWN | **No** — ~17,000 UK, ~10,500 Australia | Probably (most stores with older apps) — not measured | **No** — B2B sellers above €800,000 only |
| (c) < 5 credible apps | Yes — 1 app, 0 reviews, one feature | Yes by reviews (2–3 apps, 0 reviews), but the real competitors are the subscription apps | Yes — 5–6 apps, 0 reviews | **No** — incumbents with 185–1,218 reviews |
| (d) Platform unlikely to solve natively in time | Yes | **No** — the subscription apps are the natural owners | Half — each app vendor migrates its own users | n/a |
| (e) 1–3 day build with real compliance value | Yes for price history, legal block, registration numbers, grievance form with 48-hour acknowledgement, guided self-audit and certificate page. The audit is a checklist plus theme scan, not legal assurance | **Weak** — without access to other apps' contracts it is disclosure blocks, a cancel-request form and templates | Yes, but the value is a report | No — tax liability, formats |
| (f) Founder can be paid | Probably (Shopify → Hyperwallet; Ukraine rails unconfirmed) | Same | Same | Same |
| **Result** | **Passes formally; fails on money** | Fails (b), (d), (e) | Fails on willingness to pay | Fails (b), (c) |

**Plain answer: no opportunity found today qualifies in the sense that matters — a credible path to $10,000 MRR within 12 months.** One (India) passes the six screening criteria, and that is exactly why the screen is not sufficient: it does not test price level or enforcement pressure, the two things that made the German case pay.

### 4.2 Top three, ranked, with numbers

All ranges are my estimates (INFERENCE on stated ASSUMPTIONS), anchored on two measured benchmarks: under intense warning-letter pressure the two leading withdrawal apps are detected on roughly 5,100 of 104,744 German stores (≈ 5%; with other apps perhaps 8–10%), and the best India-specific compliance app on Shopify (GST invoices, a hard tax duty, $4.99–49.90) has collected 502 reviews in nine years.

| Rank | Opportunity | Price | Paying merchants by month 12 | MRR at month 12 | Build → first payout | P($10k MRR by month 12) | Main kill-risk |
|---|---|---|---|---|---|---|---|
| 1 | **India e-commerce rules kit for Shopify**: prior-price recorder and display, legal and grievance block with ticket log, GST/MSME number display, guided yearly dark-pattern self-audit with certificate page; add DPDP consent notice for the May 2027 wave. Second listing on WordPress.org + Freemius | Free (display only) + $4.99–7.99/month; the yearly re-audit and running price history justify a subscription | Low 30 · central 150 · high 450. Method: 1–4% of 130,450 stores install some app within a year (ASSUMPTION; Germany reached ~8–10% under far stronger pressure) → 1,300–5,200 installs; first credible app takes 40–60%; 5–15% pay | **$150 – $750 – $3,600** | 10–14 weeks (listing early December 2026 if the first review passes; first payout late January–February 2027) | **2–4%** | Nobody enforces against small own-site sellers, so no wave ever forms. Also: a self-issued certificate is a document a merchant can write himself; the EU price-history apps re-label for India; Indian merchants' card-billing friction (UNKNOWN) |
| 2 | **Subscription-rules kit for UK (Jan 2027) and Australia (Jul 2027)**, extensible to US states: pre-contract information block, cancel-request page, reminder templates, audit checklist | $9–19/month (what the two existing apps charge) | Low 20 · central 80 · high 300. Method: ~27,500 stores with a subscription app in both countries; 2–5% install an add-on; 15–25% pay → 80–340; low end cut to 20 for the case where the subscription apps ship the flows themselves | **$250 – $1,000 – $4,500** | UK date cannot be met with lead time (listing mid-December at best, 2–3 weeks before the date); Australia is the properly timed leg (launch Jan–Mar 2027; first payout March–April 2027) | **≤ 2%** | Recharge, Appstle, Seal, Kaching and Shopify Subscriptions ship the statutory flows inside their own apps, and a third party cannot read their contracts |
| 3 | **ScriptTag shut-off audit** (1 Mar 2027): free scanner as an acquisition hook for something else | Free; at most a one-time $9–19 | ~0 recurring | **$0–300** | 10–14 weeks, i.e. listing in December for a March date — the timing is right, the money is not | **< 1%** | Vendors migrate their own customers; six zero-review apps show no pull |

Rejected with evidence: German e-invoices (incumbents; B2B subset), green-claims scanners (1 review in 16 weeks for a well-placed German developer), EUDR / battery passport / digital product passport tools (0 reviews everywhere), AI-disclosure badges (0–1 reviews), US privacy and chatbot rules (thresholds and carve-outs), cloning the withdrawal or guarantee apps (rank locked; followers at 0–108 reviews).

### 4.3 What would have to be true for a future case to qualify

A checklist distilled from the two natural experiments, for screening the next mandate:
1. It requires a **function with records** (form, confirmation, log, price history), not a notice.
2. It applies in **Germany** (or another market with private warning-letter enforcement) to essentially all shops.
3. The app can be **live with the Built for Shopify badge 4–6 months before** the date; the wave arrives in the last 5 weeks and the two weeks around the deadline.
4. The free tier satisfies the law; paid tiers sell documentation, branding and integrations at $8–30.
5. Even then, plan for the winner's outcome to be in the order of $5k–$20k MRR and the #3 app's to be a few hundred dollars.

Candidates to watch, none actionable today: an EU-wide subscription cancellation function in the Digital Fairness Act (proposal November 2026, application not before 2028–29); a UK statutory ban on misleading "was" prices (consultation autumn 2026) — a price-history function for 244,832 UK stores; Shopify naming a sunset date for legacy customer accounts.

### 4.4 If the team still wants one cheap test of the hypothesis

The India kit is the only test where the shelf is empty and the date is seven weeks away. Costs: 1–3 build days and — under the 10 November rules — the founder's **single** review slot, which then stays blocked until that app has 10 paid installs. Stop rule (my suggestion): fewer than 150 installs and 10 paying stores by 15 February 2027 means no wave is coming. Before building: confirm in the Shopify dashboard that a bank payout to Ukraine is offered, and pass identity verification.

---

## 5. What I could not verify

- **Installs and revenue of any app.** No public figures; the winner's MRR range ($1.7k–$40k) rests on assumed review and paid-conversion rates. Store Leads counts are a crawler's detections and depend on each app's storefront footprint.
- **Shopify payout rails for Ukraine in 2026.** Only a 2021 statement names Ukraine. Whether Stripe-based identity verification accepts Ukrainian documents: UNKNOWN.
- **EU legal texts on EUR-Lex / Publications Office** (blocked or erroring today). Application dates of Directives 2023/2673 and 2024/825 were read on a Commission page; rows marked [S] or [B] were not checked against the legal text, including the right-to-repair date, the Consumer Credit Directive date, the €3 customs duty mechanics, the battery-passport status after the 2026 omnibus negotiations, and all US state dates.
- **Australia's commencement date** was read in law-firm notes, not in the Act; the Parliamentary Library digest confirms content only.
- **UK regulations are a draft** laid for approval; the final instrument could differ.
- **Whether subscription apps have shipped UK-specific features** — no vendor statement found; my "natively solved" judgement is an inference.
- **India:** how the Central Consumer Protection Authority will enforce against small own-site sellers; penalties under the amended rules; whether a prescribed certificate format will follow; how many of the 130,450 Indian Shopify stores are active; WooCommerce's India base; card-billing friction for Indian merchants paying app charges.
- **Why the guarantee notice under-performed** — my four reasons are inference; I found no reports of warning letters about the guarantee label, and first warning letters about the withdrawal button from August 2026 only in secondary sources.
- **Wix payout terms** were not re-read today.
- **Canada** beyond Québec, and **US federal** rules beyond the FTC item, were not searched in depth.

## 6. Search log

WebSearch calls used: **23 of 35**. Topics: German 2027 obligations overview; UK subscription regime date; FTC negative-option status; US state auto-renewal laws; US state privacy laws 2027; Digital Fairness Act status (2); US chatbot disclosure laws; Australia unfair trading practices; EU €3 customs duty; German transposition of the green-claims rules; Shopify payouts to Ukraine; withdrawal-button warning letters; subscription apps and the UK rules (2); the withdrawal-app developer; global e-commerce compliance calendar 2027 (extended mode); India dark-pattern enforcement; US laws effective 1 Jan 2027; UK retail law changes 2027; battery passport status; India rules and small sellers; Québec warranty rules. No search engine was used through curl, a browser, a proxy or an archive.

## 7. Sources (all read 2026-11-13)

**Shopify App Store and platform**
- Search and listing pages on apps.shopify.com: searches "widerrufsbutton", "legal guarantee", "gewährleistungslabel", "garantielabel", "EU guarantee label" and about 60 further keywords named in section 2; listings `/eu-widerrufsbutton`, `/eu-withdrawal-form`, `/wideruf-button`, `/eu-withdrawal-button-form`, `/eu-widerrufsbutton-1`, `/avada-withdrawal-form`, `/handlerbund-widerruf-manager`, `/eu-warranty-garan-label`, `/eu-guarantee-warranty-label`, `/eu-gewaehrleistungslabel`, `/eu-gewahrleistungslabel-garan`, `/pandectes-guarantee`, `/india-prior-price`, `/subguard`, `/upfront-uk-price-check`, `/eu-green-claims-greenwashing`, `/quebec-legal-warranty`, `/gst-invoice-india`, `/gst-invoice-pro`; review pages `/eu-widerrufsbutton/reviews?sort_by=newest&page=N` (22 pages), `/eu-withdrawal-form/reviews` (10 pages), `/wideruf-button/reviews` (5 pages)
- https://apps.shopify.com/categories/store-management-security-legal/all?sort_by=newest (pages 1–3, 72 apps)
- https://changelog.shopify.com/feed (1,658 posts) — incl. https://changelog.shopify.com/posts/self-serve-returns-now-support-cancellations (18 Jun 2026), Managed Markets EU cancellations (16 Jul 2026), legacy customer accounts deprecation (26 Feb 2026)
- https://shopify.dev/changelog/feed.xml (811 posts) — incl. https://shopify.dev/changelog/shopify-app-store-submission-requirements-build-grow-then-expand (10 Nov 2026), https://shopify.dev/changelog/identity-verification-for-partners (9 Jul 2026), https://shopify.dev/changelog/strengthening-trust-in-app-store-reviews (6 Jul 2026), https://shopify.dev/changelog/online-store-script-tags-deprecation (24 Aug 2026), expiring offline tokens (27 Oct 2026), Polaris 2.0 (24 Sep 2026)
- https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review
- https://shopify.dev/docs/apps/launch/distribution/revenue-share
- https://shopify.dev/docs/apps/launch/built-for-shopify/requirements
- https://shopify.dev/docs/api/usage/access-scopes
- https://help.shopify.com/en/partners/partner-program/getting-paid
- https://help.shopify.com/en/partners/manage-account/manage-payouts-invoices/payout-method
- https://www.shopify.com/partners/blog/payout-methods (published 17 Nov 2021)
- https://community.shopify.dev — topics 39596 and 39583 (10–11 Nov 2026), via the site's search JSON

**Third-party store data (FACT-3P)**
- https://storeleads.app/reports/shopify (country counts) and https://storeleads.app/reports/shopify/app/{eu-widerrufsbutton, eu-withdrawal-form, eu-warranty-garan-label, omnibus-price, subscriptions-by-appstle, seal-subscriptions, shopify-subscriptions, subscription-payments, loop-subscriptions, kaching-subscriptions, subi-subscriptions-memberships, gdpr-cookie-consent}

**Other stores**
- https://api.wordpress.org/plugins/info/1.2/ (query_plugins; 13 searches)
- https://www.wix.com/app-market/search-result?query=withdrawal ; `…query=legal guarantee` ; `…query=garan`
- https://freemius.com/help/documentation/selling-with-freemius/supported-countries/

**Legal — primary**
- European Commission, Consumer Rights Directive page: https://commission.europa.eu/law/law-topic/consumer-protection-law/consumer-contract-law/consumer-rights-directive_en
- UK draft regulations: https://www.legislation.gov.uk/ukdsi/2026/9780348287912 (Consumer Subscription Contracts (Cancellation and Information) Regulations 2026)
- UK government press release, 9 Aug 2026: https://www.gov.uk/government/news/pm-starts-roll-out-of-everyday-fixes-on-the-cost-of-living-ending-rip-off-discounts-and-subscription-traps
- UK consultation outcome: https://www.gov.uk/government/consultations/consultation-on-the-implementation-of-the-new-subscription-contracts-regime
- India, Department of Consumer Affairs: https://consumeraffairs.gov.in/pages/consumer-protection-acts ; amendment rules PDF https://consumeraffairs.gov.in/public/upload/files/E%20Commerce%20Amendment%20Rules%202026_1789127949.pdf ; 2020 rules PDF https://consumeraffairs.gov.in/public/upload/files/E%20commerce%20rules_1732703966.pdf
- Australia, Parliamentary Library Bills Digest No. 58, 2025–26: https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/bd/bd2526/26bd058

**Legal — secondary**
- https://www.xictron.com/de/blog/gesetzesaenderungen-2027-fristenkalender-onlineshop/ (13 Oct 2026)
- https://ohn.haendlerbund.de/recht/politik-gesetze/bnpl-produkthaftung-amazon-garantie-q4-2026 (28 Sep 2026)
- https://www.stephensonharwood.com/insights/subscription-reforms-brought-forward-to-january-2027-is-your-business-ready/ and https://www.stephensonharwood.com/insights/new-uk-subscription-rules-what-businesses-need-to-do-before-1-january-2027/
- https://www.claytonutz.com/insights/2026/october/dark-patterns-drip-pricing-and-dodgy-subscriptions-australia-s-new-unfair-trading-practices-act-explained
- https://www.scconline.com/blog/post/2026/09/14/consumer-protection-e-commerce-amendment-rules-2026-explained/ and https://www.scconline.com/blog/post/2026/02/21/legal-metrology-packaged-commodities-amendment-rules-2026-explained/
- https://internetfreedom.in/a-certificate-is-not-compliance-and-the-e-commerce-amendment-rules-2026-forget-that/
- Search-result summaries only (pages not opened): Kelley Drye autorenewal roundup (summer 2026); Covington, Gibson Dunn and others on the FTC rulemaking (Feb–Mar 2026); WBS.legal and IT-Recht Kanzlei on withdrawal-button warning letters (Aug–Oct 2026); Osler and McCarthy on Québec's warranty rules; trackers of US state privacy and chatbot laws; MLex / EUobserver on the Digital Fairness Act; vendor blogs on the EU €3 duty and the battery passport

**Round-1 reports relied on**
- /home/user/project-x/docs/research/round1/D-marketplaces-commerce-smb.md (Shopify supply facts, trigger calendar, Wix terms)
- /home/user/project-x/docs/research/round1/E-regulation-triggered-demand.md (EUDR, German e-invoicing, CRA, AI Act, PPWR, batteries text)
- /home/user/project-x/docs/research/round1/A-payments-ukraine-fop.md (PayPal in Ukraine, Freemius terms)
