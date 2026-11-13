# Find a Tender OCDS feed: measured data profile

Companion to `uk-procurement-reference.md`. Everything in sections 0–7 is **measured** on the local sample or **quoted** from the Find a Tender (FTS) documentation; sections 8–9 are **recommendations** and are labelled as such. Profile date: 2026-11-13.

Source keys in square brackets resolve to URLs in [Sources](#sources). `[SAMPLE]` means "measured on the local sample described in section 0".

## 0. Sample and method

| Item | Value |
|---|---|
| Files | `/home/user/data/fts/raw/2026-10-23_2026-10-30.jsonl.gz`, `2026-10-30_2026-11-06.jsonl.gz`, `2026-11-06_2026-11-13.jsonl.gz` (one OCDS release per line) |
| How harvested | `ocdsReleasePackages?updatedFrom=…&updatedTo=…&limit=100`, no `stages` filter, following `links.next` |
| Size | 7,176 releases, 6,305 distinct `ocid`, 7,176 distinct release `id` |
| Volume | 2,282 to 2,462 releases per week; 430–550 per weekday, single digits at weekends |
| Hold-out check | Two earlier weeks (9–23 Oct 2026, 4,625 releases) gave the same class mix (each class within 2 points) and presence rates within 6 points on 16 spot-checked fields |

- **Class** of a release = the `noticeType` of the document whose `id` equals the release `id` (for example `UK4`). Releases under the old regulations carry no `noticeType`; they are grouped as `L-planning`, `L-tender`, `L-award` from `tag`.
- **Presence %** = share of releases in a class with at least one non-empty value at the JSON path (`[]` = any array element). `·` = never present; `<1` = present but under 0.5%.
- A three-week window understates cross-notice linking: 90% of `ocid`s have a single release in the window.
- Small classes (UK3 n=52, UK9 n=15, UK13 n=7, UK14 n=4) are indicative only. UK16 and UK17 did not occur in the sample.

## 1. API

| Fact | Detail | Source |
|---|---|---|
| Release packages | `GET https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages` | [FTS-REL] |
| Parameters | `limit` (1–100, default 100), `cursor`, `updatedFrom`, `updatedTo` (`YYYY-MM-DDTHH:MM:SS`), `stages` (`planning,tender,award`). Unknown parameter names return HTTP 400. | [FTS-REL] |
| By id | Append a notice id (`nnnnnn-yyyy`) or an ocid (`ocds-h6vhtk-hhhhhh`) to the path | [FTS-REL] |
| Record packages | `GET /api/1.0/ocdsRecordPackages/{ocid}`; no query parameters | [FTS-REC] |
| Record content | One record with `releases[]` (every notice version, embedded in full), `compiledRelease` (merged view, `tag: ["compiled"]`, all notice documents listed) and `versionedRelease` | [SAMPLE] (one live call, `ocds-h6vhtk-07931b`) |
| Pagination | Response carries `links.next`, a full URL with a base64 `cursor`; absent on the last page | [SAMPLE] |
| Format | OCDS 1.1 (docs say 1.1.5 mapping) with the OCP EU profile plus 8 further extensions, including the Cabinet Office UK extension | [FTS-DEV], [SAMPLE] |
| Rate limiting (documented) | HTTP 429 or 503 with a `Retry-After` header in seconds; no quota is published | [FTS-REL] |
| Rate limiting (observed) | About 125 requests spaced 10 s apart drew three 429s, each with `Retry-After: 120`. A normal 200 response carries no rate-limit headers. | [SAMPLE] harvest log |
| Per-notice downloads | Notice pages link `…/Notice/{id}/OCDS/ReleasePackage` and `…/OCDS/Record` | [SAMPLE] notice page |
| Other formats | Daily XML zips on data.gov.uk | [FTS-DEV] |
| Licence | Open Government Licence v3.0 (`license` field in every package) | [FTS-DEV], [SAMPLE] |
| Attribution | FTS specifies no statement of its own, so the OGL default applies: **"Contains public sector information licensed under the Open Government Licence v3.0."** Link to the licence where possible. | [OGL], [FTS-TC] |
| Licence exclusions | OGL does not cover personal data, logos or third-party rights | [OGL] |

- `updatedFrom`/`updatedTo` select on the release `date`; every edit of a notice is a new release with a new `id`, so an incremental harvest by date window sees all versions. [SAMPLE]
- Window edges look like UK local time: a release dated `2026-10-23T00:22:50+01:00` (22 October 23:22 UTC) came back for `updatedFrom=2026-10-23T00:00:00`. Release `date` itself used `+01:00` on 536 releases before the clock change and `Z` after. REC: overlap windows slightly and de-duplicate on release `id`. [SAMPLE]
- The plain-HTML notice pages return 403 to a non-browser client; the API and documentation pages do not. [SAMPLE]

## 2. Release `tag` → notice type → stage

`tag` alone cannot identify the notice type: UK5, UK6, UK7, UK14 and UK15 all carry `["award","contract"]`. Use `documents[].noticeType`.

| Class | Releases | % | `tag` values seen (count) | Where the notice document sits |
|---|---:|---:|---|---|
| UK1 | 93 | 1.3 | `planning` (72), `planningUpdate` (21) | `planning.documents[]` type `plannedProcurementNotice` |
| UK2 | 589 | 8.2 | `planning` (459), `planningUpdate` (130) | `planning.documents[]` type `marketEngagementNotice` |
| UK3 | 52 | 0.7 | `planning` (42), `planningUpdate` (10) | `planning.documents[]` type `plannedProcurementNotice` |
| UK4 | 1304 | 18.2 | `tender` (982), `tenderUpdate` (322) | `tender.documents[]` type `tenderNotice` |
| UK5 | 276 | 3.8 | `award+contract` (268), `awardUpdate+contractUpdate` (8) | `awards[].documents[]` type `awardNotice` |
| UK6 | 1001 | 13.9 | `award+contract` (954), `awardUpdate+contractUpdate` (47) | `awards[].documents[]` type `awardNotice` |
| UK7 | 2609 | 36.4 | `award+contract` (2573), `awardUpdate+contractUpdate` (36) | `contracts[].documents[]` type `contractNotice` |
| UK9 | 15 | 0.2 | `implementation` (15) | `contracts[].documents[]` type `implementationNotice` |
| UK10 | 40 | 0.6 | `contractAmendment` (40) | `contracts[].documents[]` type `contractNotice` |
| UK11 | 33 | 0.5 | `contractTermination` (33) | `contracts[].documents[]` type `contractTerminationNotice` |
| UK12 | 89 | 1.2 | `tenderCancellation` (89) | `tender.documents[]` type `tenderCancellationNotice` |
| UK13 | 7 | 0.1 | `tender` (6), `tenderUpdate` (1) | `tender.documents[]` type `tenderNotice` |
| UK14 | 4 | 0.1 | `award+contract` (3), `awardUpdate+contractUpdate` (1) | `tender.documents[]` type `awardNotice` |
| UK15 | 38 | 0.5 | `award+contract` (38) | `tender.documents[]` type `awardNotice` |
| L-planning | 79 | 1.1 | `planning` (79) | no `noticeType` (legacy) |
| L-tender | 210 | 2.9 | `tender` (123), `tenderUpdate` (83), `planning+tender` (4) | no `noticeType` (legacy) |
| L-award | 737 | 10.3 | `award+contract` (685), `awardUpdate+contractUpdate` (52) | no `noticeType` (legacy) |
| **Total** | **7176** | 100 | | |

In the table, `award+contract` means the array `["award","contract"]`.

| Class | Official name [FTS-NT] | Stage for product purposes |
|---|---|---|
| UK1 | Pipeline notice | Forward look |
| UK2 | Preliminary market engagement notice | Pre-tender |
| UK3 | Planned procurement notice | Pre-tender |
| UK4 | Tender notice (also the below-threshold tender notice) | Live opportunity |
| UK5 | Transparency notice (intended direct award) | Award intent |
| UK6 | Contract award notice (decision, before signature) | Award |
| UK7 | Contract details notice (after signature) | Contract |
| UK9 / UK10 / UK11 | Contract performance / change / termination notice | Contract management |
| UK12 | Procurement termination notice | Cancelled |
| UK13 / UK14 / UK15 | Dynamic market intention / establishment / modification notice | Dynamic market |
| L-* | Notices under the 2015/2016/2011 regulations (`legalBasis.scheme = CELEX`) | As tagged |

- Legal basis: 6,150 releases `UKPGA 2023/54`; 1,026 legacy (980 `32014L0024` public contracts, 42 `32014L0025` utilities, 3 `32014L0023` concessions, 1 `32009L0081` defence). [SAMPLE]
- 208 of the 1,026 legacy releases carry `links[rel=canonical]` pointing at `api.publiccontractsscotland.gov.uk`; 206 legacy releases have a buyer in region `UKM` (Scotland). [SAMPLE]
- UK14/UK15 list dynamic-market members as `awards[].suppliers[]` (38 UK15 releases carried 770 `awards` entries). Exclude them from award statistics. [SAMPLE]

## 3. Field presence by class (% of releases)

| JSON path | UK1 (n=93) | UK2 (n=589) | UK3 (n=52) | UK4 (n=1304) | UK5 (n=276) | UK6 (n=1001) | UK7 (n=2609) | L-tender (n=210) | L-award (n=737) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **Core text** | | | | | | | | | |
| `tender.title` | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| `tender.description` | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 93 |
| `tender.status` | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 60 | 93 |
| **Classification** | | | | | | | | | |
| `tender.classification.id` | · | · | · | · | · | · | · | 100 | 100 |
| `tender.items[].additionalClassifications[].id` | 100 | 100 | 100 | 100 | · | · | · | 43 | 45 |
| `awards[].items[].additionalClassifications[].id` | · | · | · | · | 100 | 100 | 100 | · | · |
| `tender.mainProcurementCategory` | 100 | 100 | 100 | 100 | · | · | · | 100 | 100 |
| `awards[].mainProcurementCategory` | · | · | · | · | 100 | 100 | 100 | · | · |
| **Value** | | | | | | | | | |
| `tender.value.amountGross` | 83 | 75 | 81 | 100 | · | · | · | · | · |
| `tender.value.amount` | 82 | 64 | 79 | 82 | · | · | · | 43 | · |
| `tender.lots[].value.amountGross` | · | · | 75 | 100 | · | · | · | · | · |
| `awards[].value.amountGross` | · | · | · | · | 100 | 100 | · | · | · |
| `awards[].value.amount` | · | · | · | · | 86 | 87 | · | · | · |
| `contracts[].value.amountGross` | · | · | · | · | · | · | 100 | · | · |
| `contracts[].value.amount` | · | · | · | · | · | · | 85 | · | 90 |
| **Lots** | | | | | | | | | |
| `tender.lots[].id` | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 60 | 100 |
| `tender.lots[].title` | · | · | 17 | 18 | · | · | · | 12 | 8 |
| `tender.lots[].description` | · | · | 17 | 18 | · | · | · | 60 | 100 |
| `awards[].relatedLots[]` | · | · | · | · | 100 | 100 | 100 | · | 98 |
| **Dates & submission** | | | | | | | | | |
| `tender.tenderPeriod.endDate` | · | · | 79 | 91 | · | · | · | 60 | · |
| `tender.expressionOfInterestDeadline` | · | · | 21 | 9 | · | · | · | · | · |
| `tender.enquiryPeriod.endDate` | · | · | 52 | 85 | · | · | · | · | · |
| `tender.awardPeriod.endDate` | · | · | 90 | 56 | · | · | · | · | · |
| `tender.communication.futureNoticeDate` | 86 | 60 | 100 | · | · | · | · | · | · |
| `tender.submissionMethodDetails` | · | · | 60 | 100 | · | · | · | 58 | · |
| `tender.submissionTerms.electronicSubmissionPolicy` | · | · | 75 | 100 | · | · | · | · | · |
| `tender.documents[].url` | · | · | 10 | 100 | · | · | · | · | · |
| **Award criteria** | | | | | | | | | |
| `tender.lots[].awardCriteria.criteria[].type` | · | · | 25 | 75 | · | · | · | 28 | 88 |
| `tender.lots[].awardCriteria.criteria[].name` | · | · | 25 | 75 | · | · | · | 28 | 47 |
| `tender.lots[].awardCriteria.criteria[].numbers[].number` | · | · | 19 | 65 | · | · | · | · | · |
| `tender.lots[].awardCriteria.criteria[].description` | · | · | 10 | 37 | · | · | · | 28 | 47 |
| `tender.lots[].awardCriteria.description` | · | · | 2 | 25 | · | · | · | · | · |
| `tender.lots[].selectionCriteria.criteria[].description` | · | · | 23 | 29 | · | · | · | · | · |
| **Procedure & regime** | | | | | | | | | |
| `tender.procurementMethod` | 57 | · | 100 | 100 | 100 | 98 | 89 | 59 | 93 |
| `tender.procurementMethodDetails` | 73 | · | 100 | 100 | 100 | 100 | 100 | 59 | 93 |
| `tender.procurementMethodRationaleClassifications[].id` | · | · | · | · | 63 | 1 | 5 | · | 58 |
| `tender.legalBasis.id` | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| `tender.aboveThreshold` | 76 | 90 | 100 | 100 | · | · | · | · | · |
| `awards[].aboveThreshold` | · | · | · | · | 100 | 100 | · | · | · |
| `contracts[].aboveThreshold` | · | · | · | · | · | · | 100 | · | · |
| `tender.specialRegime[]` | 22 | 26 | 21 | 17 | 16 | 17 | 14 | · | · |
| `tender.techniques.hasFrameworkAgreement` | 27 | 17 | 19 | 14 | 3 | 8 | 3 | 11 | 7 |
| `relatedProcesses[].id` | 11 | · | · | <1 | <1 | 23 | 11 | · | · |
| **Contract period & renewal** | | | | | | | | | |
| `tender.lots[].contractPeriod.startDate` | 100 | 100 | 100 | 100 | · | · | · | 15 | 2 |
| `tender.lots[].contractPeriod.endDate` | 100 | 100 | 100 | 100 | · | · | · | 14 | 2 |
| `tender.lots[].contractPeriod.maxExtentDate` | 67 | 52 | 56 | 51 | · | · | · | · | · |
| `tender.lots[].hasRenewal` | 67 | 52 | 56 | 51 | · | · | · | 54 | · |
| `tender.lots[].renewal.description` | · | · | 56 | 51 | · | · | · | 31 | · |
| `tender.hasRecurrence` | · | · | 10 | 16 | · | · | · | 55 | · |
| `tender.recurrence.dates[].startDate` | · | · | 10 | 16 | · | · | · | · | · |
| `awards[].contractPeriod.endDate` | · | · | · | · | 100 | 100 | · | · | · |
| `awards[].contractPeriod.maxExtentDate` | · | · | · | · | 18 | 56 | · | · | · |
| `contracts[].period.startDate` | · | · | · | · | · | · | 100 | · | 2 |
| `contracts[].period.endDate` | · | · | · | · | · | · | 100 | · | 2 |
| `contracts[].period.maxExtentDate` | · | · | · | · | · | · | 24 | · | · |
| `contracts[].dateSigned` | · | · | · | · | · | · | 100 | · | 99 |
| **SME / reservation** | | | | | | | | | |
| `tender.lots[].suitability.sme` | 65 | 69 | 65 | 73 | 40 | · | · | · | · |
| `tender.lots[].suitability.vcse` | 32 | 36 | 27 | 33 | 13 | · | · | · | · |
| `tender.otherRequirements.reservedParticipation[]` | · | · | 6 | 2 | · | · | · | · | · |
| `tender.otherRequirements.reservedParticipationLocation.gazetteer.identifiers[]` | · | · | 4 | 8 | · | · | · | · | · |
| **Location** | | | | | | | | | |
| `tender.items[].deliveryAddresses[].region` | 72 | 81 | 83 | 81 | · | · | · | 60 | 100 |
| `awards[].items[].deliveryAddresses[].region` | · | · | · | · | 79 | 83 | 69 | · | · |
| `parties[].address.region` | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| `parties[].address.postalCode` | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 98 |
| **Buyer / parties** | | | | | | | | | |
| `buyer.id` | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| `parties[].identifier.scheme` | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 12 | 39 |
| `parties[].details.classifications[].id` | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 58 | 92 |
| `parties[].contactPoint.email` | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| `parties[].contactPoint.name` | 23 | 38 | 27 | 45 | 37 | 33 | 30 | 59 | 60 |
| `parties[].contactPoint.telephone` | 16 | 14 | 10 | 24 | 23 | 24 | 19 | 58 | 41 |
| `parties[].details.url` | 54 | 57 | 54 | 55 | 82 | 80 | 85 | 100 | 100 |
| **Award / contract** | | | | | | | | | |
| `awards[].suppliers[].id` | · | · | · | · | 97 | 100 | 100 | · | 97 |
| `awards[].status` | · | · | · | · | 100 | 100 | 100 | · | 100 |
| `awards[].date` | · | · | · | · | · | 100 | · | · | · |
| `awards[].standstillPeriod.endDate` | · | · | · | · | · | 57 | · | · | · |
| `awards[].assessmentSummariesDateSent` | · | · | · | · | · | 45 | · | · | · |
| `contracts[].awardID` | · | · | · | · | · | · | 100 | · | 99 |
| `contracts[].status` | · | · | · | · | · | · | 100 | · | 99 |
| `contracts[].agreedMetrics[].id` | · | · | · | · | · | · | 7 | · | · |
| `bids.statistics[].measure` | · | · | · | · | · | 51 | · | · | 87 |
| `bids.details[].tenderers[].id` | · | · | · | · | · | 13 | · | · | · |
| `tender.amendments[].id` | 13 | 14 | 13 | 16 | · | · | · | 40 | · |

How to read it:

- **Releases are per-notice snapshots, not cumulative.** Award-stage releases (UK5/UK6/UK7) do not repeat tender-stage fields: no `tender.items`, no tender value, no deadlines. CPV and delivery region move to `awards[].items[]`; value and dates move to `awards[]` or `contracts[]`.
- Under the Act there is no `tender.classification`; CPV codes live only in `…items[].additionalClassifications[]`. Legacy releases have `tender.classification` (main CPV) plus optional additional codes.
- Every UK4 has a deadline: 91% `tender.tenderPeriod.endDate`, the other 9% (118, all competitive flexible but one) `tender.expressionOfInterestDeadline` instead.
- `buyer` is absent from UK9, UK11 and UK12 releases (137 releases); recover the buyer through `ocid`.

## 4. Shapes and distributions

### 4.1 Award criteria and weightings

Path: `tender.lots[].awardCriteria.criteria[]`. Each criterion has `type` (`quality` 3,989; `price` 1,406; `cost` 431), `name`, optional `description`, optional `numbers[]`.

```json
"awardCriteria": {
  "criteria": [
    {"type": "quality", "name": "Quality",      "numbers": [{"number": 40, "weight": "percentageExact"}]},
    {"type": "price",   "name": "Price",        "numbers": [{"number": 50, "weight": "percentageExact"}]},
    {"type": "quality", "name": "Social Value", "numbers": [{"number": 10, "weight": "percentageExact"}]}
  ]
}
```

| Measure (UK4, 2,364 lots, 5,826 criteria) | Value |
|---|---|
| Lots with a `criteria[]` array | 2,003 (85%) |
| Criteria with a numeric weight | 4,492 (77%); `weight` is `percentageExact` in 4,435 and `order` (a ranking) in 57 |
| Lots whose percentage weights sum to exactly 100 | 1,570 of the 1,570 lots that have percentage weights |
| UK4 releases with any numeric weight | 65% overall: 617 of 730 above threshold (85%), 232 of 574 below threshold (40%) |
| Where weights are not numeric | Free text in `criteria[].description`, `awardCriteria.description` (25% of UK4) or `weightingDescription` (10%), or only in the tender documents. 326 UK4 notices, all below threshold, have no structured criteria at all. |
| Criteria per lot | 2 in 891 lots, 3 in 510, 1 in 268, 4 or more in 334 |
| Most common price/cost weights | 40 (343 criteria), 30 (313), 60 (186), 50 (133), 70 (107), 20 (101) |
| UK4 with a criterion naming "social" | 311 (24%); weights 10 (384 criteria), 5 (52), 2.5 (28), 12 (21), 20 (20) |

- Sub-criteria are flattened into the same array: one 63-lot tender repeated the same 10 criteria on every lot, and the largest single lot had 29 criteria. Criterion `name` is free text ("Criterion 1", "Quality /Price 60/40"). [SAMPLE]
- Selection criteria: `tender.lots[].selectionCriteria.criteria[]` with `type` `economic` or `technical` and a free-text `description` (29% of UK4). [SAMPLE]

### 4.2 Values

The UK extension adds `amountGross` (including tax) beside OCDS `amount` (net). [UKEXT]

| Field | n values | p10 | p25 | median | p75 | p90 | =0 | 0<v≤1 | ≥£1bn |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| UK4 `tender.value.amountGross` | 1304 | £37,100 | £110,400 | £504,000 | £3,600,000 | £25,323,110 | 35 | 5 | 8 |
| UK5 `awards[].value.amountGross` | 279 | £40,306 | £90,000 | £264,000 | £803,534 | £3,587,893 | 0 | 1 | 0 |
| UK6 `awards[].value.amountGross` | 1434 | £73,920 | £240,000 | £840,000 | £4,800,000 | £31,440,000 | 12 | 1 | 17 |
| UK7 `contracts[].value.amountGross` | 2896 | £24,000 | £43,562 | £96,000 | £394,800 | £3,110,400 | 2 | 1 | 7 |
| Legacy award `contracts[].value.amount` | 1087 | £5,124 | £56,025 | £200,000 | £1,244,000 | £8,000,000 | 0 | 33 | 10 |
| Legacy tender `tender.value.amount` | 91 | £150,000 | £292,500 | £850,000 | £10,000,000 | £36,850,000 | 0 | 0 | 0 |

| Observation | Count |
|---|---|
| UK7 contracts with gross only, no net `amount` | 437 of 2,896 (15%) |
| Gross/net ratio where both present (all `contracts[]` entries) | 1.20 in 2,082 of 2,471 (84%); 1.00 in 299 (12%); other in 4% |
| Non-GBP currency values (USD, EUR, NOK, CAD, FKP, THB) | 36 of 7,716 |
| UK7 releases with more than one contract where all contracts show the same value | 29 of 101 |
| UK6 releases with more than one award where all awards show the same value | 38 of 120 |
| Legacy award values of £1 or less | 33 of 1,087 (3%); a further 42 between £1 and £1,000 |

UK7 `contracts[].value.amountGross` bands (2,896 contracts): under £12k 47; £12k–£30k 341; £30k–£100k 1,101; £100k–£215k 455; £215k–£1m 461; £1m–£5m 283; £5m–£1bn 201; £1bn or more 7.

### 4.3 Procedure, threshold flag, special regimes, frameworks

`tender.procurementMethod` is the coarse OCDS code; `tender.procurementMethodDetails` is the UK label and is the field to use.

| Notice | `tender.procurementMethod` | `tender.procurementMethodDetails` | Releases | % of notice type |
|---|---|---|---:|---:|
| UK3 | `open` | Open procedure | 23 | 44 |
| UK3 | `open` | Competitive flexible procedure | 13 | 25 |
| UK3 | `selective` | Competitive flexible procedure | 11 | 21 |
| UK3 | `open` | Below threshold - open competition | 5 | 10 |
| UK4 | `open` | Below threshold - open competition | 574 | 44 |
| UK4 | `open` | Open procedure | 484 | 37 |
| UK4 | `open` | Competitive flexible procedure | 127 | 10 |
| UK4 | `selective` | Competitive flexible procedure | 119 | 9 |
| UK5 | `direct` | Direct award | 173 | 63 |
| UK5 | `direct` | Below threshold - without competition | 103 | 37 |
| UK6 | `open` | Open procedure | 295 | 29 |
| UK6 | `selective` | Award under framework | 193 | 19 |
| UK6 | `direct` | Direct award | 151 | 15 |
| UK6 | `open` | Competitive flexible procedure | 85 | 8 |
| UK6 | `open` | Below threshold - open competition | 76 | 8 |
| UK6 | `selective` | Competitive flexible procedure | 66 | 7 |
| UK6 | `direct` | Below threshold - without competition | 63 | 6 |
| UK6 | `selective` | Below threshold - award under framework | 27 | 3 |
| UK6 | (absent) | Below threshold - unknown | 25 | 2 |
| UK6 | `limited` | Below threshold - limited competition | 20 | 2 |
| UK7 | `direct` | Below threshold - without competition | 860 | 33 |
| UK7 | `limited` | Below threshold - limited competition | 518 | 20 |
| UK7 | (absent) | Below threshold - unknown | 300 | 11 |
| UK7 | `open` | Open procedure | 233 | 9 |
| UK7 | `open` | Below threshold - open competition | 201 | 8 |
| UK7 | `selective` | Below threshold - award under framework | 155 | 6 |
| UK7 | `direct` | Direct award | 125 | 5 |
| UK7 | `selective` | Award under framework | 99 | 4 |
| UK7 | `open` | Competitive flexible procedure | 74 | 3 |
| UK7 | `selective` | Competitive flexible procedure | 44 | 2 |
| L-tender | `open` | Open procedure | 97 | 46 |
| L-tender | (absent) | (absent) | 86 | 41 |
| L-tender | `selective` | Restricted procedure | 18 | 9 |
| L-tender | `selective` | Competitive procedure with negotiation | 7 | 3 |
| L-award | `limited` | Award procedure without prior publication of a call for competition | 427 | 58 |
| L-award | `open` | Open procedure | 157 | 21 |
| L-award | `selective` | Restricted procedure | 66 | 9 |
| L-award | (absent) | (absent) | 52 | 7 |
| L-award | `selective` | Negotiated procedure with prior call for competition | 22 | 3 |

Threshold flag (`aboveThreshold`, boolean, UK extension). It sits on `tender` before award, on `awards[]` in UK5/UK6 and on `contracts[]` in UK7:

| Notice | Path | true | false | mixed | absent |
|---|---|---:|---:|---:|---:|
| UK1 | `tender.aboveThreshold` | 69 | 2 | 0 | 22 |
| UK2 | `tender.aboveThreshold` | 414 | 114 | 0 | 61 |
| UK3 | `tender.aboveThreshold` | 47 | 5 | 0 | 0 |
| UK4 | `tender.aboveThreshold` | 730 | 574 | 0 | 0 |
| UK5 | `awards[].aboveThreshold` | 164 | 112 | 0 | 0 |
| UK6 | `awards[].aboveThreshold` | 743 | 247 | 11 | 0 |
| UK7 | `contracts[].aboveThreshold` | 515 | 2081 | 13 | 0 |

- **80% of UK7 contract details notices are below threshold** (2,081 of 2,609); 82% in the hold-out weeks. Their procedure labels: without competition 860, limited competition 518, unknown 300, open competition 201, award under framework 155, other 47. [SAMPLE]
- 44% of UK4 tender notices are below-threshold open competitions (574 of 1,304). [SAMPLE]
- `tender.specialRegime[]`: `lightTouch` 666 releases, `utilities` 199, `concession` 87, `defenceSecurity` 50 (some carry two). [SAMPLE]
- Framework being set up: `tender.techniques.hasFrameworkAgreement = true` (187 UK4, 85 UK6, 77 UK7), with `frameworkAgreement.type` (`closed` 188, `open` 99), `.method` (`withAndWithoutReopeningCompetition` 161, `withoutReopeningCompetition` 71, `withReopeningCompetition` 36), `.isOpenFrameworkScheme`, `.maximumParticipants`, `.buyerCategories`. [SAMPLE]
- Call-off from a framework: `procurementMethodDetails` "Award under framework" or "Below threshold - award under framework", plus `relatedProcesses[]` with `relationship: ["framework"]`, `scheme: "ocid"`, `identifier` = the framework's ocid (276 UK7, 228 UK6). 515 references pointed at 122 distinct frameworks; only 13 of those frameworks had a release inside the sample window. [SAMPLE]
- Dynamic market: `procurementMethodDetails = "Dynamic market"` on UK13; `tender.techniques.hasDynamicPurchasingSystem` on 22 releases. [SAMPLE]
- Direct-award reasons (UK5): `tender.procurementMethodRationaleClassifications[].id`, for example `singleSuppliersTechnicalReasons` 85, `singleSuppliersIntellectualPropertyExclusiveRights` 44, `additionalRepeatExtensionPartialReplacement` 34, `urgency` 20, `switchingDirectAward` 12. [SAMPLE]

### 4.4 Contract period, renewal, recurrence

| Path | Meaning | Notes [SAMPLE] |
|---|---|---|
| `tender.lots[].contractPeriod.{startDate,endDate}` | Estimated dates at tender stage | 100% of UK1–UK4 |
| `…contractPeriod.maxExtentDate` + `hasRenewal` + `renewal.description` | Latest end if all extensions are used; free-text extension terms | 51% of UK4 |
| `awards[].contractPeriod.*` | Same, at award decision | 100% of UK5/UK6 for start/end; `maxExtentDate` 56% of UK6, 18% of UK5 |
| `contracts[].period.{startDate,endDate,maxExtentDate}` | Signed contract dates | start/end 100% of UK7; `maxExtentDate` 24% |
| `contracts[].dateSigned` | Signature date | 100% of UK7 |
| `tender.hasRecurrence` + `tender.recurrence.dates[].startDate` | Buyer expects to re-procure; estimated date of the next tender notice | 16% of UK4 (205), always with a date |
| `tender.lots[].contractPeriod.durationInDays` | Legacy way of stating length | 43% of legacy tenders; only 7% of legacy awards carry any contract period |

- UK7 contract length (start to end, 2,896 contracts): 3 months or less 550; 4–12 months 1,136; 13–24 months 443; 25–48 months 619; over 48 months 148. Median 12 months.
- Where `maxExtentDate` exists, the extension beyond `endDate` has a median of 24 months.
- UK7 notices appear a median of 18 days after `dateSigned` (p75 58 days, p90 140 days, maximum 939). 79% of contracts had already started when the notice was published and 225 (8%) had already ended.

### 4.5 Parties

Roles seen: `buyer` 7,500, `supplier` 7,150, `tenderer` 1,035, `reviewBody` 861, `procuringEntity` 523, `processContactPoint` 261, `centralPurchasingBody` 149, `mediationBody` 74, `reviewContactPoint` 54, `removedSupplier` 9, `funder` 1.

| Party set | n party entries | `parties[].id` prefix shares |
|---|---:|---|
| PA23 buyers | 6419 | `GB-PPON` 85%, `GB-COH` 10%, `GB-NHS` 3%, `GB-UKPRN` 1%, `GB-CHC` 1%, `GB-MPR` 1%, `GB-SC` 0% |
| PA23 suppliers | 5807 | `GB-COH` 57%, `GB-PPON` 40%, `GB-FTS` 2%, `GB-UKPRN` 0%, `GB-NHS` 0%, `GB-CHC` 0%, `GB-MPR` 0% |
| Legacy buyers | 1081 | `GB-FTS` 88%, `GB-NHS` 7%, `GB-COH` 4%, `GB-MPR` 1%, `GB-CHC` 0%, `GB-UKPRN` 0% |
| Legacy suppliers | 1343 | `GB-FTS` 69%, `GB-COH` 29%, `GB-NHS` 1%, `GB-CHC` 1% |

```json
{
  "name": "EXAMPLE SUPPLIER LIMITED",
  "id": "GB-COH-01234567",
  "identifier": {"scheme": "GB-COH", "id": "01234567"},
  "additionalIdentifiers": [{"scheme": "GB-PPON", "id": "PABC-1234-DEFG"}],
  "address": {"streetAddress": "…", "locality": "…", "postalCode": "…", "country": "GB", "countryName": "United Kingdom", "region": "UKE22"},
  "contactPoint": {"email": "<redacted>"},
  "roles": ["supplier"],
  "details": {"url": "…", "scale": "sme", "vcse": false}
}
```

| Supplier field (Procurement Act notices, 5,807 supplier entries) | Presence / values |
|---|---|
| `details.scale` | `sme` 3,330 (57%), `large` 2,455 (42%), missing 22 |
| `details.vcse` | `true` 258 (4%), `false` 5,527, missing 22 |
| `details.shelteredWorkshop`, `details.publicServiceMissionOrganization` | Present on half of entries; `true` on 25 and 12 entries respectively |
| Primary id | `GB-COH` (Companies House number) when the supplier has one, with the platform id as `additionalIdentifiers[scheme=GB-PPON]` in 2,422 of 3,302 cases; otherwise `GB-PPON`; 2% `GB-FTS-n` |
| Address: street, locality, postcode, region, country | 100% |
| `contactPoint.email` | 100%; 258 (4.4%) use a free-mail domain |
| `contactPoint.name`, `.telephone` | 6%, 7% |
| `details.url` | 47% |
| Country other than `GB` | 184 (3.2%): US 43, DE 20, NL 17, IE 16 |

| Buyer field (Procurement Act notices, 6,419 buyer entries) | Presence / values |
|---|---|
| `details.classifications[scheme=UK_CA_TYPE].id` | `publicAuthoritySubCentralGovernment` 3,973 (62%), `publicAuthorityCentralGovernment` 1,994 (31%), `publicUndertaking` 353, `privateUtility` 99 |
| `details.classifications[scheme=UK_CA_DEVOLVED_REGULATIONS].id` | `GB-WLS` 526, `GB-NIR` 218, `GB-SCT` 12 |
| `address.region` | 100%, usually a 5-character code such as `UKK14` |
| `contactPoint.email` | 100%; 41% start with a generic word such as "procurement" or "tenders" |
| `contactPoint.name` | 37% of all buyer entries (2,794 of 7,500); most look like a person's name |

- Legacy notices: buyer and supplier ids are mostly `GB-FTS-n`, an FTS-internal number with no `identifier.scheme`. Buyer classifications use `TED_CA_TYPE` and `COFOG`. Supplier `scale` is present on 97% of legacy award suppliers; `vcse` never. [SAMPLE]
- `awards[].suppliers[].id` always resolved to a `parties[].id` in the same release (9,949 of 9,949). [SAMPLE]
- SME definition behind `scale` and the bid statistics: fewer than 250 staff and either turnover of £44m or less or balance sheet total of £38m or less. [UKEXT], [ACT-s123]
- UK6 names unsuccessful tenderers in 13% of releases, as `parties` with role `tenderer` and `bids.details[].tenderers[]`. [SAMPLE]

### 4.6 Locations

- Delivery location: `tender.items[].deliveryAddresses[].region` (81% of UK4) and `awards[].items[].deliveryAddresses[].region` (83% of UK6, 69% of UK7), with `country`. [SAMPLE]
- Codes use the `UK` prefix at mixed depth: `UK` (whole UK), `UKx` (for example `UKI` London), `UKxn`, `UKxnn` (for example `UKK14` Swindon). Of 5,446 releases with a delivery region, 87% name one region and 1,189 (22%) say only `UK`. Depth of the 8,908 distinct release-region pairs: `UK` 14%, 3 characters 48%, 4 characters 9%, 5 characters 29%. Non-UK deliveries (79 releases) use a bare country code in `region`. [SAMPLE]
- Releases per top-level delivery region: `UK` 1,237, `UKJ` 787, `UKI` 759, `UKH` 725, `UKD` 720, `UKG` 690, `UKE` 671, `UKF` 670, `UKK` 664, `UKC` 615, `UKL` 518, `UKM` 234, `UKN` 129. [SAMPLE]
- 19% of UK4 and 31% of UK7 have no delivery region. The buyer's `address.region` is always present and is the practical fallback. [SAMPLE]
- Reserved-by-location tenders: `tender.otherRequirements.reservedParticipationLocation.gazetteer` with `scheme: "GB-ONS"` and ONS codes (`K02000001` = United Kingdom in 87 releases; county codes such as `E10000032` in the rest). [SAMPLE]
- Whether the `UK…` codes follow a specific NUTS or ITL edition is UNKNOWN; the feed does not say.

### 4.7 Documents and submission

| Path | Finding [SAMPLE] |
|---|---|
| `tender.documents[]` where `documentType = "tenderNotice"` | The notice itself: `url` = `https://www.find-tender.service.gov.uk/Notice/{id}`, `datePublished`, `noticeType` |
| `tender.documents[]` where `documentType = "biddingDocuments"` | Tender pack links: 36% of UK4 have at least one URL. Hosts: find-tender attachments (`/Notice/Attachment/A-n`), sell2wales.gov.wales, mytenders.co.uk, procontract.due-north.com, in-tendhost.co.uk |
| `tender.documents[]` with `id` `conflictOfInterest`, `economic`, `technical` | Placeholders with a description and no URL |
| `tender.submissionMethodDetails` | Free text, present on 100% of UK4; contains a URL in 93%. Top portals: delta-esourcing.com, in-tendhost.co.uk, procontract.due-north.com, supplier.in-tend.co.uk, etendersni.gov.uk, uk.eu-supply.com, Jaggaer (eTenderWales), health-family.force.com |
| `tender.submissionTerms.electronicSubmissionPolicy` | UK4: `allowed` 1,203, `notAllowed` 101 |
| `contracts[].documents[]` where `documentType = "contractSigned"` | 350 attached contract copies across UK7 |
| `tender.enquiryPeriod.endDate` | Clarification deadline, 85% of UK4 |

Days from publication to tender deadline (new UK4, not updates): median 28; above threshold median 30 (p10 25); below threshold median 25 (p10 14, minimum 2).

### 4.8 Bid statistics

`bids.statistics[]` entries are `{id, measure, value, relatedLot}`. Present on 51% of UK6 and 87% of legacy awards, never on UK7. Measures: `bids` 1,948, `finalStageBids` 866, `smeFinalStageBids` 866, `vcseFinalStageBids` 866, `smeBids` 417, `electronicBids` 357, `foreignBidsFromNonEU` 297, `foreignBidsFromEU` 279, `lowestValidBidValue` 75, `highestValidBidValue` 75. Of 866 `finalStageBids` values: one bid 111, two 122, three 109, four to nine 354, ten or more 159, zero 11. [SAMPLE]

### 4.9 Other notice types

| Class | Key paths [SAMPLE] |
|---|---|
| UK2 | `planning.milestones[]` with `type: "engagement"`, `dueDate`, `status`; `tender.communication.futureNoticeDate` (60%) = expected tender notice date |
| UK1 | `tender.communication.futureNoticeDate` (86%), `tender.value`, `tender.lots[].contractPeriod` |
| UK6 | `awards[].status` `pending` (897) or `active` (565); `awards[].date` (decision date); `awards[].standstillPeriod.endDate` (57%, absent for most framework call-offs and all below-threshold awards); `awards[].assessmentSummariesDateSent` (45%); `awards[].milestones[type=futureSignatureDate]` |
| UK7 | `contracts[].agreedMetrics[]` (KPIs: `title`, `description`) on 7%; `contracts[].noAgreedMetricsRationale` |
| UK9 | `contracts[].implementation.metrics[].observations[]` with `period` and `measureClassification.id` (`met`, `slightlyBelow`, `below`, `significantlyBelow`, `other`); `performanceFailures[]` |
| UK10 | `contracts[].proposedAmendments[]` / `amendments[]` with `rationaleClassifications[].id` (for example `additionalGoodsServicesWorks`, `transferCorporateRestructuring`), new `value`, `period`, `aboveThreshold` |
| UK11 | `contracts[].status = "terminated"`, `terminationRationaleClassifications[].id` (`contractCompleted` 21, `other` 8, `mutuallyAgreed` 3, `breachOfContract` 1), `implementation.endDate`, `implementation.finalValue` |
| UK12 | `tender.status` `cancelled`/`withdrawn`/`complete`; `awards[].status = "cancelled"` with `statusDetails` (free-text reason) and `finalStatusDate` |
| UK13–UK15 | `tender.techniques`, `tender.participationFees[]`; members in `awards[].suppliers[]`; changes in `awards[].amendments[]` |

## 5. Linking, versions, re-tenders

- **One procurement = one `ocid`** (`ocds-h6vhtk-` + 6 hex digits). The release `id` is the notice id (`nnnnnn-yyyy`). [FTS-REL], [SAMPLE]
- A direct award that follows a failed competition, and each call-off from a framework, gets its own `ocid`; the link back is in `relatedProcesses[]` (`unsuccessfulProcess`, `framework`, `prior`). [FTS-NT], [G-CDP], [SAMPLE]
- **An edit is a new release** with a new `id`, a new `date` and a `…Update` tag (`tenderUpdate`, `planningUpdate`, `awardUpdate`+`contractUpdate`). 711 of 7,176 releases were updates. The old release stays retrievable. [SAMPLE]
- Change text: `tender.amendments[].description` with `amendments[].id` = the new notice id (56% of updates). Legacy updates use `amendments[].unstructuredChanges[]` with `oldValue`, `newValue` and `where.section`/`where.label`. [SAMPLE]
- Act-regime releases do not point to the version they replace (60 legacy releases carry `links[rel=prev]`). Order versions by `date` within `ocid` and notice type, or read `compiledRelease`. [SAMPLE]
- `tender.id` equals the ocid in 30% of releases and is something else (typically a buyer reference) in 70%; do not use it as a key. `awards[].id` and `contracts[].id` are small integers (`1`, `2`) or `{noticeId}-n` strings, so they are not globally unique; key them with the ocid. [SAMPLE]

| Sequence of releases sharing one `ocid` (within the 3-week sample) | ocids |
|---|---:|
| UK5 → UK6 | 95 |
| UK4 → UK4(update) | 91 |
| UK6 → UK7 | 89 |
| UK2 → UK2(update) | 47 |
| UK4 → UK4(update) → UK4(update) | 23 |
| UK5 → UK7 | 22 |
| UK4(update) → UK4(update) | 17 |
| UK5 → UK6 → UK7 | 15 |
| UK6 → UK6(update) | 14 |
| UK7 → UK7(update) | 14 |
| L-award → L-award | 13 |
| UK1 → UK2 | 9 |
| UK7 → UK7 | 8 |
| UK2 → UK4 | 7 |

Recognising a re-tender of an expiring contract (measured signals, weakest last):

1. `tender.hasRecurrence = true` with `tender.recurrence.dates[].startDate` on the **current** tender: the buyer states when it expects to tender again (16% of UK4).
2. A stored contract (UK7, or legacy award) from the same buyer with overlapping CPV whose `period.endDate` or `maxExtentDate` falls shortly before the new tender's `contractPeriod.startDate`. This needs history; the feed has no explicit "replaces contract X" field.
3. `relatedProcesses[].relationship = ["prior"]`: 7 releases in three weeks.
4. Wording in title or description (re-tender, re-procure, existing/current contract, incumbent, expiry, TUPE): 4.5% of UK4; "TUPE" alone 1.1%.
5. UK1 pipeline and UK2 engagement notices for the same buyer and CPV (10% of releases) give earlier warning than the tender.

## 6. Data-quality pitfalls (all observed in the sample)

| # | Pitfall | Evidence | Handling (recommendation) |
|---|---|---|---|
| 1 | `tag` does not identify the notice type | UK5/6/7/14/15 share `award,contract` | Classify by `documents[].noticeType` where `documents[].id = release.id` |
| 2 | Releases are not cumulative | Award releases carry no tender items, value or deadlines | Compile per `ocid`, newest value wins, or fetch the record package |
| 3 | Most contract notices stand alone | 90% of ocids had one release in the window; 80% of UK7 are below threshold, often with no tender notice at all | Never require a tender to exist for a contract |
| 4 | Dynamic-market members look like awards | 770 `awards` in 38 UK15 releases | Filter on notice type before counting awards |
| 5 | Framework values inflate totals | 29 of 101 multi-contract UK7 repeat one value; ceilings of £1bn+ on 7 UK7 contracts | Flag frameworks; never sum framework values per supplier |
| 6 | Net value missing | 15% of UK7 contracts have `amountGross` only | Store both; derive net only as an estimate |
| 7 | Placeholder values | Legacy awards: 3% at £1 or less; UK4: 35 zero values of 1,304 | Treat 0 to 1,000 as unknown |
| 8 | Supplier identity is fragmented | 384 of 5,398 normalised names (7.1%) map to more than one id (`GB-COH`, `GB-PPON`, `GB-FTS`); 257 ids have more than one spelling | Resolve on Companies House number first, then PPON, then normalised name plus postcode |
| 9 | Malformed company numbers | 98 seven-digit numbers (leading zero dropped), a few free-text values | Left-pad to 8; validate against the pattern |
| 10 | Withheld suppliers | Names such as "Withheld Section94 Supplier" (15 entries) | Exclude from supplier matching |
| 11 | Personal data | Supplier `contactPoint.email` on 100% of Act notices, 4.4% free-mail; buyer contact names on 37% | Do not republish or use for outreach without a lawful basis; OGL excludes personal data [OGL] |
| 12 | Late and retrospective publication | Median 18 days after signature, p90 140; 8% of contracts already ended | Use `period.endDate`, not publication date, for expiry logic |
| 13 | Mixed date formats | `…Z` and `…+01:00` offsets, a few date-only strings | Parse as timestamptz; deadlines are local UK time |
| 14 | Region granularity varies | One third of delivery regions are just `UK`; 31% of UK7 have none | Match on prefix; fall back to buyer region |
| 15 | CPV is coarse and multiple | 22% of UK4 lead with a division-level code; 49% list two or more codes | Match on prefixes at several depths, plus keywords |
| 16 | Category and CPV can disagree | 39 UK4 tenders are `services` with a division 45 (construction) code | Use both |
| 17 | Award weights often not numeric | 35% of UK4 (60% below threshold) | Fall back to text extraction from descriptions |
| 18 | Legacy notices are thinner | No notice type, no buyer identifier scheme, no contract period, no gross value | Keep a `regime` column and separate parsing |
| 19 | Non-UK suppliers and currencies | 3.2% of supplier entries; 36 non-GBP values | Store currency; do not assume GBP |
| 20 | Short or empty text | 552 descriptions under 40 characters; 85 equal to the title | Use title plus CPV labels for matching |
| 21 | `buyer` missing on UK9/UK11/UK12 | 137 releases | Join through `ocid` |

## 7. CPV

Structure [CPV-REG]: the numerical code has 8 digits. The first two identify the **division** (`XX000000`), the first three the **group**, the first four the **class**, the first five the **category**; each of the last three digits adds precision; a ninth digit is a check digit. The feed carries the 8 digits without the check digit (22,703 codes, all 8 digits). [SAMPLE]

Depth actually used (14,951 distinct code-per-release pairs): division level 15%, group 14%, class 19%, category 23%, more specific 29%. [SAMPLE]

Most common divisions (a release counts once per division it mentions):

| Division | Title (as it appears in the feed) | All notices with a CPV (n=6950) | UK4 tender notices (n=1304) | UK7 contract details (n=2609) |
|---|---|---:|---:|---:|
| 45 | Construction work | 1152 | 341 | 452 |
| 85 | Health and social work services | 876 | 148 | 173 |
| 79 | Business services: law, marketing, consulting, recruitment, printing and security | 865 | 182 | 349 |
| 72 | IT services: consulting, software development, Internet and support | 708 | 96 | 231 |
| 71 | Architectural, construction, engineering and inspection services | 602 | 164 | 194 |
| 50 | Repair and maintenance services | 593 | 102 | 190 |
| 48 | Software package and information systems | 445 | 55 | 134 |
| 80 | Education and training services | 358 | 67 | 159 |
| 90 | Sewage, refuse, cleaning and environmental services | 337 | 102 | 106 |
| 60 | Transport services (excl. Waste transport) | 285 | 21 | 127 |
| 33 | Medical equipments, pharmaceuticals and personal care products | 256 | 39 | 69 |
| 73 | Research and development services and related consultancy services | 235 | 57 | 118 |
| 34 | Transport equipment and auxiliary products to transportation | 224 | 40 | 60 |
| 44 | Construction structures and materials; auxiliary products to construction (except electric apparatus) | 193 | 55 | 53 |
| 98 | Other community, social and personal services | 182 | 47 | 70 |
| 42 | Industrial machinery | 173 | 48 | 52 |
| 66 | Financial and insurance services | 136 | 27 | 36 |
| 38 | Laboratory, optical and precision equipments (excl. glasses) | 130 | 30 | 53 |
| 31 | Electrical machinery, apparatus, equipment and consumables; lighting | 127 | 19 | 50 |
| 09 | Petroleum products, fuel, electricity and other sources of energy | 118 | 34 | 38 |
| 39 | Furniture (incl. office furniture), furnishings, domestic appliances (excl. lighting) and cleaning products | 110 | 25 | 32 |
| 55 | Hotel, restaurant and retail trade services | 100 | 45 | 24 |
| 92 | Recreational, cultural and sporting services | 99 | 42 | 28 |
| 75 | Administration, defence and social security services | 99 | 30 | 29 |
| 77 | Agricultural, forestry, horticultural, aquacultural and apicultural services | 95 | 43 | 31 |

## 8. Recommended minimal relational schema (RECOMMENDATION)

Design rules that follow from the measurements: keep the raw release; key procurements by `ocid`; never key on `tender.id`; store net and gross; resolve organisations through an identifier table; keep CPV and region as child rows for prefix matching.

```sql
-- raw layer: one row per notice version
release(
  release_id text primary key,        -- "107788-2026"
  ocid text not null,
  published_at timestamptz not null,  -- release.date
  tags text[] not null,
  notice_type text,                   -- UK1..UK17, null for legacy
  regime text not null,               -- 'PA23' | 'PCR15' | 'UCR16' | 'CCR16' | 'DSPCR11'
  is_update boolean not null,
  raw jsonb not null
);

organisation(
  org_id bigserial primary key,
  name text not null, name_norm text not null,
  companies_house_no text, ppon text,
  scale text,                         -- 'sme' | 'large' | null
  vcse boolean,
  ca_type text,                       -- UK_CA_TYPE for buyers
  devolved_regs text,                 -- GB-WLS | GB-NIR | GB-SCT
  postcode text, region text, country text
);
org_identifier(scheme text, identifier text, org_id bigint references organisation,
               primary key (scheme, identifier));   -- GB-COH, GB-PPON, GB-FTS, GB-NHS, ...

-- compiled layer: one row per procurement
procurement(
  ocid text primary key,
  buyer_org_id bigint references organisation,
  title text, description text,
  main_category text,                 -- goods | services | works
  procedure text,                     -- procurementMethodDetails
  above_threshold boolean,
  special_regime text[],
  is_framework boolean, framework_type text,
  parent_framework_ocid text,         -- relatedProcesses[relationship=framework]
  status text,                        -- planned | active | complete | cancelled | withdrawn
  tender_deadline timestamptz, eoi_deadline timestamptz, enquiry_deadline timestamptz,
  submission_text text, submission_url text,
  est_value_net numeric, est_value_gross numeric, currency text,
  sme_suitable boolean, vcse_suitable boolean,
  reserved text, reserved_location text,
  next_tender_expected date,          -- recurrence.dates[].startDate
  regime text, first_published_at timestamptz, last_release_id text
);

lot(ocid text, lot_id text, title text, description text,
    value_net numeric, value_gross numeric,
    period_start date, period_end date, max_extent_date date,
    has_renewal boolean, renewal_text text,
    primary key (ocid, lot_id));

award_criterion(ocid text, lot_id text, seq int, type text, name text,
                weight_pct numeric, description text,
                primary key (ocid, lot_id, seq));

procurement_cpv(ocid text, cpv char(8), source text,  -- 'tender' | 'award'
                primary key (ocid, cpv, source));
procurement_region(ocid text, region text, source text,  -- 'delivery' | 'buyer'
                   primary key (ocid, region, source));

award(ocid text, award_id text, notice_type text,      -- UK5 | UK6 | legacy
      status text, decided_on date, standstill_end date,
      value_net numeric, value_gross numeric, above_threshold boolean,
      primary key (ocid, award_id));
award_supplier(ocid text, award_id text, org_id bigint references organisation,
               primary key (ocid, award_id, org_id));

contract(ocid text, contract_id text, award_id text,
         title text, status text,                      -- active | terminated | cancelled
         signed_on date, period_start date, period_end date, max_extent_date date,
         has_renewal boolean, renewal_text text,
         value_net numeric, value_gross numeric, currency text,
         above_threshold boolean, ended_on date, end_reason text,
         primary key (ocid, contract_id));

document(release_id text, doc_id text, doc_type text, notice_type text, url text,
         primary key (release_id, doc_id));
```

Example queries:

```sql
-- 1. Show a supplier its own awards (match on Companies House number or PPON)
select c.ocid, p.title, b.name as buyer, c.value_gross, c.period_start, c.period_end, c.max_extent_date
from org_identifier i
join award_supplier s on s.org_id = i.org_id
join contract c       on c.ocid = s.ocid and c.award_id = s.award_id
join procurement p    on p.ocid = c.ocid
join organisation b   on b.org_id = p.buyer_org_id
where (i.scheme, i.identifier) in (('GB-COH', '01234567'), ('GB-PPON', 'PABC-1234-DEFG'))
  and not p.is_framework
order by c.period_end desc;

-- 2. Match live tenders to a supplier profile
select p.ocid, p.title, p.tender_deadline, p.est_value_gross
from procurement p
where p.status = 'active'
  and coalesce(p.tender_deadline, p.eoi_deadline) > now()
  and exists (select 1 from procurement_cpv c join supplier_profile_cpv sp
              on c.cpv like sp.cpv_prefix || '%' where c.ocid = p.ocid and sp.supplier_id = :sid)
  and exists (select 1 from procurement_region r join supplier_profile_region sr
              on r.region like sr.region_prefix || '%' or r.region = 'UK' or sr.region_prefix like r.region || '%'
              where r.ocid = p.ocid and sr.supplier_id = :sid)
  and (p.est_value_gross is null or p.est_value_gross between :min_value and :max_value);

-- 3. Competitor contracts ending in the next N months in a trade and region
select c.ocid, p.title, b.name as buyer, o.name as incumbent, c.value_gross,
       c.period_end, c.max_extent_date
from contract c
join procurement p    on p.ocid = c.ocid
join organisation b   on b.org_id = p.buyer_org_id
join award_supplier s on s.ocid = c.ocid and s.award_id = c.award_id
join organisation o   on o.org_id = s.org_id
where c.status = 'active' and not p.is_framework
  and c.period_end between current_date and current_date + make_interval(months => :n)
  and exists (select 1 from procurement_cpv x where x.ocid = c.ocid and x.cpv like :cpv_prefix || '%')
  and exists (select 1 from procurement_region r where r.ocid = c.ocid and r.region like :region_prefix || '%')
  and s.org_id <> :own_org_id
order by c.period_end;
-- show max_extent_date beside period_end: 24% of UK7 notices state an extension

-- 4. Buyers that award below threshold or direct in a trade
select b.org_id, b.name, b.ca_type,
       count(*) as contracts, sum(c.value_gross) as total_gross,
       count(*) filter (where p.procedure like '%without competition%' or p.procedure = 'Direct award') as direct_awards
from contract c
join procurement p  on p.ocid = c.ocid
join organisation b on b.org_id = p.buyer_org_id
where (c.above_threshold = false or p.procedure = 'Direct award')
  and exists (select 1 from procurement_cpv x where x.ocid = c.ocid and x.cpv like :cpv_prefix || '%')
  and c.signed_on >= current_date - interval '24 months'
group by b.org_id, b.name, b.ca_type
order by contracts desc;
```

## 9. Deriving a supplier "trade profile" from its awards (RECOMMENDATION)

Inputs are the supplier's rows from query 1, plus tenderer-only appearances in UK6 where published.

| Dimension | How to derive | Why this way (measured) |
|---|---|---|
| CPV | Count awards per CPV prefix at 2, 3, 4 and 5 digits, weight recent awards higher, keep prefixes above a share threshold | 22% of tenders lead with a division-level code and 49% list several codes, so exact-code matching misses |
| Keywords | Distinctive terms from award titles and descriptions against the whole corpus (TF-IDF or embeddings) | Median description is 319 characters; 8% are under 40, so pair with CPV labels |
| Buyer types | Distribution of `UK_CA_TYPE`, devolved flag and repeat buyers | Present on 100% of Act buyers |
| Regions | Delivery region prefixes, falling back to buyer region; treat `UK` as national | Delivery region missing on 31% of UK7 |
| Value band | p25 to p75 of contract `value_gross`, annualised by contract length; exclude frameworks and placeholder values | Framework ceilings and repeated values distort sums |
| Procedure mix | Share won below threshold without competition, by quote, by open competition, by framework call-off | 80% of contract notices are below threshold |
| Contract length | Median months and typical extension | Median 12 months; extension median 24 months where stated |
| Size flags | `scale`, `vcse` | Present on over 99% of Act supplier entries |

Cold start (supplier with no awards in the feed): seed the same dimensions from the supplier's own description and from look-alike suppliers that share keywords; this is untested.

## Unknowns

- Published API quota: UNKNOWN (only the 429/`Retry-After` behaviour is documented and observed).
- Whether UK16 (dynamic market cessation) and UK17 (payments compliance) notices are delivered through `ocdsReleasePackages`: UNKNOWN. None appeared in five weeks, although a UK17 reporting deadline (30 days after 30 September) fell inside the window.
- Whether the quarterly contract payment data required since 1 April 2026 is exposed through the OCDS API: UNKNOWN. No `implementation.transactions` path exists in the sample.
- Edition of the `UK…` region codes: UNKNOWN.
- How far back Procurement Act data is complete, and how `ocid` links behave over a full contract lifecycle longer than three weeks: not measured.
- Legacy form type (F02, F03 and so on) is not exposed in the OCDS output; only `tag` and `procurementMethodDetails` are available.

## Sources

[FTS-NT]: https://www.find-tender.service.gov.uk/Home/NoticeTypes
[FTS-DEV]: https://www.find-tender.service.gov.uk/Developer/Documentation
[FTS-REL]: https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages
[FTS-REC]: https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsRecordPackages
[FTS-TC]: https://www.find-tender.service.gov.uk/Home/TermsAndConditions
[OGL]: https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/
[UKEXT]: https://github.com/cabinetoffice/ocds_uk_extension
[G-CDP]: https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/guidance-central-digital-platform-and-publication-of-information-html
[ACT-s123]: https://www.legislation.gov.uk/ukpga/2023/54/section/123
[CPV-REG]: https://www.legislation.gov.uk/eur/2008/213/annex/I/adopted
[SAMPLE]: #0-sample-and-method

| Key | URL |
|---|---|
| FTS-NT | https://www.find-tender.service.gov.uk/Home/NoticeTypes |
| FTS-DEV | https://www.find-tender.service.gov.uk/Developer/Documentation |
| FTS-REL | https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsReleasePackages |
| FTS-REC | https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsRecordPackages |
| FTS-TC | https://www.find-tender.service.gov.uk/Home/TermsAndConditions |
| OGL | https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ |
| UKEXT | https://github.com/cabinetoffice/ocds_uk_extension (schema and codelists read from `raw.githubusercontent.com/cabinetoffice/ocds_uk_extension/main/`) |
| G-CDP | https://www.gov.uk/government/publications/procurement-act-2023-guidance-documents-procure-phase/guidance-central-digital-platform-and-publication-of-information-html |
| ACT-s123 | https://www.legislation.gov.uk/ukpga/2023/54/section/123 |
| CPV-REG | https://www.legislation.gov.uk/eur/2008/213/annex/I/adopted |
| SAMPLE | Local harvest described in section 0 |
