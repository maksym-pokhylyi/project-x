# P2 — UK public-sector supplier outreach: legality, safeguards, deliverability

**Prepared:** 2026-11-13 · **Scope:** Ukraine-based sole proprietor (FOP), no UK/EU establishment, cold B2B email to UK suppliers named in Find a Tender (FTS) award notices, one public page per supplier company, payments via Paddle.
**Status:** research briefing, **not legal advice**. Written so that a UK data-protection solicitor can confirm or correct it in about an hour.

**Evidence labels used throughout**

| Label | Meaning |
|---|---|
| **FACT** | Read in a primary source during this session (URL and quote given; fetch date 2026-11-13 unless stated) |
| **INFERENCE** | My reasoning from the facts; a lawyer could disagree |
| **ASSUMPTION** | Taken from the brief, from industry practice, or from memory — not verified in a primary source this session |
| **UNKNOWN** | Could not be established; needs a lawyer, the regulator, or the vendor |

Source IDs in square brackets (e.g. [S3]) refer to the source list in section 11.

---

## 0. Verdict

**The plan is lawful in the UK only for a subset of the weekly list, and only with the conditions below. As written ("about 1,000 SME suppliers per week") it is not lawful, because roughly 40% of the list cannot be shown to be corporate subscribers.**

| Segment of the weekly list | Share (from brief) | Cold email lawful? | Why |
|---|---|---|---|
| Incorporated supplier (verified Ltd / PLC / LLP / CIC / registered society / Scottish partnership) + address on the company's own domain, generic mailbox (info@, tenders@) | part of the ~60% | **Yes** | PECR reg. 22 does not apply to corporate subscribers; no named person, so UK GDPR does not apply to the address [S1][S3] |
| Same, but address identifies a person (jane.smith@company.co.uk) | part of the ~60% | **Yes, with UK GDPR duties** | PECR allows it; the address is personal data, so legitimate-interests assessment, Art. 14 notice in the first email, absolute right to object [S3][S7][S9] |
| No Companies House number (sole traders, ordinary partnerships, unverified) | ~40% | **No** — do not email | Individual subscribers under PECR: consent or soft opt-in required; neither exists. ICO: if unsure, treat as individual [S1][S3] |
| Any supplier, address at Gmail / Hotmail / Outlook.com / Yahoo / BT Internet / iCloud etc. | unknown | **No** — do not email | The subscriber for a personal webmail account is the individual; ICO treats a personal address used for work as an individual subscriber [S3] |
| English/Welsh/NI limited partnerships (`LP` / `NL` numbers) | small | **No** unless a lawyer clears it | They have a Companies House number but are not legal persons — a trap for the "has a CH number" test (INFERENCE, see 1.3) |

**Conditions that make the lawful subset safe to run**

1. Send only to verified corporate subscribers on corporate domains (section 1.3).
2. Every email: real sender identity, a working opt-out address, obviously commercial, honest subject (section 7).
3. For named-person addresses: a written legitimate-interests assessment, an Art. 14 privacy notice linked in the first email, the right to object stated clearly and separately, and first contact **within one month** of taking the address into the database (section 2).
4. A suppression list that is checked before every send and never deleted (section 2.6).
5. Appoint a **UK representative** before launch (section 3) — the "occasional processing" exemption does not plausibly fit a weekly, core acquisition process.
6. No named contacts or email addresses on the public pages; OGL attribution; no look or wording that suggests an official service (section 4).
7. No phone outreach of any kind, by anyone, ever — it breaches Paddle's seller terms regardless of legality (section 5).
8. Volume capped at about 20–30 cold emails per mailbox per day on a separate sending domain (section 6).

**Three things that are unwise even though lawful**

- Emailing all ~1,000 a week. The lawful, deliverable volume is nearer **350–500 first-touch emails a week**.
- Using open-tracking pixels. They fall under PECR's separate storage/access (cookie) rules, which apply to every subscriber type [S6]; they also hurt deliverability. Turn them off.
- Indexing thousands of auto-generated supplier pages on day one (section 4.5).

---

## 1. PECR — the email-marketing rule

### 1.1 The exact rule

**FACT** — Reg. 22 applies only to individual subscribers. *"22.—(1) This regulation applies to the transmission of unsolicited communications by means of electronic mail to individual subscribers."* Para. (2) then prohibits unsolicited direct-marketing email *"unless the recipient of the electronic mail has previously notified the sender that he consents for the time being to such communications being sent by, or at the instigation of, the sender"*, subject to the soft opt-in in para. (3) (details obtained *"in the course of the sale or negotiations for the sale of a product or service to that recipient"*, similar products only, opt-out offered at collection and in each message). [S1]

**FACT** — Definitions (reg. 2): *"'corporate subscriber' means a subscriber who is— (a) a company within the meaning of section 735(1) of the Companies Act 1985; (b) a company incorporated in pursuance of a royal charter or letters patent; (c) a partnership in Scotland; (d) a corporation sole; or (e) any other body corporate or entity which is a legal person distinct from its members"*; *"'individual' means a living individual and includes an unincorporated body of such individuals"*; *"'subscriber' means a person who is a party to a contract with a provider of public electronic communications services for the supply of such services"*. [S2]

**FACT** — ICO reading: *"The PECR rule on direct marketing by electronic mail does not apply to corporate subscribers. For example, this means you can send B2B direct marketing emails or texts to any corporate body. You do not need their consent under PECR to send such messages."* And: *"sole traders and other types of partnerships are classed as 'individual subscribers' and PECR treats them the same as individuals."* [S3]

**FACT** — The soft opt-in cannot rescue cold outreach: it *"does not apply to prospective customers or new contacts (eg from bought-in lists)."* [S4]

**FACT** — Public availability is not consent: *"Just because someone's contact details are publicly available, it doesn't mean they've consented to your direct marketing. Remember, you must have consent or meet the requirements of a soft opt-in to send unsolicited electronic mail marketing to individual subscribers. This includes sole traders and ordinary partnerships."* [S5]

