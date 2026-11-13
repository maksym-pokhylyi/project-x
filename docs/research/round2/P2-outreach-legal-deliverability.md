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

- Emailing all ~1,000 a week. The lawful, deliverable volume is nearer **400–500 first-touch emails a week**.
- Using open-tracking pixels. They fall under PECR's separate storage/access (cookie) rules, which apply to every subscriber type [S6]; they also hurt deliverability. Turn them off.
- Indexing thousands of auto-generated supplier pages on day one (section 4.6).

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

**FACT** — Recent PECR penalties concern consumer-scale campaigns: on 20 January 2026 the ICO fined one company £105,000 for *"over 67 million marketing emails"* sent without valid consent, and noted that *"Public reporting plays a crucial role in our work"*. [S70] **INFERENCE:** a few hundred relevant B2B emails a week is not the enforcement priority, but complaints are what start investigations, so the complaint rate is the number to manage.

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

Documents read on 2026-11-13: Acceptable Use Policy, *"Last Updated 13 April 2026"* [S44]; Paddle Master Services Agreement (the seller terms), *"Last updated: 6 October 2026"* [S45]; Retain and Metrics AUP, *"Last Updated: 1 February 2023"* [S46]; supported-countries page [S47].

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

Send this only once every statement in it is true — in particular the advice taken, the UK representative, and the exclusion rules. Paddle may treat the message as a representation under clause 11.

**UNKNOWN** — how Paddle will answer. Until it does, treat Paddle approval as a launch dependency, and have a fallback processor identified.

---

## 6. Deliverability and operations (state of play, November 2026)

### 6.1 What the mailbox providers require

| Provider | Scope of the published rules | Requirements | Source |
|---|---|---|---|
| **Google (Gmail)** | *"Sender requirements and Google enforcement apply only when sending email to personal Gmail accounts"* — not to Google Workspace recipients. Bulk tier = *"more than 5,000 messages per day to Gmail accounts"*; once reached, *"permanently classified"* | All senders: SPF **or** DKIM, valid PTR, TLS, spam rate *"below 0.3%"*. Bulk: SPF **and** DKIM, DMARC (*"can be set to none"*), From-domain alignment, *"one-click unsubscribe, and … a clearly visible unsubscribe link in the message body"*, and *"Keep spam rates reported in Postmaster Tools below 0.10% and avoid ever reaching a spam rate of 0.30% or higher"*. *"Starting November 2025, Gmail is ramping up its enforcement"*, including rejections | **FACT** [S48][S49] |
| **Yahoo** | Yahoo consumer domains; bulk tier not numerically defined on the page | All: SPF or DKIM, spam rate below 0.3%, valid DNS. Bulk: SPF and DKIM, DMARC *"at least p=none"*, a *"functioning list-unsubscribe header, which supports one-click unsubscribe"*, *"Honor unsubscribes within 2 days"*, spam rate below 0.3% | **FACT** [S50] |
| **Microsoft (Outlook.com consumer)** | *"Outlook.com - our consumer service, which is supporting hotmail.com live.com and outlook.com consumer domain addresses"*; *"domains sending over 5,000 emails per day"* | SPF, DKIM, DMARC *"at least p=none and align with either SPF or DKIM"*; non-compliant mail rejected with *"550; 5.7.515 Access denied"* from 5 May 2025; *"Functional Unsubscribe Links"* recommended | **FACT** [S51] |

**INFERENCE** — What this means here:

- You will be far below 5,000 a day, and after the red lines in section 8 you will send almost nothing to consumer Gmail, Yahoo or Outlook.com. The published bulk-sender rules therefore do not formally bind this campaign. Meet them anyway: the same signals feed the filters that protect business mailboxes.
- Your recipients are UK SMEs, mostly on Microsoft 365 and Google Workspace, some behind gateways such as Mimecast or Proofpoint (**ASSUMPTION**). None of those publishes a threshold. Placement there depends on authentication, domain age and reputation, content, and what recipients do with the message.

### 6.2 The uncomfortable part: the sending platforms' own terms

| Platform | Term | Label |
|---|---|---|
| Google Workspace AUP (*"Last modified: October 12, 2026"*) | Customers must not use the services *"to generate, distribute, publish or facilitate unsolicited mass email, promotions, advertisements, or other solicitations ('spam')"* | **FACT** [S52] |
| Google sender guidelines | *"Don't purchase email addresses from other companies. Don't send messages to people who didn't sign up to get messages from you."* | **FACT** [S48] |
| Microsoft Exchange Online | *"To discourage the delivery of unsolicited bulk messages, Exchange Online has recipient limits"*; customers needing *"legitimate bulk commercial email … should use third-party providers"*; *"Exchange Online isn't suited to accommodate bulk-mailing scenarios."* | **FACT** [S53] |

**INFERENCE** — Lawful under PECR is not the same as permitted by the mailbox host. At a few hundred individually relevant emails a day, spread over several mailboxes, the practical risk of suspension is low but not zero; a burst of spam reports is what triggers review. This is the main reason to keep the sending domain separate from the product domain.

### 6.3 Platform sending limits (hard ceilings, not targets)

| Platform | Limit | Label |
|---|---|---|
| Google Workspace | *"Maximum messages per day … 2,000"*; *"500 for trial accounts"*; limits rise only after the domain has *"cumulatively paid at least $100 USD"*, which *"can take up to 75 days"* | **FACT** [S54] |
| Microsoft 365 / Exchange Online | *"10,000 recipients per day"* per mailbox; a tenant-wide external recipient limit (TERRL) scaled to licence count, *"capped at 5,000 external recipients per day"* for trial tenants; `onmicrosoft.com` addresses limited to *"100 external recipients per organization"* a day | **FACT** [S53] |
| Microsoft per-mailbox 2,000 external-recipient limit | Announced, then withdrawn: *"01/06/2026 … The implementation of this limit has now been CANCELLED and will not go into effect."* | **FACT** [S55] |

### 6.4 Volume plan

**ASSUMPTION (vendor guidance, not provider rules; search of 2026-11-13):** practitioners converge on about **25–30 cold emails per mailbox per day** once warmed, **3–5 mailboxes per sending domain**, and **3–6 weeks** of warm-up for a new domain. [S56]

| Quantity | Figure | Basis |
|---|---|---|
| Lawful first-touch emails per week | 400–500 | Section 1.3 |
| Follow-ups | 1 (recommended) or 2 (maximum) | Brief; section 6.8 |
| Steady-state emails per week | 800–1,000 (one follow-up) to 1,200–1,500 (two) | Arithmetic |
| Per business day | 160–200, up to 300 | ÷ 5 |
| Mailboxes at 25 a day | 7–8, up to 12 | Arithmetic |
| Sending domains at 3 mailboxes each | 3–4 | Arithmetic |

### 6.5 Separate sending domain — yes

**FACT** — Yahoo recommends segregation: *"Don't send bulk/marketing email from the same IPs you use to send user mail, transactional mail, alerts, etc. Each IP and DKIM domain has a reputation"*; and warns *"Sending unsolicited commercial email can negatively affect your reputation."* [S50]

**INFERENCE** — Set-up:

