# UK public procurement: reference for builders

Checked against primary sources on 2026-11-13. Companion data profile: `fts-data-profile.md`.

How to read this file:

- Every **fact** ends with a source key in square brackets; keys resolve to URLs in [Sources](#sources). Each source was fetched on 2026-11-13; long guidance documents were read in the sections cited, not always end to end.
- `[SAMPLE]` = measured on the local Find a Tender sample (7,176 releases, 23 Oct–12 Nov 2026); details in `fts-data-profile.md`.
- **REC** marks my recommendation, not a rule. **UNKNOWN** marks something I could not confirm from a primary source.
- "The Act" = Procurement Act 2023. "PCR" = Public Contracts Regulations 2015. "CDP" = central digital platform. "FTS" = Find a Tender service.

## 0. Corrections to common assumptions (including some in the original brief)

| Assumption | What the sources say |
|---|---|
| UK12 is the below-threshold tender notice | UK12 is the **procurement termination notice**. A below-threshold tender is advertised with a **UK4** tender notice. [FTS-NT] |
| There is a UK8 notice | The official list runs UK1–UK7, UK9–UK17. UK8 is not listed. [FTS-NT] |
| Crown Commercial Service (CCS) runs the frameworks | CCS was replaced by the **Government Commercial Agency (GCA)** on 1 April 2026; site `gca.gov.uk`. [CCS-ORG], [GCA] |
| PPN 02/24 governs AI in bids | PPN 02/24 covers only procurements started under the PCR. For Act procurements it is **PPN 017**. [PPN-LIST], [PPN017] |
| PPN 06/20 is the Social Value Model | PPN 06/20 is PCR-only. **PPN 002** applies now; **PPN 026** replaces it for procurements starting on or after 1 January 2027. [PPN-LIST], [PPN002], [PPN026] |
| Contracts are awarded on MEAT | The basis is now the **most advantageous tender (MAT)**. [ACT-s19], [G-ACT] |
| Below-threshold contracts are on Contracts Finder | For procurements started on or after 24 February 2025 they are on FTS only. [PPN019-G], [G-BT] |
| Thresholds are the figures from the 2025 go-live | They changed on 1 January 2026: goods and services are now **£135,018** (central) and **£207,720** (sub-central), including VAT. [G-THR] |
| "SME" is whatever the supplier says, or an EU test | The Act defines it in sterling: fewer than 250 staff **and** (turnover ≤ £44m **or** balance sheet ≤ £38m). [ACT-s123] |
| The debarment list names banned suppliers | The published list (V1.0, effective 17 November 2025) is **blank**. [DEB-LIST] |

---

# Part A. The regime

## A1. Who publishes what, and where

| Topic | Fact | Source |
|---|---|---|
| Start date | The Act applies to procurements commenced on or after 24 February 2025. | [G-TR], [FTS-NT] |
| Old regime | Procurements commenced earlier stay under the previous legislation (PCR 2015, Utilities 2016, Concessions 2016, Defence 2011) until the contract ends. So do call-offs from frameworks and dynamic purchasing systems set up under it, until the last call-off contract ends. | [G-TR] |
| Old-regime notices | Further notices about such procurements must use the old notice types (F01–F25). | [FTS-NT] |
| The platform | The CDP is `https://www.find-tender.service.gov.uk/`: an enhanced Find a Tender plus a Supplier Information Service, with one registration. | [G-CDP], [G-COLL] |
| Publish first on the CDP | A notice must be published on the CDP before it is posted anywhere else. | [G-CDP] |
| Who | All contracting authorities under the Act publish there, for covered (above-threshold) and notifiable below-threshold procurements. | [G-CDP], [G-BT] |
| Contracts Finder | The Act does not require anything on Contracts Finder. It still receives award notices for PCR-commenced procurements, call-offs from PCR frameworks and PCR below-threshold awards. | [PPN019], [PPN019-G] |
| Scotland | Devolved Scottish authorities are excluded from the Act. They stay under the Public Contracts (Scotland) Regulations 2015, the Scottish utilities and concessions regulations, and the Procurement Reform (Scotland) Act 2014. | [G-DEV], [SPPN5] |
| Scotland: where | Regulated procurements (£50,000 goods/services, £2,000,000 works, excluding VAT) must be publicised on the Public Contracts Scotland website. | [SCOT-S23], [SCOT-THR] |
| Scotland: cross-border | If a Scottish authority calls off from a framework or dynamic market set up under the Act (for example a GCA one), the Act's rules largely apply to the call-off. If a non-Scottish authority leads a joint procurement, the Act applies. | [SPPN5] |
| Scotland in the feed | 208 old-style releases in the sample link to `api.publiccontractsscotland.gov.uk`; 12 Act buyer entries carry the `GB-SCT` flag. | [SAMPLE] |
| Wales | Devolved Welsh authorities are inside the Act but must publish through Sell2Wales (the "Welsh Digital Platform"), which passes notices to the CDP. Suppliers still register on the CDP. | [WALES-WDP] |
| Northern Ireland | Transferred NI authorities are inside the Act, but the below-threshold rules (Part 6) do not apply to them, and pipeline, contract change and payments compliance notices are not required. | [G-BT], [FTS-NT] |
| eTendersNI | Advertises opportunities for NI departments, agencies and arm's-length bodies; suppliers register there to respond. | [ETNI] |
| Schools | Below-threshold rules and several notices do not apply to schools. | [G-BT], [FTS-NT] |
| Mix today | 86% of releases in the sample are Act notices; 14% are old-regime notices. | [SAMPLE] |

- UNKNOWN: the exact rule by which Public Contracts Scotland and eTendersNI forward notices to FTS; I observed the result in the feed but did not read a primary source for the mechanism.

## A2. Notice types under the Act

Codes, names and rules are from [FTS-NT]. The last column is **REC** (my advice for a supplier-facing product).

| Code | Name | Purpose and key rule | REC: what a supplier should do |
|---|---|---|---|
| UK1 | Pipeline notice | Potential future contracts and dynamic markets. Required between 1 April and 26 May for contracts over £2m expected in the next 18 months, from authorities spending over £100m a year. | Add to a watch list; note the expected tender date; start positioning early. |
| UK2 | Preliminary market engagement notice | Says how the buyer will engage, or has engaged, the market. Must precede a UK4 if engagement happened above threshold, or the UK4 must explain why not. | Take part before the engagement deadline; this is the cheapest point to influence scope and lots. |
| UK3 | Planned procurement notice | Early warning of a competitive procurement. If published 40 days to 1 year before the UK4, the minimum tendering period drops to 10 days. | Prepare now: the tender window may be only 10 days. |
| UK4 | Tender notice | Invites tenders or requests to participate (open or competitive flexible procedure), including framework set-up and dynamic-market competitions. Also used below threshold. | Decide bid/no-bid; register on the buyer's portal; diarise the clarification and submission deadlines. |
| UK5 | Transparency notice | Published before a direct award, including a switch from a failed competition. | If you could have supplied, raise it with the buyer quickly; otherwise log who won what without competition. |
| UK6 | Contract award notice | Award decision before signature, including framework call-offs and direct awards. Starts the standstill of at least 8 working days where one applies. | Losing bidder: read your assessment summary and act before standstill ends. Others: record the winner and value. |
| UK7 | Contract details notice | After signature, above and below threshold. Due within 30 days (120 for light touch). Contract copy attached within 90 days for contracts over £5m. | Record incumbent, value, end date and extension; this is the re-tender calendar. |
| UK9 | Contract performance notice | KPI scores; also breaches and failures to improve. Not required where no KPIs are set. | Check your own scores; a poor rating can support exclusion elsewhere. |
| UK10 | Contract change notice | Before changing value or term, or on transfer after restructuring. | Incumbent extended: move the expected re-tender date. |
| UK11 | Contract termination notice | Within 30 days of a contract ending, including normal completion. | Confirms an end date; if early termination, expect a replacement procurement. |
| UK12 | Procurement termination notice | The procurement, or some of its contracts, is cancelled before signature. | Stop work on the bid; watch for a re-run. |
| UK13 | Dynamic market intention notice | Before a dynamic market is established; suppliers can apply to join. | Apply for membership. |
| UK14 | Dynamic market establishment notice | The market is live and lists its members; more suppliers can still join. | Apply if not yet a member. |
| UK15 | Dynamic market modification notice | Changes, including suppliers added or removed. | No action unless it is about you. |
| UK16 | Dynamic market cessation notice | The market has closed. | Stop relying on it as a route to market. |
| UK17 | Payments compliance notice | Six-monthly prompt-payment statistics per authority, due within 30 days of 31 March and 30 September. | Use as evidence of a buyer's payment behaviour. |

- A UK4 must be published before a notifiable below-threshold contract is advertised elsewhere, and a UK7 after it is signed. Other notice types are optional below threshold. [FTS-NT], [ACT-s87]
- Linked notices share one procurement identifier (OCID). A direct award after a failed competition gets a new OCID that links back. [FTS-NT], [G-CDP]
- Not required for private utilities: UK1, UK7, UK9, UK10, UK11, UK12, UK16, UK17. [FTS-NT]
- Separate from notices: since 1 April 2026 authorities must publish, quarterly, each payment over £30,000 (including VAT) made under public contracts whose procurement began on or after that date. It is uploaded as a spreadsheet "payment report". [G-CPI]
- UNKNOWN: whether "UK8" was ever assigned, and whether the quarterly payment data can be read through the OCDS API (it is absent from the sample).

## A3. Procedures, thresholds and the rules suppliers meet

### Procedures

| Route | Fact | Source |
|---|---|---|
| Open procedure | Single stage; any supplier may tender. | [G-CTP] |
| Competitive flexible procedure | Any other competitive procedure the authority designs. Required if it wants to limit the number of suppliers, use a dynamic market, or reserve the contract. Replaces restricted, competitive dialogue and negotiated procedures. | [G-CTP] |
| Direct award | Only with a justification in Schedule 5 (prototypes, single supplier for artistic, IP or technical reasons, additional or repeat supplies, commodities, insolvency terms, urgency, user choice, defence), under regulations to protect life, or by switching after a failed competition. A transparency notice comes first. | [G-DA] |
| Framework | A contract providing for future call-off contracts. Maximum term 4 years (8 for defence and utilities) unless a longer term is justified in the notice. Fees may be charged only to suppliers that win a call-off, as a fixed percentage of its value. | [G-FW] |
| Open framework | A scheme of successive frameworks on substantially the same terms, up to 8 years in total, re-opened at least once in the first 3 years and at least every 5 years after. Cannot be directly awarded. | [G-FW] |
| Call-off | Awarded under the framework's own terms, not by the competitive tendering rules; no UK4 is published. | [G-CTP], [FTS-NT] |
| Dynamic market | A list of qualified suppliers that stays open to new joiners at all times. Contracts under it use the competitive flexible procedure. Replaces dynamic purchasing systems and qualification systems. | [G-DM] |
| Reserved contracts | A contract can be reserved for supported employment providers (at least 30% of employees disabled or disadvantaged). | [G-RES] |
| Lots | Before a UK4 the authority must consider splitting into lots, and give reasons in the notice if it does not. | [G-LOTS] |

### Minimum time periods (above threshold)

| Situation | Minimum | Source |
|---|---|---|
| Request to participate (competitive flexible) | 25 days (10 if urgent; none for light touch) | [G-TIME] |
| Tender, electronic, all documents with the notice | 25 days | [G-TIME] |
| Tender, electronic, documents not all provided | 30 days | [G-TIME] |
| Tender, not electronic | 30 or 35 days | [G-TIME] |
| After a qualifying planned procurement notice, urgency, or under a dynamic market | 10 days | [G-TIME] |
| Light touch contracts | No minimum | [G-TIME] |
| Below threshold | "Reasonable" and the same for all suppliers | [ACT-s87] |

Observed: median 30 days from publication to deadline above threshold, 25 days below (10th percentile 14 days). [SAMPLE]

### Thresholds, including VAT, 1 January 2026 to 31 December 2027

| Contract type | Threshold | Source |
|---|---|---|
| Goods and services, central government authority | £135,018 | [G-THR] |
| Goods and services, sub-central authority | £207,720 | [G-THR] |
| Works | £5,193,000 | [G-THR] |
| Utilities goods and services | £415,440 | [G-THR] |
| Utility works; concessions | £5,193,000 | [G-THR] |
| Defence and security goods and services / works | £415,440 / £5,193,000 | [G-THR] |
| Light touch (general / utilities / concession) | £663,540 / £884,720 / £5,372,609 | [G-THR] |

- Values are estimated including VAT. The international-agreement thresholds are reset every two years on 1 January of even years; the current figures were set by S.I. 2025/1200 and announced in PPN 023. [G-THR], [ACT-s85]
- NHS trusts and foundation trusts count as central government authorities. [G-BT]

### Below-threshold rules that matter to SMEs

| Rule | Fact | Source |
|---|---|---|
| Regulated below-threshold contract | A below-threshold contract that is not exempted, a concession or a utilities contract. | [G-BT] |
| Notifiable | Value at least £12,000 (central government) or £30,000 (everyone else), including VAT. | [ACT-s87] |
| Advertising | If the authority advertises a notifiable contract it must first publish a below-threshold tender notice on the CDP. Not needed if it only invites particular or pre-selected suppliers. | [ACT-s87], [G-BT] |
| No pre-qualification | It may not restrict who can tender by assessing suitability (legal and financial capacity, technical ability). Suitability can still be assessed at award. | [ACT-s85], [G-BT] |
| Exception | Works contracts worth at least £135,018 (central) or £207,720 (others) may have a suitability stage. Framework call-offs are also outside the ban. | [ACT-s85] |
| SME duty | Before inviting tenders the authority must have regard to barriers SMEs face and consider removing them. | [ACT-s86] |
| After award | A contract details notice for every notifiable contract, including quotes from one supplier and framework call-offs. Guidance: usually within 30 days (central) or 90 days (others); 120 for light touch. | [ACT-s87], [G-BT] |
| Supplier registration | Since 1 April 2026 suppliers awarded notifiable below-threshold contracts must be registered on the CDP and give the buyer their identifier. | [G-CDP] |
| Payment | 30-day payment terms are implied into regulated below-threshold contracts and their sub-contracts. | [G-PAY] |
| Reserving (central government) | Departments may reserve a below-threshold competition to UK suppliers or to one county or London borough, and additionally to SMEs and VCSEs. The SME/VCSE reservation cannot be used without the location reservation. | [PPN005] |
| Reserving (local government) | English local authorities may reserve to UK or local suppliers under a 2026 Order. | [G-BT] |
| Flexibility | Authorities may also award below threshold without competition or ask selected suppliers for quotes. | [G-BT] |
| Not covered | Schools and transferred NI authorities are outside these rules. | [G-BT] |

Observed: 80% of contract details notices are below threshold; of those, the procedure label is "without competition" on 41%, "limited competition" on 25%, "open competition" on 10%, "award under framework" on 7% and "unknown" on 14%. [SAMPLE]

### Covered (above-threshold) rules

| Topic | Fact | Source |
|---|---|---|
| Objectives | Authorities must have regard to value for money, public benefit, sharing information and integrity; treat suppliers the same; and have regard to SME barriers. | [ACT-s12] |
| Basis of award | The most advantageous tender: the one that satisfies the requirements and best satisfies the award criteria under the published assessment methodology and weightings. | [ACT-s19] |
| Award criteria | Must relate to the subject matter. Relative importance must be stated (weights, ranking or description). Pass/fail criteria are allowed. Price-only awards are possible but unusual. | [G-ACT] |
| Abnormally low price | The authority may disregard such a tender, but must first let the supplier show it can perform at that price. | [ACT-s19] |
| Conditions of participation | Only legal and financial capacity or technical ability, and only if proportionate. | [G-COP] |
| CoP limits | No requirement for audited accounts unless the supplier is legally required to have them. No requirement to hold insurance before award. No requirement for experience with one particular authority. Equivalent qualifications must be accepted. | [G-COP] |
| Standstill | At least 8 working days, starting the day the contract award notice is published. Not mandatory for framework call-offs, dynamic-market awards, light touch contracts and urgent direct awards. | [G-CAN] |
| Challenge | A claim issued and notified during standstill automatically suspends signature. | [G-CAN] |
| Assessment summary | Before the award notice, every supplier whose tender was assessed at the final stage gets one, all at the same time. | [G-AS] |
| Summary content | The criteria and how they were assessed, your score for each criterion and sub-criterion with reasons, and the total. An unsuccessful supplier also gets the winner's scores and reasons (redacted if needed) and should normally be told the winner's name. No direct comparison is required. | [G-AS] |
| Earlier-stage rejection | No statutory summary, but authorities should tell the supplier promptly and are advised to use the same feedback structure. | [G-AS] |
| KPIs | Contracts over £5m need at least three published KPIs, unless KPIs are unsuitable. Not for frameworks, concessions or light touch. | [G-KPI] |
| Performance reporting | Scores against KPIs at least every 12 months and at termination, using Good / Approaching target / Requires improvement / Inadequate / Other. | [G-KPI], [G-CPN] |
| Payment | Authorities must pay undisputed invoices within 30 days; the same term is implied into sub-contracts. | [ACT-s68], [G-PAY] |
| Debarment | Ministers may put suppliers on a published list; authorities must check it in every covered procurement and must or may exclude listed suppliers. Entry usually lasts up to 5 years from the event. | [G-DEB] |
| Debarment today | Investigations are run by the Debarment Review Service, part of GCA since 1 April 2026. The current list is blank. | [DRS], [DEB-LIST] |
| National policy | Authorities must have regard to the National Procurement Policy Statement (not for call-offs, dynamic-market awards, private utilities, or Welsh and NI devolved procurement). | [G-NPPS], [NPPS] |
| Planned changes | The government response (26 March 2026) to its reform consultation says further legislation depends on parliamentary time. Nothing further is in force. | [CONS] |

## A4. Supplier registration and the PSQ

| Topic | Fact | Source |
|---|---|---|
| Cost and login | Registration is free and uses GOV.UK One Login. One person registers the organisation and becomes administrator. | [SG-REG] |
| Identifier | Each organisation gets a unique identifier; a Companies House, charity, NHS or similar number can be supplied at registration. On notices it is labelled "Public Procurement Organisation Number". | [G-CDP], [SAMPLE] |
| Core supplier information | Four categories: basic information; economic and financial standing (latest accounts); connected persons; exclusion grounds. | [G-CDP] |
| What the screens ask for | Basic information, connected persons, qualifications, trade assurances, exclusions, financial information (accounts uploads). | [SG-WALK] |
| Sharing | The supplier declares the information accurate, then shares it by **share code** (entered in the buyer's tender portal) or by downloading a file. Update and re-share creates a new code. | [SG-WALK] |
| User roles | Administrator, editor (can create share codes), viewer (can see the share code). | [SG-WALK] |
| Deadline | In a competitive procedure the buyer must have confirmation that the supplier registered and shared its information before the tender deadline. | [G-CDP] |
| No duplicate asks | Buyers must not separately request information that the regulations place on the CDP. | [G-CDP] |
| Visibility | Supplier information is seen only by authorities the supplier shares it with. | [G-CDP] |

**Procurement Specific Questionnaire (PSQ)**: the Cabinet Office template that fulfils the role of the old Standard Selection Questionnaire. Current template: V2.0. [PSQ]

| Part | Content | Typical questions |
|---|---|---|
| Preliminary | Identity and status | Supplier name; CDP unique identifier; single bidder or consortium (structure, lead, your role); lots bid for; "Are you on the debarment list?" |
| Part 1 | Confirmation of core supplier information | Confirm you have shared up-to-date information through the CDP (share code or PDF). |
| Part 2A | Associated persons | Are you relying on others to meet conditions of participation? Which conditions? Confirm each has shared CDP information. Any on the debarment list? |
| Part 2B | Intended sub-contractors | List them with identifiers and roles; any on the debarment list? |
| Part 3A | Conditions of participation: standard | Financial capacity; guarantor; insurance you hold or commit to obtain before award; data protection measures; up to three relevant contract examples (past three years for goods and services) with customer contacts; sub-contractor management; organisational standards; health and safety. |
| Part 3B | Central government questions tied to PPNs | Supply-chain payment performance (contracts over £5m a year, pass/fail); Carbon Reduction Plan (over £5m a year); modern slavery; steel. Central government buyers should not edit these. |

- UNKNOWN: whether the template has been reissued since V2.0. V2.0 labels the payment questions "PPN 015"; PPN 018 replaced PPN 015 on 1 October 2025.

## A5. Social value and the standard pass/fail policies

Scope note: unless stated, these PPNs bind central government departments, executive agencies and non-departmental public bodies; other authorities "may" follow them. [PPN-LIST]

| Policy | Applies to | Requirement | Source |
|---|---|---|---|
| **PPN 002** Social Value Model (Feb 2025) | Covered procurements commenced under the Act; mandatory from 1 October 2025. Not below threshold. | Minimum **10%** of the total score for social value (10% of the quality score where price-per-quality-point methods are used). Commitments must go into the contract. | [PPN002] |
| **PPN 026** Social Value Model (5 Aug 2026; guidance 28 Oct 2026) | Covered procurements of **£1m or more** commenced on or after **1 January 2027**. Until then PPN 002. | Minimum **10%** for £1m to under £5m; **20%** for £5m or more; 0% below £1m. Two outcomes (good jobs; skills), six model award criteria. At least one social value KPI for contracts of £5m or more. | [PPN026], [PPN026-G] |
| PPN 003 Social Value Act 2012 | Certain service contracts | Authorities must consider economic, social and environmental wellbeing before the procurement starts. | [PPN003] |
| **PPN 006** Carbon Reduction Plan | Contracts above **£5m a year** including VAT | Condition of participation: a published plan confirming net zero by 2050 for UK operations, with Scope 1, 2 and a subset of Scope 3 emissions. | [PPN006] |
| **PPN 014** Cyber Essentials | Also NHS bodies. No value threshold; depends on contract characteristics (personal data, OFFICIAL-level ICT systems). | Cyber Essentials or Plus, or equivalent controls; renewed annually. Must not be applied as a blanket rule. | [PPN014] |
| **PPN 009** Modern slavery | Also NHS bodies. Risk-based. | Buyers assess risk; high-risk procurements require supply-chain information; exclusion grounds apply. | [PPN009] |
| **PPN 018** Prompt payment in major contracts | Contracts above **£5m a year**; from 1 October 2025. Not NHS trusts. | Via the PSQ: at least 95% of invoices paid within 60 days (90% with an action plan) **and** an average of 45 days or less. | [PPN018] |
| PPN 021 Payment spot checks | In-scope contracts advertised from 1 October 2025 | Buyers spot-check that suppliers pay sub-contractors on 30-day terms, at least every six months. | [PPN021] |
| PPN 001 SME and VCSE targets | Departments | Three-year targets for direct SME spend from 1 April 2025 and VCSE targets from 1 April 2026; results published annually. | [PPN001] |
| National Procurement Policy Statement | In force 24 February 2025 | Priorities: value for money; growth through giving SMEs and VCSEs a fair chance; social and economic value supporting the missions; commercial capability. | [NPPS] |

How social value answers are scored:

- One question asks for specific, measurable, time-bound commitments in a method statement with an implementation plan, within a word limit set by the buyer. [PPN002-G], [PPN026-G]
- Scoring is qualitative, in the same way as other quality criteria. The quantity offered is recorded as a commitment, but the plan is what is marked. [PPN002-G], [PPN026-G]
- General corporate policies and CSR statements do not count; only actions in delivering this contract. Social value must be additional to the core service. [PPN002-G], [PPN026-G]
- Buyers may set a minimum score or a pass/fail standard for social value. [PPN002-G]
- PPN 026 example scale: 0, 1, 3, 6, 10. A response backed by a dated letter to a listed "Community Programme" and meeting the implementation criteria scores at least 6. [PPN026-G]
- Observed: 24% of tender notices name a social value criterion; its most common weight is 10%. [SAMPLE]
- UNKNOWN: the PPN 026 "List of Community Programmes"; the guidance says it will be published later.

## A6. Use of AI in bids (PPN 017, February 2025; first issued as PPN 02/24)

| Point | Fact [PPN017] |
|---|---|
| Status | An information note for central government; other authorities may adopt it. |
| Is AI allowed? | "Suppliers' use of AI is not prohibited during the commercial process." |
| What buyers may ask | Whether AI or machine-learning tools, including large language models, were used in any part of the tender; details; and confirmation that AI-assisted responses were checked for accuracy. Also whether AI is used in the goods or services offered. |
| Scoring | The example disclosure questions are for information only and must not be scored. Buyers can ask other, scored AI questions specific to the requirement if stated in the tender documents. |
| What buyers may do | Extra, proportionate due diligence: clarification questions, site visits, presentations. Controls against confidential tender material being used to train AI. Allow more time for higher volumes of bids and questions. |
| What a supplier must do | Answer the disclosure question truthfully where it is asked, and be able to confirm that content was verified. |

REC: treat disclosure as likely, keep a human verification step and a record of it, and never place a buyer's non-public documents into a tool that trains on inputs.

## A7. Glossary

| Term | Meaning | Source |
|---|---|---|
| ITT | Invitation to tender: a formal request for bids. | [GCA-GLOSS] |
| RFQ / RFP | Request for quotation / proposal; used loosely alongside ITT. The data labels below-threshold procedures "open competition", "limited competition" or "without competition"; it has no RFQ field. | [GCA-GLOSS], [SAMPLE] |
| PQQ | Pre-qualification questionnaire: an older shortlisting stage. Below threshold a separate suitability stage is banned. | [G-BT] |
| SQ | Standard Selection Questionnaire, used under the PCR. | [GCA-GLOSS], [PPN-LIST] |
| PSQ | Procurement Specific Questionnaire, its Act-era replacement. | [PSQ] |
| MAT / MEAT | Most advantageous tender (Act) / most economically advantageous tender (PCR). | [G-ACT] |
| TUPE | Transfer of Undertakings (Protection of Employment) Regulations 2006; relevant when staff move to a new contractor. | [TUPE] |
| CPV | Common Procurement Vocabulary: 8-digit codes; first two digits are the division. | [CPV-REG] |
| Lot | A part of a procurement that can be awarded as a separate contract. | [G-LOTS] |
| Framework call-off | A contract awarded under a framework. | [G-FW] |
| Mini-competition | Informal name for competing a call-off among framework suppliers: "further competition" under the PCR, "competitive selection process" under the Act. | [GCA-GLOSS], [G-CDP], [PPN019-G] |
| DPS | Dynamic purchasing system (PCR): like a framework, but suppliers can join at any time. | [GCA-GLOSS] |
| Dynamic market | The Act's replacement for the DPS. | [G-DM] |
| KPI | A measure of a supplier's contract performance; three or more for contracts over £5m. | [G-KPI] |
| Clarification question | A question to the buyer during the tender; the notice gives an enquiry deadline (`tender.enquiryPeriod.endDate`, on 85% of tender notices). | [SAMPLE] |
| Standstill | The pause of at least 8 working days between the award notice and signature. | [G-CAN] |
| Light touch | A special regime for certain service contracts, with its own higher threshold, no minimum time limits and no mandatory standstill. Flagged in the data as `specialRegime: ["lightTouch"]`. | [G-THR], [G-TIME], [G-CAN], [SAMPLE] |
| SME (in the data) | `details.scale = "sme"`: fewer than 250 staff and turnover ≤ £44m or balance sheet ≤ £38m. Group links can change the answer. | [UKEXT], [ACT-s123], [SG-SME] |
| VCSE | Voluntary, community or social enterprise. | [UKEXT] |
| PPON | Public Procurement Organisation Number: the CDP identifier (`GB-PPON-…` in the data). | [SAMPLE], [DEB-LIST] |
| OCID | The identifier that links all notices of one procurement. | [FTS-NT] |

---

# Part B. The data, in brief

Full measurements, JSON paths, schema and SQL are in `fts-data-profile.md`. Headlines:

| Topic | Fact | Source |
|---|---|---|
| Endpoint | `GET https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages` with `updatedFrom`, `updatedTo`, `stages`, `limit` (max 100), `cursor`; or append a notice id or ocid. Record packages: `/api/1.0/ocdsRecordPackages/{ocid}`. | [FTS-REL], [FTS-REC] |
| Limits | 429 with `Retry-After`; no published quota. Observed: three 429s (`Retry-After: 120`) in about 125 requests spaced 10 s apart. | [FTS-REL], [SAMPLE] |
| Licence | Open Government Licence v3.0. Required statement: "Contains public sector information licensed under the Open Government Licence v3.0." The licence does not cover personal data. | [FTS-DEV], [OGL] |
| Volume | About 2,200–2,500 releases a week. | [SAMPLE] |
| Mix | UK7 36%, UK4 18%, UK6 14%, old-regime awards 10%, UK2 8%, UK5 4%. | [SAMPLE] |
| Notice type | Not in `tag`. Read `documents[].noticeType` on the document whose `id` equals the release `id`. | [SAMPLE] |
| Snapshots | Each release describes one notice; award releases do not repeat tender fields. Compile by `ocid`. | [SAMPLE] |
| Reliable on tenders (UK4) | Title, description, CPV, category, gross value, lots, contract dates, threshold flag, procedure, buyer id and type, submission text: 100%. Deadline: 100% (tender or request-to-participate). | [SAMPLE] |
| Patchy on tenders | Numeric award weights 65% (85% above threshold, 40% below); delivery region 81%; clarification deadline 85%; tender document links 36%. | [SAMPLE] |
| Reliable on contracts (UK7) | Supplier id, SME flag, gross value, start and end dates, signature date, threshold flag, CPV: 99–100%. | [SAMPLE] |
| Patchy on contracts | Net value 85%; delivery region 69%; extension date 24%; KPIs 7%; bid counts 0% (they are on UK6, 51%). | [SAMPLE] |
| Below threshold | 80% of UK7 and 44% of UK4. | [SAMPLE] |
| Suppliers | 57% of supplier entries are flagged SME; 3% are non-UK; 7% of supplier names map to more than one identifier. | [SAMPLE] |

REC (schema, one line): `release` (raw) → `procurement` (by ocid) → `lot`, `award_criterion`, `procurement_cpv`, `procurement_region`, `award` + `award_supplier`, `contract`, with `organisation` + `org_identifier` (Companies House number and PPON) for buyers and suppliers.

## Unknowns

1. Meaning or existence of a "UK8" notice.
2. Whether quarterly contract payment data and UK16/UK17 notices are available through the OCDS API.
3. The API's actual request quota.
4. The PPN 026 List of Community Programmes and any sub-criteria beyond the October 2026 guidance.
5. Whether the PSQ template has been updated beyond V2.0.
6. How Public Contracts Scotland and eTendersNI notices are forwarded to FTS, and the date of the latest Welsh guidance revision.
7. Content of the 2026 Order that lets English local authorities reserve below-threshold contracts (cited by guidance; not read).
8. Timing and content of further legislation following the March 2026 consultation response.
9. Which edition of region codes (`UK…`) the feed uses.
10. How far policies written for central government (social value weighting, Carbon Reduction Plans, payment tests) are adopted by councils, NHS bodies and others in practice; the PPNs only say they "may".

## Sources

| Key | URL |
|---|---|
| FTS-NT | https://www.find-tender.service.gov.uk/Home/NoticeTypes |
| FTS-DEV | https://www.find-tender.service.gov.uk/Developer/Documentation |
| FTS-REL | https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages |
| FTS-REC | https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsRecordPackages |
| OGL | https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ |
| UKEXT | https://github.com/cabinetoffice/ocds_uk_extension |
| G-COLL | https://www.gov.uk/government/collections/procurement-act-2023-guidance-documents |
| G-CDP | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/guidance-central-digital-platform-and-publication-of-information-html |
| G-TR | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-plan-phase/guidance-transitional-and-saving-arrangements-html |
| G-DEV | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-plan-phase/guidance-devolved-contracting-authorities-html |
| G-NPPS | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-plan-phase/guidance-national-procurement-policy-statement-html |
| G-RES | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-plan-phase/guidance-reserving-contracts-for-supported-employment-providers-html |
| G-THR | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/guidance-thresholds-html |
| G-BT | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/guidance-below-threshold-contracts-html |
| G-CTP | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/competitive-tendering-procedures-html |
| G-DA | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/direct-award-html |
| G-FW | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/guidance-frameworks-html |
| G-DM | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/guidance-dynamic-markets-html |
| G-LOTS | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/guidance-lots-html |
| G-TIME | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/time-periods-html |
| G-ACT | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/assessing-competitive-tenders-html |
| G-COP | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/guidance-conditions-of-participation-html |
| G-AS | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/guidance-assessment-summaries-html |
| G-CAN | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/guidance-contract-award-notices-and-standstill-html |
| G-DEB | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/guidance-debarment-html |
| G-KPI | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-manage-phase/guidance-key-performance-indicators-html |
| G-CPN | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-manage-phase/guidance-contract-performance-notices-html |
| G-PAY | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-manage-phase/guidance-electronic-invoicing-and-payment-html |
| G-CPI | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-manage-phase/guidance-contract-payment-information-html |
| ACT-s12 | https://www.legislation.gov.uk/ukpga/2023/54/section/12 |
| ACT-s19 | https://www.legislation.gov.uk/ukpga/2023/54/section/19 |
| ACT-s68 | https://www.legislation.gov.uk/ukpga/2023/54/section/68 |
| ACT-s85 | https://www.legislation.gov.uk/ukpga/2023/54/section/85 |
| ACT-s86 | https://www.legislation.gov.uk/ukpga/2023/54/section/86 |
| ACT-s87 | https://www.legislation.gov.uk/ukpga/2023/54/section/87 |
| ACT-s123 | https://www.legislation.gov.uk/ukpga/2023/54/section/123 |
| PPN-LIST | https://www.gov.uk/government/collections/procurement-policy-notes |
| PPN001 | https://www.gov.uk/government/publications/ppn-001-sme-and-vcse-procurement-spend-targets/procurement-policy-note-001-sme-and-vcse-procurement-spend-targets-html |
| PPN002 | https://www.gov.uk/government/publications/ppn-002-taking-account-of-social-value-in-the-award-of-contracts/ppn-002-taking-account-of-social-value-in-the-award-of-central-government-contracts-html |
| PPN002-G | https://www.gov.uk/government/publications/ppn-002-taking-account-of-social-value-in-the-award-of-contracts/ppn-002-guide-to-using-the-social-value-model-html |
| PPN003 | https://www.gov.uk/government/publications/ppn-003-the-public-services-social-value-act-2012/ppn-003-the-public-services-social-value-act-2012-html |
| PPN005 | https://www.gov.uk/government/publications/ppn-005-reserving-below-threshold-procurements/ppn-005-reserving-below-threshold-html |
| PPN006 | https://www.gov.uk/government/publications/ppn-006-taking-account-of-carbon-reduction-plans-in-the-procurement-of-major-government-contracts/ppn-006-taking-account-of-carbon-reduction-plans-html |
| PPN009 | https://www.gov.uk/government/publications/ppn-009-tackling-modern-slavery-in-government-supply-chains/ppn-009-tackling-modern-slavery-in-government-supply-chains-html |
| PPN014 | https://www.gov.uk/government/publications/ppn-014-cyber-essentials-scheme/ppn-014-cyber-essentials-scheme-html |
| PPN017 | https://www.gov.uk/government/publications/ppn-017-improving-transparency-of-ai-use-in-procurement/ppn-017-improving-transparency-of-ai-use-in-procurement-html |
| PPN018 | https://www.gov.uk/government/publications/ppn-018-how-to-take-account-of-a-suppliers-approach-to-payment-in-the-procurement-of-major-contracts |
| PPN019 | https://www.gov.uk/government/publications/ppn-019-requirements-to-publish-on-contracts-finder/update-to-legal-requirements-to-publish-procurement-information-on-contracts-finder |
| PPN019-G | https://www.gov.uk/government/publications/ppn-019-requirements-to-publish-on-contracts-finder/guidance-on-the-transparency-requirements-for-publishing-on-contracts-finder |
| PPN021 | https://www.gov.uk/government/publications/ppn-021-payment-spot-checks-in-public-sub-contracts/ppn-021-payment-spot-checks-in-public-sub-contracts-html |
| PPN026 | https://www.gov.uk/government/publications/ppn-026-the-social-value-model/ppn-026-the-social-value-model-html |
| PPN026-G | https://www.gov.uk/government/publications/ppn-026-the-social-value-model/guidance-on-using-ppn-026-the-social-value-model-html |
| NPPS | https://www.gov.uk/government/publications/national-procurement-policy-statement |
| PSQ | https://www.procurementpathway.civilservice.gov.uk/documents/template/pa-2023-procurement-specific-questionnaire |
| SG-REG | https://www.gov.uk/government/publications/procurement-act-2023-short-guides/how-to-register-your-organisation-and-find-your-unique-identifier-a-guide-for-suppliers-html |
| SG-WALK | https://www.gov.uk/government/publications/procurement-act-2023-short-guides/suppliers-detailed-walkthrough-how-an-administrator-completes-and-updates-supplier-information-html |
| SG-SME | https://www.gov.uk/government/publications/procurement-act-2023-short-guides/supplementary-information-small-and-medium-sized-enterprises-definition-html |
| DRS | https://www.gov.uk/guidance/debarment-review-service-drs |
| DEB-LIST | https://assets.publishing.service.gov.uk/media/69cbc2028017673ffec0f329/2025-11-17_OFFICIAL-_Debarment_List_V1.0.pdf |
| CONS | https://www.gov.uk/government/consultations/public-procurement-growing-british-industry-jobs-and-skills-consultation-on-further-reforms-to-public-procurement |
| CCS-ORG | https://www.gov.uk/government/organisations/crown-commercial-service |
| GCA | https://www.gca.gov.uk/ |
| GCA-GLOSS | https://www.gca.gov.uk/glossary |
| SPPN5 | https://www.gov.scot/publications/public-procurement-cross-border-co-operation-within-the-uk-sppn-5-2026/ |
| SCOT-THR | https://www.gov.scot/publications/procurement-threshold-values/pages/procurement-threshold-values-from-1-january-2026-to-31-december-2027/ |
| SCOT-S23 | https://www.legislation.gov.uk/asp/2014/12/section/23 |
| WALES-WDP | https://www.gov.wales/procurement-act-2023-welsh-digital-platform-html |
| ETNI | https://etendersni.gov.uk/epps/home.do |
| TUPE | https://www.legislation.gov.uk/uksi/2006/246 |
| CPV-REG | https://www.legislation.gov.uk/eur/2008/213/annex/I/adopted |
| SAMPLE | Local harvest of the FTS OCDS API; see `fts-data-profile.md` section 0 |

[FTS-NT]: https://www.find-tender.service.gov.uk/Home/NoticeTypes
[FTS-DEV]: https://www.find-tender.service.gov.uk/Developer/Documentation
[FTS-REL]: https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages
[FTS-REC]: https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsRecordPackages
[OGL]: https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/
[UKEXT]: https://github.com/cabinetoffice/ocds_uk_extension
[G-COLL]: https://www.gov.uk/government/collections/procurement-act-2023-guidance-documents
[G-CDP]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/guidance-central-digital-platform-and-publication-of-information-html
[G-TR]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-plan-phase/guidance-transitional-and-saving-arrangements-html
[G-DEV]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-plan-phase/guidance-devolved-contracting-authorities-html
[G-NPPS]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-plan-phase/guidance-national-procurement-policy-statement-html
[G-RES]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-plan-phase/guidance-reserving-contracts-for-supported-employment-providers-html
[G-THR]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/guidance-thresholds-html
[G-BT]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/guidance-below-threshold-contracts-html
[G-CTP]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/competitive-tendering-procedures-html
[G-DA]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/direct-award-html
[G-FW]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/guidance-frameworks-html
[G-DM]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/guidance-dynamic-markets-html
[G-LOTS]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-define-phase/guidance-lots-html
[G-TIME]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/time-periods-html
[G-ACT]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/assessing-competitive-tenders-html
[G-COP]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/guidance-conditions-of-participation-html
[G-AS]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/guidance-assessment-summaries-html
[G-CAN]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/guidance-contract-award-notices-and-standstill-html
[G-DEB]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/guidance-debarment-html
[G-KPI]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-manage-phase/guidance-key-performance-indicators-html
[G-CPN]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-manage-phase/guidance-contract-performance-notices-html
[G-PAY]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-manage-phase/guidance-electronic-invoicing-and-payment-html
[G-CPI]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-manage-phase/guidance-contract-payment-information-html
[ACT-s12]: https://www.legislation.gov.uk/ukpga/2023/54/section/12
[ACT-s19]: https://www.legislation.gov.uk/ukpga/2023/54/section/19
[ACT-s68]: https://www.legislation.gov.uk/ukpga/2023/54/section/68
[ACT-s85]: https://www.legislation.gov.uk/ukpga/2023/54/section/85
[ACT-s86]: https://www.legislation.gov.uk/ukpga/2023/54/section/86
[ACT-s87]: https://www.legislation.gov.uk/ukpga/2023/54/section/87
[ACT-s123]: https://www.legislation.gov.uk/ukpga/2023/54/section/123
[PPN-LIST]: https://www.gov.uk/government/collections/procurement-policy-notes
[PPN001]: https://www.gov.uk/government/publications/ppn-001-sme-and-vcse-procurement-spend-targets/procurement-policy-note-001-sme-and-vcse-procurement-spend-targets-html
[PPN002]: https://www.gov.uk/government/publications/ppn-002-taking-account-of-social-value-in-the-award-of-contracts/ppn-002-taking-account-of-social-value-in-the-award-of-central-government-contracts-html
[PPN002-G]: https://www.gov.uk/government/publications/ppn-002-taking-account-of-social-value-in-the-award-of-contracts/ppn-002-guide-to-using-the-social-value-model-html
[PPN003]: https://www.gov.uk/government/publications/ppn-003-the-public-services-social-value-act-2012/ppn-003-the-public-services-social-value-act-2012-html
[PPN005]: https://www.gov.uk/government/publications/ppn-005-reserving-below-threshold-procurements/ppn-005-reserving-below-threshold-html
[PPN006]: https://www.gov.uk/government/publications/ppn-006-taking-account-of-carbon-reduction-plans-in-the-procurement-of-major-government-contracts/ppn-006-taking-account-of-carbon-reduction-plans-html
[PPN009]: https://www.gov.uk/government/publications/ppn-009-tackling-modern-slavery-in-government-supply-chains/ppn-009-tackling-modern-slavery-in-government-supply-chains-html
[PPN014]: https://www.gov.uk/government/publications/ppn-014-cyber-essentials-scheme/ppn-014-cyber-essentials-scheme-html
[PPN017]: https://www.gov.uk/government/publications/ppn-017-improving-transparency-of-ai-use-in-procurement/ppn-017-improving-transparency-of-ai-use-in-procurement-html
[PPN018]: https://www.gov.uk/government/publications/ppn-018-how-to-take-account-of-a-suppliers-approach-to-payment-in-the-procurement-of-major-contracts
[PPN019]: https://www.gov.uk/government/publications/ppn-019-requirements-to-publish-on-contracts-finder/update-to-legal-requirements-to-publish-procurement-information-on-contracts-finder
[PPN019-G]: https://www.gov.uk/government/publications/ppn-019-requirements-to-publish-on-contracts-finder/guidance-on-the-transparency-requirements-for-publishing-on-contracts-finder
[PPN021]: https://www.gov.uk/government/publications/ppn-021-payment-spot-checks-in-public-sub-contracts/ppn-021-payment-spot-checks-in-public-sub-contracts-html
[PPN026]: https://www.gov.uk/government/publications/ppn-026-the-social-value-model/ppn-026-the-social-value-model-html
[PPN026-G]: https://www.gov.uk/government/publications/ppn-026-the-social-value-model/guidance-on-using-ppn-026-the-social-value-model-html
[NPPS]: https://www.gov.uk/government/publications/national-procurement-policy-statement
[PSQ]: https://www.procurementpathway.civilservice.gov.uk/documents/template/pa-2023-procurement-specific-questionnaire
[SG-REG]: https://www.gov.uk/government/publications/procurement-act-2023-short-guides/how-to-register-your-organisation-and-find-your-unique-identifier-a-guide-for-suppliers-html
[SG-WALK]: https://www.gov.uk/government/publications/procurement-act-2023-short-guides/suppliers-detailed-walkthrough-how-an-administrator-completes-and-updates-supplier-information-html
[SG-SME]: https://www.gov.uk/government/publications/procurement-act-2023-short-guides/supplementary-information-small-and-medium-sized-enterprises-definition-html
[DRS]: https://www.gov.uk/guidance/debarment-review-service-drs
[DEB-LIST]: https://assets.publishing.service.gov.uk/media/69cbc2028017673ffec0f329/2025-11-17_OFFICIAL-_Debarment_List_V1.0.pdf
[CONS]: https://www.gov.uk/government/consultations/public-procurement-growing-british-industry-jobs-and-skills-consultation-on-further-reforms-to-public-procurement
[CCS-ORG]: https://www.gov.uk/government/organisations/crown-commercial-service
[GCA]: https://www.gca.gov.uk/
[GCA-GLOSS]: https://www.gca.gov.uk/glossary
[SPPN5]: https://www.gov.scot/publications/public-procurement-cross-border-co-operation-within-the-uk-sppn-5-2026/
[SCOT-THR]: https://www.gov.scot/publications/procurement-threshold-values/pages/procurement-threshold-values-from-1-january-2026-to-31-december-2027/
[SCOT-S23]: https://www.legislation.gov.uk/asp/2014/12/section/23
[WALES-WDP]: https://www.gov.wales/procurement-act-2023-welsh-digital-platform-html
[ETNI]: https://etendersni.gov.uk/epps/home.do
[TUPE]: https://www.legislation.gov.uk/uksi/2006/246
[CPV-REG]: https://www.legislation.gov.uk/eur/2008/213/annex/I/adopted
[SAMPLE]: fts-data-profile.md#0-sample-and-method
