# P1 — UK tender tools: competitor map and voice of the customer

Date: 2026-11-13. Role: research analyst, asked to be skeptical. Scope: UK tools and services that help small and medium suppliers find and win public contracts, and what those suppliers say about tendering. This report tests the "public-contract copilot" concept (free radar page → radar pro about £49 → bid desk about £149, sold by cold email to contract winners).

Labels: **FACT** = read today on the cited page (URL given). **FACT (search extract)** = text returned by a search result for a page I could not open. **INFERENCE** = my reasoning. **ASSUMPTION** = unverified input. **UNKNOWN** = looked for, not found. "R1" = the round-1 report `G-open-data-alerts.md`; "R3" = `R3-red-team.md`.

---

## 0. Bottom line

1. **The concept is not new on any single feature, and its two paid price points are already taken.** Two UK products sell at exactly £49 and £149 a month with free tender search, an AI bid writer, bid/no-bid and evaluator scoring: BidScout, and BidWriter by WinAContract (which is a UK product too, not only a US one). A third, SupplierVerse, sells the same job to "busy business owners" at £199. Tenderforge is listed on Capterra from £15.99 a month with an "evaluator review + compliance matrix". (FACT, section 2.)
2. **The free radar page already exists in two forms.** BidScout runs a public directory of 48,141 suppliers with award counts, top buyers, "live tenders [supplier] could bid on" and a free emailed "intel report". BidSonar gives small firms free matching, alerts and a directory of about 76,000 supplier pages. Free alerts also come from Find a Tender, Stotles, Supply2Gov (local area), Open Opps, WinAContract and mytender. (FACT.) **INFERENCE:** £49 a month for alerts and expiry dates is the weakest part of the plan.
3. **Three things I did not find anywhere.**
   - Outbound that sends a supplier its own pre-built page, triggered by its own award. I found no evidence that anyone does this, and none that nobody does (UNKNOWN after three searches across R3 and this report).
   - A plain view, framed for a small firm, of "which buyers place small contracts in my trade without a tender". Buyer analysis exists as a feature (Tenderbase from £25, BidScout, Stotles buyer profiles from £475, Tussell by demo), but no page I read presents this view.
   - A pass/fail checklist whose every line cites the clause in the buyer's own documents. Vendors advertise extraction and "compliance checks"; only evidence-side citation is advertised (Bidwin, AutogenAI).
4. **The customer pain is real and well documented.** In the FSB's December 2025 report a bid takes five days on average, 31% of bidders won nothing in three years, and only 5% got useful feedback. But the same evidence shows low bidding frequency, which fits a per-bid price better than a subscription.
5. **Recommended shape.** Keep the free page. Sell the bid desk first, by the bid (£99 to £149 per tender pack) with a £149 monthly plan for regular bidders. Demote radar pro to a low-priced add-on or fold it into the paid plan. Start with suppliers to local government in construction and maintenance, cleaning and facilities, and care. Lead with a cited "can we bid, and what will disqualify us" check, not with drafting.
6. **Odds.** Nothing here raises R3's estimate (about 4% for $10k MRR at month 12). The discovery of two same-priced competitors and two free radar products argues for lowering it unless the seven-day outreach test in R3 section 6.1 shows unusual response.

---

## 1. Method and limits

- **WebSearch calls used: 32 of 35.** One was refused (a Reddit domain filter) and is counted.
- About 200 pages were read directly with `curl` or headless Chromium: vendor home, pricing and feature pages, sitemaps, Capterra listings, G-Cloud listings and one G-Cloud pricing document, Companies House, GOV.UK policy notes, trade-body coverage, and seven UK Business Forums threads.
- **Blocked today:** Reddit (fetch and search), Trustpilot, G2, LinkedIn, bidstats.uk, tenderforge.co.uk (HTTP 522 on three attempts), bidsoftware.co.uk, hudsonsucceed.co.uk, opportuni.co.uk. Reviews from Trustpilot and G2 appear only as search extracts.
- **Not done:** no interviews, no sign-ups, no product trials. Feature claims are what vendors say on their pages; I did not test any of them. The Find a Tender API was not called.
- The FSB report itself could not be opened; its figures come from two trade-press articles quoting the FSB release.
- The BCC/Tussell tracker PDF carries a notice against AI ingestion. I cite only headline figures that Tussell's own public blog and chamber press coverage also give.
- Customer voice is thin where it matters most. I found no first-hand SME account from 2025–2026 of using an AI bid tool, and no independent review of any tool under £200 a month.

---

## 2. Competitor map

### 2.1 Corrections and additions to what the team already had

| Item | What I found today | Label |
|---|---|---|
| WinAContract "(US)" | Also a UK product at winacontract.co.uk: free tender search and alerts, plus BidWriter at £49 / £149 / £279 a month. Vendor is eSourcing Data Ltd (company 16391108, incorporated 16 April 2025, no accounts filed yet) | FACT, https://www.winacontract.co.uk/plans ; Companies House |
| "BidWriter (domain parked?)" | bidwriter.co.uk is parked at GoDaddy. The product is WinAContract's BidWriter (above) | FACT, https://bidwriter.co.uk/ ; https://www.capterra.co.uk/software/1103395/BidWriter |
| BIDSOFTWARE (£2,750/yr) | It is Thornton & Lowe's product: Tender Pipeline (free; Premium £300 + VAT a year) and Tender Library (1 user £2,750 + VAT; 2–3 users £4,900; 4–5 users £6,500) | FACT, G-Cloud 15 pricing document (URL in sources) |
| BidScout | Customer claim differs by page: "250+ UK bid teams", "1000+ Businesses", "600+ UK suppliers and bidding teams". Runs a public supplier directory (48,141 suppliers). No legal entity is named in its privacy policy or terms | FACT, https://www.bidscout.co.uk/ ; /features/tender-leads ; /suppliers ; /privacy-policy |
| Tenderforge | Capterra: vendor "Rampflow"; Solo £15.99 (15 active bids, 150 AI drafts a month, "Evaluator Review + Compliance Matrix", 1 user), SME £39.99 (up to 10 users), Agency £99.99 (unlimited, 50 users); free version; 0 reviews; listing updated 21 October 2026. Own site unreachable three times today | FACT (Capterra), https://www.capterra.com/p/10050139/Tenderforge/ |
| Bidwin AI | £299 one-off per user (list £499), free first month, runs as a plugin inside the customer's own Claude Pro account; includes "Bidwin Watch" tender finder | FACT, https://bidwin-ai.com/ |
| SupplierVerse | £199 a month on a 12-month commitment (20% off annually), 14-day trial, 1 seat, extra seats £99. Trading brand of Go Diverse Limited (14872986, incorporated 16 May 2023, micro-company accounts). "Innovate UK" not seen on the page today | FACT, https://www.supplierverse.ai/ ; Companies House |
| TenderSight AI | Aimed at European tenders (27–28 countries), free search and alerts, no public price | FACT, https://tendersight.ai/ |
| Hudson | Now "Together: The Hudson Collective". Six sector portals; "Premium Membership £500 + VAT per month", three-month minimum. The £60–95 portal prices were not on the page today | FACT, https://www.tenderconsultants.co.uk/discover-tendering-opportunities/ |
| Supply2Gov | Has a "Local Area — Free Forever" tier; then £25, £80, £95 a month | FACT, https://www.supply2govtenders.co.uk/pricing/ |
| Stotles "3.5k+ teams" | Not in the home or pricing page text I captured today | UNKNOWN |
| mytender.io | Files micro-company accounts (year to 30 September 2025). SETsquared's page on the £250,000 pre-seed raise is dated 3 July 2025 | FACT, Companies House 15132671 ; https://www.setsquared.co.uk/mytender-io-announce-250000-pre-seed-raise/ |
| New names | BidSonar (free), SwiftBid (per bid), BidScript ($1m pre-seed), EasyPQQ Pro (£750/month), BidReview.ai (Ireland, evaluator scoring), Open Opps (free / £120 / £259), B2B Quote Tenders (£7 a week), bidwriters.co.uk, Enterprise Nation "Supply Connect" hub | FACT, section 2.2–2.4 |

### 2.2 Tier (b): AI bid writing and bid management — the direct competition

Prices are as shown on the vendor's own page today unless stated. "CH" = Companies House.

