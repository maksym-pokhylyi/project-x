# B — Base rates, success patterns and funnel benchmarks

Analyst scope: empirical base rates, case set, channel patterns, funnel benchmarks, evidence-driven shortlist.
Research date: **2026-11-13**. "Today" and "as of" refer to that date unless another date is given.

Evidence labels used throughout:

- **FACT** — observed in a cited source (URL + source date given). Vendor benchmark reports are facts about the vendor's dataset, not about the world.
- **INFERENCE** — my reasoning from facts (arithmetic or interpretation).
- **ASSUMPTION** — unverified working premise, chosen so a model can be built; replace when better data arrives.
- **UNKNOWN** — looked for, could not verify.

## 0. Method and limits of this research (read first)

- **Search budget.** The shared `WebSearch` budget for this run (200 calls across all analysts) was exhausted after my 7th search. Everything after that was done by fetching primary pages directly (roughly 200 page requests, about 30 of which failed or were blocked, plus 146 public TrustMRR startup profiles). I did not query search engines by other means. Consequence: coverage is deep where I knew or could navigate to the primary URL, and thin where discovery needed search (founder interviews, Indie Hackers posts, marketplace funnel data, post-mortems).
- **Blocked sources.** `indiehackers.com` (Cloudflare challenge), `bigideasdb.com` (bot checkpoint), `reddit.com`, `wordstream.com`, CRTC and ACMA regulator pages, the FTC CAN-SPAM guide page, and the GitHub repository with the anonymised TrustMRR census data (access not enabled for this session) could not be read. Where I cite them it is via a second source and marked.
- **Main new dataset.** TrustMRR (launched 2025-10-31) connects to payment providers (Stripe, Paddle, RevenueCat, Lemon Squeezy, Polar, Dodo, etc.) and publishes verified revenue. I used (a) its public statistics pages, (b) an independent full census of its API (10,150 products, 2026-09-04), and (c) 146 individual public profiles that I parsed myself (founding date, monthly verified revenue for the last 12 months, MRR, active subscriptions, founder X followers, self-declared channels). TrustMRR is self-selected (founders choose to list) and young; older products joined with outcomes already known.
- **What "verified" means in the case set.** Revenue, MRR and subscription counts are payment-provider data. Founding date, pricing text, team size, target persona and marketing channels are **founder-entered** and unverified. Public profiles show only the last 12 months of monthly revenue, so "time to $10k" is exact only for products whose crossing happened inside that window.

---

## 1. Base rate: how often and how fast do solo/bootstrapped products reach $10k MRR?

### 1.1 Short answer

- **How often.** In verified-revenue data, about **2.4% of listed indie products have MRR of $8.3k or more at any age** (3.5% are above $5k), and about **1% (range 0.7–1.5%) are at $10k while under 12 months old**. For newly launched subscription apps, **4.6% reach $10k monthly revenue within two years** (1.6% in the Business category). Self-reported datasets show shares up to about 6x higher and should not be used.
- **How fast, for the ones that make it.** Winners are fast: in my verified sample of products founded 2024–2026 that are now at ≥$10k MRR, the median time from founding to the first ≥$10k revenue month was **7 months (10 months for B2B)**. But the typical product earning ≥$5k MRR is **18 months old**, and four in ten are older than two years.
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

---

## 2. Case set

### 2.1 How the set was built

- Candidates came from TrustMRR's public listing pages (home leaderboard, 17 category pages, 38 marketing-channel pages, "Micro SaaS examples" and "Micro SaaS ideas"), 727 distinct startups in total. I kept those with listed MRR ≥ $9k and all-time revenue ≤ 24x monthly revenue (a proxy for "young"), dropped anonymous listings, and read 146 public profiles (https://trustmrr.com/startup/{slug}.md, snapshot 2026-11-12/13).
- Inclusion for the tables below: founder-stated founding date 2024-01 or later; verified MRR ≥ $10k now (or ≥ $9k and rising); not marked VC-backed; team ≤ 5 where stated; a software product rather than an agency.
- Consistency check: I dropped profiles whose last-30-day verified receipts were under 40% of the displayed MRR on a freshly synced connection (for example Produce.so shows $27k MRR but $0 received in the last three months). The census author reports 455 such records site-wide.
- "Time to $10k" = founding month to the first calendar month with ≥ $10k **verified revenue** (revenue, not MRR; annual plans and one-time sales pull this earlier). "≤ N mo" means the product was already above $10k/month when the 12-month window opens.
- Audience tag = the founder's X follower count **today**: NO signal (< 1,000), SMALL (1,000–10,000; size at launch unknown), YES (> 10,000). Other platforms are not visible.
- Churn is not public on these profiles. As a substitute I show 30-day MRR change and peak month vs last full month.
- **[STALE]** marks profiles whose payment connection last synced before 2026-10-14; their "MRR now" is the value at last sync.

### 2.2 Table A — B2B and prosumer software (35 verified cases)

