# C — Work-software app marketplaces as a distribution channel (Round 1)

Research date: 2026-11-13. Analyst scope: Atlassian, monday.com, Slack, Microsoft Teams/M365/AppSource, Google Workspace Marketplace, Zoom, Notion, ClickUp, Asana, Linear, GitHub, HubSpot, Salesforce, Zendesk, Freshworks, Pipedrive, Intercom, Airtable, Miro, Figma.

Evidence labels used throughout: **[F]** fact from a primary source fetched today, **[I]** inference from those facts, **[A]** assumption, **[U]** unknown / could not verify.

---

## 0. Method and limits (read first)

- **Web search was not available.** The session's shared WebSearch budget was exhausted after my first 3 queries. Everything below was collected by fetching primary sources directly at their canonical URLs: official developer docs, partner agreements, marketplace listing pages, the Atlassian Marketplace public REST API, the Atlassian developer community (Discourse JSON), and Google Workspace Marketplace listing/search pages. No general search engine was used after the budget ran out. Consequence: vendor revenue disclosures on third-party sites (Indie Hackers, podcasts, X) could not be searched for. Where I rely on memory instead of a page fetched today, it is marked [U] or "recalled, not re-verified".
- **Atlassian data is census-level.** I dumped every cloud-hosted listing from `https://marketplace.atlassian.com/rest/2/addons?hosting=cloud` (7,293 listings, 2026-11-13) with installs, ratings, payment model, framework flag and latest version date, and for the 3,000 newest listings the release date of the first cloud version. Pricing came from `/rest/2/addons/{key}/pricing/cloud/live`. Partner tiers were read from 157 vendor pages.
- **Google Workspace Marketplace data** comes from server-rendered search/category/listing pages (name, developer, rating, "users" count, listing-updated date, pricing label, review text).
- **Not obtainable:** listing-level data for monday.com (pages are client-rendered and `robots.txt` disallows `/marketplace/listing/` and `/marketplace/category/`), HubSpot, Slack, AppSource/Teams (client-rendered). For those marketplaces only policy/economics facts are verified; gap claims are explicitly flagged as unverified.
- Install counts are vendor-platform numbers with known distortions: Atlassian counts include "Legacy Free" sites that unsubscribed but never uninstalled, and counts glitched in March 2026 (community thread 99359); Google "users" are cumulative and include domain-wide admin installs.

---

## 1. Bottom line

1. **Only three marketplaces in scope both bill customers for you and can pay a Ukrainian sole proprietor:** Atlassian (USD SWIFT wire; explicitly confirmed for FOP by Atlassian staff on 2026-10-07), monday.com (Payoneer), Microsoft (wire; Ukraine listed). Zendesk requires a Stripe account, Zoom monetization is US-only, Figma says it is not approving new creators to sell paid files and does not list Ukraine for payouts. Everything else has no native billing and needs a merchant of record; Paddle supports Ukraine-based sellers except the occupied/front-line regions it lists.
2. **Atlassian has the best economics on paper and the worst supply shock in practice.** 0% revenue share on Forge up to $1M lifetime, free hosting within Forge allowances, verified payouts. But new cloud listings went from ~55–90 per month (mid-2025) to 453 in Sep 2026 and 543 in Oct 2026. Of 1,075 vendors whose every listing is under 12 months old, the median has **1 install in total**; 17 (1.6%) have 100+; the best independents have 600–700.
3. **Gaps visible in listing data get swarmed within weeks.** Example: Google's abandoned "Google Chat for Jira Cloud" (10,992 installs, 2.3★, Connect, last release 2021). Ten paid Forge clones were listed between 2026-08-31 and 2026-10-28; they have 0–2 installs each.
4. **$10k MRR on Atlassian ≈ 1,200–2,500 active installs of a paid app.** Derived from partner tiers: Silver partners (≥ $150K annual cloud gross sales) have 1,067–6,049 installs on paid apps (median 2,295). One-app Silver partner Magic Apps: 1,486 installs at $1.00/user. No independent vendor that started in the last 12 months is near that.
5. **monday.com is structurally the least crowded** (850+ apps for ~250,000 customers, 0% take until $200K lifetime revenue, vendor case studies of $30K MRR) but its submission page states: *"New apps built primarily using no-code platforms or AI-generated 'vibe code' are not eligible for marketplace approval"* and apps that replicate existing ones may be declined. That is a direct conflict with a 1-day AI-agent build.
6. **Gated marketplaces (Slack: 10 active workspaces + up to 10 weeks of review; HubSpot: 3 active installs; Miro: 8–12 weeks) are slow but protected from the swarm.** I could not quantify any gap there.
7. **Best-evidenced ideas (ranked in Part 3):** (1) Gmail → Notion saver on Google Workspace Marketplace, billed via Paddle; (2) Forge-native Google Drive & Docs for Confluence/Jira with a migrator for the largest orphaned Connect portfolio; (3) Jira ⇄ Google Sheets live reports, two-sided listing; (4) successor to an orphaned Silver-tier estimation app; (5) spreadsheet macro for Confluence; (6) a monday.com slot that is conditional on a discovery pass I could not do.
8. **Verdict:** through this channel alone, $10k MRR by month 12 is possible but improbable for a solo founder with no audience. My subjective estimate is roughly 5–8% for the best idea and under 5% for the others; a $2–6k MRR outcome is the realistic good case. Reasoning and comparables are in section 5.

---

## 2. PART 1 — Economics per marketplace

### 2.1 Compact table

| Marketplace | Base | Native billing | Platform take (2026) | Payout / Ukraine FOP | Listing gate and lead time | Compliance cost | Verdict |
|---|---|---|---|---|---|---|---|
| **Atlassian** (Jira, Confluence, JSM; Forge) | 300,000+ customers [F] | Yes; Forge apps can only be Free or Paid-via-Atlassian [F] | **0% up to $1M lifetime Forge revenue**; then 16% (from 1 Apr 2026), 17% (from 1 Oct 2026). Connect 20% → 25% [F] | USD SWIFT wire monthly (~17th–21st), $500 threshold, 30–60 days after sale. **Ukraine FOP confirmed by Atlassian staff** [F] | Official 10–15 business days; community reports 2–5+ weeks; partner verification (ID via Stripe Identity), custom-domain email [F] | $0 mandatory. Optional Enterprise Certified badge needs annual CREST pen test ($1,000 per testing day, typically 2–5 days), VPAT, trust center [F] | Best economics; severe flood |
| **monday.com** | ~250,000 customers, 850+ apps, 1.6M installs [F] | Yes, mandatory for new apps [F] | **0% until $200K lifetime revenue**, then 15% [F] | Monthly via Payoneer in USD; invoice upload → finance review (7 business days) → payment within up to 60 days [F]. Payoneer for Ukraine not re-verified today [U] | 4 phases; first response within 72 business hours; **AI "vibe code" apps not eligible**; duplicates may be declined [F] | Security/privacy review in listing process; details not fetched [U] | Good economics; policy gate |
| **Microsoft** (Teams Store / AppSource transactable SaaS) | Not fetched [U] | Optional (transactable SaaS offer) [F] | 3% store service fee [F] | Monthly; $50 threshold; **Ukraine: Microsoft Marketplace = Yes**, wire 7–10 business days, PayPal = No [F] | Teams validation report within 24 working hours, iterative; publisher verification required [F] | SaaS Fulfillment API + landing page + Entra ID integration; optional M365 certification [F] | Payable; heavy build; weak discovery evidence |
| **Google Workspace Marketplace** | Not fetched [U] | None; no listing fee [F] | 0% (you bill yourself) [I] | Via merchant of record (Paddle supports Ukraine except listed regions) [F] | Review "typically several days"; sensitive-scope OAuth verification up to 10 days; restricted scopes need annual third-party security assessment, "several weeks" [F] | $0 unless restricted scopes (CASA cost not fetched [U]) | Fast, discoverable, low ARPU |
| **Slack** | Not fetched [U] | None [F] | 0% [I] | Via merchant of record | Must already have **10 active workspaces**; preliminary review ≤ 10 business days, functional review **up to 10 weeks**; Marketplace is the only allowed commercial channel (ToS 29 May 2025) [F] | Not fetched [U] | Slow; no data on gaps |
| **HubSpot** | 2,000+ apps; 95% of customers have ≥ 1 app [F] | None; pricing must match your website [F] | **No fees or commissions** (agreement §6) [F] | Via merchant of record | **3 active unaffiliated installs**; first review within 10 business days; whole process ≤ 60 days [F] | OAuth only; certification optional [F] | Plausible; no listing data |
| **GitHub Marketplace** | Not fetched [U] | Yes [F] | 5% [F] | Paid when ≥ $500 in a month; payout countries [U] | Verified publisher org + **100 installs before a paid plan** [F] | — | Weak (gate before revenue) |
| **Zendesk** | Not fetched [U] | Yes, **only via your own Stripe account** [F] | Not fetched [U] | **Blocked** without a Stripe-eligible entity [I] | 1–3 weeks [F] | — | Blocked |
| **Zoom** | Not fetched [U] | Yes, **US-based developers and buyers only** [F] | Not fetched [U] | **Blocked** [F] | Functional + security review [F] | — | Blocked |
| **Figma** | Not fetched [U] | Yes (Stripe) [F] | 15% [F] | Ukraine not in payout list; **"not approving new creators to sell paid files"** [F] | — | — | Blocked |
| **Miro** | 70M users [F] | None ("doesn't currently offer a native monetization solution") [F] | 0% [I] | Via merchant of record | Review **up to 8–12 weeks** [F] | Security guidelines [F] | Slow |
| **Pipedrive** | Not fetched [U] | None (link to your pricing page) [F] | [U] | Via merchant of record | Up to 21 business days [F] | — | Minor |
| Salesforce AppExchange | [U] | [U] | [U] (docs returned 403 today) | [U] | Security review; recalled as months, not re-verified | Recalled as paid review, not re-verified | Skip for solo/1-day |
| Notion, ClickUp, Asana, Linear, Airtable, Intercom, Freshworks | [U] | Not verified today; recalled as directories without vendor billing | — | — | — | — | Skip as primary channel |

