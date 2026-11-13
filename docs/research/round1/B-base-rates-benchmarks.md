# B — Base rates, success patterns and funnel benchmarks

Analyst scope: empirical base rates, case set, channel patterns, funnel benchmarks, evidence-driven shortlist.
Research date: **2026-11-13**. "Today" and "as of" refer to that date unless another date is given.

Evidence labels used throughout:

- **FACT** — observed in a cited source (URL + source date given). Vendor benchmark reports are facts about the vendor's dataset, not about the world.
- **INFERENCE** — my reasoning from facts (arithmetic or interpretation).
- **ASSUMPTION** — unverified working premise, chosen so a model can be built; replace when better data arrives.
- **UNKNOWN** — looked for, could not verify.

## 0. Method and limits of this research (read first)

- **Search budget.** The shared `WebSearch` budget for this run (200 calls across all analysts) was exhausted after my 9th search. Everything after that was done by fetching primary pages directly (about 150 page fetches plus 146 public TrustMRR startup profiles). I did not query search engines by other means. Consequence: coverage is deep where I knew or could navigate to the primary URL, and thin where discovery needed search (founder interviews, Indie Hackers posts, marketplace funnel data, post-mortems).
- **Blocked sources.** `indiehackers.com` (Cloudflare challenge), `bigideasdb.com` (bot checkpoint), `reddit.com`, `wordstream.com`, CRTC and ACMA regulator pages, the FTC CAN-SPAM guide page, and the GitHub repository with the anonymised TrustMRR census data (access not enabled for this session) could not be read. Where I cite them it is via a second source and marked.
- **Main new dataset.** TrustMRR (launched 2025-10-31) connects to payment providers (Stripe, Paddle, RevenueCat, Lemon Squeezy, Polar, Dodo, etc.) and publishes verified revenue. I used (a) its public statistics pages, (b) an independent full census of its API (10,150 products, 2026-09-04), and (c) 146 individual public profiles that I parsed myself (founding date, monthly verified revenue for the last 12 months, MRR, active subscriptions, founder X followers, self-declared channels). TrustMRR is self-selected (founders choose to list) and young; older products joined with outcomes already known.
- **What "verified" means in the case set.** Revenue, MRR and subscription counts are payment-provider data. Founding date, pricing text, team size, target persona and marketing channels are **founder-entered** and unverified. Public profiles show only the last 12 months of monthly revenue, so "time to $10k" is exact only for products whose crossing happened inside that window.

---

## 1. Base rate: how often and how fast do solo/bootstrapped products reach $10k MRR?

### 1.1 Short answer

- **How often.** In verified-revenue data, roughly **2–5% of listed indie products are at or near $10k MRR at any age**, and about **1% (range 0.7–1.5%) are there while under 12 months old**. For newly launched subscription apps, **4.6% reach $10k monthly revenue within two years** (1.6% in the Business category). Self-reported datasets show 3–6x higher shares and should not be used.
- **How fast, for the ones that make it.** Winners are fast: in my verified sample of products founded 2024–2026 that are now at ≥$10k MRR, the median time from founding to the first ≥$10k revenue month was **7 months (9 months for B2B)**. But the typical product earning ≥$5k MRR is **18 months old**, and four in ten are older than two years.
- **What the target implies.** $10k MRR by month 12 needs an average of **+$833 net new MRR every month from day one**. Surveyed bootstrapped SaaS companies add about $316/month (entry price $1–9) to $1,073/month (entry price $1,000+). It also implies roughly 30–35% compound monthly growth from a $500–$1,000 base, against 10–17% for ChartMogul's top decile of early-stage SaaS.
- **Honest probability for this founder.** INFERENCE/ASSUMPTION: unconditional odds for one product are about **1–3%**. With disciplined choices that the data favours (B2B, ARPA ≥ $100, a category with proven spending, direct outreach from week one) I would plan on **5–10% for $10k MRR by month 12**, and treat **$3–5k MRR by month 12** as the realistic good outcome (perhaps 15–25%). These last numbers are judgement, not measurement.

### 1.2 Evidence

