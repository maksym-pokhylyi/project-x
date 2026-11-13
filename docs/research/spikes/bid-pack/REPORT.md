# Tender-pack → bid brief / compliance matrix / drafts / evaluator: feasibility spike

Run on 2026-11-13. Every figure below was measured in this folder (model outputs in `out/`, scoring in `out/scores/`, spend in `out/ledger.jsonl`). Where a number is arithmetic on measured token counts rather than a run, it says **projected**.

## 0. Read this first: three things that limit what the numbers mean

1. **None of the three models named in the brief could be called.** `anthropic/claude-haiku-5.5`, `anthropic/claude-sonnet-5.5` and `google/gemini-3.6-flash` all returned `HTTP 403 "Free tier users do not have access to this model"` from the gateway on every attempt between 10:40 and 11:33 UTC (the account is treated as free tier; every Anthropic model and most current Google models are blocked). I measured the nearest *accessible* models instead, so **there is no accuracy number for any Claude model in this report**:

   | Role in the brief | Asked for | Measured instead | Gateway price in/out per 1M |
   |---|---|---|---|
   | cheap bulk | claude-haiku-5.5 ($0.10 / $0.50) | `openai/gpt-5-nano` | $0.05 / $0.40 |
   | cheap bulk | | `google/gemini-2.5-flash-lite` | $0.10 / $0.40 |
   | mid | — | `openai/gpt-5-mini` | $0.25 / $2.00 |
   | flash | gemini-3.6-flash ($0.75 / $3.75) | `google/gemini-2.5-flash` | $0.30 / $2.50 |
   | strong | claude-sonnet-5.5 ($2 / $10) | `openai/gpt-5` | $1.25 / $10 |

   These are older-generation models; treat the results as a floor for what the named models should do, not as a measurement of them. All scripts take a model ID, so the comparison can be re-run as soon as the account has paid credits (commands in `README.md`).

2. **The tender packs are not the mix that was asked for.** Contracts Finder's attachment endpoint (`/Notice/Attachment/<id>`) answers `403` to non-browser HTTP clients (and `429` with `Retry-After: 120` when hit quickly). Getting past that would have meant presenting the script as a browser; the session's safety policy refused that and I did not work around it. Find a Tender returned no direct document links, and mytenders/PCS-style portals require login. The 9 packs therefore come from buyer websites and GOV.UK that serve documents to a plain client: 3 town-council packs, 2 charities, 1 council-owned company, 3 central-government bodies. **There is no cleaning/FM pack, no social-care pack, and no large council ITT with a standard Selection Questionnaire plus a 10–15 question quality section.** The closest things are a 131-page research ITT, a 103-page FCDO training ITT and a 309-page Legal Aid Agency pack (used as a size stress test only).

3. **The ground truth is mine and it was wrong once.** I read the documents and wrote 329 facts for 8 packs. While checking model output I found that I had missed a pass/fail eligibility rule ("All bidders must be based in Kazakhstan", stated only in a 14-page Q&A PDF). gpt-5-mini had found it in its first pass; gpt-5-nano had not. It is now in the ground truth, but the lesson stands: recall figures are relative to one careful reader, and sample sizes are small (60 pass/fail facts across 8 packs; 19 on the 3-pack model comparison, where one fact is 5 points).

## 1. Verdict

**Can pass/fail extraction be trusted unreviewed? No. Is it good enough to be the product's core, with verification built into the UI? Yes, on this evidence.**

- **Recall of pass/fail and eligibility requirements, single model, single pass:** gpt-5 89% (17/19, 3 packs), gemini-2.5-flash 84% (16/19, 3 packs), gpt-5-mini 82% (49/60, 8 packs) and 85% with a second "what did you miss" pass, gemini-2.5-flash-lite 86% (31/36, 6 small packs), gpt-5-nano 60%. On the "hard" subset (insurance levels, certifications, references, staff qualifications, score thresholds, budget ceilings, explicit exclusion rules) the mid and strong models found 87–92%. **No single configuration reached 95%.**
- **Two different models in parallel, results unioned,** did: gpt-5-mini(+verify) ∪ gemini-2.5-flash found 18/19 pass/fail items and 13/13 of the hard subset on 3 packs at $0.074 per pack; gpt-5-mini ∪ gemini-2.5-flash-lite found 33/36 and 25/25 on the 6 small packs at $0.027 per pack. This is a union upper bound from the scores, not a built merge step (§4.4).
- **Invented facts were a cheap-model problem.** On 14 planted "the pack does not say this" checks, gpt-5-mini invented nothing (14/14), gpt-5 6/6, gemini-2.5-flash 6/6. gemini-2.5-flash-lite invented 2 of 12 (a `00:00` deadline time; a submission method) and gpt-5-nano 5 of 14 (evaluation weightings, a scoring scale and word limits that do not exist). I read all 33 quotes that could not be matched to the pack for the three better models: none was fabricated content; all were real text that was not copied contiguously (flattened tables, stitched bullets, a reformatted date).
- **Numbers were right when found.** Deadlines with time: gpt-5-mini 14/14, gpt-5 6/6, gemini-2.5-flash 6/6. Evaluation weightings: 42/43 for gpt-5-mini (the one "wrong" is arguable), 18/18 for gpt-5 and gemini-2.5-flash. Question weightings 17/17 and page limits 14/15 for gpt-5-mini.
- **What it gets wrong is omission, and omission is silent.** gpt-5-mini listed 5 questions for a pack whose questionnaire has 20 (found 3 of the 10 I had sampled); it missed "exclusivity agreements with sub-contractors = disqualification" and "value-for-money mark must be 60 or above". Those are the errors that destroy trust, and the model gives no signal that they happened.