### 2.2 Atlassian Marketplace (the only one with census-level data)

**Revenue share [F]** — `developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/` (fetched 2026-11-13): partner keeps Forge 84% / Connect 80% / Data Center 75% from 1 April 2026; from 1 October 2026 Forge 83% / Connect 75% / DC 75%. "As of 1 January 2026, partners will receive 100% of gross revenue earned on Forge, up to $1 million in lifetime Forge revenue." Reconfirmed by Atlassian staff on 2026-10-02 (thread 103068). A Forge app must contain no Connect modules, use OAuth and Forge UI.

**Payment model [F]** — Forge apps can be only Free or Paid-via-Atlassian; no paid-via-vendor (staff, thread 103068, 2026-10-02). Pricing is per user of the host product, with a flat price for up to 10 users (many vendors set it to $0) and marginal per-user tiers above. Price guidance is advisory; "you have full autonomy" (same thread). No usage-based billing yet (thread 103388, 2026-10-21). Paid-via-Atlassian is not available for Bitbucket and Compass cloud apps.

**Payout [F]** — Partner Agreement §4.4: paid ~30 days after the end of the month of sale, by electronic transfer to "a valid bank account in your name", in USD, once ≥ $500 has accrued; bank wire fees are yours. Remittance arrives the 17th–20th (docs) / "around the 21st" (staff, thread 103633).

**Ukraine [F]** — Thread 103157 (2026-10-07), Atlassian Marketplace staff: *"Marketplace payouts to government-controlled territory in Ukraine are fully supported. Payouts are sent monthly in USD via SWIFT wire transfer to an entrepreneurial (FOP) USD bank account... A legal entity is not required. Registering as an FOP fully satisfies partner verification. You'll complete standard ID verification via Stripe Identity and provide your state registration / tax ID... Complete a standard Form W-8BEN."* Banks named: PrivatBank, Monobank/Universal Bank, Raiffeisen, UKRSIBBANK. Thread 102880 (2026-09-24), a partner: *"I'm a sole proprietor registered in Ukraine and an Atlassian Marketplace Partner using Paid via Atlassian. I receive Marketplace payouts directly to my Ukrainian bank account (monobank)."*

**Approval [F]** — Official: "Approvals take 10-15 business days, but approval times vary." Prerequisites: partner verification ticket, Privacy & Security tab, security questionnaire, company email on a custom domain (no Gmail), privacy policy, documentation. Community evidence of friction: apps stuck 2–3 weeks with tickets silently "waiting for customer" (threads 98986, 99096, Feb 2026); auto-rejection with "no reason" because partner verification was incomplete (99096); an app approved on 13 April 2026 still "pending approval" two months later (101303). **AI-generated code is not screened:** staff, thread 102047 (2026-08-06): "No policy for or against... Atlassian does not distinguish... they don't examine code ownership or your codebase."

**Security and compliance [F]** — Mandatory technical requirements (auth on every endpoint, least-privilege scopes, no storing Atlassian user credentials, no vulnerable dependencies, tenant isolation, incident notification, a named security contact). Vulnerability-fix SLAs tightened and enforceable from 1 September 2026. Same thread 102047 lists obligations a solo vendor carries: 10 days to fix a Critical finding, a P1 ticket within 24 hours of an incident, a written incident-response process. Optional trust badge: **Atlassian Enterprise Certified** launched 1 October 2026, replacing Cloud Fortified (badges expire 31 December 2026); it has its own search filter and a badge on app tiles. The requirement set published in RFC-133 includes evidence of an annual pen test by a CREST-accredited provider (Atlassian/Bugcrowd programme: $1,000 per testing day, typically 2–5 days), a public VPAT and published trust documentation; the final programme text was not re-read [U]. "Runs on Atlassian" is applied automatically to Forge apps with no data egress.

**Hosting cost [F]** — Forge is consumption-priced since January 2026 with free monthly allowances (200,000 GB-seconds of function time, 0.1 GB KVS reads/writes, 730 GB-hours SQL storage, etc.). Forge LLM calls have no free allowance. Rovo agent usage is billed to the customer's organisation, not the partner.

**Discovery [F/U]** — Marketplace search, categories, trust filters, in-product app browser. "We don't support paid advertising for Marketplace listing rankings" (staff, thread 101172, 2026-06-14). Ranking factors are not published [U]. Atlassian does not arbitrate reviews: a competitor's 1★ review stands if the reviewer technically installed the app (thread 99104, Feb 2026).

**Trial and billing cycle** — Cloud apps have a free evaluation of at least 30 days ending at a billing-cycle boundary; recalled from Atlassian licensing docs, the specific page failed to load today [U]. Customer refunds are automatic within 30 days [F].

**Price points (first-100-users tier, per user per month) [F, API 2026-11-13]** — Power BI Connector for Jira $3.31; Rich Filters $2.65; Mobility Stream Google Sheets Integration $1.35; Timepiece $1.20; Time in Status (SaaSJet) $1.15; Magic Estimations $1.00; ikuTeam Files $1.00; SprintPoker $0.84; Elements Spreadsheet $0.80; ikuTeam Google Drive Connector (Confluence) $0.72; Excellentable $0.70; Bilith Google Drive & Docs for Confluence $0.60, for Jira $0.35; recent small-vendor utilities $0.50–0.70.

**Partner tiers [F]** — Silver ≥ $150K, Gold ≥ $750K, Platinum ≥ $3M annual cloud gross sales (plus bug-bounty and support requirements; Gold/Platinum also SOC 2 or ISO 27001). $10k MRR is $120K a year, i.e. just under Silver.

**Platform risk [F]** — (a) Connect: no new Connect apps since September 2025, no updates to Connect-descriptor apps since March 2026, end of support **31 January 2027**. (b) Points-based API rate limits introduced in 2026 (most-read thread of the year: 174 posts, 11,793 views); a shared hourly bucket for Tier 1 apps. (c) Native bundling announced in 2026: tabs in Confluence (July), native numbered headings (September), individual capacity planning in Jira (RFC-120). (d) Data Center end of life: new-customer sales ended 30 March 2026, expansions end 30 March 2028, read-only on 28 March 2029.

### 2.3 monday.com

