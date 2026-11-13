
### A. All 8 ground-truthed packs (329 facts)

| Config | packs ok | Pass/fail & eligibility | Mandatory tech lines | Deadlines (date+time) | Questions found | Q weighting | Q word/page limit | Criteria weightings | Summary facts | Docs to return | Red flags | Not-stated traps | wrong values | cites exact@loc | exact, wrong page/file | partial | not found / none | $ per pack | s per pack |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gpt-5-nano, single pass | 8/8 | 36/60 (60%) | 0/18 (0%) | 7/14 (50%) | 19/44 (43%) | 8/17 (47%) | 9/15 (60%) | 36/43 (84%) | 29/42 (69%) | 21/32 (66%) | 6/22 (27%) | 9/14 ok, 5 invented | 7 | 38% | 37% | 8% | 17.0% | $0.0029 | 19 |
| gpt-5-nano, per-doc + LLM merge | 8/8 | 22/60 (37%) | 17/18 (94%) | 6/14 (43%) | 16/44 (36%) | 13/17 (76%) | 4/15 (27%) | 18/43 (42%) | 22/42 (52%) | 11/32 (34%) | 8/22 (36%) | 13/14 ok, 1 invented | 5 | 43% | 25% | 16% | 16.5% | $0.0081 | 92 |
| gpt-5-nano, per-doc + deterministic union | 8/8 | 31/60 (52%) | 17/18 (94%) | 6/14 (43%) | 27/44 (61%) | 13/17 (76%) | 4/15 (27%) | 29/43 (67%) | 26/42 (62%) | 16/32 (50%) | 11/22 (50%) | 13/14 ok, 1 invented | 2 | 47% | 20% | 12% | 21.4% | $0.0060 | 68 |
| gpt-5-mini, single pass | 8/8 | 49/60 (82%) | 18/18 (100%) | 14/14 (100%) | 37/44 (84%) | 17/17 (100%) | 14/15 (93%) | 42/43 (98%) | 41/42 (98%) | 30/32 (94%) | 18/22 (82%) | 14/14 ok, 0 invented | 1 | 71% | 13% | 13% | 3.2% | $0.0245 | 102 |
| gpt-5-mini, single + verify pass | 8/8 | 51/60 (85%) | 18/18 (100%) | 14/14 (100%) | 37/44 (84%) | 17/17 (100%) | 14/15 (93%) | 42/43 (98%) | 42/42 (100%) | 30/32 (94%) | 18/22 (82%) | 14/14 ok, 0 invented | 1 | 71% | 13% | 13% | 3.0% | $0.0374 | 127 |

### B. The 6 small packs (4k-13k tokens) - includes gemini-2.5-flash-lite, which failed on both 60k+ packs

| Config | packs ok | Pass/fail & eligibility | Mandatory tech lines | Deadlines (date+time) | Questions found | Q weighting | Q word/page limit | Criteria weightings | Summary facts | Docs to return | Red flags | Not-stated traps | wrong values | cites exact@loc | exact, wrong page/file | partial | not found / none | $ per pack | s per pack |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gpt-5-nano, single pass | 6/6 | 23/36 (64%) | 0/18 (0%) | 5/12 (42%) | 14/36 (39%) | 5/14 (36%) | 5/9 (56%) | 31/33 (94%) | 19/28 (68%) | 17/22 (77%) | 4/14 (29%) | 7/12 ok, 5 invented | 2 | 41% | 36% | 6% | 16.7% | $0.0021 | 20 |
| gemini-2.5-flash-lite, single pass | 6/6 | 31/36 (86%) | 18/18 (100%) | 10/12 (83%) | 36/36 (100%) | 14/14 (100%) | 9/9 (100%) | 32/33 (97%) | 26/28 (93%) | 22/22 (100%) | 11/14 (79%) | 10/12 ok, 2 invented | 3 | 80% | 5% | 12% | 2.3% | $0.0065 | 25 |
| gpt-5-mini, single pass | 6/6 | 31/36 (86%) | 18/18 (100%) | 12/12 (100%) | 29/36 (81%) | 14/14 (100%) | 9/9 (100%) | 33/33 (100%) | 28/28 (100%) | 21/22 (95%) | 11/14 (79%) | 12/12 ok, 0 invented | 0 | 76% | 12% | 10% | 2.4% | $0.0200 | 103 |
| gpt-5-mini, single + verify pass | 6/6 | 32/36 (89%) | 18/18 (100%) | 12/12 (100%) | 29/36 (81%) | 14/14 (100%) | 9/9 (100%) | 33/33 (100%) | 28/28 (100%) | 21/22 (95%) | 11/14 (79%) | 12/12 ok, 0 invented | 0 | 76% | 11% | 10% | 2.1% | $0.0289 | 129 |