- Product domain (app, password resets, receipts, replies to customers): never used for cold outreach.
- 3–4 outreach domains that are obvious variants of the brand (for PECR reg. 23, the sender must be recognisable), each redirecting to the main site, each with MX, SPF, 2048-bit DKIM and DMARC.
- DMARC at `p=none` with a reporting address for the first 2–4 weeks, then `quarantine`, then `reject`.
- Register the domains at least 4 weeks before the first cold send; very new domains are scored harshly (**ASSUMPTION**).
- The link in the email goes straight to the supplier page on your own domain. No link shorteners and no shared tracking-redirect domains.

### 6.6 Warm-up reality

**FACT** — Google: *"Increase sending volume slowly to avoid delivery problems… The more email that you send, the more slowly you should increase sending volume… You can increase the sending volume more quickly when you send daily instead of weekly."* [S48]

**INFERENCE / ASSUMPTION** — For mailboxes sending 25 a day, "warm-up" means age plus normal use, not weeks of automated traffic:

| Week | Activity |
|---|---|
| −4 | Register domains; DNS and authentication; create mailboxes with real names and signatures |
| −3 to −1 | Ordinary correspondence from each mailbox (suppliers, your own accounts, newsletters, a few real conversations a day). Seed tests to your own Microsoft 365 and Google Workspace inboxes |
| 1 | Hand-sent test, 10 → 30 per mailbox per day (6.7) |
| 2–4 | Hold at 20–25 per mailbox per day; add follow-ups; add mailboxes only if signals are clean |

Sequencing tools bundle "warm-up pools" that exchange automated emails between customers' mailboxes. They are widely used; mailbox providers do not endorse them and can treat engineered engagement as abuse (**ASSUMPTION** — not verified in a provider document this session). Do not depend on them.

### 6.7 The "hand-sent first 400" test (first sending week)

Purpose: measure reply quality and complaint signals before automating anything.

| Element | Specification |
|---|---|
| Senders | 4 aged mailboxes on 2 outreach domains |
| Ramp | Mon 10 each (40) · Tue 15 (60) · Wed 20 (80) · Thu 25 (100) · Fri 30 (120) = **400** |
| "Hand-sent" | Each email opened, checked against the supplier page, and sent individually from the mail client, a few minutes apart, inside UK office hours. Template plus one specific line drawn from the award (buyer, contract title, month) |
| Format | Plain text, about 80–120 words, one link (the supplier page), no images, no attachments, **no open-tracking pixel** |
| Mix | Half generic mailboxes, half named addresses, tagged so the two can be compared |
| Pre-checks | Section 1.3 gate; address verified the same week; suppression list checked |
| Logged per email | Recipient company, notice ID, mailbox, time, template version; then bounce, reply (positive / neutral / negative), opt-out, page visit, sign-up |
| Daily routine | Read every reply within one working day; add opt-outs and hard bounces to suppression before the next day's sends |

Stop-and-fix thresholds (**ASSUMPTION** — rules of thumb, not provider rules):

| Signal | Stop if |
|---|---|
| Hard bounces | over 3% in any day |
| Opt-outs plus hostile replies | over 5% |
| Any "reported as spam / blocked" bounce text, or seed tests landing in junk | once |
| Any complaint mentioning the ICO or Paddle | once — pause and review |

What "good" looks like (**ASSUMPTION**): page visits from 15–30% of recipients, replies from 3–8%, a handful of sign-ups. If named addresses do not clearly outperform generic ones, drop named addresses — that removes most of the UK GDPR workload for outreach.

### 6.8 Bounces, role addresses, timing

**Bounces**

- Verify each address in the week it is sent (**ASSUMPTION:** about $0.005–0.01 per check). Addresses from that week's award notices should be fresh; older notices will bounce more.
- Hard bounce (5xx, user unknown, domain invalid): suppress permanently at once.
- Soft bounce (4xx, mailbox full): one retry after 48 hours, then suppress.
- Policy or block bounce (5.7.x, "spam", "blocked"): stop that mailbox for the day and investigate; this is a reputation signal, not a bad address.
- "Catch-all" domains cannot be verified; send to them last and watch the result.

**Role addresses (`info@`, `tenders@`, `bids@`)**

| For | Against |
|---|---|
| Not personal data when no name is stored — outside UK GDPR [S3] | Often shared: more readers, more chances that one presses "report spam" |
| The address the company itself chose for procurement contact; `tenders@`/`bids@` is exactly the right team | Lower reply rates; may feed a ticketing system that auto-replies |
| An opt-out covers the organisation cleanly | Some sending tools and verification services flag role accounts as risky (**ASSUMPTION**) |

Keep both types; measure them separately. Still subject to the PECR gate — a role address at a sole trader is an individual subscriber [S6a].

**Timing and follow-ups in the UK (ASSUMPTION — practitioner norms)**

- Send Tuesday–Thursday, 08:30–11:30 and 13:30–16:00 UK time; avoid Monday mornings, Friday afternoons, bank holidays, and 20 December–3 January.
- Follow-up 1 at +3 to +4 working days, in the same thread, two or three sentences, with the opt-out line again.
- Follow-up 2 (optional) at +7 to +10 working days; say it is the last. Then stop for good.
- Any reply — including "not now" — ends the sequence for that company. "Remove us" suppresses the whole domain.

### 6.9 Tooling and monthly cost

Prices read from vendor pages on 2026-11-13 unless marked.

| Item | Option | Price | Label |
|---|---|---|---|
| Sequencer | Smartlead Base (2,000 contacts, 6,000 sends/month) | $32/month as displayed (see note) | **FACT** [S57] |
| | Smartlead Pro (30,000 contacts, 90,000 sends) | $78/month as displayed (see note) | **FACT** [S57] |
| | Instantly Growth (1,000 uploaded contacts, 5,000 emails/month) — contact cap too low for ~2,000 new companies a month | $47/month | **FACT** [S58] |
| | Instantly Hypergrowth (25,000 contacts, 125,000 emails) | $107/month | **FACT** [S58] |
| | lemlist Email (50,000 emails/month, unlimited senders) | $69/month, $55 billed yearly | **FACT** [S59] |
| Mailboxes | Google Workspace Business Starter, bought direct | about $7–8.40 per mailbox/month | **ASSUMPTION** (price not extractable from the page) |
| | Reseller mailboxes via Smartlead's marketplace (Google or Outlook) | $4.50 per mailbox/month | **FACT** [S57] |
| Domains | Per outreach domain | about $13 a year | **FACT** [S57] |
| Verification | ~2,000 addresses a month | about $10–20/month | **ASSUMPTION** |
| Monitoring | Google Postmaster Tools; DMARC reports | free | **ASSUMPTION** |

Note: the Smartlead page has a monthly/yearly toggle advertising 17% off; I could not tell which billing period the displayed prices reflect. Month-to-month may be about 20% higher (**UNKNOWN**).

| Stack | Monthly cost |
|---|---|
| **Test week only:** 4 Workspace mailboxes, 2 domains, manual sending, a spreadsheet | about $30–40 |
| **Lean steady state:** 8 mailboxes, 3 domains, Smartlead Base or lemlist, verification | about $110–170 |
| **Full:** 12 mailboxes, 4 domains, Smartlead Pro or Instantly Hypergrowth, verification | about $180–250 |
| Compliance overhead on top: UK representative (£30–100/month), ICO fee (£52/year) | about £35–105 |