**What the product must show as "verify" (not as fact):**

| Show as | What | Why (measured) |
|---|---|---|
| Verified | An item whose quote is found verbatim on the cited page | 70–80% of items for gpt-5-mini / flash-lite, 91% for gpt-5 |
| Check the page | Quote found, but on a different page or file than cited; or only partially matched | 26% of items for gpt-5-mini, 8% for gpt-5 |
| Unverified — open the document | Quote not found | 3% gpt-5-mini, 0% gpt-5, 17% gpt-5-nano |
| Always human-confirmed | Submission deadline, submission method, every pass/fail item, budget ceiling | One wrong deadline is fatal; flash-lite gave a clarification-*meeting* date as the clarification deadline |
| "Not stated in the pack" | Fields the model left empty | Correct behaviour, and the FCDO deadline really was in a covering letter that is not in the pack |
| Models disagree | Any value where two extractions differ | Cheapest detector of the wrong dates above |
| Coverage warning | Any document from which nothing was extracted, especially questionnaires and Q&A files | The 20-question DDQ and the Q&A-only eligibility rule |
| Document conflict | Clarifications that change the ITT | 9-months vs 6-months validity was caught by every model above nano |

## 2. What was run

- **Packs:** 9 real UK packs, 45 files, 730 pages + 10 sheets (PDF, DOCX, ODT, XLSX, ODS). Manifest: `packs/MANIFEST.md`. Eight have ground truth (21–57 facts each, 329 in total: pass/fail items, all weightings, deadlines, every scored question with its limit, documents to return, red flags, and 14 "not stated" traps); the 309-page LAA pack is a size test.
- **Extraction configs:** whole pack in context, one call (5 models); the same plus a verify pass (gpt-5-mini); one call per document then an LLM merge (gpt-5-nano on 8 packs, gpt-5-mini on 1); one call per document then a deterministic union (no extra model cost). All at reasoning effort `low`.
- **Schema:** `schemas/brief.schema.json`, strict, no `$ref`, every item carries `file`, `loc` and a verbatim `quote`.
- **Scoring:** `scripts/score.py`. Each fact is correct / missing / wrong. Every citation is checked by normalised string matching against the cited page.
- **Drafting:** 2 fictional bidders with evidence libraries, 3 questions each, 3 models; claim check, evaluator pass, a degraded-answer sensitivity test, bid/no-bid.
- **Spend:** $1.32 of the $1.50 budget (§10).

## 3. Ingestion (part 1)

| Measure | Result |
|---|---|
| 9 packs, 45 files, 730 pages | ingested in 28 s on 4 cores (`pdftotext -layout`; DOCX/ODT via LibreOffice → PDF; openpyxl for sheets) |
| Tokens per pack (o200k tokenizer) | 3,972 / 9,294 / 11,899 / 12,111 / 12,755 / 13,445 / 63,367 / 76,590 / 171,053 |
| Tokens per page on the two 100+ page packs | 598 |
| Prompt overhead per extraction call (system + task + JSON schema) | about 5,840 tokens (18,597 billed prompt tokens for a 12,755-token pack) |
| Scanned / image-only pages | 2 of 730, caught by the under-40-characters rule and OCR'd with tesseract |
| Pure-JS path for Vercel (`node-ingest/`: unpdf, mammoth, SheetJS) | PDF text matched pdftotext within 1% on all 9 text PDFs tested (8 exactly, by non-whitespace character count); DOCX 91–100% of the reference text but no page numbers and no auto-numbering; the image-only page returned 29 characters (needs OCR or a vision model); ODT/ODS had no JS path in this test |

Things that went wrong in ingestion:
- ODT → PDF → text garbled three heading lines in the FCDO instructions (`ScoringMethdlyaEvuC`, `27.TechnialEvuto`). The table under them survived, so the weightings were still extracted.
- Engineering drawings produce noise: 3 pages of a technical layout became 56,349 characters.
- Templates carry leftovers that are true to the document and wrong for the tender: the ECW Form of Tender is titled "Regional Clean Energy Skills Coordination and Action Planning" in a water-plan ITT. None of the three models run on that pack flagged it (gpt-5 and gemini-2.5-flash were not run on it).
- Excel pricing files are mostly formulas and empty cells; they ingest fine and contain almost nothing a brief needs beyond "this form must be returned" and warnings such as "do not alter protected cells".

**Native PDF input vs extracted text** (`out/pdf_native_test.json`), through the gateway's OpenAI-compatible `file` content part:

