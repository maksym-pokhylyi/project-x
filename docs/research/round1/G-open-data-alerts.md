# G — Open-data alerts and monitoring SaaS: which one could a solo founder take to $10k MRR in 12 months?

Research date: 2026-11-13. Scope: subscription products built on open or public data that deliver filtered, AI-qualified alerts to businesses, preferably where the same data also yields a prospect list, a personalised first message, and programmatic SEO pages.

## 0. Bottom line

Only one candidate in this scope has all of the following verified today: a free national API with a commercial-reuse licence, published price lists showing that small firms pay, a prospect list with business email addresses inside the data itself, and a jurisdiction where cold business email is lawful. That candidate is **UK public-sector opportunity monitoring built on the Find a Tender open API**.

It is also a crowded, cheap market. AI-assisted tender alerts already sell for £25 to £99 per month, and the official service sends free email notifications. So the recommendation is narrow:

1. **Pick 1 — UK public-contract radar for small suppliers, launched trade by trade and sold by cold email generated from award notices.** In five weeks of award notices I counted 4,906 distinct small and medium suppliers with an email address in the open data, 3,155 of them with a Companies House number (incorporated, so the UK cold-email exemption applies). No other candidate hands the founder a channel like this.
2. **Pick 2 — the same pipeline sold as "contract-win and contract-expiry signals"** to firms that sell to public-sector suppliers rather than bid themselves (recruiters, finance brokers, insurers). Data is verified; demand is an assumption.
3. **Pick 3 — a schools and colleges change radar for companies that sell to education.** It adds the daily open schools register (new head teachers, trust changes, new schools) to education tenders, awards and contract end dates. Data is verified; willingness to pay is not, and school purchasing barely appears in the tender data.

All three share one codebase and one main data source, so they are better treated as three wedges to test in the first weeks than as three businesses. There is no strong second candidate: Picks 2 and 3 are the least weak of the rest, and their order is a judgement call.

**Honest odds.** I found no evidence that makes $10k MRR in 12 months likely for any candidate here. For Pick 1 it needs roughly 100 to 190 paying firms at £39 to £79 per month, in a market where the measured flow of new tenders per trade is small (about 62 construction and about 20 IT and software tender notices a week across the whole UK). The most dangerous assumption is that cold email converts and that subscribers stay when most weeks bring them few relevant notices.

**Everything else loses** for one of four reasons: the data is commoditised (company and insolvency events at £25 to £39 per user per month), the data needs heavy scraping or a paid licence (planning and permits), official free alerts already do the job (clinical trials, recalls, grants), or cold email to the buyers is unlawful or needs a language the founder lacks (Germany, Netherlands, France).

## 1. Method, limits and labels

- **How the research was done.** Live on 2026-11-13. The session's shared web-search budget ran out after four queries, and the page-fetch tool could not resolve hosts. I therefore fetched primary sources directly (official API documentation, licence pages, vendor pricing pages, sitemaps) and called the public APIs myself. A follow-up run with search available would be the way to close the gaps listed in section 10.
- **What this means for the evidence.**
  - Strong: API existence, licence, rate limits, data fields, daily volumes, list prices. These were read or measured today.
  - Weak: anything only a search engine finds. That covers forum complaints, churn stories, review-site ratings and new entrants I did not already know. Review sites that I tried (Trustpilot) refused the request.
  - About 125 pages were fetched directly, plus live API calls (mostly paging through the Find a Tender API), in place of the planned 60 to 90 search-led lookups.
- **Labels.** FACT means seen in a primary source or measured in a live API call today. INFERENCE means reasoned from facts. ASSUMPTION means not checked. UNKNOWN means I could not find out. "Background knowledge" means I recall it from before this session and did not re-verify it today.
- **Own measurements.** Section 12 lists the API calls and counts so they can be repeated.
- **Currency.** ECB reference rates of 2026-11-12: 1 EUR = 1.1081 USD = 0.83595 GBP, so $10,000 is about £7,540 or €9,020.

## 2. Findings that apply to the whole category

### 2.1 The data side is easy; it is not where the risk is

| Source | Access verified today | Licence | Contact data inside |
|---|---|---|---|
| UK Find a Tender (OCDS API) | No key. 429 after about nine rapid requests, none at one request per nine seconds | Open Government Licence v3.0 | Buyer email in every notice; supplier email in 82% of supplier records |
| UK Contracts Finder (OCDS API) | No key | Open Government Licence v3.0 | No supplier email (0 of 94 in sample) |
| EU TED (Search API v3) | No key | CC BY 4.0 / Commission reuse notice (per data.europa.eu) | Winner email in 62% of sampled award notices |
| Germany (Bekanntmachungsservice OpenData API) | No key | CC Zero | Organisation name, website, city; no email in the CSV export |
| US SAM.gov | Personal API key; 10 requests per day without an entity role | Public | Contact email and phone are restricted to federal system accounts |
| Ukraine Prozorro | No key | Not verified today | Not checked |
| France BOAMP | Reachable, unstable today | Not verified today | Not checked |
| Australia AusTender (OCDS API) | No key | CC BY 3.0 AU | The email in supplier records is the agency's, not the supplier's |

- **FACT:** none of these sources needs scraping or a paid licence. SAM.gov's limit of 10 requests per day is the only real constraint on a one-day v1.
- **INFERENCE:** because the data is this easy, it is equally easy for every competitor. Data access is not a moat for any candidate in this report.

### 2.2 Proven willingness to pay sits where competition is densest

- **FACT:** published prices for tender alerts in the UK run from free to £546 per month, with at least four vendors at or under £99 (section 3.1).
- **FACT:** UK company-event monitoring, including newly formed company leads and unlimited alerts, is bundled at £25 to £39 per user per month by Endole.
- **FACT:** US federal opportunity data with AI matching starts at $39 per user per month (CLEATUS) and $500 per year (HigherGov).
- **INFERENCE:** "alerts on open data" is a feature inside cheap incumbent products. A new entrant needs a distribution advantage or a sharper job, not a better feed.

### 2.3 Cold business email is lawful in few of the relevant markets