| Product (verified profile) | What it does; buyer | Price (founder-stated); ARPA = MRR ÷ active subs | Founded → first month with ≥$10k verified revenue | Verified MRR now; trend | Self-declared channels | Prior-audience tag (founder's X followers today) | Team |
|---|---|---|---|---|---|---|---|
| [Rank Prompt](https://trustmrr.com/startup/rank-prompt) | AI-search (AEO) visibility tracking; marketing teams & agencies | Free first report · No credit card required. Paid plans include Starter (150/mo), Pro (500/m…; ARPA ≈ $206 | 2025-05 → 2026-01 (~8 mo) | $44,839 (218 subs); 30d MRR +2.7%; last full month $54.6k (2026-10) = peak | Blog, Content marketing, Newsletter | NO audience signal (X 47) | n/s |
| [ChatSEO](https://trustmrr.com/startup/chatseo) | AI SEO assistant for Google + ChatGPT ranking; site owners, SEO consultants | Free to start — no credit card required.; ARPA ≈ $45 | 2025-11 → 2026-01 (~2 mo) | $35,591 (794 subs); 30d MRR +11.4%; last full month $47.9k (2026-10) = peak | not declared | SMALL (X 4,790; size at launch unknown) | 2–5 people |
| [Bazzly](https://trustmrr.com/startup/bazzly) | Finds Reddit threads and drafts replies to win customers; solo founders/small teams | $199/month; ARPA ≈ $187 | 2025-06 → 2026-09 (~15 mo) | $38,811 (208 subs); 30d MRR +168.5%; last full month $29.7k (2026-10) = peak | not declared | SMALL (X 7,171; size at launch unknown) | n/s |
| [Traxy.ai](https://trustmrr.com/startup/traxy-ai) | Lead lists from social-media listening; B2B sales teams | Pro: $149/month, Enterprise: Contact Sales; ARPA ≈ $222 | 2026-01 → 2026-06 (~5 mo) | $54,723 (247 subs); 30d MRR +3.2%; last full month $57.6k (2026-10) = peak | not declared | SMALL (X 1,315; size at launch unknown) | 2–5 people |
| [GojiberryAI](https://trustmrr.com/startup/superfruits) | AI GTM agents that find high-intent prospects; B2B founders/sales/agencies | Pro $99/mo for 2 AI agents and up to 1,800 contacted prospects/month; custom pricing for tea…; ARPA ≈ $108 | 2025-07 → already ≥$10k/mo at 2025-11 (≤4 mo) | $424,368 (3,944 subs); 30d MRR -2.4%; last full month $407.8k (2026-07) = peak **[STALE: last synced 2026-08-14]** | not declared | YES audience (X 18,643) | n/s |
| [Prosp](https://trustmrr.com/startup/prosp) | AI LinkedIn outreach automation; agencies and sales teams | $79/per month, $59/per month, $29/per month; ARPA ≈ $116 | 2025-08 → already ≥$10k/mo at 2025-11 (≤3 mo) | $128,005 (1,108 subs); 30d MRR n/a; last full month $98.0k (2026-01) = peak **[STALE: last synced 2026-02-05]** | not declared | SMALL (X 3,245; size at launch unknown) | n/s |
| [LLM Gateway](https://trustmrr.com/startup/llm-gateway) | Open-source API gateway for LLM providers; developers | Free tier included; ARPA ≈ $57 | 2025-05 → 2025-12 (~7 mo) | $78,764 (1,386 subs); 30d MRR +22.5%; last full month $249.9k (2026-08) = peak **[STALE: last synced 2026-09-07]** | not declared | SMALL (X 1,549; size at launch unknown) | n/s |
| [Lancer.app](https://trustmrr.com/startup/lancer-app) | Automates Upwork job applications; freelancers and agencies | n/a; ARPA ≈ $155 | 2025-04 → 2026-03 (~11 mo) | $17,680 (114 subs); 30d MRR -9.9%; peak month $26.7k (2026-09) → last full month $16.0k (2026-10) | not declared | NO audience signal (X 91) | n/s |
| [Xagio](https://trustmrr.com/startup/xagio-inc) | AI SEO plugin/tooling for WordPress; SEO specialists | Free: $0/mo; ARPA ≈ $116 | 2025-05 → 2026-03 (~10 mo) | $14,106 (122 subs); 30d MRR +2.5%; peak month $52.2k (2026-04) → last full month $19.1k (2026-06) **[STALE: last synced 2026-07-15]** | SEO, Facebook | NO audience signal (X 109) | n/s |
| [AI DM Setter](https://trustmrr.com/startup/ai-dm-setter) | AI sales setter for Instagram/WhatsApp DMs; coaches, creators, agencies (sold via 30-min demo) | Fixed monthly subscription, no commitment, no per-message fees. Plans shared on a 30-min demo.; ARPA ≈ $703 | 2025-05 → 2026-01 (~8 mo) | $15,463 (22 subs); 30d MRR -22.3%; peak month $23.1k (2026-09) → last full month $21.9k (2026-10) | SEO, Blog, Content marketing, Instagram, LinkedIn, Meta Ads, Cold DM, Influencers, Partnerships, Word of mouth | NO audience signal (X 0) | 2–5 people |
| [1ClickWebsite](https://trustmrr.com/startup/1clickwebsite-ai) | Generates SEO-optimised WordPress sites; agency owners | Starter: $49/month, Professional: $97/month, Expert: $197/month; ARPA ≈ $33 | 2025-06 → 2026-06 (~12 mo) | $14,027 (428 subs); 30d MRR -0.5%; last full month $15.7k (2026-10) = peak | not declared | NO audience signal (X 160) | 1 person |
| [LocalProspects.ai](https://trustmrr.com/startup/localprospects-ai) | Local-business lead lists + outreach; (same founder as 1ClickWebsite) | Starter: $29/mo, Agency: $79/mo, Scale: $229/mo; ARPA ≈ $43 | 2026-02 → 2026-09 (~7 mo) | $9,401 (218 subs); 30d MRR +11.1%; peak month $10.4k (2026-09) → last full month $8.9k (2026-10) | not declared | NO audience signal (X 160) | n/s |
| [AutoContent API](https://trustmrr.com/startup/autocontent-api) | API for automated content (podcasts/video/text); developers, content businesses | Amateur: $33/mo, Professional: $66/mo, Business: $124/mo; ARPA ≈ $117 | 2024-10 → 2025-12 (~14 mo) | $17,036 (145 subs); 30d MRR +0.4%; last full month $16.9k (2026-06) = peak **[STALE: last synced 2026-07-09]** | not declared | NO audience signal (X 230) | n/s |
| [Orshot](https://trustmrr.com/startup/orshot-com) | Image/creative generation API + automation; agencies, brands, developers | Free: $0/mo, Launch: $39/mo, Grow: $160/mo, Scale: $349/mo, Social Publishing: $12/mo per so…; ARPA ≈ $57 | 2025-03 → 2026-10 (~19 mo) | $12,774 (223 subs); 30d MRR +45.2%; last full month $11.5k (2026-10) = peak | not declared | SMALL (X 7,541; size at launch unknown) | n/s |
| [Kolbo.AI](https://trustmrr.com/startup/kolbo-ai) | All-in-one AI creative workspace (100+ models); creators, marketers, agencies | Free plan; Lite $27/mo, Standard $45/mo, Pro $89/mo; up to 37% off annual; credit packs from…; ARPA ≈ $64 | 2025-01 → 2026-02 (~13 mo) | $46,982 (732 subs); 30d MRR +44.4%; last full month $91.8k (2026-10) = peak | Blog, Content marketing, SEO, Instagram, LinkedIn, YouTube, TikTok, X / Twitter, Affiliate | NO audience signal (X 359) | n/s |
| [SoldComps](https://trustmrr.com/startup/soldcomps) | eBay sold-comps data API; resellers, developers, analysts | Free: $0/mo, Starter: $9/mo, Growth: $29/mo, Scale: $79/mo, High-volume plans available; ARPA ≈ $45 | 2025-03 → 2026-08 (~17 mo from stated founding; first revenue was 2026-04, so ~4 mo from first sale) | $26,178 (587 subs); 30d MRR +21.4%; last full month $25.8k (2026-10) = peak | not declared | NO audience signal (X 0) | n/s |
| [Glossa.live](https://trustmrr.com/startup/glossa-live) | Real-time AI translation for church services/events; churches | Pay As You Go: $5/hour/language, Standard: $99/month, Advanced: $299/month, Premium: $499/month; ARPA ≈ $144 | 2025-06 → 2026-03 (~9 mo) | $14,404 (100 subs); 30d MRR +16.0%; peak month $31.8k (2026-09) → last full month $20.2k (2026-10) | Content marketing, SEO | NO audience signal (X 107) | n/s |
| [Pushouse](https://trustmrr.com/startup/pushouse) | WhatsApp automation for e-commerce; online stores | n/a; ARPA ≈ $108 | 2026-01 → 2026-02 (~1 mo) | $29,661 (274 subs); 30d MRR +9.4%; peak month $43.2k (2026-08) → last full month $37.6k (2026-10) | Instagram, LinkedIn, Meta Ads, Google Ads, YouTube Ads, Cold calling, Cold email, Events & conferences, Par… | NO audience signal (X 0) | n/s |
| [CreativeClaw](https://trustmrr.com/startup/creativeclaw) | MCP "creative studio" giving Claude/agents image-video-audio models; creative teams | $10 = 1,000 credits; ARPA ≈ $54 | 2026-04 → 2026-09 (~5 mo) | $14,720 (274 subs); 30d MRR +39.7%; last full month $110.9k (2026-10) = peak | not declared | NO audience signal (X 448) | 1 person |
| [Notis](https://trustmrr.com/startup/notis-ai) | AI "intern" via messaging (notes, CRM updates, drafts); solo founders/operators | Free: $0 forever, Pro: $13 per month billed yearly, Pro+: $39 per month billed yearly, ULTRA…; ARPA ≈ $31 | 2024-09 → 2026-01 (~16 mo) | $13,259 (430 subs); 30d MRR -1.6%; peak month $39.4k (2026-03) → last full month $9.9k (2026-10) | X / Twitter, YouTube, Google Ads, LinkedIn Ads, Meta Ads, X Ads, YouTube Ads, Cold email, Email marketing, … | SMALL (X 1,993; size at launch unknown) | 1 person |
| [Podawaa](https://trustmrr.com/startup/podawaa) | LinkedIn content scheduling/engagement; professionals and teams | Community Free, Scale €59/mo, Accelerate €89/mo, Dominate €159/mo; ARPA ≈ $105 | 2024-06 → already ≥$10k/mo at 2025-12 (≤18 mo) | $61,668 (588 subs); 30d MRR -6.9%; peak month $72.4k (2026-08) → last full month $58.7k (2026-10) | not declared | SMALL (X 2,331; size at launch unknown) | n/s |
| [Postiz](https://trustmrr.com/startup/postiz) | Open-source "agentic" social media scheduler; social managers, developers | Plans start at $29/month with a 7-day trial for $0.; ARPA ≈ $34 | 2024-07 → already ≥$10k/mo at 2025-12 (≤17 mo) | $408,836 (12,040 subs); 30d MRR +53.8%; last full month $387.1k (2026-10) = peak | not declared | YES audience (X 26,955) | n/s |
| [DataFast](https://trustmrr.com/startup/datafast) | Revenue-attribution web analytics; founders/marketers | 14-day free trial. No card required. Then starts at $9/month; ARPA ≈ $21 | 2024-07 → already ≥$10k/mo at 2025-12 (≤17 mo) | $28,191 (1,334 subs); 30d MRR -5.9%; peak month $31.5k (2026-09) → last full month $31.2k (2026-10) | SEO, Word of mouth, X / Twitter, YouTube, Newsletter, Content marketing, LinkedIn, Reddit | YES audience (X 423,533) | 1 person |
| [Post Bridge](https://trustmrr.com/startup/post-bridge) | Cross-posting to many social platforms; solo marketers | Marketer: $39/month, Operator: $99/month; ARPA ≈ $30 | 2024-09 → already ≥$10k/mo at 2025-12 (≤15 mo) | $49,393 (1,630 subs); 30d MRR -0.1%; peak month $51.9k (2026-09) → last full month $48.3k (2026-10) | not declared | YES audience (X 187,191) | n/s |
| [Heyron](https://trustmrr.com/startup/heyron) | Hosted AI agent + community for one-person companies; indie founders | $49/month; ARPA ≈ $29 | 2026-02 → already ≥$10k/mo at 2026-03 (≤1 mo) | $17,269 (597 subs); 30d MRR -11.2%; peak month $62.9k (2026-04) → last full month $18.1k (2026-10) | Blog, Content marketing, SEO, Instagram, Facebook, TikTok, YouTube, Discord, Forums, Affiliate, Podcast, Re… | NO audience signal (X 34) | 1 person |
| [Sleek](https://trustmrr.com/startup/sleek) | AI mobile-app design generator; founders, PMs, developers | Free: 1 project, Paid plans: unlimited projects, more AI credits, and team features.; ARPA ≈ $34 | 2026-03 → ≥$10k in its first month (2026-03) | $17,690 (523 subs); 30d MRR -13.7%; peak month $32.4k (2026-04) → last full month $16.7k (2026-10) | Blog, SEO, Pinterest, Reddit, X / Twitter, YouTube, Affiliate, Product Hunt, Word of mouth | SMALL (X 1,550; size at launch unknown) | n/s |
| [SuperbulletAI](https://trustmrr.com/startup/superbullet-llc) | AI game-creation tools for Roblox; Roblox developers | n/a; ARPA ≈ $20 | 2025-12 → 2026-03 (~3 mo) | $11,936 (603 subs); 30d MRR -0.7%; last full month $19.4k (2026-10) = peak | not declared | SMALL (X 1,912; size at launch unknown) | n/s |
| [MausBot](https://trustmrr.com/startup/mausbot) | Open-source team of AI computer-use bots; solo operators and teams | Individuals: Free, Personal $15/mo, Pro $49/mo, Max $89/mo (launch prices). Teams: starts $1…; ARPA ≈ $44 | 2026-08 → MRR ≥$10k by 2026-11 (monthly revenue not yet ≥$10k) | $13,306 (305 subs); 30d MRR +495.3%; last full month $5.5k (2026-10) = peak | SEO, LinkedIn, Instagram, Reddit, X / Twitter, Discord, Blog, App store optimization | SMALL (X 1,390; size at launch unknown) | 2–5 people |
| [Sonder](https://trustmrr.com/startup/sonder) | AI videos to market books; authors | $49/month, $99/month, $209/month; ARPA ≈ $108 | 2026-09 → ≥$10k in its first month (2026-09) | $14,728 (137 subs); 30d MRR -32.9%; last full month $15.4k (2026-10) = peak | not declared | NO audience signal (X 0) | 2–5 people |
| [LocalRank.so](https://trustmrr.com/startup/localrank-so) | AI local-SEO software; local SEO agencies | Starter: $57/mo, Pro: $297/mo, Scale: $497/mo, Enterprise: $2997/mo; ARPA ≈ $99 | 2025-02 → already ≥$10k/mo at 2025-12 (≤10 mo) | $18,141 (183 subs); 30d MRR -11.8%; peak month $44.1k (2025-12) → last full month $18.2k (2026-10) | not declared | YES audience (X 63,241) | n/s |
| [SuperX](https://trustmrr.com/startup/superx) | Audience growth analytics for X; creators, founders | Pro: $49/month, Advanced: $49/month launch price (list $99), Ultra: $199/month; ARPA ≈ $42 | 2025-08 → already ≥$10k/mo at 2025-12 (≤4 mo) | $18,237 (433 subs); 30d MRR -18.0%; peak month $30.4k (2026-02) → last full month $19.4k (2026-10) | not declared | YES audience (X 68,353) | n/s |
| [StoryShort](https://trustmrr.com/startup/storyshort) | AI short-video generation; TikTok/YouTube creators | Starter: $39, Growth: $69, Influencer: $129, Ultra: $199; ARPA ≈ $58 | 2024-08 → already ≥$10k/mo at 2025-12 (≤16 mo) | $21,465 (368 subs); 30d MRR +19.2%; peak month $44.5k (2026-01) → last full month $22.2k (2026-10) | not declared | YES audience (X 13,002) | n/s |
| [AE-intelligence (Humanize AI Text)](https://trustmrr.com/startup/ae-intelligence) | Rewrites AI text to pass detectors; writers, students, marketers | Free: Unlimited words; ARPA ≈ $26 | 2024-06 → already ≥$10k/mo at 2025-12 (≤18 mo) | $28,984 (1,116 subs); 30d MRR +4.6%; peak month $32.6k (2025-12) → last full month $27.9k (2026-10) | not declared | NO audience signal (X 197) | n/s |
| [WriteStack](https://trustmrr.com/startup/writestack) | Tools for Substack writers | n/a; ARPA ≈ $27 | 2024-07 → 2026-01 (~18 mo) | $14,102 (523 subs); 30d MRR +7.7%; peak month $19.6k (2026-01) → last full month $14.9k (2026-10) | not declared | unknown | n/s |
| [Voicy](https://trustmrr.com/startup/voicy) | Speech-to-text dictation (desktop, extension, mobile); older users/people with disabilities, teams | Free trial: $0/mo, Pro: $8.49/mo, Lifetime: $260 one-time payment, Team Plan: $6.79/user/mo; ARPA ≈ $8 | Profile says founded 2025-11, but the founder says he launched about two years ago (see 2.5); already ≥$10k/mo at 2025-12, so time to $10k is unknown and at most about 24 mo | $12,555 (1,555 subs); 30d MRR +2.8%; peak month $22.1k (2026-04) → last full month $19.9k (2026-10) | SEO, YouTube | SMALL (X 2,487; size at launch unknown) | n/s |

One more verified case sits just outside the 18-month window and is useful as the slow path: [Juiced Leads](https://trustmrr.com/startup/juiced-leads-llc) (lead-distribution platform for lead-gen agencies, 13 subscriptions at about $788 ARPA) took about 31 months from founding to its first $10k month.

### 2.3 Table B — consumer apps and consumer subscriptions (16 verified cases)

Included because they are the other half of what actually reaches $10k fast. Most monetise through app stores (RevenueCat-verified) and paid social.

| Product (verified profile) | What it does | Founded → first ≥$10k revenue month | Verified MRR now | Self-declared channels | Prior-audience tag | Team |
|---|---|---|---|---|---|---|
| [TrackAI](https://trustmrr.com/startup/trackai) | AI calorie tracker (targets Ukraine and nearby markets) | 2025-06 → 2025-12 (~6 mo) | $19,437 (5,160 subs) | Meta Ads | NO audience signal (X 92) | n/s |
| [Flipify](https://trustmrr.com/startup/flipify) | Deal alerts on Facebook Marketplace/eBay/Craigslist for resellers | 2024-10 → 2026-04 (~18 mo) | $18,655 (690 subs) | App store optimization, Content marketing | NO audience signal (X 53) | n/s |
| [PeptIQ](https://trustmrr.com/startup/peptiq) | Peptide protocol/dose tracking app | 2026-01 → 2026-04 (~3 mo) | $14,733 (1,489 subs) | App store optimization, Blog, Content marketing, Newsletter, SEO, Instagram, Facebook, TikTok, X / Twitter,… | SMALL (X 2,232; size at launch unknown) | 1 person |
| [Natively](https://trustmrr.com/startup/natively-ai) | Real-time AI copilot for interviews/meetings | 2026-03 → 2026-06 (~3 mo) | $10,180 (835 subs) | SEO, Content marketing, Blog, Reddit, YouTube, X / Twitter | NO audience signal (X 51) | 1 person |
| [imposter.ai](https://trustmrr.com/startup/imposter-ai) | Social-deduction party game app | 2025-12 → 2026-01 (~1 mo) | $20,663 (5,552 subs) | Content marketing, Instagram, TikTok, App store optimization, SEO | NO audience signal (X 407) | n/s |
| [Boothie](https://trustmrr.com/startup/boothie) | AI photo-look app | 2026-06 → 2026-07 (~1 mo) | $52,890 (2,266 subs) | TikTok | NO audience signal (X 64) | n/s |
| [Brawler](https://trustmrr.com/startup/brawler) | AI boxing coach app | 2026-05 → 2026-06 (~1 mo) | $26,241 (5,010 subs) | Meta Ads, Influencers | NO audience signal (X 0) | n/s |
| [AbMaxx](https://trustmrr.com/startup/abmaxx) | AI abs-analysis fitness app | 2026-03 → 2026-07 (~4 mo) | $22,013 (6,145 subs) | Instagram, TikTok, Meta Ads | SMALL (X 6,841; size at launch unknown) | n/s |
| [Verbi](https://trustmrr.com/startup/verbi) | Language speaking-practice app | 2026-04 → 2026-07 (~3 mo) | $24,100 (5,066 subs) | not declared | SMALL (X 1,542; size at launch unknown) | 2–5 people |
| [Speak Silq](https://trustmrr.com/startup/speak-silq) | "Duolingo for Central Asian languages" | 2026-03 → 2026-04 (~1 mo) | $16,601 (1,425 subs) | not declared | SMALL (X 3,416; size at launch unknown) | n/s |
| [Store Stock Checker](https://trustmrr.com/startup/store-stock-checker) | Real-time Apple Store stock alerts | 2026-10 → ≥$10k in its first month (2026-10) | $33,136 (4,353 subs) | SEO, Reddit, X / Twitter, Email marketing, Product Hunt, Press & PR, Referral program | NO audience signal (X 199) | 1 person |
| [Monkei](https://trustmrr.com/startup/monkei) | Platform for modded Nintendo Switch players | 2025-03 → 2026-04 (~13 mo) | $24,369 (4,087 subs) | SEO, Discord, Affiliate, Referral program | NO audience signal (X 204) | 2–5 people |
| [PolyPick](https://trustmrr.com/startup/polypick) | AI analysis for prediction markets | 2026-05 → 2026-06 (~1 mo) | $11,214 (287 subs) **[STALE: last synced 2026-09-07]** | Content marketing, SEO, Facebook, TikTok, YouTube, Instagram, Email marketing, Influencers, Affiliate, Part… | NO audience signal (X 0) | n/s |
| [FreeTCF](https://trustmrr.com/startup/freetcf) | TCF (French test) preparation | 2025-07 → 2026-02 (~7 mo) | $22,686 (1,156 subs) | not declared | NO audience signal (X 58) | n/s |
| [GETebook.ai](https://trustmrr.com/startup/getebook-ai) | AI ebook generator for creators | 2025-07 → 2026-07 (~12 mo) | $11,682 (244 subs) | Blog, SEO, Facebook, Instagram, TikTok, Google Ads, Meta Ads, TikTok Ads, Email marketing | SMALL (X 2,805; size at launch unknown) | 1 person |
| [Cosmo](https://trustmrr.com/startup/cosmo) | Commerce platform inside Discord; server owners | 2025-11 → 2026-06 (~7 mo) | $15,400 (42 subs) | Blog, Content marketing, SEO, YouTube, X / Twitter, TikTok, Facebook, Meta Ads, Cold DM, Discord, Affiliate… | NO audience signal (X 364) | 1 person |

### 2.4 What the verified cohort looks like (my computation; n = 69 profiles meeting the inclusion rule and the consistency check, 7 of them stale)

- FACT — **Split:** 27 B2B, 27 B2C, 11 both, 4 unstated.
- FACT — **Audience:** 38 of 69 founders (55%) have fewer than 1,000 X followers today; 19 (28%) have 1,000–10,000; 10 (14%) have more than 10,000; 2 unknown. Among the 27 B2B products, 11 founders are under 1,000.
- FACT — **Speed (n = 38 with the crossing visible):** median 7 months from founding to the first ≥$10k month; 17 of 38 within 6 months, 28 within 12, 36 within 18. B2B only (n = 15): median 10 months, range 1–31.
- FACT — **Price:** median ARPA (MRR ÷ active subscriptions) is $116/month for B2B, $27 for B2C, $31 for "both".
- FACT — **Self-declared channels (34 of 69 declared any):** SEO 59%, content marketing 41%, X 38%, TikTok 38%, Instagram 35%, YouTube 35%, blog 32%, Meta Ads 29%, affiliate 26%, LinkedIn 24%, Reddit 24%, email marketing 21%, Google Ads 18%, partnerships 18%, word of mouth 18%, referral programme 18%, influencers 15%, app-store optimisation 12%, Discord 12%, **cold email 9%, cold DM 9%**, Product Hunt 6%.
- FACT — **Fragility:** 36% had negative MRR growth in the last 30 days (median +2.5%). For 30% the last full month's revenue is below 70% of their best month; for 14% it is below half (n = 64 with at least four full months).
- INFERENCE — A large X audience is not a precondition (most winners lack one), but declared channels are almost all one-to-many. Very few winners credit cold outbound. Either outbound rarely produces fast winners, or founders do not think of it as a "marketing channel" when filling in a profile. UNKNOWN which.

### 2.5 Documented narratives (Starter Story video case studies, October 2026)

| Case | Facts from the interview | Audience | Source |
|---|---|---|---|
| Voicy (speech-to-text) | Launched about two years ago as a Chrome extension built for the founder's father; first users arrived "without any marketing" through the extension store; later desktop and mobile apps and SEO; about $11K MRR plus lifetime deals (monthly revenue $16–20K); 1,400 active subscriptions; run alongside a full-time job; serves older users and people with disabilities (20% on a disability discount) | Not audience-led | https://www.starterstory.com/stories/i-built-this-app-for-my-dad-now-it-makes-18k-month (2026-10-14); verified at https://trustmrr.com/startup/voicy |
| Canary (learn languages with songs) | First app by a non-developer; launched about nine months before the interview; about $25K in the last month, MRR about $14K; growth through Instagram Reels and TikTok | **YES — the founder is a content creator; the interview discusses his existing following** | https://www.starterstory.com/stories/i-turned-a-viral-idea-into-a-25k-month-app (2026-10) |
| Encrypted photo-vault iOS app | First iOS app, built in about three weeks with coding agents; $66 in month one, $41K in a month about six months later; growth from App Store search and daily SEO articles, no paid ads | Not audience-led per the interview | https://www.starterstory.com/stories/this-app-is-making-2-000-per-day (2026-10) |
| Liinks (link-in-bio) | About $31.5K MRR at $5/month; grown for years as a side project, founder went full-time in August 2024 | n/a — older than 2024, shown as the slow, low-price path | https://www.starterstory.com/stories/how-i-built-it-30k-month-micro-saas (2026-10-21) |

Starter Story is an edited, sponsor-supported format; revenue is shown on screen but not independently verified except where a TrustMRR profile exists.

### 2.6 Contrast set — failures, stalls and decay

| Case | What happened (FACT from the source) | Lesson (INFERENCE) | Source |
|---|---|---|---|
| MakerPulse — revenue dashboard for indie makers, $19/month | Built in 4 weeks; Product Hunt launch got 3 upvotes (one the founder's) and $0 revenue; author: "The launch had no audience pre-built" | Launch platforms do not supply demand to unknown makers | https://dev.to/ykiki/4-weeks-1-saas-3-upvotes-an-honest-product-hunt-postmortem-53h6 (2026-05-01) |
| Voice-enabled forms, $199 lifetime deal | 22 days, 0 sales; first 14 days went into funnels and email sequences with "nowhere to point traffic from" | Funnel work before a traffic source is wasted | https://dev.to/adarsh_kant_ebb2fde1d0c6b/i-built-voice-enabled-forms-in-50-languages-22-days-at-199-lifetime-0-sales-post-mortem-5f95 (2026-04-28) |
| SaaS built in 9 days for $200 of AI tooling | Hacker News launch three days before Christmas: zero signups; author: "I can ship a working SaaS in 9 days for $200, but I can't make anyone care about it" | Build speed is no longer the constraint | https://dev.to/jackb_builds/i-built-a-saas-in-9-days-for-200-launched-on-hn-to-zero-signups-heres-what-i-learned-16m2 (2025-12-27) |
| White-label support platform for SaaS founders | 6 months of building; one week after launch 25 signups, 0 paying; 25k LinkedIn views produced no calls; author: "Broadcast ≠ sales" | Posting is not selling; signups without conversations do not convert | https://dev.to/elvin_chauvel/1-week-post-launch-25-signups-0-sales-heres-what-i-got-wrong-and-what-im-changing-1dio (2026-03-21) |
| Revive — Stripe failed-payment recovery, $99/month | Built in public, $0 revenue at time of writing; positioned under Churnkey and Stunning ($300–500+/month per the author) | "Cheaper clone of a funded tool" needs its own distribution | https://dev.to/tahseen_rahman/i-built-a-stripe-churn-recovery-tool-in-public-0-revenue-so-far-heres-the-full-story-3dao (2026-02-17) |
| QuickTools.one — free browser tools aimed at SEO | 11 tools in 4 weeks; 675 unique visitors in week 4; $0 revenue (not monetised) | Utility traffic arrives quickly but carries no willingness to pay | https://dev.to/eduard_albu/building-boring-tools-that-rank-4-weeks-11-tools-and-a-plot-twist-with-chatgpt-304 (2025-12-11) |
| Hirevire — async video interviews, $49–249/month | Founded 2021-12; first ≥$10k revenue month 2026-02, about 50 months later | A sound B2B tool without a channel takes years | https://trustmrr.com/startup/hirevire |
| Notis, Heyron, Sleek, Xagio (all in Table A) | Peak month to last full month: Notis $39.4k → $9.9k; Heyron $62.9k → $18.1k; Sleek $32.4k → $16.7k; Xagio $52.2k (2026-04) → $19.1k (2026-06, stale afterwards) | Launch spikes and hype categories decay within months | TrustMRR profiles in Table A |
| LocalRank.so — local-SEO software | $44.1k (2025-12) → $18.2k (2026-10) although the founder has 63k X followers | An audience buys a fast start, not retention | https://trustmrr.com/startup/localrank-so |
| TrustMRR population | 2,417 of 10,150 products (23.8%) earned before but took nothing in the last 30 days; 64% of those were 6–24 months old | The dangerous period is after the first dollar | https://mifanr.com/en/posts/trustmrr-census/ (2026-09-05) |

---

## 3. Patterns

### 3.1 Which product categories recur among fast growers

Counting the 35 products in Table A (FACT = membership in the table; grouping is mine; a product can sit in two clusters):

| Cluster | Cases in Table A | Typical price | Notes |
|---|---|---|---|
| "Get me customers": lead finding, intent signals, outreach, DM sales agents | GojiberryAI, Prosp, Traxy.ai, Bazzly, LocalProspects.ai, AI DM Setter, Lancer.app, Pushouse (8) | $99–$700/month | Largest B2B cluster; buyer measures ROI in deals; several depend on LinkedIn, Reddit, Upwork, Instagram or WhatsApp terms |
| AI-search visibility and SEO automation | Rank Prompt, ChatSEO, Xagio, LocalRank.so, 1ClickWebsite (5); older but large: AEO Engine ($188k MRR), SEOBOT, Backlinker AI | $45–$500/month | New keyword space since 2025; agencies are heavy buyers |
| Content creation and scheduling for creators and marketers | Postiz, Post Bridge, Podawaa, Kolbo.AI, StoryShort, Sonder, SuperX, WriteStack, AutoContent API, Orshot (10) | $9–$500/month | The cluster where founders most often have an audience (Post Bridge 187k, SuperX 68k, Postiz 27k, StoryShort 13k X followers) |
| APIs, infrastructure and tools for AI agents | LLM Gateway, CreativeClaw, MausBot, SoldComps, AutoContent API, Orshot | usage or credits, $9–$349/month | Founders mostly without audience; discovery through developer search, docs and assistants |
| Narrow vertical with an underserved buyer | Glossa.live (churches), SuperbulletAI (Roblox developers), Voicy (accessibility), Lancer.app (Upwork agencies) | $8–$499/month | Outside the date window the same shape appears at larger size: Kibu (care providers, $234k MRR at last sync in April 2026), Khosmos (French construction artisans, 875 subscriptions), Conductor (QuickBooks Desktop API, $49k MRR) |
| Consumer AI apps through paid social and app stores | Table B | $5–$40/month, weekly and annual plans | Fastest ramps of all (1–4 months) and the weakest retention |

What is missing is as informative (INFERENCE from FACT): horizontal productivity and utility tools (5 of 894 such products exceed $5k MRR in the census), generic chat front-ends, and "cheaper version of a funded SaaS" dashboards (see 2.6).

Shared traits of the B2B winners (INFERENCE):

1. The product sits on the buyer's revenue line (leads, traffic, visibility, content output), so the purchase is justified by one extra deal.
2. It rides a shift less than about 18 months old (AI-search answers, agents and MCP, Reddit as a source for assistant answers), where incumbents had no product and search demand was new.
3. Price is high enough for few customers to matter: median ARPA $116; $10k MRR is 50–100 accounts.
4. The highest-ARPA cases are partly services (AI DM Setter sold through a 30-minute demo; uhoh.com IT help desk from $3k/month; a "Reddit agency" at about $5k per client). That route conflicts with the "no per-client manual service" constraint.
5. Revenue is volatile: more than a third are shrinking month over month.

### 3.2 Channel mechanics for a founder without an audience

| Channel | Evidence | Verdict for a no-audience solo founder |
|---|---|---|
| App marketplaces and app stores | FACT: 4.6% of new subscription apps reach $10k monthly revenue within 2 years; median 109 days for those that do (RevenueCat 2026). Mobile Apps is the best large TrustMRR category (8.0% above $5k MRR). Voicy's first users came from the Chrome extension store with no marketing. | The only channel that brings strangers with intent to a new product on day one. Approval and ranking mechanics matter more than audience. Covered in depth by another analyst. |
| SEO, tool pages, programmatic SEO | FACT: most-declared channel (59% of young winners that declared channels; 2,172 TrustMRR startups). Only 1.74% of new pages reach the top 10 within a year (Ahrefs, 2025-05-15). AI Overviews cut position-1 click-through by about 58% where they appear (Ahrefs, 2026-02-04). Free-tool pages can get impressions within 2 weeks (dev.to cases) but with no purchase intent. | Works as a compounding channel from month 4–12, fastest when the keyword cluster is new. It will not produce the first 10 customers. |
| Cold email | FACT: declared by 9% of young winners and by 314 of 15,000+ TrustMRR startups. Benchmarks in section 4a: about 3% of prospects reply, well under 1% book a meeting. | Viable for the first 10 customers when ARPA ≥ about $150 and the list is narrow (under 50 contacts per segment). INFERENCE: at base rates about 1 customer per 1,000 prospects, so it cannot carry a $50 product. |
| LinkedIn (manual or assisted) | FACT: about 100 invitations per week per account; 26–28.5% accepted; 0.24% of invited prospects booked a meeting in Belkins' own 2025 campaigns. Decision makers say they prefer LinkedIn to email for outreach, 50.5% vs 25% (Hunter 2026 survey). | Good for 20–40 conversations in the first month in a B2B niche; hard cap on scale; automation violates LinkedIn's terms. |
| Communities (Reddit, Discord, Facebook groups, forums) | FACT: Reddit declared by 24% of young winners; Wikipedia, YouTube and Reddit are the most-cited sources in Google AI summaries (Pew, 2025-07-22). Failure cases show that broadcasting launch posts yields nothing. | Works when the founder answers real questions in a niche community for weeks; doubles as input to AI answers. Self-promotion bans are a real limit. |
| Paid social (Meta, TikTok) | FACT: the dominant channel in Table B (TrackAI, Brawler, AbMaxx, DailyGlowUp at "2–3x ROAS" per its listing). | Fits consumer apps with weekly or annual plans and fast payback; needs creative volume and cash. Poor fit for B2B at $50–$200. |
| Google Ads | FACT: average search CPC $5.42, Business Services $5.87, cost per lead $93.69 (LocaliQ 2026); 29–57% of bootstrapped founders running ads wait 7+ months for a return or cannot tell (MicroConf 2024; the two citations of this figure disagree). | Only with ARPA ≥ about $200 and a card-required trial; otherwise payback exceeds a year (section 4f). |
| Launch sites and directories (Product Hunt, Hacker News, AI directories) | FACT: Product Hunt declared by 6% of young winners; three post-mortems in 2.6 report zero sales from such launches. | Not a customer channel for unknown makers. Useful for a few backlinks and assistant citations. |
| Affiliates, integrations, partnerships | FACT: affiliates declared by 26% of young winners (Kolbo.AI, Heyron, Sleek, Monkei, Cosmo, PeptIQ); 47% of surveyed bootstrapped founders call integrations, partnerships and communities their more dependable growth source (MicroConf survey as cited by Freemius, 2025-12-23). | "Rent an audience": pay creators or adjacent tools 20–40% recurring. Works once the product converts; slow to set up for B2B. |
| AI assistants (ChatGPT, Perplexity, Gemini, Claude) | FACT: 0.17% of the average site's traffic in early 2025 (Ahrefs, 3,000 sites); visitors convert 4.4x (Semrush) to 23x (Ahrefs's own site, 12.1% of signups from 0.5% of visits, 2025-06-16) better than search visitors; pages cited by ChatGPT rank at position 21 or lower for the same query almost 90% of the time (Semrush). | Small but high-intent, and reachable by a new domain because citation does not require a top-10 ranking. Treat as a bonus on top of docs, comparison pages and community answers; volume for 2026 is UNKNOWN. |

### 3.3 What changed in 2025–2026

| Change | Evidence | Consequence |
|---|---|---|
| Building is nearly free, so supply exploded | FACT: 7x rise in subscription app launches since 2022, yet apps launched in 2025+ earn 3% of revenue (RevenueCat 2026). 26% of TrustMRR products never earned anything. Later SaaS cohorts are no likelier to reach $1M ARR (ChartMogul 2025). New-business ARR for companies under $1M ARR fell 24% year over year at the median (ChartMogul GTM report, Q1 2025). | A 1-day build is not an advantage. Distribution and a specific buyer are the scarce parts. |
| Assistants absorb thin wrappers | FACT: Productivity and Utilities have the lowest hit rates in the census (0.6%, 0.5%). AI apps earn 41% more per customer but churn 30% faster (RevenueCat 2026). Decay cases in 2.6. INFERENCE: a feature a general assistant can do in one prompt does not hold a subscription. | Prefer products that need accounts, data, scheduling, monitoring or integrations that a chat window lacks. |
| Google's AI Overviews and stricter spam policy | FACT: AI Overviews on 6.5% of queries in January 2025, 24.6% in July, 15.7% in November; informational share of AI Overview keywords fell from 91% to 57% while transactional rose from 2% to 14% (Semrush). Organic click-through on queries without AI Overviews also fell 41% from mid-2024 to September 2025 (Seer). Google's March 2024 policies target "scaled content abuse". | Informational content marketing lost most of its yield. Bottom-of-funnel and tool pages keep some. Mass AI-generated pages risk de-indexing. |
| Mailbox-provider rules for bulk senders | FACT: Gmail and Yahoo since February 2024 require SPF, DKIM, DMARC, one-click unsubscribe and a spam rate under 0.3% from senders of 5,000+ messages a day; Gmail began temporary and permanent rejections in November 2025; Outlook.com applied equivalent authentication rules from 5 May 2025. Gmail's rules apply to personal Gmail accounts, not to Google Workspace recipients. | Low-volume, authenticated, well-targeted B2B sending is unaffected by the letter of the rules, but filtering is tighter and reply rates fell (Woodpecker reports the platform-wide average dropping from 5.1% in 2024 to 3.43% in 2026; Belkins saw H2 2025 20% below H1). |
| Buyers resent AI-written outreach | FACT: 69% of surveyed decision makers say it bothers them if AI wrote the email; AI personalisation lowered LinkedIn acceptance by 12% within the same accounts (Hunter 2026; Expandi H2 2026). | Use AI for research and list building, write the message by hand. |
| Platform and payment policy | FACT: Shopify keeps 0% revenue share only on the first $1M of **lifetime** app revenue earned from 2025-01-01 (previously an annual reset), then 15%. Paddle's acceptable-use policy (updated 2026-04-13) prohibits "Automated Social Media Marketing", "Mass Marketing Products" including message-app marketing, telemarketing, and products that enable infringement of another party's terms and conditions. | For a founder who must use a merchant of record, several of the fastest-growing clusters in 3.1 (LinkedIn automation, Reddit auto-posting, WhatsApp marketing, marketplace bots) may be unsellable through Paddle. This is a hard filter on the shortlist. Policies of other merchants of record: UNKNOWN. |
| New demand created by the same shifts | FACT: AI-visibility tools (Rank Prompt, ChatSEO, AEO Engine), agent tooling (CreativeClaw from $30 to $93k in monthly revenue between April and September 2026), tools "built for AI agents" (PostEverywhere, OpenTweet). | New categories open and close within about a year; early entrants without audiences did win. |

---

## 4. Benchmarks for bottom-up modelling

How to read the tables: "FACT" columns quote the source. The low/base/high columns are my modelling values (ASSUMPTION anchored on the facts), set for an **unknown solo vendor**, so base is at or below the published median.

### 4a. Cold email to SMB and B2B buyers (2025–2026)

| Metric | Published figures (FACT) | Low | Base | High |
|---|---|---|---|---|
| Bounce rate | Hunter 2026 (31M emails sent in 2025): average 3.6%; verified lists should stay under 2% | 5% | 2.5% | 1% |
| Reaching the inbox | Hunter: average open rate 30%, "reflects deliverability issues"; Martal 2026 cites a third-party figure that about 17% of cold emails never reach the inbox (secondary, method unknown) | 70% | 83% | 92% |
| Reply rate per prospect over a sequence (any reply) | Hunter 2026: 4.5% all sequences, **3% for sales sequences**; Instantly 2026 (updated 2026-01-12): average 3.43%, top quartile 5.5%, top decile 10.7%; Belkins 2026 (7.5M emails in 2025): **0.45% per email sent**, 0.57% to founders and owners, 0.72% to companies of 1–10 people | 1.5% | 3% | 6% |
| Share of replies that are positive | Saleshandy (2026-10-07; 30M emails): 25–50% in the strongest campaigns; Digital Bloom (2025-11-10): 48–65% by hook type | 20% | 33% | 45% |
| Meetings booked per 100 prospects contacted | Digital Bloom: 0.69 (baseline "problem" hook) to 2.34 (best hook); Saleshandy: 2–3 per 100 emails in top campaigns only | 0.2 | 0.7 | 2.0 |
| Close rate from a held first meeting | First Page Sage (2025-06-11) B2B SaaS funnel, email channel: SQL to opportunity 48%, opportunity to closed 32%, so about 15% from qualified meeting to customer; opportunity-to-close across channels 32–40% | 10% | 20% | 33% |
| Customers per 1,000 prospects (INFERENCE: meetings x 75–80% show rate x close rate) | Martal cites 0.2% of emails ending in a deal (secondary) | 0.15 | 1.05 | 5.3 |

- **Safe volume (FACT):** best reply rates at 20–49 emails per day per sending account, similar at 50–99, worse above 100 (Hunter 2026). New domains warm up over 4–6 weeks starting at 5–10 emails a day (Instantly 2026). Sequences of 21–50 recipients reply at 6.2% vs 2.4% for 500+ (Hunter). Three messages is the best sequence length in Hunter's data; Instantly finds 58% of replies on the first email and recommends 4–7 touches.
- **Capacity (INFERENCE):** 3 secondary domains x 3 inboxes x 30 emails a day ≈ 5,400 emails a month ≈ 1,800 new prospects a month with three-step sequences. At base rates that is about 13 meetings booked and **about 2 new customers a month**; at high rates about 9–10. At $150 ARPA the base case adds roughly $300 MRR a month. Cold email alone reaches $10k MRR in a year only with top-quartile targeting or ARPA of $400 and above.
- **Stack cost (FACT unless marked):** Instantly outreach plan $47/month (5,000 emails, 1,000 contacts, unlimited inboxes and warm-up) or $94/month bundled with 1,500 lead credits (https://instantly.ai/pricing, 2026-11-13); lemlist email plan from $55–69/month (https://www.lemlist.com/pricing, 2026-11-13). ASSUMPTION, not re-verified today: Smartlead from about $39–59/month; Apollo paid plans about $49–99 per user per month; 9 Google Workspace inboxes about $65–75/month; 3 domains about $40/year; verification $10–30/month. Total about **$170–$280/month**.

Legal summary (not legal advice; B2B cold email to people at companies):

| Jurisdiction | Rule | Source |
|---|---|---|
| United States | Opt-out regime. No prior consent needed. Requirements: truthful headers and subject, identification as an advertisement, a valid physical postal address, a working opt-out honoured within 10 business days. | FACT: 15 U.S.C. § 7704 (CAN-SPAM), https://www.law.cornell.edu/uscode/text/15/7704 |
| United Kingdom | PECR's email-consent rule does not apply to "corporate subscribers" (companies, LLPs, Scottish partnerships, government bodies). Sole traders and ordinary partnerships are treated as individuals and need consent or the soft opt-in. Sender must identify itself and give an opt-out address; UK GDPR still applies to named contacts. | FACT: ICO, https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/ (read 2026-11-13) |
| France | B2B prospecting may rely on legitimate interest when the message relates to the recipient's profession; the person must be informed and able to object simply and free of charge. | FACT: CNIL, https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique (read 2026-11-13) |
| Germany | Advertising by email without the addressee's prior express consent is always an "unreasonable nuisance"; no B2B exception other than existing customers. | FACT: UWG § 7(2) no. 2 and § 7(3), https://www.gesetze-im-internet.de/uwg_2004/__7.html |
| Other EU states | ASSUMPTION from background knowledge, **not verified in this session**: opt-out for B2B is generally accepted in Ireland, Sweden, Finland, Portugal and (for generic company addresses) Belgium; prior consent is required for B2B as well in Austria, Italy, Spain, Denmark, the Netherlands and, since November 2024, Poland. Check each target country before sending. | — |
| Canada | Sending a commercial electronic message is prohibited unless the recipient has given express or implied consent. ASSUMPTION, not verified today: implied consent can arise from a conspicuously published business address when the message is relevant to the recipient's role, and penalties reach CAD 10M per violation for companies. | FACT for the consent rule: CASL s. 6(1), https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html |
| Australia | ASSUMPTION, regulator page could not be loaded: Spam Act 2003 requires consent (express or inferred, including inferred from conspicuous publication of a work address when relevant to the role), sender identification and an unsubscribe facility. | UNKNOWN today |

INFERENCE: the practical cold-email markets for this founder are the US, the UK (limited companies), France, Ireland and the Nordics outside Denmark. Germany, Austria, Italy, Spain, the Netherlands, Poland and Canada need LinkedIn, inbound or partners instead.

### 4b. LinkedIn outreach

| Metric | Published figures (FACT) | Low | Base | High |
|---|---|---|---|---|
| Platform limits | LinkedIn states that invitation limits exist for all members, does not publish the number, prohibits automation tools and restricts accounts that send too many or get ignored (LinkedIn Help, "Types of restrictions for sending invitations", read 2026-11-13). Vendors report about **100 invitations per week**, 100 messages a day and about 25 InMails a day (Expandi, read 2026-11-13). | 60/week | 100/week | 100/week |
| Invitation acceptance | Expandi H2 2026 (13.2M requests): 28.5%; Belkins 2026: 26% on Expandi data, 18.7% in Belkins' own 14,077-contact dataset; with a note 25.3%, without 27.6% | 18% | 26% | 35% |
| Reply rate | Expandi: 10.4% of messages get a reply, 8.8% in Computer Software; Belkins: 7.2% of contacts overall, 6.0% in the US; best with three messages (9.8%) | 5% | 8% | 12% |
| Meetings per 100 invitations sent | Belkins own data: 18.7% accepted x 1.3% of connected booked = **0.24** | 0.24 | 0.6 | 1.5 |
| Meetings per month from one account (INFERENCE, about 400 invitations) | — | 1 | 2–3 | 6 |

### 4c. Self-serve funnel

| Step | Published figures (FACT) | Low | Base | High |
|---|---|---|---|---|
| Landing visitor → signup, free trial without card | ChartMogul Conversion Report (2026-02-04; 200 products): 4.5%; First Page Sage (2025-09-05; 86 companies): 8.5% organic, 7.1% paid; Unbounce (2026): median SaaS landing-page conversion 3.8%, paid search 4.1%, paid social 2.9%, display 0.3% | 2% | 4% | 8% |
| Landing visitor → signup, freemium | ChartMogul: 9%; First Page Sage (2026-10-14): 11.6–15.1% by industry | 4% | 8% | 13% |
| Landing visitor → trial, card required | ChartMogul: 3.5%; First Page Sage: 2.5% organic, 2.2% paid | 1.5% | 2.5% | 4% |
| Signup → activation | Userpilot 2025 (62 B2B companies): average 37.5%, median 37% | 20% | 35% | 55% |
| Free trial without card → paid | ChartMogul: median 8% across all products; "good" 4–6%, "great" 10–15%; First Page Sage: 18.2%; B2B median 2.5% within 7 days of trial start (ChartMogul GTM 2025) | 3% | 8% | 18% |
| Free trial with card → paid | ChartMogul: 30% ("good" 25–35%, "great" 50–60%); First Page Sage: 48.8% (one paid month counts) | 25% | 35% | 50% |
| Freemium → paid | ChartMogul: 5.5%; First Page Sage: 2.6% (2.1–5.6% by industry); Lenny's Newsletter (2023-08-01): 3–5% good, 6–8% great | 1.5% | 3% | 6% |
| Visitor → paying customer (INFERENCE from ChartMogul's per-1,000-visitor figures: free trial 3.6, freemium 5.0, card-required trial 10.5) | — | 0.1% | 0.35% | 1.0% |

Caveats (FACT): the ChartMogul respondents are mostly $1–10M ARR companies with known brands and report within a six-month conversion window. Only 20% of free-trial products require a card (ChartMogul), but 70% of bootstrapped SaaS in MicroConf's survey and 70.6% of trial products on Freemius do (Freemius 2025-12-23). INFERENCE: for a solo vendor with scarce traffic, a card-required trial at ARPA ≥ $50 is the stronger default.

### 4d. Monthly logo churn and net revenue retention by ARPA band

| ARPA band | Published figures (FACT) | Monthly logo churn low / base / high | 12-month NRR low / base / high |
|---|---|---|---|
| Under $50 | Recurly (July 2026 network data): 4.29% at $10–25 and 3.84% at $25–50 (Recurly labels these "annual"; the values match its long-standing monthly benchmark, so I treat them as monthly — INFERENCE). ChartMogul 2023: **top-quartile** annual customer retention 63–65% (about 3.6–3.8% a month), top-quartile NRR 65–70%; only 2–2.7% of such businesses exceed 100% NRR. Consumer apps: 17% of monthly subscribers remain after a year (RevenueCat 2025). | 4% / 7% / 12% | 45% / 60% / 75% |
| $50–$250 | Recurly: 3.15% at $50–100, 2.87% at $100–250. Lenny's Newsletter (2022-02-08): 2.5–5% is good for SMB and mid-market, under 1.5% great. ChartMogul 2023: median customer churn settles at 3–4% a month after product-market fit; 1–2% is top quartile. | 2.5% / 4.5% / 7% | 65% / 80% / 95% |
| $250 and up | Recurly: 3.07% over $250. ChartMogul 2023: ARPA over $500: top-quartile customer retention 85.7% a year (1.3% a month), top-quartile NRR 109%, 41% exceed 100% NRR. Lighter Capital 2025: median annual customer churn 16.25% (1.5% a month), median revenue churn 12.5%. | 1.5% / 3% / 5% | 80% / 95% / 108% |

- FACT: early churn is front-loaded. Top-quartile companies keep 90% of new customers at 3 months and 70% at 12 (ChartMogul 2023). First-month churn "normally ranges from 5% to 50%" (Lenny's Newsletter). Nearly 30% of annual app subscriptions are cancelled in the first month (RevenueCat 2025).
- FACT: involuntary churn from failed payments is 1.3% a month at $10–25 and 0.18% above $250 (Recurly).
- INFERENCE: at 7% monthly churn, 100 customers lose 7 a month, so reaching $10k MRR at $30 ARPA (334 customers) requires more than 23 new customers a month just to stand still at the target.

### 4e. App-marketplace funnels

| Marketplace | What could be verified (FACT) | Gap |
|---|---|---|
| Apple App Store and Google Play subscriptions | RevenueCat 2025 and 2026: install → paid by day 35 is 2.18% median for freemium and 12.11% for hard paywalls; high-priced apps 2.66% vs 1.49% low-priced; 82% of trial starts happen on install day; trial → paid medians 26.8% (short trials) to 45.7% (long), best categories 44–49%; 17.3% of new apps reach $1K and 4.6% reach $10K monthly revenue within two years. | Listing view → install not reported |
| Shopify App Store | Revenue share 0% on the first $1M lifetime (from 2025-01-01), then 15%; 2.9% processing fee; $19 one-time registration (https://shopify.dev/docs/apps/launch/distribution/revenue-share, read 2026-11-13). | Listing → install → trial → paid benchmarks: **UNKNOWN** in this session |
| Chrome Web Store | Voicy case: organic installs before any marketing. | No public funnel data found |
| Atlassian, Slack, Google Workspace marketplaces | Nothing verified today. | **UNKNOWN**; covered by another analyst |

### 4f. Google Ads and CAC payback

| Metric | Published figures (FACT) | Low | Base | High |
|---|---|---|---|---|
| Search CPC | LocaliQ (2026-05-26): all-industry average $5.42; Business Services $5.87; Finance and Insurance $3.39; Legal $9.87. | $3 | $7 | $20 |
| Landing-page conversion from paid search | Unbounce 2026: Google search ads to SaaS pages 5.1% median; all paid search 4.1%; LocaliQ all-industry lead conversion 8.18% | 2% | 4% | 6% |
| Cost per lead | LocaliQ: average $66.69; Business Services $93.69 | $60 | $120 | $300 |
| CAC payback norm | First Page Sage (2026-11-04): consumer 6.6 months average and 3.8 good; SMB 11.4 average and 6.8 good; mid-market 16.9 and 11.7 | — | — | — |

- ASSUMPTION: the CPC range for commercial-intent B2B software keywords is from experience, not from a 2026 software-specific dataset (none could be loaded).
- INFERENCE, worked example at base: $7 CPC ÷ 2.5% visitor-to-trial (card required) = $280 per trial; ÷ 35% trial-to-paid = **$800 CAC**. Payback at 85% gross margin: 19 months at $50 ARPA, 6 months at $150, 3 months at $300. With a no-card trial (4% then 8%) the CAC is about $2,200.
- FACT: 29% (MicroConf's own page) or 57% (Freemius citing the same survey) of bootstrapped founders who run ads wait more than seven months for a return or cannot tell whether ads work. The two citations disagree; either way paid search is not a default.

### 4g. SEO in 2026

| Question | Published figures (FACT) | Modelling value (ASSUMPTION) |
|---|---|---|
| How quickly can a new page rank? | Only 1.74% of newly published pages reach the top 10 within a year (5.7% in 2017); 6.11% under a narrower filter; 72.9% of top-10 pages are over 3 years old; the average #1 page is 5 years old (Ahrefs, 2025-05-15). 96.55% of pages get no Google traffic (Ahrefs). | Assume 2–6% of pages rank for anything useful in year one |
| New-domain anecdotes | 97 tool pages: 3,200 impressions and 180 clicks in the first 30 days, average position 18 (Toolkiya, 2026-04-21). 11 tools: 675 unique visitors in week 4 (QuickTools.one, 2025-12-11). 946 programmatic pages on 8 new domains: almost none indexed after two weeks (dev.to, 2026-10-13). | Low: under 300 organic visits a month at month 6. Base: 1,000–3,000 a month by month 9–12 with weekly publishing. High: 5,000+ by month 6 when the keyword cluster is new |
| AI Overviews, informational queries | Position-1 click-through 58% lower when an AI Overview is present (Ahrefs, 2026-02-04; 34.5% in the April 2025 version). Users click a result in 8% of visits with an AI summary vs 15% without; 1% click a link inside the summary (Pew, March 2025 data). | Cut expected clicks from informational content by half or more |
| AI Overviews, commercial and transactional queries | Share of transactional queries showing an AI Overview rose from 1.98% to 13.94% and commercial from 8.15% to 18.57% between October 2024 and October 2025 (Semrush). Organic click-through on queries without AI Overviews also fell 41% (Seer, September 2025). | Less affected so far, but trending the same way; assume a 20–30% haircut |
| Traffic from AI assistants | 0.17% of site traffic on average in early 2025, most from ChatGPT (Ahrefs); converts 4.4x to 23x better than organic search (Semrush; Ahrefs 2025-06-16) | 1–5% of signups in year one for a product assistants can describe; UNKNOWN for 2026 volumes |

### 4h. Summary table for a funnel model

| Input | Low | Base | High |
|---|---|---|---|
| Cold email: reply rate per prospect | 1.5% | 3% | 6% |
| Cold email: meetings booked per 100 prospects | 0.2 | 0.7 | 2.0 |
| Close rate from held meeting (founder-led, under $300/month) | 10% | 20% | 33% |
| Cold email: new prospects per month, 9 inboxes | 1,000 | 1,800 | 2,500 |
| LinkedIn: meetings per month per account | 1 | 2–3 | 6 |
| Visitor → trial, card required | 1.5% | 2.5% | 4% |
| Trial with card → paid | 25% | 35% | 50% |
| Visitor → trial, no card | 2% | 4% | 8% |
| Trial without card → paid | 3% | 8% | 18% |
| Visitor → free plan / free → paid | 4% / 1.5% | 8% / 3% | 13% / 6% |
| Monthly logo churn, ARPA under $50 | 4% | 7% | 12% |
| Monthly logo churn, ARPA $50–$250 | 2.5% | 4.5% | 7% |
| Monthly logo churn, ARPA $250+ | 1.5% | 3% | 5% |
| Google search CPC, B2B software keyword | $3 | $7 | $20 |
| Organic visits per month at month 9–12, new domain | 300 | 2,000 | 6,000 |
| Merchant-of-record fee (FACT: Paddle 5% + $0.50 per transaction, https://www.paddle.com/pricing, 2026-11-13) | — | 6–8% of a $20–50 charge | — |

---

## 5. Shortlist of opportunities supported by this evidence

### 5.1 Filters applied

Derived from sections 1–4 (INFERENCE):

1. **ARPA ≥ about $100 unless a marketplace or search supplies volume.** At $116 median B2B ARPA, $10k MRR is 50–100 accounts, which founder-led outreach can find in a year; at $20 it is 500+ accounts plus 7% monthly churn.
2. **Proven spending in a category less than two years old**, shown by at least one verified product with a founder who has no visible audience.
3. **Sellable through a merchant of record.** Paddle's policy excludes automated social-media marketing, message-app marketing and products that help break another platform's terms. Opportunities 6, 7 and 9 are listed for completeness because the case evidence is strong, but they fail this filter as usually built.
4. **Needs something a chat assistant lacks** (schedules, accounts, monitoring, history, data access), so it survives the wrapper squeeze.
5. **v1 in a day, operable by one person, no per-client manual work.**

Prices marked † are founder-stated on TrustMRR verified profiles (read 2026-11-12/13). Prices marked ‡ are from my memory and were **not re-verified today**.

### 5.2 The opportunities

**1. White-label AI-search visibility reports for small SEO and marketing agencies (per-client pricing)**

- Buyer and payer: owner or head of SEO at a 2–30-person agency; pays per client workspace.
- Recurring job and trigger: monthly proof to each client of whether ChatGPT, Gemini, Perplexity and Google AI Overviews mention them versus competitors. Trigger: a client asks "why are we not in ChatGPT?", or organic clicks drop after AI Overviews.
- Alternatives: Rank Prompt $150 / $500 / $1,000 / $2,000 per month†; ChatSEO (free start, ARPA about $45)†; Semrush and Ahrefs AI-visibility add-ons, Peec AI, Otterly, Profound (about $30–$500+ per month‡).
- Willingness to pay: Rank Prompt $44.8k MRR from 218 subscriptions (ARPA $206), first $10k month about 8 months after founding, founder with 47 X followers; ChatSEO $35.6k MRR within a year; AEO Engine $188k MRR from 63 accounts.
- Wedge: built for agencies rather than brands: client workspaces, white-label PDF and share links, vertical prompt libraries, non-English prompt sets.
- First 10 customers: generate a free snapshot for one named client of each of 200–300 agencies (clients are public on agency case-study pages), send it by email or LinkedIn in the US, UK, Ireland and France, convert to a 30-day pilot.
- Retention logic: tied to the agency's monthly reporting cycle; expands with each client added; history accumulates.
- Solo-operability: scheduled prompt runs and parsing, no services. Cost per run must be capped.
- Price and count: about $149 per agency per month (3–5 workspaces) → 67 agencies.
- Most dangerous assumption: that agency packaging is enough for an unknown vendor in a category that filled with competitors during 2025–2026 and that the SEO suites are bundling.

**2. Live AI translation and captions for recurring multilingual gatherings (a segment Glossa.live does not name)**

- Buyer and payer: operations or AV lead of a congregation, community association, school or local public body with weekly or monthly meetings; the organisation pays.
- Recurring job and trigger: attendees who do not speak the main language follow on their phones through a QR code. Trigger: new immigrant members, interpreter cost or absence.
- Alternatives: Glossa.live $99 / $299 / $499 per month or $5 per hour per language†; human interpreters; event platforms such as Wordly, spf.io, KUDO (event or enterprise pricing‡); free generic captions.
- Willingness to pay: Glossa.live $14.4k MRR from 100 subscriptions (ARPA $144), monthly revenue $16–32k between April and October 2026, first $10k month about 9 months after founding, founder with 107 X followers, channels "content marketing, SEO".
- Wedge: a named segment and language set (for example Ukrainian-, Russian-, Polish- or Spanish-speaking diaspora congregations in North America and Europe, where the founder can sell and support natively), with glossary tuning for that setting.
- First 10 customers: email and video demos to 300 organisations with public contact details; a 10-minute live demo in their own language; volunteer AV groups on Facebook; one reference per network or denomination.
- Retention logic: weekly habitual use and visible benefit to members; risk when the volunteer champion leaves.
- Solo-operability: self-serve setup; support peaks on weekends; speech and translation costs per hour need margin.
- Price and count: $99–$149 per month → 70–100 organisations.
- Most dangerous assumption: that live quality in noisy rooms with specialist vocabulary is good enough from off-the-shelf models for a fast v1 to win pilots, and that small organisations will pay monthly rather than use free captions.

**3. Read-only buyer-intent radar for one B2B niche**

- Buyer and payer: founder or marketer at a 5–50-person B2B software company or agency in one niche.
- Recurring job and trigger: know within the hour when someone publicly asks for a tool or an alternative in their category, or complains about a competitor. Trigger: inbound stalls, a competitor raises prices.
- Alternatives: Bazzly $199 per month†; GojiberryAI $99†; Traxy.ai $149†; Syften, F5Bot, Brand24, Octolens (about $0–$150‡).
- Willingness to pay: Bazzly $38.8k MRR from 208 subscriptions, up 168% in 30 days; Traxy.ai reached its first $10k month five months after founding and is at $54.7k MRR; GojiberryAI $424k MRR at last sync (stale since 2026-08-14).
- Wedge: alerts and drafts only, no automated posting (keeps it inside platform rules and Paddle's policy); niche query packs and lead scoring; several sources beyond Reddit.
- First 10 customers: the product generates its own outreach: "five people asked for a tool like yours last month — here are the threads", sent to 300 vendors in the niche.
- Retention logic: daily alerts with obvious value; churn when a niche has too few conversations.
- Solo-operability: automated; the work is data access and false-positive control.
- Price and count: $99–$199 → 50–100 customers.
- Most dangerous assumption: continued lawful and affordable access to community data (current commercial API terms of Reddit and others: UNKNOWN), and that "alerts only" is worth paying for next to tools that automate more.

**4. Paid capability server for AI agents (hosted MCP plus API) in one professional workflow**

- Buyer and payer: professionals and small teams already paying for an assistant or coding agent; pay by subscription or credits.
- Recurring job and trigger: the agent cannot do the task alone because it needs accounts, rendering, licensed data or scheduled execution. Trigger: the user hits that wall inside a workflow.
- Alternatives: CreativeClaw $10 per 1,000 credits†; PostEverywhere from $9 per month†; Postiz from $29†; general connector platforms‡.
- Willingness to pay: CreativeClaw's monthly revenue went from $30 (2026-04) to $92.9k (2026-09) and $110.9k (2026-10), one person, 448 X followers, MRR $14.7k; PostEverywhere $9.4k MRR with 152 followers; Postiz MRR up 54% in 30 days.
- Wedge: one capability with real marginal cost or account friction that model vendors are unlikely to bundle soon; first-class docs and one-command install.
- First 10 customers: MCP and connector directories, a public repository, answers in agent-builder communities, short demo clips.
- Retention logic: weak unless usage becomes routine; credit sales are revenue, not MRR.
- Solo-operability: high; upstream cost control is the main duty.
- Price and count: $19–$49 subscriptions plus credits → 250–500 subscribers, fewer with team plans.
- Most dangerous assumption: that the capability stays outside the assistants' native features for a year, and that directory discovery works without an audience (how CreativeClaw was discovered: UNKNOWN).

**5. Sold-price comps and deal alerts for one resale niche or marketplace**

- Buyer and payer: part-time and professional resellers, small resale shops, some developers through an API.
- Recurring job and trigger: before buying stock, check real sold prices; get alerted to under-priced listings. Trigger: every sourcing decision.
- Alternatives: SoldComps API $9 / $29 / $79 per month†; Flipify $5–$10†; eBay's own research tools, WorthPoint, 130point‡.
- Willingness to pay: SoldComps $26.2k MRR from 587 subscriptions, first revenue 2026-04, first $10k month 2026-08, founder with no X presence; Flipify $18.7k MRR (about 18 months); Store Stock Checker $33k MRR in its first month from press and Reddit.
- Wedge: a marketplace or category the existing tools skip (European second-hand platforms are a candidate), mobile-first lookups.
- First 10 customers: reseller subreddits, Discords and Facebook groups with real comps as content; reseller YouTubers as affiliates; long-tail "sold price" pages.
- Retention logic: used at every purchase; API customers are stickier; seasonal.
- Solo-operability: high if the data feed is stable.
- Price and count: $15–$29 → 350–670 subscribers, or fewer with API plans.
- Most dangerous assumption: that sold-price data can be obtained lawfully and reliably for the chosen marketplace. If it requires breaking terms, both the marketplace and the merchant of record can end the business.

**6. Bid-and-lead copilot for agencies on freelance marketplaces** (evidence strong; fails filter 3 as usually built)

- Buyer: 3–30-person outsourcing agencies; the founder can reach Ukrainian and CEE agencies in their own language.
- Job and trigger: find and answer relevant job posts within minutes, every day.
- Alternatives and evidence: Lancer.app $17.7k MRR from 114 subscriptions (ARPA $155), about 11 months, founder with 91 X followers; GigRadar and Vollna‡.
- Wedge and first 10: local agency communities and direct demos. Retention: daily use while the agency bids. Price: $99–$199 → 50–100 agencies.
- Most dangerous assumption: that the marketplace tolerates it. Automation generally violates marketplace terms (account bans) and Paddle prohibits products that enable infringement of third-party terms. A "scoring and alerts only" version may be allowed but is weaker.

**7. AI sales responder for businesses that sell in Instagram or WhatsApp messages** (fails filter 3 and risks filter 5)

- Evidence: AI DM Setter $15.5k MRR from 22 accounts (ARPA $703, sold by demo, 8 months); Pushouse $29.7k MRR, first $10k month one month after founding, using cold calling, cold email and ads; DM Champ $54k MRR (founded 2023).
- Buyer: coaches, clinics, e-commerce shops. Price $100–$700 → 15–100 accounts. Alternatives: ManyChat, Respond.io‡.
- Most dangerous assumption: that it can be sold and run without per-client setup work, platform approval delays, and a merchant of record that accepts "message app marketing".

**8. "Businesses that need X" lead lists for web and SEO freelancers**

- Evidence: LocalProspects.ai $9.4k MRR from 218 subscriptions at $29 / $79 / $229†, about 7 months, founder with 160 X followers; the same founder's 1ClickWebsite at $14k MRR; Prospo (local businesses without a website) $9.6k revenue in its first tracked 30 days.
- Buyer: freelancers and small agencies selling websites or SEO to local firms. Job: a fresh weekly list of prospects with a visible problem. First 10: freelancer communities and cold email to agencies. Retention: lists are consumable; churn when a freelancer's pipeline is full. Price $29–$79 → 130–350 subscribers.
- Most dangerous assumption: that the underlying listings data can be used commercially and that the list is not trivially reproducible with general lead tools or an assistant.

**9. Done-for-you social content for one kind of local business or for authors** (policy risk)

- Evidence: Marky $22k MRR from 470 subscriptions (ARPA $47, founder with 67 X followers, channels Facebook, Meta Ads, word of mouth, founded 2023); Sonder $14.7k MRR two months after founding at $49 / $99 / $209†, already down 33% in 30 days.
- Buyer: owner-operators without a marketer. Price $49–$99 → 100–200 accounts.
- Most dangerous assumption: retention beyond the third month, and acceptance by a merchant of record whose policy bans "automated social media marketing" that claims to optimise engagement.

**10. Comment moderation and ad-comment protection for direct-to-consumer brands**

- Evidence: FeedGuardians $8.1k MRR from 39 accounts (ARPA $208) at $83 / $249 / $833 / $2,499†, 15 months after founding, founder with 115 X followers.
- Buyer: e-commerce marketing lead running paid social. Job: hide spam and hostile comments under ads around the clock. Trigger: scaling ad spend. First 10: cold email to brands with visibly unmoderated ads. Retention: runs continuously. Price $99–$249 → 40–100 brands.
- Most dangerous assumption: API approval and review timelines at Meta and TikTok, and a pace (15 months to $8k) that already misses the target for the one verified example.

**11. API bridge to a legacy system with no usable official API** (evidence strong, outside the build constraint)

- Evidence: Conductor (QuickBooks Desktop API) $49.4k MRR, $49 per connected company file per month†, growing 17% in 30 days, four years after founding.
- Why listed: best retention profile in the dataset (customers build on it). Why not chosen: needs months of integration work before first value, which the constraints exclude.

**12. Accessibility-first voice or dictation utility distributed through a browser-extension store**

- Evidence: Voicy $12.6k MRR from 1,555 subscriptions at $8.49 per month† plus $260 lifetime deals, first users from the extension store with no marketing, about two years to this level.
- Most dangerous assumption: that a $8 product reaches 1,200+ subscribers inside 12 months without an existing store ranking. Marketplace mechanics are covered by another analyst.

### 5.3 Ranking against the constraints

| # | Opportunity | Verified precedent (founder's X followers today) | Precedent's time to first $10k month | Merchant-of-record fit | Solo, no services | Customers needed | Main kill-risk |
|---|---|---|---|---|---|---|---|
| 1 | Agency AI-visibility reports | Rank Prompt (X 47) | 2–8 months | Good | Good | ~67 at $149 | Saturation and suite bundling |
| 2 | Live translation for a named segment | Glossa.live (X 107) | 9 months | Good | Good, weekend support | 70–100 at $99–$149 | Segment size and live quality |
| 3 | Read-only intent radar | Traxy.ai (X 1.3k), Bazzly (X 7k) | 5–15 months | Good if alerts only | Good | 50–100 at $99–$199 | Data-access terms |
| 4 | Agent capability server | CreativeClaw (X 448) | 5 months | Good | Good | 250–500 at $19–$49 | Native features absorb it |
| 5 | Resale comps and alerts | SoldComps (X 0), Flipify (X 53) | 4–18 months | Depends on data source | Good | 350–670 at $15–$29 | Lawful data access; low ARPA |
| 6 | Marketplace bid copilot | Lancer.app (X 91) | 11 months | Poor | Good | 50–100 | Terms of service |
| 7 | DM sales responder | AI DM Setter (X 0), Pushouse (X 0) | 1–8 months | Poor | Poor | 15–100 | Policy and service creep |
| 8 | Local lead lists | LocalProspects.ai (X 160) | 7 months to $9k | Uncertain | Good | 130–350 | Data terms; easy to copy |
| 9 | Vertical social content | Marky (X 67), Sonder (X 0) | 1 month (Sonder) | Poor | Good | 100–200 | Churn; policy |
| 10 | Comment moderation | FeedGuardians (X 115) | not reached in 15 months | Good | Good | 40–100 | Slow sales; API approval |
| 11 | Legacy API bridge | Conductor (X 1k) | years | Good | Good | ~70 developers' accounts | Build time |
| 12 | Accessibility dictation | Voicy | about 2 years | Good | Good | 1,200+ | Low ARPA |

My top five for the next round, in order: **1, 2, 3, 4, 5**. Reasons are in the table; 1 and 2 combine a verified precedent with ARPA above $100, a reachable buyer list and no policy conflict. 3 and 5 depend on one external data-access question each, which should be answered before any build. 4 has the fastest precedent and the weakest retention.

---

## 6. What I could not verify

- **Share of bootstrapped SaaS reaching $10k MRR within 12 months**: no dataset measures it directly; my 1% figure is derived (1.3).
- **Indie Hackers and Reddit primary posts** (blocked); the Scraping Fish 2022 study (site shut down), cited only through TechStartups.
- **Raw census data** behind the Mifanr analysis (GitHub access not enabled); I rely on the published tables.
- **Full MicroConf State of Independent SaaS 2024 report** (gated PDF); the ad-ROI figure is quoted as 29% on MicroConf's page and 57% by Freemius. No 2025 or 2026 edition was found.
- **Churn for the case set**: TrustMRR public profiles do not expose churn; I used revenue trend as a proxy.
- **Team size and prior audience** for most cases: 46 of 69 profiles do not state team size; audiences outside X are invisible; follower counts are today's, not at launch.
- **How individual winners got their first customers**: self-declared channel tags only; 35 of 69 declared none. No interviews could be searched.
- **Marketplace funnels** for Shopify, Atlassian, Slack and Google Workspace (listing view → install → trial → paid): nothing verifiable found.
- **Google Ads CPC for B2B software keywords in 2026**: only all-industry and "Business Services" averages verified.
- **Prices of several alternatives** (marked ‡), Apollo and Smartlead plan prices, Google Workspace seat price: from memory.
- **EU country rules other than France and Germany, CASL's implied-consent details and penalties, Australia's Spam Act**: regulator pages could not be loaded; stated from background knowledge.
- **LinkedIn's exact invitation limit**: LinkedIn does not publish it; 100 per week is vendor-reported.
- **AI-assistant referral volumes in 2026**: the latest verified cross-site figure is from February 2025.
- **Merchant-of-record policies other than Paddle's**, and whether Paddle's listing of whole Ukrainian regions (Kherson, Zaporizhzhia, Donetsk, Luhansk, Crimea) as unsupported affects a founder registered in the government-controlled parts of those regions (https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle, read 2026-11-13).
- **Current commercial terms for Reddit and marketplace data access**, on which opportunities 3, 5, 6 and 8 depend.
- **Stale records**: 7 of the 69 cohort profiles last synced more than 30 days ago (flagged in the tables).

## 7. Source register

Primary and near-primary sources read on 2026-11-13 (date in brackets is the source's own date).

**Base rates**

- Mifanr, TrustMRR census [2026-09-05]: https://mifanr.com/en/posts/trustmrr-census/
- TechStartups analysis of the same census [2026-09-28]: https://techstartups.com/2026/09/28/what-percentage-of-indie-hacker-products-make-100k-in-arr/
- TrustMRR statistics, micro-SaaS lists, channel pages, machine-readable description [2026-11-13]: https://trustmrr.com/stats , https://trustmrr.com/micro-saas-examples , https://trustmrr.com/micro-saas-ideas , https://trustmrr.com/channels , https://trustmrr.com/llms.txt
- RevenueCat State of Subscription Apps 2026 and 2025: https://www.revenuecat.com/state-of-subscription-apps-2026/ , https://www.revenuecat.com/state-of-subscription-apps-2025/
- ChartMogul reports: odds of making it [2025-10-15] https://chartmogul.com/reports/saas-growth-the-odds-of-making-it/ ; growth 2023 https://chartmogul.com/reports/saas-growth-report/ ; bootstrapped vs VC [2024-06-12] https://chartmogul.com/reports/saas-growth-vc-bootstrapped/ ; go-to-market [2025-06-11] https://chartmogul.com/reports/saas-go-to-market-report/ ; conversion [2026-02-04] https://chartmogul.com/reports/saas-conversion-report/ ; retention [2023-11-01] https://chartmogul.com/reports/saas-retention-report/ ; benchmarks [2023-05-24] https://chartmogul.com/reports/saas-benchmarks-report/
- MicroConf stage pages quoting the 2024 State of Independent SaaS [updated June 2026]: https://microconf.com/founders/0-10k-arr , https://microconf.com/founders/10k-100k-arr
- Freemius micro-SaaS 2025 [2025-12-23]: https://freemius.com/blog/state-of-micro-saas-2025/
- Lighter Capital 2025 benchmarks [2025-09-10]: https://www.lightercapital.com/blog/2025-b2b-saas-startup-benchmarks ; SaaS Capital 2026 growth benchmarks: https://www.saas-capital.com/research/private-saas-company-growth-rate-benchmarks/
- dev.to self-reported Indie Hackers data [2026-04-14]: https://dev.to/agenthustler/i-scraped-4500-indiehackers-products-heres-what-the-mrr-data-reveals-18ki

**Outreach**

- Instantly Cold Email Benchmark Report 2026 [2026-01-12]: https://instantly.ai/cold-email-benchmark-report-2026
- Belkins cold email study [2026-06-26]: https://belkins.io/blog/cold-email-response-rates ; Belkins LinkedIn study [2026-06-29]: https://belkins.io/blog/linkedin-outreach-study
- Hunter, State of Email Outreach 2026: https://hunter.io/the-state-of-cold-email
- Saleshandy [2026-10-07]: https://www.saleshandy.com/blog/cold-email-statistics/ ; Woodpecker [2026-02-24, updated 2026-06-23]: https://woodpecker.co/blog/cold-email-statistics/ ; The Digital Bloom [2025-11-10]: https://thedigitalbloom.com/learn/cold-outbound-reply-rate-benchmarks/ ; Martal [2026]: https://martal.ca/b2b-cold-email-statistics-lb/
- Expandi State of LinkedIn Outreach H2 2026: https://expandi.io/blog/state-of-linkedin-outreach/ ; Expandi limits: https://expandi.io/blog/linkedin-limits/ ; LinkedIn Help: https://www.linkedin.com/help/linkedin/answer/a551012
- Sender rules: Gmail https://support.google.com/a/answer/81126 and https://support.google.com/a/answer/14229414 ; Yahoo https://senders.yahooinc.com/best-practices/ ; Outlook https://techcommunity.microsoft.com/blog/microsoftdefenderforoffice365blog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730
- Law: CAN-SPAM https://www.law.cornell.edu/uscode/text/15/7704 ; ICO https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/ ; CNIL https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique ; UWG § 7 https://www.gesetze-im-internet.de/uwg_2004/__7.html ; CASL https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html
- Tool pricing: https://instantly.ai/pricing , https://www.lemlist.com/pricing

**Funnel, churn, ads, SEO**

- First Page Sage: trial conversion [2025-09-05] https://firstpagesage.com/seo-blog/saas-free-trial-conversion-rate-benchmarks/ ; freemium [2026-10-14] https://firstpagesage.com/seo-blog/saas-freemium-conversion-rates/ ; B2B SaaS funnel [2025-06-11] https://firstpagesage.com/seo-blog/b2b-saas-funnel-conversion-benchmarks-fc/ ; CAC payback [2026-11-04] https://firstpagesage.com/reports/saas-cac-payback-benchmarks/
- Unbounce SaaS conversion benchmarks [2026]: https://unbounce.com/conversion-benchmark-report/saas-conversion-rate/ ; Userpilot 2025: https://userpilot.com/saas-product-metrics/
- Lenny's Newsletter: churn [2022-02-08] https://www.lennysnewsletter.com/p/monthly-churn-benchmarks ; free-to-paid [2023-08-01] https://www.lennysnewsletter.com/p/what-is-a-good-free-to-paid-conversion
- Recurly churn benchmarks [July 2026 data]: https://recurly.com/research/churn-rate-benchmarks/
- LocaliQ search advertising benchmarks [2026-05-26]: https://localiq.com/blog/search-advertising-benchmarks/
- Ahrefs: ranking time [2025-05-15] https://ahrefs.com/blog/how-long-does-it-take-to-rank/ ; AI Overviews [2025-04-17] https://ahrefs.com/blog/ai-overviews-reduce-clicks/ and [2026-02-04] https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/ ; AI traffic [2025-02-06] https://ahrefs.com/blog/ai-traffic-study/ ; AI conversion [2025-06-16] https://ahrefs.com/blog/ai-search-traffic-conversions-ahrefs/
- Semrush: AI Overviews study https://www.semrush.com/blog/semrush-ai-overviews-study/ ; AI search traffic study https://www.semrush.com/blog/ai-search-seo-traffic-study/
- Seer Interactive [September 2025]: https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-september-2025-update ; Pew Research [2025-07-22]: https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/
- Platform policy: Shopify revenue share https://shopify.dev/docs/apps/launch/distribution/revenue-share ; Paddle pricing https://www.paddle.com/pricing ; Paddle acceptable-use policy [2026-04-13] https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle ; Paddle supported countries https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle

**Cases**: individual TrustMRR profiles are linked in section 2; Starter Story and dev.to links are in 2.5 and 2.6.

