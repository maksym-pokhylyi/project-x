# Tender pack manifest

All documents were downloaded on 2026-11-13 from pages that serve them to a plain HTTPS client without login (see `packs/sources.json`, `scripts/fetch_packs.py`). Page counts for DOCX/ODT are from the LibreOffice PDF rendering used for ingestion.

| # | Pack (slug) | Trade | Buyer | Title | Files | Pages | Sheets | Tokens (o200k) | OCR pages | Ground truth facts | Notice / documents page |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `blyth-bus-shelters` | construction / street furniture installation | Blyth Town Council | Bus Shelter Improvement Initiative | 7 | 56 | 0 | 12,755 | 0 | 41 | https://www.contractsfinder.service.gov.uk/Notice/292c22b9-54ba-43d4-8a60-356127861f20 |
| 2 | `ryde-conference-system` | IT / AV systems supply and installation | Ryde Town Council | Council Chamber Conference System | 7 | 37 | 0 | 13,445 | 0 | 57 | https://rydetowncouncil.gov.uk/transparency/tenders-contracts/ |
| 3 | `ryde-data-audit` | professional services (data protection audit) | Ryde Town Council | GDPR Data Audit - Request to Quote | 4 | 12 | 0 | 3,972 | 0 | 21 | https://www.contractsfinder.service.gov.uk/Notice/5f4d9841-b30a-42bb-b122-3f7758606443 |
| 4 | `tullie-digital-installation` | digital / creative technology design | Tullie House Museum and Art Gallery Trust | Project Tullie Phase 3: Digital Installation Design - Request for Quotation | 6 | 20 | 1 | 9,294 | 1 | 37 | https://www.contractsfinder.service.gov.uk/Notice/a64c3ffe-9b90-4d78-ba49-01674d5c46ed |
| 5 | `ecw-water-plan` | professional services (environmental / strategy consultancy) | Enterprise Cheshire and Warrington | Invitation to Tender for Cheshire and Warrington Outline Water Plan | 2 | 25 | 1 | 11,899 | 0 | 40 | https://cheshireandwarrington.com/how-we-work/about/tenders-and-opportunities/ |
| 6 | `tfc-tree-equity` | professional services (mapping / investment planning consultancy) | Trees for Cities | Invitation to Tender: Tree Equity & Urban Resilience Project | 4 | 37 | 1 | 12,111 | 0 | 40 | https://www.contractsfinder.service.gov.uk/Notice/8c6bd6b6-2bb7-4f16-bea0-a0d9d61b0bd9 |
| 7 | `lpc-research` | research services | Low Pay Commission | LPC 2026/03: Open call for research relating to the impacts of the minimum wage | 4 | 131 | 1 | 76,590 | 1 | 44 | https://www.gov.uk/government/publications/low-pay-commission-call-for-research-summer-2026 |
| 8 | `fcdo-english-training` | training services | Foreign, Commonwealth & Development Office (British Embassy Astana) | English-language training programme - Central Asia: invitation to tender | 5 | 103 | 4 | 63,367 | 0 | 45 | https://www.gov.uk/government/news/english-language-training-programme-central-asia-invitation-to-tender |
| 9 | `laa-crime-2025` | legal services (large pack) | Legal Aid Agency | 2025 Standard Crime Contract tender (Stage 3 application documents + contract) | 6 | 309 | 0 | 171,053 | 0 | spot-check only | https://www.gov.uk/government/publications/crime-contract-2025-tender |

## Files per pack


### blyth-bus-shelters — Blyth Town Council: Bus Shelter Improvement Initiative

Documents page: https://www.blythtowncouncil.gov.uk/procurement

| File | Type | Pages / sheets | Bytes | Extracted chars | Note |
|---|---|---|---|---|---|
| 01_invitation-to-tender.docx | docx | 14 | 100,456 | 18,674 | libreoffice->pdf |
| 02_appendix-a-specification-and-scope-of-work-1.pdf | pdf | 7 | 125,344 | 11,733 |  |
| 03_appendix-b-site-and-location-information-1.pdf | pdf | 24 | 1,840,378 | 15,567 |  |
| 04_appendix-c-quality-methodology-1.docx | docx | 5 | 28,789 | 5,251 | libreoffice->pdf |
| 05_appendix-d-health-and-safety.docx | docx | 2 | 21,256 | 2,728 | libreoffice->pdf |
| 06_appendix-e-pricing-schedule.docx | docx | 3 | 28,658 | 4,733 | libreoffice->pdf |
| 07_appendix-f-evaluation-of-quotations.pdf | pdf | 1 | 45,729 | 3,263 |  |