| Product | Company (CH) | Price and unit | Free tier / trial | What it says it does | Traction signals |
|---|---|---|---|---|---|
| **BidScout** — https://www.bidscout.co.uk/ | Not named on site. A BIDSCOUT LTD exists (13530098, incorporated 26 July 2021, one officer, SIC management consultancy); link unconfirmed | £49 (500 credits), £149 (2,500), £499 (10,000) a month; credit top-ups | 14-day trial, no card; "free weekly tender alerts"; free emailed competitor report | Tender search across "50+ sources"; AI bid writer from a document library; bid/no-bid score; win probability; extraction of criteria, weights and pass/fail thresholds with a predicted score per criterion; clarifications manager; consortium hub; past-bid insights; renewal tracker; "encrypted supplier-portal vault"; decision-maker contacts by credit; DOCX and PDF export; Slack, Teams, Salesforce, HubSpot, SharePoint, Drive | Three different customer counts on its own pages; testimonials from generically named firms; demo screens use "Northwind"; 0 reviews on Capterra and Software Advice (search extract). **INFERENCE:** small operation, traction unproven |
| **BidWriter by WinAContract** — https://www.winacontract.co.uk/ | eSourcing Data Ltd (16391108, incorporated 16 April 2025, two officers) | Free; Starter £49 ("AI credits for about one full bid a month"); Professional £149 ("1–2 full bids a month"); Business £279 (3 seats); annual plans about 20% lower (£39 / £119 / £223) | Free forever search and alerts; "3 months for the price of 1" on new monthly plans | AI tender parser and compliance; drafts "word-limit aware, marks-aware"; "AI evaluator + social-value scoring"; bid/no-bid advisor; "AI debrief, FOI & challenge tools"; frameworks and DPS tracker; bid library (25 entries on Starter, 200 on Professional); Word export; retained done-for-you service | US sister product claims "136+ contractors"; Capterra UK: 0 reviews; company seven months old at first listing |
| **SupplierVerse** — https://www.supplierverse.ai/ | Go Diverse Limited (14872986, 2023, micro accounts) | £199 a month, 12-month commitment; extra seat £99 | 14-day trial | Daily matched shortlist with fit score and risk flags; "Ask the tender"; bid/no-bid; task plan; AI bid writing from own documents; outcome log | "Early access pricing for founding customers"; 1,865 public tender pages and 362 group pages in sitemap |
| **Tenderforge** — site down | "Rampflow" (Capterra) | £15.99 (1 user) / £39.99 (up to 10 users) / £99.99 (50 users) a month, flat | Free version and trial (Capterra) | Hourly feeds from Contracts Finder and Find a Tender; parsing of questions and criteria; drafting from a verified knowledge base with unverifiable claims flagged; evaluator review and compliance matrix from the £15.99 plan | 0 reviews; site unreachable today |
| **mytender.io** — https://mytender.io/ | MYTENDER.IO LTD (15132671, incorporated 12 September 2023, 5 officers, micro accounts) | Not published; demo-led | "Try Free Tender Discovery" | Tender analysis and requirement extraction; bid library with SharePoint, Drive, Salesforce, HubSpot; drafting; "Evaluation & Compliance" scoring; team assignment; self-hosted option; ISO 27001 | "240+ bid writers", "3000+ successful bids"; named customers are mid-sized FM, construction, waste and consultancy firms; G2 4.6 from 11 reviews (search extract); £250k pre-seed |
| **Stotles Bid Studio** — https://www.stotles.com/bid-studio | Stotle Ltd (10912358, 2017) | Demo-led (R1: from about £495). Sales plans: Free / Basic from £99 / Growth from £475 / Expert custom | Free plan (tender tracking, pre-tenders) | Bid/no-bid report "in 10 minutes"; first draft "in 2 hours"; bid library; collaboration; MCP connector on paid plans | 12 Capterra reviews; 2,127 public supplier pages and 2,175 buyer pages |
| **EasyPQQ Pro** — https://www.easypqq.co.uk/ | UNKNOWN (no Companies House match on the name) | £750 a month for 1–5 users; £1,200 for 6–10; £1,600 for 11–15 | Demo only | Knowledge stores; tender-pack analysis; first drafts; "AI Bid Marking … Unique to EasyPQQ Pro" (it is not unique: see BidScout, BidWriter, mytender, bidpiston, BidReview) | "Trusted by 500+ companies"; construction focus |
| **BidScript** — https://www.bidscript.co.uk/ | BIDSCRIPT LTD (15669402, incorporated 22 April 2024, micro accounts) | Quote by seat (core and contributor seats) | Demo | Opportunity search, drafting, library; for "in-house bid & proposal teams" | $800k round in July 2026, over $1m total (tech.eu); G2 4.8 on few reviews |
| **Thornton & Lowe BIDSOFTWARE** | Thornton & Lowe Limited (07600205, 2011) | Tender Pipeline free, Premium £300 + VAT a year; Tender Library from £2,750 + VAT a year | Free tier; free trial on G-Cloud | Tender tracking, competitor monitoring, content library, AI search and "AI assisted bid writing & content review" | Sold by a bid consultancy that claims an 81% win rate |
| **AutogenAI** — https://autogenai.com/ | AUTOGENAI LTD (13907128, 2022, group accounts) | Enterprise, on request | No | Drafting with sourced ideas, library, compliance | "Trusted by 200+ enterprise businesses"; about 160 G2 reviews (search extract) |
| **Bidwin-AI** — https://bidwin-ai.com/ | "Cosens Consult" (Mark Cosens, bid consultant) | £299 one-off per user; guided setup £50 per tender | First month free | A plugin in the buyer's own Claude Pro: tender vetting, section drafts "evidence-cited", gap flags, pre-submission check; files stay on the user's computer | Four named case studies, mostly training providers |
| **Build My Bid Manager (bidpiston)** — https://buildmybidmanager.uk.com/ | EBIDA LIMITED (14634305, 2023, one officer) | £600 + VAT one-off, "increases to £997" | Free portal sign-up | 175 prompts and a setup wizard for ChatGPT Plus or Claude Pro; ITT decode; compliance checklist; evaluator critique scored out of 50; "[EVIDENCE NEEDED]" rule; PPN 002 social value built in | "Built by ex-procurement directors"; no customer count |
| **SwiftBid** — https://swiftbid.pages.dev/ | Not named ("operated in England and Wales") | Per bid: £149 Basic, £349 Standard, £749 with human review | "Get started free" | Upload pack → compliance matrix → draft in Word or PDF within 12–24 hours | Hosted on a pages.dev address; no customer evidence |
| **BidReview.ai** — https://www.bidreview.ai/ | Irish founder (TechCentral, 30 July 2026) | Free first score; paid report (price not captured) | Free score "in about two minutes" | Scores a draft "the way the panel will give it", calibrated on marked submissions | Irish market first |