| Market | Rule | Status |
|---|---|---|
| UK | The electronic-mail rule in PECR does not apply to corporate subscribers (companies, LLPs). Sole traders and ordinary partnerships count as individuals. UK GDPR still applies to a named person's address | FACT (ICO guidance) |
| Germany | Advertising by electronic mail needs prior express consent, with no business exemption | FACT (UWG §7(2) no. 2) |
| Netherlands | Unsolicited commercial electronic messages need prior consent, including to legal persons, unless the recipient published the address for that purpose | FACT (Telecommunicatiewet art. 11.7) |
| France | Business prospecting by email is allowed on an inform-and-opt-out basis when it relates to the recipient's profession; generic company addresses are outside the rule | FACT (CNIL, page dated 10 June 2026) |
| USA | CAN-SPAM permits unsolicited commercial email with identification and opt-out | Background knowledge; the FTC page did not load today |
| Ireland | The consent rule covers natural persons, and excludes email to an address used mainly for commercial or official activity when the message relates solely to that activity | FACT (S.I. No. 336/2011, regulation 13) |
| Poland, Canada, Australia | Believed strict in Poland and Canada, "inferred consent" in Australia | Background knowledge; official pages did not load today |

### 2.4 Payments constraint that affects go-to-market

- **FACT:** Paddle supports sellers in Ukraine except in Crimea, Donetsk, Kherson, Luhansk and Zaporizhzhia regions. The founder's region must be checked.
- **FACT:** Paddle's fee is 5% plus 50 cents per checkout transaction.
- **FACT:** Paddle's acceptable-use page (last updated 13 April 2026) forbids offerings "marketed through the use of outbound telemarketing", "Advertising Services, including ... job boards", "Business or investment opportunities", "Government Services", and anything that contravenes GDPR consent requirements.
- **INFERENCE:** cold calling is off the table as an acquisition channel. The product must be positioned as monitoring software, not as a list of leads or a "business opportunity" service, and must not look like an official government site.

## 3. Candidate 1 — Public tenders and contract opportunities

### 3.1 UK: Find a Tender based radar for small suppliers, trade by trade (Pick 1)

**What the open data now contains.** Most UK notices are now published under the Procurement Act 2023 (2,101 of 2,427 releases in the week measured), on one platform with a public API. My measurements:

| Measure (Find a Tender API) | One weekday, 2026-11-11 | One week, 2026-11-02 to 11-08 |
|---|---|---|
| Releases (notice versions) | 445 | 2,427 |
| Under the Procurement Act 2023 | 377 | 2,101 |
| New tender-stage releases | 70 | 385 |
| Award or contract releases | 264 | 1,516 |
| Planning releases (pipeline, market engagement) | 58 | 214 |
| Below-threshold tender notices | 30 | 156 |
| Tender notices valued at £100k or less | 21 | 74 |
| Distinct suppliers named | 338 | about 2,000 |
| Suppliers with an email address | 311 | 1,647 |
| Suppliers flagged as SME, with email | 190 | 1,007 |
| SME, email and Companies House number | not counted | 594 |

- **FACT:** in the week sample, about 490 of the 1,007 SME addresses were generic mailboxes (info@, sales@, tenders@ and similar), about 470 looked like a named person, and about 47 were free-mail addresses.
- **FACT:** supplier telephone numbers are rare (158 of about 2,000), so the data supports email outreach, not calling.
- **FACT:** 71% of contracts in the week carried an end date (924 of 1,296) and 92% a value (median £102k). That is enough to build a "contracts ending soon" view.
- **FACT:** of the 1,516 award or contract releases in the week, 509 were below-threshold awards made without open competition ("without competition" 336, "limited competition" 173) and a further 289 were direct awards above threshold. Only 409 followed an openly advertised competition; the rest were framework call-offs or of unknown procedure.
- **INFERENCE:** more than half of published awards never appeared as a tender notice. Small contracts mostly go to suppliers the buyer already knows, so a tender alert shows a small firm the minority of the work it could win.
- **FACT, five-week view (2026-10-05 to 2026-11-08, 11,841 releases):**
  - New tender-stage releases ran at 346 to 385 a week (1,824 in total; 692 below threshold; 338 valued at £100k or less).
  - Award or contract releases ran at 1,388 to 1,556 a week.
  - 4,906 distinct SME suppliers with an email address appeared. Of these, 3,155 had a Companies House number, and 1,594 had both a Companies House number and a generic mailbox.
  - The pool keeps refilling: in each of the four later weeks, 782 to 984 of that week's SME suppliers had not appeared earlier in the window.
  - By trade (CPV division of the contract), the largest groups of SME suppliers with email were construction 1,038, health and social work 498, business services 433, education and training 264, medical equipment 261, architecture and engineering 249, cleaning and environmental 211, and IT services 188.
  - By buyer type (matched on buyer name), local government accounted for 2,100 of the 4,906 and 791 of the 1,824 tender notices.

**Who has the problem, who pays, who decides.**
- UK small and medium firms that sell to public bodies or want to.
- **ASSUMPTION:** the owner or managing director decides in small firms and a bid or business-development manager in larger ones; the budget is sales and marketing software.
- **FACT:** the pool is visible in the data: 1,000 to 1,200 distinct SME suppliers with email appear in award notices each week.

**The recurring job and the trigger.**
- Job: see every relevant new opportunity, decide quickly whether to bid, and know when a competitor's contract ends.
- Triggers: a new notice; a contract end date approaching; a lost contract; a new financial year.
- **FACT:** the median time from publication to deadline was 28 days, so a weekly digest is fast enough for most notices.

**How it is solved now.**

| Option | Price seen today | Notes |
|---|---|---|
| Find a Tender account | Free | "save search criteria" and "sign up for notifications via email"; a "Summarised Search" over opportunities, contracts and 16,728 frameworks and dynamic markets, with CSV export |
| Supply2Gov | One local area free; £25, £80, £95 per month | Keyword alerts by region |
| Tenderbase | £25, £33, £42, £55 per month | "Advanced AI Tender Search"; document retrieval at £10 per five requests |
| Hudson / Together sector portals | £60 or £95 per month plus VAT; £500 per month with bid support | Six sector portals: construction, transport, healthcare, creative, facilities, technology |
| Stotles | Basic from £99 per month; Growth from £475; Bid Studio from £495 | Basic includes relevancy scoring and expiring contracts |
| Tenderlake | £249 to £325 per month UK and Ireland; £396 to £546 Europe | AI search without keywords |
| Tenders Direct (Proactis) | From £1,359 per year | Alerts with a coverage guarantee, competitor tracker, training and bid services |
| Contracts Advance | £1,399, £2,099, £2,999 per year | Bid review at £750 per day |
| Tussell, Tracker | Demo only | Tussell states "over 300 companies" as customers |