### ryde-conference-system — Ryde Town Council: Council Chamber Conference System

Documents page: https://rydetowncouncil.gov.uk/transparency/tenders-contracts/

| File | Type | Pages / sheets | Bytes | Extracted chars | Note |
|---|---|---|---|---|---|
| 01_RTC-Contract-Specification-Council-Chamber-Conference-System-1.pdf | pdf | 12 | 241,367 | 18,440 |  |
| 02_Due-Diligence-Questionnaire.pdf | pdf | 5 | 160,854 | 12,561 |  |
| 03_Tender_Clarifications_Questions_and_Answers.pdf | pdf | 6 | 1,158,988 | 6,776 |  |
| 04_Tender_Clarifications_Questions_and_answers_2.pdf | pdf | 1 | 36,481 | 1,524 |  |
| 05_109-GA-Reception-Meeting-Rooms-_-Layout.pdf | pdf | 1 | 413,000 | 7,801 |  |
| 06_111-GA-Office-Kitchen-and-Breakout-room-_-Layout-002.pdf | pdf | 1 | 281,993 | 9,607 |  |
| 07_RTC-Standing-Orders-Appendix-4-Information-and-Data-Protection-Policy-May-2019.pdf | pdf | 11 | 230,957 | 23,986 |  |

### ryde-data-audit — Ryde Town Council: GDPR Data Audit - Request to Quote

Documents page: https://rydetowncouncil.gov.uk/transparency/tenders-contracts/

| File | Type | Pages / sheets | Bytes | Extracted chars | Note |
|---|---|---|---|---|---|
| 01_Request-to-Quote-Data-Audit-1.pdf | pdf | 6 | 266,865 | 12,831 |  |
| 02_Pricing-Shedule-Data-Audit-1.docx | docx | 2 | 58,518 | 723 | libreoffice->pdf |
| 03_References-1.docx | docx | 1 | 31,209 | 391 | libreoffice->pdf |
| 04_Due-Dilligence-Check-Sheet-Summary-1.pdf | pdf | 3 | 76,222 | 7,189 |  |

### tullie-digital-installation — Tullie House Museum and Art Gallery Trust: Project Tullie Phase 3: Digital Installation Design - Request for Quotation

Documents page: https://tullie.org.uk/project-tullie-phase-3-fine-art-digital-installation-design-rfq/

| File | Type | Pages / sheets | Bytes | Extracted chars | Note |
|---|---|---|---|---|---|
| 01_Digital-Installation-Design-Brief.pdf | pdf | 13 | 946,412 | 30,987 |  |
| 02_Appendix-1-Tullie-Manifesto-and-Vision.pdf | pdf | 2 | 2,985,914 | 4,531 |  |
| 03_Appendix-2-Digital-Space-Technical-Layout.pdf | pdf | 3 | 2,072,291 | 56,349 |  |
| 04_Appendix-3-Fees-and-Resources-Schedule.xlsx | xlsx | 1 sheet(s) | 33,872 | 954 |  |
| 05_Appendix-4-Example-Works-from-Tullies-Fine-Art-Collection.pdf | pdf | 1 | 521,949 | 780 |  |
| 06_Appendix-5-Digital-Art-Moodboard.pdf | pdf | 1 | 928,156 | 724 |  1 OCR page(s) |

### ecw-water-plan — Enterprise Cheshire and Warrington: Invitation to Tender for Cheshire and Warrington Outline Water Plan

Documents page: https://cheshireandwarrington.com/how-we-work/about/tenders-and-opportunities/

| File | Type | Pages / sheets | Bytes | Extracted chars | Note |
|---|---|---|---|---|---|
| 01_itt-water-plan-draft-final-020926.docx | docx | 25 | 141,563 | 50,630 | libreoffice->pdf |
| 02_outline-water-plan-query-responses.xlsx | xlsx | 1 sheet(s) | 21,406 | 8,516 |  |