| # | Source (date) | What it measured | Finding (FACT) | Supports |
|---|---|---|---|---|
| 1 | Mifanr, "I pulled 10,150 products on TrustMRR: no fast money" (published 2026-09-05; data 2026-09-04) — https://mifanr.com/en/posts/trustmrr-census/ | Full API pull of every TrustMRR product, verified revenue | 26.1% never recorded a payment; 49.1% had revenue in the last 30 days; median 30-day receipts among earners **$169**; median lifetime revenue $535; top 1% of products took 76.1% of 30-day revenue | Typical outcome is near zero |
| 2 | same | Products with subscription MRR > $5,000 and fresh data | **353 of 10,150 = 3.5%**. Median age **18.2 months** (IQR 10–39), 38.5% older than two years; median 388 active subscriptions; median price **$37/month** vs $13 site-wide; **35.3% had negative MRR growth in the last 30 days, median growth 0%** | Level, speed and fragility of "success" |
| 3 | same | Share earning ≥$5k/month (30-day receipts) by product age | Under 3 months: **1%**; 3–6 months: **3.6%**; 6–12 months: ~3% (residual of the published row 29/29/39); 1–2 years: 7%; 2–4 years: 11%; over 4 years: 19%. Under-12-month products with MRR ≥ $5k: 1.7% (AI) / 1.8% (non-AI) | First-year odds |
| 4 | TechStartups, "What percentage of indie hacker products make $100K in ARR?" (2026-09-28) — https://techstartups.com/2026/09/28/what-percentage-of-indie-hacker-products-make-100k-in-arr/ | Same census, threshold $8,333 MRR, stale records removed | **245 of 10,150 = 2.41%** had fresh MRR ≥ $8,333. 27 of the 272 raw qualifiers had expired or unsynced connections | Share near $10k MRR at any age |
| 5 | Mifanr (as #1) | Founders with several products | Best product ≥ $5k/month: 5.0% of single-product founders, 8.6% with 2–3 products, 14.1% with 4+ (not age-controlled). Per product the hit rate falls | Repeated attempts raise founder-level odds |
| 6 | Mifanr (as #1) | Category and country | MRR ≥ $5k share: Mobile Apps 8.0%, E-commerce 6.0%, Marketing 4.9%, AI 4.2%, SaaS 3.7%, Developer Tools 2.1%, **Productivity 0.6%, Utilities 0.5%**. US payment entities 7.4%, UK 2.5%, Germany 1.8%, India 0.5%. "AI" label: no measurable difference | Where winners cluster |
| 7 | TrustMRR statistics page (snapshot 2026-11-13) — https://trustmrr.com/stats | All-time revenue distribution of listed startups | $0–$1k: 67.3%; $1k–$10k: 17.2%; $10k–$100k: 10.4%; $100k–$1M: 4.1%; $1M+: 1.0%. Founder X followers: 0–1K 53.1%, 1K–10K 12.0%, 10K–100K 2.4%, 100K+ 0.3%, unknown 32.2%. Correlation of revenue with followers r = 0.25 (n = 6,315), with domain rating r = 0.43, with age r = 0.46 | Distribution; audience matters less than age and search authority |
| 8 | TrustMRR "Micro SaaS examples" (2026-11-13) — https://trustmrr.com/micro-saas-examples | Software-only, not VC-backed, ≤5 people where stated, $1K–$50K MRR | 482 businesses: 311 at $1–5K, 79 at $5–10K, **92 at $10–50K**. Median MRR $2,981. 58% run by one person (of 111 that stated team size). TrustMRR states "over 15,000 startups listed" (https://trustmrr.com/llms.txt) | $10k+ micro-SaaS are a few hundredths of the listed population |
| 9 | RevenueCat, State of Subscription Apps 2026 (115,000+ apps, $16B revenue) — https://www.revenuecat.com/state-of-subscription-apps-2026/ | Newly launched subscription apps, monthly revenue milestones in first 2 years | **17.3% reach $1K, 4.6% reach $10K** monthly revenue within two years. Business category: 14.7% and **1.6%**. For those that get there: median 58 days to $1K, 109 days to $10K. Apps launched in 2025 or later produce 3% of all revenue despite a 7x rise in launches since 2022 | Independent base rate; winners are fast |
| 10 | ChartMogul / Kyle Poyar, "Against the Odds: The 2025 SaaS Growth Report" (2025-10-15; 6,525 companies) — https://chartmogul.com/reports/saas-growth-the-odds-of-making-it/ | Time from first monetisation to $1M ARR | 3.3% reach $1M ARR in under a year, 13.4% within 3 years, 25.1% within 5 years. 2021 cohort: 10.1% within 3 years vs 15% for 2016–2019 cohorts. AI-native startups 3x more likely to hit $1M ARR in 6 months | Odds for serious (metrics-tool-using) startups; later cohorts are not doing better |
| 11 | ChartMogul SaaS Growth Report 2023 — https://chartmogul.com/reports/saas-growth-report/ ; Bootstrapped vs VC report (2024-06-12; 2,500+ companies) — https://chartmogul.com/reports/saas-growth-vc-bootstrapped/ | Growth rates and milestones | Top decile grows **10–17% per month when starting out**; top quartile 5–7%; median 2–2.5%. Median startup takes ~2 years 9 months to $1M ARR; top-quartile bootstrapped reach $1M ARR in 2 years, median bootstrapped in over 3 | What "fast" means in recurring-revenue data |
| 12 | ChartMogul, SaaS Go-To-Market Report (2025-06-11; 2,500 companies) — https://chartmogul.com/reports/saas-go-to-market-report/ | New-business growth for companies under $1M ARR | Median **decline of 24%** in new-business ARR year over year; top performers' growth fell from 116% (Q1 2022) to 59% (Q1 2025) | Early-stage acquisition got harder in 2022–2025 |
| 13 | MicroConf, State of Independent SaaS 2024 (469 founders, data late 2023), figures as quoted on MicroConf pages updated June 2026 — https://microconf.com/founders/0-10k-arr and https://microconf.com/founders/10k-100k-arr | Survey of bootstrapped SaaS | 28% are under $1,000 MRR (largest group); ~30% grow 1–4% month over month and another ~30% are flat or shrinking; companies with $1,000+/month entry plans add ~$1,073 new MRR per month vs ~$316 for those priced $1–9; full-time founders grow ~30% faster | Normal growth is slow; price drives MRR added |
| 14 | Freemius, "Micro-SaaS in 2025" (2025-12-23) — https://freemius.com/blog/state-of-micro-saas-2025/ | Secondary compilation | Cites Rocking Web: ~70% of micro-SaaS under $1,000 MRR, 18% at $1–5K; Freemius platform: 45.7% of its SaaS makers are solo | Consistent with #1–#8 (secondary) |
| 15 | dev.to, "I scraped 4,500 IndieHackers products" (2026-04-14) — https://dev.to/agenthustler/i-scraped-4500-indiehackers-products-heres-what-the-mrr-data-reveals-18ki | **Self-reported** MRR on Indie Hackers profiles | Of 1,544 products that report MRR, 14% claim $10K+ (median ~$750) | Shows self-report inflation: 14% vs 2.4–3.5% verified |
| 16 | Lighter Capital 2025 B2B SaaS Startup Benchmarks (2025-09-10; 155 startups, connected data) — https://www.lightercapital.com/blog/2025-b2b-saas-startup-benchmarks ; SaaS Capital 2026 growth benchmarks — https://www.saas-capital.com/research/private-saas-company-growth-rate-benchmarks/ | Established private B2B SaaS | Median annual revenue growth 28% (2025) vs 47% (2024); bootstrapped median 20% (SaaS Capital, 2025 data) | Even funded-quality companies grow slowly |

Not obtained: the full MicroConf 2024 PDF (gated), Baremetrics Open Benchmarks (page renders data client-side), Paddle/ProfitWell and Acquire.com reports (no reachable primary page found without search). UNKNOWN: any dataset that directly reports "share of bootstrapped SaaS reaching $10k MRR within 12 months of launch".

### 1.3 Turning the evidence into a first-year estimate (INFERENCE)

- Step 1: products aged 6–12 months earning ≥$5k/month in receipts: about 3% (row 3).
- Step 2: receipts overstate subscription MRR. Site-wide, 353 products have fresh MRR > $5k against 513 with 30-day receipts > $5k (ratio 0.69), and 245 have MRR ≥ $8.3k against 353 above $5k (ratio 0.69).
- Step 3: 3% x 0.69 x 0.69 ≈ 1.4% at ≥$8.3k MRR, so roughly **1% at ≥$10k MRR for products 6–12 months old**. The under-12-month MRR ≥ $5k share (1.7–1.8%) gives the same order of magnitude.
- Step 4: RevenueCat's 4.6% within two years, with a median of 109 days for those that arrive, suggests perhaps 3% within one year across all app categories and about 1% for Business apps.

Required growth, for scale: from $500 MRR at the end of month 2, reaching $10k at month 12 needs 35% per month for ten months. From $1,000 at the end of month 3 it needs 29% per month for nine months. A $2,000 launch month still needs 17% per month for ten months.

### 1.4 Biases that cut in both directions

- **Makes the numbers look better than reality:** survivorship (dead products rarely list; TrustMRR is one year old), self-selection (founders with revenue like to show it), stale records concentrated at the top (37 of 390 products above $5k MRR were expired or unsynced and held 37.4% of site MRR — Mifanr), receipts vs MRR (one-time sales are 40.7% of money on the platform), annual prepayments inflating early months.
- **Makes the numbers look worse than this founder's case:** the denominator includes weekend projects, hobby apps and products never marketed; 26% never took a payment; many are consumer utilities at $5–13/month. A founder who sells from week one in a B2B niche is not the median lister.
- **Hidden audiences:** X follower counts are today's values and say nothing about LinkedIn, YouTube, TikTok, newsletters or communities. Several "no audience" winners may have one elsewhere. UNKNOWN per case.
- **Founder-entered dates:** "founded" may be the date of the company, the idea, or the payment account.

<!--NEXT-->