### C. Same 3 packs for every model (Ryde conference system, TfC tree equity, Blyth bus shelters; 138 facts)

| Config | packs ok | Pass/fail & eligibility | Mandatory tech lines | Deadlines (date+time) | Questions found | Q weighting | Q word/page limit | Criteria weightings | Summary facts | Docs to return | Red flags | Not-stated traps | wrong values | cites exact@loc | exact, wrong page/file | partial | not found / none | $ per pack | s per pack |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gpt-5-nano, single pass | 3/3 | 13/19 (68%) | 0/18 (0%) | 2/6 (33%) | 13/25 (52%) | 5/5 (100%) | 5/5 (100%) | 16/18 (89%) | 9/14 (64%) | 11/13 (85%) | 1/8 (12%) | 3/6 ok, 3 invented | 1 | 46% | 30% | 5% | 18.6% | $0.0025 | 22 |
| gemini-2.5-flash-lite, single pass | 3/3 | 15/19 (79%) | 18/18 (100%) | 5/6 (83%) | 25/25 (100%) | 5/5 (100%) | 5/5 (100%) | 18/18 (100%) | 14/14 (100%) | 13/13 (100%) | 8/8 (100%) | 4/6 ok, 2 invented | 1 | 77% | 8% | 12% | 3.7% | $0.0079 | 31 |
| gemini-2.5-flash, single pass | 3/3 | 16/19 (84%) | 18/18 (100%) | 6/6 (100%) | 25/25 (100%) | 5/5 (100%) | 5/5 (100%) | 18/18 (100%) | 14/14 (100%) | 13/13 (100%) | 8/8 (100%) | 6/6 ok, 0 invented | 0 | 73% | 1% | 23% | 3.4% | $0.0417 | 52 |
| gpt-5-mini, single pass | 3/3 | 14/19 (74%) | 18/18 (100%) | 6/6 (100%) | 18/25 (72%) | 5/5 (100%) | 5/5 (100%) | 18/18 (100%) | 14/14 (100%) | 12/13 (92%) | 7/8 (88%) | 6/6 ok, 0 invented | 0 | 79% | 14% | 6% | 0.6% | $0.0226 | 114 |
| gpt-5-mini, single + verify pass | 3/3 | 15/19 (79%) | 18/18 (100%) | 6/6 (100%) | 18/25 (72%) | 5/5 (100%) | 5/5 (100%) | 18/18 (100%) | 14/14 (100%) | 12/13 (92%) | 7/8 (88%) | 6/6 ok, 0 invented | 0 | 78% | 14% | 7% | 0.5% | $0.0322 | 138 |
| gpt-5, single pass | 3/3 | 17/19 (89%) | 18/18 (100%) | 6/6 (100%) | 24/25 (96%) | 5/5 (100%) | 5/5 (100%) | 18/18 (100%) | 14/14 (100%) | 13/13 (100%) | 6/8 (75%) | 6/6 ok, 0 invented | 0 | 91% | 6% | 2% | 0.0% | $0.1197 | 104 |

### D. Single pass vs two-pass on one pack (Ryde conference system, 7 documents, 57 facts)