- **FACT:** tender documents are not in the open data. In the week sample, submission links pointed to more than fifteen separate e-tendering systems (Delta, In-tend, EU-Supply, ProContract, Jaggaer, eTendersNI, Atamis, Sell2Wales and others), most behind a supplier login.
- **FACT:** the median notice carried about 850 characters of descriptive text, and 279 of 385 tender notices included award criteria.
- **INFERENCE:** an AI can score fit from the notice. It cannot judge the full requirement unless the customer uploads the tender pack.
- **UNKNOWN:** hours per week that a small supplier spends searching, and the value of missed contracts. I found no primary source and will not invent a figure.

**Evidence of willingness to pay.**
- **FACT:** seven vendors publish prices for this job, from £25 per month to £2,999 per year.
- Vendor claims, not verified: Stotles "3.5k+ teams who switched this year"; Tussell "over 300 companies".
- **UNKNOWN:** subscriber counts and churn for any vendor.

**The wedge for an unknown solo vendor.** Price is not available as a wedge; AI search already sells at £25. What is available:
- **Distribution.** A cold email that says "you won contract X from buyer Y in October; here are the live notices that resemble it and the competitor contracts in your trade ending in the next nine months", with a link to a page already built for that company.
- **Trade depth.** Pages and digests written per trade (typical accreditations, contract size the firm can carry, travel radius), starting with the largest trades.
- **The below-threshold view.** "Which buyers place small contracts in your trade without a tender, with whom, and when those end." **INFERENCE:** this is closer to how small suppliers actually win work than tender alerts are.

**Is any segment underserved?**
- **Small suppliers and below-threshold work:** not by price. The same feed, with 156 below-threshold tender notices and 509 below-threshold direct awards a week, reaches every vendor, and four of them charge £99 or less.
- **Specific trades:** Hudson covers six sectors at £60 to £95. Trades outside those six with visible flow are architecture and engineering (22 tender notices a week), repair and maintenance (16), education and training (15), medical equipment (13) and research (11). **INFERENCE:** these are gaps in packaging, not in data.
- **Buyer-relationship intelligence for micro firms:** this is the least-served job at a low price. Stotles sells buyer intent and decision-maker contacts from £475 per month; nothing I saw offers a "who buys small contracts in my trade without tendering" view for under £100.
- **Cross-border:** served at £396 to £546 (Tenderlake) and €160 per user (Hermix); demand from small firms is unverified.

**Onboarding and time to first value.**
- **INFERENCE:** a prospect can see relevant matches within a minute and without signup. Supplier pages can be pre-generated from award data, keyed by Companies House number, showing past awards, similar live notices and expiring competitor contracts.
- A firm with no award history would enter its website address and get matches from an LLM summary of the site.

**Exact data access.**
- Endpoint: `GET https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages` with `updatedFrom`, `updatedTo`, `stages` (planning, tender, award), `limit` (maximum 100) and `cursor`.
- Record packages: a companion OCDS record endpoint is listed on the developer page.
- Authentication: none. Format: OCDS 1.1.5 JSON.
- Licence: Open Government Licence v3.0, which allows commercial use with attribution and **does not cover personal data in the information**.
- Rate limit: undocumented. Observed HTTP 429 with `retry-after: 120` after about nine requests in quick succession; no 429 across 25 requests at one per nine seconds.
- Update frequency: continuous; the API filters on last-updated time.
- Historical depth: at least January 2021 (a call for 2021-01-11 returned notices). Supplier emails and SME flags were seen in notices under the Procurement Act 2023; I did not check whether older notices carry them.
- Contracts Finder: `GET https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?publishedFrom=...&publishedTo=...`, no key, same licence, no supplier emails. It carried only 111 releases on 2026-11-11, nine of them tender notices, so Find a Tender is now the main source.
- Scotland: Public Contracts Scotland has its own API; my call failed on a certificate error, so it is unverified.
- **What a one-day v1 could ingest:** five weeks of Find a Tender (about 125 requests, roughly 20 minutes at polite pacing) plus a daily increment of about five requests.
- **What a one-day v1 would show:** a public page per supplier (past awards, similar live notices, competitor contracts ending), a weekly email digest for one trade, and a Paddle checkout. Bid drafting and document handling come later.

**Data quality, from the week sample.**
- 2,427 releases covered 2,205 procurement processes; 184 processes had more than one release in the week, so updates must be merged.
- About 12% of supplier records had no identifier (243 of about 2,000), and 104 releases carried the procedure label "Below threshold - unknown".
- 13 contracts had a value under £100 and 16 a value of £100 million or more. These look like placeholders and framework ceilings and need filtering.
- Every tender notice had a CPV code; 309 of 385 had a delivery region; 12 had no value.
- **UNKNOWN:** how the SME flag is set and how reliable it is.

**Reaching the first buyers.**
- **FACT:** award data provides company name, address, Companies House number (in about half of supplier records), SME flag and an email address.
- Lawful route: email only incorporated suppliers (those with a Companies House number), prefer generic mailboxes, identify the sender, and include an opt-out.
- **INFERENCE:** using named-person addresses brings UK GDPR duties (legitimate-interest assessment, privacy notice, objection handling) and probably a UK representative for a controller based in Ukraine. This is not legal advice.
- Risks: a sole sender's domain reputation, and the trust gap of an unknown vendor abroad.

**SEO potential and incumbents' strength.**
- **FACT:** Stotles publishes sitemaps for notices (50,000 URLs), topics (6,984), searches (2,344), buyers (2,175) and suppliers (2,127). Tenderlake's main sitemap lists 35,787 URLs.
- **FACT:** Stotles' supplier pages are public without login and already carry an AI-written summary and the supplier's recent awards.
- **INFERENCE:** notice, topic and buyer pages are contested. Supplier profile pages exist at Stotles but cover about 2,000 firms, against roughly 1,000 SME suppliers appearing in award notices each week. The pre-built supplier page is therefore not novel as a page; what is unused is sending it to the supplier with matched live notices.
- **UNKNOWN:** bidstats.uk, which I recall as a free site with supplier pages, refused my request, so I could not check it.