- **Economics [F]** (`developer.monday.com/apps/docs/subscriptions-payments-and-billing`): "Once your app reaches $200,000 in lifetime accumulated revenue, the program is activated... 85% of the app's revenue goes to the developer, 15% is collected by monday.com." monday handles billing, VAT and currency. Automatic refund if a user cancels within 30 days of first purchase.
- **Payout [F]**: "Developers receive monthly payouts via Payoneer in USD." You upload an invoice to a shared payment board; finance reviews within 7 business days; "payment will be issued within up to 60 days."
- **Gate [F]** (`developer.monday.com/apps/docs/submit-your-app`, page marked "Updated 9 months ago"): *"New apps built primarily using no-code platforms or AI-generated 'vibe code' are not eligible for marketplace approval."* and *"submissions that do not demonstrate clear, unique value to monday.com users or significantly replicate the functionality of existing marketplace apps may be declined."* First response within 72 business hours; total duration open-ended.
- **Size [F]** (`monday.com/appdeveloper/monetization`): ~250,000 customers, 850+ live apps, 1.6M installs, 49% of all accounts and 87% of enterprise accounts have at least one app. Partner tiers from Bronze ($5K ARR) to Platinum ($1M+ ARR).
- **Discovery [F]**: "App visibility in the marketplace is influenced by factors such as installs, user engagement, ratings, and app reliability." `monday.com/robots.txt` disallows `/marketplace/listing/` and `/marketplace/category/`, so listings get no search-engine traffic [I]; discovery is in-product.
- **Vendor outcomes [F, monday's own marketing]**: Pioneera (non-technical founder, apps built by an agency, MVP in two weeks) "scaling to $30,000 in monthly recurring revenue in just a few months" (post dated 18 Feb 2025); Jetpack Apps' VLOOKUP Auto-link "thousands of installs and hundreds of paying customers" (May 2024). Both predate the 2026 policy and are portfolios of "missing platform feature" apps found in community threads.
- **Platform risk [F]** (monday blog, 10 Sep 2025): monday vibe lets customers generate their own apps from a prompt; monday says this "raises the bar" and that value shifts to apps with domain depth and external-system integration.

### 2.4 Microsoft (Teams Store, Microsoft 365, AppSource)

- 3% store service fee on transactable offers [F]. Payout monthly; threshold $50; Ukraine row in the payout table: Microsoft Marketplace Yes, Microsoft Store Yes, PayPal No; wire takes 7–10 business days [F] (page last updated 2025-10-23).
- Selling through Microsoft requires a SaaS offer with a landing page, SaaS Fulfillment API integration and a `usageRights` Graph check [F]. That is not a 1-day build [I].
- Teams Store validation: "detailed test report in 24 working hours post submission", then rounds until clean; publisher verification first [F].
- I found no listing-level install data and no solo-vendor revenue evidence [U]. Copilot/agent bundling risk not researched today [U].

### 2.5 Google Workspace Marketplace

- No listing fee and no billing service [F]; you charge through your own checkout.
- Review "typically takes several days" [F]. OAuth verification: sensitive scopes "can take up to 10 days"; restricted scopes accessed via a third-party server "must undergo an annual security assessment" by a Google-approved assessor and "can potentially take several weeks" [F]. Gmail add-ons can use the non-restricted `gmail.addons.current.message.readonly` scope [F].
- Listings show rating, rating count, cumulative "users", pricing label and listing-updated date [F].
- **New apps can surface by exact keyword match [I from F]:** on 2026-11-13 the #1 result for "form approval" was an app showing "No users"; the #2 result for "approval workflow" had 8 users.
- **Google builds first-party connectors itself [F]:** the Connectors category shows 38 cards, all by Google/Google LLC (GitHub 2M+, Salesforce 92K+, Asana 28K+, HubSpot 14K+, Atlassian Rovo 1K+, monday.com 281, …).

### 2.6 Slack

- "Slack allows you to charge users for your app. If you do so, you should handle payments securely" — no billing service [F].
- Submission blocked unless the app is "installed on 10 or more active workspaces"; preliminary review up to 10 business days; "the functional review takes up to 10 weeks for new submissions"; each resubmission resets your queue position [F].
- ToS update 29 May 2025: "the Slack Marketplace is the only appropriate channel for commercially distributing apps built with Slack APIs" [F]. Apps that "use Slack data to train Large Language Models" are not accepted [F].
- No install counts exist publicly; no gap analysis possible today [U].

### 2.7 Billing where the marketplace has none

Paddle "works with software businesses anywhere in the world" except a list that includes Crimea, Donetsk, Kherson, Luhansk and Zaporizhzhia regions of Ukraine, Russia and Belarus [F] (`paddle.com/help/.../which-countries-are-supported-by-paddle`). A founder in any other part of Ukraine can use it. Paddle's fee, verification time and payout schedule were not fetched [U]. Stripe's country page contains no mention of Ukraine [F].

### 2.8 Time from build to first money in the bank (estimates)

| Channel | Listing live | First charge | First payout | Basis |
|---|---|---|---|---|
| Atlassian | 3–6 weeks after submission | after ≥ 30-day evaluation | **~4–5 months** from build | 10–15 business days official + verification + observed delays [F]; trial [U]; $500 threshold; paid ~21st of month after month of sale [F] |
| monday.com | unknown; weeks | at purchase (trial length set by vendor [U]) | **~3–4 months** | invoice review 7 business days + payment within 60 days [F] |
| Google Workspace + Paddle | 1–4 weeks | immediately on listing | **~6–10 weeks** | review "several days", OAuth up to 10 days [F]; Paddle onboarding and payout cycle [U] |
| Slack + Paddle | ≥ 3 months after you already have 10 workspaces | — | **5+ months** | [F] |
| Microsoft transactable | days to weeks after a heavier build | at purchase | **~2–3 months** | [F]/[A] |

---

## 3. PART 2 — Gap finding

### 3.1 Atlassian

#### (a) Supply shock

New cloud listings by month of first cloud version [F, API]:

| 2025-06 | 07 | 08 | 09 | 10 | 11 | 12 | 2026-01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 37 | 57 | 68 | 75 | 81 | 53 | 66 | 90 | 127 | 200 | 215 | 160 | 186 | 220 | 321 | 453 | 543 |

(November shows 46 through the 13th; recent months are under-counted because apps appear only after approval.)

- 7,293 cloud listings in total: 4,827 paid-via-Atlassian, 2,123 free, 343 paid-via-vendor. Jira 5,218, Confluence 2,036, Bitbucket 192.
- 41% of all cloud listings (2,999) are under 17 months old.
- Since 2026-08-01: 1,363 new apps from 706 vendors; 49 vendors shipped five or more (one shipped 30, another 45 in under a year for a total of 181 installs).
- In October–November 2026 alone the developer forum has "can I get paid in my country?" threads from Ukraine (two), Armenia, Argentina, India, Guatemala, Canada, Turkey, the UK, Switzerland [F]. The entrant wave is global [I].

#### (b) What happens to new apps

| Launch cohort | Apps | Median installs | ≥ 10 | ≥ 100 | ≥ 500 |
|---|---|---|---|---|---|
| 2025-06 to 2026-01 (10–17 months old) | 527 | 2–6 | 164 | 34 (6.5%) | 3 (0.6%) |
| 2026-02 to 2026-07 (4–9 months old) | 1,108 | 1–3 | 191 | 36 | 10 |
| since 2026-08-01 | 1,363 | 0–1 | 65 (4.8%) | 3 | 1 |

Vendors whose every listing is under 12 months old: **1,075 vendors, 1,985 apps, median total installs 1**; 17 vendors ≥ 100 installs, 5 ≥ 500, 2 ≥ 1,000 (Cursor and GitHub). Best independents: Clovity 713 installs across 10 apps, Bytera 608 across 4, Plugio 583 across 10 (almost all free), 9ByNight 226, ORBISCEND 206.

Who actually grows fast [F]: big brands with free integrations (Atlassian's Claude Agent for Jira 11,583; Cursor 4,152; GitHub Copilot 3,977) and **established vendors cross-selling to an existing base**: Broken Build's five new chart apps sit at 1,184–1,203 installs each; Agile Pulse's seven new apps at 309–962 each on top of an older free app with 3,158. Near-identical counts across one vendor's apps suggest bundled or cross-installs rather than independent demand [I].

#### (c) Revenue per install benchmark (derived)

Among 157 vendors with ≥ 1,500 total installs: 31 Platinum, 45 Gold, 33 Silver, 48 untiered [F]. Installs on their paid apps:

| Tier (annual cloud gross sales) | Vendors | Min | Median | Max | Implied $ per paid-app install per month at the median |
|---|---|---|---|---|---|
| Silver (≥ $150K, < $750K) | 33 | 1,067 | 2,295 | 6,049 | ≥ $5.4 and < $27 |
| Gold (≥ $750K, < $3M) | 45 | 1,461 | 3,766 | 18,117 | ≥ $16.6 |
| Platinum (≥ $3M) | 31 | 1,906 | 11,315 | 174,427 | ≥ $22 |

Useful single-app points: **Magic Apps** — Silver, one paid app, 1,486 installs, $1.00/user → at least $8.4 per install per month. Inprowiser — Gold, one app, 1,517 installs → at least $41. SoftComply (risk/compliance) — Gold with 1,461 paid-app installs → at least $43. Untiered vendors with thousands of paid-app installs also exist (votazz 5,729; ALDEVA 3,535; Agile Pulse 2,124; Bilith 7,845) [F].

Caveats [I]: install counts include Data Center installs where a listing has both; tiers reflect sales from July 2025 to June 2026 while installs are today's; a vendor can miss a tier for bug-bounty reasons rather than revenue. The table gives order of magnitude: a horizontal utility at ~$1/user yields very roughly $5–10 per install per month; compliance and BI niches several times that.

#### (d) Swarm case study

"Google Chat for Jira Cloud" by Google LLC: 10,992 installs, 2.30★ (109 reviews), Connect, last version 2021-11-11 [F]. An ideal-looking gap. Listings found on 2026-11-13: Notify for Google Chat (first version 2026-08-31), Chatpane (10-01), Chat Relay (10-07), Sago Alerts (10-07), Ulte Chat (10-10), ChatPulse (10-11), Threadline (10-13), Chatline (10-14), Herald (10-20), Spacecast (10-28) — ten paid apps with nearly identical taglines ("JQL filters, one thread per issue, daily digest") and **1, 0, 0, 0, 0, 0, 1, 0, 0, 2 installs** respectively. A free Forge alternative from an established vendor (Move Work Forward, 408 installs) and a native Jira Automation action already absorb the need [F/I].

Same pattern by name bigram among apps launched since August: "time status" 22 apps, "planning poker" 13, "issue templates" 10, "permission audit" 8, "google chat" 7, "recycle bin" 6, "sign off" 6, "access review" 6 [F]. "Permission audit / access review": 15 new apps in 12 months, maximum 6 installs [F] — swarms also form where there is no demand.

**Implication [I]:** on Atlassian, a gap that can be read off public listing data and built in a day is not an advantage. What the swarm does not do: pass third-party gates (Google OAuth verification, pen tests), migrate customers' existing data, pick up the phone, answer support in hours.

#### (e) The Connect end-of-support pool

Since 24 July 2026 Atlassian shows a yellow "LEGACY" lozenge and a warning on Connect apps in the admin "Connected apps" page [F, thread 103279]. A consultant reports an enterprise customer refusing to buy two Platinum-partner apps because of it (2026-10-14). Atlassian: over 95% of paid app seats have migrated (3 Aug 2026) and after 31 January 2027 "breakages will become more frequent... some of which will cause apps to stop functioning without advance notice."

What is left [F, API]:

- 925 Connect listings, 226,031 installs. Of these 445 are paid: **42,447 installs across 225 vendors**.
- Vendors with **no non-Connect listing at all** hold 12,009 paid installs across 123 vendors.
- Largest paid Connect portfolios:

| Vendor | Paid Connect installs | Paid Connect listings | Last Connect release | Non-Connect listings | Tier |
|---|---|---|---|---|---|
| Bilith (4 vendor profiles) | 7,845 | 21 | 2026-03-20 | 1 (35 installs, released 2026-10-13) | none |
| WISOFT | 2,230 | 3 | 2022-01-20 | 1 | Silver |
| Bloompeak Labs | 2,075 | 3 | 2025-01-19 | 4 | none |
| Teamlead | 1,691 | 3 | 2026-03-31 | 2 | Silver |
| Tech Labs | 1,630 | 4 | 2025-04-24 | 0 | none |
| **Magic Apps** | 1,486 | 1 | **2025-03-23** | **0** | **Silver** |
| StreamlineSoft | 1,353 | 4 | 2024-11-12 | 2 | Silver |
| Addteq (Excellentable) | 1,290 | 3 | 2026-02-19 | 1 (from 2024) | — |
| Colined | 1,282 | 2 | 2026-02-17 | 0 | none |
| gesesoft (Outlook Connector) | 722 | 1 | 2025-02-03 | 0 | — |
| David Simpson Apps | 626 | 12 | 2024-05-21 | 0 | none |

Bilith in detail [F]: Google Drive & Docs for Confluence 2,746 installs ($0.60/user), for Jira 1,213 ($0.35); OneDrive & SharePoint for Confluence 956 and Jira 524; Asana for Confluence 801; Box, Dropbox, Wrike, calendar gadgets. Recent reviews of the Drive app: "Extremely poor responsiveness. I have been ignored for weeks" (1★, 2026-02-24); "No support. Stopped working and no response to support emails" (1★, 2025-06-24); "Either Bilith has gone under or they have zero customer support" (1★, 2022).

Sizing caution [I]: Bilith holds no partner tier despite 7,845 paid installs. Either its cloud sales are under $150K a year or it fails the bug-bounty/support criteria. If the former, the entire Bilith revenue pool is below ~$12.5k MRR. Magic Apps is the only vendor with zero Forge listings whose orphaned app is proven to earn ≥ $150K a year.

#### (f) Large install base, mediocre rating (paid apps)

| App | Installs | Rating (reviews) | Note |
|---|---|---|---|
| Capacity Planner (Tempo) | 9,198 | 3.66 (200) | complex product |
| BigGantt (Appfire) | 5,469 | 3.46 (273) | native Timeline covers basics |
| WBS Gantt-Chart (Ricksoft) | 5,273 | 3.49 (161) | |
| Questions for Confluence (Atlassian) | 3,520 | 3.02 (78) | Rovo answers are a substitute |
| ESU Lite epic reports | 2,735 | 2.99 (43) | "epic progress": 5 clones since August |
| Capture for Jira (SmartBear) | 2,121 | 3.00 (153) | needs a browser extension |
| Elements Spreadsheet | 1,960 | 3.27 (73) | reviews: "Spreadsheets disappeared all of the sudden" |
| Page Approval (Appfire) | 1,598 | 3.39 (73) | "page approval(s)": 8 clones since August |
| Recurring Tasks (Big Fig Tree) | 1,553 | 3.52 (38) | 9 clones since August; native automation |
| Excellentable (Addteq, Connect) | 1,243 | 3.44 (52) | legacy |
| Calendar for Jira (Teamlead, Connect) | 981 | 3.33 (104) | vendor is migrating |
| Gantt Cloud (WISOFT, Connect) | 907 | 2.96 (85) | vendor is migrating |

Free official integrations are worse still (GitLab for Jira 32,113 at 2.76★; Sentry 16,249 at 2.47★; Harvest 2,434 at 2.53★, last release 2021) but their users expect free [I].

#### (g) Where entrants are scarce

Across 50 keyword clusters, almost every one received dozens to hundreds of new apps in 12 months (reports/charts 402, AI/Rovo 337, custom fields/workflow 330, risk/compliance/audit 306, JSM portal 278, export 252). The exceptions are integrations that need a third party's approval or a remote backend [F]:

| Cluster | Apps | Installs | New in 12 months (max installs) |
|---|---|---|---|
| Google Drive/Docs/Sheets/Workspace | 58 | 17,865 | 5 (104) |
| Google/Outlook calendar sync | 34 | 12,751 | 3 (40) |
| SharePoint / OneDrive / Microsoft 365 | 27 | 19,364 | 3 (104) |
| BI connectors (Power BI, Tableau, BigQuery, Snowflake, Looker) | 55 | 17,913 | 9 (290, a free app by the category leader) |
| Salesforce / HubSpot / Zendesk / ServiceNow | 116 | 30,610 | 30 (104) |

BI connectors carry the highest list prices in the catalogue: Power BI Connector for Jira (now under Tempo; 8,397 installs) costs $166/month at 50 users, $562 at 200, $1,435 at 1,000 [F]. Counter-evidence: Pallas Apps launched a Power BI connector on 2025-08-17 and has 62 installs after 15 months [F].

#### (h) New surfaces

- **Rovo agents / AI:** 738 apps match AI/Rovo/agent terms; 337 launched in 12 months; the only ones with traction are free brand integrations [F]. Customers can build agents themselves; Rovo usage is billed to them [F]. Not a low-competition surface.
- **Forge dashboard widget module** went GA in September 2026 with a migration path for old gadgets (RFC-151) — incumbents' job [I].
- **Goals & Projects extensibility** (RFC-153, 26 Oct 2026), **CSM extensibility** (RFC-123), **Rovo Search knowledge sources** (RFC-156, 13 Nov 2026) are RFCs, not shippable modules yet [F].
- **Bitbucket Cloud:** only 135 Bitbucket-only listings with 3,146 installs in total, 115 of them free, and no Atlassian billing [F]. Thin supply and thin demand.

#### (i) Data Center migration

748 of 1,583 Data Center listings have no cloud listing under the same key [F], but most have a cloud sibling under another key or are impossible in cloud (SSO, theming, file-system tools). The DC-only functions with real installs that looked feasible (user switcher ~2,300 installs across four apps, last-login tracking ~1,800, announcement banners ~700) either depend on capabilities Forge still lacks or sit in clusters already flooded on cloud. I did not find a clean DC-migration gap [I]. One structural point stands: migrating enterprises are large sites, and Atlassian pricing scales with site size, so a few such customers are worth many small ones.

### 3.2 Google Workspace Marketplace

Low-rated incumbents with large cumulative installs [F, listing pages 2026-11-13]:

| App | "Users" | Rating (count) | Listing updated | Pricing reality |
|---|---|---|---|---|
| Gmail™ to Notion – Save Emails to Notion Databases (livepolls.app) | 1M+ | 2.9 (77) | 2025-02-13 | Labelled "Free of charge"; reviews: "Gives you *one* capture, then $16 / month" |
| Save to Notion (Digital Inspiration) | 72K+ | 2.2 (65) | 2025-02-28 | Free; plain text only |
| Google Tasks & Notion Sync (same developer as the first) | 110K+ | 2.6 (30) | 2025-02-08 | "It's not free... Says Free of charge at the front" |
| Jira Cloud for Sheets (Atlassian, official) | 3M+ | 3.4 (214) | 2024-12-16 | Free |
| Gopher for Drive | 15M+ | 3.4 | — | education admin tool |
| Shared Drive Reports | 158K+ | 3.0 | — | |
| Timesheet (TimeNavi) | 19K+ | 3.2 | — | |
| pdfFiller for Google Drive | 2M+ | 2.0 | — | large vendor |

Other observations [F]:

- "Jira" search: besides the official add-on, **Project Aid for Jira by an individual developer has 322K+ users** (4.2★, free, updated Feb 2026); Mobility Stream's add-on has 34K+ and is paired with a paid Jira app (702 installs, $1.35/user) — i.e. discovery on Google, billing through Atlassian.
- Mail merge, form approval, document generation, email signatures, SMS/WhatsApp: led by long-established apps rated 4.5+ with millions of users. No gap.
- E-invoicing (XRechnung, ZUGFeRD, Factur-X, Peppol): leader has 2K+ users, the rest between 1 and 173. The German mandate has not created Marketplace demand [I].
- Drive permission audit: small apps (313 to 11K users) under one enterprise-grade leader. No gap.
- Fresh look-alike entrants appear in most queries (apps with 0–200 users and descriptions written to the keyword). The swarm exists here too, at lower density than on Atlassian [I].

### 3.3 monday.com

No listing data could be collected, so no gap is verified. What the primary sources do establish [F]: successful solo vendors found ideas in community feature requests ("Same Item in Multiple Boards", "VLOOKUP Auto-link"), grew through community replies and by asking every onboarded user for a review, and run portfolios. The 2026 submission policy and monday vibe together push toward external-system integrations and domain-specific apps and away from small UI utilities.

### 3.4 Microsoft, Slack, HubSpot and the rest

No listing-level evidence. I make no gap claims.

---

## 4. PART 3 — Ranked ideas

Ranking criteria: strength of demand evidence, a concrete trigger, protection from the swarm, speed to first payout for a Ukrainian FOP, and honest odds of $10k MRR.

### Idea 1 — Gmail → Notion saver with honest pricing (Google Workspace Marketplace + Paddle)

| | |
|---|---|
| Who has the problem | People who run client, candidate, vendor or deal tracking in Notion databases and receive the raw material by email: freelancers, agencies, recruiters, small teams (2–20) |
| Who pays / decides | The same individual or team lead, by card. Self-serve; no admin approval for a Gmail add-on on personal or small-business Workspace (larger domains may restrict add-ons [A]) |
| Recurring job | File an email with sender, date, body and attachments into the right Notion database with mapped properties, several times a day or week |
| Search trigger | "gmail to notion", "save email to notion", "notion" in the Marketplace |
| Alternatives | Gmail™ to Notion: 1M+ users, 2.9★ from 77 ratings, stale since Feb 2025, one free capture then $16/month per reviews. Save to Notion: 72K+, 2.2★, free, plain text. Quicktion: 10K+, 3.9★. At least three newer look-alikes exist outside the top results (Nestbox, FerryQuill, Clipmail). Zapier/Make forwarding. Notion's own mail client: capability to file into databases not checked [U] |
| Cost of status quo | 1–2 minutes of copy-paste per email, or $16/month for a tool users describe as unreliable and misleading |
| Evidence of willingness to pay | The incumbent sustains a $16/month paywall [F from reviews]; share of payers [U] |
| Wedge | A real free tier (for example 20 saves a month), $6/month or $60/year, attachments and property mapping that work, visible changelog and support |
| Onboarding / time to first value | Install → connect Notion (OAuth) → choose database → save the open email. Under 3 minutes |
| First customers | Marketplace search: the top incumbent is weak on rating and freshness, and exact-match titles rank even with zero users [I]. Outside channel: Notion user communities and template creators |
| Retention | Sits inside a daily workflow; history accumulates in the customer's own Notion database |
| Solo-operable | Yes. Support is consumer-style but shallow |
| Price / ARPU / customers for $10k | $6–8 per month → **1,250–1,670 subscribers** |
| Build → first payout | Build day 1; OAuth verification up to 10 days + review "several days" → live in 2–4 weeks; Paddle approval and payout timing [U] → **about 6–10 weeks** |
| 1 day vs later | Day 1: sidebar add-on, Notion OAuth, save with mapping, attachments, paywall. Later: saved presets, team plan, Outlook add-in. Avoid auto-rules on the whole mailbox: that needs a restricted Gmail scope and an annual security assessment |
| Platform risk | Notion building this natively; Notion API limits on file uploads [U]; Google policy; Marketplace clones |
| Most dangerous assumption | That "1M+ users" reflects live demand. Only 77 people rated the incumbent; the count is cumulative |

Verdict: base case $2–6k MRR at month 12; $10k needs roughly 50–70k installs at 2–3% paid conversion. Fastest path to first revenue of anything here, lowest ARPU, weakest moat.

### Idea 2 — Forge-native Google Drive & Docs for Confluence and Jira, with a one-click migrator from legacy Connect macros (Atlassian)

| | |
|---|---|
| Who has the problem | Confluence/Jira Cloud admins at Google-Workspace companies whose installed Drive app now carries Atlassian's "LEGACY" warning and whose vendor does not answer support |
| Who pays / decides | Site admin approves; billed on the Atlassian invoice |
| Recurring job | Keep Drive files and folders embedded in pages and attached to issues, permission-aware |
| Trigger | LEGACY lozenge since 24 July 2026; end of support 31 January 2027; compliance rules against unsupported software; the first breakage |
| Alternatives | Bilith Google Drive & Docs for Confluence 2,746 installs at $0.60/user, for Jira 1,213 at $0.35 (both Connect, vendor unresponsive per reviews). ikuTeam (Forge, actively released): Google Drive Connector in Confluence 1,528 at $0.72, in Jira 1,664 at $0.50, ikuTeam Files 1,782 at $1.00. EliteSoft 171. Native Smart Links embed single files for free |
| Cost of status quo | Every page carrying a legacy macro has to be rebuilt by hand when the app breaks; count of affected pages × minutes |
| Evidence of willingness to pay | ~4,000 installs on Bilith's two Drive apps and ~5,000 on ikuTeam's, all paid listings |
| Wedge | (1) A scanner that finds legacy macros and rewrites them in bulk, so switching takes minutes; (2) support answered within a day; (3) price at or below Bilith's |
| Onboarding / time to first value | Install → run scan → preview → convert. Minutes for a small site |
| First customers | Marketplace terms "google drive confluence", "google docs jira": outranking ikuTeam is hard for a new listing. Realistic entry: the long tail around "migration"/"legacy", answers in the Atlassian Community to Connect end-of-support questions, direct outreach to Atlassian Solution Partners who manage client sites, and to the companies named in Bilith's roughly 90 public reviews of the two Drive apps |
| Retention | Macros embedded across the wiki; switching cost is high once converted |
| Solo-operable | Yes (Forge hosting, Atlassian billing). Must meet security SLAs alone |
| Price / ARPU / customers for $10k | $0.50–0.60/user; by the tier benchmark roughly $3–5 per install per month → **2,000+ installs**, i.e. about half of Bilith's Drive base. Not reachable from this app alone; needs the OneDrive/SharePoint, Box and Dropbox siblings (another ~2,100 Bilith installs) and more |
| Build → first payout | Listing live mid-December to mid-January if submitted next week; first payout about March–April 2027 |
| 1 day vs later | Day 1: embed macro, Jira issue panel using Google Picker with per-file scope, macro scanner/converter. Later: folder browser (restricted Drive scope → Google verification plus annual security assessment), OneDrive/SharePoint, Box |
| Platform risk | Bilith ships Forge versions in time (it released one in October); ikuTeam absorbs the refugees; legacy apps keep working for months after January; Smart Links improve |
| Most dangerous assumption | That customers move in 2027 rather than sit on a still-working legacy app, and that they pick an unknown vendor over ikuTeam |

Verdict: the best-timed Atlassian wedge and the one with a real barrier (Google verification, data migration), but the pool is small. Bilith is untiered, so its whole portfolio may earn under ~$12.5k MRR [I]. Base case $1–4k MRR at month 12.

### Idea 3 — Jira ⇄ Google Sheets live reports, listed on both marketplaces

| | |
|---|---|
| Who has the problem | Delivery managers, PMO and analysts who rebuild status, throughput and time reports in Sheets every week |
| Who pays / decides | Either the Jira admin via Atlassian billing (per site) or the individual analyst via Paddle (per seat). The second has less friction [I] |
| Recurring job | Refresh a sheet from a JQL query on a schedule, including changelog-derived fields, and share it with people outside Jira |
| Trigger | The official add-on times out, lacks scheduled refresh or history fields [A — complaints not read today]; search "jira" in the Google marketplace or "google sheets" in Atlassian's |
| Alternatives | Jira Cloud for Sheets (official): 3M+ users, 3.4★ from 214 ratings, not updated since Dec 2024, free. Project Aid for Jira: 322K+ users, free, one developer. Mobility Stream: 34K+ users on Google, 702 installs on Atlassian at $1.35/user ($68/month at 50 users, $220 at 200). Apps+ Google Sheets+ for Jira 195 installs, 3.33★. Generic connectors: Coefficient 660K+ users, Unito 78K+ |
| Cost of status quo | Manual export/import per report per week; BI connectors at $166–1,435/month are the upmarket alternative |
| Evidence of willingness to pay | Mobility Stream is a Silver partner across 7 apps; BI connectors with thousands of installs at premium prices |
| Wedge | Scheduled refresh plus history/time-in-status columns and ready report templates; priced far under BI connectors; later Looker Studio (existing connectors: 57 installs at 1.25★ and 53 installs unrated) |
| Onboarding / time to first value | Install add-on → Atlassian OAuth → pick filter → data in the sheet. Under 5 minutes |
| First customers | Google marketplace search for "jira" (the official app's rating and staleness leave room) and Atlassian search; analysts share sheets, which exposes the add-on to colleagues |
| Retention | Scheduled reports that stakeholders read weekly |
| Solo-operable | Yes, on Vercel + Neon + a Railway worker for schedules. Not eligible for "Runs on Atlassian" |
| Price / ARPU / customers for $10k | $9 per seat → ~1,100 seats; or ~$100 per site → ~100 sites |
| Build → first payout | Google side with Paddle: 6–10 weeks. Atlassian side: 4–5 months |
| 1 day vs later | Day 1: Sheets add-on with JQL import and manual refresh. Later: schedules, changelog fields, write-back, Looker Studio, BigQuery |
| Platform risk | Atlassian's 2026 points-based rate limits hit bulk readers first; Atlassian refreshes its free add-on; Atlassian Analytics; Google's own "Atlassian Rovo Connector" for Gemini (1K+ users) |
| Most dangerous assumption | That users of a free official add-on pay for a better one. Mobility Stream needed years to reach 702 installs |

Verdict: base case $2–5k MRR. Highest ARPU ceiling of the Google-side ideas; exposed to rate limits.

### Idea 4 — Async "bucket" estimation board for Jira, successor to Magic Estimations (Atlassian)

| | |
|---|---|
| Who / pays / decides | Scrum teams sizing backlogs; Jira admin installs at the team's request |
| Job and trigger | Size many issues at once by dragging them into buckets, asynchronously, before planning. Trigger: the LEGACY warning on the app they already pay for |
| Alternatives | Magic Estimations: 1,486 installs, 4.56★, $1.00/user, Connect, **no release since 2025-03-23, no Forge listing, vendor is Silver (≥ $150K/year)**; free Lite edition 583 installs. Forge competitors: Appfire Planning Poker 3,483 and Agile Poker 1,756; Agile Pulse free poker 3,158, SprintPoker 618 at $0.84/user (launched Feb 2026) plus a free edition at 600 |
| Cost of status quo | A paid workflow tool that may stop working; estimates live in Jira fields so no data is lost, only the ritual |
| Evidence of willingness to pay | The incumbent's tier: at least $12.5k MRR from this one app |
| Wedge | Same interaction model, import of saved sessions if accessible [U], lower price, Forge-native badge |
| Time to first value | Open board → drag issues. Minutes |
| First customers | Search "magic estimation", "async estimation", "relative sizing"; "planning poker" is unwinnable (13 clones since August, 54 new estimation apps in 12 months) |
| Retention | Used every sprint |
| Solo-operable | Yes; Forge-hosted, no external services, eligible for the "Runs on Atlassian" badge |
| Price / customers for $10k | $0.70–0.80/user → roughly 1,500–2,000 installs |
| Build → first payout | 4–5 months |
| 1 day vs later | Day 1: bucket board writing story points. Later: async voting, poker mode, history |
| Platform risk | Magic Apps publishes a Forge version before February; established vendors capture the refugees |
| Most dangerous assumption | That a single quiet vendor will not migrate an app earning six figures |

Verdict: the only orphaned app with proven six-figure revenue, in the most cloned category in the catalogue. Capturing 5–10% of the incumbent gives $0.6–1.3k MRR; base case $0.5–2k.

### Idea 5 — Spreadsheet macro for Confluence, successor to Excellentable (Atlassian)

| | |
|---|---|
| Who / pays / decides | Teams keeping budgets, trackers and inventories inside wiki pages; Confluence admin |
| Job and trigger | Edit a real spreadsheet (formulas, filters, import/export) in a page. Trigger: LEGACY warning on Excellentable, or data-loss incidents with the alternative |
| Alternatives | Elements Spreadsheet 1,960 installs, $0.80/user, 3.27★ on cloud (reviews: "Spreadsheets disappeared all of the sudden", "non of the Elements table show up"); Ricksoft Excel-like Tables 1,543, $0.66, 4.22★; Excellentable 1,243, $0.70, 3.44★, Connect; Appfire Excel for Confluence 959; Table Filter, Charts & Spreadsheets 14,400 (category leader) |
| Evidence of willingness to pay | ~5,700 installs on four paid spreadsheet apps (three priced $0.66–0.80/user; the fourth not checked) |
| Wedge | Wrap a mature open-source spreadsheet engine; store data in page-attached storage with version history; importer for .xlsx and for Excellentable exports |
| Time to first value | Insert macro → paste data. Under a minute |
| First customers | "spreadsheet confluence", "excel confluence": four live incumbents and 15 new entrants in 12 months (max 101 installs) |
| Retention | Spreadsheets become page content; high switching cost |
| Solo-operable | Yes, if the engine is embedded and data stays in Forge storage; data-loss bugs are the support risk |
| Price / customers for $10k | $0.60/user → 2,000+ installs |
| Build → first payout | 4–5 months |
| 1 day vs later | Day 1: editable sheet macro with formulas and xlsx import. Later: real-time co-editing, charts, pivot |
| Platform risk | Confluence databases and native table improvements; Confluence PDF export changes already breaking Forge macros (thread 102857, Sep 2026) |
| Most dangerous assumption | That reliability alone moves customers away from three healthy competitors |

Verdict: real paid category with visibly unhappy users, no forcing deadline except for Excellentable's 1,243. Base case under $2k MRR.

### Idea 6 — monday.com "missing integration" app (conditional; gap not verified)

| | |
|---|---|
| Why it is on the list | Lowest app density (about 294 customers per app versus about 41 on Atlassian cloud; the two install metrics are not like-for-like), 0% take to $200K, native billing, Payoneer payouts, documented $30K MRR solo outcome, and a review gate that keeps the swarm out |
| What is missing | A verified gap. Listing pages are client-rendered and disallowed in robots.txt; the community runs on a platform I could not read. Every number an idea needs here is [U] |
| Hard blocker | "AI-generated 'vibe code'" apps are not eligible. A 1-day agent build has to be engineered and documented to a standard that survives a product, engineering and security review, or it is rejected |
| What to do before committing | Two to three days inside a monday account: the marketplace's own search and categories, the feature-request board sorted by votes, and the Facebook groups monday itself recommends. Look for an external system that many accounts connect through Zapier/Make and that has no deep app |
| Time to first payout | About 3–4 months after approval |
| Most dangerous assumption | That the app passes review at all |

Verdict: cannot be ranked higher without data. If the discovery pass finds a gap and the build is not "vibe code", this is plausibly the best risk-adjusted marketplace in scope.

### Ideas considered and dropped

- **Google Chat notifications for Jira** — ten clones in ten weeks, zero traction (3.1d).
- **Permission audit / access review / inactive-user cleanup** — 99 new apps in the user/licence cluster in 12 months, maximum 23 installs.
- **Rovo agents** — 337 new AI apps; customers and Atlassian build their own.
- **Bitbucket Cloud apps** — whole catalogue has 3,146 installs and no Atlassian billing.
- **E-invoicing add-on for Sheets** — leader has 2K+ users.
- **Standalone BI connector** — attractive prices, but a 15-month-old entrant has 62 installs and rate limits target exactly this workload. Kept as the upsell path of Idea 3.

---

## 5. Is $10k MRR in 12 months plausible through this channel?

**Atlassian.** $10k MRR equals roughly 1,200–2,500 installs of a paid app (section 3.1c). In the last 12 months 1,075 new vendors entered; none of the independents is above 713 installs in total, and the median is 1. Vendors that did reach four-digit installs on new apps already had an install base to cross-sell. Payout latency is 4–5 months, leaving 7–8 months of compounding. A newcomer needs to outperform the best of a thousand peers by about 2×. I put the probability at 3–5% for Ideas 2, 4 or 5 individually and perhaps 5–8% for a rescue portfolio executed with outreach. A $1–4k MRR result is realistic for a strong execution.

**monday.com.** The one channel with a published solo outcome above the target, but from before 2026 and by a portfolio vendor, and with a policy that excludes the stated build method. Unquantifiable today.

**Google Workspace Marketplace.** Volume is available and listing is fast, but ARPU is $6–9 and conversion from free installs is low. $10k needs 1,100–1,700 payers inside a year. I found no dated launch cohorts to compute a base rate [U]. Subjective 5–8% for Idea 1.

**Slack, HubSpot, Microsoft.** No evidence either way. Lead times alone (Slack 3+ months after the first 10 workspaces) consume a third of the year.

**Overall.** The channel still removes billing, tax and (on Atlassian) hosting, and for a Ukrainian FOP Atlassian is one of the few verified ways to be paid by enterprise customers without Stripe. What it no longer provides in late 2026 is distribution for an unknown vendor. Treat a marketplace as the checkout and trust layer of a business whose customers arrive through a forcing event plus direct outreach, not as the source of customers.

---

## 6. Kill-risks

1. **AI-built app flood on Atlassian** — 543 new listings in October 2026; visible gaps cloned in weeks; median newcomer gets 1 install.
2. **monday.com's exclusion of AI "vibe code" and of look-alike apps** — direct conflict with the build constraint.
3. **Incumbents migrate at the last minute** — Ideas 2 and 4 depend on Bilith and Magic Apps not shipping Forge versions before or shortly after 31 January 2027.
4. **Legacy apps keep working** — Atlassian itself says end of support is not a switch-off date; the trigger may be a slow leak, not a cliff.
5. **Native bundling** — Confluence tabs and numbered headings, Jira capacity planning, Rovo; monday vibe; Google's own 38 Gemini connectors; possible Notion-native email filing.
6. **Trust escalation** — Enterprise Certified badge and filter (annual pen test, VPAT, trust center) tilt enterprise search toward funded vendors; solo vendors carry 24-hour incident and 10-day critical-fix duties.
7. **Rate limits** — Atlassian's 2026 points-based limits threaten any bulk-reading app (Idea 3).
8. **Payout latency** — 4–5 months to first Atlassian wire; up to 60 days after invoice approval on monday.
9. **Billing dead-ends for Ukraine** — Zendesk (Stripe), Zoom (US only), Figma (closed, Ukraine not listed).
10. **Install metrics overstate demand** — Atlassian "Legacy Free" installs and count glitches; Google cumulative "users" (1M+ users, 77 ratings).

---

## 7. What I could not verify

- Any vendor revenue disclosure outside official marketplace pages (no web search).
- monday.com: app-level installs, prices, ratings, specific gaps, Payoneer payouts to Ukraine, trial lengths, security-review contents, typical approval duration.
- Slack, HubSpot, AppSource/Teams: any listing-level demand data; any solo-vendor outcome.
- Atlassian: search-ranking factors; exact cloud trial length (doc page failed to load); share of paying licences among installs (a vendor asked this in thread 103089 on 2026-10-03 and got no answer); whether Bilith or Magic Apps plan Forge versions; whether near-identical install counts within a vendor reflect bundling.
- Google: cost of the annual security assessment for restricted scopes; launch dates of add-ons (so no growth base rates); how many of the Gmail → Notion incumbent's users pay; what Notion's own mail product does with databases.
- Paddle: fees, seller verification time, payout schedule for Ukraine.
- Zendesk revenue share; GitHub payout countries; Salesforce AppExchange fees and timelines; Freshworks, Intercom, Airtable, Asana, ClickUp, Linear, Notion partner terms.
- Microsoft: Teams user base, Copilot agent store economics, tenant-admin approval friction.

---

## 8. Sources (all fetched 2026-11-13)

| # | URL | Supports |
|---|---|---|
| 1 | https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/ | Revenue share rates and dates; 100% up to $1M Forge; $500 threshold; payment timing; payment models |
| 2 | https://www.atlassian.com/blog/developer/runs-on-atlassian-apps-can-now-take-home-100-of-marketplace-revenue (5 Oct 2025) | Lifetime Forge revenue mechanics |
| 3 | https://www.atlassian.com/licensing/marketplace/publisheragreement | §4.4 payment by electronic transfer in USD to a bank account in your name; §3.1 paid-via-vendor limits |
| 4 | https://community.developer.atlassian.com/t/marketplace-payouts-for-a-partner-based-in-ukraine-sole-proprietor/103157 (7 Oct 2026) | Staff confirmation: Ukraine FOP, SWIFT USD, banks, Stripe Identity, W-8BEN |
| 5 | https://community.developer.atlassian.com/t/payouts-to-ukraine-bank-account-for-individual-developer-sole-proprietor-supported/102880 (24 Sep 2026) | Ukrainian FOP partner receiving payouts to monobank |
| 6 | https://community.developer.atlassian.com/t/can-a-company-registered-in-armenia-become-a-marketplace-partner-and-receive-payouts/103633 (5 Nov 2026) | Payout around the 21st; custom-domain email; individuals eligible |
| 7 | https://developer.atlassian.com/platform/marketplace/app-approval-guidelines/ | 10–15 business days; approval criteria; company email rule |
| 8 | Threads 98986, 99096 (Feb 2026), 101303 (Jun 2026) on community.developer.atlassian.com | Review delays, hidden tickets, verification-related auto-rejection |
| 9 | https://community.developer.atlassian.com/t/question-about-development-method-and-marketplace-policies/102047 (6–9 Aug 2026) | No AI-code policy; code not reviewed; solo vendors exist; security obligations |
| 10 | https://community.developer.atlassian.com/t/free-forge-app-with-a-paid-plan-sold-on-our-own-site-via-a-merchant-of-record-permitted-or-must-it-be-paid-via-atlassian/103068 (2 Oct 2026) | Forge = Free or Paid-via-Atlassian only; price guidance advisory; 0% reconfirmed |
| 11 | https://developer.atlassian.com/platform/marketplace/security-requirements/ | Mandatory security requirements |
| 12 | https://community.developer.atlassian.com/t/raising-the-bar-on-marketplace-cloud-app-security-together/98750 (29 Jan 2026) | Pen-test programme $1,000/day, 2–5 days; fix SLAs enforceable 1 Sep 2026 |
| 13 | https://community.developer.atlassian.com/t/introducing-atlassian-enterprise-certified-aec/103035 (1 Oct 2026) and RFC-133 thread 100401 | Enterprise Certified badge, filter, requirements; Cloud Fortified sunset |
| 14 | https://developer.atlassian.com/platform/forge/forge-platform-pricing/ (updated 12 Aug 2026) | Forge allowances and overage; Rovo billed to customer |
| 15 | https://developer.atlassian.com/platform/forge/runs-on-atlassian/ | Badge eligibility |
| 16 | https://developer.atlassian.com/platform/marketplace/marketplace-partner-program/ | Tier thresholds $150K / $750K / $3M |
| 17 | https://www.atlassian.com/blog/development/getting-ready-for-connect-end-of-support (3 Aug 2026) and thread 102002 | End of support 31 Jan 2027; milestones; 95% of paid seats migrated; post-EOS behaviour |
| 18 | https://community.developer.atlassian.com/t/atlassian-your-connect-eos-warnings-are-jeopardizing-enterprise-sales-for-real-now/103279 (14–21 Oct 2026) | LEGACY lozenge, warning dates, buyer reaction |
| 19 | https://www.atlassian.com/blog/development/from-data-center-to-cloud-the-next-chapter-for-marketplace-apps (8 Sep 2025) | DC end-of-life dates; 300,000+ customers |
| 20 | https://community.developer.atlassian.com/t/2026-point-based-rate-limits/97828 | Rate-limit regime and vendor concerns |
| 21 | Threads 101172 (no paid ads), 99104 (review integrity), 99359 (install-count glitch), 100889 (Legacy Free), 103388 (no metered billing), 103089 (paid-share question unanswered) | As labelled |
| 22 | https://marketplace.atlassian.com/rest/2/addons?hosting=cloud… , /rest/2/addons/{key}/versions , /pricing/cloud/live , /reviews ; vendor pages /vendors/{id}/… | All Atlassian install, rating, price, launch-date, framework and tier data in sections 3.1 and 4 |
| 23 | https://developer.monday.com/apps/docs/subscriptions-payments-and-billing | $200K threshold, 85/15, Payoneer, invoice flow, refunds |
| 24 | https://developer.monday.com/apps/docs/monetization | Native monetization mandatory for new apps |
| 25 | https://developer.monday.com/apps/docs/submit-your-app | Review phases; "vibe code" ineligibility; duplicates may be declined; 72 business hours |
| 26 | https://monday.com/appdeveloper/monetization | Customers, apps, installs, tiers, ranking factors |
| 27 | https://monday.com/appdeveloper/blog/build-30k-saas-monday-marketplace/ (18 Feb 2025); /developer-success-nir-ofir (2 May 2024); /ai-marketplace-ai-era/ (10 Sep 2025); /find-validate-monday-app-idea/ | Vendor outcomes; growth tactics; monday vibe/magic/sidekick |
| 28 | https://monday.com/robots.txt | Listing and category pages disallowed |
| 29 | https://learn.microsoft.com/en-us/partner-center/marketplace-offers/marketplace-commercial-transaction-capabilities-and-considerations | 3% fee |
| 30 | https://learn.microsoft.com/en-us/partner-center/payment-thresholds-methods-timeframes (updated 2025-10-23) | Ukraine payout row; $50 threshold; transfer times |
| 31 | https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/deploy-and-publish/appsource/publish and …/prepare/include-saas-offer | Validation timing; SaaS offer requirements |
| 32 | https://developers.google.com/workspace/marketplace/overview and /about-app-review | No listing fee; review duration |
| 33 | https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification and /restricted-scope-verification | 10 days; annual security assessment |
| 34 | https://workspace.google.com/marketplace/search/… , /category/connectors , /app/… (listing pages named in 3.2 and 4) | All Google marketplace user counts, ratings, dates, review quotes |
| 35 | https://docs.slack.dev/slack-marketplace/slack-marketplace-app-guidelines-and-requirements ; /slack-marketplace-review-guide ; /changelog/2025/05/29/tos-updates | Slack rules, lead times, ToS |
| 36 | https://developers.hubspot.com/docs/apps/developer-platform/list-apps/listing-your-app/app-marketplace-listing-requirements ; https://legal.hubspot.com/app-program-agreement ; https://www.hubspot.com/partners/app | 3 installs; review timing; no fees; marketplace stats |
| 37 | https://developer.zendesk.com/documentation/marketplace/publishing-to-the-marketplace/set-up-paid-app-or-theme/ and /submit-your-app/ | Stripe requirement; 1–3 weeks |
| 38 | https://developers.zoom.us/docs/distribute/monetization/ | US-only monetization |
| 39 | https://help.figma.com/hc/en-us/articles/12067637274519-About-selling-Community-resources | 15%; payout countries; creator approvals paused |
| 40 | https://developers.miro.com/docs/monetization and /publish-your-app | No native monetization; 8–12 weeks |
| 41 | https://pipedrive.readme.io/docs/marketplace-app-approval-process | 21 business days; pricing-page requirement |
| 42 | https://docs.github.com/en/apps/github-marketplace/… (requirements-for-listing-an-app; receiving-payment-for-app-purchases) | 100 installs, verified publisher, 5%, $500 |
| 43 | https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle | Unsupported-country list |

---

## Appendix — supporting tables

**A. Fastest-growing listings launched since June 2025 that belong to independent vendors [F]**

| Installs | First version | Paid? | App | Vendor (apps, total installs) |
|---|---|---|---|---|
| 1,184–1,203 ×5 | Oct 2025–Mar 2026 | paid | CFD, Throughput, Monte Carlo, Created-vs-Resolved, WIP Aging gadgets | Broken Build (10; 14,447) |
| 962 / 618 / 600 / 537 / 493 / 476 | Sep 2025–Jun 2026 | mixed | SprintRetro, SprintPoker, Laya apps | Agile Pulse (8; 7,153) |
| 1,109 / 435 | Jul 2026 / Dec 2025 | free | Mermaid, OpenAPI for Confluence | Narva Software (12; 14,651) |
| 421 | Jun 2025 | free | Simple Tables for Confluence | Simpleasyty (2; 457) |
| 311 | Sep 2025 | paid | Mria CRM (26 reviews) | Mria Labs (4; 388) |
| 228–234 ×3, 159–160 ×2 | Nov 2025–Jun 2026 | paid | Time Tracking Fields, Formify, Fieldify, Worklog Reminder, Restorify | Terano Apps (8; 1,284) |
| 207 / 199 / 156 | Jul 2025–May 2026 | paid | Checklists, Timesheets, Issue Templates | Achlys Solutions (7; 807) |
| 133–177 ×4 | Apr–Jul 2026 | paid | XPress, Pulse, SyncUp, Spotlight | Bytera (4; 608) |
| 174 | May 2026 | free | Simple Gantt | Blue Leap Apps (1; 174) |
| 131 | Dec 2025 | paid | Checklist for Jira | RMK Labs (1; 131) |

**B. Silver partners with the fewest paid-app installs [F/I]**

| Vendor | Apps | Paid-app installs | Implied minimum $ per install per month |
|---|---|---|---|
| Almarise | 5 | 1,067 | 11.7 |
| Polymetis Apps | 9 | 1,139 | 11.0 |
| RVS Softek | 15 | 1,201 | 10.4 |
| view26 GmbH | 7 | 1,407 | 8.9 |
| Catapult Labs | 10 | 1,425 | 8.8 |
| Shinetech Software | 4 | 1,437 | 8.7 |
| Magic Apps | 2 | 1,486 | 8.4 |
| Mobility Stream | 7 | 2,028 | 6.2 |

**C. Reproducibility.** Catalogue: `GET /rest/2/addons?hosting=cloud&filter=new&withVersion=true&limit=50&offset=N`. First cloud version: `GET /rest/2/addons/{key}/versions?hosting=cloud&limit=1&offset={count-1}`. Note: adding `application=jira` to a list query returns a stale version object for some apps; framework and release dates in this report come from the unfiltered dump or the per-app endpoint.
