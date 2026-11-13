# R2 — CV engine: beachhead segment and channel mix

> Research date: 2026-11-13. Analyst scope: segments + channels (competitor mapping of HireAra / Allsorter / iReformat / RefineCV etc. is done by another analyst and is NOT repeated here).
> Labels: **FACT** = read on a primary page or official dataset today (URL given); **INFERENCE** = my conclusion from facts; **ASSUMPTION**; **UNKNOWN**.
> Method note: WebSearch budget was capped at 40 calls (shared); most facts below come from direct reads of official datasets (ONS/Nomis API, Eurostat API, US Census CBP flat file, ISED Canada, Companies House advanced search) and vendor/association pages. Search-snippet-only claims are marked "(snippet)".

_Status: work in progress — sections are appended as research completes._

---

## A. Recruitment / staffing agencies — reachable market

### A1. Number of agencies by country (official statistics first)

| Country | Count | What is counted | Year | Source | Label |
|---|---|---|---|---|---|
| UK | **30,260** enterprises in SIC 78 (employment activities); of which 78109 placement agencies **16,745**, 78200 temp agencies **10,455**, 78300 other HR provision 2,615 | VAT/PAYE-registered enterprises (ONS UK Business Counts) | 2026 | Nomis API dataset NM_142_1 (query in source list) | FACT |
| UK (register) | 78109: **32,661** active companies; 78200: **23,839**; 78300: **15,793**; 78101 (casting): 1,923 | Active companies on the Companies House register by SIC code (includes dormant / one-person contractor shells; a company can list up to 4 SIC codes) | 13 Nov 2026 | Companies House advanced search | FACT |
| US | **27,000** staffing and recruiting companies, ~54,000 offices; ~57% of companies in temp/contract | ASA estimate | 2021 | americanstaffing.net staffing-industry-statistics | FACT (dated) |
| US (Census) | NAICS 5613: 56,173 establishments. 56131 Employment placement + executive search: **13,576** (561311 placement 7,679; 561312 executive search 5,897). 56132 Temporary help: **38,254**. 56133 PEO: 4,343 | Employer establishments (offices, not firms) | 2023 | Census County Business Patterns flat file cbp23us.zip | FACT |
| Canada | NAICS 5613: **4,512** employer establishments + 4,620 non-employer/indeterminate | Establishments | 2025 | ISED Canadian Industry Statistics | FACT |
| Ireland | N78: **2,039** enterprises (N78.1 placement: 1,621; N78.2 temp: 157) | Enterprises | 2023 | Eurostat sbs_sc_ovw | FACT |
| Netherlands | N78: **19,208** (N78.1: 11,437; N78.2: 7,449) | Enterprises | 2023 | Eurostat sbs_sc_ovw | FACT |
| Germany | N78: **10,855** (N78.1: 4,582; N78.2: 5,229) | Enterprises | 2023 | Eurostat sbs_sc_ovw | FACT |
| France | N78: **9,000** (N78.1: 1,696; N78.2: 1,883) | Enterprises | 2023 | Eurostat sbs_sc_ovw | FACT |
| Poland | N78: **8,180** (N78.1: 4,625; N78.2: 2,149) | Enterprises | 2023 | Eurostat sbs_sc_ovw | FACT |
| Other EU reference | Sweden 7,042; Spain 6,928; Romania 3,886; Belgium 2,310; Italy 1,083; Estonia 953; Lithuania 753; Bulgaria 693; Latvia 433 | N78 enterprises | 2023 | Eurostat sbs_sc_ovw | FACT |

(Australia, New Zealand, South Africa, Singapore, UAE: see A1b below.)

### A2. Size distribution