**Retention and churn risk.**
- **FACT:** average new tender notices per week by CPV division over the five weeks: construction 62, health and social work 39, business services 31, architecture and engineering 22, cleaning and environmental 18, repair and maintenance 16, education and training 15, medical equipment 13, research 11, IT services 10, software 10.
- **INFERENCE:** after region and size filters, a typical subscriber sees a handful of relevant tenders a month. That is a volume the free official alert handles, and it is the main reason subscribers would leave.
- Mitigations inside the data: awards and end dates (1,516 a week), pipeline notices (214 a week, 145 with a future notice date), and below-threshold direct awards.

**Solo operability.** Two APIs, no scraping, low support load. The weak points are documents behind portals and email deliverability.

**LLM cost per customer.**
- Prices used: Claude Haiku 5.5 at $0.10 input and $0.50 output per million tokens; Claude Sonnet 5.5 at $2 and $10 (Anthropic first-party rates in the reference available to this session, cached 2026-11-03; batch processing is half price).
- **ASSUMPTION:** 1,500 input and 300 output tokens to classify a notice.
- Whole-corpus classification: 2,427 releases a week costs about $0.73 a week on Haiku 5.5.
- Per customer: scoring 200 candidate notices a month on Haiku 5.5 is about $0.06; twenty bid/no-bid briefs a month on Sonnet 5.5 (5,000 in, 1,000 out) is about $0.40.
- **INFERENCE:** well under $1 per customer per month.

**Price, ARPU and customers needed.**

| Monthly price | Customers for $10k MRR (about £7,540), before Paddle fees |
|---|---|
| £29 | 261 |
| £39 | 194 |
| £49 | 154 |
| £79 | 96 |
| £99 | 77 |

- Paddle takes 5% plus 50 cents, so add 6% to 7% to each count.
- **INFERENCE:** a realistic price is £39 to £79. Above £99 the product competes with Stotles Basic on a weaker brand.

**The single most dangerous assumption.** That award-data cold email turns unknown small firms into paying subscribers at a workable rate, and that they stay for most of a year despite few relevant notices and a free official alternative.

- **INFERENCE, pool arithmetic.** Five weeks produced 3,155 incorporated SME suppliers with email. If that pace holds with some saturation, a year yields very roughly 20,000 to 30,000. Getting 150 customers from that pool alone needs 0.5% to 0.75% of every firm emailed to become a paying subscriber.
- **INFERENCE, one trade is not enough.** Construction, the largest trade, produced 1,038 SME suppliers with email in five weeks, so perhaps 6,000 to 10,000 a year. One hundred customers from that pool needs 1% to 1.7% paid conversion. The product should be templated per trade and sold across several trades from the start.
- **UNKNOWN:** the real conversion rate. No source I could reach reports one.

### 3.2 UK: contract-win and contract-expiry signals for firms that do not bid (Pick 2)

- **Idea.** Each award names a supplier, a buyer, a value, dates and a contact email. Sell a filtered daily feed to firms that sell to contract winners rather than to the public body: recruiters (a win means hiring), plant hire, finance brokers, insurers.
- **FACT:** 1,516 award or contract releases, 631 distinct buyers and about 2,000 distinct suppliers in one week; median contract value £102k.
- **Overlap with Pick 1.** For subcontracting trades the same feed is a feature of the trade radar: "a large contractor just won work near you". That part needs no separate product.
- **ASSUMPTION:** firms outside the bidding world pay for such signals. I could not reach the one comparable tool I know (Talent Ticker, a signals product for recruiters) and found no price evidence.
- **Reaching buyers.** Recruiters, brokers and insurers are not in the award data. A prospect list would come from Companies House industry codes, which carry no email addresses (background knowledge), so each prospect's website would have to be read for a generic address.
- **INFERENCE:** the customer's use of supplier contact emails for their own marketing raises the same personal-data questions as the founder's, and Paddle's wording on lead products is a risk.
- **Price and count.** **ASSUMPTION:** £99 to £199 per month, so 38 to 77 customers.
- **Most dangerous assumption.** That anyone outside the bidding world wants this feed enough to pay monthly.
- **Why it ranks second.** It needs no data beyond Pick 1 and its buyers are used to paying for sales tools. Demand is still unverified.

### 3.3 UK: schools and colleges change radar for education suppliers (Pick 3)

**Idea.** A feed for sales teams that sell to education: changes in the open schools register, plus tenders, awards and contract end dates from education buyers.

**Data verified today.**
- **FACT:** "Get Information About Schools" publishes a full extract daily (files available from 11 September 2020). The extract has 135 columns, including head teacher name, telephone, website, trust and open date. There is no email column.
- **FACT, own comparison of the 13 October and 13 November 2026 extracts:** 27,192 open establishments; 280 changes of head teacher name; 31 newly open establishments; 55 changes of trust; 38 closures. October to November is outside the main September and January turnover points.
- **FACT:** in the week sample, buyers whose names mark them as education bodies published about 52 tender-stage releases and 169 award or contract releases (matched by name, so approximate). Over five weeks the figures were 195 and 854, from 226 distinct buyers.
- **FACT:** 147 of those 169 awards came from universities and colleges and only 22 from schools, trusts and other education bodies.
- **INFERENCE:** school purchasing barely shows up in Find a Tender. For suppliers to schools the product would rest on the schools register alone; the tender data mainly serves suppliers to universities and colleges.
- Licence: GOV.UK open data; I did not capture a licence line on the download page today, so treat OGL as background knowledge.

**Who pays and why.** Education suppliers (software, catering, cleaning, staffing, training, equipment). A new head teacher, a school joining a trust, a contract nearing its end and a new tender are standard reasons to make contact.

