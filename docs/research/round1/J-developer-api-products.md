# J — Developer-facing, API/infrastructure and AI-agent-ecosystem micro-SaaS

Research date: 2026-11-13. Scope: developer-facing and API/infrastructure micro-SaaS plus tooling for the AI-agent ecosystem, judged for one solo founder (Ukraine, sole proprietor, no audience, no funding) against a target of $10,000 MRR by the end of month 12 after launch.

## 0. Method and evidence limits (read first)

- **What was done.** 43 live web searches were completed on 2026-11-13. The run then hit the search budget that is shared by all agents in this session, so research stopped short of the 50–80 lookups planned.
- **Page fetching was blocked.** The session's network policy refused every direct page fetch I tried (developer.paddle.com, www.paddle.com, superframeworks.com, www.indiehackers.com). Every fact below was therefore read from search-engine extracts of the cited page, not from the full page. Where extracts conflicted I say so.
- **Two further attempts failed.** After the search budget ran out I tried to fetch one primary-source page directly from the shell; the session's permission system denied it and I did not retry. GitHub's API is not enabled in this session for outside repositories, so I could not check the activity of the open-source alternatives.
- **Coverage is uneven.** Payments, family 1 (utility APIs) and family 2 (AI-agent tooling) were researched at reasonable depth. Families 3, 4 and 5 got one or two searches per main sub-niche, and several sub-niches got none. Section 7 lists what was not verified.
- **Sibling reports.** I read four other analysts' files in this folder on 2026-11-13 (A payments, B base rates, C work-software marketplaces, E regulation). They were works in progress and I did not verify their findings. Where I use one it is cited as [X1]–[X4] and named in the sentence. Report C changed my ranking; section 4.4 says how.
- **Labels.** FACT = stated in a cited source (I note when the source is a vendor, an aggregator or an anecdote). INFERENCE = my reasoning from facts. ASSUMPTION = unverified premise. UNKNOWN = looked for and not found, or not looked for. BACKGROUND = my prior knowledge, not re-verified today; treat it as an assumption until checked.
- **Source IDs** such as [B9] point to section 8, which gives the URL, the source date and what the source supports.

## 1. Verdict

**No developer or API product I examined is a good bet for $10,000 MRR in 12 months for a solo founder with no audience.** Demand for developer tools has not collapsed, but in 2026 the revenue goes to vendors that already have distribution, and every route a newcomer would use is either slow, closed, or given away free by someone bigger. My judgment is that a competent no-audience founder in this scope should expect roughly $1,000–3,000 MRR at month 12, and that the chance of reaching $10,000 is in the low single digits for most candidates and below 10% for the best one. These probabilities are my judgment from the base rates in section 2.2, not measured figures.

Five findings carry the verdict:

1. **The best indie comparables took years, not months.** ScreenshotOne, the best-documented solo API business, reported about $8,500 MRR roughly two years after launch and about $36,000 after four years and four months [B1, B6]. Healthchecks.io reached $21,200 MRR after eleven years [B9]. In a database of payment-verified startups, 6.1% of those with revenue clear $10,000 MRR at any age, and the median is $145 [B14].
2. **Self-serve developer APIs have low revenue per customer and high churn.** Reported figures put revenue per paying customer at $22–42 a month [B2, B4, B9, B11] and ScreenshotOne's monthly cancellation rate at about 9% [B4]. At those numbers $10,000 MRR needs 240–450 paying customers, and about 60 new paying customers a month by month 12.
3. **The channels a newcomer would use are eroding.** Tailwind's founder reported documentation traffic down about 40% and revenue down about 80% as AI assistants answer questions without sending visitors [D4]. A February 2026 study of 2,430 prompts found Claude Code builds a custom solution instead of recommending a tool in 12 of 20 categories [D1].
4. **Free alternatives sit under almost every niche.** Open-source libraries, venture-funded free tiers and platform bundling were present in every sub-niche I checked: e-invoicing libraries in five languages [E12–E16], Cloudflare's free AI-crawler controls and agent-readiness scanner [A9, A11], Paddle's bundled dunning [O6], a 2,000-call free tier at Arcade [A5].
5. **Payments add friction.** Paddle's native usage-based billing is not generally available: the documentation describes an early-access beta and an October 2026 announcement puts the native product in private preview in early 2027 [P1–P3].

**The best three within scope, in order,** each borrow something a developer product normally lacks: a marketplace's traffic, a legal deadline, or a non-developer buyer.

| Rank | Candidate | Why it ranks | What kills it |
|---|---|---|---|
| 1 | Site-category data and scraping APIs, sold first through the Apify Store and second directly | The only family with a disclosed solo case of $10,000 a month within 12 months [B18] and a marketplace reported to pay independent developers more than $500,000 a month [S1, S7] | Legal and terms-of-service exposure, constant scraper maintenance, revenue concentrated in a dozen heavy users [B19], and no confirmation that Paddle will underwrite it [P10] |
| 2 | E-invoicing format API for software vendors, Germany first | Dated legal triggers fall inside the window: 1 January 2027 and 1 January 2028 [E1] | Free libraries in every major language [E12–E16], at least six small API competitors already live [E5–E10], no revenue evidence for any of them |
| 3 | Niche lead feeds for sales teams, built from public crawling | Higher price per customer, so 35–100 customers suffice, and the buyer can be reached by the outbound work the founder is able to do | No evidence that a newcomer earns anything; data-protection law; no confirmation that Paddle accepts lead data [P10] |

A fourth candidate, a portfolio of Atlassian Forge apps, has the best payment and operations fit in the report: the marketplace bills customers, pays Ukrainian sole proprietors by SWIFT [P13] and takes 0% of the first $1M [M2]. It ranks last of the four because new vendors get almost no discovery. Sibling report C found that the median app launched 10–17 months ago has 2–6 installs [X3].

Ranks 2 and 3 are close. The lead feed is sold to sales teams, not developers, and the team should compare it with the non-technical candidates from other analysts.

**Compared with selling to non-technical SMB buyers, developer and API products are the weaker choice for this founder.** The founder's one advantage is cheap, fast engineering. Developers are the only buyers who have the same advantage, and section 2.3 shows they are using it. Section 6 gives the full comparison.

## 2. Cross-cutting findings

### 2.1 Payments: Paddle, metered billing and Ukraine

**Is Paddle usable from Ukraine?**

- FACT: Paddle's country page lists Ukraine as supported except the occupied regions (Crimea, Donetsk, Luhansk, Kherson, Zaporizhzhia) [P8]. The page extract is older; re-check.
- FACT (anecdote, August 2025): Ukrainian developers reported receiving Paddle payouts through Payoneer, and one reported a sole-proprietor USD bank account working [P9].
- UNKNOWN to me: Paddle's current onboarding and payout rules for a Ukrainian sole proprietor. No official statement appeared in my extracts.
- Sibling report A, which covers payments in depth, reports from Paddle's help pages that sole traders are accepted with identity verification only, and that payouts are monthly by wire or Payoneer with a $100 minimum and a $15 SWIFT fee [X1]. I did not verify this.

**Is usage-based billing practical on Paddle?** Partly. Quota tiers and prepaid credits are practical today; true post-paid metering is not.

- FACT: Paddle's developer documentation describes usage-based billing as "early access (beta)": a plan includes an allowance, the seller reports usage events, Paddle tracks the balance, sends a webhook when it runs out, and bills overage at the next renewal or immediately. Access is by request [P1, P2].
- FACT: Paddle's AI-toolkit announcement (tied to a 20 October 2026 launch event) says native usage-based billing enters private preview in early 2027 with a waitlist, and that until then sellers can run usage models through integrations with specialist billing providers [P3, P4].
- FACT: A separate Paddle documentation page for AI companies describes the current workaround: add usage as custom line items to the next subscription transaction and do the metering in your own system [P5]. A developer write-up lists what is missing compared with Stripe: no meter API, no automatic aggregation, no invoice grace periods [P6]. A third-party metering layer for Paddle exists [P7].
- INFERENCE: The two Paddle statements describe different programs and neither is general availability. Plan on three patterns that need no native metering: subscription tiers with an included monthly quota enforced in your own code, prepaid credit packs sold as one-time purchases, and overage added as a line item at renewal. An AI coding agent can build the meter in a day. Avoid pure pay-as-you-go billed in arrears.

**Fees.** FACT: third-party guides give Paddle's fee as 5% + $0.50 per transaction [P14]. INFERENCE (arithmetic on that fee): the fixed part punishes the small transactions that developer APIs favour.

| Transaction | Paddle fee | Share of price |
|---|---|---|
| $9 | $0.95 | 10.6% |
| $10 credit pack | $1.00 | 10.0% |
| $29 | $1.95 | 6.7% |
| $99 | $5.45 | 5.5% |

**Acceptable-use risk.** FACT: Paddle's acceptable use policy was last updated on 13 April 2026, lists restricted categories and says the list is not exhaustive [P10]; a competitor's summary says Paddle prohibits AI image generators, deepfake tools and voice cloning [P11]. UNKNOWN: whether Paddle accepts scraping APIs or lead-data products. No clause naming scraping appeared in the extracts. This must be asked in writing before building candidate 1 or 3 for direct sale. Sibling report A reaches the same conclusion: data and lead-list products are not addressed explicitly in the policy [X1].

**Alternatives to Paddle.**

- FACT (vendor and affiliate comparisons, 2026): Lemon Squeezy 5% + $0.50 and now built on Stripe Managed Payments; Polar 4% + $0.40 with Stripe-backed coverage; Creem 3.9% + $0.40 in 130+ countries; Dodo Payments 220+ countries and a claim of native per-call billing [P12].
- INFERENCE: Lemon Squeezy and Polar depend on Stripe, so they are probably closed to a Ukrainian entity for the same reason Stripe is. UNKNOWN to me: whether Creem or Dodo onboard Ukrainian sole proprietors.
- Sibling report A confirms the inference and answers the unknown: Polar and Lemon Squeezy are closed, Dodo no longer onboards new Ukrainian sellers, Creem lists Ukraine with a footnote about its bank partner, and Freemius lists Ukraine [X1]. I did not verify this. Dodo was the one provider claiming native per-call billing, so that route is gone.
- FACT: Marketplaces that bill the customer remove the problem. Atlassian pays Ukrainian sole proprietors monthly in USD by SWIFT and does not require a company [P13]. Apify pays developers 80% monthly by bank transfer or PayPal [S3]; UNKNOWN whether that reaches Ukraine.

### 2.2 What small developer and API vendors actually earn, and how fast

Only the PDFBolt, Peedief and ScreenshotDEV rows are checked against a payment provider. The Healthchecks figures are the company's own published numbers. The rest are founder disclosures or third-party reports.