| Config | packs ok | Pass/fail & eligibility | Mandatory tech lines | Deadlines (date+time) | Questions found | Q weighting | Q word/page limit | Criteria weightings | Summary facts | Docs to return | Red flags | Not-stated traps | wrong values | cites exact@loc | exact, wrong page/file | partial | not found / none | $ per pack | s per pack |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gpt-5-mini, single pass | 1/1 | 5/8 (62%) | 18/18 (100%) | 2/2 (100%) | 3/10 (30%) | - | - | 6/6 (100%) | 5/5 (100%) | 4/5 (80%) | 1/2 (50%) | 1/1 ok, 0 invented | 0 | 91% | 4% | 5% | 0.0% | $0.0229 | 122 |
| gpt-5-mini, single + verify pass | 1/1 | 6/8 (75%) | 18/18 (100%) | 2/2 (100%) | 3/10 (30%) | - | - | 6/6 (100%) | 5/5 (100%) | 4/5 (80%) | 1/2 (50%) | 1/1 ok, 0 invented | 0 | 91% | 3% | 5% | 0.0% | $0.0316 | 145 |
| gpt-5-mini, per-doc + LLM merge | 1/1 | 6/8 (75%) | 18/18 (100%) | 2/2 (100%) | 1/10 (10%) | - | - | 6/6 (100%) | 5/5 (100%) | 4/5 (80%) | 1/2 (50%) | 1/1 ok, 0 invented | 0 | 68% | 4% | 25% | 2.6% | $0.1085 | 400 |
| gpt-5-mini, per-doc + deterministic union | 1/1 | 6/8 (75%) | 18/18 (100%) | 2/2 (100%) | 10/10 (100%) | - | - | 6/6 (100%) | 5/5 (100%) | 4/5 (80%) | 1/2 (50%) | 1/1 ok, 0 invented | 0 | 55% | 3% | 27% | 14.6% | $0.0712 | 265 |
| gpt-5, single pass | 1/1 | 7/8 (88%) | 18/18 (100%) | 2/2 (100%) | 9/10 (90%) | - | - | 6/6 (100%) | 5/5 (100%) | 5/5 (100%) | 1/2 (50%) | 1/1 ok, 0 invented | 0 | 99% | 1% | 0% | 0.0% | $0.1405 | 112 |
| gpt-5-nano, single pass | 1/1 | 7/8 (88%) | 0/18 (0%) | 1/2 (50%) | 2/10 (20%) | - | - | 6/6 (100%) | 3/5 (60%) | 4/5 (80%) | 1/2 (50%) | 0/1 ok, 1 invented | 0 | 34% | 34% | 6% | 25.0% | $0.0021 | 20 |
| gpt-5-nano, per-doc + LLM merge | 1/1 | 0/8 (0%) | 17/18 (94%) | 1/2 (50%) | 1/10 (10%) | - | - | 2/6 (33%) | 1/5 (20%) | 1/5 (20%) | 0/2 (0%) | 1/1 ok, 0 invented | 0 | 29% | 11% | 46% | 14.3% | $0.0107 | 124 |
| gpt-5-nano, per-doc + deterministic union | 1/1 | 2/8 (25%) | 17/18 (94%) | 1/2 (50%) | 2/10 (20%) | - | - | 2/6 (33%) | 1/5 (20%) | 5/5 (100%) | 2/2 (100%) | 1/1 ok, 0 invented | 0 | 25% | 5% | 33% | 36.6% | $0.0085 | 101 |

### E. Tokens, cost and latency per pack (brief + compliance matrix, as billed by the gateway)