**Status quo.**
- **FACT:** Sprint Education sells an education contact database ("Campus") with email marketing and CRM tools, with pricing on request; its site lists a "Prospecting Hub" as coming soon.
- Generalists: Stotles and Tussell cover education buyers inside all-sector products. **FACT:** Tussell advertises contact details for over 80,000 public-sector decision-makers.
- **UNKNOWN:** prices of education data vendors, and whether any already sells change alerts.

**Reaching buyers.**
- **FACT:** the award-data list is thin. In the week sample 190 distinct suppliers won from education buyers, 159 with an email and 69 with an email and a Companies House number; 123 of the 190 were large firms. Over five weeks, 357 SME suppliers with email won from education buyers.
- The customer's own outreach to schools is their responsibility; school and trust addresses are corporate, not individual.

**Price and count.** **ASSUMPTION:** £79 to £149 per month, so 51 to 96 customers. **UNKNOWN:** the number of UK education suppliers with a sales function; I would not assume more than a few thousand.

**Most dangerous assumption.** That education suppliers will pay monthly for change alerts when they already buy contact databases.

**Why it ranks third.** The schools register is a clean daily source that general tender tools do not lead with, and the buyers have sales teams. Against that, willingness to pay is unverified, the two datasets cover different halves of the education market, and the prospect list is small.

### 3.4 EU-wide: TED

- **FACT:** `POST https://api.ted.europa.eu/v3/notices/search` needs no key. On 2026-11-11 TED published 3,378 notices: 1,544 contract notices and 1,381 award notices.
- **FACT:** in a sample of 250 award notices, 231 named the winner and 154 carried a winner email; winner size (micro, small, medium, large) and website are separate fields.
- **FACT:** competitors with public prices: Tenderlake Europe at £396 to £546 per month; Hermix at €160 per user per month; Nukema (France) at €39 to €199 per month, with competitor-win tracking advertised on its site. Tendium (Sweden) is sales-led.
- **INFERENCE:** the buyers are domestic firms who buy in their own language from local vendors. The largest buyer countries in the sample were Germany, Poland, Spain, France and Romania, and cold email is unlawful or unverified in most of them.
- **UNKNOWN:** the share of awards won cross-border. If it is small, as I recall, an English cross-border product has few buyers.
- **Free official alternative.** TED offers saved-search alerts to registered users (background knowledge).
- **Price and count.** **ASSUMPTION:** €79 per month, so about 115 customers.
- **Most dangerous assumption.** That firms will buy an English-language cross-border product from an unknown vendor instead of their national service.
- **FACT, Ireland:** in the week of 2 to 8 November 2026 TED carried 86 Irish contract notices and 125 Irish award notices; 74 of the award notices had winner emails, 160 distinct addresses in total.
- **Verdict.** Good data, wrong founder. It becomes interesting only as a later extension of Pick 1 to Ireland, where business email is lawful on an opt-out basis, or as a France-only product with a French-speaking partner.

### 3.5 Germany

