# R3 — Red-team review of the venture selection (round 2)

Date: 2026-11-13. Role: independent, adversarial reviewer. Scope: cross-candidate judgement over round-1 reports A–J and `SYNTHESIS.md`, plus a direct attack on the current favourite (CV re-formatting for recruitment agencies). I did not repeat the competitor and channel deep-dive that two other analysts are running on that niche.

Labels: **FACT** = read today in the cited page or in the cited round-1 file. **INFERENCE** = my reasoning. **ASSUMPTION** = unverified input. **UNKNOWN** = looked for, not found. "Background" = my prior knowledge, not re-checked today.

---

## 0. Bottom line

1. **No candidate clearly reaches a 5% chance of $10k MRR at month 12.** My best single estimate is about 4% (range 2–6%) for one candidate; everything else sits at 1–2%. Realistic median outcomes are $0.6k–$1.8k MRR at month 12. These are judgements anchored on report B's benchmarks, not measurements.
2. **The team's favourite, as framed (self-serve CV formatting for small recruitment agencies), does not survive.** The exact product already exists with verified revenue of about zero: RefineCV, founded May 2026, team of 2–5, cold email + SEO, 965 visitors in the last 30 days, has **$70.52 all-time revenue and $2.39 MRR** (payment-provider verified). Per-CV prices have fallen to $0.25–$1.00. At least four recruitment CRMs include branded CV or candidate-report formatting, one of them on its free tier. I put it at about 1% for $10k MRR and about $0.6k median.
3. **What I would launch:** one data pipeline on the UK Find a Tender open API, sold first to small suppliers as a "public-contract copilot" (free personalised radar page → paid bid desk at £49/£149 a month), with a second wedge on the same data for recruitment agencies (contract-award hiring signals at £99–149). It is the only candidate whose prospect list, lawful channel and personalised hook were **measured** in round 1, and its 7-day falsification test is the cleanest.
4. **The only form of the CV idea worth a test** is the bench-CV wedge for Ukrainian IT-outsourcing firms, and only as a 7-day pre-sale test (15 calls, 3 pre-payments). Its ceiling is low: 125 customers would be 4–8% of all such firms in Ukraine (FACT, report I).
5. **Three of my attack lines did not hold up** and I say so in section 4: the staffing market is not broadly contracting in 2026 (US growing 2.4%; UK weak and volatile), I found no public recruiter statements that "ChatGPT is enough" for formatting, and Ukrainian IT exports are growing slightly, not shrinking.

---

## 1. Method and limits

- Read: `SYNTHESIS.md`; B and G in full; F, H, I, D in the parts that carry rankings, evidence tables and unknowns; bottom lines and candidate sections of A, C, E, J.
- **WebSearch calls used: 21 of 25** (one of them returned an API error because the domain filter was refused; I count it). Everything else was direct page reads (`curl` / headless Chromium), about 45 pages, including 10 TrustMRR verified-revenue profiles.
- Not done: no interviews, no test sends, no product build. Reddit could not be searched or read. I could not find any public first-hand recruiter discussion of CV-formatting tools.
- Probabilities and medians below are my estimates. They are built from B's funnel benchmarks (section 3.0) and then adjusted for evidence about late entrants in each niche. Treat a difference of one percentage point between two candidates as noise; treat a factor of three as real.

---

## 2. New evidence gathered today

