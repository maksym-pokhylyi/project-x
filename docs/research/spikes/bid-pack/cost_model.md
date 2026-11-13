### Measured per-call usage by step (mean over the calls actually made)

| Step | Model | calls | mean input tokens | mean output tokens (incl. reasoning) | mean $ / call | mean latency s |
|---|---|---|---|---|---|---|
| Draft one answer (450-1,350 word limit) | openai/gpt-5-nano | 6 | 8,010 | 2,359 | $0.0012 | 12 |
| Draft one answer (450-1,350 word limit) | google/gemini-2.5-flash-lite | 6 | 8,527 | 1,194 | $0.0013 | 5 |
| Draft one answer (450-1,350 word limit) | openai/gpt-5-mini | 6 | 8,010 | 1,816 | $0.0048 | 21 |
| Claim check one answer | openai/gpt-5-mini | 12 | 2,711 | 2,828 | $0.0063 | 32 |
| Evaluator pass on one answer | google/gemini-2.5-flash-lite | 8 | 9,469 | 1,783 | $0.0017 | 6 |
| Evaluator pass on one answer | openai/gpt-5-mini | 8 | 8,777 | 2,130 | $0.0056 | 20 |
| Bid/no-bid verdict | google/gemini-2.5-flash-lite | 2 | 11,828 | 5,702 | $0.0035 | 18 |
| Bid/no-bid verdict | openai/gpt-5-mini | 2 | 10,168 | 4,474 | $0.0115 | 40 |
| Brief verify pass (per pack) | openai/gpt-5-mini | 8 | 35,070 | 2,095 | $0.0129 | 25 |
| Follow-up Q&A over a cached 77k-token pack | openai/gpt-5-nano | 3 | 76,856 | 313 | $0.0017 | 5 |

Pack size basis: 598 tokens per page measured on the two 100+ page packs -> a 150-page pack = 89,716 tokens of text; +5,840 tokens of system prompt, task and JSON schema per extraction call.

### Projected cost per bid (150-page pack, 15 questions, draft + 2 revision rounds)

| Model | basis | Brief single pass | + verify pass | Draft+claim-check+evaluate, 15 questions x 3 rounds | Bid/no-bid | TOTAL per bid | same with 90% cached-input discount on repeated prefixes |
|---|---|---|---|---|---|---|---|
| openai/gpt-5-nano | brief + drafts measured; claim-check/evaluator token counts taken from gpt-5-mini runs | $0.006 | $0.006 | $0.17 | $0.002 | **$0.18** | $0.15 |
| google/gemini-2.5-flash-lite | brief + drafts measured; claim-check/evaluator token counts taken from gpt-5-mini runs | $0.014 | $0.011 | $0.21 | $0.003 | **$0.24** | $0.17 |
| anthropic/claude-haiku-5.5 | PROJECTED from gpt-5-mini token counts x list price (model not run) | $0.014 | $0.011 | $0.24 | $0.003 | **$0.27** | $0.20 |
| openai/gpt-5-mini | measured tokens (all steps) | $0.041 | $0.029 | $0.83 | $0.011 | **$0.91** | $0.74 |
| google/gemini-2.5-flash | brief measured; drafting steps projected from gpt-5-mini token counts | $0.064 | $0.035 | $1.03 | $0.014 | **$1.14** | $0.93 |
| google/gemini-3.6-flash | PROJECTED from gpt-5-mini token counts x list price (model not run) | $0.104 | $0.082 | $1.80 | $0.024 | **$2.01** | $1.49 |
| openai/gpt-5 | brief measured; drafting steps projected from gpt-5-mini token counts | $0.216 | $0.145 | $4.15 | $0.057 | **$4.56** | $3.70 |
| anthropic/claude-sonnet-5.5 | PROJECTED from gpt-5-mini token counts x list price (model not run) | $0.278 | $0.220 | $4.80 | $0.065 | **$5.37** | $3.91 |