Plain Workspace or Microsoft 365 mailboxes with manual sending are enough for the test week and give the cleanest signal. A sequencer earns its fee from week 2 for throttling, follow-up logic, reply detection and suppression. Whichever tool is used: check that it sends `List-Unsubscribe` and `List-Unsubscribe-Post` headers, lets you disable open tracking, and will sign a data-processing agreement.

### 6.10 What gets the domain or the Paddle account into trouble

| Domain / mailboxes | Paddle account |
|---|---|
| Volume spikes; more than ~30–50 a day from a young mailbox | **Any telephone outreach**, by anyone |
| Hard-bounce rate above a few percent (old or guessed addresses) | Emailing sole traders or personal addresses (unlawful → warranty breach) |
| Recipients pressing "report spam"; no visible opt-out | Complaints sent to Paddle, card disputes, chargebacks |
| Consumer webmail addresses on the list | A regulator complaint or published enforcement naming the business |
| Open-tracking pixels, link shorteners, several links, attachments, heavy HTML | Pages or emails that look official or government-run |
| Identical text to hundreds of recipients on the same day | Income or win-rate claims; "business opportunity" framing |
| Outreach from the product domain | Selling consultancy or paid listings through the checkout |
| Buying or renting a list (Google and Yahoo both say not to [S48][S50]) | Running outreach through Paddle Retain / ProfitWell tools [S46] |

---

## 7. Email content rules and template skeleton

### 7.1 What must be in the email

| Requirement | Source | Label |
|---|---|---|
| Sender's identity not disguised or concealed | PECR reg. 23(a) [S1b] | **FACT** |
| A valid address for opt-out requests. ICO checklist: *"We offer an opt-out (by reply or unsubscribe link) and act on this promptly."* | PECR reg. 23(b) [S1b][S4] | **FACT** |
| Clearly identifiable as a commercial communication; identifies on whose behalf it is sent; unsolicited commercial email identifiable as such *"as soon as it is received"* | E-Commerce Regs 2002 regs 7–8 via PECR reg. 23(c) [S10] | **FACT** |
| For named recipients: controller identity and contact details, **the UK representative**, purpose and lawful basis, the legitimate interest, source of the data, retention, rights, complaint routes — in the email or one click away, at the latest with the first email | UK GDPR Art. 14 [S9] | **FACT** |
| For named recipients: the right to object *"explicitly brought to the attention of the data subject and … presented clearly and separately from any other information"* | UK GDPR Art. 21(4) [S19] | **FACT** |
| Not misleading to traders (content, presentation, who the advertiser is) | Business Protection from Misleading Marketing Regs 2008 reg. 3 [S41] | **FACT** |
| OGL attribution, if the email itself reproduces notice data | OGL v3.0 [S20] | **FACT** |

### 7.2 Identity details for a non-UK sole trader

| Detail | Required? | Basis |
|---|---|---|
| Real name of the person or business behind the brand ("[Brand] is operated by [Full name], sole proprietor registered in Ukraine") | **Yes** | PECR reg. 23(a); Art. 14(1)(a). A brand name alone, with no legal person behind it, risks "concealed identity" (**INFERENCE**) |
| Contact email that is read | **Yes** | PECR reg. 23(b); Art. 14(1)(a) |
| Postal address **in the email** | **Not expressly required by UK law** | PECR requires a "valid address" for opt-outs, which the ICO accepts as reply or link [S4]; Art. 14 says "contact details" [S9] |
| Postal (geographic) address **available on the website** | **Yes, treat as required** | E-Commerce Regs reg. 6(1): *"(a) the name of the service provider; (b) the geographic address at which the service provider is established; (c) the details of the service provider, including his electronic mail address"*, *"easily, directly and permanently accessible"* [S10]. Whether reg. 6 binds a provider established outside the UK is **UNKNOWN**; comply regardless |
| Registration reference (Ukrainian state register entry / tax number) | Where one exists, on the website | Reg. 6(1)(d) [S10] |
| UK representative's name and UK address | **Yes**, in the privacy notice | Art. 14(1)(a) [S9] |
| ICO registration number | Optional; useful trust signal | — |

**Recommendation (INFERENCE):** put a postal address in the footer anyway. It costs one line, it answers "who is this?", and it is mandatory in the US (*"a valid physical postal address of the sender"* [S60]) and Canada (*"the mailing address"* [S61]) if those markets follow. Use a business address where post is actually received, not a home address. UK company-law trading-disclosure rules were not checked for a non-UK sole trader (**UNKNOWN**).

### 7.3 Subject lines

**INFERENCE** from reg. 23, the E-Commerce Regs and the 2008 Regulations:

- No "Re:" or "Fwd:" on a first email; no pretence of an existing relationship.
- No wording that reads as official: "Contract award notification", "Find a Tender notice", "Action required".
- Say what it is, and that it is from a business.

Acceptable patterns: `[Company]: your public contract awards on one page` · `A page about [Company]'s Find a Tender awards (from [Brand])`.

### 7.4 Template skeleton (structure only — not sales copy)

```
From:     [First name Last name] <first@[outreach-domain]>      ← real person, real mailbox
Reply-To: same mailbox (monitored daily)
Subject:  [Company]: your public contract awards on one page
Headers:  List-Unsubscribe: <https://[domain]/u/[token]>, <mailto:unsubscribe@[outreach-domain]?subject=unsubscribe>
          List-Unsubscribe-Post: List-Unsubscribe=One-Click

[1] WHY YOU, WHY NOW (1–2 sentences, factual)
    "[Company] was named as the supplier on [contract title] for [buyer], published on
     Find a Tender on [date]."

[2] WHAT THIS IS (1 sentence, plainly commercial)
    "I run [Brand], a paid software service for public-sector suppliers. I have put
     [Company]'s published awards, matching open tenders and related contracts nearing
     their end date on one page:"

[3] ONE LINK
    https://[product-domain]/suppliers/[company-slug]

[4] SOFT QUESTION (1 sentence) — optional

[5] SIGNATURE / IDENTITY
    [Full name], [Brand]
    [Brand] is operated by [Full legal name], sole proprietor registered in Ukraine
    ([register reference]). [Postal address]. [Contact email].
    UK data-protection representative: [Name, UK address].

[6] OPT-OUT — its own paragraph, visually separate
    "You have the right to object to marketing from us at any time. To stop these
     emails, reply 'stop' or use this link: [one-click link]. We will not contact
     [Company] again."

[7] DATA NOTICE — its own paragraph (named recipients; harmless for generic mailboxes)
    "Where we got your details: this address appears as the supplier contact in the
     public contract notice above (Find a Tender, published under the Open Government
     Licence v3.0). We use it only to send this message and at most [one/two]
     follow-ups, on the basis of our legitimate interest in telling suppliers about
     our service, and delete it after 90 days if you do not reply. Full privacy
     notice, your rights, and how to complain: [link]."

[8] INDEPENDENCE LINE
    "[Brand] is independent and is not affiliated with the UK Government or
     Find a Tender. Contains public sector information licensed under the Open
     Government Licence v3.0."
```

