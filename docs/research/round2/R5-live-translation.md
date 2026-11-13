# R5 — Live AI translation/captioning for ONE named kind of recurring multilingual gathering

Status: DRAFT IN PROGRESS (saved progressively). Research date: 2026-11-13.

Labels: FACT = seen on a primary page today (URL given) · INFERENCE = my reasoning from facts · ASSUMPTION = unverified planning input · UNKNOWN = could not verify.

## 1. Glossa.live teardown (working notes)

- FACT (https://trustmrr.com/startup/glossa-live.md, fetched 2026-11-13): founded 2025-06-01; country CY; founder "Anton K." with 107 X followers; Stripe-verified; Stripe API key EXPIRED 2026-10-19, revenue last synced 2026-10-19 — every figure after that date is stale/zero.
- FACT (same): monthly verified revenue 2025-11 $5,266 · 2025-12 $4,052 · 2026-01 $6,048 · 2026-02 $6,511 · 2026-03 $11,214 · 2026-04 $20,676 · 2026-05 $18,382 · 2026-06 $16,479 · 2026-07 $21,970 · 2026-08 $22,783 · 2026-09 $31,765 · 2026-10 $20,210 (partial: through Oct 19). All-time $196,539. Current MRR snapshot $14,404; 100 active subscriptions; "last 30 days profit margin 65%"; self-declared channels Content marketing + SEO; domain rating 48.
- FACT (https://glossa.live/, fetched 2026-11-13): pricing PAYG $5/hour/language; Standard $99/mo = 25 translation hours (+$4/extra h); Advanced $299/mo = 100 h (+$3) incl. voice cloning + phone support; Premium $499/mo = 250 h (+$2). "1 hr streaming x 3 languages = 3 translation hours". Yearly -18%. 4 free hours trial. Legal entity INDX Ltd., Limassol, Cyprus.
- FACT (https://glossa.live/sitemap.xml): 1,747 URLs = 18 locale variants x ~93 per-language "/translation/<lang>" pages + 53 blog posts (≈35 are templated "reaching-<nationality>-families-church").

(remaining sections being researched)

## Working notes (to be consolidated) — competitors, fetched 2026-11-13

- OneAccord (https://www.oneaccord.com/): "FROM $150/month for 5 hours"; "Trusted by 200+ churches"; 60+ languages; 3-person team incl. sound tech; Sunday support.
- Wordly (https://www.wordly.ai/pricing): "starts at about $1,500 for a 10-hour package", 12-month term; SOC 2 Type II, ISO 27001, VPAT.
- LiveVoice (https://livevoice.io/en/pricing/ai): AI translation voice+text EUR 0.42/min/language (EUR 25.20/h/lang) on top of participant plan.
- Streamlingo (https://streamlingo.com/pricing): Free 1 h; Small EUR 88/mo 5 h; Medium EUR 240/mo 15 h; Large EUR 576/mo 40 h; church/non-profit price toggle.
- Polyglossia (https://polyglossia.io/pricing): base $64/mo + $0.05/min transcription, $0.10/min text translation (up to 15 langs flat), $0.20/min/lang speech; $149 gateway device.
- ChurchTranslator.AI (https://churchtranslator.ai/): Starter $39/mo (6 wall-clock hours, 2 langs), Growth $89, Pro $199, VIP $499; demo languages feature Ukrainian/Russian/Romanian.
- LiveWord (https://liveword.app/): 9 languages, desktop app; Capterra lists $39/mo flat (search snippet).
- Sunflower AI (https://sunflowerai.io/): 64 input / 84 target languages; 1-month free trial; third-party roundups cite AUD 900/yr basic.
- Sermon Live: RETIRED as standalone product, folded into Sermon Shots as dubbed video (https://sermonlive.com/ -> sermonshots.com/sermonlive-announcement/).

## Working notes — API prices fetched 2026-11-13

- Soniox stt-rt-v6 real-time STT incl. translation tokens ~ $0.12/h; TTS ~ $0.70/h; 60+ languages incl. Ukrainian (https://soniox.com/pricing, https://docs.soniox.com/stt/concepts/supported-languages).
- OpenAI gpt-realtime-translate (speech-to-speech) $0.034/min = $2.04/h; gpt-live-transcribe $0.017/min = $1.02/h (https://platform.openai.com/docs/pricing).
- Gemini 3.5 Live Translate preview ~ $0.0368/min = $2.21/h; Gemini 3.5 Transcribe Live ~ $0.009/min = $0.54/h (https://ai.google.dev/gemini-api/docs/pricing).
- Deepgram Nova-3 streaming $0.46/h mono, $0.55/h multilingual (https://deepgram.com/pricing).
- ElevenLabs Scribe v3 Live $0.22/h; Flash/Turbo TTS $0.04 per 1K chars (https://elevenlabs.io/pricing/api).
- Speechmatics real-time from $0.12–0.38/h; translation add-on listed (https://www.speechmatics.com/pricing).