| # | Finding | Label and source |
|---|---|---|
| 1 | RefineCV ("AI-powered CV formatting for recruitment agencies"): founded 2026-05-15, India, team 2–5, channels blog/SEO/newsletter/cold DM/cold email. All-time verified revenue **$70.52**; last 30 days $9.12; MRR **$2.39**; 6 active subscriptions; 965 visitors in 30 days; domain rating 8. Pricing: 10 CVs free, $0.40/CV pay-as-you-go, $50/month for 200 CVs | FACT, https://trustmrr.com/startup/refinecv.md (synced 2026-11-13) |
| 2 | RefineCV's own site calls 25 CVs a week "typical" and carries a section "You could paste it into ChatGPT. Here is why agencies don't." | FACT, https://refine-cv.com/ |
| 3 | RemakeCV: $25 per user per month billed annually, 30 CV credits per seat; "Join 100s of other successful recruitment agencies" (vendor claim) | FACT for the page text, https://remakecv.com |
| 4 | CVFormatter: "Trusted by 200+ staffing and recruiting companies worldwide" (vendor claim); $79/100 CVs, $179/250, $299/500; pay-as-you-go $49/50 | FACT for the page text, https://cvformatter.co and https://sagnikbhattacharya.com/blog/recruiters-ai-cv-formatting-tools (dated 2026-11-04) |
| 5 | Per-CV price across recruiter-side formatters: $0.60–$1.00 (CVFormatter, FormaCV $0.99, Candidately $1); Cluit $29 for 100 packs; RefineCV $0.25 | FACT, same blog; RefineCV site |
| 6 | HireAra: £180/£450/£950 a month + VAT. Starter = unlimited users, 1,500 candidates a year (about £1.44 per candidate), CRM integration. "We don't offer free trials because we want to be able to offer live onboarding sessions, design support and training" | FACT, https://www.hireara.ai/pricing |
| 7 | Recruitly CRM: branded CV templates, AI rewriting and watermarking "included in all plans", "no credits required", "Start free" | FACT, https://recruitly.io/features/agency-cv |
| 8 | Atlas (recruitment platform) published "Why Your CRM Makes Standalone CV Formatting Software Redundant" on 2026-06-23 | FACT, https://recruitwithatlas.com/blog/cv-formatting-software/ |
| 9 | Manatal has a "Custom Resumes" feature for branded, anonymised candidate profiles | FACT via search extract, https://www.manatal.com/blog/manatal-custom-resumes |
| 10 | Paiger (business-development tool for agencies): £199/month for 1 user (+£195 setup), £445/month for up to 5 users; the plans **include 240 and 1,000 "CV credits" a year** next to the business-development workflow | FACT, https://paiger.co/prices |
| 11 | Signalbase (hiring signals for recruiters): €99/month, 3 seats, 7-day trial without card | FACT, https://www.trysignalbase.com/pricing |
| 12 | UK, October 2026 survey (published 9 Nov): Permanent Placements Index 46.6 ("solid contraction", first fall in four months), Temp Billings 48.9 (first fall in seven months). ONS vacancies 691,000 in the three months to September, down 5.1% year on year, the lowest since 2014 outside the pandemic. Candidate supply has risen for 44 consecutive months | FACT, https://www.onrec.com/news/research-labour-market/uk-recruitment-activity-falls-again-as-uncertainty-and-costs-delay |
| 13 | UK, September 2026 survey: permanent placements rose marginally, "the strongest in four years" | FACT, https://kpmg.com/uk/en/media/press-releases/2026/10/kpmg-and-rec-uk-report-on-jobs-october-2026.html |
| 14 | US staffing: first revenue growth in three years, +2.4% in 2026 to $183.1bn; peak was $243bn in 2022 | FACT, https://www.staffingindustry.com/news/global-daily-news/staffing-industry-seeing-growth-for-first-time-in-3-years (2026-09-02) |
| 15 | UK recruitment firms were closing at the fastest pace in 15 years in April 2025 (about 120 liquidations in six months, City AM analysis). No 2026 count found | FACT for 2025, https://www.staffingindustry.com/news/global-daily-news/uk-recruitment-firms-closing-at-fastest-pace-since-financial-crisis ; UNKNOWN for 2026 |
| 16 | Ukraine has no EU adequacy decision under GDPR Article 45 (text dated March 2026); a new data-protection regulator is expected by end-2026 | FACT via search extract, https://eurointegration.ccl.org.ua/?p=2484 and https://zmina.info/?p=507511 |
| 17 | Ukraine's computer-services exports rose 4.1% in H1 2026 to about $3.34bn; back to 2023 level, 9% below the 2022 peak | FACT via search extract, https://itukraine.org.ua/en/ and https://itcluster.lviv.ua/en/ukraines-it-service-export-remains-resilient-h1-2026-results/ |
| 18 | Paddle's acceptable-use page (last updated 2026-04-13) also forbids any offering "marketed through the use of outbound telemarketing", "Automated decision-making or categorization of people" (listed under content generation), "Advertising Services, including but not limited to job boards", and human services "not related to a software offering" | FACT, https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle |
| 19 | AI-visibility tools by founding date (verified MRR today): Rank Prompt 2025-05 → $44,839; Sight AI 2025-06 → $10,939 (41 subscriptions, monthly revenue down from $13.7k in June to $7.8k in October); Clairon AI 2025-09 → $679; BeVisible 2026-04 → $257 (lists cold email among its channels); BrandPresence 2026-08 → $25.67 | FACT, https://trustmrr.com/startup/{rank-prompt,sight-ai,clairon-ai,bevisible,brandpresence}.md |
| 20 | Glossa.live (church translation): monthly verified revenue $5.3k (2025-11) → $31.8k (2026-09); MRR $14,404 from 100 subscriptions. Its payment connection expired on 2026-10-19, so the October figure ($20.2k) is a partial month, not a drop. Country: Cyprus. Domain rating 48. $99/month for 25 hours, or $5 per hour per language | FACT, https://trustmrr.com/startup/glossa-live.md and https://glossa.live/ |
| 21 | Glossa's own account: "the idea started simple: an app for our own church"; the founder is described as a serial founder with two exits; a developer and a community lead are named | FACT via search extract (Glossa pages, Product Hunt) — company's own account |
| 22 | Live church translation now has at least 13 named products: Glossa, OneAccord ("200+ churches", from $150/month for 5 hours), Wordly, spf.io, Sunflower AI ($90/month), Maestra ($79/month), LiveVoice, Kaleo AI, Hope Translator, Sermon Live, CAMB for Faith, Church Translation LLC (2026), JotMe | FACT for the listings, https://www.oneaccord.ai/llms.txt , https://www.vozo.ai/blogs/sermon-translation-software , search extract of faith.tools and App Store listings |
| 23 | UK AI bid-writing tools with public prices: BidScout £49/month (500 credits) and £149/month (2,500 credits), 14-day trial; BIDSOFTWARE £2,750 + VAT a year for one user (G-Cloud 15 price list); Stotles Bid Studio from £495 (report G). Named but unpriced: mytender.io, Tenderforge, BidWriter, Bidwin AI | FACT, https://www.bidscout.co.uk/pricing ; search extracts for the rest |
| 24 | SMEs received about 20% of direct UK public procurement spend in 2024 (£45.4bn), flat for six years; trade-body surveys name administrative burden as a main barrier | FACT via search extract (BCC/Tussell tracker 2025; Civil Service World; NFB) |
| 25 | Sales-tax exemption certificates now have low-end clones on Shopify: ExemptSync (launched 2026-04-01, $9.99/$19.99), Self-Service Tax Exemption ($9.99, 0 reviews); Numeral bundles certificate management at $79 per state per month | FACT via search extract (apps.shopify.com listings; numeral.com) |
| 26 | No tool aimed specifically at bench CVs for IT-outsourcing firms surfaced in one search; Flowcase is listed from about $119 | FACT for the search result; absence of evidence only |
| 27 | TrustMRR's "Recruiting & HR" category lists 271 verified startups. The top of the list is job-seeker tools and job boards; the employer- and agency-facing tools visible on the first page are small or slow (Hirevire $14k MRR, about 50 months to its first $10k month per report B; Textwork $2.9k; FidForward $556; JuggleHire $502) | FACT, https://trustmrr.com/category/recruiting (first page only) |