Follow-ups repeat blocks [5]–[6] and link to the notice; they do not need block [7] in full again.

### 7.5 Privacy notice — the Art. 14 section should state

Controller name, country and contact · UK representative · what is held (work email address, employer, the notice it came from; name only if stored) · source: Find a Tender public notices, a publicly accessible source · purpose: one introductory message and limited follow-ups · lawful basis: legitimate interests, with the interest stated · recipients: named processors (mailbox host, sending tool, verification service) · transfers outside the UK and the safeguard used · retention (the table in 2.6) · rights, with objection to marketing first and unconditional · how to complain to you (form, 30-day acknowledgement) · how to complain to the Information Commission · no automated decision-making about individuals.

---

## 8. One-page operating checklist

### Must exist before the first email

| # | Item | Owner check |
|---|---|---|
| 1 | **Paddle's written reply** to the question in 5.3 | Saved |
| 2 | **UK representative** appointed in writing; named in the privacy notice | Mandate on file |
| 3 | **ICO data-protection fee** paid (£52), or ICO's written confirmation that it is not due | Registration number |
| 4 | **Privacy notice** live, with the Art. 14 section (7.5) | URL in email template |
| 5 | **Legitimate-interests assessment** written, dated, signed (2.3) | PDF on file |
| 6 | **Corporate-subscriber gate** implemented: Companies House lookup, entity-type allow-list, webmail-domain block list, LP/NL exclusion (1.3) | Tested on a sample of 100 |
| 7 | **Suppression list** (address and domain level), checked automatically before every send; never purged | Tested |
| 8 | **Opt-out mechanism**: one-click link, reply handling, `List-Unsubscribe` headers; processed within 2 days at most, same day in practice | Tested end to end |
| 9 | **Identity block** and postal address in the template; website shows name, address, contact, register reference | Reviewed |
| 10 | **Attribution and independence lines** on pages and in email (4.1) | Reviewed |
| 11 | **Retention rule** automated: delete non-responders at 90 days; keep suppression | Job scheduled |
| 12 | **One-month rule**: no named address held more than a month before first contact (2.4) | Pipeline check |
| 13 | **Complaint handling**: web form, 30-day acknowledgement, log; one inbox for objections, errors and page removals | Tested |
| 14 | **Page hygiene**: no names or emails shown; `noindex`; "report an error / remove" link; source links not paywalled | Reviewed |
| 15 | **Records**: send log, record of processing, processor contracts, this document's sources | Folder exists |
| 16 | **Sending set-up**: separate domains, SPF/DKIM/DMARC passing, mailboxes aged, **open tracking off** | Seed tests in inbox |
| 17 | A solicitor's one-hour review of items 2–6 and the LP, fee and transfer questions | Note on file |

### Red lines

- **No sole traders, ordinary partnerships or unverified entities.** No Companies House match, no email.
- **No personal or consumer addresses** — gmail.com, googlemail.com, outlook.com, hotmail.*, live.*, yahoo.*, icloud.com, btinternet.com, aol.com, sky.com and similar — even when the supplier is a limited company.
- **No purchased, rented or third-party lists.** The only source is the supplier's own published notice.
- **No cold calls, no call-backs to non-requesters, no SMS, no LinkedIn or WhatsApp automation.** Calls breach Paddle's terms outright; the other channels count as "electronic mail" under PECR.
- **No more than one email plus two follow-ups**, ever, per company; a reply or opt-out ends it.
- **No named contacts or addresses on public pages.**
- **No official look**, no government marks, no "notification" wording.
- **No tracking pixels.**
- **No sending after an objection** — to the person, and by policy to the whole company domain.
- **No statements about a company that the source notice does not support.**

---

## 9. Expansion scan — comparable lawful B2B cold email elsewhere

Each paragraph gives the governing rule. Whether procurement award data in each market carries supplier email addresses was **not verified** and is the practical gating question everywhere outside the UK.

**Ireland.** **FACT** — S.I. 336/2011 reg. 13(1) requires consent for unsolicited marketing email to a natural person, but reg. 13(2) carves out *"an email address that reasonably appears to the sender to be an email address used mainly by the subscriber or user in the context of their commercial or official activity and the unsolicited communication relates solely to that commercial or official activity"*, and reg. 13(4) makes email to a subscriber *"other than a natural person"* lawful unless it *"has notified the person that [it] does not consent"*. The sender must include *"a valid address at which that person may be contacted"*, must not disguise identity, and must give a valid opt-out address. Each message is a separate offence; fines on indictment up to *"€250,000"* for a body corporate and *"€50,000"* for a natural person. [S62] **INFERENCE:** comparable to the UK and slightly wider (work addresses of individuals qualify if the message relates solely to their work), but EU GDPR applies to named addresses and an EU representative is needed (3.6).

**Australia.** **FACT** — The Spam Act 2003 has no business exemption; commercial electronic messages need consent, but Schedule 2 cl. 4 deems consent where a work-related address *"has been conspicuously published"*, publication is *"not accompanied by … a statement to the effect that the relevant electronic account-holder does not want to receive unsolicited commercial electronic messages"*, and the message is *"relevant to … the work-related business, functions or duties"* of the person, or to the office, function or role. Merely being published is not enough (cl. 4(1)). Withdrawal of consent takes effect within *"5 business days"*. Part 3 bans the supply, acquisition and use of *"address-harvesting software and harvested-address lists"*. [S63] (Text read is a 2016 compilation; later amendments not checked.) **INFERENCE:** workable for tender-related messages to published procurement contacts, but the harvesting rules make automated collection the point to clear with an Australian lawyer first.

**New Zealand.** **FACT** — Unsolicited Electronic Messages Act 2007: *"A person must not send, or cause to be sent, an unsolicited commercial electronic message that has a New Zealand link."* Consent includes deemed consent where *"an electronic address has been conspicuously published by a person in a business or official capacity"*, the publication carries no statement refusing unsolicited messages, and *"the message sent to that address is relevant to the business, role, functions, or duties of the person in a business or official capacity"*. Messages need accurate sender information and an unsubscribe facility; withdrawal takes effect 5 working days after use. [S64] **INFERENCE:** same model as Australia; small market.

**Canada.** **FACT** — CASL s. 10(9)(b) implies consent where the recipient *"has conspicuously published … the electronic address"*, the publication *"is not accompanied by a statement that the person does not wish to receive unsolicited commercial electronic messages"*, and *"the message is relevant to the person's business, role, functions or duties in a business or official capacity"*. Every message must identify the sender with *"the mailing address, and either a telephone number … an email address or a web address"*, and carry an unsubscribe mechanism. Maximum penalty *"$1,000,000 in the case of an individual, and $10,000,000 in the case of any other person"*. [S61] Privacy law excludes *"business contact information … solely for the purpose of communicating … in relation to their employment, business or profession"*, but removes the consent exceptions where an address *"is collected by the use of a computer program that is designed or marketed primarily for use in generating or searching for, and collecting, electronic addresses"*. [S65] **INFERENCE:** lawful in principle; the burden of proving implied consent is on the sender, and the address-harvesting provision needs a Canadian opinion before any automated extraction.