| Country | Share micro | Detail | Source | Label |
|---|---|---|---|---|
| UK, SIC 78 | **79%** have 0–9 employees (23,980 of 30,260); 69% have 0–4 | 10–19: 2,380; 20–49: 1,705; 50–249: 1,740; 250+: 455 | ONS/Nomis 2026 | FACT |
| UK, SIC 78109 (perm/placement) | **85%** micro (14,160 of 16,745); 74% have 0–4 | 10–49: 1,890; 50+: 695 | ONS/Nomis 2026 | FACT |
| UK, SIC 78200 (temp) | 68% micro (7,065 of 10,455) | temp agencies count placed temps as employees, so size bands overstate office headcount | ONS/Nomis 2026 | FACT + INFERENCE |
| US, NAICS 56131 | **75%** of establishments have <10 employees (8,699 with <5 + 1,458 with 5–9, of 13,576) | exec search 561312: 87% <10 | Census CBP 2023 | FACT |
| Canada, NAICS 5613 | 33.9% of employer establishments have 1–4 employees; 54% 5–99; plus as many non-employers again | | ISED 2025 | FACT |
| Ireland N78 | 81% have 0–9 persons employed (1,644 of 2,039) | | Eurostat 2023 | FACT |
| Netherlands N78 | 85% (16,294 of 19,208); 66% are 0–1 person | | Eurostat 2023 | FACT |
| Germany N78 | 58% (6,338 of 10,855) | | Eurostat 2023 | FACT |
| France N78 | 70% (6,300 of 9,000) | | Eurostat 2023 | FACT |
| Poland N78 | 86% (7,035 of 8,180) | | Eurostat 2023 | FACT |

**INFERENCE:** in every English-speaking market roughly three quarters or more of agencies are micro-businesses (<10 staff). This is the population that cannot justify HireAra-style £180–950/month contracts or a Bullhorn Marketplace integration, but is also the population with the lowest CV volume per firm and the highest churn (start-up agencies fail often).


<!-- PROGRESS NOTES (will be restructured into final sections below) -->
## Working notes saved 2026-11-13 (to be consolidated)

- FACT REC member directory: public JSON-backed directory, 221 pages x 20 = ~4,420 entries (branches listed separately); fields name, town, full postal address, website link, sectors; no email. Technology sector ~480 entries; Executive search ~360. https://www.rec.uk.com/jobseekers/member-directory
- FACT RCSA (AU/NZ) corporate member directory: 1,997 entries, public, filter by country/state/specialisation. https://www.rcsa.com.au/ (Directory Search)
- FACT TRN partner programme: £249 / £799 / £1,350 per month on 12-month terms; "4500+ recruitment business owners". https://therecruitmentnetwork.com/partners
- FACT Bullhorn API access: annual platform fee (figure not on page; "$5,000" seen only in search snippet of partner-program FAQ), paid in full upfront, 200k API calls/month, security assessment, no redlines, no middleware, paid validation before any promotion. https://www.bullhorn.com/bullhorn-api-access-faqs/
- FACT Recruit CRM now ships a native "Resume Formatting Agent". https://recruitcrm.io/integration-partners/
- FACT JobAdder integrations: 188 partners, category "Resume Formatting" lists Allsorter and Daxtra as "Paid / Preferred". Vincere lists Allsorter + HireAra. HireAra is now an Access Group product.
- FACT Cinode pricing: Free (up to 10 users, CV template with logo/colours), Skills €39.9/mo, Business €120.8/mo, Partner €230.8/mo (headcount selector; >20 employees quote). Flowcase: quote only.
- FACT Telegram: "IT Outstaff Projects" 16,577 subscribers; "Outstaffing IT" chat 2,188 members (Russian-language request/bench exchange).
- FACT Ukraine: 2,062 active verified tech companies, 46% outsourcing, 2% outstaffing (IT Research Ukraine 2025, Lviv IT Cluster).
- FACT Eurostat 2023 J62 enterprises with 10+ persons: PL 1,980; RO 1,337; BG 1,049; LT 427; EE 284; LV 252; DE 12,540; FR 4,555; NL 3,182.
- FACT compliance: HireAra ISO 27001 + Cyber Essentials + UK storage + DPA + sub-processor list; CVFormatter (US LLC) "DPA on request"; RemakeCV stores in Singapore; iReformat (US LLC) deletes after download.