| Pack | pages | pack tokens (o200k) | gpt-5-nano | gemini-2.5-flash-lite | gemini-2.5-flash | gpt-5-mini | gpt-5-mini+verify | gpt-5 |
|---|---|---|---|---|---|---|---|---|
| blyth-bus-shelters | 56 (+0 sheets) | 12,755 | in 18,597 / out 4,097 / $0.0026 / 24s | in 21,385 / out 12,234 / $0.0070 / 27s | in 21,385 / out 17,529 / $0.0502 / 60s | in 18,597 / out 8,130 / $0.0198 / 106s | in 40,458 / out 9,865 / $0.0288 / 134s | in 18,597 / out 9,345 / $0.1167 / 110s |
| ryde-conference-system | 37 (+0 sheets) | 13,445 | in 19,285 / out 3,409 / $0.0021 / 20s | in 22,257 / out 21,324 / $0.0108 / 45s | in 22,257 / out 15,317 / $0.0450 / 57s | in 19,285 / out 9,605 / $0.0229 / 122s | in 42,908 / out 10,998 / $0.0316 / 145s | in 19,285 / out 11,642 / $0.1405 / 112s |
| ryde-data-audit | 12 (+0 sheets) | 3,972 | in 9,811 / out 2,920 / $0.0017 / 18s | in 11,988 / out 6,610 / $0.0038 / 15s | not run | in 9,811 / out 6,098 / $0.0138 / 85s | in 21,170 / out 8,397 / $0.0213 / 118s | not run |
| tullie-digital-installation | 20 (+1 sheets) | 9,294 | in 15,135 / out 3,201 / $0.0018 / 19s | in 19,089 / out 6,769 / $0.0046 / 15s | not run | in 15,135 / out 7,357 / $0.0185 / 98s | in 32,523 / out 9,184 / $0.0265 / 127s | not run |
| ecw-water-plan | 25 (+1 sheets) | 11,899 | in 17,737 / out 2,823 / $0.0018 / 17s | in 20,399 / out 11,856 / $0.0068 / 27s | not run | in 17,737 / out 8,423 / $0.0202 / 94s | in 39,289 / out 10,425 / $0.0292 / 116s | not run |
| tfc-tree-equity | 37 (+1 sheets) | 12,111 | in 17,950 / out 4,459 / $0.0027 / 23s | in 20,749 / out 9,802 / $0.0060 / 21s | in 20,749 / out 9,436 / $0.0298 / 39s | in 17,950 / out 10,762 / $0.0249 / 114s | in 41,845 / out 13,421 / $0.0362 / 136s | in 17,950 / out 7,954 / $0.1020 / 91s |
| lpc-research | 131 (+1 sheets) | 76,590 | in 82,428 / out 3,910 / $0.0057 / 18s | FAILED in 91,063 / out 13 / $0.0091 / 2s | not run | in 82,428 / out 9,414 / $0.0394 / 85s | in 169,553 / out 12,054 / $0.0665 / 108s | not run |
| fcdo-english-training | 103 (+4 sheets) | 63,367 | in 69,207 / out 3,339 / $0.0046 / 17s | FAILED in 74,578 / out 10,873 / $0.0118 / 26s | not run | in 69,207 / out 9,478 / $0.0363 / 115s | in 142,965 / out 11,682 / $0.0591 / 135s | not run |
| laa-crime-2025 | 309 (+0 sheets) | 171,053 | in 176,895 / out 2,941 / $0.0098 / 17s | FAILED in 189,571 / out 23,984 / $0.0286 / 77s | not run | not run | not run | not run |

### F. Every 'wrong' value and every invented value (hallucination traps), by config