---

## 3. My ranked list

### 3.0 The arithmetic every candidate has to pass (from report B, section 4h)

- Cold email capacity for one person: 1,000 / **1,800** / 2,500 new prospects a month (low/base/high). New domains need 4–6 weeks of warm-up (FACT, B 4a), so year one has about 10 sending months: roughly **18,000 prospects** at base.
- Customers per 1,000 prospects: 0.15 / **1.05** / 5.3. LinkedIn adds 1 / 2–3 / 6 meetings a month, about 0.5 customers a month at base.
- Monthly logo churn at $50–250 ARPA: 2.5% / **4.5%** / 7%. Customers added evenly over ten months are about 80% retained at month 12 (INFERENCE).
- Result (INFERENCE): **base case ≈ 25 customers won, ≈ 20 still paying at month 12. High case ≈ 110 won, ≈ 85 paying.**

| ARPA | MRR at month 12, base funnel | MRR at month 12, high funnel |
|---|---|---|
| $50 | $1.0k | $4.3k |
| $100 | $2.0k | $8.6k |
| $150 | $3.0k | $12.9k |
| $200 | $4.0k | $17k |

- Organic search adds little in year one in a clone-dense niche (B 4g: 300 / 2,000 / 6,000 visits a month by month 9–12; 0.35% of visitors become customers at base).
- **Consequence:** outbound reaches $10k only when the funnel runs about five times better than base **and** ARPA is at least about $120. A five-fold funnel needs a narrow list plus a hook that shows the recipient their own result (B 4a: best hook 2.34 meetings per 100 against 0.69 baseline). So I ranked candidates mainly on two questions: is there a personalised, data-derived hook with a lawful list, and does the price anchor for a newcomer hold above $100?

### 3.1 Ranking table