**United States.** **FACT** — CAN-SPAM is an opt-out regime with no consent requirement and no B2B exemption. It prohibits header information that is *"materially false or materially misleading"* and deceptive subject headings; requires an opt-out honoured within *"10 business days"*, *"clear and conspicuous identification that the message is an advertisement or solicitation"*, and *"a valid physical postal address of the sender"*. [S60] Civil penalty currently *"$53,088"* per violation under FTC Act s. 5(m)(1)(A). [S66] **INFERENCE:** the most permissive market legally; deliverability and reputation, not law, are the constraint. State privacy laws were not reviewed.

**France.** **FACT** — CNIL (page dated 10 June 2026): for professionals the rule is information plus a simple, free right to object; *"La prospection à l'égard de professionnels peut être fondée sur l'intérêt légitime de l'organisme lorsque l'objet de la sollicitation est en rapport avec la profession de la personne démarchée"*. Where data were acquired from third parties the sender must make sure the person *"a été informée"* and can object. Generic addresses (*"info@…, contact@…"*) *"ne sont pas soumises aux principes rappelés ci-dessus"*. [S67] **INFERENCE:** comparable to the UK for work-relevant messages; EU GDPR and an EU representative apply; write in French.

**Sweden.** **FACT** — Marknadsföringslagen (2008:486) § 19 requires prior consent only for marketing email to *"en fysisk person"* (a natural person); § 20 requires every marketing email to contain a valid opt-out address, and *"Detta gäller även vid marknadsföring till en juridisk person"* (this also applies to marketing to a legal person). [S68] **INFERENCE:** email to legal persons is permitted on an opt-out basis; sole traders (*enskild firma*) are natural persons, so consent is needed. Whether a named employee address counts as the legal person's is contested in secondary sources (**UNKNOWN**) — start with generic addresses.

**Finland.** **FACT** — Act 917/2014 s. 200: email marketing *"may only be directed at natural persons who have given their prior consent"*. s. 202: *"Direct marketing to legal persons is allowed if the recipient has not specifically prohibited it"*, with an easy, free way to prohibit and clear notice of it. s. 203: the message must be recognisable as marketing, with the sender's identity not concealed and a valid opt-out address. [S69] (Unofficial translation; later amendments not checked.) **INFERENCE:** same model as Sweden. The regulator's position on named work addresses could not be read this session (site blocked) — **UNKNOWN**.

**Not comparable (ASSUMPTION, from memory — not verified):** Germany treats unsolicited B2B email as requiring prior express consent; the Netherlands, Denmark, Austria, Italy and Poland are also consent-based or materially stricter. Do not extend the model there without local advice.

**Order of attack (INFERENCE):** Ireland first (same language, near-identical rule, similar procurement notices), then the US (if a usable public source of supplier contacts exists), then France. Australia, New Zealand and Canada only after a local opinion on address harvesting.

---

## 10. What could not be verified, and questions for the lawyer

### Not verified this session

| # | Item | Why | Effect on the plan |
|---|---|---|---|
| 1 | Whether FTS OCDS award records carry supplier emails and Companies House identifiers in the proportions stated | The brief forbade calling the API; taken from the brief | Sizing in 1.3 and 6.4 depends on it |
| 2 | Whether PECR applies to a sender with no UK presence | No territorial clause in the Regulations; not addressed in the ICO guidance read | Treated as applying |
| 3 | Whether an overseas controller must pay the ICO fee | ICO's internal guidance withheld under FOI [S35] | Recommend paying £52 |
| 4 | Whether English/Welsh/NI limited partnerships are "individual subscribers" | My reading of the definitions; no ICO statement found | Excluded |
| 5 | Whether any new storage/access exemption (2025 Act, Sch. 12) covers email open-tracking | ICO storage-and-access guidance not read | Pixels off |
| 6 | Paddle's actual attitude to lawful cold email | No public statement found | Ask (5.3) |
| 7 | Current Google Workspace and Microsoft 365 list prices | Not extractable from the pricing pages | ±$20/month |
| 8 | Whether the Smartlead price shown ($32, $78) is the monthly or the yearly-billed rate | Page has a monthly/yearly toggle; rendered state unclear | ±$10/month |
| 9 | Per-mailbox volume and warm-up norms | Vendor blogs only; no provider publishes a number | Treated as rules of thumb |
| 10 | Mail platforms used by UK SME recipients | No source read | Affects which filters matter |
| 11 | Regulator guidance pages for Ireland (DPC), Australia (ACMA), Canada (CRTC), Finland, and the FTC's CAN-SPAM guide | Sites blocked automated access; statutes read instead | Section 9 rests on statute text |
| 12 | Whether award data in other countries exposes supplier email addresses | Not researched | Decides whether section 9 is usable at all |
| 13 | Germany, Netherlands and other "strict" markets | From memory | Flagged as no-go without advice |
| 14 | Ukrainian data-protection and marketing law applying to the FOP | Out of scope | Lawyer in Ukraine |
| 15 | UK transfer rules for a non-UK controller using US processors | Not researched | Lawyer question |
| 16 | Statutory response time for erasure/objection requests; previous £500,000 PECR cap; the abandoned Bill's proposal on Art. 27 | From memory, not re-read | Background only |
| 17 | Australian and Finnish statute texts are older compilations/translations | Later amendments not checked | Section 9 |

### Questions to put to a UK data-protection solicitor (about one hour)

1. Confirm that UK GDPR Art. 3(2)(a) applies and that the Art. 27(2)(a) exemption is unavailable; review the representative's mandate.
2. Confirm the corporate-subscriber gate, especially: LP/NL partnerships, charities and societies without a Companies House number, overseas companies, and company staff using webmail addresses.
3. Review the LIA and the Art. 14 wording, including whether the short in-email notice plus link meets *"proactively make individuals aware"* [S17].
4. Is the ICO fee payable by a controller with no UK establishment, and how is registration completed?
5. Does keeping FTS source links inside a paid product need Cabinet Office permission under the FTS linking term [S39]?
6. Any database-right issue in extracting the personal-data fields that the OGL does not license?
7. Transfer mechanism for processors outside the UK; processor contract terms.
8. Whether any UK trading-disclosure rule requires a postal address in the email itself for a non-UK sole trader.
9. Does PECR reg. 6 (storage and access) reach per-recipient link tokens as used here?

### Method note

- WebSearch calls used: **9 of 20** (UK representative guidance; ICO fee for overseas controllers; UK representative pricing; Australian Spam Act; cold-email volume norms; ICO PECR fines 2026; Companies House prefixes; Paddle and cold email; Swedish marketing act).
- Everything else was read directly from the source URL on 2026-11-13. The Find a Tender API was not called.
- legislation.gov.uk texts were the "latest available (revised)" versions, which already show 2026 amendments and their commencement notes.

---

## 11. Sources and quotations

All accessed 2026-11-13. Quotes are verbatim; "…" marks an omission.

### UK legislation