### tfc-tree-equity — Trees for Cities: Invitation to Tender: Tree Equity & Urban Resilience Project

Documents page: https://www.treesforcities.org/invitation-to-tender-tree-equity-urban-resilience-project

| File | Type | Pages / sheets | Bytes | Extracted chars | Note |
|---|---|---|---|---|---|
| 01_ITT-Opportunity-mapping-and-Investment-plans-Tree-Equity-and-Urban-Resilience-Project.pdf | pdf | 26 | 882,990 | 47,745 |  |
| 02_ITT-Commercial-Proposal-Submission-Form.xlsx | xlsx | 1 sheet(s) | 200,703 | 1,186 |  |
| 03_ITT-Tree-Equity-and-Urban-Resilience-Project-Submission-Template.docx | docx | 5 | 582,304 | 3,349 | libreoffice->pdf |
| 04_TfC-Contract-Standard-Terms-Conditions.pdf | pdf | 6 | 367,436 | 6,473 |  |

### lpc-research — Low Pay Commission: LPC 2026/03: Open call for research relating to the impacts of the minimum wage

Documents page: https://www.gov.uk/government/publications/low-pay-commission-call-for-research-summer-2026

| File | Type | Pages / sheets | Bytes | Extracted chars | Note |
|---|---|---|---|---|---|
| 01_LPC202603_Open_Call_2_year_ITT_Document_.docx | docx | 49 | 187,646 | 109,573 | libreoffice->pdf 1 OCR page(s) |
| 02_LPC_Pricing_Schedule.xlsx | xlsx | 1 sheet(s) | 160,039 | 5,226 |  |
| 03_202606_LPC_Short_form_terms_and_conditions.docx | docx | 75 | 381,909 | 263,935 | libreoffice->pdf |
| 04_Clarifications_LPC202603.docx | docx | 7 | 43,190 | 15,477 | libreoffice->pdf |

### fcdo-english-training — Foreign, Commonwealth & Development Office (British Embassy Astana): English-language training programme - Central Asia: invitation to tender

Documents page: https://www.gov.uk/government/news/english-language-training-programme-central-asia-invitation-to-tender

| File | Type | Pages / sheets | Bytes | Extracted chars | Note |
|---|---|---|---|---|---|
| 01_Invitation-to-tender-Instructions-Below-EU-Threshold-Services.odt | odt | 18 | 74,125 | 43,441 | libreoffice->pdf |
| 02_Astana_language_training_-_terms_of_reference.odt | odt | 13 | 49,746 | 21,418 | libreoffice->pdf |
| 03_Invitation-to-Tender-Below-EU-threshold-Services-Commercial-Proformas.ods | ods | 4 sheet(s) | 13,215 | 5,507 | libreoffice->xlsx |
| 04_FCDO-Standard-Terms-and-Conditions-Below-Threshold-Service-Contracts__2_.pdf | pdf | 58 | 938,081 | 217,422 |  |
| 05_Invitation-to-tender-Questions-and-Answers.pdf | pdf | 14 | 180,214 | 32,247 |  |

### laa-crime-2025 — Legal Aid Agency: 2025 Standard Crime Contract tender (Stage 3 application documents + contract)

Documents page: https://www.gov.uk/government/publications/crime-contract-2025-tender

| File | Type | Pages / sheets | Bytes | Extracted chars | Note |
|---|---|---|---|---|---|
| 01_2025_Standard_Crime_Contract_Application_Guide_V.10.pdf | pdf | 31 | 464,278 | 93,653 |  |
| 02_ANNEX_A_SQ_Stage_3.pdf | pdf | 19 | 282,448 | 46,615 |  |
| 03_ANNEX_B_-_ITT_Stage_3.pdf | pdf | 7 | 133,112 | 15,464 |  |
| 05_2025_Standard_Crime_Contract_-_Standard_Terms.pdf | pdf | 94 | 647,164 | 251,120 |  |
| 06_2025_Standard_Crime_Contract_-_Specification.pdf | pdf | 142 | 1,078,090 | 425,723 |  |
| 07_Supervision_Requirements_and_Guidance__Version_2_-_July_2026_.pdf | pdf | 16 | 283,034 | 36,789 |  |