- **FACT:** `GET https://oeffentlichevergabe.de/api/notice-exports?pubDay=YYYY-MM-DD&format=csv.zip` (also `ocds.zip`, `eforms.zip`) needs no key and returns all notices published that day. Data is available the following day. Licence: CC Zero.
- **FACT:** 1,206 notice versions on 2026-11-11: 731 contract notices and 390 award notices. Legal basis: 618 under EU directive 2014/24, 268 `de-vob`, 66 `de-vol`, 29 `de-uvgo`. National below-threshold notices are therefore present.
- **UNKNOWN:** what share of all German below-threshold tenders reaches this service.
- **UNKNOWN:** current prices of DTAD, ibau, Vergabe24 and evergabe; their pricing pages did not load or were not at the addresses I tried.
- **FACT:** cold email to businesses is unlawful without prior consent.
- **Price and count.** **ASSUMPTION:** €99 per month, so about 92 customers.
- **Most dangerous assumption.** That a founder without German can win German small firms through SEO and advertising alone.
- **Verdict.** Probably the richest tender market in Europe, with a clean CC0 feed, and closed to this founder: no lawful cold email, German-language sales, and incumbents with heavy category-and-region SEO (ibau's sitemap alone is about 250 KB of such pages).

### 3.6 USA: federal (SAM.gov) and state or local

- **FACT:** the Opportunities API needs a personal key. A non-federal user without a role in SAM.gov gets 10 requests per day; with a role, 1,000. Each request returns up to 1,000 records, but notice descriptions are separate calls.
- **FACT:** contact email and phone for registered entities are restricted to federal system accounts. The public data has contact names and postal addresses only.
- **FACT:** prices: CLEATUS $39 per user per month for data and $78 with AI (annual billing); HigherGov $500 per year for one user; GovTribe $1,900 per seat per year; GovDash is sales-led.
- **FACT:** HigherGov and GovTribe publish large programmatic sitemaps (awards, agencies, NAICS and PSC codes).
- **INFERENCE:** state and local bids are spread over thousands of portals, which is the scraping profile the brief rules out.
- **Price and count.** **ASSUMPTION:** $49 per month, so about 205 customers.
- **Most dangerous assumption.** That a vertical slice can beat CLEATUS at $39 and HigherGov at $500 a year.
- **Verdict.** Lawful cold email and a large market, but no email in the data, saturated SEO, and AI-native incumbents at $39.

### 3.7 Other countries, briefly

| Country | Data check today | Competitor price seen | Why it loses |
|---|---|---|---|
| France | BOAMP API reachable but unstable; 334 records dated 2026-11-12 | Nukema €39 to €199 per month | Cheap local incumbents; French-language sales |
| Netherlands | Not tested | Not found | Consent needed for business email |
| Poland | Not tested | Pricing page did not render | Background knowledge: consent rule since 2024; cheap local incumbents |
| Nordics | Not tested | Tendium is sales-led | Sweden has no central national database (background knowledge) |
| Canada | CanadaBuys CSV of new tender notices present, updated 2026-11-13 | Not found | Provinces and municipalities use separate commercial portals; strict anti-spam law (background knowledge) |
| Australia | AusTender OCDS API works, CC BY 3.0 AU, awards only | Australian Tenders A$67, A$99, A$145 per month | Supplier emails absent; states are separate |
| Ukraine | Prozorro public API works without a key | Not checked | Background knowledge: marketplaces give alerts free; low prices |

## 4. Candidate 2 — Grants and funding alerts

- **FACT:** `POST https://api.grants.gov/v1/api/search2` needs no key and showed 855 posted federal opportunities today.
- **FACT:** the EU Funding and Tenders portal search API (`https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA`) returned 1,188 open or forthcoming items.
- **FACT:** the UK "Find a grant" service is a search site; I saw no API on its home page.
- **FACT:** prices: Instrumentl $299, $499 and $999 per month on annual billing; Candid free tier, then $1,199 or $1,699 per year; GrantStation advertises $199 per year; Grantable has a free plan, then $50 and $150 per month; Granter (EU) sells an expert plan at €1,500 plus a 5% success fee.
- **INFERENCE:** the valuable US data is foundation giving, not the 855 federal notices, and incumbents already own it. Nonprofits and small firms have small budgets, and both official portals offer free notifications (background knowledge).
- **Outreach.** Award data names recipients but not contacts; I did not verify any email field.
- **Most dangerous assumption.** That anyone pays for alerts alone when Grantable is free and GrantStation is $199 a year.
- **Verdict.** Loses: cheap or free incumbents and low-budget buyers.

## 5. Candidate 3 — Building-permit and planning-application leads

- **FACT:** PlanIt, the one UK-wide planning aggregator with an API, describes itself as "a retirement hobby", says "it would not be wise to base any commercial services on the API", does not release the full dataset and strips names.
- **FACT:** the government planning data platform returned HTTP 503 today, so its coverage is unverified.
- **FACT:** Planning Pipe sells UK planning leads at £44.95 per month for two regions and £89.95 nationally, including client and architect contact details, with ten free leads.
- **FACT:** in the US, Shovels offers a free tier of 500 records a month and paid plans at $599 and $999 per month.
- **INFERENCE:** UK coverage needs scraping of several hundred council portals, which the brief rules out. US coverage needs a $599 licence before first revenue, from a vendor that also sells directly to end users.
- **UNKNOWN:** prices of Barbour ABI, Glenigan, Construction Monitor and BuildZoom (no public price or request refused).
- **Verdict.** Loses on data access, and the low end is already £45.

## 6. Candidates 4 to 8, briefly

### 6.1 Candidate 4 — Clinical-trial and FDA monitoring

- **FACT:** the ClinicalTrials.gov API v2 needs no key; 3,296 studies had an update posted between 10 and 12 November 2026.
- **FACT:** ClinicalTrials.gov serves a free RSS feed for any search (`/api/rss?cond=...&dateField=LastUpdatePostDate`).
- **FACT:** openFDA allows 240 requests per minute and 120,000 per day with a free key; data is CC0 and may be used commercially.
- **UNKNOWN:** prices of intelligence vendors; none loaded today.
- **Verdict.** Loses: free official alerts, buyers who expect analyst-grade curation, and no credibility for an unknown solo vendor.

### 6.2 Candidate 5 — Trademark watch

- **FACT:** the USPTO Open Data Portal states that data can be extracted "in one place for free".
- **FACT:** TM TKO sells unlimited searches and watches at $280 per month for a solo practice and cites $250 per watch per year from the two large vendors. Alt Legal docketing starts at $50 per month, with its watch as an add-on.
- **INFERENCE:** small IP firms are served at prices a new entrant cannot undercut meaningfully. Selling direct to brand owners means cold contact in a field known for scam solicitations, a trust problem (background knowledge).
- **Verdict.** Loses.

### 6.3 Candidate 6 — Court, insolvency and new-company alerts

- **FACT:** Companies House allows 600 API requests per five minutes and offers streaming endpoints for companies, filings, insolvency cases, charges, officers and persons with significant control, with at most two concurrent connections.
- **FACT:** The Gazette describes its data as free to reuse under the Open Government Licence; `https://www.thegazette.co.uk/insolvency/notice/data.json` returned a feed without a key (3.3 million insolvency notices in the archive).
- **FACT:** Endole includes unlimited monitoring alerts, daily newly formed company leads, unlimited credit reports and list building for £39 per user per month, or £25 on annual billing.
- **INFERENCE:** company-event alerts are commoditised. Personal insolvency notices are personal data and should not be used for marketing.
- **UNKNOWN:** German insolvency notices and US court dockets were not checked today; both involve access limits or fees (background knowledge).
- **Verdict.** Loses on price.

### 6.4 Candidate 7 — Product recalls and safety alerts

- **FACT:** the CPSC recall API needs no key and returned 62 recalls since 1 October 2026, about ten a week.
- **INFERENCE:** the volume is too low to sustain a subscription, and regulators send their own free email alerts (background knowledge).
- **Verdict.** Loses.

### 6.5 Candidate 8 — Licensing, food hygiene, fleet, charity and care registers

| Register | Verified today | Gap |
|---|---|---|
| Food hygiene ratings (FSA) | Free API, no key; 615,275 establishments awaiting inspection | Phone mostly empty, no email; many sole traders |
| Care Quality Commission | API with free authentication; Open Government Licence; updated daily | Buyer list not in the data |
| DVSA operator licences | Dataset on data.gov.uk, Open Government Licence, modified 2026-11-10 | Small market; competitors unknown |
| Register of licensed sponsors (Home Office) | CSV on GOV.UK, updated 2026-11-12, about 3,000 revisions since 2013 | No contacts; demand from immigration advisers is an assumption |
| Schools register | See section 3.3 | — |
| Local authority spend, liquor licences | Not tested | Hundreds of separate publishers |

- **INFERENCE:** each register supports a small "changes as sales triggers" product. Every one lacks either contact data or verified demand, and each needs its own buyer persona.
- **Verdict.** Not top picks. The schools register is the exception because it combines with tender data.

### 6.6 The same questions, answered briefly for the candidates that lose

| Question | Grants | Planning and permits | Trademark watch | Company and insolvency | Recalls | Clinical and FDA |
|---|---|---|---|---|---|---|
| Who pays | Nonprofit fundraisers, small firms, consultants | Contractors and building suppliers | Small IP firms, brand owners | Credit controllers, B2B sales teams | Importers, online sellers | Biotech intelligence staff, investors |
| Trigger | New call, deadline | New application or permit nearby | Conflicting filing | Insolvency event, new company | Recall in own category | Trial status change, FDA action |
| Cheapest credible incumbent | Grantable free; GrantStation $199 a year | Planning Pipe £44.95 a month | Alt Legal from $50 a month | Endole £25 per user a month | Free regulator emails (background) | Free official RSS |
| Data access | Two APIs, no key | UK scraping; US $599 licence | USPTO free; EU and UK offices not checked | Free API and feed | Free API | Free APIs |
| Prospect list with lawful email | Not in the data | Names on council portals only | US owners, but scam stigma | No emails in the data | None | None |
| Retention | Seasonal | Good if leads convert | Good | Good | Poor, about ten events a week | Good in enterprise only |
| Customers for $10k MRR at the incumbent's price level | 205 at $49 | 168 at £45 | 200 at $50 | 302 at £25 | Not applicable | Not applicable |
| Most dangerous assumption | Anyone pays for alerts alone | Scraping stays feasible and lawful | Owners answer cold contact | Anyone switches from a £25 bundle | Anyone pays | A solo vendor is trusted |

## 7. Candidate 9 — Other niches found

- **Ukraine reconstruction and Prozorro tenders in English for foreign suppliers.** FACT: the Prozorro API is open. INFERENCE: the founder's languages are an advantage. UNKNOWN: demand and incumbent prices (the DevelopmentAid and UN pages did not load). Speculative.
- **Tariff-change alerts per commodity code.** FACT: the UK Trade Tariff API answers without a key. UNKNOWN: competitors and willingness to pay. Not assessed further.
- **Free alerts with a paid AI bid tool on top.** INFERENCE: because the LLM cost is under $1 per user per month, the alert itself could be given away to build an audience, charging for bid/no-bid briefs and draft answers. Stotles prices that layer at £495 per month. This is a monetisation option for Pick 1, not a separate candidate.

## 8. Ranking

| Rank | Candidate | Proof that buyers pay | Data access | Prospect list and lawful email | Competition and free substitutes | Fit for this founder |
|---|---|---|---|---|---|---|
| 1 | UK public-contract radar for small suppliers, trade by trade | Strong | Strong | Strong: 4,906 SME suppliers with email in five weeks | Heavy | Good |
| 2 | UK contract-win and expiry signals for non-bidders | Unverified | Strong | Weak: prospects are not in the data | Low to medium | Good |
| 3 | UK schools and colleges change radar | Unverified | Strong | Thin: about 190 suppliers a week | Medium | Good |
| 4 | EU TED cross-border radar | Medium | Strong | Patchy | Heavy | Weak |
| 5 | US federal vertical alerts | Strong | Medium | Lawful but no emails | Very heavy | Weak |
| 6 | Germany tender alerts | Strong (background) | Strong | Unlawful | Heavy | Poor |
| 7 | Company and insolvency alerts | Strong | Strong | Weak: no emails in the data | Commoditised | Poor |
| 8 | Grants alerts | Medium | Strong | Weak | Heavy, free tiers | Poor |
| 9 | Planning and permit leads | Strong | Poor | Weak | Cheap incumbents | Poor |
| 10 | Trademark watch | Medium | Strong | Trust problem | Heavy | Poor |
| 11 | Register-change niches | Unverified | Strong | Weak | Unknown | Uncertain |
| 12 | Recalls and safety alerts | Weak | Strong | Weak | Free official alerts | Poor |
| 13 | Clinical-trial and FDA monitoring | Enterprise only | Strong | Weak | Free official feed | Poor |

## 9. Verdict on the best two or three

**Build one pipeline on the Find a Tender API and test three wedges on it.**

- **Why this and not the others.** It is the only place where the open data itself contains the prospect list with email addresses (82% of supplier records), the personalised hook (the firm's own recent award), a lawful channel (incorporated UK companies), and published proof that small firms pay.
- **Why it may still fail.**
  - The market already offers AI alerts at £25 to £99 and free official notifications.
  - Relevant notices per subscriber are few, by measurement.
  - Tender documents sit behind portals, which limits what the AI can qualify.
  - The whole plan rests on cold-email conversion that nobody has measured.
  - It depends on one government API. Supplier emails are public today; if they attract abuse, the Cabinet Office could remove them from the feed.
  - Spam complaints could reach the ICO or Paddle.
- **Which wedge first.** The trade radar (Pick 1), because willingness to pay is proven. Construction has the largest flow (about 62 tender notices a week and 1,038 SME winners with email in five weeks), followed by health and social care and business services. Suppliers to local government are over 40% of the pool (2,100 of 4,906). The signals variant and the education variant reuse the data and can be tested with a few hundred emails each.
- **What would falsify it quickly.** Send 300 to 500 award-based emails per wedge with a pre-built page. If almost nobody opens their page, or page visitors do not start a trial, the channel assumption is wrong and no amount of product work fixes it.

**Why the remaining candidates lose.**
- Germany, Netherlands and most of the EU: cold email is unlawful or unverified, and sales need the local language.
- USA federal: no emails in public data, incumbents at $39 per month, saturated SEO.
- Company, insolvency and new-company alerts: bundled at £25 to £39 per user.
- Grants: free and near-free incumbents; small budgets.
- Planning and permits: scraping or a $599 licence; a £45 incumbent.
- Trademark, recalls, clinical trials: free official alerts, entrenched specialists or a trust barrier.

## 10. What I could not verify

- Churn, complaints and reviews for any tender-alert vendor (no search; review site refused).
- Hours per week and missed-contract cost for small suppliers.
- Whether Stotles still has a free plan. Its pricing page shows none; an earlier search snippet mentioned one.
- bidstats.uk coverage and pricing (request refused).
- Documented rate limits of the Find a Tender API (only observed behaviour).
- Public Contracts Scotland API (certificate error).
- TED's own legal notice (page would not load); the licence comes from data.europa.eu metadata.
- German, Polish and most French competitor prices; licence of BOAMP and Prozorro data.
- US, Polish, Canadian and Australian email rules (background knowledge only today).
- Free saved-search alerts on TED, SAM.gov, grants.gov and the EU funding portal (background knowledge; only the UK one was read today).
- Any demand evidence for the education radar, the signals feed, register-change niches, tariff alerts or the Ukraine reconstruction idea.
- New AI entrants from 2024 to 2026 beyond those whose sites I could open (Stotles, Tenderlake, Tenderbase, Tracker's AI summaries, CLEATUS, GovDash, Hermix, Tendium, Nukema, Grantable, Granter).

## 11. Source log

All pages fetched and all API calls made on 2026-11-13.

| Source | What it supports |
|---|---|
| https://www.find-tender.service.gov.uk/Developer/Documentation | Open Government Licence; OCDS 1.1.5; API and XML downloads |
| https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages | Endpoint parameters; limit of 100; OGL in response sample |
| https://www.find-tender.service.gov.uk/Search | Free saved searches and email notifications |
| https://www.contractsfinder.service.gov.uk/apidocumentation | OCDS search endpoint for Contracts Finder |
| https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ | Commercial use allowed; personal data not covered |
| https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/ | Corporate-subscriber rule; UK GDPR for named contacts |
| https://www.gesetze-im-internet.de/uwg_2004/__7.html | German consent rule for email advertising |
| https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique | French business opt-out rule; generic addresses |
| https://wetten.overheid.nl/BWBR0009950/2026-08-15/ (art. 11.7) | Dutch consent rule including legal persons |
| https://www.irishstatutebook.ie/eli/2011/si/336/made/en/print | Irish rule on unsolicited email, regulation 13 |
| https://www.find-tender.service.gov.uk/search/commercial-tools | Official "Summarised Search" with CSV export and saved searches |
| https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle | Ukraine supported except five regions |
| https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle | Prohibited categories; updated 13 April 2026 |
| https://www.paddle.com/pricing | 5% plus 50 cents |
| https://www.stotles.com/pricing and /competitors and /sitemap-index.xml | Stotles prices, positioning, programmatic pages |
| https://www.supply2govtenders.co.uk/pricing/ | Supply2Gov prices |
| https://tenderbase.co.uk/pricing | Tenderbase prices; document retrieval add-on |
| https://www.tenderconsultants.co.uk/discover-tendering-opportunities/ | Sector portals and prices |
| https://www.tenderlake.com/pricing and /sitemap_main.xml | Tenderlake prices; 35,787 URLs |
| https://www.tendersdirect.co.uk/pricing/ | From £1,359 per year |
| https://contractsadvance.co.uk/pricing/ | Contracts Advance prices |
| https://www.tussell.com/plans and https://www.tussell.com/ | Demo-only; customer and contact claims |
| https://www.trackerintelligence.com/plans/ | No public price; AI summaries |
| https://docs.ted.europa.eu/api/latest/index.html and /search.html | Anonymous search API |
| https://data.europa.eu/api/hub/search/datasets/ted-csv | TED licence metadata |
| https://oeffentlichevergabe.de/documentation/api/opendata and the portal's Open Data policy text | German API and CC Zero licence |
| https://open.gsa.gov/api/get-opportunities-public-api/ and /api/entity-api/ | SAM.gov key, rate limits, restricted contact fields |
| https://www.highergov.com/pricing/ ; https://govtribe.com/plans ; https://www.cleat.ai/pricing ; https://www.govdash.com/pricing | US prices |
| https://hermix.com/pricing/ ; https://tendium.com/pricing ; https://accueil.nukema.com/ ; https://www.australiantenders.com.au/pricing/ | Other tender prices |
| https://www.instrumentl.com/pricing ; https://candid.org/pricing/ ; https://grantable.co/pricing ; https://granter.ai/pricing ; https://grantstation.com | Grant tool prices |
| https://www.planit.org.uk/api/ and /faq/ ; https://www.planningpipe.co.uk/ ; https://www.shovels.ai/pricing | Planning and permit data and prices |
| https://open.fda.gov/apis/authentication/ and /terms/ | openFDA limits and CC0 |
| https://data.uspto.gov/home ; https://www.tmtko.com/pricing ; https://www.altlegal.com/pricing/ | Trademark data and prices |
| https://developer-specs.company-information.service.gov.uk/guides/rateLimiting and /streaming-api/guides/overview | Companies House limits and streams |
| https://www.thegazette.co.uk/data | Gazette reuse terms |
| https://www.endole.co.uk/pricing/ | Endole prices |
| https://api.ratings.food.gov.uk/help ; https://www.cqc.org.uk/about-us/transparency/using-cqc-data | Food hygiene and CQC data terms |
| https://get-information-schools.service.gov.uk/Downloads | Daily schools extract |
| https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers | Sponsor register updates |
| https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml | Exchange rates of 2026-11-12 |

## 12. Own measurements, repeatable

- **Find a Tender, one day.** `updatedFrom=2026-11-11T00:00:00&updatedTo=2026-11-11T23:59:59&limit=100`, five pages, 445 releases.
- **Find a Tender, one week.** Same call for 2026-11-02 to 2026-11-08, 25 pages, 2,427 releases. Supplier counts use the `parties` entries with role `supplier`; SME means `details.scale = sme`; email means `contactPoint.email`.
- **Find a Tender, five weeks.** The same call for 2026-10-05 to 2026-11-01 (95 pages, 9,414 releases) added to the week above, 11,841 releases in all. Weeks are assigned by release date (ISO weeks 41 to 45). Suppliers are de-duplicated by identifier, or by name where no identifier exists, so week counts differ slightly from the single-week table.
- **Contracts Finder.** `Published/Notices/OCDS/Search?publishedFrom=2026-11-11T00:00:00&publishedTo=2026-11-11T23:59:59&limit=100`, two pages, 111 releases: 94 awards and 9 tender notices. In the first 100 releases there were 94 supplier parties, none with email.
- **TED.** Query `publication-date=20261111 AND notice-type=can-standard`, first 250 of 1,381 results, with fields `winner-name`, `winner-email`, `winner-size`.
- **Germany.** `notice-exports?pubDay=2026-11-11&format=csv.zip`; counts from `notice.csv` and `organisation.csv`.
- **Schools.** Daily extracts `edubasealldata20261013.csv` and `edubasealldata20261113.csv`, compared by URN.
- **Generic-mailbox count.** Addresses whose local part starts with words such as info, sales, enquiries, admin, office, tenders, bids or accounts. This is a rough classifier.