| ID | Source | Key quotation(s) |
|---|---|---|
| S1 | PECR 2003 reg. 22 — https://www.legislation.gov.uk/uksi/2003/2426/regulation/22 | "This regulation applies to the transmission of unsolicited communications by means of electronic mail to individual subscribers." · "Words in reg. 22(2) inserted (5.2.2026) by Data (Use and Access) Act 2025 (c. 18), ss. 114(2), 142(1); S.I. 2026/82, reg. 2(x)" |
| S1b | PECR 2003 reg. 23 — https://www.legislation.gov.uk/uksi/2003/2426/regulation/23 | "A person shall neither transmit, nor instigate the transmission of, a communication for the purposes of direct marketing by means of electronic mail— (a) where the identity of the person on whose behalf the communication has been sent has been disguised or concealed; (b) where a valid address to which the recipient of the communication may send a request that such communications cease has not been provided; (c) where that electronic mail would contravene regulation 7 of the Electronic Commerce (EC Directive) Regulations 2002; or (d) where that electronic mail encourages recipients to visit websites which contravene that regulation." |
| S2 | PECR 2003 reg. 2 — https://www.legislation.gov.uk/uksi/2003/2426/regulation/2 | Definitions of "corporate subscriber", "individual", "subscriber", "electronic mail", "direct marketing" (quoted in 1.1) |
| S7 | UK GDPR Art. 6 — https://www.legislation.gov.uk/eur/2016/679/article/6 | "11. For the purposes of paragraph 1(f), examples of types of processing that may be processing that is necessary for the purposes of a legitimate interest include— (a) processing that is necessary for the purposes of direct marketing" |
| S9 | UK GDPR Art. 14 — https://www.legislation.gov.uk/eur/2016/679/article/14 | Art. 14(3)(a)–(b) (quoted in 2.4) · "Art. 14(2)(da) inserted (19.6.2026) by Data (Use and Access) Act 2025 (c. 18), s. 142(1), Sch. 10 para. 4(2); S.I. 2026/82, reg. 3(b)" |
| S10 | Electronic Commerce (EC Directive) Regulations 2002 regs 6, 7, 8 — https://www.legislation.gov.uk/uksi/2002/2013/regulation/6 · /regulation/7 · /regulation/8 | Reg. 7: "be clearly identifiable as a commercial communication; clearly identify the person on whose behalf the commercial communication is made" · Reg. 8: "any unsolicited commercial communication sent by him by electronic mail is clearly and unambiguously identifiable as such as soon as it is received" |
| S11 | Data (Use and Access) Act 2025 s. 115 — https://www.legislation.gov.uk/ukpga/2025/18/section/115 | "For regulation 31 substitute— '31. Information Commissioner's enforcement powers (1) Schedule 1 provides for certain provisions of Parts 5 to 7 of the Data Protection Act 2018 to apply with modifications for the purposes of enforcing these Regulations.'" · "S. 115 in force at 5.2.2026 in so far as not already in force by S.I. 2026/82, reg. 2(y) (with regs. 8-11)" |
| S12 | Data (Use and Access) Act 2025 Sch. 13 — https://www.legislation.gov.uk/ukpga/2025/18/schedule/13 | "18. Section 157 has effect as if— … (ii) in paragraph (a), for the words from 'section 35' to 'or 78' there were substituted 'regulation 5, 6, 7, 8, 14, 19, 20, 21, 21A, 21B, 22, 23 or 24'" · "Sch. 13 in force at 5.2.2026 by S.I. 2026/82, reg. 2(z14)" |
| S13 | S.I. 2026/82, DUAA Commencement No. 6 — https://www.legislation.gov.uk/uksi/2026/82/made | "2. The following provisions of the 2025 Act … come into force on 5th February 2026— … (c) section 70 (lawfulness of processing); … (x) section 114 …; (y) section 115 (Commissioner's enforcement powers); … (z14) Schedule 13" · "3. … come into force on 19th June 2026— (a) section 103 (complaints by data subjects)" · reg. 11(2) (quoted in 1.4) |
| S14 | Data Protection Act 2018 s. 157 — https://www.legislation.gov.uk/ukpga/2018/12/section/157 | "(5) The 'higher maximum amount' is— (a) in the case of an undertaking, £17,500,000 or 4% of the undertaking's total annual worldwide turnover in the preceding financial year, whichever is higher, or (b) in any other case, £17,500,000." |
| S14b | UK GDPR Art. 83 — https://www.legislation.gov.uk/eur/2016/679/article/83 | Art. 83(4)(a) (quoted in 3.2) |
| S15 | S.I. 2026/1015, DUAA Commencement No. 9 — https://www.legislation.gov.uk/uksi/2026/1015/made | "The following provisions … come into force on 30th September 2026— (a) section 117(4)(a) …; (b) section 118 (abolition of the office of Information Commissioner); (c) section 119 (transfer of functions to the Information Commission)." |
| S18 | Data Protection Act 2018 s. 164A — https://www.legislation.gov.uk/ukpga/2018/12/section/164A | "(2) A controller must facilitate the making of complaints under this section by taking steps such as providing a complaint form which can be completed electronically and by other means. (3) … must acknowledge receipt of the complaint within the period of 30 days beginning when the complaint is received." |
| S19 | UK GDPR Art. 21 — https://www.legislation.gov.uk/eur/2016/679/article/21 | Art. 21(2)–(4) (quoted in 2.5) |
| S23 | UK GDPR Art. 3 — https://www.legislation.gov.uk/eur/2016/679/article/3 | Art. 3(2) (quoted in 3.1) |
| S25 | UK GDPR Art. 27 — https://www.legislation.gov.uk/eur/2016/679/article/27 | Art. 27(1)–(2) (quoted in 3.2) · "Word in Art. 27(4) substituted (30.9.2026) by … S.I. 2026/386 … ; S.I. 2026/1015, reg. 2(c)" — the only 2026 amendment shown |
| S32 | Data Protection (Charges and Information) Regulations 2018 reg. 2 — https://www.legislation.gov.uk/uksi/2018/480/regulation/2 | "(1) A data controller must comply with the requirements of this regulation unless all of the processing of personal data they undertake is exempt processing." · "(5)(b) the address of a person (other than a registered company) carrying on a business is that of the person's principal place of business in the UK." |
| S34 | Data Protection Act 2018 s. 207 — https://www.legislation.gov.uk/ukpga/2018/12/section/207 | "(1A) In the case of the processing of personal data to which Part 2 (the UK GDPR) applies, it applies to the types of such processing to which the UK GDPR applies by virtue of Article 3 of the UK GDPR." |
| S40 | Defamation Act 2013 ss. 1–2 — https://www.legislation.gov.uk/ukpga/2013/26/section/1 · /section/2 | Quoted in 4.4 |
| S41 | Business Protection from Misleading Marketing Regulations 2008 reg. 3 — https://www.legislation.gov.uk/uksi/2008/1276/regulation/3 | "3.—(1) Advertising which is misleading is prohibited." |

### ICO (Information Commission) guidance

