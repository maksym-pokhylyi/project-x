# D — Commerce & SMB platform marketplaces as a distribution channel

Research date: **2026-11-13**. Decision context: one SaaS / micro-SaaS for a solo founder (Ukrainian sole proprietor, no audience, no Stripe), target $10,000 MRR by the end of month 12.

Scope: Shopify, Wix, WordPress/WooCommerce (+Freemius), BigCommerce, Squarespace, Webflow, Framer, GoHighLevel, QuickBooks, Xero, Procore, Clio, Square/Toast/Clover, Jobber/ServiceTitan/Housecall Pro, Amazon SP-API, Etsy, eBay, TikTok Shop, Chrome Web Store extensions on top of commerce/SMB platforms.

Evidence labels: **FACT** = read in a primary source on the date given. **INFERENCE** = my reasoning from facts. **ASSUMPTION** = unverified premise used in a calculation. **UNKNOWN** = could not verify. **RECOLLECTION** = from my prior knowledge, not re-verified today — treat as unverified. Source IDs like [S7] point to the source list in section 9.

---

## 0. Bottom line

1. **Verdict on the channel.** Reaching $10k MRR in 12 months through these marketplaces *alone* is not a base-case outcome for a new solo vendor in late 2026. My estimate is at most 5–10% for the best idea below and 2–4% for the others; a realistic month-12 result is $1–4k MRR (INFERENCE from the comparables in section 6). The marketplaces still work as a billing rail, trust signal and conversion surface — they have stopped working as a free discovery engine for newcomers.
2. **Why (all verified on 2026-11-13):**
   - Shopify's store roughly doubled in 18 months: "more than 16,000 apps" in April 2025 [S2] to 29,245 apps from 18,376 partners on 2026-10-28, half of them released in 2026, and 80% of the 2026 launches have no review at all [S9]. About 85 new apps arrive per day [S22].
   - Discovery is collapsing into a top-3 game: Sidekick shows "up to three" app cards and admin search pushes merchants to "Ask Sidekick" [S11][S12][S13]. Established developers report installs falling since spring 2026 [S13].
   - Every trigger I checked (15 regulatory or platform changes) already has 5–100 apps listed, almost all with 0–2 reviews (section 3.3). "No competitor" no longer exists as a state.
   - Shopify now allows one new app in review at a time and no second app until the first has 10 paid installs [S6][S7]; first review takes about 10 business days and a rejection sends you to the back of the queue [S16].
   - Wix publishes apps after an automated AI review "in minutes" [W5], and its newest-apps list is already dominated by multi-app publishers with zero reviews [W6].