| File | Model | Native PDF prompt tokens | Extracted-text prompt tokens | Same answer? |
|---|---|---|---|---|
| 1-page evaluation table | gpt-5-nano | 1,287 | 491 | yes, all 8 weightings |
| 1-page evaluation table | gemini-2.5-flash-lite | 1,318 | 512 | yes |
| 24-page site document with photos (1.8 MB) | gemini-2.5-flash-lite | 6,224 | 3,268 | yes |
| 24-page site document with photos (1.8 MB) | gpt-5-nano | 15,935 | 3,146 | yes |

Native PDF works for both providers and costs 2–5× the tokens. Extracted text with page markers is the right default because it is cheaper and is what makes deterministic citation checking possible; native PDF or OCR is the fallback for pages with no text layer. Anthropic's native PDF and citations features could not be tested.

## 4. Brief + compliance matrix extraction (part 2)

### 4.1 All 8 ground-truthed packs (329 facts)

| Config | Pass/fail & eligibility | Deadlines (date+time) | Questions found | Q weighting | Q page/word limit | Criteria weightings | Summary facts | Docs to return | Red flags | "Not stated" traps | Wrong values | $ / pack | s / pack |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gpt-5-nano, single pass | 36/60 (60%) | 7/14 | 19/44 (43%) | 8/17 | 9/15 | 36/43 | 29/42 | 21/32 | 6/22 | 9/14, **5 invented** | 7 | $0.003 | 19 |
| gpt-5-nano, per-document + LLM merge | 22/60 (37%) | 6/14 | 16/44 | 13/17 | 4/15 | 18/43 | 22/42 | 11/32 | 8/22 | 13/14, 1 invented | 5 | $0.008 | 92 |
| gpt-5-nano, per-document + deterministic union | 31/60 (52%) | 6/14 | 27/44 | 13/17 | 4/15 | 29/43 | 26/42 | 16/32 | 11/22 | 13/14, 1 invented | 2 | $0.006 | 68 |
| **gpt-5-mini, single pass** | 49/60 (82%) | 14/14 | 37/44 (84%) | 17/17 | 14/15 | 42/43 | 41/42 | 30/32 | 18/22 | 14/14, 0 invented | 1 | $0.025 | 102 |
| **gpt-5-mini, single + verify pass** | 51/60 (85%) | 14/14 | 37/44 (84%) | 17/17 | 14/15 | 42/43 | 42/42 | 30/32 | 18/22 | 14/14, 0 invented | 1 | $0.037 | 127 |

The 18 line-by-line mandatory technical requirements in the Ryde conference-system pack (C1…B5) were all listed by every model except gpt-5-nano single pass (0/18). Full tables, including every wrong value by config: `out/tables.md`.

### 4.2 The same 3 packs for every model (Ryde conference system, TfC tree equity, Blyth bus shelters; 138 facts)

| Config | Pass/fail & eligibility | Deadlines | Questions found | Weightings + limits | Red flags | Traps | Wrong values | Citations: exact at cited page / exact elsewhere / partial / not found | $ / pack | s / pack |
|---|---|---|---|---|---|---|---|---|---|---|
| gpt-5-nano | 13/19 (68%) | 2/6 | 13/25 | 26/28 | 1/8 | 3/6, 3 invented | 1 | 46% / 30% / 5% / 19% | $0.003 | 22 |
| gemini-2.5-flash-lite | 15/19 (79%) | 5/6 | 25/25 | 28/28 | 8/8 | 4/6, 2 invented | 1 | 77% / 8% / 12% / 4% | $0.008 | 31 |
| gemini-2.5-flash | 16/19 (84%) | 6/6 | 25/25 | 28/28 | 8/8 | 6/6 | 0 | 73% / 1% / 23% / 3% | $0.042 | 52 |
| gpt-5-mini | 14/19 (74%) | 6/6 | 18/25 (72%) | 28/28 | 7/8 | 6/6 | 0 | 79% / 14% / 6% / 1% | $0.023 | 114 |
| gpt-5-mini + verify | 15/19 (79%) | 6/6 | 18/25 | 28/28 | 7/8 | 6/6 | 0 | 78% / 14% / 7% / 1% | $0.032 | 138 |
| **gpt-5** | **17/19 (89%)** | 6/6 | 24/25 (96%) | 28/28 | 6/8 | 6/6 | 0 | **91% / 6% / 2% / 0%** | $0.120 | 104 |

On the 6 small packs gemini-2.5-flash-lite scored 31/36 pass/fail, 36/36 questions and 10/12 deadlines at $0.0065 per pack, which is better question recall than gpt-5-mini at a third of the price. It then **failed on all three packs of 63k tokens or more** (§4.6).

### 4.3 Single pass vs two-pass