**FACT** — A generic mailbox does not take a sole trader outside PECR: *"The rules are not limited to messages involving personal information. They apply even if you only hold a generic or role-based address."* [S6a] So `info@` at a sole trader is still an individual subscriber.

### 1.2 Obligations that still apply to every B2B marketing email

**FACT** — Reg. 23 applies to all recipients: no direct-marketing email *"(a) where the identity of the person on whose behalf the communication has been sent has been disguised or concealed; (b) where a valid address to which the recipient of the communication may send a request that such communications cease has not been provided; (c) where that electronic mail would contravene regulation 7 of the Electronic Commerce (EC Directive) Regulations 2002; or (d) where that electronic mail encourages recipients to visit websites which contravene that regulation."* [S1b]

**FACT** — E-Commerce Regs 2002 reg. 7 (pulled in by reg. 23(c)): a commercial communication must *"(a) be clearly identifiable as a commercial communication; (b) clearly identify the person on whose behalf the commercial communication is made"*. Reg. 8: an unsolicited commercial email must be *"clearly and unambiguously identifiable as such as soon as it is received."* [S10]

**FACT** — Opt-outs from companies: *"PECR does not say that you must comply with a corporate subscriber's opt-out in the context of electronic mail. However … you should comply with a corporate subscriber's opt-out request."* Where the address is personal data the objection is binding under UK GDPR (section 2.5). [S3]

**FACT** — Suppression: *"you should add the business or business contact's details onto your 'do not contact' or suppression list instead of simply deleting all record of them."* [S3]

**FACT** — Tracking pixels: *"Tracking pixels are covered by PECR's separate rules on storage and access technologies. If the email includes tracking pixels, you must comply with the rules on storage and access technologies."* [S6] The B2B guide adds that those rules *"apply to all types of subscriber."* [S3] **INFERENCE:** open-tracking pixels in cold email need consent you do not have; disable them. Counting clicks server-side when the recipient visits the page does not store or read anything on their device, so it is outside that rule (it is still personal data if the link token identifies a person).

### 1.3 Telling corporate from individual subscribers in practice

**FACT** — ICO fallback rule: *"If you are unsure whether the contact details belong to an individual subscriber or a corporate subscriber this puts you at risk of breaching PECR. To mitigate that risk you should treat the details as belonging to an individual subscriber."* [S3]

**FACT** — A work contact who uses a personal address is an individual subscriber: in the ICO's conference example the organiser *"would breach PECR"* for delegates who were sole traders or who *"chose to use their personal email address instead of their work one."* [S3]

Recommended gate — all four must pass, otherwise suppress (**INFERENCE** from the definitions above):

| # | Test | Pass condition |
|---|---|---|
| 1 | Legal form | The notice carries a Companies House number **and** a live lookup returns an active entity of a type with legal personality: private/public limited company, LLP, CIC, registered society, royal-charter body, Scottish partnership / Scottish LP |
| 2 | Name match | Supplier name in the notice matches the registered name (suffix Ltd / Limited / PLC / LLP / CIC / Cyf). A suffix alone is not proof — a sole trader can wrongly style itself "Ltd" — so the register is the test, the suffix a cross-check |
| 3 | Domain | Address is on a domain the company controls (matches its website); **not** a consumer webmail or ISP domain |
| 4 | Suppression | Neither the address nor the company domain is on the suppression list |

Caveats:

- **FACT** — Companies House number prefixes indicate the entity type. From the Companies House URI customer guide: `LP` *"Limited Partnership for England & Wales"*, `OC` *"Limited Liability Partnership for England & Wales"*, `SL` *"Limited Partnership for Scotland"*, `SO` *"Limited Liability Partnership for Scotland"*, `SC` *"Scottish Company"*, `NL` *"Limited Partnership for Northern Ireland"*, `NC` *"Limited Liability Partnership for Northern Ireland"*, `NI` *"Northern Ireland Company (post partition)"*, `FC` *"Overseas Company"*, `IP`/`SP`/`NP` industrial & provident societies, `RC`/`SR`/`NR` royal charter companies. [S37] The guide is dated (2012); newer prefixes such as `CE`/`CS` (charitable incorporated organisations) and `RS` (registered societies) are **ASSUMPTION** from memory.
- **INFERENCE** — English, Welsh and Northern Irish limited partnerships (`LP`, `NL`) are not legal persons separate from their partners, so treat them as individual subscribers even though they have a Companies House number. Scottish partnerships and Scottish LPs (`SL`) are expressly corporate subscribers (reg. 2(c)). A lawyer should confirm the LP point.
- Bodies with legal personality but no Companies House number exist (universities, NHS trusts, some charities and co-operatives, overseas companies). They are corporate subscribers under limb (e), but need manual verification. Leave them out at launch.
- **ASSUMPTION (from the brief; I did not call the API):** FTS OCDS award data carries supplier identifiers (e.g. scheme `GB-COH`) and a contact email. Under the Procurement Act 2023 regime suppliers also have a platform identifier (PPON); only a Companies House identifier answers the PECR question.