| ID | Source | Key quotation(s) |
|---|---|---|
| S3 | Business-to-business marketing — https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/ | Quoted throughout sections 1–2. Banner: "Due to changes made by the Data (Use and Access) Act, this guidance is under review and may be subject to change." |
| S4 | Guide to PECR: Electronic mail marketing — https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/ | "You can email or text any corporate body (a company, Scottish partnership, limited liability partnership or government body). However, it is good practice – and good business sense – to keep a 'do not email or text' list of any businesses that object or opt out" |
| S5 | Direct marketing using electronic mail: How do we comply with the PECR electronic mail marketing rules? — https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-direct-marketing-using-electronic-mail/how-do-we-comply-with-the-pecr-electronic-mail-marketing-rules/ | "You can send unsolicited electronic mail marketing to corporate subscribers without consent or a soft opt-in. You must not disguise or hide your identity in messages to either type of subscriber. You must provide a valid contact address for recipients to opt out or unsubscribe." · "However, using a webmail service or bulk-email platform does not normally make that service responsible… You remain responsible for complying with PECR." |
| S6 | Same guidance: What else do we need to consider? — …/guidance-on-direct-marketing-using-electronic-mail/what-else-do-we-need-to-consider/ | "20 August 2025 - The Data Use and Access Act added the definition of direct marketing in the DPA into PECR" · tracking-pixel text quoted in 1.2 · "You should keep a 'do not contact' or suppression list" |
| S6a | Same guidance: Key concepts — …/guidance-on-direct-marketing-using-electronic-mail/key-concepts-for-direct-marketing-using-electronic-mail/ | "individual subscribers (people, sole traders, ordinary partnerships); and corporate subscribers (organisations with their own legal personality, for example limited companies, LLPs and Scottish partnerships)" · "They apply even if you only hold a generic or role-based address." |
| S8 | Legitimate interests: When can we rely on legitimate interests? — https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/legitimate-interests/when-can-we-rely-on-legitimate-interests/ | Quoted in 2.2–2.3 |
| S16 | The Data (Use and Access) Act 2025: what does it mean for organisations? — https://ico.org.uk/about-the-ico/what-we-do/legislation-we-cover/data-use-and-access-act-2025/the-data-use-and-access-act-2025-what-does-it-mean-for-organisations/ | "19 June 2026 - We have updated this guidance to reflect that all data protection provisions in the Data (Use and Access) Act 2025 are now in force." · "it clarifies that direct marketing can be a legitimate interest" |
| S17 | Right to be informed: When should we provide privacy information? — https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/when-should-we-provide-privacy-information/ | Quoted in 2.4 |
| S24 | Knowledge hub: Territorial scope (PDF) — https://ico.org.uk/media2/migrated/4031113/ic-327905-y2y5-knowledge-hub-territorial-scope.pdf | "Organisations who don't have a UK establishment but who target people in the UK … generally need to appoint someone to act as their representative in the UK… There is an exemption for public authorities, and for occasional low-risk processing." (undated; appears to be internal ICO guidance released through its disclosure process) |
| S32b | Data protection fee: legal definitions — https://ico.org.uk/for-organisations/data-protection-fee/legal-definitions-fees/ | "Data subject: The identified or identifiable living individual to whom personal data relates." · "Only controllers need to pay the data protection fee." |
| S33 | Data protection fee — https://ico.org.uk/for-organisations/data-protection-fee/data-protection-fee/ and FAQs — https://ico.org.uk/for-organisations/data-protection-fee/faqs-data-protection-fee-payment-and-online-registration/ | "You have a maximum turnover of £632,000 for your financial year or no more than 10 members of staff. The fee for tier 1 is £52." · "Fines range from £400 to £4,000." · "The cost is reduced by £5 if you pay by direct debit." |
| S35 | Disclosure log IC-389257-H7R0 — https://cy.ico.org.uk/about-the-ico/our-information/disclosure-log/2025/05/ic-389257-h7r0/ | "Date 28 May 2025 … Outcome Information withheld. Request for copies of internal guidance etc on whether data controllers established outside of the UK have to pay the data protection fee." |
| S70 | News, 20 January 2026: Fines of £225,000 for nuisance marketing messages — https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/01/fines-of-225-000-for-nuisance-marketing-messages | "ZMLUK Limited … has been fined £105,000 for sending over 67 million marketing emails between January and July 2023 without valid consent." · "Public reporting plays a crucial role in our work" |

### Open data, licensing, Companies House

| ID | Source | Key quotation(s) |
|---|---|---|
| S20 | Open Government Licence v3.0 — https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ | Quoted in 2.7, 4.1, 4.2 |
| S21 | The National Archives: Open Government Licence (UK Government Licensing Framework) — https://www.nationalarchives.gov.uk/information-management/re-using-public-sector-information/uk-government-licensing-framework/open-government-licence/ | "The OGL does not cover the use of personal data. Anyone re-using personal data must comply with the Data Protection Principles set out in Article 5 of the UK GDPR." · "The OGL requires you to attribute the information provider and source of the information." |
| S22 | Find a Tender supplier-information privacy notice — https://supplier-information.find-tender.service.gov.uk/privacy-notice?language=en_GB | "The purpose of FTS is to publish procurement notices and related information as required by the Procurement Act 2023 and Procurement Regulations 2024" |
| S38 | Find a Tender: Data and API documentation — https://www.find-tender.service.gov.uk/Developer/Documentation | "The UK is committed to open contracting. Notice data is available under the Open Government Licence." · "You can download notices in Open Contracting Data Standard (OCDS) JSON format using our API." |
| S39 | Find a Tender: Terms and conditions ("Last updated 24 February 2025") — https://www.find-tender.service.gov.uk/Home/TermsAndConditions | Linking, content, disclaimer and removal clauses quoted in section 4 · "We make most of the content on Find a Tender available through feeds for other websites and applications to use." |
| S37 | Companies House: URI customer guide (PDF, v1.1) — https://assets.publishing.service.gov.uk/media/5d08c0f340f0b6094a379078/uniformResourceIdentifiersCustomerGuide.pdf | Prefix table quoted in 1.3 |
| S42 | Companies House data products — https://www.gov.uk/guidance/companies-house-data-products | Quoted in 4.7 |
| S43 | Companies House API developer guidelines — https://developer.company-information.service.gov.uk/developer-guidelines | Quoted in 4.7 |

### Representatives, EDPB

| ID | Source | Key quotation(s) |
|---|---|---|
| S26 | EDPB Guidelines 3/2018 on the territorial scope of the GDPR (Version 2.1, adopted 12 November 2019) — https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_3_2018_territorial_scope_after_public_consultation_en_1.pdf | Quoted in 3.2 and 3.6. Not binding in the UK; the ICO cites the same test |
| S27 | Prighter, UK GDPR Representation (page dated 2026-10-14) — https://prighter.com/privacy-representation/uk-gdpr.md | "Small — €79/mo — €71/mo (€852/yr)" · "Growth — €39/mo — €35/mo (€420/yr)" |
| S28 | DPO Consulting, GDPR Representative Basic — https://www.dpo-consulting.com/gdpr-representative-basic | "€49 per month excluding VAT, billed monthly" |
| S29 | GDPR Local rate card — https://gdprlocal.com/terms/rate-card/ | "UK Representative (Art. 27 UK GDPR) £99 [<10 FTE] £149 £199 £350" — monthly fees |
| S30 | VeraSafe UK Data Protection Representative Program — https://info.verasafe.com/uk-data-protection-representative-program | "$0 to $25 million — $1,200/year" |
| S31 | IT Governance, GDPR UK Representative — https://www.itgovernance.eu/shop/product/gdpr-uk-representative | "Our service operates on an annual subscription basis" (price from search result only) |
| S36 | Osborne Clarke, ICO fees for data controllers (2018) — https://www.osborneclarke.com/insights/update-to-uk-information-commissioners-office-fees-for-data-controllers-when-and-what-to-pay | "There is no separate jurisdictional ambit to this requirement. Consequently … data controllers outside the UK would be required to pay where either: they process personal data in the context of an establishment in the UK; or … the processing relates to … the offering of goods or services to data subjects in the UK" (secondary source) |