3. **Ecosystem ranking for this founder:** Shopify (only one with proven paid demand, built-in billing and a verified bank payout route to Ukraine) > GoHighLevel (0% commission until 2026-12-31, quantified unmet demand, but I could not see the marketplace's supply side) > WordPress/WooCommerce + Freemius (open, payouts fine, but free-dominated and small niches) > Chrome Web Store + Paddle/Freemius > Wix (instant listing, thin demand) >> everything else (closed, no billing, Stripe-bound, or enterprise sales).
4. **Ranked ideas** (details in section 5):

| # | Idea | Ecosystem | Demand evidence | Price → customers for $10k | P($10k by m12) |
|---|---|---|---|---|---|
| 1 | LinkedIn inbox sync for HighLevel (unofficial) | GoHighLevel | #1 request on the Integrations board, 1.7k votes, open since 2023; platform says it cannot get LinkedIn access | $29/account → ~345 accounts | 8–12% if the marketplace has no good inbox-sync app, else ≤3% |
| 2 | DATEV accounting export at half the incumbent's price | Shopify (then WooCommerce) | Incumbent charges $34–136/mo, 115 reviews at 4.8; only 3 credible apps for "DATEV" | $19 → ~525 | 2–3% |
| 3 | India DPDP consent and data-rights kit | Shopify | Official 18-month deadline (≈ May 2027); 7 dedicated apps, best has 2 reviews | $8 → ~1,250 | ~3% |
| 4 | Staff time tracking → invoices | GoHighLevel | 260 + 170 votes, open 2–4 years, comments through Nov 2026 | $25/sub-account → ~400 | 3–5% |
| 5 | Legacy → new customer accounts migration kit | Shopify | Deprecation announced Feb 2026, sunset date pending; leaders have ~100 reviews | $15 → ~670 | 3–4% |
| 6 | Relisting/inventory extension for classifieds resellers | Chrome Web Store + Paddle | Niche leaders at 8,000–10,000 users with in-app purchases | €12 → ~800 payers | 2–4% |
| 7 | ScriptTag-sunset storefront scanner (acquisition wedge, not a business) | Shopify, off-store | 22 of 28 sampled storefronts still load ScriptTag scripts; shutoff 2027-03-01 | n/a | n/a |

5. **Largest gaps in this report:** the web-search budget for the session ran out after nine queries, so nearly everything rests on pages I fetched directly; I could not read GoHighLevel marketplace listings (supply side of ideas 1 and 4), could not find any developer revenue disclosure from 2026, and could not re-verify Xero, QuickBooks, Square, Jobber, Procore, Clio, Amazon or TikTok Shop terms (blocked or JavaScript-only pages). Details in section 8.

---

## 1. Method and limits

- Live fetches on 2026-11-13 of official developer/partner docs, live store listings and the stores' own search and category pages (Shopify App Store, Wix App Market, WordPress.org plugin API, Chrome Web Store), official changelogs (Shopify RSS feed, 811 entries), and developer/merchant forums through their public topic JSON (community.shopify.dev, community.shopify.com, ideas.gohighlevel.com).
- **WebSearch was unavailable after nine queries** (a shared per-session limit). I did not substitute other search engines. Consequence: no discovery of third-party articles, revenue disclosures or news beyond what primary pages link to.
- Shopify does not publish install counts. **Review counts are the public proxy**; converting them to installs or revenue needs assumptions, which I state where used.
- Blocked today (bot protection): Indie Hackers, Clio, Jobber (docs and marketplace), Square marketplace, Tipalti support site. JavaScript-only (no readable text): Xero developer docs, Intuit developer docs, Procore developer docs, GoHighLevel marketplace listings, Letsmetrix dashboards. One attempt to read GoHighLevel's listing data through the site's backend endpoint was refused by the session's safety rules, and I did not pursue it.
- My own data collection: a scan of the first results page of all 90 Shopify leaf categories (1,668 unique apps), about 60 keyword searches, about 60 listing pages, and a 28-store sample of public Shopify storefronts for ScriptTag usage.

---

## 2. Part 1 — Economics by ecosystem

### 2.1 Money: billing, platform take, payout route, Ukraine feasibility

| Ecosystem | Built-in billing | Platform take in 2026 | How the developer is paid | Ukraine sole proprietor |
|---|---|---|---|---|
| **Shopify App Store** | Yes (Billing API / Shopify App Pricing) | 0% on first $1M lifetime revenue (counted from 2025-01-01), 15% above; 2.9% processing fee on all billing; $19 one-time registration [S1][S2] | Hyperwallet, to PayPal or bank account; twice monthly; $25 minimum; virtual accounts such as Payoneer not accepted [S3][S4] | **YES** — Shopify's own post names Ukraine among regions reachable by the Hyperwallet bank methods [S5]. Exact rails are only visible in the dashboard; identity verification applies [S4][S7] |
| **Wix App Market** | Yes | 100% to developer for the first 12 months, then 80/20; 2.5% transaction fee [W1][W2] | Tipalti; monthly; $200 minimum; "net 30 EOM" (March revenue arrives early May) [W1][W2][W3] | **YES (likely)** — Wix states payments "are not issued to banks located in Russia and Pakistan" and names no other exclusion [W4]; Tipalti lists wire transfer and 200+ countries [P3]. Not confirmed for Ukraine by a named statement |
| **GoHighLevel Marketplace** | Yes (recommended) or external | "We currently do not deduct any commission" [G1]; "will not charge any commission … until December 31, 2026" [G2]. After that: UNKNOWN | Tipalti; paid on the 15th for the previous month [G1] | **UNCLEAR, leaning yes** — Tipalti rail, no country list found |
| **WordPress.org + Freemius** | None in WordPress.org; Freemius is merchant of record | Freemius: 3.8% + $0.50 per transaction + gateway fees, no monthly fee [F1] | Wire (SWIFT/IBAN), Wise, Payoneer or PayPal [F1][F2] | **YES** — "Ukraine (non-sanctioned regions)" is in the payout list [F2] |
| WooCommerce.com Marketplace | Yes | UNKNOWN (not checked today) | UNKNOWN | UNCLEAR |
| BigCommerce | Yes (Unified Billing, charges on the merchant's BigCommerce invoice) [O1] | $99 review and listing fee per submission [O1]; revenue share 20% (RECOLLECTION) | UNKNOWN | UNCLEAR |
| Squarespace | No open app store (curated extensions; RECOLLECTION) | — | — | n/a |
| Webflow / Framer | No built-in billing (RECOLLECTION) | — | Own billing | via Paddle or Freemius: YES |
| QuickBooks App Store | No | Tiered API-usage fees under Intuit's partner program (RECOLLECTION) | Own billing | via Paddle or Freemius: YES |
| Xero App Store | Yes, on Stripe (RECOLLECTION) | 15% (RECOLLECTION) | Stripe | **NO** for built-in billing if the Stripe dependency still holds; not re-verified |
| Procore / Clio / Jobber | No | None known | Own billing | via Paddle or Freemius: YES |
| ServiceTitan / Housecall Pro / Toast | Gated partner programs (RECOLLECTION) | — | — | n/a |
| Square | Developer account tied to supported countries (RECOLLECTION) | — | — | UNCLEAR, probably no |
| Clover App Market | Yes | UNKNOWN today | To a bank in the declared "tax residency country"; account approval with identity verification, passport for international developers [O2] | UNCLEAR |
| Amazon SP-API | No | Annual developer subscription plus usage tiers from 2026 (RECOLLECTION; fee page returned 404 today) | Own billing | registration UNCLEAR |
| Etsy / eBay | No app store with billing | — | Own billing | n/a |
| TikTok Shop App & Service Store | UNKNOWN | UNKNOWN | UNKNOWN | UNCLEAR (partner registration tied to supported regions; RECOLLECTION) |
| **Chrome Web Store** | No | One-time developer fee (RECOLLECTION) | Own billing | **Paddle: YES** except Crimea, Donetsk, Kherson, Luhansk and Zaporizhzhia regions [P1]. **Freemius: YES** [F2]. **Lemon Squeezy: NO** bank payout for Ukraine, PayPal only [P2] |

Note on Paddle: the exclusion names whole oblasts, including Kherson and Zaporizhzhia. Where the founder is registered inside Ukraine is not given to me — UNKNOWN, and it matters for Paddle.

### 2.2 Access: base, approval, discovery, risk

| Ecosystem | Customer base | Listing approval and lead time | Technical bar | Can a NEW app get organic installs in 2026? | Platform risks |
|---|---|---|---|---|---|
| **Shopify** | "Millions" of merchants (RECOLLECTION of Shopify's own wording). 29,245 apps / 18,376 partners (2026-10-28) [S9]; ~30,800 active apps (2026-10-08) [S10]; 24.9k new reviews/month in Mar–Sep 2026 vs 21.7k a year earlier [S11] | One new app in review at a time; each published app needs 10+ installs from paid stores before the next submission; escalating cooldowns after failed reviews; identity verification "soon"; apps with no install after six months are removed [S6][S7]. Observed waits: 30+ days in Mar–Apr 2026, ~12 days to first look in Oct, "10 business days" then back of queue in Nov [S14][S16] | GraphQL Admin API, expiring offline tokens for all public apps by 2027-01-01, IP allowlist for public apps by 2026-11-20, no new ScriptTags since 2026-10-01 [S18][S20]. Built for Shopify: 50+ net installs on paid shops, 5+ reviews, minimum rating, LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms [S17] | **Rarely.** 80% of 2026 launches have no review [S9]. On first category pages 84% of apps have 10+ reviews, 57% have 50+, 60% carry the Built for Shopify badge (my scan). Sidekick shows three apps [S11] | Sidekick concentration and Shopify favouring its own apps [S12]; Sidekick "custom app generation" for merchants [S21]; review queue; continuous mandatory migrations [S20]; fake-review competition [S8] |
| **Wix** | UNKNOWN today (RECOLLECTION: hundreds of millions of registered users, single-digit millions paying). eCommerce category: 594 apps [W6] | Automated AI review; "submission to published in minutes"; payout account required for paid apps [W5][W3] | Wix app framework, Wix billing | **Weakly.** Third-party leaders typically have 5–60 reviews; a few reach 360–800 [W6]. Newest list is flooded | Low willingness to pay; flood; Wix-built natives |
| **GoHighLevel** | "Hundreds of thousands of businesses", "thousands of agency account customers" [G2]; "1500+ apps" [G4] | Review against published guidelines; Loom demo required; lead time UNKNOWN [G3] | OAuth app, marketplace modules (conversation providers, workflow actions, custom pages) [G2] | UNKNOWN (listings unreadable). Idea-board votes show an engaged base (requests with 300–1,700 votes) [G5] | Very fast native feature shipping; commission after 2026-12-31 unknown; white-label rules [G3] |
| **WordPress.org / WooCommerce** | WooCommerce: 7,000,000+ active installs [F4] | Plugin review queue went from ~1,050 (mid-April 2026) to "nearly zero" by 2026-06-13, with submissions at record levels; automated security review of every release since Sept 2026 [F3] | GPL, WordPress coding standards | **Slowly and mostly for free plugins.** New regulatory plugins reached 1,000–6,000 installs in 5–8 months, all free [F4] | Free alternatives bundled in big suites; clone floods (four new DATEV exporters with 0 installs in Sept–Oct 2026 [F4]) |
| **Chrome Web Store** | Browser users of seller platforms | "Within a few days", up to "a few weeks" [O3] | Manifest V3 | **Somewhat.** User counts are public; niche leaders in seller tooling sit at 8,000–200,000 users [O4] | Host-platform terms of service and anti-bot measures; removal on complaint |
| BigCommerce, Xero, QuickBooks, Procore, Clio, Jobber, Square, Clover, Amazon, TikTok Shop, Etsy, eBay, Squarespace, Webflow, Framer | Not assessed in depth | See 2.1 | — | UNKNOWN | Closed programs, no billing, enterprise sales, or payment rails unusable from Ukraine |

### 2.3 Price points and churn

- **Observed Shopify prices** (listing pages, 2026-11-13 [S25]): compliance widgets $4.99–29.99; accounting sync $13–68, DATEV export $34–136; ERP connectors $35–199; ad pixels and feeds $9.90–49.90; customer-account apps $5–99; inventory planning $4.99–59.99.
- **Observed Wix prices:** mostly free or free-plan; paid tiers from $1.95/month; one outlier at $109/month [W6].
- **Churn:** UNKNOWN — no primary source. ASSUMPTION used below: 4–8% monthly logo churn for small-merchant utilities, lower for accounting integrations.
- **Billing-cycle risk on Shopify:** usage charges are added to the merchant's next Shopify invoice, so a developer can carry third-party costs for a merchant who uninstalls first (developer account, 2026-02-17) [S29].

### 2.4 Time from "build" to money in a Ukrainian bank account

| Route | Steps | Realistic total |
|---|---|---|
| Shopify | Build → self-review tool → queue (~10 business days to first look, a rejection restarts the wait) → free trial → merchant's 30-day billing cycle → payout five business days after the 15th or month-end, $25 minimum [S3][S16] | 9–14 weeks (INFERENCE); the holiday period may lengthen it |
| Wix | Publish in minutes → sales in month M → payout early in month M+2 once $200 accumulated [W2][W5] | 5–9 weeks after the first sale, longer under the threshold |
| GoHighLevel | Review (UNKNOWN) → sales in month M → payout on the 15th of M+1 [G1] | UNKNOWN + 2–6 weeks |
| WordPress.org + Freemius | Plugin review (short as of June 2026) → sales → Freemius payout cycle (UNKNOWN today) | UNKNOWN, probably 6–10 weeks |
| Chrome Web Store + Paddle | Review in days to weeks → sales → Paddle payout cycle (UNKNOWN today) | UNKNOWN, probably 5–9 weeks |

---

## 3. Part 2 — Gap finding

### 3.1 Shopify in November 2026: what a newcomer walks into

- **Supply shock (FACT).** 29,245 live apps from 18,376 partners; "half of the apps have been released in 2026"; "80% of the apps launched in 2026 do not have a single review" (crawl by P. Jakubik, 2026-10-28, quoted in [S9]). Letsmetrix counts ~30,800 active apps and new launches up ~10% month over month while new reviews fell ~4% to ~22,900 (2026-10-08) [S10]. One partner "launched 67 apps in the last 3 weeks" [S8]. Trackers disagree on totals (AppJubilee tracked 17,891 on 2026-05-25 [S24]), so treat counts as a range.
- **Shopify's response (FACT).** On 2026-10-29 Shopify "unpublished hundreds of apps" from "a small group of high-volume submitters" [S8]. On 2026-11-10 it introduced the one-app-in-review rule, the 10-paid-installs gate, escalating cooldowns, coming identity verification, and removal of apps with no install after six months [S6][S7].
- **Demand is not shrinking (FACT), it is being redistributed (INFERENCE).** Store-wide new reviews ran ~24.9k/month in Mar–Sep 2026 against ~21.7k a year earlier; about 520 merchants a day leave their first-ever review [S11]. At the same time a developer ranked #1 for its keyword reports installs falling from 321 to 199 over the comparison period [S13], and another reports an app going from 20+ installs a day to none for six days [S13].
- **Sidekick (FACT).** Shopify's Winter '26 Edition lists "Sidekick recommends apps — merchants can find and install apps directly in Sidekick" and "Custom app generation — get Sidekick to build custom apps designed specifically for your business needs" [S21]. Developers observe that Sidekick returns the top three apps for a keyword and that Shopify's own app gets a larger card than higher-rated third-party apps [S12].
- **Review velocity for honest solo developers (FACT, anecdotal).** Two developers with three years in market each report about 100 reviews, almost all earned after support conversations; Shopify's in-app review prompt yields "about 2 reviews a year" [S23].
- **Platform churn developers must absorb (FACT).** Within twelve months: expiring offline tokens (all public apps by 2027-01-01), IP allowlists (2026-11-20), migration to Shopify App Pricing, Shopify Scripts removal (2026-06-30), ScriptTag shutoff (2027-03-01), legacy customer accounts deprecation [S18][S19][S20].

### 3.2 A natural experiment: one regulation, three stores

Directive (EU) 2023/2673 requires an online withdrawal function for EU consumer contracts from 2026-06-19 (date as stated on the app listings [S25]; the directive text itself was not fetched). The same need hit all three ecosystems at the same time.

| Store | Supply on 2026-11-13 | Leader | Followers | Money |
|---|---|---|---|---|
| Shopify | 92 apps for "widerrufsbutton" | "EW: EU Withdrawal Button & Form", 401layers UG, launched 2026-01-09: **2,325 reviews**, 4.9 | Revoq, launched 2026-03-11: 583. Anviara, 2026-05-06: 108. "EU Withdrawal Button Free", 2026-06-03: 74. Then a tail of ~85 apps with 0–52 | Free plan plus $9.99 and $29.99 tiers (leader); $7.99–25 elsewhere |
| WooCommerce (WordPress.org) | 16 plugins for the German keyword, 236 for the English phrase | vendidero (makers of Germanized), added 2026-03-26: **6,000+ active installs** | Tellado 2,000+; WebToffee 1,000+; several at 300–500 | All free; Germanized (70,000+ installs) bundles it |
| Wix | 15 apps for "withdrawal" | Two apps with **4 reviews** each | Rest at 0–3 | Mostly free |

Sources: [S25], [F4], [W6]. What this shows (INFERENCE):
- Shopify turns a mandatory, functional requirement into paid installs at a scale the other two stores do not approach.
- Timing decided the outcome. Launching 5 months before the deadline produced about 4× the reviews of launching 3 months before, and about 20–30× those of launching in the final six weeks.
- The pattern is now common knowledge. Every later trigger is pre-squatted (next table).

### 3.3 Trigger calendar against existing supply on Shopify

Search results on apps.shopify.com, 2026-11-13 [S25]. "Dedicated apps" is my count from the first results page. Dates marked (R) are RECOLLECTION, not verified today.

| Trigger | Date | Dedicated apps visible | Best review counts | Reading |
|---|---|---|---|---|
| EU withdrawal button | 2026-06-19 | 92 total | 2,325 / 583 / 108 | Won by the first mover |
| EU guarantee notice and "GARAN" label | 2026-09-27 (R) | 15+ | 50 / 49 / 37 / 14 | Two apps launched in Aug 2026 reached ~50 reviews in 3 months with paid tiers from $4.99 |
| EU GPSR product safety | 2024-12-13 (R) | 105 total | 29 (dedicated), 75 (bundle) | Informational duty, weak demand |
| Accessibility (EU, US) | 2025-06-28 (R) | 159 in category | 331 / 95 / 45 / 45 | Large studios lead |
| E-invoicing mandates (DE, PL, ES, FR) | 2026–2028 (R) | "verifactu" 100, "KSeF" 43, "ZUGFeRD" 48 total | 23 / 13 / 13 | Merchants solve this in accounting software; regulated liability |
| Packaging EPR / PPWR | 2026-08 (R) | 7+ | 4 / 1 | No visible demand |
| Digital product passport | 2027+ (R) | 7+ | 3 / 2 | Too early |
| EU deforestation regulation | 2026-12 / 2027-06 (R) | 5+ | 0 | No visible demand |
| EU AI Act image labels | 2026-08 (R) | 4+ | 1 | No visible demand |
| India DPDP rules | ≈ 2027-05 (18 months after 2025-11-14 [O6]) | 7 | **2 / 1 / 0** | Thin; demand not yet visible |
| ScriptTag shutoff | 2027-03-01 [S18] | 5 | **0** | Squatted, no traction |
| OpenAI ads in ChatGPT (official app launched 2026-09-03, rated 1.5 from 81 reviews) | ongoing | 8+ | 38 / 36 / 15 | Third-party pixel and feed apps launched May–Aug 2026 already hold the top positions |
| US tariffs, HS codes | 2025–2026 (R) | 6+ dedicated to HS codes | 4 / 2; surcharge apps 204 / 143 / 101 | Surcharge niche taken |
| Legacy customer accounts sunset | deprecated 2026-02-26, date pending [S19] | ~7 | 101 / 74 / 38 / 11 | Moderately thin |
| Stocky (Shopify's inventory app) retired | 2026 (per merchant forum, 2026-11-12) | ~10 using "Stocky alternative" | 359 / 268 / 185 / 112 | Taken |

The "newest" sort of the Legal category (651 apps) on 2026-11-13 lists 24 consecutive zero-review apps aimed at one regulation each — consumer-credit notices, Croatian price lists, French origin labels, deforestation filings, textile passports [S25].

### 3.4 Shopify category scan (first results page of 90 leaf categories, 1,668 unique apps)

**Large review bases with poor ratings** (≥150 reviews, rating ≤4.3):

| App | Rating | Reviews | Comment |
|---|---|---|---|
| Facebook & Instagram (Meta) | 3.9 | 5,864 | Official channel |
| Shopify Marketplace Connect | 4.1 | 2,142 | First-party |
| Pinterest | 4.1 | 1,699 | Official channel |
| Shopify Subscriptions | 3.8 | 904 | First-party; third-party field is crowded (Appstle 9,264) |
| Shopify Search & Discovery | 2.6 | 514 | First-party; third-party field is crowded |
| Retail Barcode Labels (Shopify) | 2.3 | 477 | First-party; third-party replacements already strong (684 / 461 / 429 / 378 reviews) |
| Shiprocket, Shippo, Easyship, Starshipit, ShipStation | 3.9–4.3 | 211–710 | Shipping aggregators — heavy operations, not solo-friendly |
| WhatFlow, Interakt (WhatsApp) | 4.0–4.3 | 234–336 | Messaging providers |
| Shopify Checkout Blocks | 4.1 | 220 | First-party |
| Inventory Planner by Sage | 4.3 | 155 | Expensive incumbent; cheaper rivals exist (Stockie $4.99–59.99, 185 reviews) |
| ChatGPT (OpenAI) | 1.5 | 81 | 86% one-star; reviews from 2026-11-12 report failed verification and rejected feed rows |

Reading (INFERENCE): the badly rated big apps are first-party or official-channel apps whose third-party replacement markets are already mature, or operations-heavy categories. I found no large, badly served category that a one-person product could enter cleanly.

**Thin categories** (sum of reviews of the ten best-placed apps): ERP connectors 429 across 215 apps, with low ratings; donations 395; staff tools 816; payment experience 740; 3D/AR 512 across 417 apps; order editing 1,019; third-party logistics 1,077. For contrast: product reviews 65,014, SEO 58,715, marketplaces 46,314.

**Local accounting and ERP integrations** — thin top-3, real prices, small volumes:

| Keyword | Apps (search total) | Leaders: reviews @ rating | Prices |
|---|---|---|---|
| DATEV (Germany) | 1,199, about 4 relevant | Pathway "Buchhaltungsexport Pro" 115 @ 4.8; Lexware Office (by Eshop Guide) 286 @ 4.6; a newcomer with 0 | $34–136; $13–27 |
| sevdesk (Germany) | 52 | 85 @ 4.7; 49 @ 4.3 | $13–27 |
| Fortnox (Sweden) | 114 | 11 @ 3.9; 5 @ 4.2; 5 @ 5.0 | $20; $29 |
| e-conomic (Denmark) | — | 6 @ 4.5 | — |
| Moneybird (Netherlands) | 7 | 30 @ 3.7; 7 @ 4.1 | $18–36 |
| Exact Online (Netherlands, Belgium) | — | 22 @ 4.3 | $18–36 |
| bexio (Switzerland) | 500 | 38 @ 4.5; 8 @ 3.9 | $13–64 |
| Holded (Spain) | — | official app 2 @ 3.7 | $17–113 |
| Billingo (Hungary) | 169 | 25 | free to install |
| SmartBill (Romania) | 36 | 12 @ 4.6 (launched 2026-01-30); 5 @ 1.6 | $18–50 |
| Fakturoid (Czechia) | — | 49 | $20 |
| Odoo | 260 | TM Odoo Integration 94 @ 5.0 (launched 2024-07-24); 18; 10 | $35–65; $20–35 |
| NetSuite | 91 | 83 @ 4.6; 34 @ 5.0 | $99–199 |
| JTL (Germany) | 143 | official connector 6 reviews, half of them one-star | free |
| Dynamics 365 Business Central | — | Microsoft's connector 28 @ 2.7 | free |

A Nordic specialist with five accounting connectors on Shopify has 8 reviews across all five [S25]. These niches pay well per customer and stay small.

### 3.5 GoHighLevel: demand is visible, supply is not

- **Economics (FACT):** in-platform billing, no commission until 2026-12-31, monthly Tipalti payouts, agencies can resell an app to their sub-accounts with a markup [G1][G2].
- **Demand signals (FACT, ideas.gohighlevel.com, sorted by votes, 2026-11-13) [G5]:**

| Request | Votes | Status and recency |
|---|---|---|
| LinkedIn message integration | 1.7k | Opened 2023-10-04; staff: "LinkedIn Messaging access is restricted by LinkedIn and currently limited to select partners … remains a top priority"; status set to open again and commented in Sept 2026 |
| Automatic messages to new Instagram followers | 1.2k | — |
| Workflows at the agency level | 821 | Platform-level |
| Custom invoice layouts | 714 | "planned"; a comment from 2026-08-31: "comments I see are from 2024 and still nothing" |
| Attach PDF to invoice | 499 | — |
| SMS / channel stats reporting | 395 | — |
| Sync products with QuickBooks and Xero | 359 | — |
| IDX integration (real estate listings) | 289 | — |
| Time tracking for internal team | 260 | Opened 2022-09-13; "under review"; comments through July 2026 |
| Staff time tracking (billable hours → invoice) | 170 | Opened 2024-07-23; a comment four days before 2026-11-13 ties it to GoHighLevel's new project-management module |

- The dedicated "Marketplace new app request" board is weak: its top items have 4–15 votes [G5].
- One user on the LinkedIn thread notes that existing tools "like Closely" connect to HighLevel but "do not bring in the existing conversations" [G5].
- **UNKNOWN:** how many marketplace apps already address each request, their installs and ratings, and the review lead time.
- **Disconfirming:** GoHighLevel's own Shopify app sat in Shopify's review queue from January to at least May 2026 [S26] — a reminder that cross-platform apps inherit both queues. Users also ask for the "ability to vibe code apps with AI in app marketplace" (11 votes) [G5].

### 3.6 Wix

- **Poorly rated incumbents with real review bases (FACT) [W6]:** Shippo 3.6 (515 reviews), Melhor Envio 2.2 (273), Envia 3.3 (247), vcita Online Scheduling 2.8 (194), Wix Smart Chat 2.7 (163), Schedule 2.3 (138), ShipStation 2.8 (105), Packlink 2.6 (80), Boxtal 3.2 (78); Wix Bookings itself 3.4 (1,721).
- These are shipping aggregators and scheduling suites — carrier contracts and deep product surface, not a one-day build.
- For ordinary commerce keywords, leaders have single- or double-digit reviews: wholesale 19 / 5 / 4, delivery date 17 / 6 / 6, Xero sync 33 @ 4.2, export orders 27, back in stock 1.
- The newest-apps list shows the same farm pattern as Shopify (one publisher prefix with 10+ zero-review apps, another with 15+).
- Reading (INFERENCE): instant listing and 100% first-year revenue share make Wix a cheap second listing for an existing product, not a primary channel.

### 3.7 WordPress.org / WooCommerce

- Install counts are public, which makes niches measurable: Fortnox connectors 300+ / 200+ / 500+; Moneybird 100+; Holded's official plugin 2,000+ with a 40% rating from 3 ratings; a Polish e-invoicing add-on 700+; HighLevel bridges 300–800 [F4].
- New-plugin floods are visible here too: four DATEV exporters added in Sept–Oct 2026, all at 0 installs [F4].
- Reading (INFERENCE): good for free reach and search traffic; paid conversion on these niche sizes cannot plausibly produce 800–1,200 paying sites in a year.

### 3.8 Chrome Web Store (seller tooling)

User counts from store pages, 2026-11-13 [O4]:

| Niche | Leaders (users, rating) |
|---|---|
| Etsy sellers | EverBee 200,000 (4.1); Alura 100,000 (4.7); eRank 40,000 (3.7); ESale 20,000; ProfitTree 10,000 |
| Vinted sellers | Dotb 10,000 (4.4, in-app purchases); Bleam 8,000 (4.4); Vinted 4x6 Label Printer 2,000; Vinted Relister 1,000 (3.2, not updated since 2025-09) |
| Kleinanzeigen sellers | Kleinanzeigen-Enhanced 10,000 (4.7, in-app purchases); Kleinanzeigen Tool 4,000 |
| TikTok Shop sellers | ListingView 10,000; the rest 21–336 |
| Facebook Marketplace listers | 11–620 |
| Shopify admin helpers | 6–2,000, poorly rated |

### 3.9 My own sample: how exposed are stores to the ScriptTag shutoff?

Shopify will stop injecting ScriptTag scripts into storefronts on 2027-03-01; creation has been blocked since 2026-10-01; replacements (app embed blocks) must be activated by the merchant in the theme editor [S18].

I fetched the home pages of 30 well-known Shopify brands on 2026-11-13 and parsed the `asyncLoad` block that lists ScriptTag-injected URLs. Of 28 pages that parsed as Shopify storefronts, **22 (79%) still load at least one ScriptTag script**, up to 11 per store. Hosts seen most often: an SMS marketing vendor (7 stores), a subscriptions vendor (6), a loyalty vendor (6), an ID-verification vendor (4), an email vendor (4).

Caveats: big brands, tiny sample, and large vendors will migrate their own customers. Supply already exists — five "script tag" audit apps are listed, all with 0 reviews [S25]. The finding is useful as an outbound hook (idea 7), not as proof of paid demand.

---

## 4. What the data rules out

- **Cloning a compliance widget.** Entrants four to five months behind the leader collected 74–108 reviews at $8–10 price points; at plausible paid shares that is hundreds of dollars a month.
- **E-invoicing and fiscalisation apps** (Verifactu, KSeF, XRechnung). Low visible demand on Shopify (best dedicated apps 13–23 reviews) and legal liability for the software producer.
- **ChatGPT ads pixel and feed apps.** Apps launched between May and August 2026 already hold the top positions with 15–38 reviews, and an incumbent feed app with 444 reviews has added the format.
- **Stocky replacements, barcode labels, B2B wholesale, order printers, bundles, reviews, pre-orders.** Leaders have hundreds to tens of thousands of reviews at 4.8–5.0.
- **Regional marketplace connectors** (Kaufland, Allegro, bol.com, eMAG, Temu). Small review bases (2–26), high support load, marketplace-side approvals.
- **Wix-only products.** Demand per keyword is one to two orders of magnitude below Shopify.
- **Square, Toast, Clover, ServiceTitan, Housecall Pro, Xero, TikTok Shop, Amazon.** Gated programs, hardware or enterprise sales, or payment rails that do not reach a Ukrainian sole proprietor.