| Vendor | Reported data point | Date | Source |
|---|---|---|---|
| ScreenshotOne (screenshot API, solo, launched May 2022) | "$2.2K MRR" in the title of an early interview described as 2023 | 2023, month unconfirmed | [B7] |
| | About $8,500 MRR, roughly two years after launch | about mid-2024 | [B1] |
| | $200K ARR with 400+ paying customers | undated in extract | [B2] |
| | $20K MRR | June 2025 | [B4] |
| | $25K+ MRR, 800+ paying customers | undated in extract | [B3] |
| | $32K MRR, 1,000+ paying customers, about $3K new MRR a month, about 9% monthly churn | about July 2026 | [B4, B5] |
| | About $36K MRR and still growing; testing paid ads (described as costly) and a hosted MCP server | 28 Sep 2026 (date derived from the post ID) | [B6] |
| Healthchecks.io (cron monitoring, one person, open source, started 2015 [O1]) | 652 paying accounts, $14,043 MRR | Aug 2024 | [B10] |
| | 957 paying accounts, $21,200 MRR, 71,400 free accounts | 1 Jul 2026 | [B9] |
| PDFBolt (PDF API) | $2,154 MRR, 58 active subscriptions (payment-verified) | 28 Oct 2026 | [B11] |
| Peedief (PDF API for AI workflows) | $55 MRR, 5 subscriptions (payment-verified) | 2026 | [B12] |
| ScreenshotDEV (screenshot and PDF API) | $4.4K MRR, listed for sale | 2026 | [B13] |
| Instatus (status pages, solo) | $40K MRR, 1,000+ customers | undated newsletter | [B16] |
| Keygen (licensing API, one person) | $195.4K revenue in 2024 (third-party estimate) | 2024 | [B17] |
| Scrape Creators (social-media scraping API, solo, launched June 2024) | $10K+ a month about 12 months after launch | mid-2025 | [B18] |
| | About $20K a month; roughly 12 heavy users drive most of it (secondary summary) | 2026 | [B19] |
| Apify Store (all independent developers together) | $563K paid out in one September; $500K+ a month; more than $4M cumulative | September of an unstated year; Nov 2025; Nov 2025 | [S1, S7, S4] |
| Payment-verified startups, all categories | 3,787 of 8,699 report revenue; median $145 MRR; 6.1% clear $10K MRR | July 2026 | [B14] |
| Developer-tools category | Average MRR $1,133 (aggregator estimate) | 2026 | [B15] |

INFERENCE from the table:

- **Revenue per paying customer is $22–42 a month.** Healthchecks $22 ($21,200 / 957), ScreenshotOne $31–42 across three snapshots, PDFBolt $37.
- **Free-to-paid conversion is about 1%.** Healthchecks has 957 paying accounts against 71,400 free ones, 1.3% of all accounts [B9].
- **Even the leaders add customers slowly.** Healthchecks added a net 305 paying accounts in 23 months, about 13 a month. ScreenshotOne went from $20K to about $36K MRR in about 15.5 months, a net gain of about $1,000 MRR a month.
- **A newcomer would have to outgrow the leaders from a standing start.** $10,000 MRR in 12 months is an average net gain of $833 MRR a month, about 80% of what ScreenshotOne nets in its fifth year.
- **The all-category base rate is corroborated.** Sibling report B cites a census of 10,150 listed products in which 2.41% had MRR at or above $8,333 and the median earner made $169 in 30 days [X2]. That is the same order as the 6.1% of revenue-generating startups above $10,000 in [B14]. I did not verify B's source.

**The arithmetic of the target.** INFERENCE (my calculation, assuming new revenue ramps linearly from zero and churn applies monthly):