| # | Candidate | Buyer | Price → ARPA | Customers for $10k | P(≥$10k MRR at m12) | Median MRR at m12 |
|---|---|---|---|---|---|---|
| 1 | UK public-contract copilot on Find a Tender data: free personalised radar page → paid bid desk | Owner or bid manager of an incorporated UK SME supplier | £49 radar / £149 bid desk → about $100 blended | ~100 | **~4%** (2–6%) | **~$1.8k** |
| 2 | Contract-award hiring signals for UK recruitment agencies (second wedge on the same pipeline) | Owner / BD lead of an agency in construction, facilities, care, IT, engineering | £99–149 → about $150 | ~67 | ~2% | ~$1.2k |
| 3 | Bench-CV packaging for IT-outsourcing firms, Ukraine first (the only defensible form of the team's favourite) | Head of sales / delivery, 10–500 staff | $49–149 → about $80 | ~125 | ~2% | ~$1.0k |
| 4 | Live AI translation for multilingual congregations (report B's #2) | Pastor / AV volunteer | $79–149 + hourly → about $140 | ~70 | ~2% (≈4% only if the founder is a church insider) | ~$1.2k |
| 5 | White-label AI-visibility audit for agencies (H #1, B #1) | Owner of a 1–20-person SEO/web agency | $49–199 → about $90 | ~110 | ~1.5% | ~$0.7k |
| 6 | Sales-tax exemption certificate management (F #1) | Controller / owner of a US distributor | $79–149 → about $120 | ~85 | ~1.5% | ~$0.9k |
| — | Team's favourite as framed: self-serve CV formatting for small recruitment agencies | Agency owner, 1–10 recruiters | $25–79 → about $50 | ~200 | **~1%** | ~$0.6k |

Candidate 1 followed by candidate 2 on the same pipeline within the year is my recommended path; the two are not independent, and I put the combined chance at about 5%.

The other attributes asked for, in one view (reasoning in 3.2–3.6):

| # | Acquisition mechanism | Time to first revenue | Moat | Paddle policy | One-day build |
|---|---|---|---|---|---|
| 1 | Cold email built from award notices, carrying a page pre-built for the recipient; list and addresses are in the open data | 2–4 weeks | None in data; bid library and history accumulate | Compatible; avoid "government service" look; no cold calls | Yes for radar; +1–2 days for bid desk |
| 2 | Cold email and LinkedIn with a real sector digest; list from directories | 3–5 weeks | None | Medium risk; must not be a contact or lead list | Yes (same pipeline) |
| 3 | Native-language LinkedIn, Telegram and booked calls; English outreach abroad | 1–3 weeks (prepaid invoice) | Weak (templates, history); market size caps it | Compatible; no candidate scoring | Parsing yes; template fidelity no |
| 4 | Personalised sermon demo by email and contact form; Sunday trial | 4–8 weeks | Weak (glossary, habit) | Compatible; hourly billing needs packs or tiers | Demo yes; live service no |
| 5 | Cold email carrying the agency's own audit | 2–4 weeks | None | Compatible on official APIs | Yes |
| 6 | Outbound to controllers; free audit-risk report after upload | 6–12 weeks | Strong once the archive is in use | Compatible; no "tax advice" framing | Partly; integrations take weeks |

### 3.2 Candidate 1 — UK public-contract copilot (radar → bid desk)

- **What it is.** A public page per supplier, keyed by Companies House number: past awards, similar live notices with deadlines, competitor contracts ending within nine months, buyers who place below-threshold work in the trade. Paid tiers: radar-pro (£49: several trades/regions, daily digest, expiry alerts) and bid desk (£149: upload a tender pack → bid/no-bid brief, requirement checklist with clause references, first-draft answers built from the firm's own past bids and policies).
- **Why I changed G's pricing.** G proposed £39–79 for alerts and itself warned that alerts are a cheap, crowded feature with a free official alternative and few relevant notices per subscriber (FACT, G 3.1). The bid step has higher price anchors: BidScout £49/£149, Stotles Bid Studio from £495, a consultant's bid review at £750 a day (FACT, section 2 row 23; G 3.1). G mentioned this as a monetisation option; the synthesis kept only the £39–79 version.
- **Acquisition mechanism and arithmetic.**
  - FACT (G): 3,155 incorporated SME suppliers with an email address appeared in five weeks of award notices; 1,594 of them with a generic mailbox; 782–984 new ones each week. Cold email to UK corporate subscribers is lawful (ICO). That is 1,400–2,700 fresh, lawful prospects a month, which matches B's base capacity of 1,800.
  - The email carries the finished product: "you won contract X from buyer Y; here are the live notices that resemble it and the competitor contracts ending near you", with a link to a page already built for that firm.
  - Base funnel: 18,000 prospects × 1.05 per 1,000 ≈ 19, plus LinkedIn ≈ 25 won, ≈ 20 paying × $100 = **$2.0k**. High funnel: ≈ 85 paying × $100 = $8.6k; $10k needs the high funnel and ARPA of about $120, meaning roughly a third of customers on the bid desk.
  - My estimate: 15% chance that this hook delivers a high-case funnel × 30% chance that ARPA and churn then hold ≈ 4%. Median assumes 1.5 customers per 1,000 and most buyers on the cheaper tier: ≈ 22 paying × $85 ≈ $1.8k.
- **Time to first revenue.** 2–4 weeks: pipeline and pages in 1–2 days, hand-sent outreach in week 1, first card payments in weeks 2–4. Bulk sending only from week 5–6 because of domain warm-up.
- **Moat.** None in the data (G: "data access is not a moat for any candidate"). What accumulates: each customer's bid library and answer history; the per-supplier pages; a sender reputation with a niche list. The distribution edge is one of willingness, not ability: incumbents could send award-based emails too.
- **Paddle.** Software subscription; compatible. Avoid looking like an official service ("Government Services") and avoid any "business opportunity" wording. Paddle forbids outbound telemarketing as a marketing method, so no cold calls (FACT, row 18). Ask Paddle in writing before launch.
- **One-day build realism.** High for ingest + pages + weekly digest (G measured about 125 API requests for five weeks of data). Bid desk v1 is 1–2 more days; tender documents sit behind 15+ portals, so the customer uploads the pack.
- **What would kill it.** Recipients do not open their page (channel assumption false); subscribers leave because few notices are relevant; a Claude or ChatGPT project with the firm's past bids is judged good enough; the Cabinet Office removes supplier emails from the feed; complaints to the ICO or Paddle. UNKNOWN: whether award winners are already targeted this way by others (one search found nothing either way).

### 3.3 Candidate 2 — contract-award hiring signals for recruitment agencies

- **Why it is on the list.** It combines G's verified data (1,516 award or contract releases a week, about 2,000 distinct suppliers, value on 92% and end date on 71% of contracts) with two facts found today: UK vacancies are at their lowest since 2014 outside the pandemic while candidate supply has risen for 44 months (row 12), and recruiters pay €99–£445 a month for business-development signal tools (rows 10–11). INFERENCE: in this market an agency's scarce input is client demand, not candidate handling. G ranked this wedge second but marked demand as an assumption; rows 10–11 are the first price evidence for it.
- **Product.** A weekly digest per sector and region: which companies just won multi-year contracts, with value, start date and buyer, and which contracts end soon. Company-level only; link to the public notice; no personal contact data.
- **Arithmetic.** The prospect list is not in the data; it must be built from trade-body directories and company registers (ASSUMPTION: 5,000–10,000 UK agencies in award-heavy sectors). Base funnel on 8,000 prospects ≈ 8, plus LinkedIn ≈ 14 won, ≈ 11 paying × $150 ≈ $1.7k; I cut the median to $1.2k because a single-signal product competes with multi-signal incumbents and recruiters are heavily pitched (INFERENCE).
- **Time to first revenue.** 3–5 weeks. **Moat.** None. **Build.** Same pipeline; one extra day.
- **Paddle.** Medium risk. It must be sold as monitoring software, not as lead lists or contact data; lead-data products are a stated risk area (report A). Written confirmation first.
- **Most dangerous assumption.** That public contract awards alone are a signal recruiters pay for.

### 3.4 Candidate 3 — bench-CV packaging for IT-outsourcing firms (Ukraine first)

- **Why it ranks above the agency version.** The buyer is reachable in the founder's native language, invoiced locally, and I found no product aimed at it (row 26). Staff CVs raise fewer data-protection questions than candidates' CVs (INFERENCE, F 10.5).
- **Arithmetic.** FACT (I): 1,500–3,000 such firms in Ukraine (I's own ASSUMPTION); 125 customers at $80 would be 4–8% of all of them. B has no benchmark for native-language outreach; ASSUMPTION: three times the English cold-email base. 2,500 firms × 3 per 1,000 ≈ 8 customers, plus English outreach abroad at base (≈ 10) → ≈ 14 paying × $80 ≈ **$1.1k**.
- **Evidence against.** Demand is unverified in both source reports (F: "none live"; I: "structural reasoning; demand unverified"). The buyers are engineers with AI seats and a Word template. The market is flat-to-slightly-growing (+4.1% in H1 2026, row 17), not a tailwind.
- **Time to first revenue.** 1–3 weeks if pre-sold by invoice. **Moat.** Stored templates and CV history; weak. **Paddle.** Compatible; do not add candidate scoring or ranking (row 18). **Build.** Parsing is a day; exact DOCX template fidelity is the hard part and decides whether it stays self-serve.

### 3.5 Candidate 4 — live AI translation for multilingual congregations

- **For.** The best verified precedent in report B outside the hype categories: Glossa grew verified monthly revenue six-fold in ten months (row 20). Entry prices have held at $79–150 (row 22), unlike CV formatting. Weekly use supports retention. US cold email is lawful, and a church's latest public sermon can be turned into a personalised demo.
- **Against (new today).**
  - Glossa is not a no-network precedent: it began as "an app for our own church", with a serial founder and a small team (row 21). Report B tagged it "NO audience signal" from X followers alone.
  - At least 13 products now compete (row 22), some with church-software integrations and interpreter-trained glossaries.
  - A failure during a Sunday service is public. Production-grade live audio is weeks of hardening, not a one-day build, and long-lived audio streams are a poor fit for a serverless stack (INFERENCE).
  - The Ukrainian/Russian-language wedge is thin: the visible segment is a few hundred Slavic congregations in the US (Southern Baptist lists show 115, "at least 200" estimated; search extract of Baptist Press), and incumbents already list both languages.
  - Phone outreach, the natural way to reach churches, conflicts with Paddle's telemarketing clause.
- **Arithmetic.** Trial-based sale: 0.7 meetings per 100 prospects × 20% close ≈ 2.5 customers a month from month 3 → ≈ 14–20 paying × $140 ≈ $2.0–2.8k at base; I cut the median to $1.2k for the 30% chance that live quality is not good enough in real rooms (ASSUMPTION).
- **Verdict.** Rank 4. It moves to rank 2 if the founder is an active member of a church network that would trial it. UNKNOWN; ask the founder.

### 3.6 Candidates 5 and 6

- **AI-visibility audit for agencies.** The hook is excellent and the build is a day, but the verified cohort shows a closed window: tools founded in mid-2025 reached $11k–45k MRR, tools founded from September 2025 onward sit at $26–$679 after 3–14 months, including one that lists cold email (row 19). GoHighLevel was expected to bundle an audit around 1 December 2026 (H, third-party source). Arithmetic: the base funnel gives about 20 paying × $90 ≈ $1.8k, but the verified late entrants are all under $0.7k, so I set the median at ~$0.7k and the chance at ~1.5%.
- **Exemption certificates.** Strong retention and a real price umbrella above $250, but a 2–8 week trust-heavy sale to US finance buyers by an overseas sole proprietor, no artefact that can be sent cold, integrations that take weeks, and the low end is now being cloned at $9.99–19.99 on Shopify (row 25). Arithmetic: ASSUMPTION of half the base conversion for this buyer (0.5 per 1,000 × 18,000 ≈ 9, plus LinkedIn ≈ 13 won, ≈ 11 paying × $120 ≈ $1.3k), cut to ~$0.9k for the long sales cycle. ~1.5%.

### 3.7 Considered and left out of the six

| Candidate | Why it is out |
|---|---|
| Self-serve CV formatting for small recruitment agencies (team's favourite as framed) | Section 4. ~1%, median ~$0.6k |
| PPC budget-pacing alerts (H #2) | Every sale needs OAuth access to client ad accounts for an unknown one-person vendor; Google's new API access process is a launch dependency; no artefact for the cold email (H 7.2). ~1.5% |
| UK Digital Waste Tracking (E #1) | Forced-purchase dates fall at months 11–12 and later; 267 listed vendors; many buyers are sole traders who cannot be cold-emailed, and cold calling conflicts with Paddle's policy. A 24-month candidate, not a 12-month one |
| Gmail → Notion saver (C #1) | $6–8 ARPA needs 1,250–1,670 subscribers; C's "$2–6k base case" rests on an unverified cumulative install count. ~1.5% |
| Read-only buyer-intent radar (B #3) | The category still mints 2026 winners (Traxy.ai, founded 2026-01, $54.7k MRR — FACT, TrustMRR), but data access is the whole product: GummySearch is shutting down for lack of a Reddit licence (H), clones verified at $19–76 MRR (H), and Paddle forbids products that enable breach of another party's terms |
| Scraping actors on Apify (J #1) | Usage revenue, not MRR; terms-of-service exposure; 3,329 actors from 704 developers in one contest (J) |
| Prozorro bid assistant (I #2) | About $33 ARPA → 300 customers; marketplaces give AI features free (I) |
| Consumer mobile app | Never considered by the team. It is the lane with the highest verified base rate (Mobile Apps 8.0% above $5k MRR; 4.6% of new subscription apps reach $10k a month within two years — FACT, B 1.2), but winners rely on paid social or short-video content, which this founder has no budget or stated skill for |

---

## 4. Direct attack on CV formatting for recruitment agencies

### 4.1 Ten reasons it fails for this founder

"Checked" means checked by me today; row numbers refer to section 2.

| # | Reason | What would confirm or refute it | What I checked | Status |
|---|---|---|---|---|
| 1 | **The product already exists many times over, and a newcomer's price anchor is $0.25–$1 per CV.** | Confirm: ten or more self-serve tools with public prices under $100 a month. Refute: clones are demo-gated or expensive. | At least 13 standalone formatters are named in today's sources: five incumbents (Allsorter, iReformat, HireAra, Candidately, Daxtra) and at least eight self-serve tools (RefineCV, Formatix, FormaCV, CVFormatter, RemakeCV, Sailee, Cluit, CV-Transformer). Prices in rows 1–5. An agency at RefineCV's "typical" 25 CVs a week pays $25–$99 a month. At $50 ARPA, $10k MRR is 200 agencies, not the 67–125 in the synthesis. | **Confirmed** |
| 2 | **A newcomer with this exact plan earns about nothing, verified.** | Confirm: payment-verified revenue of 2026 entrants near zero. Refute: a 2026 entrant with verified MRR above about $2k. | RefineCV (row 1): six months, a team, cold email, cold DM, SEO, a self-serve template builder, "5x cheaper than incumbents" → $70.52 in total. Counter-evidence: CVFormatter claims 200+ companies and RemakeCV "100s" (rows 3–4); both are unverified vendor claims and their launch dates are unknown to me. | **Confirmed for one case.** Category-wide: UNKNOWN |
| 3 | **Recruitment CRMs bundle it, and CRM vendors now campaign against paying twice.** | Confirm: native formatting in CRMs that small agencies use, ideally on cheap or free plans. Refute: CRMs offer it only through paid third-party integrations. | Recruit CRM's formatting agent (team's check); Recruitly on all plans including free (row 7); Manatal (row 9); Atlas's "stop paying twice" article (row 8); Paiger includes CV credits inside a business-development product (row 10). Not confirmed for Bullhorn, JobAdder, Vincere, Loxo or Recruiterflow: the pages I read did not show it, and the team found Vincere listing third-party formatters. | **Confirmed at the small-agency end**, which is the proposed target. Open at the large CRMs, where marketplace-integrated incumbents sit |
| 4 | **General assistants and Word's own AI do it at no extra cost.** | Confirm: recruiters saying publicly that they format into house style with a chatbot or Copilot. Refute: recruiters saying the output is not usable. | Two searches found no first-hand recruiter statement either way; Reddit cannot be searched from here. Indirect: a clone's home page pre-empts the objection (row 2). Recruiter commentary that I did find is about AI altering content: one agency's test reported that ChatGPT "lied on average 14 times" per CV (search extract of Personnel Today). That favours a verbatim tool and also shows low trust in AI touching CVs. Background, not re-checked: Claude and ChatGPT create .docx files; Word gained an agent mode in 2025. | **Not verified.** Plausible, unproven |
| 5 | **The buyers are heavily pitched and the cold email cannot carry their own result.** | Confirm: under 1% positive replies in a 300-email test. Refute: 5% or more. | Nothing direct. Indirect: 13+ vendors work the same list of agency owners; RefineCV lists cold email and cold DM and has about zero revenue. Without the agency's template, the email can only show a generic sample. | **Inference only** |
| 6 | **Candidate CVs are personal data and the processor would sit in a country without adequacy.** | Confirm: no adequacy decision; agencies asking for UK/EU processors. Refute: small agencies sign without asking. | No EU adequacy decision for Ukraine (row 16), so EU and UK agencies need transfer clauses and a transfer assessment for a Ukrainian sole proprietor, plus a disclosed AI sub-processor. HireAra sells data-retention periods as a plan feature (row 6), so retention is a buying criterion. Whether small agencies ask: UNKNOWN. | **Confirmed in law.** Commercial effect unknown; it bites at larger accounts, where the revenue per account is |
| 7 | **Template fidelity turns "self-serve" into per-client service.** | Confirm: incumbents set templates up by hand; tickets are about Word rendering. Refute: a self-serve template builder that works on arbitrary templates. | HireAra refuses free trials because it wants "live onboarding sessions, design support and training" (row 6); iReformat "We set up your existing template" and Allsorter "Custom Template Design Consultation" (team's check). RefineCV advertises a self-serve template builder and has no revenue. Paddle excludes offerings whose primary content is human services (row 18). | **Confirmed** that incumbents treat set-up as a service. Whether self-serve can work: UNKNOWN |
| 8 | **Staffing is cyclical; agencies cut tools and close.** | Confirm: contraction and insolvencies in 2026. Refute: growth. | Rows 12–15. UK: volatile and weak (October contraction after two months of marginal growth; vacancies at a decade low; a 2025 insolvency wave). US: first growth in three years. | **Partly confirmed for the UK, refuted for the US.** Not decisive |
| 9 | **It sits on the wrong side of the agency's constraint.** Report B's fast winners sit on the buyer's revenue line; formatting saves admin time in a market short of vacancies and long on candidates. | Confirm: revenue-side tools for the same buyer priced higher and bundling CV formatting. Refute: agencies naming formatting as a top pain. | Paiger £199–445 with CV credits bundled; Signalbase €99 (rows 10–11); vacancy and candidate data (row 12). | **Supported** (inference from facts) |
| 10 | **The arithmetic does not close even if 1–9 are wrong.** | — | At $50 ARPA, B's base funnel gives about 20 paying agencies and $1.0k MRR at month 12; a five-times-better funnel gives $4.3k (section 3.0). Incumbents with years, integrations and onboarding teams claim 200–1,000+ agencies. | **Inference from B** |

Two further constraints, not counted in the ten:

- FACT (row 18): Paddle prohibits "automated decision-making or categorization of people". Formatting is fine; the obvious upsells (candidate scoring, ranking, matching) are not.
- FACT (row 6): the incumbent can already undercut on seats. HireAra Starter gives unlimited users for £180, about £1.44 per candidate.

### 4.2 What did not hold up

- **"The staffing market is contracting in 2026."** Not as a general statement. US staffing revenue is growing 2.4% (row 14). The UK is weak and volatile, not collapsing (rows 12–13).
- **"Recruiters say ChatGPT is enough."** I found no public first-hand evidence for or against (reason 4).
- **"The Ukrainian IT-outsourcing sector is shrinking."** Exports rose 4.1% in H1 2026 (row 17). The bench wedge is limited by the number of firms, not by a shrinking market.

### 4.3 What survives

- The category is real: several vendors with hundreds to a thousand agencies each (vendor claims), prices from £180 to £950 at the top.
- The demo takes a minute, the output is checked by a human, and UK cold email to limited companies is lawful.
- The bench-CV wedge for IT-outsourcing firms has no visible direct competitor (row 26) and a native-language channel. It survives as a test, not as a plan.

---

## 5. Verdict

**I would launch candidate 1: the UK public-contract copilot.**

- **Wedge.** A page already built for each recent contract winner, sent to that firm: its own awards, the live notices that resemble them, the competitor contracts ending near it, and the buyers who place small contracts in its trade without a tender (G measured 509 below-threshold direct awards a week and saw no product under £100 a month offering this view). The paid step is the bid desk.
- **Price.** Free page. £49 a month radar-pro. £149 a month bid desk. Card-required 14-day trial (B 4c: card-required trials convert 25–50% against 3–18% without a card).
- **First 100 prospects.** Incorporated SME suppliers (Companies House number present) that appeared in an award notice in the last 14 days, in two trades: construction, and business services including cleaning and facilities. Suppliers to local government first (over 40% of the pool, G). Generic mailboxes only for the first batch.
- **Why it beats the team's favourite.**
  1. Its channel was measured, not assumed: list, email addresses, legality, weekly refill and the personalised hook are all FACT in report G. The CV candidate has none of these.
  2. It sits on the buyer's revenue line, which is report B's main pattern.
  3. Its paid tier has price anchors of £49–£495 a month; the CV candidate's anchor is $0.25–$1 per CV.
  4. It processes business documents, not thousands of candidates' personal data.
  5. The ingest-and-pages product really is a one-day build, and the whole thesis can be falsified in a week for the price of a few mailboxes.
- **Why it may still fail.** Section 3.2. The honest number is about 4%, and the median outcome is under $2k MRR.
- **If the supplier wedge fails its test,** run the recruiter-signals wedge on the same data before abandoning the pipeline. If both fail, the cost was about two weeks.
- **Where the team's favourite stands.** The agency version does not survive sections 2 and 4. The bench-CV version deserves the seven-day pre-sale test in 6.3 and nothing more until three firms have paid.

---

## 6. Seven-day experiments

A practical constraint applies to all of them: a new domain cannot send volume in week 1 (B 4a: start at 5–10 emails a day, 4–6 weeks of warm-up). Week-1 tests must be hand-sent from aged or pre-warmed mailboxes at no more than 20–25 emails per mailbox per day, plus LinkedIn and contact forms. No cold calls (Paddle policy). If Paddle's live approval is not through by day 3, take founding payments through a plata by mono payment link (report A: foreign cards at 2%).

### 6.1 Candidate 1 — supplier arm

| Item | Design |
|---|---|
| Build (days 1–2) | Ingest five weeks of Find a Tender data plus the daily increment; one public page per supplier; claim form; checkout |
| Audience (days 3–6) | 400 incorporated SME suppliers from the last 14 days of award notices, two trades, generic mailboxes |
| Message | Four plain sentences naming their award, a link to their page, sender identity, opt-out |
| Offer | Page free. Founding price £49 radar-pro, £149 bid desk. One free bid/no-bid brief for anyone who uploads a live tender pack this week |
| Action requested | Open the page → claim it → upload a pack or start a card trial |
| Success by day 7 | At least 30 unique page visits (7.5%); at least 10 claims (2.5%); at least 3 tender packs uploaded or 2 card-on-file customers; no more than 2 complaints |
| Kill | Fewer than 12 page visits (3%) or zero claims. The channel assumption is then false and product work will not fix it |
| How to read it | At B's base rate, two or more payers out of 400 happens about 7% of the time; at the high rate, about 60% (Poisson, INFERENCE). Two payers is strong evidence. Zero payers is weak evidence, which is why visits and claims are the leading indicators |

### 6.2 Candidate 2 — recruiter arm (same pipeline, days 4–7)

| Item | Design |
|---|---|
| Audience | 100 UK agencies (limited companies) in construction, facilities and care, taken from trade-body directories |
| Message | A real sample digest for their sector and region: the firms that won multi-year public contracts last week, with value and start date |
| Offer | Two free weekly digests, then £99 a month founding price |
| Action requested | Reply "send weekly", then card on file |
| Success by day 7 | At least 8 positive replies and at least 2 cards on file |
| Kill | Fewer than 3 positive replies |
| If both arms fail | Stop the pipeline. Do not fall back to £39 alerts |

### 6.3 Optional — the bench-CV pre-sale test (decides the team's favourite)

| Item | Design |
|---|---|
| Audience | 60 personal messages in Ukrainian to heads of sales, delivery or resourcing at IT-outsourcing firms (LinkedIn, DOU, Telegram groups), aiming for 15 calls |
| In the call | Ask for hours per month spent packaging CVs and the current method. Ask for one template and two CVs; return formatted output within 24 hours and record the minutes of manual fixing per template |
| Offer | Three months prepaid at $49 a month ($147), by invoice from the sole proprietor |
| Success by day 7 | At least 5 of 15 firms name 10 or more hours a month; **at least 3 prepay**; manual work per template under 30 minutes |
| Kill | Fewer than 3 prepayments, or templates need more than an hour of hand work each (then it is a service, which the brief and Paddle both exclude) |

---

## 7. Motivated reasoning and hidden assumptions in the team's reasoning

1. **"Competitor price lists prove willingness to pay."** They prove that agencies pay established vendors that have CRM integrations, onboarding staff and design support. HireAra says outright that it does not offer trials because onboarding is hands-on (row 6). That is not evidence that an unknown self-serve tool gets paid; row 1 is evidence that it does not.
2. **An inconsistent standard.** The synthesis rejects COI tracking, certified payroll and lien waivers because they were cloned, and states that build speed is no longer an advantage and that candidates should be chosen on distribution. The favourite was then chosen before its clone count was known and without any distribution advantage.
3. **The "gap" was a sampling artefact.** The team read four incumbents' pricing pages, saw demo-led sales, and inferred a free space in self-serve for small agencies. That space holds at least eight self-serve tools. Looking only at leaders cannot show whether the tail is empty.
4. **Manual template set-up was read as incumbents' laziness.** It is at least as likely a requirement of the job (reason 7). Report F said so: if set-up needs the founder's hands, "the model does not" work.
5. **ARPA was borrowed from the wrong segment.** $100–200 per agency comes from incumbents' prices for larger agencies. The proposed target, 1–10 recruiters on self-serve, faces $25–79 a month or $0.25–1 per CV. That doubles or triples the customer count.
6. **Report B's main pattern was cited and then ignored.** Synthesis point 3 says fast B2B winners are "bring me customers" tools. The favourite is an admin time-saver for a buyer whose current shortage is client demand (row 12).
7. **Report B's shortlist disappeared.** B's items 2–5 (live translation, intent radar, agent capability server, resale comps) are absent from the synthesis candidate table with no reason given. The table holds the niche analysts' own picks.
8. **The weakest evidence got promoted.** The favourite comes from the two reports that state they verified none of it (F: "not live-verified"; I: "structural reasoning; demand unverified"). The team's follow-up check looked for prices, which confirm, and not for clone revenue, which could disconfirm.
9. **"5–10%" was applied without its conditions.** B's range is a judgement for disciplined choices: ARPA of $100 or more, proven spending, direct sales from week one. The favourite fails the first condition at the small-agency end.
10. **Hidden precedent bias in report B.** "No audience" was read from X followers. Glossa, B's cleanest vertical precedent, started inside the founder's own church with a team (row 21). B flagged hidden audiences as a risk; the shortlist did not carry the caveat.
11. **Policy and timing assumptions nobody priced in.**
    - Paddle forbids marketing by outbound telemarketing (row 18). The founder's stated skill in sales calls can be used for booked calls only.
    - Domain warm-up removes the first 4–6 weeks of cold email from every plan (B 4a). Twelve months of selling is really about ten.
    - Paddle forbids automated categorisation of people (row 18), which blocks the natural expansion path of any CV product.
12. **My own pick carries the same kind of assumption.** Nobody has measured whether award winners open such an email or pay. I rank it first because that assumption can be tested in a week with data already verified, not because it is known to be true.

---

## 8. What I could not verify, and what would change my view

- **Could not verify:** first-hand recruiter views on formatting tools or chatbots; launch dates and real customer counts of CVFormatter, RemakeCV, Formatix, FormaCV and Sailee; native formatting in Bullhorn, JobAdder, Vincere and Loxo; 2026 UK agency insolvency counts; whether small agencies ask about data transfers; whether award winners already receive this kind of outreach; any revenue figure for a UK tender-alert or bid-writing vendor; Paddle's stance on tender or signal products; the size of the Ukrainian-speaking church segment.
- **Would raise CV formatting in my ranking:** a payment-verified 2026 entrant above about $3k MRR; proof that agencies on the large CRMs cannot get native formatting and that a newcomer can list in those marketplaces within weeks; or five agencies prepaying $99 or more in a seven-day test.
- **Would lower candidate 1:** the 6.1 kill criteria; evidence that incumbents already email award winners; Paddle declining the category; removal of supplier emails from the feed.
- **Questions for the founder that change the ranking:** Is the registered address outside the five regions Paddle excludes? Is there an active tie to a church community (moves candidate 4 to rank 2)? Is there a personal network among Ukrainian IT-outsourcing firms (raises candidate 3)? How comfortable is the founder with live demos in English (candidates 4 and 6 depend on it; candidates 1 and 2 do not)?

---

## 9. Sources read today

- Verified revenue: https://trustmrr.com/startup/refinecv.md ; https://trustmrr.com/startup/glossa-live.md ; https://trustmrr.com/startup/rank-prompt.md ; /sight-ai.md ; /clairon-ai.md ; /bevisible.md ; /brandpresence.md ; /traxy-ai.md ; /localprospects-ai.md ; https://trustmrr.com/category/recruiting ; https://trustmrr.com/llms.txt
- CV formatting vendors and CRMs: https://refine-cv.com/ ; https://remakecv.com ; https://cvformatter.co ; https://formatix.ai ; https://www.hireara.ai/pricing ; https://recruitly.io/features/agency-cv ; https://recruitwithatlas.com/blog/cv-formatting-software/ ; https://www.bullhorn.com/products/amplify/ ; https://recruiterflow.com/ai ; https://www.loxo.co/ai ; https://sagnikbhattacharya.com/blog/recruiters-ai-cv-formatting-tools ; search extract of https://www.manatal.com/blog/manatal-custom-resumes
- Recruiter business-development tools: https://paiger.co/prices ; https://www.trysignalbase.com/pricing
- Staffing market: https://kpmg.com/uk/en/media/press-releases/2026/10/kpmg-and-rec-uk-report-on-jobs-october-2026.html ; https://www.onrec.com/news/research-labour-market/uk-recruitment-activity-falls-again-as-uncertainty-and-costs-delay ; https://www.staffingindustry.com/news/global-daily-news/staffing-industry-seeing-growth-for-first-time-in-3-years ; https://www.staffingindustry.com/news/global-daily-news/uk-recruitment-firms-closing-at-fastest-pace-since-financial-crisis
- Policy and law: https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle ; search extracts of https://eurointegration.ccl.org.ua/?p=2484 and https://zmina.info/?p=507511
- Church translation: https://glossa.live/ ; https://www.oneaccord.ai/llms.txt ; https://www.vozo.ai/blogs/sermon-translation-software ; search extracts of faith.tools, App Store, Baptist Press and Product Hunt pages
- Bid writing and procurement: https://www.bidscout.co.uk/pricing ; https://winacontract.com/pricing (US product, $197/$397/$697, not used above) ; search extracts of the G-Cloud 15 price list for BIDSOFTWARE, the BCC/Tussell SME procurement tracker 2025 and Civil Service World
- Other: search extracts of https://itukraine.org.ua/en/ and https://itcluster.lviv.ua/en/ukraines-it-service-export-remains-resilient-h1-2026-results/ ; Shopify listings for ExemptSync and Self-Service Tax Exemption ; Flowcase listings on Capterra and Software Advice
- Round-1 files: `docs/research/SYNTHESIS.md` and `docs/research/round1/A`–`J`