### Paddle

| ID | Source | Key quotation(s) |
|---|---|---|
| S44 | Acceptable Use Policy ("Last Updated 13 April 2026") — https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle | Quoted in 5.1 |
| S45 | Paddle Master Services Agreement ("Last updated: 6 October 2026") — https://www.paddle.com/legal/terms | Quoted in 5.1 (definitions; cl. 11.1(xi), (xv); 14.2; 16.3; 17.2) |
| S46 | Retain and Metrics Acceptable Use Policy ("Last Updated: 1 February 2023") — https://www.paddle.com/legal/retain-and-metrics-acceptable-use-policy | "You may not use our Services to directly or indirectly send … (a) unsolicited email ('Spam' or 'Spamming') in violation of the CAN SPAM Act of 2003 or any Applicable Data Protection Laws; (b) an email to an address obtained via internet harvesting methods or otherwise without the consent of the contactee (e.g. scraping or harvesting)" |
| S47 | Which countries are supported by Paddle? — https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle | "Paddle works with software businesses anywhere in the world with the exception of the unsupported countries listed below." |

### Mailbox providers and tools

| ID | Source | Key quotation(s) |
|---|---|---|
| S48 | Google: Email sender guidelines — https://support.google.com/a/answer/81126?hl=en | Quoted in 6.1, 6.2, 6.6 |
| S49 | Google: Email sender guidelines FAQ — https://support.google.com/a/answer/14229414?hl=en | "The Email sender guidelines don't apply to messages sent to Google Workspace accounts. Sender requirements and Google enforcement apply only when sending email to personal Gmail accounts." · "Bulk sender status doesn't have an expiration date." |
| S50 | Yahoo Sender Hub: Sender Requirements & Recommendations — https://senders.yahooinc.com/best-practices/ | Quoted in 6.1 and 6.5 · "Don't purchase mailing lists" |
| S51 | Microsoft: Strengthening Email Ecosystem — Outlook's New Requirements for High-Volume Senders — https://techcommunity.microsoft.com/blog/microsoftdefenderforoffice365blog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730 | Quoted in 6.1 |
| S52 | Google Workspace Acceptable Use Policy ("Last modified: October 12, 2026") — https://workspace.google.com/terms/use_policy.html | Quoted in 6.2 |
| S53 | Microsoft Learn: Exchange Online limits — https://learn.microsoft.com/en-us/office365/servicedescriptions/exchange-online-service-description/exchange-online-limits | Quoted in 6.2–6.3 |
| S54 | Google Workspace: Gmail sending limits — https://support.google.com/a/answer/166852?hl=en | Quoted in 6.3 |
| S55 | Microsoft: Exchange Online to introduce External Recipient Rate Limit ("Updated Jan 06, 2026") — https://techcommunity.microsoft.com/blog/exchange/exchange-online-to-introduce-external-recipient-rate-limit/4114733 | Quoted in 6.3 |
| S56 | Vendor blogs returned by one web search on cold-email limits, e.g. https://leadhaste.com/blog/cold-email-sending-limits-2026 · https://www.unifygtm.com/explore/cold-email-daily-sending-limits-deliverability · https://salesforge.ai/blog/best-practices-for-domain-warm-up | Search summary only; pages not individually read. Secondary, commercially interested sources |
| S57 | Smartlead pricing — https://www.smartlead.ai/pricing | "Base $32 /month … 2,000 contacts, 6,000 Email sends" · "Pro $78 /month … 30,000 contacts, 90,000 Email sends" · "Google Provider … $13/domain/year, $4.5/mailbox/month" |
| S58 | Instantly pricing — https://instantly.ai/pricing | "Growth $47/monthly … 1000 Uploaded Contacts, 5000 Emails Monthly" · "Hypergrowth $107/monthly … 25 000 Uploaded Contacts, 125 000 Emails Monthly" |
| S59 | lemlist pricing — https://www.lemlist.com/pricing | "Email … $69 / $55 / MONTH … 50,000 emails/mo … Unlimited users & Email senders" |

### Other jurisdictions

| ID | Source | Key quotation(s) |
|---|---|---|
| S60 | USA: 15 U.S.C. § 7704 (CAN-SPAM) — https://www.law.cornell.edu/uscode/text/15/7704 | Quoted in 7.2 and 9 |
| S61 | Canada: CASL (S.C. 2010, c. 23) ss. 6, 10(9), 20(4) — https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html · /page-3.html; Electronic Commerce Protection Regulations (CRTC) SOR/2012-36 — https://laws-lois.justice.gc.ca/eng/regulations/SOR-2012-36/FullText.html | Quoted in 9 |
| S62 | Ireland: S.I. No. 336/2011 reg. 13 — https://www.irishstatutebook.ie/eli/2011/si/336/made/en/print | Quoted in 9 |
| S63 | Australia: Spam Act 2003, compilation of 10 March 2016, Sch. 2 cl. 4 and Part 3 — https://www.legislation.gov.au/C2004A01214/2016-03-10/2016-03-10/text/original/epub/OEBPS/document_1/document_1.html | Quoted in 9 |
| S64 | New Zealand: Unsolicited Electronic Messages Act 2007 ss. 4, 9–11 — https://www.legislation.govt.nz/act/public/2007/0007/latest/whole.html | Quoted in 9 |
| S65 | Canada: PIPEDA ss. 4.01 and 7.1 — https://laws-lois.justice.gc.ca/eng/acts/P-8.6/section-4.01.html · /section-7.1.html | Quoted in 9 |
| S66 | USA: 16 CFR § 1.98 (current eCFR text; also at Cornell LII) — https://www.ecfr.gov/api/renderer/v1/content/enhanced/current/title-16?part=1&section=1.98 · https://www.law.cornell.edu/cfr/text/16/1.98 | "(d) Section 5(m)(1)(A) of the FTC Act, 15 U.S.C. 45(m)(1)(A)—$53,088" |
| S67 | France: CNIL, La prospection commerciale par courrier électronique (10 juin 2026) — https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique | Quoted in 9 |
| S68 | Sweden: Marknadsföringslag (2008:486) §§ 19–21 — https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/marknadsforingslag-2008486_sfs-2008-486/ | "19 § En näringsidkare får vid marknadsföring till en fysisk person använda elektronisk post … bara om den fysiska personen har samtyckt till det på förhand." |
| S69 | Finland: Act on Electronic Communications Services 917/2014 ss. 200, 202, 203 (unofficial translation, Finlex) — https://www.finlex.fi/en/legislation/translations/2014/eng/917 | Quoted in 9 |