| Finding | Evidence |
|---|---|
| A verify pass adds a little | gpt-5-mini 49 → 51 of 60 pass/fail items, summary 41 → 42 of 42, for +50% cost. On the FCDO pack it added 8 requirements. It did not recover any missed question. |
| An LLM merge step loses items | gpt-5-nano: pass/fail 60% single pass → 37% after per-document + merge. gpt-5-mini on the 7-document Ryde pack: questions 3/10 single pass → 1/10 after merge. |
| Per-document extraction finds what single pass skips | Same Ryde pack, gpt-5-mini: per-document + **deterministic union** found 10/10 sampled questionnaire questions (27 questions listed vs 5), with pass/fail 6/8 vs 5/8. Cost $0.071 vs $0.023, 265 s vs 122 s, and exact-citation rate fell to 55% because the union keeps duplicates. |
| Two-pass does not rescue the weakest model | gpt-5-nano per-document + union: pass/fail 52% (single 60%). |

### 4.4 Cheapest route to very high recall: union of two models

Computed from the per-fact scores (`out/union_table.md`); a fact counts if either model found it.

| Configuration | Pass/fail & eligibility | Hard eligibility subset | Questions found | Deadlines | $ / pack |
|---|---|---|---|---|---|
| 8 packs: gpt-5-mini + verify | 51/60 (85%) | 35/39 (90%) | 37/44 | 14/14 | $0.037 |
| 6 small packs: gemini-2.5-flash-lite | 31/36 (86%) | 24/25 | 36/36 | 10/12 | $0.007 |
| 6 small packs: gpt-5-mini ∪ gemini-2.5-flash-lite | 33/36 (92%) | 25/25 | 36/36 | 12/12 | $0.027 |
| 6 small packs: gpt-5-mini + verify ∪ gemini-2.5-flash-lite | 34/36 (94%) | 25/25 | 36/36 | 12/12 | $0.035 |
| 3 packs: gpt-5 | 17/19 (89%) | 12/13 | 24/25 | 6/6 | $0.120 |
| 3 packs: gpt-5-mini + verify ∪ gemini-2.5-flash | 18/19 (95%) | 13/13 | 25/25 | 6/6 | $0.074 |
| 3 packs: all four mid/strong outputs unioned | 19/19 | 13/13 | 25/25 | 6/6 | $0.202 |

