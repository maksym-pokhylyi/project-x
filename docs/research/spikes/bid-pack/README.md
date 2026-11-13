# bid-pack spike — tender pack → bid brief, compliance matrix, drafts, evaluator, bid/no-bid

Feasibility spike run on 2026-11-13. Read `REPORT.md` first. Everything here is prototype code.

## Layout

```
REPORT.md                 findings (verdict first)
packs/sources.json        where each tender pack came from (URLs)
packs/MANIFEST.md|.json   buyer, title, notice URL, files, page counts, tokens
packs/<slug>/files/       the downloaded tender documents (untouched)
packs/<slug>/pack.json    ingested text, one unit per page / sheet
packs/<slug>/pack.txt     text sent to models, with <<<FILE: .. | LOC: ..>>> markers
groundtruth/build_gt.py   hand-written ground truth (329 facts, 8 packs) -> groundtruth/<slug>.json
schemas/brief.schema.json strict JSON Schema for the brief + compliance matrix (built by scripts/schema_brief.py)
prompts/                  system / task prompts (extraction, verify pass, merge, drafting)
evidence/<bidder>/        two FICTIONAL bidders: evidence library + the 3 questions drafted for each
scripts/                  see below
out/extract/<slug>/<config>.json   every model output (brief JSON + per-call usage)
out/scores/               per-output scoring; all.json feeds the tables
out/tables.md, union_table.md, cost_model.md   the measured tables used in the report
out/draft/<bidder>/       drafts, claim checks, evaluator outputs, bid/no-bid verdicts
out/ledger.jsonl          every LLM call: tokens, latency, cost reported by the gateway
out/cache_test.json, out/pdf_native_test.json   prompt-caching and native-PDF tests
node-ingest/              pure-JS ingestion check (unpdf + mammoth + SheetJS) for the Vercel path
data/raw/                 cached Contracts Finder / Find a Tender API responses used to find packs
```

## Scripts

| Script | What it does |
|---|---|
| `scripts/fetch_packs.py` | downloads the documents in `packs/sources.json` (plain HTTPS, honest UA; does not work around 403s) |
| `scripts/links.py`, `scripts/cf_keyword_search.py`, `scripts/fts_scan.py` | helpers used to find buyer-hosted packs |
| `scripts/ingest.py <slug>\|all` | PDF/DOCX/DOC/ODT/XLSX/XLS/ODS/ZIP/image → page/sheet-marked text (pdftotext, LibreOffice, openpyxl, tesseract fallback) |
| `scripts/llm.py` | gateway client: structured output, Gemini schema-in-prompt fallback, rate limiting, **spend ledger with hard cap** |
| `scripts/schema_brief.py` | builds the strict JSON Schema |
| `scripts/extract.py single\|verify\|twopass …` | brief + compliance matrix: whole pack in context, optional verify pass, or per-document + merge |
| `scripts/union_merge.py` | deterministic (no-LLM) union of per-document extractions |
| `scripts/score.py` | scores outputs against ground truth; verifies every citation by string matching; number grounding |
| `scripts/report_tables.py`, `scripts/cost_model.py` | regenerate `out/tables.md` and `out/cost_model.md` |
| `scripts/draft.py draft\|claims\|evaluate\|bidnobid …` | grounded drafting, claim check, evaluator pass, bid/no-bid |
| `scripts/show.py` | compact page viewer used while writing ground truth |

## Re-running (e.g. with the three models that were blocked on the day)

```bash
cd /home/user/spikes/bid-pack
# token is read from /home/user/vtest/.env.local by scripts/llm.py; raise or lower the cap with SPIKE_BUDGET_CAP
python3 -I scripts/ingest.py all
python3 groundtruth/build_gt.py
ALL8="blyth-bus-shelters ryde-conference-system ryde-data-audit tullie-digital-installation ecw-water-plan tfc-tree-equity lpc-research fcdo-english-training"
python3 scripts/extract.py single anthropic/claude-haiku-5.5  haiku.single  $ALL8 --effort low
python3 scripts/extract.py verify anthropic/claude-haiku-5.5  haiku.single+verify haiku.single $ALL8
python3 scripts/extract.py single anthropic/claude-sonnet-5.5 sonnet.single ryde-conference-system tfc-tree-equity blyth-bus-shelters --effort low
python3 scripts/extract.py single google/gemini-3.6-flash     g36.single    ryde-conference-system tfc-tree-equity blyth-bus-shelters
python3 scripts/score.py            # prints the summary table, writes out/scores/
python3 scripts/score.py haiku.single   # per-fact misses, bad citations
python3 scripts/draft.py draft canopy-kerb anthropic/claude-haiku-5.5 haiku
python3 scripts/draft.py claims canopy-kerb anthropic/claude-sonnet-5.5 haiku
python3 scripts/draft.py evaluate canopy-kerb anthropic/claude-sonnet-5.5 sonnet haiku
python3 scripts/draft.py bidnobid canopy-kerb anthropic/claude-haiku-5.5 haiku haiku.single+verify
```
Add new labels to `NAMES` in `scripts/report_tables.py` to include them in the tables.

Notes
- `scripts/llm.py` sends the schema as a strict `response_format` for every model except `google/*`, where the brief schema is rejected by the provider ("too many states") and is put in the prompt instead (JSON mode + local validation).
- Google models on this gateway team are limited to 5 requests/minute; the client spaces calls 13 s apart.
- The tender documents are untrusted input: run ingestion with `python3 -I` and keep scripts outside `packs/`.
- `node-ingest/`: `pnpm install && node ingest_test.mjs ../packs/<slug>/pack.json`.