**gpt-5-nano, single pass** (13)
  - `blyth-bus-shelters` [unknown/wrong] No word/page limits are stated for any response -> limits invented for ['Q1', 'Q2', 'Q3']
  - `blyth-bus-shelters` [unknown/wrong] No scoring scale / descriptors are published -> 4 scale rows: ['Excellent', 'Very good', 'Good', 'Acceptable']
  - `fcdo-english-training` [summary/review] E-mail PDFs (technical + commercial, each <=10MB) to john.kennedy1@fcdo.gov.uk and stuart.andrew@fcdo.gov.uk,  -> got 'Electronic submission (PDFs)'
  - `fcdo-english-training` [weighting/wrong] Quality of personnel 30 -> weights [70]
  - `fcdo-english-training` [weighting/wrong] Methodology 20 -> weights [70]
  - `fcdo-english-training` [weighting/wrong] Relevant experience in similar contract 20 -> weights [70]
  - `fcdo-english-training` [weighting/wrong] Total cost 20 -> weights [30]
  - `fcdo-english-training` [weighting/wrong] Value for money 10 -> weights [30]
  - `ryde-conference-system` [unknown/wrong] No word/page limits are stated -> limits invented for ['Q1', 'Q2', 'Q3']
  - `ryde-data-audit` [unknown/wrong] No evaluation criteria or weightings are stated -> weights invented: ['Method and approach', 'Project team qualifications', 'Delivery plan and timetable'] ['price_weight_percent', 'quality_weight_perce
  - `tfc-tree-equity` [weighting/wrong] Technical 80% -> got 60
  - `tullie-digital-installation` [deadline/wrong] Enquiries by 5pm Monday 19 October 2026 -> got '5 November 2026' / '2026-11-05'
  - `tullie-digital-installation` [unknown/wrong] No scoring scale / descriptors are published -> 2 scale rows: ['Quality', 'Price']

**gemini-2.5-flash-lite, single pass** (5)
  - `blyth-bus-shelters` [unknown/wrong] No scoring scale / descriptors are published -> 1 scale rows: [None]
  - `tfc-tree-equity` [deadline/wrong] Deadline for submission of quotes 04/08/2026 (NO time stated) -> time invented: '04/08/2026' / '2026-08-04T00:00:00'
  - `tfc-tree-equity` [unknown/wrong] Submission method / address is not stated in the pack documents -> filled: 'Use form provided in Schedule 3 or your own template.'
  - `tullie-digital-installation` [deadline/wrong] Enquiries by 5pm Monday 19 October 2026 -> got 'Thursday 5 November 2026' / '2026-11-05'
  - `tullie-digital-installation` [weighting/wrong] Fee Proposal 30% (25% price + 5% resources) -> weights [25, 5]

**gemini-2.5-flash, single pass** (0)
  - none

**gpt-5-mini, single pass** (2)
  - `fcdo-english-training` [summary/review] E-mail PDFs (technical + commercial, each <=10MB) to john.kennedy1@fcdo.gov.uk and stuart.andrew@fcdo.gov.uk,  -> got 'Electronic only: two PDF files (Technical and Commercial) by email to named addresses; each file must not exceed 10MB'
  - `fcdo-english-training` [weighting/wrong] Commercial 30 -> got 20

**gpt-5-mini, single + verify pass** (1)
  - `fcdo-english-training` [weighting/wrong] Commercial 30 -> got 20

**gpt-5, single pass** (0)
  - none

**gpt-5-nano, per-doc + LLM merge** (7)
  - `blyth-bus-shelters` [unknown/wrong] No scoring scale / descriptors are published -> 1 scale rows: ['Not stated in document']
  - `fcdo-english-training` [summary/review] E-mail PDFs (technical + commercial, each <=10MB) to john.kennedy1@fcdo.gov.uk and stuart.andrew@fcdo.gov.uk,  -> got 'Electronic submission via email (two PDFs)'
  - `fcdo-english-training` [weighting/wrong] Quality of personnel 30 -> weights [70]
  - `fcdo-english-training` [weighting/wrong] Methodology 20 -> weights [70, 30]
  - `fcdo-english-training` [weighting/wrong] Relevant experience in similar contract 20 -> weights [70]
  - `fcdo-english-training` [weighting/wrong] Total cost 20 -> weights [30]
  - `fcdo-english-training` [weighting/wrong] Value for money 10 -> weights [30]

**gpt-5-nano, per-doc + deterministic union** (3)
  - `blyth-bus-shelters` [unknown/wrong] No scoring scale / descriptors are published -> 5 scale rows: ['Not stated in document', 'Pass', 'Excellent', 'Good', 'Fair']
  - `fcdo-english-training` [weighting/wrong] Total cost 20 -> weights [30]
  - `fcdo-english-training` [weighting/wrong] Value for money 10 -> weights [30, 20]

**gpt-5-mini, per-doc + LLM merge** (0)
  - none

**gpt-5-mini, per-doc + deterministic union** (0)
  - none

### G. Output hygiene

| Config | outputs | valid JSON | control characters repaired (corrupted non-ASCII) | items with no/unfound citation |
|---|---|---|---|---|
| gemini-2.5-flash, single pass | 3 | 3 | 0 | 8 |
| gemini-2.5-flash-lite, single pass | 9 | 6 | 0 | 10 |
| gpt-5, single pass | 3 | 3 | 0 | 0 |
| gpt-5-mini, per-doc + deterministic union | 1 | 1 | 253 | 23 |
| gpt-5-mini, single pass | 8 | 8 | 1043 | 15 |
| gpt-5-mini, single + verify pass | 8 | 8 | 1050 | 16 |
| gpt-5-mini, per-doc + LLM merge | 1 | 1 | 1464 | 2 |
| gpt-5-nano, per-doc + deterministic union | 8 | 8 | 0 | 91 |
| gpt-5-nano, single pass | 9 | 9 | 1 | 50 |
| gpt-5-nano, per-doc + LLM merge | 8 | 8 | 23 | 38 |