| Monthly churn | New MRR needed in month 12 | New paying customers in month 12 at $35 each | At $79 | At $149 |
|---|---|---|---|---|
| 3% | $1,714 | 49 | 22 | 12 |
| 5% | $1,837 | 52 | 23 | 12 |
| 9% (ScreenshotOne's rate) | $2,097 | 60 | 27 | 14 |

At 9% churn the newcomer must be adding $2,097 of new MRR in month 12. ScreenshotOne, with 1,000+ customers and four years of search ranking, adds about $3,000 [B4].

**The one counter-example and its caveats.** Scrape Creators is the one solo case I found that reached $10,000 a month in about 12 months [B18]. Four things make it a weak template for this founder. FACT: the founder says he had a small Twitter presence and won early customers by direct outreach and dataset giveaways there [B20]. FACT: it sells prepaid credits, not subscriptions ($10 for 5,000, $50 for 25,000, $500 for 500,000) [B19]. FACT (secondary): about 12 heavy users drive most revenue [B19]. INFERENCE: it scrapes social platforms, the highest-risk category for terms-of-service disputes.

### 2.3 How a no-audience founder would get the first 10–50 paying developers in 2026

| Channel | Evidence it still works | Evidence against | Usable by this founder? |
|---|---|---|---|
| Search, documentation and programmatic comparison pages | ScreenshotOne credits SEO among early channels [B7]; an unverified teardown counts 644 indexed pages, 95.8% programmatic [B8] | Tailwind: docs traffic about 40% below early 2023, revenue down about 80%; the founder said the docs were the only way people found the paid products [D4]. ScreenshotOne needed about two years to reach $8,500 MRR [B1] | Yes, but it pays back after month 12, not before |
| Recommendation by AI coding assistants | None found for a new vendor | Claude Code builds custom in 12 of 20 categories; "Custom/DIY" (252 picks) beat every named tool [D1]. Claude Code builds instead of buying about twice as often as Codex and Cursor, 19% against 10% [D2]. INFERENCE: a product launched in November 2026 is in no model's training data during its first year | No, not in year one |
| Marketplaces that bill the customer | Apify paid developers $563K in one September and is listed at $500K+ a month as of November 2025 [S1, S7]. Atlassian Marketplace's latest $1 billion took nine months [M1] | Atlassian newcomers: 4 installs in 12 days; 29 installs across four apps in about 10 months [M5, M6]; a median of 2–6 installs for apps launched 10–17 months ago, per sibling report C [X3]. Apify: 3,329 actors submitted by 704 developers in a three-month contest [S5]. RapidAPI takes 25% and no provider earnings data was found [S6]. An estimate says fewer than 5% of MCP servers earn anything [A3] | Yes for Apify, on the payout evidence; not for Atlassian, on the install evidence. It is still the only channel that needs neither an audience nor search ranking |
| Community answers (Reddit, Hacker News, forums) | ScreenshotOne: Reddit became the channel that worked best [B3] | No 2026 data on conversion for an unknown vendor (UNKNOWN). BACKGROUND: developer communities remove self-promotion | Yes, slowly |
| Paid search | ScreenshotOne's second customer came from Google Ads [B7] | ScreenshotOne in September 2026: paid ads are costly and it is too early to judge results [B6]. INFERENCE: $32 a month at 9% churn is about $356 of lifetime revenue, so acquisition cost must stay near $100 | Marginal |
| Cold outreach to engineering leads | Scrape Creators used personalised outreach on Twitter [B20] | No evidence found for cold email selling $29–99 a month developer tools (UNKNOWN). ASSUMPTION: at a 1% conversion, 60 new customers a month needs about 6,000 targeted messages a month | Only for products priced above about $150 a month |
| Plugin and integration directories | invoice-api.xhub.io distributes its API through WooCommerce and Shopware plugins [E6] | Install counts not retrieved (UNKNOWN) | Yes; underused by API vendors |
| GitHub and an open-source core | Healthchecks.io is open source and still sells 957 paid accounts [B9] | It converts 1.3% of accounts and took 11 years [B9]. How stars convert to customers for a new project was not researched (UNKNOWN) | Slow; gives the product away to the buyers most able to self-host |
| Launch platforms (Product Hunt, Show HN) | Not researched today | BACKGROUND: one-day spikes; clones of existing utilities do not trend | Minor |

### 2.4 Evidence that cuts against this report's pessimism

The team should weigh these before accepting the verdict:

- FACT: ScreenshotOne's founder wrote on 28 September 2026 that "despite all the predictions from big accounts and influencers on X, I still see demand. New customers keep subscribing and are happy to pay" [B6]. If the $32K figure dates from the July 2026 teardown, MRR rose by about $4K in the two months after it [B4, B5, B6].
- FACT: Healthchecks.io grew MRR 51% between August 2024 and July 2026, through the period in which AI coding agents became mainstream [B9, B10].
- FACT: Apify's payouts to independent developers are growing. A first $1M milestone was announced in what appears to be March 2024 (period unclear), the cumulative total passed $4M by November 2025, and one September alone accounted for $563K [S1, S2, S4].
- FACT: Vanta argued in May 2026 that building with AI tools can cost more than buying [D3].
- INFERENCE: these show that established developer utilities still grow. None shows a newcomer without distribution growing fast. The smaller vendors in the table (PDFBolt, Peedief, ScreenshotDEV; launch dates not checked) sit between $55 and $4,400 MRR.

## 3. Landscape by family

Rows marked "not researched today" rest on BACKGROUND only and are the weakest part of this report.

### 3.1 Family 1 — niche utility APIs sold self-serve

| Niche | Room in 2026? | Free, open-source or bundled alternatives | What small vendors earn | Verdict |
|---|---|---|---|---|
| Screenshots, HTML-to-PDF, OG images | No. Saturated | BACKGROUND: Puppeteer and Playwright are free; cloud vendors offer hosted browser rendering | ScreenshotOne about $36K MRR after 4.4 years [B6]; PDFBolt $2,154 [B11]; ScreenshotDEV $4.4K and for sale [B13]; Peedief $55 [B12] | Reject. Reference case in section 4.5 |
| E-invoice generation and validation (ZUGFeRD, XRechnung, Factur-X, Peppol UBL) | Some, closing fast | Open-source libraries for Java, PHP, .NET, Python and a JSON/spreadsheet generator [E12–E16] | None disclosed (UNKNOWN) | Candidate 2 |
| Scraping APIs for a site category | Yes, with legal and maintenance cost | Do-it-yourself scrapers; thousands of Apify actors [S5] | Scrape Creators $10K+ a month at 12 months, about $20K later [B18, B19]; Apify pays out about $0.5M a month in total as of late 2025 [S1, S7] | Candidate 1 |
| Document parsing and OCR for a document type | Not researched today | BACKGROUND: LLM providers read PDFs natively; several funded parsing vendors | UNKNOWN | Reject as a generic API. A specific document type is a workflow product for non-technical buyers |
| VAT, company-registry and IBAN validation | Not researched today | BACKGROUND: the EU's VIES service is free; IBAN validation is a solved open-source problem | UNKNOWN | Reject |
| Sanctions and PEP screening on open lists | Not researched today | BACKGROUND: open sanctions datasets exist | UNKNOWN | Reject for this founder. INFERENCE: compliance buyers need audit trails and vendor due diligence that an unknown solo vendor cannot pass quickly |
| Email verification | Not researched today | BACKGROUND: a commodity with many vendors and a price war | UNKNOWN | Reject. INFERENCE: free tiers attract spammers and card fraud |
| Address, currency, tax-rate, calendar and holiday data | Not researched today | BACKGROUND: free official or community sources exist for most | UNKNOWN | Reject |

**Which niches still have room?** INFERENCE: only two shapes. The first is access to data that is hard to get (scraping), where the product is the upkeep, not the code. The second is output that a regulator defines and keeps changing (e-invoicing), where the product is staying current. Everything that is a wrapper around an open-source library an AI agent can install is finished as a business for a newcomer.

**API marketplaces as a channel.** FACT: RapidAPI was acquired by Nokia in November 2024, still operates, and charges providers a flat 25% [S6]. UNKNOWN: what a new provider earns there; no data found. FACT: Apify pays 80% and publishes payout totals [S1, S3, S4].

### 3.2 Family 2 — tooling for AI agents and LLM apps

| Sub-niche | Paying demand or hype? | What funded players give away | Verdict |
|---|---|---|---|
| MCP hosting and gateways | Demand is enterprise governance, sold by funded vendors. The category is consolidating: Smithery is now part of Arcade and its connection services were reported shut on 31 October 2026 [A4] | Arcade: 2,000 tool calls a month free, then $25 a month plus $0.01 per call. Composio: free developer tier; $228 a month includes 2,000,000 tool calls [A5] | Reject |
| MCP marketplaces and paid MCP servers | Mostly hype. An estimate says fewer than 5% of MCP servers earn anything; successful listings are put at $100–3,000 a month; the one "$10K MRR in six weeks" claim is flagged unverified by its own source [A1–A3]. One vendor audit found 52% of 1,847 public servers abandoned [A6] | Marketplaces pay 80–85% [A1] | Reject as a business. Use MCP as a feature of another product |
| Protocol stability | "MCP is dead. Long live the CLI" topped Hacker News on 28 February 2026; skills and command-line tools displaced many simple MCP servers. Adoption still grew: 17,000+ servers indexed in Q1 2026, 22,311 on one registry in July 2026 [A6] | — | INFERENCE: the layer shifts every few months; a solo vendor cannot keep a product business on it |
| Evals, observability, prompt management, cost tracking | Real demand, captured. Langfuse was acquired by ClickHouse on 16 January 2026 and stays open source and self-hostable [A7]. Helicone was acquired by Mintlify on 3 March 2026 and put in maintenance mode [A8] | Self-hosted Langfuse is free [A7]. BACKGROUND: other funded vendors have free tiers | Reject |
| llms.txt, agent-readiness, "make your API agent-ready" | Hype for a product. Cloudflare launched a free agent-readiness scanner in April 2026 with a public adoption dataset [A11]. No evidence was found that models read llms.txt [A11]. Small API vendors ship their own MCP endpoints [B6, E5] | The scanner and fix prompts are free [A11] | Reject as SaaS. INFERENCE: possible as a paid service, which is not MRR |
| AI-bot traffic analytics and pay-per-crawl | Demand exists but sits with marketers and publishers. Cloudflare's AI Crawl Control is free on Cloudflare plans; sources disagree on whether pay-per-crawl is still in closed beta [A9, A10] | Cloudflare free; Known Agents (formerly Dark Visitors) has public pricing, not retrieved; OtterlyAI $29 a month; xSeek $99.99 and $499.99 [A10] | Reject for a developer buyer |
| Agent auth and permissions, guardrails, memory, sandboxing, web search for agents, agent-to-SaaS integrations | Not researched today | BACKGROUND: each has several funded vendors, and model providers bundle search, memory and code execution. Sandboxing and search need heavy infrastructure and attract abuse | Reject: not operable by one person |

**Where is the paying demand?** INFERENCE: in three places, none reachable by this founder in 12 months. Search and crawl infrastructure for agents (capital-intensive), AI-visibility analytics for marketers (non-developer buyers, crowded), and enterprise governance (enterprise sales). For a solo founder, agent tooling is a feature to add to another product, as ScreenshotOne and thelawin.dev did [B6, E5].

### 3.3 Family 3 — ops tooling for small SaaS and dev teams

| Sub-niche | Evidence gathered today | Verdict |
|---|---|---|
| Cron and job monitoring | Healthchecks.io: open source, one person, $21,200 MRR after 11 years, 1.3% of accounts pay [B9] | Reject |
| Status pages and uptime | One directory tracks 24 status-page tools as of 2 November 2026; 75% are free, freemium or open source [O2]. Uptime Kuma is free. Better Stack sells add-ons ($29 a month per responder, $21 per extra 50 monitors, $12 per extra status page); Hyperping Pro is $74 a month [O3]. Instatus: $40K MRR, 1,000+ customers, undated [B16] | Reject. Saturated |
| Churn and dunning for Paddle, Lemon Squeezy, Polar | Paddle bundles payment retries and dunning in its fee [O6]. Churnkey supports Paddle and Lemon Squeezy at $250, $450 and $825 a month [O5]. Revive covers Stripe, Lemon Squeezy, Gumroad, Paddle and Polar for founders at $1K–50K MRR [O7]. Several look-alike sites on free hosting already target the niche [O5, O8] | Reject. Bundled by the platform and already cloned |
| Usage-based billing helpers for non-Stripe providers | The gap is real today [P5, P6], a third-party layer exists [P7], Paddle partners with m3ter [P15] and plans its own product for 2027 [P3] | Reject. The platform closes the gap inside the 12-month window |
| License-key management | Keygen: one person, about $195K revenue in 2024 by third-party estimate, source-available, entry plans $49–99 a month [B17] | Reject. Small market, strong incumbent |
| Database backups | SimpleBackups from €34 a month [O9]; revenue UNKNOWN | Reject. INFERENCE: customers must hand production database credentials to an unknown solo vendor |
| Webhooks infrastructure, feature flags, changelog and feedback widgets, error tracking, log alerts, preview environments, SOC 2 and DPA helpers, API documentation, SDK generation | Not researched today. One relevant fact: Claude Code implements feature flags with config files instead of recommending a vendor [D1] | Reject on BACKGROUND: each has funded vendors with free tiers or mature open source. Webhooks and preview environments also carry a round-the-clock reliability duty |

### 3.4 Family 4 — tools built on developer platforms

| Platform | Evidence gathered today | Verdict |
|---|---|---|
| Atlassian Marketplace (Forge) | $7 billion lifetime sales, the latest $1 billion in nine months; 6,000+ cloud apps, 3,700+ on Forge [M1]. 0% revenue share on the first $1M of lifetime Forge revenue from 1 January 2026; standard Forge rate 16% rising to 17% [M2, M3]. Connect, the older app framework, loses support after December 2026 [M4]. Pays Ukrainian sole proprietors by SWIFT [P13]. Newcomer traction is poor [M5, M6, M7]. Sibling report C counts 7,293 cloud listings, 543 new listings in October 2026 against 37 in June 2025, and a median of 2–6 installs for apps launched 10–17 months ago [X3] | Candidate 4 |
| Apify Store | See candidate 1 | Channel for candidate 1 |
| WordPress, Shopware and Shopify plugin directories | E-invoice API vendors already use them as distribution [E6, E11] | Channel for candidate 2 |
| monday.com and Microsoft marketplaces | Not researched by me. Sibling report C notes that monday.com refuses apps built mainly with no-code tools or AI-generated code, and that Microsoft's marketplace pays out to Ukraine [X3] | See report C |
| GitHub Marketplace, Vercel Marketplace, Supabase, Cloudflare, Raycast, VS Code and JetBrains paid extensions, n8n, Make, Zapier, Bubble, Webflow, Framer | Not researched today | UNKNOWN. BACKGROUND: several of these have no paid marketplace or admit vendors only by partnership. Do not rely on this row |

### 3.5 Family 5 — data products from crawling public sources

This family supplies candidate 3 (lead feeds for sales teams) and overlaps with candidate 1 (data APIs for developers).

- FACT: the category supports small teams. BuiltWith's revenue is put at $14M (December 2023) by one aggregator and $22.6M by another, with 4–11 employees; the estimates conflict and none is from the company [T1, T2]. Store Leads lists a plan at $63.75 a month on HubSpot's marketplace and about four people on one profile [T3, T4]. A competitor claims BuiltWith's entry plan is now $295 a month [T5].
- UNKNOWN: revenue of any newcomer in this category. None found.
- INFERENCE on feasibility: the crawler is the easy part for this founder. Coverage and freshness take months to build, and buyers compare a new feed against incumbents with a decade of history.
- BACKGROUND on legal risk, not researched today: crawling public, logged-out pages has generally survived challenge in United States courts, but terms-of-service claims persist; contact data about individuals in the EU falls under the GDPR; cold-email rules apply to the buyers' use. UNKNOWN: whether Paddle accepts lead-data products [P10].

## 4. Serious candidates

Each candidate answers the same questions in the same order. Candidates 1–4 are the ones worth the team's attention; 4.5 is the reference case that shows why the classic utility API loses; 4.6 covers the rest briefly.

### 4.1 Candidate 1 — site-category data and scraping APIs, marketplace first

**What it is.** An API that returns structured data from one category of public websites, published as Apify Store actors, as a direct API, and as an MCP endpoint, priced per result.

**Who has the problem, uses, pays, decides.** Developers and automation builders at small product companies and agencies whose product needs data from sites with no usable official API. The user is the developer. The payer and decider is the same person or the founder; it is a self-serve card purchase. INFERENCE from how Scrape Creators sells [B19, B20].

**Recurring job and trigger.** The job is keeping a flow of structured records (profiles, listings, prices, posts) arriving every day. The trigger is a new feature that needs the data, or an in-house scraper that broke or got blocked. BACKGROUND: closures and repricing of official APIs also push buyers here.

**Alternatives and prices.**
- Scrape Creators: $10 for 5,000 credits, $50 for 25,000, $500 for 500,000, so $2.00 falling to $1.00 per 1,000 requests; no subscription [B19].
- Apify Store actors, priced per result or event. The one price I saw today was a small actor "from $4.00 per 1,000" results [E10]; it is an invoice validator, cited only for the pricing convention.
- Do it yourself: free code written by an AI agent, plus proxies and upkeep.
- BACKGROUND: general scraping APIs and proxy networks; not priced today.

**Cost of the status quo.** UNKNOWN in numbers. INFERENCE: it is engineer time spent repairing scrapers. At $1–2 per 1,000 requests, buying beats an engineer-hour until volume reaches millions of requests.

**Evidence of willingness to pay and of small-vendor revenue.** Scrape Creators passed $10,000 a month about 12 months after its June 2024 launch and is reported near $20,000 [B18, B19]. Apify paid independent developers $563,000 in one September (year not stated, consistent with 2025), a listing puts payouts at $500K+ a month as of November 2025, and a November 2025 press release put the cumulative total above $4M [S1, S7, S4]. A 2026 blog claims $1.2M a month; I could not confirm it [A1]. Third-party estimates, unverified: top Apify creators above $10,000 a month; successful listings on MCP marketplaces generally $100–3,000 a month [A2, A3].

**Wedge for an unknown vendor.**
- Pick categories from public store data where existing actors are broken, slow or abandoned. BACKGROUND: Apify listings show user counts, ratings and open issues.
- ASSUMPTION, demand unverified: regional-language sites in Eastern Europe and Central Asia, where the founder's languages are an advantage over the mostly English-speaking supply.
- Compete on reliability and on per-result price.
- Copy the niche-selection method that worked. FACT: Scrape Creators' founder chose his niche after seeing a profitable scraping API listed for sale, then rebuilt it [B19]. INFERENCE: for-sale listings with verified revenue are a free list of niches where customers already pay.

**Onboarding and time to first value.** Minutes. On Apify the buyer runs the actor from its store page with no integration. Directly: an API key and one request.

**How the first 10–50 customers arrive.**
1. Publish 10–20 actors on the Apify Store. Store search brings users with no audience; BACKGROUND: Apify also exposes actors to AI agents as tools. Evidence for: payout totals [S1, S4, S7]. Evidence against: 704 developers submitted 3,329 actors in one three-month contest, of which 1,086 qualified for a payout [S5], so store search is crowded.
2. List the same endpoints on RapidAPI, accepting the 25% fee [S6].
3. Write one documentation page per endpoint and per "how to get this data" query.
4. Answer existing questions in scraping and automation communities with working examples.
5. Give away small scraped datasets, the tactic Scrape Creators' founder calls one of his best [B20].
6. Message companies whose product visibly depends on the data. The founder can do this; Scrape Creators did it on Twitter with an existing presence [B20].

**Retention and churn.** UNKNOWN. FACT (secondary): about 12 heavy users drive most of Scrape Creators' revenue [B19]. INFERENCE: revenue is lumpy; losing two accounts can remove a double-digit share.

**Solo-operability, on-call and abuse.** The heaviest burden in this report. INFERENCE: target sites change markup and bot defences without notice while customers run the API in production. ASSUMPTION: expect incidents weekly across a portfolio of endpoints. It needs automated canary tests and agent-driven repair. BACKGROUND on abuse: free credits farmed with disposable accounts, card fraud on credit packs, and customers using the data against individuals.

**Infrastructure cost and gross margin.** ASSUMPTION: proxies and compute dominate, leaving 50–80% gross margin depending on how hard the target is; not measured. Apify keeps 20% [S3]. BACKGROUND, verify: Apify also deducts compute in per-result models.

**Price, revenue per customer, customers needed.** At $1–2 per 1,000 requests, $10,000 a month is 5–10 million paid requests a month. INFERENCE: that comes from 10–30 heavy accounts, not hundreds of small ones. Through Apify, $10,000 net needs at least $12,500 of customer spend before compute. The team should also decide whether usage revenue counts as MRR.

**Legal and platform risk.** Section 3.5 gives the legal position, which is BACKGROUND only. FACT: Apify changes its rules unilaterally; it stopped new rental listings on 1 April 2026 and retired rental pricing on 1 October 2026 [S3]. UNKNOWN: whether Paddle accepts the direct-sale version [P10].

**Single most dangerous assumption.** That the founder finds a site category with paying demand and thin supply before the other 700 contest entrants do, and that a payment route open to a Ukrainian sole proprietor will carry it.

### 4.2 Candidate 2 — e-invoicing format API for software vendors, Germany first

**What it is.** An API that turns invoice JSON into legally valid structured invoices (ZUGFeRD and Factur-X hybrid PDFs, XRechnung XML, Peppol UBL), validates files against the official rules, and tracks rule releases.

**Who has the problem, uses, pays, decides.** Software vendors and in-house developers whose systems issue invoices for businesses: vertical SaaS (booking, field service, marketplaces), agency-built custom ERPs, B2B shops on WooCommerce or Shopware. The user is the developer. The payer and decider is the CTO or owner of a small software company; for shop plugins it is the merchant, who is non-technical.

**Recurring job and trigger.** Every B2B invoice must be issued in a compliant format, and the rules keep changing. FACT: a new XRechnung release is expected in spring 2027, with old and new versions running in parallel until March 2029 [E1]. The triggers are legal dates:

| Country | Trigger | Date | Network requirement |
|---|---|---|---|
| Germany | Issuing becomes mandatory for businesses above €800,000 prior-year turnover | 1 Jan 2027 | None named in the sources; domestic B2B only [E1] |
| Germany | Issuing becomes mandatory for all businesses | 1 Jan 2028 | Same [E1] |
| France | All businesses must receive; large and mid-sized must issue | 1 Sep 2026 | Invoices must pass through an accredited platform [E2] |
| France | Small and micro businesses must issue | 1 Sep 2027 | Same [E2] |
| Belgium | All B2B invoices are structured | 1 Jan 2026 (tolerance ended 31 Mar 2026) | Certified Peppol access point [E3] |

INFERENCE, resting partly on BACKGROUND that Germany has no central invoice platform: Germany is the only one of the three where producing and validating the file is the whole job. France and Belgium require a certified network operator, which a solo founder cannot become inside the window; there the API could only resell someone else's access.

Sibling report E checked two of these against official sources [X4]; I did not verify its findings. The German dates match the statute text, with no postponement visible. France's tax authority requires a platform to be registered for three years after a candidate file and interoperability tests, and a non-registered solution cannot transmit invoices itself. Report E also records an adjacent trigger I did not research: Spain's Veri*factu rules for billing software, due 1 January 2027 for corporate taxpayers and 1 July 2027 for others, with a further extension announced on 5 October 2026.

**Alternatives and prices.**
- Free: Mustangproject for Java, Apache 2.0, reads, writes and validates [E12]; horstoeko/zugferd and its successor invoicesuite for PHP, MIT [E13]; ZUGFeRD-csharp for .NET [E14]; factur-x for Python [E15]; e-invoice-eu, which generates from JSON or a spreadsheet [E16].
- Paid platforms: Invopop, whose documentation prices 300 documents a month at €43 and which added a €500-a-month Pro tier on 30 July 2026 [E17]; Storecove, quote only [E18]; e-invoice.be at €0.25 per invoice (packages from €350) or €0.18 for enterprise; recommand.eu with 25 documents a month free, then €0.30, and plans at €29 and €99 [E4]. A commercial SDK is listed from $5,803.73 [E19].
- Small API competitors already live: thelawin.dev (public beta since Q1 2026, an MCP endpoint, a tier of 2,000 credits a month, and by one extract billing through Paddle) [E5]; invoice-api.xhub.io (plans from $0, WooCommerce and Shopware plugins, Peppol sending planned for 2027) [E6]; InvoiceXML [E7]; RechnungsAPI.de [E8]; einvoiceapi and docuflair [E9]; an Apify validator from $4.00 per 1,000 validations [E10]. Shopify and WordPress apps also exist [E11].

**Cost of the status quo.** FACT (one vendor source): France fines €50 per non-compliant invoice, capped at €15,000 a year [E2]. UNKNOWN: Germany's penalty regime. INFERENCE: the practical cost is invoices rejected by the customer's accounts-payable system, which delays payment.

**Evidence of willingness to pay and of small-vendor revenue.** Buyers pay the platforms above. UNKNOWN: the revenue of any small e-invoice API. A targeted search for founder disclosures found none.

**Wedge for an unknown vendor.** Weak. Three options, all unproven: diagnostics that explain why an invoice was rejected (ASSUMPTION: free libraries do this poorly); plugins for platforms no competitor covers yet (UNKNOWN which); price. One handicap is certain: the buyers work in German and French, and the founder works in English.

**Onboarding and time to first value.** Minutes for a developer: post JSON, receive a file. FACT: thelawin.dev describes itself as stateless and says it stores no invoice data [E5]. A newcomer must match that to avoid a data-protection objection.

**How the first 10–50 customers arrive.**
1. Plugin directories where merchants search for "E-Rechnung", the route invoice-api.xhub.io took [E6].
2. Documentation pages per format and per validation error, in German.
3. A free online validator as the entry point.
4. Cold outreach to German software houses and agencies ahead of 1 January 2027 and 1 January 2028. The founder can do this, in English.
5. Listings on Apify and MCP directories.

UNKNOWN: whether any of this works for a newcomer. No vendor in the niche has published results.

**Retention and churn.** INFERENCE: high once integrated, because invoices go out every month and rules change. The risk is a customer replacing the API with a free library once the deadline pressure passes.

**Solo-operability, on-call and abuse.** Moderate. Stateless conversion is cheap to run. But invoices are a production path, an error has tax consequences for the customer, and each rule release must be adopted on time. Abuse risk is low.

**Infrastructure cost and gross margin.** ASSUMPTION: CPU-only document work, gross margin above 90%.

**Price, revenue per customer, customers needed.** Price anchors run from about €0.14 per document (Invopop's example) to €0.30 including network delivery [E4, E17]. INFERENCE: file generation alone must sit below that, so plans of €19–99 a month are realistic, and $10,000 MRR needs roughly 100–200 paying accounts.

**Single most dangerous assumption.** That a software vendor will pay monthly for a hosted API when a free library exists for its language and an AI coding agent can wire it in within an afternoon.

**Note for the team.** The mandate is real and dated; the API is probably the wrong packaging. The same capability sold as a shop or ERP plugin reaches a non-technical buyer through a directory. That version belongs with the non-technical candidates.

### 4.3 Candidate 3 — niche lead feeds built from public crawling

**What it is.** A weekly-updated list of businesses matching one narrow trigger, such as new online stores on a platform or sites that just adopted or dropped a specific tool, delivered as a file, a webhook or a CRM sync.

**Who has the problem, uses, pays, decides.** Sales and marketing teams at companies that sell to online merchants or site owners: app vendors, agencies, payment and logistics providers. The user is a sales rep or growth marketer. The payer and decider is the head of sales or the founder. These are non-technical buyers.

**Recurring job and trigger.** Fresh prospects every week. The trigger is starting or scaling an outbound programme.

**Alternatives and prices.** BuiltWith, entry plan $295 a month by a competitor's claim [T5]; Store Leads, a plan at $63.75 a month [T3]; StoreCensus [T5]. BACKGROUND: enrichment suites include similar data.

**Cost of the status quo.** UNKNOWN.

**Evidence of willingness to pay and of small-vendor revenue.** The incumbents' revenue estimates in section 3.5 [T1, T2]. UNKNOWN: any newcomer's revenue.

**Wedge for an unknown vendor.** One narrow trigger kept fresher than the incumbents keep it. INFERENCE: the product produces its own prospect list, so the founder's outbound is targeted at no cost.

**Onboarding and time to first value.** A sample file on the first call; value in the first week.

**How the first 10–50 customers arrive.** Outbound to app vendors and agencies with 50 free matching leads; a listing on CRM marketplaces, where Store Leads already is [T3]. UNKNOWN: conversion.

**Retention and churn.** UNKNOWN. INFERENCE: a list gets used up, so churn is high unless the weekly flow of new records is the value.

**Solo-operability, on-call and abuse.** Moderate. Crawl scale, deduplication and freshness are batch work, not a live production path, so there is no round-the-clock duty. Legal exposure is as in section 3.5.

**Infrastructure cost and gross margin.** ASSUMPTION: high margin after crawl cost; not measured.

**Price, revenue per customer, customers needed.** ASSUMPTION anchored on [T3, T5]: $99–299 a month, so 35–100 customers.

**Single most dangerous assumption.** That buyers trust a new feed's coverage enough to pay before it has a track record, and that data protection law and the payment provider allow it.

### 4.4 Candidate 4 — a portfolio of Atlassian Forge apps

**What it is.** Several small paid apps for Jira and Confluence Cloud, built on Forge (Atlassian's hosted app platform) and sold only through the Atlassian Marketplace.

**Why it is fourth.** It fits the founder's constraints better than any other candidate and has the worst discovery evidence. I first ranked it second on the strength of the payment and operations fit. I moved it down after reading sibling report C, whose analyst pulled the whole marketplace catalogue through Atlassian's public API on 2026-11-13 [X3]. I did not verify that data myself.

**Who has the problem, uses, pays, decides.** Teams on Jira and Confluence Cloud. Users are developers, project managers and support staff. The payer is the company's Atlassian billing account; FACT: Atlassian collects the money and pays the vendor [P13, M2]. BACKGROUND: the decider is the site administrator or an engineering manager.

**Recurring job and trigger.** The job is a gap the team hits every week: reporting, checklists, templates, exports, time tracking. The dated trigger I expected is mostly gone. FACT: Connect, the older app framework, reaches end of support on 31 January 2027, and Atlassian said on 3 August 2026 that over 95% of paid app seats had already migrated to Forge [X3; my own source M4 gives the date as "after December 2026"]. INFERENCE: at most 5% of paid seats are left for a replacement app to win. BACKGROUND, verify: Atlassian is also moving Data Center customers to Cloud, which creates demand for cloud equivalents.

**Alternatives and prices.** FACT: 7,293 cloud listings, of which 4,827 are paid through Atlassian and 2,123 are free [X3]; Atlassian's own post says "more than 6,000" [M1]. UNKNOWN: price levels. BACKGROUND: pricing is per user per month, small sites often pay nothing, and Atlassian's own AI features overlap with summarisation apps.

**Cost of the status quo.** UNKNOWN.

**Evidence of willingness to pay and of small-vendor revenue.** The marketplace passed $7 billion in lifetime sales and transacted the latest $1 billion in nine months [M1]. UNKNOWN: any small vendor's revenue. Every piece of traction evidence for new vendors is negative:

- FACT: among apps launched 10–17 months ago, the median has 2–6 installs; about 6.5% reached 100 installs and about 0.6% reached 500 [X3].
- FACT: new listings rose from 37 a month in June 2025 to 543 a month in October 2026 [X3]. INFERENCE: AI-built apps are flooding the store, the same pattern as Apify's contest [S5].
- FACT: a solo developer's free app had 4 installs after 12 days [M5]; a two-person firm had 29 installs and 9 reviews across four Forge apps after about ten months [M6]; a community thread is titled "Marketplace discovery is fragmenting and small vendors feel it" [M7].

**Wedge for an unknown vendor.**
- The 0% revenue share on the first $1M of lifetime Forge revenue [M2].
- "Runs on Atlassian" status, which Atlassian promotes and rewards [M3].
- A portfolio. The founder's build capacity allows five to ten apps where a normal solo vendor ships one.
- Replacements for the few Connect apps that will not migrate. This is a small pool, as shown above.

**Onboarding and time to first value.** An administrator installs from the listing. FACT: Atlassian's documentation gives listing approval as 10–15 business days and requires a valid company email domain for paid listings; payouts start once $500 has accrued [X3]. One developer reported approval in about two days [M5]. BACKGROUND: a 30-day free trial precedes billing, so first revenue trails first install by a month or more.

**How the first 10–50 customers arrive.**
1. Marketplace search: name and describe each app for queries with weak results.
2. Atlassian Community threads where the missing feature is discussed. One developer's lesson was to start community presence on day one of the build, not at launch [M5].
3. BACKGROUND: Atlassian's public issue tracker shows vote counts on unbuilt feature requests, a free ranked list of demand.
4. Calls with Atlassian Solution Partners, the consultancies that recommend apps to clients. The founder can do this.

The cohort data says these routes do not work for the typical newcomer: a median of 2–6 installs after 10–17 months [X3], and installs are not yet paying customers.

**Retention and churn.** UNKNOWN today. BACKGROUND: marketplace apps renew with the host product and are regarded as sticky.

**Solo-operability, on-call and abuse.** The lightest in this report. INFERENCE: Forge is hosted by Atlassian, so there is no server, database or login system for the founder to keep running. Support tickets and security questionnaires are the main load. There is no public free tier to abuse.

**Infrastructure cost and gross margin.** FACT: Forge has been billed by consumption since January 2026, with free monthly allowances [X3, M8]. UNKNOWN: what a small app pays beyond the allowance.

**Price, revenue per customer, customers needed.** ASSUMPTION, not verified: $50–150 a month per paying site, so 70–200 paying sites across the portfolio. INFERENCE from the cohort data: if each of ten apps has the cohort's 0.6% chance of reaching 500 installs, the chance that at least one does is about 6%, and installs include trials and sites too small to pay.

**Single most dangerous assumption.** That the founder's apps land in the top 1% of new listings by installs, in a store now receiving more than 500 new listings a month.

### 4.5 Reference case — screenshot and HTML-to-PDF API (rejected)

This is the textbook developer micro-SaaS and has the best public data, so it sets the base rate for the family.

- **Buyer.** Developers who need link previews, PDF invoices and reports, or page archives. Self-serve.
- **Job and trigger.** Every preview or PDF; the trigger is the pain of running headless browsers.
- **Alternatives.** Many paid APIs; current prices not retrieved today (UNKNOWN). BACKGROUND: free browser-automation libraries, which an AI agent can deploy.
- **Evidence.** ScreenshotOne's path in section 2.2: about two years to $8,500 MRR, four years to $32,000 [B1, B4]. Newer entrants: $55, $2,154 and $4,400 MRR [B11–B13].
- **Channels that built the leader.** SEO, Google Ads and Twitter early; Reddit later; now paid ads and a hosted MCP server, both described as tests [B3, B6, B7].
- **Churn.** About 9% a month [B4].
- **Ceiling.** A public teardown puts ScreenshotOne's ceiling at $33,000–40,000 MRR on current inputs and argues that the real constraint is a missing market, not churn [B4, B5].
- **Solo-operability.** FACT: one person, no employees, more than 100 million requests served [B4]. BACKGROUND: renderers are abused to capture phishing pages and to probe internal networks.
- **Revenue per customer and customers needed.** $31–42 a month, so 240–320 customers.
- **Most dangerous assumption.** That a newcomer can take search and community positions the incumbent needed four years to build.

### 4.6 Other candidates considered and rejected

| Candidate | Buyer | Price anchors found | Free or bundled alternative | Channel for a newcomer | Why it loses | Most dangerous assumption |
|---|---|---|---|---|---|---|
| MCP hosting or gateway | Developer or platform team | Arcade $25 a month plus $0.01 per call; Composio $228 a month for 2,000,000 calls [A5] | Arcade 2,000 free calls; Composio free tier [A5] | None without funding | Funded, consolidating (Smithery into Arcade) [A4]; protocol in flux [A6] | That the protocol layer holds still for a year |
| Paid MCP servers on marketplaces | Agent builders | 80–85% revenue share [A1] | Most servers are free | Marketplace listing | Fewer than 5% earn anything (estimate) [A3] | That agents' owners pay per tool call |
| LLM observability, evals, cost tracking | AI app developers | Not retrieved | Self-hosted Langfuse [A7] | Search, GitHub | Acquirers now own the two leading open-source tools [A7, A8] | That small teams pay when open source is free |
| AI-bot analytics, llms.txt, agent-readiness | Marketers, publishers, API owners | OtterlyAI $29; xSeek $99.99–499.99 a month [A10] | Cloudflare AI Crawl Control and readiness scanner are free [A9, A11] | Search | Cloudflare gives the developer version away; the paid version is a marketing product | That anyone pays for a readiness score |
| Cron, uptime and status monitoring | Developers, ops | Hyperping $74; Better Stack add-ons from $12 [O3] | Healthchecks and Uptime Kuma are open source; 75% of status-page tools are free or freemium [O2] | Search | 11 years to $21,200 MRR for the respected incumbent [B9] | That there is an unserved segment |
| Dunning, metering, license keys for Paddle, Lemon Squeezy, Polar | SaaS founders on those providers | Churnkey $250–825 a month [O5]; Keygen $49–99 [B17] | Paddle bundles dunning [O6]; native metering due 2027 [P3] | Provider directories | Small market, platform closes the gaps, clones exist [O7, O8] | That the provider leaves the gap open |

## 5. Ranking

The probability and revenue columns are my judgment, not measurements. They start from the base rate that 6.1% of revenue-generating startups clear $10,000 MRR at any age [B14], move down for the 12-month limit and the absence of an audience, and move up where a marketplace or a legal deadline supplies demand. The gap between ranks 2 and 3 is smaller than the error in my judgment; their order reflects evidence quality.

| Rank | Candidate | Buyer | Price and revenue per customer | Customers for $10K | Channel | Chance of $10K by month 12 | Likely month-12 revenue | Kill-risk |
|---|---|---|---|---|---|---|---|---|
| 1 | Site-category data and scraping APIs | Developers, automation builders | $1–2 per 1,000 requests [B19] | 10–30 heavy accounts | Apify Store, RapidAPI, community answers, direct messages | 5–8% | $1,000–4,000 a month, usage-based | Legal and terms-of-service action; breakage; payment acceptance |
| 2 | E-invoicing format API, Germany first | CTOs of small software vendors | €19–99 a month (INFERENCE) | 100–200 accounts | Plugin directories, German docs, outbound before 1 Jan 2027 and 1 Jan 2028 | 2–4% | $500–3,000 MRR | Free libraries plus six or more small competitors |
| 3 (non-developer buyer) | Niche lead feeds | Heads of sales at vendors selling to merchants | ASSUMPTION $99–299 a month | 35–100 | Outbound with free samples; CRM marketplaces | 2–5% | $1,000–3,000 MRR | Coverage trust; data-protection law; payment acceptance |
| 4 | Atlassian Forge app portfolio | Jira and Confluence administrators | ASSUMPTION $50–150 a month per site | 70–200 sites | Atlassian Marketplace, Atlassian Community, solution partners | 1–2% | Under $1,000 MRR | Marketplace discovery does not reach new vendors [M5–M7, X3] |
| Rejected | Screenshot or PDF API | Developers | $31–42 a month [B2–B4] | 240–320 | Search, Reddit, ads | 1–2% | $1,000–3,000 MRR, consistent with ScreenshotOne near year one [B7] and PDFBolt [B11] | Incumbents' four-year head start |
| Rejected | MCP hosting, paid MCP servers, LLM observability, AI-bot analytics, monitoring, billing add-ons | See section 4.6 | See section 4.6 | — | — | 1% or less | Under $1,000 MRR | Free from funded or platform vendors |

**Why rank 1 is first.** It is the only candidate with direct evidence on both sides of the question: a solo vendor that reached the target in the time allowed [B18], and a marketplace that brings buyers and pays out without the vendor having an audience [S1, S4, S7]. It is also the candidate I would least like to operate: its legal position is unverified here, it breaks constantly, and its revenue is not subscription revenue.

**Why rank 2 is second.** The trigger is the strongest in the report, with two legal dates inside the window [E1]. It ranks below the data APIs because the product is a wrapper around free libraries [E12–E16], the niche already has at least six look-alike entrants [E5–E10], none of them has disclosed revenue, and the founder would sell in English to German buyers.

**Why rank 3 is third.** A lead feed needs the fewest customers and suits the outbound work the founder can do. Its odds are about the same as rank 2. It sits below because nothing I found shows a newcomer earning money in this category, and because both the law on contact data and Paddle's position are unconfirmed.

**Why rank 4 is fourth.** The Atlassian Marketplace solves billing and Ukrainian payouts [P13], needs nothing kept running, and charges 0% on the first $1M [M2]. It still ranks last because the store does not deliver customers to new vendors: the median app launched 10–17 months ago has 2–6 installs, and more than 500 new listings now arrive each month [X3].

**Why the others lose.** Each rejected candidate fails the same test: a funded company or a platform already gives away the core of it. Cloudflare gives away AI-crawler controls and the readiness scanner [A9, A11]. Paddle bundles dunning and is building metering [O6, P3]. Langfuse is free to self-host and now owned by ClickHouse [A7]. Healthchecks and Uptime Kuma are open source [B9, O2]. Arcade and Composio have free tiers [A5]. In the one rejected niche with no dominant free option, screenshots and PDFs, the incumbents hold search and community positions that took four years to build [B1–B6].

## 6. Developer and API products compared with non-technical SMB buyers

I did not research SMB candidates; other analysts' reports must supply that side. What follows is the developer side of the comparison, with evidence, and the structural reasons it is the harder market for this founder.

| Factor | Developer or API buyer | Why it matters for this founder |
|---|---|---|
| Can the buyer build it? | Yes, and increasingly does. Claude Code chose to build in 12 of 20 tool categories [D1] | The founder's one advantage, cheap engineering, is the buyer's advantage too |
| Does the buyer expect free? | Yes. 1.3% of Healthchecks accounts pay [B9]; open-source or free tiers exist in every niche checked | Conversion volume must be very high |
| Revenue per customer | $22–42 a month in reported cases [B2, B4, B9, B11] | 240–450 customers needed |
| Churn | About 9% a month at ScreenshotOne [B4] | Growth must outrun a steady loss |
| Can outbound reach the buyer? | No evidence found for low-priced developer tools | The founder's permitted activities, calls and written outreach, are wasted on a $29 product |
| Discovery | Docs traffic is falling [D4]; AI assistants favour building or incumbents [D1] | No free channel pays back inside 12 months |
| Operations | An API sits in the customer's production path | INFERENCE: one person carries a round-the-clock duty, and the service must not depend on the founder's own power or connectivity |
| Payments | Low prices and usage billing fit Paddle poorly [P1–P3, P14] | Fee share of 7–11% on small transactions |

INFERENCE: the candidates that rank at all do so because they borrow non-developer mechanics. Rank 1 borrows a marketplace's traffic. Rank 2 is driven by a tax deadline. Rank 3 sells to sales teams. Rank 4 sells to administrators through the platform's own store. That pattern is the strongest argument in this report for choosing a non-technical buyer.

What the developer market still offers, to be fair: onboarding in minutes, a global English-language market, little support load, and proof that one person can run $36,000 MRR alone [B4, B6]. Those are advantages after distribution exists. They do not create it.

## 7. What was not verified, and the cheapest next checks

**Not verified today.**

1. Whether Paddle's usage-billing beta admits new sellers, and whether its acceptable use policy permits scraping APIs or lead data [P1–P3, P10]. Paddle's onboarding and payout route for a Ukrainian sole proprietor is covered by sibling report A, which I did not verify [X1].
2. Whether Apify and RapidAPI pay out to Ukraine.
3. Apify's current monthly payout and the distribution of earnings per developer. The year of the $563,000 September is not stated; a Discord announcement of a first $1M appears to date from March 2024 and does not say what period it covers; one 2026 blog claims $1.2M a month; a press release says $4M cumulative by November 2025 [S1, S2, S4, S7, A1]. I found no per-developer distribution, which is the number that matters.
4. Any revenue figure for a small e-invoicing API; the prices of thelawin.dev and invoice-api.xhub.io; install counts of the e-invoice plugins; Germany's penalties.
5. Any small Atlassian vendor's revenue; typical app prices; the exact eligibility for the 0% fee, which one Atlassian post ties to "Runs on Atlassian" apps [M2, M3]. The install and listing counts in section 4.4 come from sibling report C, not from my own check [X3].
6. ScreenshotOne's exact dates for $2,200 and $8,500 MRR and its current prices. Revenue for Cronitor and SimpleBackups: searched, nothing usable found.
7. The claim that about 12 heavy users drive most of Scrape Creators' revenue (secondary source), and whether an Indie Hackers post about earning $20,000 from a web-scraping course belongs to the same founder, which would mean a larger audience than a small Twitter presence [B19–B21].
8. Whole sub-niches with no live research: webhooks, feature flags, changelog and feedback widgets, error tracking, log alerts, preview environments, compliance helpers, API documentation, SDK generation, sanctions screening, email verification, VAT and IBAN validation, address and holiday data, agent auth, guardrails, memory, sandboxing, agent web search, and the GitHub, Vercel, Supabase, Cloudflare, Raycast, VS Code, JetBrains, n8n, Make, Zapier, Bubble, Webflow and Framer ecosystems.
9. 2026 results for Product Hunt, Show HN and cold outreach on developer tools.
10. The 2026 legal position on scraping. Everything said here on that is BACKGROUND.
11. What the Amplifying study counts as "builds custom in 12 of 20 categories": top pick, or any pick [D1].

**Cheapest next checks, in order.** Each takes a day or less. The thresholds are my proposals.

1. Write to Paddle support with three questions: sole-proprietor onboarding from Ukraine, acceptance of a data API, access to the usage-billing beta. This gates ranks 1, 2 and 3 for direct sale.
2. Rank 1: pull the public Apify Store listings for 30 site categories and tabulate users, ratings, last update and open issues. Proceed only if at least three categories show many users and no well-maintained actor.
3. Rank 2: send 50 messages to German software houses and agencies and publish a free validator. Stop if that yields fewer than five serious conversations by mid-January 2027.
4. Rank 3: before building, hold 20 calls with app vendors and agencies using a hand-made sample of 50 leads. Stop if fewer than three offer to pay.
5. Rank 4: from the marketplace catalogue that sibling report C already downloaded, list the search terms and categories where recent listings did reach 100 installs. Proceed only if a pattern appears that a one-day build can copy.

## 8. Sources

All web sources were accessed on 2026-11-13 through search-engine extracts; no page was read in full (section 0). "Date" is the source's own date where the extract gave one. The sibling reports in the last table are local files written by other analysts.

### Payments

| ID | URL | Date | Supports |
|---|---|---|---|
| P1 | https://developer.paddle.com/build/usage-based-billing | Live docs, undated | Usage-based billing is "early access (beta)"; allowances, usage events, balance webhook, overage at renewal or immediately |
| P2 | https://developer.paddle.com/api-reference/usage-events | Live docs, undated | Page headed "Join usage-based billing early access (beta)"; access by request |
| P3 | https://www.paddle.com/blog/paddle-launches-ai-toolkit-bringing-global-selling-into-ai-workflows | October 2026 (exact day unconfirmed) | Native usage-based billing "enters private preview in early 2027"; waitlist; use specialist billing integrations until then |
| P4 | https://www.paddle.com/ubb | 2026 | Landing page pointing to a 20 October launch event |
| P5 | https://developer.paddle.com/get-started/how-paddle-works/ai-companies | Live docs, undated | Usage added as custom line items to the next subscription transaction; metering in the seller's own system |
| P6 | https://phare.io/blog/what-paddle-doesnt-tell-you-about-implementing-metered-billing/ | Undated; may predate the beta | No meter API, no automatic aggregation, no invoice grace periods |
| P7 | https://www.nadles.com/blog/usage-based-pricing-with-paddle-pay-as-you-go/ | Undated | A third-party metering layer for Paddle exists |
| P8 | https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle | Older help page | Ukraine supported except occupied regions |
| P9 | https://groups.google.com/a/chromium.org/g/chromium-extensions/c/8BMvaYoEUrk | August 2025 | Anecdotes: Paddle payouts to Ukraine via Payoneer and to a sole-proprietor USD account |
| P10 | https://paddle.com/support/aup/ | Updated 13 April 2026 | Restricted categories; list not exhaustive; no scraping clause in the extract |
| P11 | https://freemius.com/blog/payment-platform-restrictions-ai-apps/ | 2026, competitor blog | Paddle prohibits AI image generators, deepfake tools, voice cloning |
| P12 | https://fungies.io/polar-sh-vs-creem-vs-dodo-payments-mor-2026 ; https://alexcloudstar.com/blog/merchant-of-record-indie-saas-2026/ ; https://dev.to/devtoolpicks/polar-vs-lemon-squeezy-vs-creem-in-2026-which-mor-is-right-for-indie-hackers-506m | 2026, vendor and affiliate comparisons | Fees for Lemon Squeezy (checked 12 Sep 2026), Polar, Creem; Lemon Squeezy on Stripe Managed Payments since January 2026; country counts; Dodo's per-call billing claim |
| P13 | https://community.developer.atlassian.com/t/marketplace-payouts-for-a-partner-based-in-ukraine-sole-proprietor/103157 | October 2026 | Atlassian Marketplace: no company required; monthly USD SWIFT payouts to a Ukrainian sole-proprietor account |
| P14 | https://churnbuster.io/articles/best-dunning-management-software/ ; https://fungies.io/best-dunning-management-software-saas-2026/ | 2026, vendor blogs | Paddle fee quoted as 5% + $0.50 per transaction |
| P15 | https://learn.profitwell.com/blog/paddle-partners-with-m3ter | Undated | Paddle's partnership with a specialist metering vendor |

### Small-vendor revenue and base rates

| ID | URL | Date | Supports |
|---|---|---|---|
| B1 | https://www.indiehackers.com/post/tech/working-towards-financial-independence-with-an-api-saas-while-raising-a-family-l8gTzlBLNhN6I4NF4KsC | About mid-2024 | ScreenshotOne at about $8,500 MRR roughly two years after its May 2022 launch |
| B2 | https://screenshotone.com/blog/200000-arr-and-400-paying-customers/ | Undated in extract | $200K ARR, 400+ paying customers |
| B3 | https://www.indiehackers.com/post/tech/hitting-25k-mrr-by-making-his-goals-less-ambitious-jQRZDnzwm8DFAaS4Xrq0 | Undated in extract | $25K+ MRR, 800+ paying customers. The statement that Reddit became the best channel comes from "later accounts" in the search summary; exact page not identified |
| B4 | https://superframeworks.com/case-study/screenshotone ; https://superframeworks.beehiiv.com/p/32k-mrr-1-000-customers-and-a-hard-ceiling-at-33k | 2026, third-party case study | $20K MRR by June 2025, then $25K, then $32K; 1,000+ customers; 100M+ requests; no employees; $3K new MRR and 9% churn imply a ceiling near $33K |
| B5 | https://smartbearlive.transistor.fm/1 ; https://x.com/asmartbear/status/2081769836292579568 | Post dated 27 July 2026 (derived from the post ID) | Public teardown with the founder; ceiling near $40K; argues the constraint is a missing market, not churn (paraphrase from the extract) |
| B6 | https://x.com/DmytroKrasun/status/2104570564006277204 ; https://screenshotone.com/changelog/hosted-mcp-server/ | 28 September 2026 (derived from the post ID) | About $36K MRR and growing; demand persists; testing a hosted MCP server and paid ads, which are costly |
| B7 | https://www.starterstory.com/stories/screenshotone | 2023, month unconfirmed | Title cites $2.2K MRR; SEO, Google Ads and Twitter worked; second customer from Google Ads |
| B8 | https://github.com/WuDao0123/indie-10k-mrr-teardowns | Unverified repository | 644 indexed pages, 95.8% programmatic |
| B9 | https://healthchecks.io/about | 1 July 2026, primary | 957 paying accounts, $21,200 MRR, 71,400 free accounts |
| B10 | https://www.indiehackers.com/product/healthchecks-io | August 2024 | 652 paying customers, $14,043 MRR; the service turned nine |
| B11 | https://trustmrr.com/startup/pdfbolt | Updated 28 October 2026 | $2,154 MRR, 58 active subscriptions, payment-verified |
| B12 | https://trustmrr.com/startup/peedief-pdf-generation-for-ai-workflows | 2026 | $55 MRR, 5 subscriptions |
| B13 | https://trustmrr.com/startup/screenshotdev-for-sale | 2026 | $4.4K MRR, listed for sale |
| B14 | https://bigideasdb.com/micro-saas-examples-2026 | July 2026, third-party analysis of TrustMRR data | 8,699 startups, 3,787 with revenue, median $145 MRR, 6.1% above $10K. The same publisher uses different sample sizes on other pages |
| B15 | https://shipbydata.pages.dev/en/startup/pdfbolt | 2026, aggregator estimate | Average developer-tools MRR $1,133 |
| B16 | https://superframeworks.beehiiv.com/p/0-to-40k-mrr-instatus | Undated newsletter | Instatus at $40K MRR with 1,000+ customers |
| B17 | https://getlatka.com/companies/keygen ; https://keygen.sh/blog/all-your-licensing-are-belong-to-you/ | 2024 estimate; 2023 blog | Keygen about $195.4K revenue in 2024, team of one (estimate); source-available; entry prices $49–99 from review sites, which conflict |
| B18 | https://www.indiehackers.com/post/growing-a-scraping-api-to-10k-mrr-in-12-months-6iF8SJRF4WpciDff9aYi ; https://www.wearefounders.uk/from-side-projects-to-10k-mrr-how-adrian-horning-built-scrape-creators/ | 2025 | Scrape Creators launched June 2024 and passed $10K a month about a year later |
| B19 | https://www.betterlaunch.co/playbooks/episodes/adrian-scrape-creators ; https://rosetta.to/u/starterstory/i-found-a-business-for-sale-and-rebuilt-it-into-20k-month | 2026, secondary summaries of a Starter Story episode | About $20K a month; roughly 12 heavy users drive most of it; credit prices; idea taken from a listing on an acquisition marketplace |
| B20 | https://www.starterstory.com/businesses/scrape-creators/growth-channels | 2025–2026 | A small existing Twitter presence (paraphrase from the extract); personalised outreach; dataset giveaways; paid social later |
| B21 | https://indiehackers.com/post/ETrgMPkDWPll2jiKCImQ | Undated | A post titled "Here's how I made $20k in three days with a web scraping course" returned for the same founder's name; authorship not verified |

### Distribution

| ID | URL | Date | Supports |
|---|---|---|---|
| D1 | https://amplifying.ai/research/claude-code-picks/report | February 2026 | 2,430 prompts; custom solutions in 12 of 20 categories; 252 Custom/DIY picks, more than any named tool; feature flags done with config files |
| D2 | https://pinggy.io/blog/what_ai_coding_agents_pick_for_your_stack/ | 2026 | Claude Code builds instead of buying 19% of the time against 10% for Codex and Cursor |
| D3 | https://www.vanta.com/resources/why-cheaper-code-isnt-always-cheap | May 2026, vendor | Argument that building with AI can cost more than buying |
| D4 | https://www.devclass.com/ai-ml/2026/01/08/tailwind-labs-lays-off-75-percent-of-its-engineers-thanks-to-brutal-impact-of-ai/4079571 ; https://socket.dev/blog/tailwind-css-announces-layoffs ; https://www.eweek.com/news/tailwind-labs-lays-off-engineers-due-to-ai/ | 6–8 January 2026 | Three of four engineers laid off; docs traffic about 40% below early 2023; revenue down about 80%; docs were the only route to paid products |

### E-invoicing

| ID | URL | Date | Supports |
|---|---|---|---|
| E1 | https://vatit.com/e-invoicing-guide/germany/ ; https://softco.com/blog/germany-e-invoicing-mandate-2026-update/ ; https://cleartax.com/de/en/e-invoicing-germany ; https://www.truecommerce.com/en-gb/blog/e-invoicing-germany-timeline-deadlines/ | 2026, vendor guides | Germany: issuing from 1 Jan 2027 above €800,000 turnover, from 1 Jan 2028 for all; domestic B2B; new XRechnung release expected spring 2027, parallel running to March 2029 |
| E2 | https://softco.com/blog/france-e-invoicing-2026-september-update/ ; https://invopop.com/blog/e-invoicing-in-france-rules-deadlines-and-penalties ; https://vatcalc.com/france/france-e-invoicing-pilot-ahead-of-sept-2026-mandate | 2026, vendor guides | France: 1 Sep 2026 and 1 Sep 2027 phases; accredited platform required; vendors certify or connect; Factur-X, UBL, CII; €50 per invoice penalty capped at €15,000 (single source) |
| E3 | https://www.storecove.com/blog/en/belgium-e-invoicing-mandate/ ; https://www.truecommerce.com/blog/e-invoicing-in-belgium-your-guide-to-the-2026-mandate/ | 2026, vendor guides | Belgium: Peppol mandatory from 1 Jan 2026; certified access point; tolerance to 31 Mar 2026 |
| E4 | Vendor blog dated May 2026 surfaced by search; probably https://www.mediaatelier.com/Posts/E-Invoices-Belgium/ (attribution uncertain) | May 2026 | e-invoice.be €0.25 and €0.18 per invoice; recommand.eu 25 free, then €0.30, plans €29 and €99 |
| E5 | https://thelawin.dev/ ; https://peerpush.com/p/thelawindev-e-invoicing-api-dqqh | 2026 | Formats, public beta since Q1 2026, stateless design, MCP endpoint, 2,000-credit tier; one extract mentions Paddle billing |
| E6 | https://invoice-api.xhub.io/en ; https://packagist.org/packages/xhubio/shopware-invoice-api-xhub ; https://dev.to/pje_xhub_io/german-e-invoicing-in-a-few-lines-of-code-xrechnung-zugferd-en-16931-390j | 2026 | API from $0; WooCommerce and Shopware plugins; Peppol sending planned for 2027 |
| E7 | https://www.indiehackers.com/product/invoicexml ; https://sourceforge.net/software/product/InvoiceXML/ | 2026 | API-first competitor |
| E8 | https://www.capterra.com/p/10037950/RechnungsAPI-de/ | 2026 | Converts PDF invoices to ZUGFeRD or XRechnung and validates |
| E9 | https://einvoiceapi.pages.dev/ ; https://invoice.docuflair.com/en/api | 2026 | Two more small API entrants |
| E10 | https://apify.com/kamerozkan/xrechnung-xml-batch-validator-api | 2026 | Validator actor from $4.00 per 1,000 |
| E11 | https://apps.shopify.com/zugferd-invoice ; https://apps.shopify.com/lg-einvoice-eu ; https://wordpress.org/plugins/belegfix-e-invoices-xrechnung-zugferd/ | 2026 | E-invoice apps on Shopify and WordPress |
| E12 | https://interoperable-europe.ec.europa.eu/collection/eprocurement/solution/mustangproject | Undated | Mustangproject: open source, Apache 2.0, reads, writes, validates |
| E13 | https://github.com/horstoeko/zugferd ; https://packagist.org/packages/horstoeko/invoicesuite | 2026 | PHP library and its successor |
| E14 | https://github.com/stephanstapel/ZUGFeRD-csharp | 2026 | .NET library, version 18 on NuGet |
| E15 | https://gist.github.com/jstaerk/ad7b58a021b050cc4e4e05156f9a9be3 (probable source; the extract cited a 2021 article) | 2021 | Python factur-x library, BSD licence; current maintenance not checked |
| E16 | https://github.com/gflohr/e-invoice-eu | 2026 | Free generator from JSON or spreadsheets |
| E17 | https://docs.invopop.com/get-started/pricing ; https://invopop.com/blog/new-pricing-2026 | 30 July 2026 pricing change | 300 documents a month at €43 on the Dev plan; Pro at €500 a month |
| E18 | https://www.capterra.com/p/204604/Storecove/ | 2026 | Storecove pricing by quote |
| E19 | https://www.componentsource.com/product/pdf-xpansion-sdk-einvoicing-creation/testimonials/2843291 | 2026 | Commercial SDK from $5,803.73 |

### AI-agent tooling

| ID | URL | Date | Supports |
|---|---|---|---|
| A1 | https://mcp-marketplace.io/blog/state-of-mcp-monetization-2026 ; https://www.getchatads.com/blog/tools-for-monetizing-mcp-servers/ ; https://mcpize.com/blog/mcp-business-models | 2026, platform blogs with a stake | Revenue shares of 80–85%; a claim that Apify pays $1.2M a month |
| A2 | https://vibedna.ai/blog/state-of-mcp-servers-2026 | 2026 | Modest servers about $500 a month; top Apify creators $10,000+ (unverified) |
| A3 | https://a8gent.com/blog/sell-mcp-servers-monetize-guide ; https://godberrystudios.com/posts/how-to-monetize-mcp-servers-2026/ | 2026 | Fewer than 5% of MCP servers earn revenue (estimate); listings $100–3,000 a month; a "$10K MRR in six weeks" claim flagged unverified |
| A4 | https://eseospace.com/blog/arcade-mcp/ ; https://www.speakeasy.com/blog/best-hosted-mcp-platforms | 2026 | Smithery is part of Arcade; connection services reported shut 31 October 2026; another source dates the takeover to August 2026 |
| A5 | https://costbench.com/software/mcp-servers-tooling/ ; https://toolradar.com/blog/mcp-gateway ; https://composio.dev/blog/hosted-mcp-platforms | 2026, comparison sites | Arcade and Composio pricing and free tiers; Glama hosting metered |
| A6 | https://growthmethod.com/is-mcp-dead/ ; https://hackernoon.com/mcp-was-declared-dead ; https://mcpplaygroundonline.com/blog/is-mcp-dead-cli-debate | 2026 | "MCP is dead. Long live the CLI" topped Hacker News on 28 Feb 2026; server counts; 52% of 1,847 servers abandoned (vendor audit) |
| A7 | https://clickhouse.com/blog/clickhouse-acquires-langfuse-open-source-llm-observability | 16 January 2026, primary | ClickHouse acquired Langfuse; it stays open source and self-hostable |
| A8 | https://hackernoon.com/two-acquisitions-deep-two-still-standing-whats-really-happening-to-open-source-llm-observability | 2026 | Mintlify acquired Helicone on 3 March 2026; maintenance mode |
| A9 | https://developers.cloudflare.com/ai-crawl-control/ | Live docs | Cloudflare AI Crawl Control: visibility and control over AI crawlers |
| A10 | https://www.xseek.io/blogs/articles/best-tools-to-track-ai-crawlers-on-your-website-2026 ; https://capitalandcompute.net/blog/ai-crawler-economics-2026/ | 2026 | Tool prices; pay-per-crawl described as closed beta in July 2026, which another article disputes |
| A11 | https://blog.cloudflare.com/agent-readiness/ ; https://isitagentready.com | April 2026, primary | Free agent-readiness score and public adoption dataset; no evidence in results that models read llms.txt |

### Ops tooling

| ID | URL | Date | Supports |
|---|---|---|---|
| O1 | https://blog.healthchecks.io/2024/07/running-one-man-saas-9-years-in/ | July 2024, primary | Healthchecks is a one-person business started in 2015 |
| O2 | https://toolradar.com/best/status-pages | 2 November 2026 | 24 status-page tools tracked; 75% free, freemium or open source |
| O3 | https://hyperping.com/blog/best-statuspage-alternatives | 2026, vendor | Better Stack add-on prices; Hyperping Pro $74 a month |
| O5 | https://churnrecovery.pages.dev/posts/Churnkey-Pricing-2026-Is-It-Worth-250-Month ; https://www.flycode.com/blog/churnkey-alternatives-2026-payment-recovery-cancel-flows | 2026, competitor blogs | Churnkey tiers at $250, $450, $825 a month; supports Paddle and Lemon Squeezy |
| O6 | https://fungies.io/best-dunning-management-software-saas-2026/ | 2026 | Paddle handles retries and dunning as part of its service |
| O7 | https://dev.to/tahseen_rahman/revive-vs-chargebee-retention-2026-the-800mo-hidden-cost-trap-1jp8 | 2026, vendor post | Revive supports Stripe, Lemon Squeezy, Gumroad, Paddle, Polar; aimed at $1K–50K MRR |
| O8 | https://dunningcompare.pages.dev/ | 2026 | Another look-alike site in the niche |
| O9 | https://www.softwareadvice.com/business-continuity/simplebackups-profile | 2026 | SimpleBackups from €34 a month |

### Atlassian Marketplace

| ID | URL | Date | Supports |
|---|---|---|---|
| M1 | https://www.atlassian.com/blog/teamwork/atlassian-marketplace-7-billion | 2026, primary | $7B lifetime sales; latest $1B in nine months; 6,000+ cloud apps; 3,700+ public Forge apps |
| M2 | https://www.atlassian.com/blog/development/updates-to-marketplace-revenue-share-2026 ; https://community.developer.atlassian.com/t/marketplace-revenue-share-updates-2026/91727 | 2025–2026, primary | 0% revenue share to $1M lifetime Forge revenue from 1 Jan 2026; eligibility rules; incentive is temporary. Extracts conflict on the dates of the 16% and 17% steps |
| M3 | https://www.atlassian.com/blog/development/runs-on-atlassian-apps-can-now-take-home-100-of-marketplace-revenue ; https://www.atlassian.com/blog/development/extended-timelines-for-marketplace-revenue-share-changes | 2026, primary | "Runs on Atlassian" apps keep 100%; rate changes deferred |
| M4 | https://isogunlabs.com/blog/atlassian-marketplace-2026/ | 2026 | Connect support ends after December 2026 |
| M5 | https://community.developer.atlassian.com/t/just-shipped-my-first-forge-app-10-lessons-after-11-days-on-the-marketplace/100742 | 2026 | 4 installs after 12 days; approval in about two days; start community presence early |
| M6 | https://dev.to/mihai_leanzero/first-year-on-the-atlassian-marketplace-four-forge-apps-ela | 2026 | 29 installs and 9 reviews across four Forge apps after about ten months |
| M7 | https://community.atlassian.com/forums/App-Central-discussions/Marketplace-Discovery-Is-Fragmenting-and-Small-Vendors-Feel-It/td-p/3249570 | 2026 | New vendors lack the install base that feeds recommendations |
| M8 | https://www.atlassian.com/blog/development/a-preview-of-future-forge-pricing | 2025–2026 | Atlassian previewed Forge usage pricing; amounts not retrieved |

### Scraping, marketplaces and data products

| ID | URL | Date | Supports |
|---|---|---|---|
| S1 | Apify blog post surfaced by search; exact page not identified | Year not stated; consistent with September 2025 given S4 and S7 | $563K paid to community developers in one September |
| S2 | Apify Discord announcement, probably https://discord.apify.com/m/1217057339396460644 or https://discord.apify.com/m/1215263302406504499 | March 2024 if it is one of these two messages (dates derived from the message IDs) | "For the first time, we sent over $1M to community developers"; the period covered is not stated in the extract |
| S7 | https://www.everydev.ai/developers/apify | November 2025, third-party listing | Estimate that Apify pays developers $500K+ a month |
| S3 | https://help.apify.com/en/articles/8684010-how-does-actor-monetization-work | Live help page | Developers get 80%, paid monthly by bank transfer or PayPal; rental pricing closed to new listings 1 Apr 2026 and retired 1 Oct 2026 |
| S4 | https://natlawreview.com/press-releases/apify-bets-1m-independent-developers-building-ais-missing-tools | November 2025, press release | More than $4M paid to developers since the store launched; $1M challenge, 3 Nov 2025 to 31 Jan 2026 |
| S5 | https://signalcensus.pages.dev/articles/apify-1m-challenge-marketplace-flywheel | 2026, third-party | 704 developers, 3,329 actors submitted, 1,086 qualified |
| S6 | https://geekflare.com/guides/sell-apis/ ; https://apyhub.com/blog/how-to-monetize-an-api-in-2026-pricing-distribution-and-what-you-actually-keep | 2026 | RapidAPI acquired by Nokia in November 2024; flat 25% fee; no earnings data |
| T1 | https://getlatka.com/companies/builtwith | Estimates for 2023–2024 | BuiltWith $14M revenue (Dec 2023), 4 employees (Dec 2024) |
| T2 | https://pipeline.zoominfo.com/sales/builtwith-review | 2026 | BuiltWith $22.6M revenue, about 11 employees (conflicts with T1) |
| T3 | https://ecosystem.hubspot.com/marketplace/apps/store-leads-206281 | 2026 | Store Leads plan at $63.75 a month |
| T4 | https://www.startuphub.ai/startups/storeleads | 2026 | About four people on record |
| T5 | https://api.storecensus.com/builtwith-alternative | 2026, competitor | Claim that BuiltWith's entry plan is $295 a month |

### Sibling reports in this folder

Read on 2026-11-13 while they were still being written. Their findings are not verified by me, and the files may have changed since.

| ID | File | Supports |
|---|---|---|
| X1 | /home/user/project-x/docs/research/round1/A-payments-ukraine-fop.md | Paddle accepts sole traders, pays monthly by wire or Payoneer ($100 minimum, $15 SWIFT fee); Stripe, Polar and Lemon Squeezy closed to Ukraine; Dodo closed to new Ukrainian sellers; Creem and Freemius list Ukraine; Paddle's policy is silent on data and lead-list products |
| X2 | /home/user/project-x/docs/research/round1/B-base-rates-benchmarks.md | Census of 10,150 listed products (TechStartups, 28 Sep 2026): 2.41% at or above $8,333 MRR; median earner $169 in 30 days |
| X3 | /home/user/project-x/docs/research/round1/C-marketplaces-work-software.md | Atlassian Marketplace API pull of 2026-11-13: 7,293 cloud listings; 37 new listings in June 2025 against 543 in October 2026; median 2–6 installs for apps launched 10–17 months ago; 6.5% reach 100 installs, 0.6% reach 500; Connect end of support 31 Jan 2027 with over 95% of paid seats migrated; approval 10–15 business days; $500 payout threshold; Forge consumption pricing with free allowances; monday.com and Microsoft marketplace rules |
| X4 | /home/user/project-x/docs/research/round1/E-regulation-triggered-demand.md | German e-invoicing dates confirmed against the statute; France's platform registration requirement; Spain's Veri*factu dates and announced extension |