**Sizing (INFERENCE from the brief's numbers):** 1,000/week × 60% with a CH number = 600; minus webmail addresses, dissolved or mismatched entities and LPs, expect **roughly 400–500 sendable companies a week**, about half on generic mailboxes and half on named addresses.

### 1.4 What the Data (Use and Access) Act 2025 changed in PECR, and commencement status

All of the following were checked on legislation.gov.uk on 2026-11-13.

| Change | Status in Nov 2026 | Source |
|---|---|---|
| PECR enforcement moved onto the Data Protection Act 2018 machinery (information, assessment, interview, enforcement and penalty notices). New reg. 31 and Schedule 1 | **In force 5 Feb 2026** — *"S. 115 in force at 5.2.2026 in so far as not already in force by S.I. 2026/82, reg. 2(y)"*; *"Sch. 13 in force at 5.2.2026 by S.I. 2026/82, reg. 2(z14)"* | **FACT** [S11][S12][S13] |
| Maximum fine for breaching regs 22 or 23 raised to the UK GDPR **higher maximum** (previous cap £500,000 — ASSUMPTION from memory): s. 157 applied as if it listed *"regulation 5, 6, 7, 8, 14, 19, 20, 21, 21A, 21B, 22, 23 or 24"*; higher maximum is *"£17,500,000 or 4% of the undertaking's total annual worldwide turnover in the preceding financial year, whichever is higher"* | **In force 5 Feb 2026**, for breaches on or after that date: *"Where any act or omission constituting a breach of the PEC Regulations occurred on or after 5th February 2026, any enforcement action … must be taken under those Regulations as amended"* | **FACT** [S12][S13][S14] |
| Personal penalty notices for officers of a body for breaches of regs 19–24 (consent, connivance or neglect) | In force 5 Feb 2026 (Sch. 13 para. 15). For a sole proprietor liability is personal anyway | **FACT** [S12] |
| Charity soft opt-in (new reg. 22(3A)) | In force 5 Feb 2026. Not relevant to this business | **FACT** [S1] |
| Statutory definition of "direct marketing" added to PECR | ICO notes it took effect 20 Aug 2025 | **FACT** [S6] |
| New consent exemptions for some storage/access technologies (Sch. 12) | In force 5 Feb 2026. **UNKNOWN** whether any exemption covers email open-tracking; assume not | **FACT** (commencement) [S13] |
| Information Commissioner's Office replaced by the **Information Commission** (functions transferred) | **In force 30 Sep 2026** — S.I. 2026/1015 reg. 2: *"section 118 (abolition of the office of Information Commissioner); section 119 (transfer of functions to the Information Commission)"*. The brand "ICO" is still used on ico.org.uk | **FACT** [S15] |

**FACT** — ICO on its new powers (page updated 19 June 2026): *"the law has commenced and we can, and will, use these powers where necessary for the most serious cases."* The same page confirms *"all data protection provisions in the Data (Use and Access) Act 2025 are now in force."* [S16]

**FACT** — The ICO's B2B marketing guide and Guide to PECR still carry the banner *"Due to changes made by the Data (Use and Access) Act, this guidance is under review and may be subject to change."* The corporate/individual subscriber rule itself was not changed by the Act (reg. 22(1) is unamended). [S1][S3]

**UNKNOWN** — PECR has no express territorial clause and the ICO guidance I read does not address senders outside the UK. Treat PECR as applying to marketing sent to UK subscribers. Practical enforcement against a Ukrainian sole proprietor is hard, but that is not the constraint that matters: Paddle's contract (section 5), the mailbox providers (section 6) and UK customers' own due diligence all bite directly.

---

## 2. UK GDPR — the email addresses

### 2.1 When a work email is personal data

**FACT** — *"you will be processing personal data if: you have the name and number of a business contact on file; or the email address you are using to communicate with the business identifies an individual (eg firstname.lastname@company…)."* And: *"If you do not know the name of the person you are sending direct marketing to at a business, then you are not processing personal data and the UK GDPR does not apply to your marketing. For example, if you are sending … by email to 'info@…'."* [S3]

**INFERENCE** — Three practical consequences:

1. `info@`, `tenders@`, `bids@`, `sales@` at a company: outside UK GDPR **as long as you do not store a contact name next to it**. If the notice also gives a contact name, either drop the name field at ingestion or treat the record as personal data.
2. `j.smith@`, `jane@`, `jsmith@`: personal data. Treat every non-role local part as personal.
3. Anything about a sole trader is personal data (the business is the person) — one more reason to exclude them.

### 2.2 Lawful basis: legitimate interests

**FACT** — UK GDPR Art. 6(11), inserted by the 2025 Act (s. 70, in force 5 Feb 2026): *"examples of types of processing that may be processing that is necessary for the purposes of a legitimate interest include— (a) processing that is necessary for the purposes of direct marketing"*. [S7][S13]

**FACT** — ICO: *"This means that direct marketing 'may' be a legitimate interest. However, the UK GDPR doesn't say that direct marketing always constitutes a legitimate interest… You must still show that your use of the information passes the necessity and balancing tests."* Its table marks *"Emails/text messages to business contacts ✔"* as a case where legitimate interests is likely to be appropriate, and adds: *"Business contacts are more likely to reasonably expect you to use their personal information in a business context. Such use is less likely to have a significant impact on them personally."* [S8]

**FACT** — Where PECR requires consent, legitimate interests is unavailable: *"If PECR require consent, you must not use legitimate interests as your lawful basis."* [S8] This is the second reason sole traders are out.

### 2.3 What the legitimate-interests assessment (LIA) must cover

**FACT** — Three-part test: *"identify a legitimate interest; show that the processing is necessary to achieve it; and balance it against the individual's interests, rights and freedoms."* For marketing, *"focus your balancing test primarily on your own interests"*; consider *"whether people would reasonably expect you to use their details in this way; the potential nuisance caused by unwanted direct marketing messages"*; and give *"a clear choice to opt out … when you communicate with them for the first time (if you didn't collect the details directly from them)."* [S8]

Suggested LIA outline (**INFERENCE**; two to three pages, dated, signed, reviewed every six months):

| Part | Content for this project |
|---|---|
| Purpose | Acquire customers for a tender-intelligence SaaS by telling an incorporated supplier that a page about its own public awards and matching live tenders exists |
| Necessity | Why email (the only contact channel in the notice); why this person (the contact the supplier itself gave for the contract); why not less data (name is not stored; only address, company, notice ID); why not ads or post |
| Source and expectations | Address published in a statutory procurement notice for contract purposes, not for marketing. Counterweight: recipient is acting in a business capacity; content concerns their own contracts and their line of work; one message plus at most two follow-ups |
| Impact | Low: no special-category data, no profiling of individuals, no sharing or sale, no public display of the person |
| Safeguards | Corporate-only gate; webmail excluded; Art. 14 notice in first email; one-click opt-out plus reply opt-out; suppression list; 90-day deletion of non-responders; no pixels; removal form for pages |
| Outcome | Balance favours sending for corporate subscribers; does **not** extend to sole traders, partnerships or personal addresses |
| Review trigger | Complaint rate, any ICO contact, change of source data or of message type |

### 2.4 Article 14 notice (data not obtained from the person)

**FACT** — Timing (Art. 14(3)): *"(a) within a reasonable period after obtaining the personal data, but at the latest within one month…; (b) if the personal data are to be used for communication with the data subject, at the latest at the time of the first communication to that data subject"*. [S9]

**FACT** — ICO: *"Bear in mind that the one month time limit still applies in these situations."* [S17]

**INFERENCE (operationally important):** do not warehouse named-person addresses. Ingest a week's notices and send the first email within days — in all cases inside one month of ingestion. For older notices, extract the personal address only when it is about to be used.

**FACT** — Content (Art. 14(1)–(2)), including two additions made by the 2025 Act: identity and contact details of the controller *"and, where applicable, of the controller's representative"*; purposes and legal basis; categories of data; recipients; third-country transfers and safeguards; storage period; the legitimate interests pursued; rights of access, rectification, erasure, restriction and objection; *"(da) the right to make a complaint to the controller (see section 164A of the 2018 Act)"* (in force 19 June 2026); the right to complain to the Commission; *"(f) from which source the personal data originate, and if applicable, whether it came from publicly accessible sources"*; any automated decision-making. [S9]

**FACT** — A web page alone is not enough: *"you must proactively make individuals aware of this information and you need to give them an easy way to access it. Simply putting it on your website, in case people happen to look there, is not enough."* [S17] **INFERENCE:** a short layered notice in the first email (who, why, source, right to object) plus a link to the full notice meets this.

**FACT** — New complaints duty (DPA 2018 s. 164A, in force 19 June 2026): the controller *"must facilitate the making of complaints … by taking steps such as providing a complaint form which can be completed electronically"*, *"acknowledge receipt of the complaint within the period of 30 days"*, and respond *"without undue delay"*. [S18]

### 2.5 Right to object

**FACT** — Art. 21(2)–(4): *"Where personal data are processed for direct marketing purposes, the data subject shall have the right to object at any time…"*; *"Where the data subject objects to processing for direct marketing purposes, the personal data shall no longer be processed for such purposes."*; *"At the latest at the time of the first communication with the data subject, the right … shall be explicitly brought to the attention of the data subject and shall be presented clearly and separately from any other information."* [S19]

**FACT** — ICO: *"This right is absolute and there are no grounds for you to refuse."* [S3]

### 2.6 Retention and suppression

**FACT** — Art. 14(2)(a) requires the notice to state *"the period for which the personal data will be stored, or if that is not possible, the criteria used to determine that period"*. No statutory period exists. [S9]

Suggested rule (**INFERENCE**):

| Record | Keep for |
|---|---|
| Named-person address, no reply | Delete 90 days after the last email sent |
| Named-person address, replied / became a lead | Life of the relationship + 12 months |
| Opt-out / objection | Suppression list, indefinitely, minimum data only (address or its hash, domain, date, reason) |
| Hard bounce | Suppression list, indefinitely |
| Send log (who, when, which template, which notice ID) | 24 months, as evidence of compliance |

### 2.7 Does the OGL's personal-data exclusion block this use?

**FACT** — OGL v3.0, "Exemptions": *"This licence does not cover: personal data in the Information"*. [S20]

**FACT** — The National Archives (licensor's guidance): *"The OGL does not cover the use of personal data. Anyone re-using personal data must comply with the Data Protection Principles set out in Article 5 of the UK GDPR."* [S21]

**INFERENCE** — The exclusion does not prohibit use; it means the licence grants no copyright or database-right permission in respect of personal data, and data-protection law governs instead. An email address is a fact, not a copyright work, so the practical question is UK GDPR compliance, which sections 2.1–2.6 address. Residual point for the lawyer: whether systematic extraction of the personal-data fields could engage Crown database right outside the licence (I rate this low, and found no guidance on it — **UNKNOWN**).

**FACT** — Purpose of the source: the Cabinet Office publishes FTS data to meet *"the obligation … to provide an online platform (Find a Tender service) for the publication of information required by the Procurement Act 2023"*. [S22] **INFERENCE:** the addresses were published for procurement transparency, not marketing; that is a factor against you in the balancing test and the reason relevance, restraint and easy opt-out carry so much weight.

### 2.8 ICO's stance on public business contact details

**FACT** — *"The UK GDPR doesn't prevent you from using personal data from publicly available sources. However, you cannot assume that simply because an individual's personal data is in the public domain they are agreeing to it being used for direct marketing purposes. You must ensure that your processing of personal data is fair, taking into account the source of the data."* And: *"an individual whose business contact details are publicly available on their employer's website may well expect to receive contact from other businesses. However, you still need to comply with the UK GDPR. This means having a lawful basis for the processing and providing the individual with privacy information, as well as complying with any objections."* Also: *"If you use publicly available personal data for your own purposes, you are a controller and take on full responsibility for compliance."* [S3]

---

## 3. Extra-territorial scope, UK representative, ICO fee

### 3.1 Does UK GDPR apply to a Ukraine-based controller?

**FACT** — Art. 3(2): the Regulation *"applies to the relevant processing of personal data of data subjects who are in the United Kingdom by a controller or processor not established in the United Kingdom, where the processing activities are related to: (a) the offering of goods or services, irrespective of whether a payment of the data subject is required, to such data subjects in the United Kingdom"*. [S23]

**FACT** — ICO: *"If the controller doesn't have a UK establishment, but is actively offering services into the UK … then the UK regime will apply to related handling of data."* Evidence of targeting includes *"a UK marketing campaign"*, *"listing prices in pound sterling (GBP)"*, *"UK customer testimonials"*. [S24]

**INFERENCE** — Yes, it applies. A product built for UK public-sector suppliers and promoted by a UK email campaign is targeting. A technical argument exists that a B2B service is offered to companies rather than to "data subjects", but the emails are addressed to named people in the UK and the product's users will be individuals in the UK. Plan on UK GDPR applying to (a) named-contact outreach data and (b) customer account data once anyone signs up. Generic-mailbox outreach alone would not trigger it, but (b) will.

### 3.2 Is a UK representative required?

**FACT** — Art. 27(1): *"Where Article 3(2) applies, the controller or the processor shall designate in writing a representative in the United Kingdom."* Art. 27(2)(a) exempts *"processing which is occasional, does not include, on a large scale, processing of special categories of data … and is unlikely to result in a risk to the rights and freedoms of natural persons, taking into account the nature, context, scope and purposes of the processing"*. [S25]

**FACT** — The exemption is cumulative, and "occasional" is narrow. ICO: *"EDPB guidance suggests this means 'if it is not carried out regularly, and occurs outside the regular course of business or activity of the controller or processor'… We'd suggest that organisations take a cautious approach to whether they consider this processing is occasional or not, and they are very sure this processing isn't part of their normal activities."* [S24] The EDPB text itself: a processing activity *"can only be considered as 'occasional' if it is not carried out regularly, and occurs outside the regular course of business or activity of the controller or processor."* [S26]

**INFERENCE** — The exemption does not plausibly apply. Weekly ingestion and emailing of several hundred named UK contacts is regular and is the core customer-acquisition activity; holding UK customers' account data is continuous. The other two limbs are met (no special-category data, low risk), but all three are needed. **Conclusion: appoint a UK representative before the first email to a named person, name it in the privacy notice (Art. 14(1)(a)), and keep the written mandate.**

**FACT** — Did the 2025 Act remove the requirement? No. The current text of Art. 27 on legislation.gov.uk shows only one 2026 amendment, a substitution of the word "Commission" in para. 4 with effect from 30 Sep 2026; paras 1–2 are unchanged. [S25] (**ASSUMPTION from memory:** the earlier, abandoned Data Protection and Digital Information Bill would have removed Art. 27; that proposal was not carried into the 2025 Act.)

**FACT** — What a representative is: *"just a point of contact"*; *"any enforcement action is still directed to the controller (or processor) itself, rather than to the representative."* [S24]

**FACT** — Penalty exposure for not appointing one: Art. 83(4)(a) puts *"the obligations of the controller and the processor pursuant to Articles 8, 11, 25 to 39 and 42 and 43"* in the tier of *"up to £8,700,000, or in the case of an undertaking, up to 2 % of the total worldwide annual turnover"*. [S14b] **INFERENCE:** enforcement against a micro-business abroad is unlikely, but the missing representative would be the first thing a UK customer's procurement team, Paddle, or a complainant notices.

### 3.3 Cost of a UK representative (provider pages read 2026-11-13)

| Provider | Published price | Label |
|---|---|---|
| Prighter | UK rep "Growth" €39/month, or €35/month billed yearly (€420/yr); "Small" €79/month (€852/yr). Page dated 2026-10-14; which tier a micro-business falls into is not clear from the text | **FACT** [S27] |
| DPO Consulting | Basic: €49/month excl. VAT, one territory | **FACT** [S28] |
| GDPR Local | UK or EU representative £99/month for under 10 FTE (rate card) | **FACT** [S29] |
| VeraSafe | UK programme US$1,200/year for revenue up to US$25m | **FACT** [S30] |
| IT Governance / GRC Solutions | about €875/year for 1–10 employees | **ASSUMPTION** (search snippet; price not visible on the page I fetched) [S31] |

**Budget: roughly £350–£1,000 a year for the UK alone; UK + EU bundles roughly double.**

### 3.4 ICO data-protection fee

**FACT** — The Charges Regulations: *"A data controller must comply with the requirements of this regulation unless all of the processing of personal data they undertake is exempt processing"*; the charge is paid to the Information Commission. Tier 1 (turnover ≤ £632,000 or ≤ 10 staff) is **£52 a year** (£47 by direct debit); non-payment penalties run *"from £400 to £4,000"*. [S32][S33]

**FACT** — DPA 2018 s. 207(1A): the Act applies to *"the types of such processing to which the UK GDPR applies by virtue of Article 3 of the UK GDPR"* — which includes Art. 3(2) controllers abroad. [S34]

**UNKNOWN** — The ICO publishes no clear statement on whether a controller with no UK establishment must pay. A freedom-of-information request for its *"internal guidance etc on whether data controllers established outside of the UK have to pay the data protection fee"* was logged on 28 May 2025 with outcome *"Information withheld"*. [S35] One law firm's reading (2018) is that overseas controllers caught by the targeting test must pay. [S36] The regulations also assume a UK address for a non-company (*"the person's principal place of business in the UK"*), which sits awkwardly with an overseas sole trader. [S32]

**INFERENCE** — Pay it. £52 removes the question, and the registration number is a trust signal in the email footer. Ask the ICO helpline how to register with a non-UK address (the representative's address may be accepted as the contact address — **UNKNOWN**).

### 3.5 Other items the lawyer should confirm

- **Processors and transfers (UNKNOWN):** sequencing tools, mailbox hosts and verification services are processors; a written contract is needed (ICO: *"If you want another organisation to send electronic mail marketing on your behalf which includes using personal information, you must have a contract with them"* [S5]). Whether onward transfers from a Ukraine-based controller to US processors need UK transfer safeguards is a question for the lawyer.
- **Ukrainian law (UNKNOWN):** Ukraine's own personal-data law applies to the FOP as a local controller. Not researched here.
- **Records:** keep a short record of processing, the LIA, the representative's mandate, processor contracts, and the suppression and send logs.

### 3.6 EU GDPR, if Irish or other EU suppliers are targeted later

- **INFERENCE** — Same structure: EU GDPR Art. 3(2)(a) applies when the product is marketed to people in the EU; Art. 27 then requires an EU representative established in a Member State where the data subjects are (Ireland would do for an Ireland-first launch). The "occasional" exemption fails for the same reason.
- **FACT** — EDPB on the exemption: it *"refers to processing 'unlikely to result in a risk to the rights and freedoms of natural persons', thus not limiting the exemption to processing unlikely to result in a high risk"*. [S26]
- Cost: the same providers sell EU representation at the same price points (GDPR Local £99/month; Prighter from €35/month) [S27][S29].
- No fee is payable to the Irish regulator (**ASSUMPTION**).
- The e-privacy rule differs by country — see section 9.

---

## 4. Public supplier pages

### 4.1 OGL attribution — exact wording

**FACT** — OGL v3.0: you must *"acknowledge the source of the Information in your product or application by including or linking to any attribution statement specified by the Information Provider(s) and, where possible, provide a link to this licence; If the Information Provider does not provide a specific attribution statement, you must use the following: **Contains public sector information licensed under the Open Government Licence v3.0.**"* Failure has a consequence: *"if you fail to comply with them the rights granted to you under this licence … will end automatically."* [S20]

**FACT** — Find a Tender states: *"Notice data is available under the Open Government Licence"* and *"Most content on Find a Tender is subject to Crown copyright protection and is published under the Open Government Licence (OGL)."* [S38][S39] I found no bespoke attribution statement on its terms or developer pages (**UNKNOWN** whether one exists elsewhere), so the default wording applies. The FTS footer also notes *"Notices are based on TED XML schema. © European Union, https://ted.europa.eu, 1998–2020"*.

Suggested footer for every page, and for the email (**INFERENCE**):

> Contract data: Find a Tender service (Cabinet Office), © Crown copyright. Contains public sector information licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). [Brand] is an independent commercial service. It is not part of, affiliated with, or endorsed by the UK Government, the Cabinet Office or Find a Tender.

### 4.2 No implication of official status

**FACT** — OGL: *"This licence does not grant you any right to use the Information in a way that suggests any official status or that the Information Provider and/or Licensor endorse you or your use of the Information."* The licence also excludes *"departmental or public sector organisation logos, crests and the Royal Arms"*. [S20]

**FACT** — FTS terms: *"You must contact us for permission if you want to either: charge your website's users to click on a link to any page on Find a Tender; say your website is associated with or endorsed by Find a Tender or another government department or agency."* [S39]

**INFERENCE** — Practical rules:

- No crown, crest, GOV.UK-style header, or wording such as "official", "register", "notice" or "notification" in the page title, the domain name, or the email subject.
- **Keep the source link to each FTS notice outside the paywall.** A paid product that hides FTS links behind a subscription arguably "charges users to click on a link". Free public pages with visible source links avoid the point; if links must sit inside the paid app, ask the FTS team for permission first.
- This matters twice: Paddle prohibits *"Government Services"* as a category (section 5), so anything that looks like a paid gateway to a government service is also a payments risk.

### 4.3 Company data versus personal data on the page

| Item | Show? | Reason |
|---|---|---|
| Registered company name, Companies House number, awards (buyer, title, value, dates), CPV codes, link to the source notice | Yes | Information about a legal person is not personal data (**INFERENCE** from the definition quoted in [S32b]) |
| Matching live tenders; other suppliers' contracts with stated end dates | Yes, as stated in the notices | Public notice data; keep it factual (4.4) |
| Named contact, email address, phone number | **No** | It is personal data; republishing is new processing by you needing its own lawful basis and Art. 14 notice; it turns your site into an address list for other senders; and it is the item most likely to draw a complaint. The brief's "recommend not" is right |
| Directors, persons with significant control, officer addresses from Companies House | **No** | Personal data; not needed for the purpose |
| Any page for a sole trader or ordinary partnership | **No page at launch** | The award record of a sole trader relates to an identifiable person, so the whole page is personal data; you cannot email them anyway |

### 4.4 Defamation and accuracy

**FACT** — Defamation Act 2013 s. 1: *"(1) A statement is not defamatory unless its publication has caused or is likely to cause serious harm to the reputation of the claimant. (2) … harm to the reputation of a body that trades for profit is not 'serious harm' unless it has caused or is likely to cause the body serious financial loss."* s. 2(1): *"It is a defence … to show that the imputation conveyed by the statement complained of is substantially true."* [S40]

**FACT** — FTS gives no accuracy warranty: *"we do not provide any guarantees, conditions or warranties that the information will be: current, secure, accurate, complete"*. [S39]

**FACT** — Misleading business-to-business advertising is prohibited: *"Advertising is misleading which in any way, including its presentation, deceives or is likely to deceive the traders to whom it is addressed … and by reason of its deceptive nature, is likely to affect their economic behaviour; or … injures or is likely to injure a competitor."* [S41]

**INFERENCE** — Reproducing what a contracting authority published is low risk. The risk sits in three places:

1. **Entity mismatch** — attaching another company's award to the wrong page. Show only awards matched on Companies House number, not on name.
2. **Derived statements** — "lost the contract", "at risk", "underperforming", "competitor weakness". Use neutral, sourced wording: "End date stated in the notice: 31 March 2027".
3. **Presentation** — a "claim your profile" prompt that makes the page look like the company's own, or like an official record.

Mitigations: source link and publication date beside every figure; a line saying "as published by [buyer] on [date]; not verified by [Brand]"; a visible "Report an error" link.

### 4.5 Removal requests

- Put a "Report an error / remove this page" link on every page, routed to a monitored mailbox (**INFERENCE**).
- Companies have no data-protection right to removal, but remove within five working days anyway: it costs nothing and removes the commonest complaint route.
- Individuals (a sole trader, or a named person who slipped through): erasure and objection rights apply; respond within one month — earlier in practice (**ASSUMPTION** — statutory time limit not re-read this session).
- On removal: return HTTP 410, add the company to a "do not regenerate" list, and add its domain to the email suppression list.
- **FACT** — FTS itself removes content *"in order to comply with data protection legislation"* on request. [S39] If a notice is withdrawn or corrected upstream, your copy must follow; re-sync regularly.

### 4.6 `noindex` considerations

**INFERENCE** — Launch with `noindex` on all auto-generated supplier pages, and lift it selectively.

| For `noindex` at launch | For indexing later |
|---|---|
| The page's job is to be the landing page for one email; search traffic is not needed for that | Pages claimed or edited by the company, or with enough awards to be useful, have real search value |
| A third-party page ranking for a company's own name is the kind of thing owners complain about — to you, to your host, to Paddle | A claimed page is evidence the company welcomes it |
| Thousands of near-identical generated pages on a new domain look like scaled low-value content to search engines (**ASSUMPTION**) | Indexed pages should carry analysis that the raw notice does not |
| Reduces exposure if entity matching has errors | — |

Use a `noindex` robots meta tag rather than blocking the pages in `robots.txt`, so crawlers can see the instruction (**ASSUMPTION**, standard practice). Keep per-recipient tokens out of any URL that may be indexed or shared.

### 4.7 Companies House data, if profiles are enriched

**FACT** — *"We impose no rules or requirements on how the information on the public register is used, and we're not responsible for your use of the company data. You are responsible for complying with any applicable data protection, copyright and other legislation and regulations. You should check that you've met all the necessary legal requirements before you publish any information."* [S42]

**FACT** — API limit: *"You can make up to 600 requests within a 5 minute period… We reserve the right to ban without notice applications that regularly exceed or attempt to bypass the rate limits."* [S43] A free monthly bulk snapshot of live companies also exists. [S42]

**INFERENCE** — Use Companies House for the PECR gate (status, type, registered name) and for company-level enrichment (SIC codes, incorporation date, registered office). Do not copy officer or PSC records onto pages. No attribution wording is mandated; "Company information from Companies House" is courteous and accurate.

---

## 5. Paddle

Documents read on 2026-11-13: Acceptable Use Policy, *"Last Updated 13 April 2026"* [S44]; Paddle Checkout seller terms (Master Services Agreement), *"Last updated: 6 October 2026"* [S45]; Retain and Metrics AUP, *"Last Updated: 1 February 2023"* [S46]; supported-countries page [S47].

### 5.1 Relevant clauses, quoted

| Topic | Clause (verbatim) | Source |
|---|---|---|
| Who Paddle is for | *"Paddle is built to serve software companies (including B2B SaaS, Consumer Software, and Games). If your company's primary offering is human services (such as consultation, support, or design services) … Paddle is not a good fit"* | [S44] |
| General restrictions | Paddle may not be used for any offering that *"Violates any law or government regulation"*; *"Involves fraudulent, deceptive, unfair, abusive, or predatory practices"*; *"Is marketed through the use of outbound telemarketing"*; *"Threatens reputational damage to Paddle or any Card Brand Network"*; *"Contravenes the requirements for the provision of consent under the EU General Data Protection Regulation (GDPR)"* | [S44] |
| Paddle's discretion | *"Some of the above may not be obvious or evident at the time of application, but Paddle reserves the right to exercise judgment in ascertaining whether any of these factors are likely to be present."* | [S44] |
| Telemarketing — definition | *"'Outbound Telemarketing' means any plan, program, or campaign that is conducted to induce the purchase of products or services by use of one or more telephones, and which involves a telephone call initiated by a person other than the consumer"* | [S45] |
| Telemarketing — warranty | *"(xv) you do not and will not engage or instruct/engage others on your behalf to engage in Outbound Telemarketing of any kind, regardless of whether the relevant products or services are or will be resold through Paddle"* | [S45] cl. 11.1 |
| Human services | Prohibited: *"Human services that are not related to a software offering (e.g., pure consulting or advisory services, including but not limited to legal advice, coaching, IT services, and access to a community of experts)"* | [S44] cat. 2 |
| No bona fide software | Prohibited: *"donations, crowdfunding, community access, advertising, and sponsorship"* | [S44] cat. 3 |
| Infringing others' terms | Prohibited: *"Any product or service that infringes upon, or enables the infringement upon copyrights, trademarks, terms and conditions, or trade secrets of another party"* | [S44] cat. 4 |
| Advertising and marketing | Prohibited: *"Advertising Services, including but not limited to job boards and open houses"*; *"Marketing Services and Schemes…"*; *"Telemarketing"*; *"Automated Social Media Marketing…"*; *"Mass Marketing Products, including but not limited to SMS marketing and Message App marketing"* | [S44] cat. 7 |
| Business opportunities | Prohibited, under "Trading and financial services/advice": *"Business or investment opportunities"* | [S44] cat. 10 |
| Government services | Prohibited: *"Government Services, including but not limited to embassies and foreign consulates"* | [S44] cat. 11 |
| AI content generation | Prohibited: *"Content generation, including but not limited to: Human-like faces … (Restricted Category); Face Swaps; Deep Fakes Images or Videos; Voice Impersonations; Any content generation using a person's likeness without that person's explicit consent; Automated decision-making or categorization of people; Any content generation that falls into other prohibited categories"* | [S44] cat. 16 |
| Law compliance warranty | *"(xi) you have complied and will continue to comply with all applicable laws, statutes, ordinances, and regulations (including, without limitation, any relevant data protection or privacy laws)"* | [S45] cl. 11.1 |
| "Data Protection Law" defined to include marketing law | *"all applicable data protection, privacy, electronic communications and marketing laws and regulations … including the EU Regulation 2016/679 …, Privacy and Electronic Communications (EC Directive) Regulations 2003 (SI 2003/2426) and Directive 2002/58/EC (ePrivacy), and the UK Data Protection Act 2018"*; cl. 14.2: each party shall *"comply with the Data Protection Laws"* | [S45] |
| Termination triggers | Paddle may terminate immediately where it *"has reasonable suspicion, or knows, that any of the representations or warrants given in clause 11 was or has become incorrect or false"*; *"there is any suspected fraudulent/ criminal activity or non-compliance by the Supplier of applicable laws or Payment Scheme Rules"*; or *"in Paddle's sole discretion, any of your Products fall outside of the Acceptable Use Policy"* | [S45] cl. 16.3 |
| Money held on termination | *"Paddle may retain any Supplier Fees as it reasonably determines necessary … to cover future Chargebacks and refunds"* | [S45] cl. 17.2 |
| Paddle's own email tools | Retain/Metrics AUP forbids using those services to send *"an email to an address obtained via internet harvesting methods or otherwise without the consent of the contactee (e.g. scraping or harvesting)"* | [S46] |
| Ukraine | Ukraine is supported; only *"Crimea"*, *"Donetsk"*, *"Kherson"*, *"Luhansk"* and *"Zaporizhzhia"* regions are listed as unsupported | [S47] |

**Not found (FACT of absence):** neither document mentions "lead generation", "data products", "cold email" or email marketing by the seller. The only express marketing-channel ban on sellers is telephone.

### 5.2 Does lawful B2B cold email conflict with any Paddle term?

**INFERENCE** — No express term prohibits it, because "Outbound Telemarketing" is defined by reference to telephone calls. Email is outside that definition.

The conflict is indirect, and real:

1. **Unlawful sending is a contract breach.** PECR and ePrivacy are named inside Paddle's definition of "Data Protection Law". An email to a sole trader without consent would breach the cl. 11.1(xi) warranty and cl. 14.2, and gives Paddle a termination right on "reasonable suspicion". The corporate-only gate in section 1.3 is therefore also a Paddle control.
2. **The "GDPR consent" bullet is loosely drafted.** Legitimate-interests marketing does not contravene GDPR consent requirements, but a risk reviewer could read "cold email to scraped addresses" as doing so. Paddle's attitude to harvested addresses in its Retain AUP points the same way. Get Paddle's position in writing.
3. **Reputation and complaints.** "Threatens reputational damage" and "unfair, abusive" are judgement calls. Recipients who complain to Paddle (its name appears at checkout and on receipts) are the practical trigger.
4. **Never send outreach through Paddle Retain or ProfitWell tools** — the harvested-address ban applies there expressly.
5. **Any phone call is a breach**, including a contractor or an appointment-setting agency, and including follow-up calls to people who did not ask to be called.

Product-category risks to design around (**INFERENCE**):

| Risk | Why it could be raised | How to stay clear |
|---|---|---|
| "Government Services" | Product is built on government data and sits next to an official service | Independent branding, the non-endorsement line, no charge for access to the official notices themselves |
| "Business or investment opportunities" | Tender alerts could be mislabelled as selling "opportunities" | Describe it as procurement analytics software; make no income claims ("win £X of contracts") |
| "Advertising Services, including … job boards" | A listings site where parties pay to be shown resembles a job board | Never charge suppliers to be listed, featured or promoted; revenue is software subscriptions only |
| "Human services" | Bid-writing help, consultancy, "done for you" tender responses | Do not sell these through Paddle |
| AI content generation | AI bid-drafting or supplier scoring; *"Automated decision-making or categorization of people"* | Scoring applies to companies and tenders, never to individuals; disclose AI features to Paddle |
| "Infringes … terms and conditions … of another party" | Data acquisition | Use the official OCDS API and OGL terms; no scraping against a site's terms |

### 5.3 Draft question to Paddle (send before launch, keep the reply)

> **Subject: Pre-launch AUP confirmation — B2B SaaS for UK public-sector suppliers, email outreach**
>
> Hello,
>
> I am a sole proprietor registered in Ukraine [name, registration number, Paddle seller ID if any]. Before launch I would like written confirmation that my product and my marketing method are within the Acceptable Use Policy (last updated 13 April 2026) and the seller terms (last updated 6 October 2026).
>
> **Product.** [Brand] is subscription software for UK companies that sell to the public sector. It reads contract notices published by the UK Government's Find a Tender service under the Open Government Licence v3.0 (via the official open-data API) and gives each customer search, alerts and analytics on tenders and contract awards. [If applicable: it includes AI-assisted summaries of tender documents; it does not generate content using any person's likeness and does not categorise or score individuals.] It is independent software; it is not a government service and does not sell access to any government process. There are no human services, no paid listings and no advertising.
>
> **Marketing.** I intend to send a single short introductory email, with at most two follow-ups, to incorporated UK companies only (limited companies and LLPs verified against Companies House), using the business contact address those companies published in their own contract award notices. Each email identifies me, links to my privacy notice and offers a one-click opt-out. Volume is about 400–500 companies a week. Sole traders, partnerships and personal email addresses are excluded. I will make **no telephone calls** of any kind. I have taken advice that this is lawful under UK PECR (regulation 22 applies only to individual subscribers) and UK GDPR (legitimate interests, with an Article 14 notice), and I have appointed a UK representative.
>
> **Questions.**
> 1. Does this product fall within any prohibited or restricted category — in particular "Government Services", "Business or investment opportunities", "Advertising Services", or "Content generation"?
> 2. Is lawful business-to-business email outreach of this kind compatible with the AUP and with clause 11.1 of the seller terms? I understand "Outbound Telemarketing" to mean telephone calls only — please confirm.
> 3. Does the AUP line about "the requirements for the provision of consent under the EU GDPR" apply to marketing that relies on legitimate interests rather than consent?
> 4. Is there any complaint rate, or other marketing-related signal, at which Paddle would review or suspend an account, and how would I be notified?
> 5. Is there anything in my domain approval or website review that you would want changed before I start?
>
> I am happy to share my privacy notice, legitimate-interests assessment and a sample email.
>
> Thank you,
> [Name]

**UNKNOWN** — how Paddle will answer. Until it does, treat Paddle approval as a launch dependency, and have a fallback processor identified.