Caveats: this is an upper bound (a real union must de-duplicate and must surface, not hide, the cheap model's wrong values as disagreements), and the samples are small.

### 4.5 Precision of the "pass/fail" label

gpt-5-mini + verify labelled 75 requirements `pass_fail` or `minimum_score_threshold` across the 8 packs. 55 matched a ground-truth fact. I read the other 20: **none was invented**; 5 were legitimate formalities (late tenders rejected, submission address); 14 were real contract or specification obligations or documents-to-return that the pack does not make a tender pass/fail gate (for example "return mesh panels to the council", "two intermediary drafts of each plan", "WCAG 2.2 PDFs"); 1 was a scored criterion mislabelled as a threshold. So about 80% of items carrying the pass/fail label deserve it. The noise is over-labelling, not fabrication, and it matters because a 30-line "pass/fail" list stops being read.

### 4.6 Failure modes seen, with the example

| # | Failure | Example from the runs |
|---|---|---|
| 1 | Missed eligibility or exclusion rule | FCDO: "exclusivity agreements with sub-contractors → disqualified", conflict-of-interest and disclosure duties missed by gpt-5-mini in both passes. LPC: "value-for-money mark must be 60 or above" missed by gpt-5-mini; "single legal entity" missed on first pass. |
| 2 | Questionnaire in a secondary document skipped | Ryde: 20-question due-diligence questionnaire; gpt-5-mini single pass listed 5 questions in total. |
| 3 | Wrong date taken from a nearby row | Tullie: gemini-2.5-flash-lite and gpt-5-nano gave "5 November 2026" (the clarification *meeting*) as the clarification deadline; it is 5pm 19 October. |
| 4 | Invented precision | TfC states a date with no time; gemini-2.5-flash-lite normalised it to `2026-08-04T00:00:00`. |
| 5 | Invented structure | gpt-5-nano produced evaluation weightings for a request-for-quote that has none, a four-level scoring scale ("Excellent / Very good / Good / Acceptable") for Blyth, and word limits for three questions. |
| 6 | Sub-weights collapsed | gpt-5-nano gave every FCDO technical criterion the section total (70) and both commercial criteria 30. |
| 7 | Corrupted characters in strict JSON | gpt-5-mini returned `£14,000` as NUL + `A314,000` and bullets as runs of NULs: 1,043 control characters across 8 outputs (`out/tables.md` §G). Repairable deterministically, but unrepaired it shows the user "A314,000" and breaks quote matching. gpt-5 and Gemini did not do this; gpt-5-nano did it once. |
| 8 | Schema rejected by provider | Gemini refused the brief schema as a response schema: "constraint that has too many states for serving". Fallback was JSON mode with the schema in the prompt. |
| 9 | Unconstrained JSON breaks on big inputs | Of 12 Gemini extraction calls, 9 parsed and only 4 were fully schema-valid. All 3 packs of 63k tokens or more failed with flash-lite: a 13-token reply, malformed JSON, and a runaway that hit the 24k output cap. |
| 10 | Thin output on a very large pack | LAA, 309 pages / 177k prompt tokens: gpt-5-nano returned valid JSON in 17 s with 7 requirements and 1 question for a pack containing a 19-page selection questionnaire. |
| 11 | Citations right in substance, wrong in place | gpt-5-mini cited the right file but the wrong page for 10% of items and another file for 3%. |
| 12 | Top-level split ambiguity | FCDO: total cost 20 + value for money 10. gpt-5-mini reported price weight 20; I scored 30. Both are defensible; the UI should show the criteria table, not a single "price %" figure. |
| 13 | The human missed one too | "Based in Kazakhstan" (Q&A only) was absent from my ground truth until model output exposed it. |

Rate limits and latency: Google models are limited to 5 requests per minute on this gateway team. gpt-5-mini took 85–122 s per pack regardless of pack size (output-bound: 6–11k output tokens); gpt-5 91–112 s; gemini-2.5-flash 39–60 s; flash-lite 15–45 s; nano 17–24 s.

## 5. Drafting and evaluator (part 3)

Two fictional bidders (`evidence/`): **Canopy & Kerb Ltd** bidding for the Trees for Cities pack (page limits of 2, 3 and 1 A4 pages) and **Steppe English Training Ltd** bidding for the FCDO pack (two-side profile, two-side methodology, 500-word GDPR statement). Page limits were converted at 450 words per A4 side, which is my assumption, not the buyer's. Drafting used retrieved spec pages (about 8k input tokens per question), not the whole pack.

### 5.1 Drafts

| Model | Within word limit | Mean share of limit used | `[EVIDENCE NEEDED]` markers (6 answers) | Case studies named per answer (of 3) | Distinct case-study figures used per answer | $ / answer | s / answer |
|---|---|---|---|---|---|---|---|
| gpt-5-mini | 5/6 (one at 107%) | 93% | 20 | 2.2 | 5.0 | $0.0048 | 21 |
| gemini-2.5-flash-lite | 6/6 | 74% (one at 51%) | 12 | 1.5 | 2.5 | $0.0013 | 5 |
| gpt-5-nano | **0/6** (112–163%) | 131% | 42 (17 in one answer) | 1.2 | 3.3 | $0.0012 | 12 |

gpt-5 was not run for drafting (budget).

**Unsupported claims in the gpt-5-mini drafts** (I checked every factual statement in all six against the library; the claim-check model counted 89 claims):
- **1 fabricated capability:** "We maintain a Records of Processing Activities (ROPA) as part of our Data Protection Policy." The library has no ROPA. gemini-2.5-flash-lite made the same invention in its GDPR answer. The question lists ROPA as a required measure, the library is silent, and both models asserted it instead of marking it.
- **About 6 embellishments:** "all three case studies used placement and exit testing" (stated for one); "security-aware delivery"; a mentoring model that "produced measured instructor development" (the library records 18 observed lessons, no outcome); "method notes" for Plymouth (only Bristol had one); i-Tree "in regular use".
- **0 invented numbers, clients, accreditations or dates.** Every figure in the experience answers matched the library (148 officers, 81%, 74%, £212k, 21 of 24, and so on).
- The model was honest about planted weaknesses: it stated no London experience, no in-house survey team, no WCAG experience, no Tajik speakers, and marked partner names as evidence needed.

Other drafting defects:
- The one over-limit answer ended with "[Word count: 889]"; it has 966 words. Never trust a model's own count; count in code and regenerate.
- Marker format drifted to `[EVIDENCE_NEEDED: …]` in 3 of 20 places, so a strict parser undercounts.
- Sub-parts: all six gpt-5-mini answers addressed every sub-part under its own heading. The evaluator rated 13 of 35 sub-parts "full", 21 "partial", 1 "missing" (that one wrongly; see below).
- **Clarifications were not in the retrieved context.** The FCDO methodology draft proposed instructor mentoring in Kyrgyzstan and Tajikistan; the Q&A says that component applies to Kazakhstan only. Neither the drafter nor the evaluator could know. Clarification documents must always be retrieved.

**Automatic claim checking** (gpt-5-mini as checker, $0.0063 and 32 s per answer): it caught the ROPA fabrication in both models' answers and 1 of my 6 embellishments, and raised 2 false alarms on clearly future proposals. That is 2 of the 7 problems I found by hand. The deterministic check (numbers and names absent from the sources) was noisy but did catch the false word count. Claim checking by model is a useful filter for hard fabrications, not a guarantee.

### 5.2 Evaluator pass

| Test | gpt-5-mini as evaluator | gemini-2.5-flash-lite as evaluator |
|---|---|---|
| Scores for the six gpt-5-mini drafts (TfC scale 0–3; FCDO scale 0/2/4/7/10) | 2, 1, 2 and 7, 4, 7 | 2, 2, 2 and 7, 7, 4 |
| Agreement between the two evaluators | 3 of 6 identical | |
| Degraded EDI answer (two sub-parts removed, corporate-policy filler added, false "ISO 9001" and "Disability Confident Leader") | 2 → **1**; both false claims caught, citing the library's "NOT HELD" | 2 → 2 (no change); flagged one false claim |
| Degraded GDPR answer (transfers and testing sections removed, false "ISO 27001", "Cyber Essentials Plus", "DPIAs completed") | 7 → **2**; all three false claims caught; both missing sub-parts named | 4 → 4 (no change); false claims flagged |

Is the gpt-5-mini feedback specific and correct? Mostly specific, and usefully grounded: it told the bidder to name **Greenline Arboriculture Ltd** (the subcontractor recorded in the library's Bath case study) instead of leaving a placeholder, to cite the 2.0 m footway rule from the Bristol project, and it noticed the 966-vs-889 word count. But it was wrong in ways a user would act on:
- It accepted the ROPA fabrication when marking the original GDPR answer, recording "States a ROPA is maintained (E6)" although section E6 of the library says nothing of the kind.
- It advised citing "staff EDI training" (not in the library; it came from the false paragraph I planted) and the corporate EDI policy, which the question says is not scored.
- It cited "E6 (mentions backups in policy)"; E6 does not mention backups.
- It recommended a "20 working days" response time for data-subject requests; the UK GDPR period is one month.
- It rated "international transfer safeguards" as missing in the original GDPR answer, which does address them as a gap with a proposal.

gemini-2.5-flash-lite is not usable as an evaluator on this evidence: it did not lower either degraded answer's score, stated that an answer "uses Arial font at 12pt" (it cannot know), and contradicted itself within one evaluation.

## 6. Bid / no-bid (part 4)

Input: the gpt-5-mini + verify brief and the bidder's library. $0.0115 per verdict with gpt-5-mini, $0.0035 with flash-lite.

| Bidder / planted gap | gpt-5-mini | gemini-2.5-flash-lite |
|---|---|---|
| **Canopy & Kerb → TfC** verdict | bid with conditions, 6–10 person-days | bid with conditions, 15–25 person-days |
| Director sits on a working group of a named project partner (conflict of interest is a discretionary pass/fail) | **missed** | **missed** |
| £254k contract vs largest previous contract £96k and turnover £342k | missed | flagged |
| No in-house field survey capability | flagged | mentioned only ("ground-truthing … subcontracted"), not raised as a gap |
| No investment-plan experience | flagged | flagged |
| No WCAG 2.2 / accessibility experience | flagged | flagged |
| No London or borough-system experience | flagged | flagged |
| **Steppe English → FCDO** verdict | no bid | no bid |
| No Tajik speaker (language proficiency is mandatory) | flagged, not met | flagged |
| Two teachers without CELTA/DELTA/TESOL | flagged | flagged |
| One teacher with 3 years, minimum is 5 | flagged ("not all teachers have 5+") | flagged, but said two teachers |
| No presence or partner in Kyrgyzstan / Tajikistan | flagged | flagged |
| No DPIA, no transfer agreement | flagged | flagged |
| Planted gaps flagged, both bidders | **9 of 11** | **9 of 11** |
| Not planted: deadline missing from the pack | asked the buyer | asked the buyer |
| Not planted: budget not published | not raised | asked the buyer |
| Not planted: "must be based in Kazakhstan" (bidder is a UK company with an Almaty branch) | partly met, with the right clarification question to the buyer | headline "SHOW-STOPPER: Supplier not based in Kazakhstan" — false certainty |

Both missed the conflict of interest, which requires connecting a CV line to a partner named in the tender. flash-lite also misread the library twice (it described the managing director as a native Kazakh speaker and counted two teachers with 3 years' experience). The two effort estimates differ by 2.5×; neither is anchored to anything, so present effort as a range driven by counted questions and pages, not as a model opinion.

## 7. Cost (part 5)

### 7.1 Measured per call (`out/cost_model.md`)

| Step | Model | Mean input tokens | Mean output tokens | $ / call | s |
|---|---|---|---|---|---|
| Brief, single pass, 4k–13k-token pack | gpt-5-mini | 9.8k–19.3k | 6.1k–10.8k | $0.014–$0.025 | 85–122 |
| Brief, single pass, 63k–77k-token pack | gpt-5-mini | 69k–82k | 9.4k–9.5k | $0.036–$0.039 | 85–115 |
| Brief, single pass, small pack | gpt-5 | 18k–19k | 8.0k–11.6k | $0.10–$0.14 | 91–112 |
| Brief verify pass | gpt-5-mini | 35,070 | 2,095 | $0.0129 | 25 |
| Draft one answer | gpt-5-mini | 8,010 | 1,816 | $0.0048 | 21 |
| Claim check one answer | gpt-5-mini | 2,711 | 2,828 | $0.0063 | 32 |
| Evaluator pass on one answer | gpt-5-mini | 8,777 | 2,130 | $0.0056 | 20 |
| Bid/no-bid | gpt-5-mini | 10,168 | 4,474 | $0.0115 | 40 |

Output tokens dominate: on a small pack gpt-5 charged about $0.02 for input and $0.08–$0.12 for output.

### 7.2 Cost per bid: 150-page pack, 15 questions, first draft + 2 revision rounds

Basis: 598 tokens per page measured → 89,716 tokens; brief = single + verify; each round = draft + claim check + evaluator per question (45 of each); one bid/no-bid.

| Model | Basis | Brief (single + verify) | Drafting loop | Total per bid | With cached-input discount on repeated prefixes |
|---|---|---|---|---|---|
| gpt-5-nano | brief and drafts measured; claim/evaluator token counts from gpt-5-mini | $0.012 | $0.17 | **$0.18** | $0.15 |
| gemini-2.5-flash-lite | as above | $0.025 | $0.21 | **$0.24** | $0.17 |
| gpt-5-mini | **measured token counts, all steps** | $0.070 | $0.83 | **$0.91** | $0.74 |
| gemini-2.5-flash | brief measured; loop projected | $0.099 | $1.03 | **$1.14** | $0.93 |
| gpt-5 | brief measured; loop projected | $0.36 | $4.15 | **$4.56** | $3.70 |
| claude-haiku-5.5 | **projected, not run** (gpt-5-mini token counts × list price) | $0.025 | $0.24 | $0.27 | $0.20 |
| gemini-3.6-flash | **projected, not run** | $0.19 | $1.80 | $2.01 | $1.49 |
| claude-sonnet-5.5 | **projected, not run** | $0.50 | $4.80 | $5.37 | $3.91 |

The projections ignore tokenizer differences and each model's own output length and reasoning use, so read them as order of magnitude. Two pricing facts from the gateway's model list matter for Claude: haiku-5.5 is listed at $0.10/$0.50 only up to 100k input tokens per request and $0.50/$2.50 above, so a whole pack of about 160 pages or more in one call costs 5× per token; sonnet-5.5 has no tier.

The recommended routing in §8 (two-model brief, mid-tier drafting, strong evaluator on the final round only) lands between $1 and $2 per bid on these figures. Against competitor pricing of £49–£499 per month, model cost is not the constraint; reviewer trust is.

### 7.3 Prompt caching through the gateway (`out/cache_test.json`)

- OpenAI automatic caching works through the gateway: the second and third question over the same 76,856-token pack prefix reported 76,800 cached tokens and cost $0.00058 and $0.00047 against $0.00394 for the first call (85–88% cheaper). A hit was still served about 10 minutes later.
- **Changing the response schema voids the cache:** the same prefix with a different `response_format` schema reported 0 cached tokens; switching back hit again. The verify pass, which uses a different schema, had 0 cached tokens on 7 of 8 packs. To share a cached pack across passes, keep one schema per pack or put the schema text after the pack.
- Anthropic's explicit `cache_control` caching could not be tested.

### 7.4 Maximum pack size

The largest pack processed was 309 pages / 171,053 tokens (176,895 billed prompt tokens): accepted by gpt-5-nano, valid JSON in 17 s, but with thin content (failure 10). gemini-2.5-flash-lite failed on it. gpt-5-mini and gpt-5 were not run at that size for budget reasons, so the largest pack with *scored* results is 131 pages / 76,590 tokens, where gpt-5-mini's quality held (LPC: 3 of 12 pass/fail facts missed on first pass, all weightings, limits and both deadlines correct).

## 8. Recommended design

### 8.1 Model routing

| Step | Route | Why |
|---|---|---|
| Brief + compliance matrix | Two different mid-tier models in parallel over the whole pack, plus per-document extraction for any questionnaire, Q&A or clarification file; deterministic union; flag disagreements | Only configuration that reached 92–95% pass/fail recall and 100% of sampled questions; still under $0.10 per pack |
| Verification | Code, not a model: quote must match the cited page; sanitise control characters first; numbers must occur on the page | Free, and it is what separates "verified" from "check" in the UI |
| Strong model | Reserve for packs over about 60k tokens and for a final "what is missing" pass on pass/fail items | gpt-5 had the best single-model recall and 91% exact citations, at 5× the mid-tier price |
| Cheapest tier (nano class) | Do not use for extraction or drafting | 60% pass/fail recall, 5 invented values, 0/6 drafts within limit |
| Flash-lite class | Small packs only, never alone, never as evaluator | Excellent on small packs; failed on every pack of 63k tokens or more; invented a time; evaluator did not react to degraded answers |
| Drafting | Mid-tier, retrieved context that always includes clarifications; word count and marker parsing in code | 5/6 within limit, 1 fabrication in 89 claims |
| Evaluator and claim check | Mid-tier at minimum; a stronger model for the final round is worth testing | Scores moved correctly on degraded answers; advice contained errors |

Where the named models fit once accessible: test haiku-5.5 in the mid-tier slot and sonnet-5.5 in the strong slot with the commands in `README.md`. That is the first thing to run.

### 8.2 Architecture for Next.js on Vercel

Platform limits below are from Vercel's documentation as fetched today, not from testing.

- **Upload:** browser → Vercel Blob by client upload. Function request bodies are capped at 4.5 MB; the largest single tender file here was 3.0 MB and packs had up to 7 files.
- **Ingestion:** a background step per file. unpdf (pdf.js) for PDF text, SheetJS for spreadsheets, mammoth for DOCX text. Three gaps need a decision: OCR for image-only pages (2 of 730 here), ODT/DOC conversion, and DOCX page numbers and auto-numbering, which only the LibreOffice route preserved. Either run a small conversion worker outside Vercel functions or cite DOCX by heading instead of page.
- **Orchestration:** a durable workflow (Vercel Workflows or a queue), one step per model call. Do not hold a request open: a brief is 85–145 s of model time per call, per-document extraction of a 7-file pack took 265–400 s end to end at 4-way concurrency, and a 15-question drafting round is 45 calls of 20–30 s. Function maximum duration is 300 s on Hobby and 800 s on Pro (1,800 s extended, beta), so single steps fit and whole pipelines do not. Persist every step's JSON; stream progress to the UI.
- **Whole pack vs retrieval:** whole-pack context for the brief (packs here were 4k–171k tokens against 400k–1M context windows; retrieval would add a recall risk exactly where omission is the failure mode). Per-document calls in addition for questionnaires and Q&A. Retrieval for drafting and evaluation: the question, its scoring rules, the relevant specification pages, **all clarifications**, and the evidence library, about 8–10k tokens per call.
- **Caching:** one schema per cached pack prefix; ask follow-up questions against the cached pack (measured 85–88% cheaper).
- **Structured output:** strict schema where the provider accepts it; for Gemini-class providers split the schema into smaller calls rather than rely on JSON mode (9 of 12 parsed, 4 of 12 schema-valid).
- **Storage:** documents in Blob; page text, extraction JSON, citation-check status and reviewer decisions in Postgres; keep every model output for audit.
- **Review UI is the product:** each pass/fail item shows its quote, a link to the page, its verification status and a tick box; the brief is not "final" until deadline, submission method and pass/fail items are ticked.

### 8.3 Failure modes users would hit

1. A mandatory requirement or a whole questionnaire is silently absent from the matrix (§4.6 #1, #2).
2. A deadline or clarification date is wrong or carries an invented time (#3, #4).
3. A long "pass/fail" list padded with ordinary contract obligations (§4.5).
4. A clarification changes the ITT after the brief was produced; the brief must be re-run when files are added.
5. The key fact is not in the uploaded files at all (FCDO deadline in a missing covering letter; TfC submission address not in any document).
6. Garbled characters or wrong page references in citations (#7, #11).
7. Large or scanned packs: timeouts, truncated JSON, thin output (#9, #10).
8. A draft asserts a capability the bidder does not have because the question demands it (ROPA), or a draft overruns the limit while reporting that it does not.
9. Evaluator feedback that sounds authoritative and is wrong (§5.2), or scores that change with the model.
10. Bid/no-bid states a show-stopper with certainty where the pack is ambiguous, or misses a conflict of interest.

## 9. What could not be tested

- Any Claude model, gemini-3.6-flash, Anthropic prompt caching, Anthropic PDF and citations features (all blocked by the gateway account tier).
- Cleaning/FM and social-care packs; a large council ITT with a standard Selection Questionnaire; ZIP archives (the code path exists, no pack exercised it).
- gpt-5 on more than 3 small packs; gpt-5 or gpt-5-mini on the 309-page pack; gpt-5 for drafting or evaluation; a second two-pass run with a mid-tier model (one pack only).
- A built union/de-duplication step (the union figures are computed from scores).
- Evaluator scores against real buyer scores (there are none for these tenders); bid/no-bid on real bidders.
- Run-to-run variance: every configuration was run once.

## 10. Spend

| Model | Spend |
|---|---|
| openai/gpt-5-mini | $0.58 |
| openai/gpt-5 | $0.36 |
| google/gemini-2.5-flash | $0.13 |
| google/gemini-2.5-flash-lite | $0.12 |
| openai/gpt-5-nano | $0.12 |
| Model-access probe (231 tiny requests to find which models the account may call) | $0.02 |
| **Total (gateway-reported cost, `out/ledger.jsonl`)** | **$1.32** of $1.50 |

## 11. Reusable files

| File | Use |
|---|---|
| `schemas/brief.schema.json`, `scripts/schema_brief.py` | strict brief + compliance-matrix schema with per-item citations |
| `prompts/extract_system.md`, `extract_task.md`, `verify_task.md`, `merge_task.md`, `draft_system.md` | prompts as run |
| `scripts/ingest.py` | reference ingestion with page/sheet markers and OCR fallback |
| `node-ingest/ingest_test.mjs` | pure-JS ingestion check for the Vercel path |
| `scripts/llm.py` | gateway client with spend ledger, hard cap, Gemini fallback, rate limiting |
| `scripts/extract.py`, `scripts/union_merge.py` | single pass, verify pass, per-document, LLM merge, deterministic union |
| `scripts/score.py` | ground-truth scoring, citation verification, control-character repair, number grounding |
| `groundtruth/build_gt.py`, `groundtruth/*.json` | 329 hand-written facts with machine checks: a regression set for any model change |
| `scripts/draft.py` | grounded drafting, claim check, evaluator, bid/no-bid |
| `evidence/` | two fictional bidders with planted gaps, and the degraded-answer test (`out/draft/*/draft.degraded.json`) |
| `scripts/report_tables.py`, `scripts/cost_model.py` | regenerate `out/tables.md`, `out/cost_model.md` |
| `packs/sources.json`, `scripts/fetch_packs.py` | reproducible pack download |