Other products seen but outside the small-firm price range: AutoRFP.ai ($899 a month for 24 projects a year; FACT, https://autorfp.ai/pricing), Altura (€8m Series A in June 2025 and a UK launch; FACT (search extract)), Loopio and Xait (named in Stotles' comparison).

### 2.3 Tier (a): tender discovery and alerts

| Product | Price (vendor page) | Free tier | Expiry / competitor / below-threshold intelligence | Notes |
|---|---|---|---|---|
| Find a Tender (official) | Free | Yes | Saved searches and email alerts; pipeline and market-engagement notices | R1 |
| **BidSonar** — https://bidsonar.com/ | Free ("no card, no demo") | Yes | Describes itself as "free public directory + personalised briefing" for "SMEs who deliver the work": semantic matching from a plain-English profile, "incumbency, field openness, partner suggestions". Directory: 25K buyers, 76K suppliers | "Built by Hypership" (a HYPERSHIP LTD was incorporated in Belfast on 6 January 2026). Monetisation UNKNOWN |
| Stotles | Free / from £99 / from £475 | Yes | Expiring contracts from £99; buyer and supplier profiles, contacts and "buying intent documents" from £475 | https://www.stotles.com/pricing |
| Supply2Gov (BiP) | Free local / £25 / £80 / £95 a month | Yes | Alerts only | BiP Solutions Ltd, incorporated 1984 |
| Tenderbase | £25 / £33 / £42 / £55 a month; 25% off yearly | 14-day trial | "Competitor tracking & alerts" and "buyer behavior analysis" on every plan; add-on: tender documents fetched at £10 per five requests; "request for bid service" £10 per five | TENDERBASE LTD, incorporated 10 March 2023, one officer |
| B2B Quote Tenders | "£7 per week" | Free registration | Alerts | https://www.b2bquotetenders.co.uk/ |
| Open Opps | Free; £120 per user a month (annual) or £150 monthly; team £259 | Yes | Search and alerts; monthly plans need three months' notice | https://openopps.com/pricing/ |
| Thornton & Lowe Tender Pipeline | Free; Premium £300 + VAT a year | Yes | Competitor monitoring | G-Cloud 15 |
| WinAContract | Free | Yes | Frameworks and DPS tracking in paid BidWriter | Section 2.2 |
| Tenderlake | £249 (UK and Ireland) and £396 (Europe) a month, paid annually | 7-day trial | "Contracts coming to an end in the next 24 months", "Advanced Demand Signals", competitor tracking; a Claude connector | TENDERLAKE LTD, 2016, one officer |
| Contracts Advance | £1,399 / £2,099 / £2,999 a year | No | "Active contracts" from the middle plan; competitor and buyer analysis on the top plan | Also sells bid reviews (section 2.4) |
| Tenders Direct (Proactis) | From £1,359 a year (R1) | No | Human-reviewed alerts | Proactis Tenders Ltd, 1988 |
| Tracker (BiP) | Demo only; three plans | Demo | Market leads, spend analysis, contacts | Trustpilot complaint about auto-renewal (search extract) |
| Tussell | Demo only | No | Frameworks, call-offs and direct awards, spend data, decision-maker contacts | "Over 300 companies" |
| Oxygen Insights | Not published | G-Cloud trial | Council meeting papers and early signals | Oxygen Finance |
| Hudson / Together portals | £500 + VAT a month premium membership | Sign-up | Alerts plus bid reviews by people | Section 2.1 |

### 2.4 Tier (c): human services

| Provider | What is published | Label |
|---|---|---|
| Contracts Advance | Bid review £750 for one day (up to 10,000 words); £1,495 for two days | FACT, https://contractsadvance.co.uk/pricing/ |
| Together: The Hudson Collective | £500 + VAT a month for portal access plus reviews of individual responses, three-month minimum. Bid writing page headline: "87% Success Rate" | FACT, vendor pages |
| Executive Compass | "Over 7,000 tenders", "success rate in excess of 85% (auditable)"; no prices | FACT, https://www.executivecompass.co.uk/ |
| Thornton & Lowe | "Our tender win rate is 81%!"; no prices | FACT, https://thorntonandlowe.com/ |
| Tenders-UK | "An 83% Win Rate Across 4,000+ Bids"; no prices | FACT, https://www.tenders-uk.com/ |
| Your Tender Team | "An agreed number of your tenders … for a fixed monthly fee" (retainer; fee not shown) | FACT, https://yourtenderteam.co.uk/ |
| bidwriters.co.uk | Fixed fee per bid, day rate, or monthly retainer; quote within a working day; no rate card. On no-win-no-fee: "We price on the work … Be wary of anyone guaranteeing a win." | FACT, https://bidwriters.pages.dev/pricing/ |
| Contractor day rate | Median £500 a day for contract bid writers in the six months to 13 November 2026, from only five advertised rates | FACT, https://www.itjobswatch.co.uk/contracts/uk/bid%20writer.do |
| Vendor estimates of consultant fees | Bidwin: "£3,000–£6,000+ per tender". SwiftBid: "£1,500–£5,000 per bid", day rates "£500–£900" | FACT that the vendors say so; both sell the cheaper alternative |
| Forum reports | 2021: a small contractor was quoted "4.5k" to prepare one council tender; another consultancy replied "We would probably charge around half that figure". 2010: PQQ writing for "three figures"; elsewhere "typically £20k in some instances" | FACT, UK Business Forums threads 413972 and 158136 |
| No-win-no-fee | No provider found offering it; one explicitly declines | UNKNOWN / FACT for the one refusal |

**INFERENCE:** a small firm's realistic alternative to software is £750 to about £2,500 for one bid from a consultant, sold on win-rate claims of 81–87% that nobody can check. That is the price anchor a per-bid software pass sits under, and the kind of claim a newcomer must not copy.

### 2.5 Feature coverage against the proposed product

"Yes" means the vendor's page claims it. Blank means I did not see it claimed, which is not proof of absence.

| Capability in the concept | BidScout | BidWriter | SupplierVerse | mytender | Stotles | Tenderforge | Prompt packs (Bidwin, bidpiston) |
|---|---|---|---|---|---|---|---|
| Public page per supplier | Yes: 48,141, details behind sign-in | | | | Yes: 2,127 | | |
| Supplier's own awards plus matched live tenders | Yes, gated ("Live tenders X could bid on") | | Matching after sign-up | | Partly | Matching after sign-up | |
| Expiring contracts | Yes, £149 plan | Frameworks and DPS | | | Yes, from £99 | | |
| Buyers that award without tender, by trade | "Buyer spend analysis" (not framed this way) | | | | Buyer profiles from £475 | | |
| Pack upload → requirement extraction | Yes | Yes | Yes | Yes | Yes | Yes | Yes (in ChatGPT or Claude) |
| Pass/fail items cited to the clause | "Pass/fail thresholds" extracted; citation not claimed | | | | | | Evidence cited to source file (Bidwin) |
| Compliance matrix with word limits and weights | Yes | "Word-limit aware, marks-aware" | | Yes | | Yes, £15.99 plan | Yes |
| Answer library from own evidence | Yes | Yes (25 / 200 entries) | Yes | Yes | Yes | Yes | Yes |
| Evaluator-style marking | Predicted score per criterion | "AI evaluator" on £149 plan | | Yes | | "Evaluator review" | Score out of 50 (bidpiston) |
| Social value help | | "Social-value scoring" | | | | | PPN 002 library (bidpiston) |
| Selection questionnaire (PSQ) autofill | | | | | | | |
| Collaboration | £499 plan | £279 plan | Extra seats £99 | Yes | Yes | | No |
| Export | DOCX, PDF | Word | | | Yes | Branded documents | Whatever the chatbot gives |
| Portal integration | "Encrypted supplier-portal vault" | | | | Aggregates portals | | Bidwin Watch uses a browser extension |

- **FACT:** no vendor page I read claims automatic filling of the standard selection questionnaire. EasyPQQ's name suggests it but its page now sells general bid writing.
- **INFERENCE:** every bid-desk feature in the concept is already claimed by at least two products at or below £149. The unclaimed items are clause-level citation of pass/fail requirements, PSQ autofill, and a "buyers who award without tender in your trade" view (Tenderbase lists "buyer behavior analysis" from £25, but not this framing).
- **Caution:** I did not test whether any claimed feature works. A feature that is claimed but poor is still an opening, but only a product trial would show it.

### 2.6 Who publishes public pages for search traffic, and who does outbound to winners

| Vendor | Public programmatic pages | Label |
|---|---|---|
| BidScout | Supplier directory "48,141 suppliers, 120,201 awards tracked"; 5,001 supplier URLs in the sitemap; sector tender pages; comparison pages ("Stotles alternative", "BidScout vs AutogenAI") | FACT, https://bidscout.co.uk/suppliers ; sitemap.xml |
| Stotles | 2,127 supplier pages, 2,175 buyer pages, notice sitemaps (50,000 URLs each per R1), topics, frameworks | FACT, sitemap-index.xml |
| BidSonar | Directory of about 102K organisations; comparison pages against Stotles, Tussell and bidstats | FACT, https://bidsonar.com/organisations |
| SupplierVerse | 1,865 tender pages, 362 "group" pages, 20 briefings | FACT, sitemaps |
| mytender.io | Tender listings by sector and region ("1,535 live contract opportunities"); 230 blog posts; French, German and Spanish versions | FACT, sitemap.xml ; https://mytender.io/tenders |
| WinAContract | Free search over "160,000+" opportunities; frameworks pages | FACT |
| Tenderlake | 35,787 URLs | FACT (R1) |
| bidwriters.co.uk, SwiftBid | City pages such as "bid writing in Leicester"; both on pages.dev addresses | FACT (search result listings) |

- **Outbound to contract winners: UNKNOWN.** No vendor page describes it and two searches found no supplier complaining about it. BidScout already has the parts: supplier pages, matched tenders per supplier, and an emailed report triggered by a form.
- **INFERENCE:** the page is not the wedge; sending it is. That advantage lasts only until BidScout or Stotles copies it, which needs no new data.

### 2.7 How big are these competitors?

- **FACT:** mytender.io, BidScript and Go Diverse (SupplierVerse) file micro-company accounts. Stotles, Tussell, Tenderbase and Tenderlake file small-company ("total exemption full") accounts. Only AutogenAI files group accounts.
- **INFERENCE:** the best-known UK AI bid-writing product for smaller teams (mytender, "240+ bid writers") still qualified as a micro company two years after incorporation, with funding and ISO 27001. A company qualifies if it meets two of three limits; for that year I recall them as turnover up to £632,000, balance sheet up to £316,000 and up to 10 employees (background knowledge, not re-checked today). Vendor customer claims across this market are in the hundreds (200+, 240+, 250+, 300+, 500+), not thousands.
- **FACT:** Capterra UK shows 0 reviews for mytender.io, AutogenAI, BidWriter, Bidwin and Tenderforge. Independent proof of quality is nearly absent across the category.

---

## 3. Voice of the customer

### 3.1 How small firms handle tenders today

- **Most do not bid.** FSB (December 2025): 30% of small firms bid for a local council contract in the last three years and 9% for a UK Government contract. Enterprise Nation and Newable (2025, 200 SMEs): "51% want to supply to government but capacity is limited". (FACT, sources below.)
- **Those who bid do it themselves, slowly.** FSB: "it takes on average five days to prepare a bid". Forum posts describe "a good few days", "three weeks work", and a team of four taking three months on a £3.3m bid.
- **They find work by manual search.** Athena Commercial's 2026 white paper (a consultancy; sample size not given): 74% of bid managers use no dedicated tender tracking software and 72% search only weekly.
- **Some outsource the writing**, usually per bid, and report that it helps: "found a third party company to write them for us and the success rate has increased significantly" (forum, 2010).
- **Many prefer to avoid the process**: subcontract to a prime, get onto an approved list or framework, or approach buyers directly. "Forget all that website stuff they are just lists. Get a strategy together to approach your target organisations directly" (forum, May 2025).
- **Data agrees with the last point.** Open Contracting Partnership, on the first year of Procurement Act data: direct procedures were about 41% of all procedures; "only 36% of direct awards and just 46% of below threshold without competition go to SMEs", against 61% of open tenders and 73% of below-threshold open competitions.

### 3.2 The most-cited pains, with evidence

| # | Pain | Evidence | Label |
|---|---|---|---|
| 1 | **Time per bid, with nothing back.** | Five days per bid on average; 31% of bidders won nothing in three years; only 5% got "comprehensive and actionable feedback" (FSB). "You spend days putting a bid together and when it disappears into a black hole, it's hard not to lose faith" (FSB policy chair) | FACT, FMJ and SME Magazine |
| 2 | **Finding relevant opportunities across many portals.** | 62% say finding suitable contracts is difficult, 27% very difficult, "with different portals, forms, and rules". 95% of bid managers want one view of DPS and framework opportunities (Athena). R1 measured more than fifteen e-tendering systems in one week of notices | FACT |
| 3 | **Eligibility thresholds and pass/fail rules.** | 43% cite "unreasonable eligibility requirements" (FSB). "Hidden thresholds such as turnover and irrelevant certifications" (Enterprise Nation). "You had to provide basically about three years accounts" (forum, 2022). A former assessor: "if it was not there they were rejected" | FACT |
| 4 | **Repeating the same information.** | 35% "repeatedly waste time submitting the same information for each new bid" (FSB). "Filling in infinite bits of info that are just not quickly at hand for a small company" (forum, 2022). A 2010 poster estimated "c80% of each PQQ is the same" | FACT |
| 5 | **Portals and one-way communication.** | "Some of the docs did not upload properly so we were excluded" (forum, 2012). "We … hate the current system of not being able to communicate with a real person" (forum). A buyer's reply to a contractor in 2021: "we are unable to engage with any bidder outside of the e-tendering portal" | FACT |
| 6 | **Social value.** | 76% of techUK's SME members said "addressing social value in contracts is an administrative burden" (techUK GovTech SME survey, as reported in a techUK guest article). Open Contracting: social value "is often not defined", "favouring smooth talking larger companies" | FACT |
| 7 | **Vague notices.** | "There is next to no detail on any of these listings so how do you even know what they entail?" (forum, 2022). R1 measured a median of about 850 characters of description per notice | FACT |
| 8 | **Distrust of paid tender services.** | "Paying some conman a monthly fee for nothing"; "they are just lists"; "There are sites out there that charge you to go onto the 'approved list'" (forum, 2021 and 2025). Trustpilot reviews of Tracker and BiP complain of auto-renewal (search extract) | FACT |
| 9 | **Belief that the outcome is fixed.** | "a bit too much neoptism [sic] during the process"; "you will need to know who to give the brown envelope to"; "the most important factor … is to be the second cheapest bidder" (forum) | FACT that people say it |

Word limits and insurance levels came up as mechanics, not as complaints: disqualification triggers "include missing documents, word count overruns, unsigned declarations, and late delivery" (ShiftCare guide for care providers, a vendor blog).

### 3.3 Bids per year, hours per bid, win rates

| Measure | Figure | Source and quality |
|---|---|---|
| Share of small firms that bid | 30% for council contracts and 9% for UK Government in three years | FSB 2025, via FMJ. Good |
| Bids per year | "Six tenders a year" | Snap-Edition survey of 300 businesses, 2011, a bid-writing vendor. Old and weak |
| Capacity by price tier | £49 for "about one full bid a month"; £149 for "1–2 full bids a month" | WinAContract plan design, 2026. Shows what one vendor thinks buyers do |
| Time per bid | Five days (FSB 2025); 35 hours (Snap-Edition 2011); "~23 hours" (BidScout page); "40+ hours" (SupplierVerse page); 87.4 hours (AutogenAI survey of 511 bid professionals, larger firms included) | One trade body, four vendors |
| Where the time goes | 35% writing, 30% understanding documents, 35% checking compliance | AutogenAI survey, vendor |
| Win rates | 31% won nothing in three years (FSB). 25% of 500 UK companies report 0–20% and 56% under 40%; "only 10% of high performers are SMEs" (Bid Solutions, 2025). 41% of construction SMEs win 10% of the time or less (FMB, 2013, old) | Mixed |
| Bids per competition | 3.8 on average, 4.7 where there was pre-market engagement; single-bid lots about 16% | Open Contracting Partnership, March 2026. Good |

- **INFERENCE:** with about four bidders per competition the base win rate is near 25%. An honest product can promise fewer wasted bids and fewer disqualifications. It cannot promise wins.
- **UNKNOWN:** how many bids a year an active small supplier submits today. No 2024–2026 figure exists in what I could reach. This number decides whether a subscription or a per-bid price fits, so it should be the first question in customer calls.

### 3.4 What they say about AI, ChatGPT and Copilot

- **I found no first-hand SME statement from 2025–2026** about using ChatGPT or an AI tool for a bid (Reddit and LinkedIn were unreachable). What follows is from bid professionals, buyers, lawyers and vendors.
- **Helpful for structure and summarising; generic on substance.** Contracts Advance had a senior reviewer mark a ChatGPT answer: it "would have achieved a low score due to ambiguity … and lack of evidence". A contractor's bid writer told Inside Housing (March 2024): "We've been trialling it, but it doesn't really work … It doesn't give us specifics".
- **Sameness.** "If multiple companies used the same AI for a bid, commissioners could end up with a pile of generic responses … We at Contracts Advance have seen this already." Scottish government guidance warns bidders that AI output "could mean similar bids are generated from others" (search extract).
- **Buyers notice and adapt.** Notting Hill Genesis said in 2024 it was "making [questions] far more project and service-specific to deter AI intervention". A bid consultancy lists tell-tale signs: "Americanisms", repeated buzzwords, "residual prompts".
- **Rules.** PPN 017 (February 2025) tells contracting authorities they may ask suppliers "to disclose their use of AI in the creation of their tender", may do extra due diligence, and should plan for "an increase in clarification questions and tender responses". Tussell: "the liability sits with the supplier — not the tool."
- **Confidentiality.** A procurement partner at Trowers & Hamlins: bidders often sign confidentiality undertakings, "So at the moment, the use of an AI tool is entirely incompatible with that approach" (2024).
- **More bids per competition.** AutogenAI reports a council receiving "nearly 30 bids" where it had two before (unsourced vendor anecdote). Open Contracting's data shows SMEs and VCSEs rising from 54% to 67% of bids in a year. **INFERENCE:** AI lowers the cost of bidding for everyone, so win rates per bid fall and a drafting tool's promise weakens over time.
- **General AI use by small firms is still low.** 21% of UK SMEs "use AI regularly" (Enterprise Nation, 1,320 SMEs, May 2026).
- **A favourable view exists too.** Echelon's chief executive: "If you're [a small business] and you're trying to get up the ladder, AI could be a real help to you as you write your initial draft." Among bid professionals, 92% say AI would help them submit more tenders and 34% have access (AutogenAI survey, vendor).

### 3.5 Complaints about existing tools

- **Price and lock-in:** auto-renewal complaints against Tracker and BiP on Trustpilot (search extract); Open Opps requires three months' notice on monthly plans; SupplierVerse requires twelve months.
- **Paying for what is free:** "a few of the sites ask us to pay a subscription as high as £30 a month … to have access to these IT Software contracts?" (forum, 2025). The original poster stayed with the free government site.
- **Irrelevant alerts:** vendors themselves say buyers often "use the wrong [CPV] code" and that poorly set profiles produce "hundreds of irrelevant notifications" (search extracts of Tenders Direct and Stotles pages). I found no independent customer review on this.
- **Generic drafts:** G2's summary for AutogenAI says some users find it "can produce generic content"; for mytender that content "occasionally requires careful review for accuracy" (search extracts).
- **UNKNOWN:** any review of BidScout, BidWriter, SupplierVerse or Tenderforge by a real customer.

### 3.6 Verbatim quotes

| Quote | Who, when | URL |
|---|---|---|
| "I'm no neanderthal when it comes to paperwork but the sheer amount needed to submit seems immense. I can either spend a good few days on this or seek out the services of someone who specialises in this and can break down the jargon for me!" | Small construction contractor, July 2021 | https://www.ukbusinessforums.co.uk/threads/tender-quote-for-local-authority-works.413972/ |
| "For anyone interested I had a rough estimate to prepare the tender. I had already decided not to tender at this point but asked one of the companies out of interest for a ballpark. 4.5k." | Same poster, August 2021 | same thread |
| "Ridiculous price, but not unusual to see. We would probably charge around half that figure" | A bid-support firm replying | same thread |
| "Sorry, but a few of the sites, ask us to pay a subcription as high as £30 a month for a year, £360 total to have access to these IT Software contracts ?" | New software company, May 2025 | https://www.ukbusinessforums.co.uk/threads/does-anyone-know-how-to-bid-for-contracts.429259/ |
| "There is a huge diffeence between paying th costs of tendering for a real contract and paying some conman a monthly fee for nothing." | Forum moderator, May 2025 | same thread |
| "If you can't afford £30/month you can't afford to bid for government contracts as the process will cost you a lot more" | Forum moderator, May 2025 | same thread |
| "Forget all that website stuff they are just lists. Get a strategy together to approach your target organisations directly" | Courier business owner, May 2025 | same thread |
| "Bidding takes time, which needs to be priced into the work … Tenders are often poorly written, with errors and missing info, which can cause indexing problems and difficulty for potential bidders to identify tenders that are relevant to them." | Consultant, January 2022 | https://www.ukbusinessforums.co.uk/threads/have-you-ever-bid-for-a-government-contract.416529/ |
| "Compulsory diversity questionnaires, filling in infinite bits of info that are just not quickly at hand for a small company" | Software supplier, January 2022 | same thread |
| "I have tendered for work … and been successfully added to a framework agreement which has then never produced any billable work." | Consultant, January 2022 | same thread |
| "Some of the docs did not upload properly so we were excluded from the process for not completing all the docs. But the system used did not highlight if docs were uploaded properly or not" | Forum member, November 2012 | https://www.ukbusinessforums.co.uk/threads/tender-writing.277349/ |
| "We dont pay anywhere near five figures for a PQQ, in fact its only three figures, and well worth the money, given the work we have won as a result." | Small business, June 2010 | https://www.ukbusinessforums.co.uk/threads/how-easy-is-it-to-win-public-sector-contracts.158136/ |
| "… the number I have seen, even from large companies, that were incomplete, did not enclose crucial documents, were badly laid out etc was alarming. We never went looking for information or made assumptions, if it was not there they were rejected." | Former local-government assessor, June 2010 | same thread |
| "Instead of feeling like an open opportunity, it can feel like a soul-destroying maze of portals, forms, and silence." | Tina McKenzie, FSB policy chair, December 2025 | https://www.fmj.co.uk/bids-from-small-firms-keep-disappearing-into-a-black-hole-says-fsb/ |
| "We've been trialling it, but it doesn't really work. It doesn't give us specifics – the sort of detail that we would need to make a response bespoke." | Bid writer at a large contractor, on AI, March 2024 | https://www.insidehousing.co.uk/home/the-ai-revolution-in-12-months-no-one-is-writing-bids-or-tenders-without-using-software-like-this-84238 |
| "The whole of the public sector has this really weird reliance on text and number of words. In the world of AI, all of that is gone." | Ian Makgill, Spend Network, March 2024 | same article |
| "mytender.io is the best AI tender writing tool I've seen and used and way ahead of anything Gemini/copilot can achieve." | Managing director of a bid consultancy, testimonial on the vendor's site | https://mytender.io/ |
| "The most helpful thing about mytender.io is the comprehensive breakdown of the ITT and specification - it makes things quicker and easier to focus on the exact pain points needed." | Bid writer, testimonial on the vendor's site | https://mytender.io/ |
| "I can now focus on quality, model and continuity rather than word counts and compliance checks." | Charity fundraising manager, testimonial on the vendor's site | https://mytender.io/ |

The older threads (2010–2016) are included because the complaints match the FSB's 2025 findings. Treat them as colour, not as measures.

---

## 4. Segments

### 4.1 Which trades have many small, frequent bidders and heavy written requirements

| Trade | Flow and small-firm presence | Written-quality load | Fit for a tender-pack tool | Verdict |
|---|---|---|---|---|
| Construction, repair and maintenance | About 62 + 16 new tender notices a week; 1,038 small winners with an email address in five weeks (R1). 27% of public construction contracts went through a framework or DPS in 2024 (Tussell via Enterprise Nation) | Method statements, health and safety, social value; pre-qualification repetition | Good, but much volume is framework call-offs and price-led | **First** |
| Health and social care | About 39 notices a week (R1). Health and social care SMEs earned £14bn directly in 2024 (BCC/Tussell 2025 via AutogenAI). Councils are the buyers | Vendor guide: "60 to 80% quality weighting"; missing documents disqualify | Good; documents are long and similar across councils | **First**, but check how many care tenders are closed frameworks |
| Cleaning, facilities, grounds, waste | About 18 notices a week for cleaning and environmental (R1). mytender's named customers are FM and waste firms | Mobilisation, staffing, social value | Good | **First** |
| Education, training, recruitment | About 15 notices a week (R1). Highest SME share of spend, 33% in 2025 (Tussell). Bidwin's case studies are training providers | Narrative-heavy, often grant-like | Good; small bid sizes | **Second** |
| Professional and business services | About 31 notices a week (R1) | Varies | Medium; very mixed trade | Second |
| IT and digital | About 20 notices a week (R1). SMEs hold 12% of a £19.1bn market; tech SMEs win 44% of local-government value through frameworks (Tussell) | Catalogue listings and framework call-offs more than essays | Weaker; crowded with tools aimed at tech sellers (Stotles, Tussell) | Later |
| Security, transport | Not measured separately | — | UNKNOWN | — |

- **FACT:** local government is where small firms win: 34% of its direct spend and £29.1bn in 2025, against 10% for central government (Tussell). R1 found local-government buyers behind 2,100 of 4,906 small suppliers with emails.
- **FACT:** quality criteria are used in 66% of open-procedure lots and 74% of competitive flexible lots (Open Contracting Partnership).
- **UNKNOWN:** counts of small suppliers by trade from an official or Tussell source. The only total is 137,191 SME suppliers invoicing the public sector in 2025, 77% of all suppliers (BCC/Tussell 2026).
- **Recommendation:** start with small suppliers to councils in construction and maintenance, cleaning and facilities, and care. These combine the largest measured flows with long written answers and document rules that disqualify.

### 4.2 Freelance bid writers and small consultancies

- **FACT:** APMP UK says it has "nearly 3,000 members" and is the association's largest chapter (https://www.apmpuk.co.uk/). Most members work in-house, so freelancers are a fraction of that.
- **FACT:** contract day rates sit around £500 (five advertised rates). Bid Solutions claims "the largest online directory of independent bid and proposal consultants" (search extract; no count).
- **FACT:** vendors already court them. BidWriter lists "bid and proposal consultancies" as users; Bidwin names "independent bid consultants"; two mytender testimonials come from consultancies; Tenderbase sells bid-request leads to writers at £10 per five.
- **FACT:** part of the trade sells against AI: "expert bid writing … no AI needed" (BWL Group); "a named, experienced writer, not an anonymous associate or an AI tool" (bidwriters.co.uk).
- **INFERENCE:** they can pay (one saved day covers three months at £149), they bid every week so they do not churn like an occasional bidder, and they gather in few places (APMP UK events, LinkedIn). But there are probably only a few thousand, they are the most demanding judges of draft quality, and several products already target them. Treat them as a second segment and a referral channel, with a multi-client plan, after the product can pass their scrutiny.

---

## 5. Pricing and packaging evidence

### 5.1 Units and price points seen today

| Unit | Examples | Label |
|---|---|---|
| Free forever, then upgrade | BidSonar, WinAContract, Stotles, Supply2Gov local, Open Opps, T&L Tender Pipeline | FACT |
| Flat monthly, low | Tenderforge £15.99–£99.99; Tenderbase £25–£55; B2B Quote "£7 per week" | FACT |
| Monthly with AI credits | BidScout £49 / £149 / £499 (500 / 2,500 / 10,000 credits); BidWriter £49 / £149 / £279 (30 / 150 / 400 credits, described as bids per month) | FACT |
| One plan | SupplierVerse £199 with a 12-month commitment | FACT |
| Per seat or seat band | EasyPQQ £750 for 1–5 users; Open Opps £120 per user; T&L £2,750 a year for one user; BidScript by seat | FACT |
| Per bid or project | SwiftBid £149 / £349 / £749; AutoRFP $899 a month for 24 projects a year (about $450 a project); Bidwin £50 per tender for guided setup; Contracts Advance £750 per one-day review | FACT |
| One-off licence | Bidwin £299; bidpiston £600 + VAT | FACT |
| Annual discount | 25% (Tenderbase), 20% (SupplierVerse, BidWriter); Tenderlake prices annually | FACT |
| Introductory offers | 14-day trial without card (BidScout, Tenderbase, SupplierVerse); 7 days (Tenderlake); first month free with card (Bidwin); "3 months for the price of 1" (BidWriter); "founding" prices (SupplierVerse, bidpiston, Bidwin) | FACT |

- **UNKNOWN:** which of these prices small firms actually pay. No vendor under £200 publishes customer numbers that can be checked, and none has independent reviews.
- **INFERENCE:** the spread of "founding" prices, long trials and deep introductory offers among the newest entrants suggests buyers are hard to convert at list price.

### 5.2 Is there evidence for a per-bid pass at £99–£299?

- **FACT:** one service sells exactly this (SwiftBid, from £149). Its own blog argues the case: "A £1,500/month platform is a waste of money if you bid twice a quarter."
- **FACT:** Stotles' own guide states that "per-user, per-bid, and flat-rate subscriptions are all common".
- **FACT:** BidWriter's £49 tier is sized as "about one full bid a month", so one bid already costs £49 at a direct competitor.
- **INFERENCE:** a per-bid pass matches how small firms buy help now (per-bid consultant quotes, one-day reviews) and how often they bid. The evidence that people buy it from software is one unproven vendor. It is a reasonable bet, not a proven unit.

### 5.3 What would make £149 a month an easy yes for a firm that bids once a month

1. **It has to beat £49.** A firm bidding once a month can get a parser, drafts and a library at BidWriter or BidScout for £49. £149 is only easy if the product does something those do not, visibly, on the customer's own pack before payment.
2. **Proof on their own tender first.** A free cited pass/fail and bid/no-bid brief for one uploaded pack (R3 already proposes this). BidReview and BidSonar give their first result free; Bidwin gives a month.
3. **Arithmetic the owner already believes.** One bid takes five days (FSB). A consultant review costs £750 a day. If the tool reliably saves one day per bid, £149 is covered several times. State it as time saved and disqualifications avoided, never as wins.
4. **No lock-in.** Monthly, cancel or pause in one click, unused bids roll over. This answers the auto-renewal and "monthly fee for nothing" complaints directly.
5. **A per-bid door.** £99–£149 for one pack, credited against the first month if they subscribe.
6. **Trust basics a solo overseas vendor must show:** where files are stored, that they are not used for training, deletion on request, a ready-made AI-use disclosure paragraph for buyers who ask under PPN 017, and a named person.

### 5.4 Packaging recommendation

| Tier | Price | Contents | Why |
|---|---|---|---|
| Free page | £0 | Own awards, matched live notices, competitor contracts ending, buyers that award small contracts in the trade; weekly email | The acquisition asset. Must be open, not gated like BidScout's |
| Bid pass | £99–£149 per tender pack | Cited pass/fail list, bid/no-bid brief, compliance matrix with word limits and weights, first drafts from uploaded evidence, marking pass | Matches episodic bidding; sits far below a £750 review |
| Bid desk | £149 a month, or about £1,490 a year | Two or three packs a month with rollover, evidence library, daily radar across several trades and regions, expiry alerts | For monthly bidders and bid writers; radar pro is included, not sold separately |
| Radar only (optional) | £19–£29 a month | Extra trades and regions, daily digest, expiry alerts | Only if users ask. At £49 it meets free substitutes and Tenderbase at £25 |

**ASSUMPTION:** these numbers are untested. The seven-day test should offer the pass and the subscription side by side and count which is chosen.

---

## 6. Positioning: gaps, unsafe claims, failure reasons

### 6.1 Where a newcomer has a credible wedge

1. **"We built your public-sector page: your awards, the buyers who award work like yours without a tender, and the contracts near you that end soon."**
   - Why: about 41% of procedures are direct and small firms get under half of those awards (Open Contracting Partnership). Forum advice is to go to buyers directly. No product page I read offers this view to a small firm; ranked buyer profiles start at £475 a month at Stotles.
   - Weakness: it informs relationship selling, which the product does not do for them. It may be read once and not paid for.
2. **"Before you spend five days: the 12 things in this pack that will get you thrown out, each with the page it comes from."**
   - Why: eligibility and completeness are the most concrete, checkable pains (43% cite eligibility; assessors reject incomplete bids). Citations are verifiable by the customer in minutes, which builds trust without a brand. No competitor page claims clause-level citation.
   - Weakness: one bad miss destroys the claim. It needs a visible "we could not find this, check yourself" list.
3. **Per-bid pricing with pause and rollover.** Why: section 5.2. Weakness: easy to copy.
4. **Trade packs for council suppliers** (construction and maintenance, cleaning and facilities, home care): the recurring questions for that trade, an evidence checklist (insurance levels, accreditations, policies), and answer skeletons that demand the firm's own facts. Why: horizontal tools show no trade depth below £750 a month. Weakness: needs real trade knowledge the founder may not have; one experienced bid writer per trade as a paid reviewer would fix it.
5. **Loss debrief as the hook.** "Send us your last losing bid and the buyer's assessment summary; we show where the marks went." Why: only 5% get useful feedback; the Procurement Act now gives every bidder an assessment summary. BidWriter and BidScout list debrief features but do not lead with them. Weakness: needs the customer to have kept the documents.
6. **Plain honesty as the brand.** "Fewer wasted bids. No win-rate promises." Why: the category is full of unverifiable numbers (81–87% win rates, "+34% win-rate uplift", "87% bid fit score accuracy", three different customer counts on one site), and the audience already expects a con.

Weaker than they look:

- **Evaluator-style marking.** At least seven products claim it. It is a required feature, not a wedge, unless it is calibrated on real marked bids as BidReview says it is.
- **Social value help.** The new Social Value Model (PPN 026, published 5 August 2026) applies to central government procurements of £1m or more that start on or after 1 January 2027, and it is not mandatory for councils. The target segment mostly meets council-specific social value schemes instead. Useful as content; not a timed mandate for this audience.
- **Answer library.** Universal. Its value appears only after several bids, which occasional bidders may never reach.

### 6.2 Claims that would be unsafe

| Claim | Why unsafe |
|---|---|
| "Win more contracts", win-rate uplift, win probability as a number | Cannot be evidenced; about four bidders per competition; consultants warn "be wary of anyone guaranteeing a win"; R3 notes Paddle's sensitivity to "business opportunity" wording |
| "100% compliant", "zero rejection risk", "submission-ready" | One missed mandatory document disproves it. BidScout's own terms say AI content is "a starting point only" |
| "Predicts your score" | No calibration data at launch |
| "Buyers can't tell" or any detection-evasion angle | Buyers may ask for disclosure under PPN 017; liability stays with the supplier |
| Any look of an official service ("Find a Tender", crests, "gov") | Misleading, and a payment-provider risk (R3) |
| "Your data is never used for training", "UK-hosted", "GDPR compliant" | Only if literally true and documented; tender packs can carry confidentiality terms |
| Customer counts, testimonials or logos not yet earned | The market already does this and buyers discount it |
| "Every UK tender" or "all portals" | Tender documents sit behind 15+ portals (R1); below-threshold publication is incomplete |

### 6.3 Top five reasons this product fails

1. **No visible difference at the point of sale.**
   - Evidence: BidScout and BidWriter at £49 / £149 with the same feature words; SupplierVerse at £199; Tenderforge from £15.99; free radar from BidSonar; 48,141 supplier pages already live at BidScout.
   - Consequence: the cold email competes with "it's free on gov.uk" and with look-alike sites. The page being open and personal is the only difference a recipient can see in ten seconds.
2. **Small firms bid too rarely for a subscription, and many do not want to bid at all.**
   - Evidence: 30% bid to councils in three years; five days per bid; 31% won nothing; R1 measured only tens of new notices a week per trade nationwide; forum advice favours direct relationships.
   - Consequence: high churn on radar pro and bid desk. The winners in the award data already know how to win, so the email list is biased toward firms that need the product least.
3. **"Good enough" substitutes for the drafting step.**
   - Evidence: ChatGPT or Claude at about £20; prompt systems at £299 and £600 that run inside those accounts and keep the files in the customer's own account; only 21% of SMEs use AI regularly, so many are not looking for an AI tool.
   - Consequence: drafts from thin evidence read as generic, which reviewers mark down. A small firm with no evidence library gets little from any tool on its first bid, and the first bid is when it decides to pay.
4. **Trust and confidentiality, sharpened by who the seller is.**
   - Evidence: the audience expects scams ("conman", "they are just lists"); tender packs may be confidential; buyers may ask about AI use; rivals show ISO 27001 (mytender), UK data residency (BidWriter), "UK-based support" (BidScout), or bid-consultant founders (Bidwin, bidpiston, T&L).
   - Consequence: a solo, non-UK founder with no bid credentials asks firms to upload commercially sensitive documents after a cold email. Conversion will depend on visible safeguards and a UK-credible face or partner.
5. **The channel may be weaker and shorter-lived than assumed.**
   - Evidence: no proof that winners open such emails (UNKNOWN); half of addresses are generic mailboxes (R1); 58% of suppliers in below-threshold awards carry no organisation identifier (Open Contracting Partnership), so confirming a corporate recipient for lawful cold email is harder for the smallest winners; BidScout or Stotles could copy the tactic in days; the Cabinet Office could change what the feed exposes.
   - Consequence: the one measured advantage (R1's prospect list) could underperform or be closed.

Also worth noting: public bodies may fill the gap for free. Enterprise Nation and Newable are piloting "Supply Connect", described as "a digital supplier hub" with training, and the Open Contracting Partnership is pressing the Cabinet Office to add dashboards to the central platform.

---

## 7. Demand indicators

| Indicator | Reading | Label |
|---|---|---|
| Active small suppliers | 137,191 SMEs invoiced the public sector in 2025 (77% of suppliers); £45.2bn, 21% of direct spend, a six-year high | FACT, BCC/Tussell 2026 (Tussell blog; figures also in chamber coverage) |
| Bidders, not only winners | SMEs and VCSEs made 67% of bids by February 2026, up from 54% in March 2025 | FACT, Open Contracting Partnership |
| New winners each week | 782–984 small suppliers with an email address appear in award notices weekly | FACT (R1 measurement) |
| Registered suppliers on the central platform | Not published | UNKNOWN |
| Earlier signals | "More than 600" market-engagement notices a month, 700 in February 2026; 10,610 such notices and 8,582 pipeline notices in the first year | FACT, Open Contracting Partnership; PUBLIC |
| Growth of AI bid tools | At least 13 UK-facing AI bid products, plus one Irish, with a site or listing today (section 2.2). Founded or incorporated: 2022 AutogenAI; 2023 mytender, EBIDA, Go Diverse; 2024 BidScript; 2025 eSourcing Data; 2026 Hypership. Funding: BidScript over $1m (July 2026), mytender £250k, Altura €8m | FACT |
| G-Cloud 15 listings | "bid writing": 7 results; "AI bid writing": 2 (both Thornton & Lowe); "bid management software": 51, mostly unrelated. No listing for Stotles, mytender, AutogenAI or BidScout | FACT, Digital Marketplace search today. **INFERENCE:** G-Cloud is not where suppliers buy bid tools |
| Search-visible content: "tender response template" | Results led by paid model-answer packs (Flevy, $48, 65 pages), an Etsy kit (about $42), Fiverr gigs, a council template, the Crown Commercial Service guide, and Tracker, Stotles and Xait blogs | FACT (search extract), one US-based search; pages not opened. Contested |
| "social value response example" | Mostly council guidance and Contracts Finder attachments; few vendor pages | FACT (search extract), one US-based search. **INFERENCE:** worked examples by trade are a content gap |
| "how to write a tender bid" | Official guides, Stotles, Tracker; SupplierVerse (24-minute guide, May 2026); mytender (230 posts); BidScout (54 posts) | FACT. Contested |
| People paying for templates | Model answers are listed at about $40–$50 on marketplaces; sales volumes unknown | FACT (search extract). **INFERENCE:** a one-off "trade answer pack" at £29–£49 could be a low-friction first sale |

---

## 8. What I could not verify

- Whether any competitor emails contract winners with their own page.
- Real customer numbers, revenue or churn for any tool under £500 a month. The only hard size signal is the Companies House accounts category.
- Whether BIDSCOUT LTD (13530098) operates bidscout.co.uk; who is behind SwiftBid, bidwriters.co.uk and BidSonar's company.
- Quality of any product: no trials were run.
- First-hand SME views on AI bid tools in 2025–2026 (Reddit, LinkedIn, Trustpilot and G2 unreachable).
- The FSB report's full tables (bids per year, AI use, sector splits).
- Bids per year for an active small supplier today; small-supplier counts by trade.
- Tenderforge's own pricing page and status; BIDSOFTWARE's own site; Hudson's current portal prices; bidstats.uk.
- Suppliers registered on the central digital platform.
- Whether SupplierVerse is supported by Innovate UK.
- Homecare provider size split (85% under 50 staff) appeared only in a search extract.
- No-win-no-fee bid writing: none found, which is not proof that none exists.

What would change the picture:

- **Better for the concept:** the R3 seven-day test showing at least 7.5% page visits and 2.5% claims; five call transcripts in which monthly bidders say the cited pass/fail list is worth £100 or more per pack; a product trial showing that BidScout's or BidWriter's extraction misses mandatory requirements.
- **Worse:** finding that BidScout already emails winners; trials showing those tools do cited extraction well at £49; fewer than one in five interviewed winners bidding more than four times a year.

---

## 9. Sources read today (2026-11-13)

**Vendors, AI bid tools**
- https://www.bidscout.co.uk/ ; /pricing ; /about ; /features/ai-bid-writer ; /features/tender-leads ; /suppliers ; /suppliers/kpj-property-services ; /competitor-intel ; /privacy-policy ; /terms-of-service ; /sitemap.xml
- https://www.winacontract.co.uk/ ; /plans ; /bidwriter ; https://winacontract.com/ ; https://winacontract.com/pricing
- https://www.supplierverse.ai/ and sitemaps
- https://mytender.io/ ; /tenders ; /sitemap.xml ; https://www.setsquared.co.uk/mytender-io-announce-250000-pre-seed-raise/
- https://www.stotles.com/ ; /pricing ; /bid-studio ; /sitemap-index.xml ; /resource/blog/best-tender-writing-software ; /resource/blog/best-tender-management-software ; /resource/blog/ai-in-bid-writing-your-questions-answered
- https://www.easypqq.co.uk/ ; /pricing/
- https://www.bidscript.co.uk/ ; /plans ; https://tech.eu/2026/07/02/university-founded-ai-tender-startup-bidscript-exceeds-1m-in-total-pre-seed-funding/
- https://bidwin-ai.com/ ; https://buildmybidmanager.uk.com/
- https://swiftbid.pages.dev/ ; /pricing ; /terms ; /blog/best-ai-bid-writing-tools-uk-2026 ; /blog/ai-bid-writing-vs-traditional-bid-writers
- https://www.bidreview.ai/ ; https://www.techcentral.ie/bidreview-brings-evaluator-expertise-to-ai-written-tenders/
- https://autogenai.com/ ; https://autogenai.com/uk/blog/new-research-exposes-ai-access-gap-in-bid-writing-92-want-it-just-one-third-have-it/ ; /uk/blog/ai-wont-kill-the-bid-misused-ai-will/ ; /uk/blog/the-cost-of-competition/ ; /uk/blog/the-sme-opportunity-in-numbers-where-to-play-and-how-to-score/
- https://tendersight.ai/ ; https://autorfp.ai/pricing ; https://altura.io/en/pricing ; https://bidwriter.co.uk/ (parked)
- Capterra: https://www.capterra.com/p/10050139/Tenderforge/ ; https://www.capterra.co.uk/software/1105544/Tenderforge ; https://www.capterra.co.uk/software/1103395/BidWriter ; https://www.capterra.co.uk/software/1111286/Bidwin-AI ; https://www.capterra.com/p/235578/Stotles/ ; Capterra UK pages for mytender.io and AutogenAI

**Vendors, discovery and alerts**
- https://bidsonar.com/ ; /organisations ; /vs/stotles ; /sitemap.xml
- https://www.supply2govtenders.co.uk/pricing/ ; https://tenderbase.co.uk/pricing ; https://www.tenderlake.com/pricing ; https://contractsadvance.co.uk/pricing/ ; https://www.tendersdirect.co.uk/pricing/ ; https://www.tussell.com/plans ; https://www.trackerintelligence.com/ and /pricing/ ; https://openopps.com/pricing/ ; https://www.b2bquotetenders.co.uk/ ; https://www.tenderconsultants.co.uk/discover-tendering-opportunities/
- G-Cloud 15 (Digital Marketplace) searches and listings: https://www.applytosupply.digitalmarketplace.service.gov.uk/g-cloud/search?q=bid+writing ; services 235634672648809 and 475332057730803 (Thornton & Lowe), 121123623948905 (Oxygen Insights), 361420203931799 (Tussell) ; pricing document https://assets.applytosupply.digitalmarketplace.service.gov.uk/g-cloud-15/documents/722937/235634672648809-pricing-document-2026-01-29-1655.pdf

**Human services**
- https://www.executivecompass.co.uk/ ; https://thorntonandlowe.com/ ; https://www.tenders-uk.com/ ; https://yourtenderteam.co.uk/ ; https://www.completetenders.co.uk/ ; https://www.tenderconsultants.co.uk/bid-writing-service/ ; https://bidwriters.pages.dev/pricing/ ; /resources/bid-writing-costs/ ; https://bwlgroup.co.uk/procurement-hits-back-against-ai-content/ ; https://www.itjobswatch.co.uk/contracts/uk/bid%20writer.do ; https://www.apmpuk.co.uk/

**Customer voice and surveys**
- UK Business Forums threads 429259, 413972, 416529, 277349, 158136, 120487, 353091 and article 6806 (URLs in section 3.6)
- FSB "Signed, Sealed, Delivered": https://www.fmj.co.uk/bids-from-small-firms-keep-disappearing-into-a-black-hole-says-fsb/ ; https://www.smeweb.com/small-businesses-involved-in-public-sector-procurement-plagued-by-late-payment-and-lack-of-feedback-on-unsuccessful-bids/
- Enterprise Nation and Newable, Supply Connect report 2025: https://a.storyblok.com/f/102007/x/68a82c987a/supply-connect-report-2025.pdf ; Enterprise Nation AI adoption report: https://a.storyblok.com/f/102007/x/ec83d6c6a3/digital-and-ai-adoption-among-uk-smes.pdf ; https://www.enterprisenation.com/learn-something/public-sector-frameworks-whats-changing/
- https://www.techuk.org/insights/guest-insights/what-are-the-barriers-for-smes-when-bidding-for-government-contracts
- https://www.manchesterdigital.com/post/athena-commercial/the-state-of-bid-management-in-2026
- https://dev.to/bid_solution/pushing-beyond-the-status-quo-bid-solutions-1ncl
- https://www.theconstructionindex.co.uk/news/view/businesses-waste-28-days-a-year-on-tenders (2011)
- https://southernconstructionframework.gov.uk/is-the-effectiveness-of-the-procurement-act-at-risk-from-a-lack-of-resource-and-knowledge-within-smes/
- https://shiftcare.com/uk/blog/winning-local-authority-domiciliary-care-tenders-bid-uk-providers
- https://contractsadvance.co.uk/the-insight-hub/insights/insight-paper-can-chatgpt-write-a-high-quality-tender-response/
- https://www.insidehousing.co.uk/home/the-ai-revolution-in-12-months-no-one-is-writing-bids-or-tenders-without-using-software-like-this-84238
- https://www.tussell.com/insights/do-ai-bid-writers-work-for-public-sector-bidding

**Official data and policy**
- https://www.tussell.com/gov/blog/sme-procurement-tracker-2026 ; https://www.tussell.com/insights/analysis-tech-smes-in-the-public-sector-market
- https://www.open-contracting.org/2026/03/03/the-uk-procurement-act-one-year-on-what-does-the-data-tell-us/
- https://www.public.io/blog-post/procurement-act-2023-an-impact-review ; https://procurementmag.com/news/businesses-one-year-procurement-act-2023
- https://www.gov.uk/government/publications/ppn-017-improving-transparency-of-ai-use-in-procurement/ppn-017-improving-transparency-of-ai-use-in-procurement-html
- https://www.gov.uk/government/publications/ppn-026-the-social-value-model and its HTML note ; https://blog.neighbourly.com/ppn-026-initial-perspectives-on-the-new-social-value-model
- Companies House (find-and-update.company-information.service.gov.uk): 13530098, 15132671, 10912358, 14872986, 15669402, 14721045, 16391108, 14634305, 13907128, 10295265, 09454393, 07600205, NI736697

**Search extracts only (pages not opened)**
- Trustpilot pages for Tracker Intelligence, BiP Solutions, Tenders Direct and Supply2Gov; G2 pages for mytender.io, AutogenAI, BidScript and BidScout; Scottish supplier guidance on AI; Homecare Association figures via Express & Star; FMB and NFB procurement surveys (2011–2013).

**Internal**
- `docs/research/round1/G-open-data-alerts.md` (measured notice flows, supplier counts, portal count); `docs/research/round2/R3-red-team.md` (funnel arithmetic, seven-day test, Paddle policy).
