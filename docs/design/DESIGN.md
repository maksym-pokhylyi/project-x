# Bidfolio — design system and UX direction

Audience: UK small-business owners, bid coordinators and freelance bid writers. Time-poor, practical, wary of hype.
They arrive from an email on a phone, and do the real work (reading a brief, drafting answers) at a desk.

## 1. Principles

1. **Evidence on the page.** Every claim the product makes is one click from its source: the notice, the quoted clause, the file and
   page. Citations are a first-class UI element, never a tooltip afterthought.
2. **Calm density.** Tender work is detail work. Show a lot, quietly: strong typographic hierarchy, hairline rules, generous line height,
   almost no decoration. No gradients-for-their-own-sake, no stock illustrations, no emoji.
3. **Deadlines lead.** Dates are the most important datum on almost every screen. They get a consistent treatment (urgency colour +
   relative time + absolute date) and the same position in every card and table row.
4. **Honest machine.** AI output is labelled, editable and checkable. Gaps are shown as gaps (`Evidence needed`), uncertainty as
   uncertainty (`Verify in documents`). The interface never implies a win is likely.
5. **Not the government.** Independent look: warm paper, ink and deep green — deliberately unlike GOV.UK black/blue/white — plus an
   explicit independence line wherever public data is shown.
6. **Works one-handed.** Public pages and the radar are mobile-first. The bid workspace is desktop-first but must remain readable and
   navigable at 360 px.

## 2. Brand

- Name: **Bidfolio**. Wordmark in the display serif, sentence case, with a small mark: a folio sheet with a folded corner whose fold
  line forms a tick. One colour; works at 16 px.
- Voice: plain British English, second person, short sentences, numbers before adjectives. "Closes in 9 days" not "Hurry!".
  Say "tender", "bid", "buyer", "contract", "award" — the buyer's words. Never "leads", "opportunit-ies you'll love", "guaranteed".
- Tagline: "The bid desk for small suppliers."

## 3. Tokens (CSS variables; light theme only in v1)

| Token | Value | Use |
|---|---|---|
| `--paper` | `#FAF8F3` | Page background (warm off-white) |
| `--surface` | `#FFFFFF` | Cards, panels, inputs |
| `--surface-sunken` | `#F3F0E8` | Table headers, code/citation blocks, wells |
| `--ink` | `#161A1D` | Primary text |
| `--ink-2` | `#434A50` | Secondary text |
| `--ink-3` | `#6B737A` | Tertiary text, placeholders (≥4.5:1 on paper) |
| `--line` | `#E3DED2` | Hairlines, borders |
| `--line-strong` | `#C9C2B2` | Input borders, dividers that must read |
| `--brand` | `#0F5A47` | Primary actions, links, active nav (deep green) |
| `--brand-hover` | `#0B4636` | Hover/pressed |
| `--brand-tint` | `#E4F0EA` | Selected rows, brand badges background |
| `--accent` | `#B4690E` | Deadline "soon", highlights (amber) |
| `--accent-tint` | `#FBF0DC` | Amber background |
| `--danger` | `#A3271C` | Errors, "closing/closed", pass/fail gaps |
| `--danger-tint` | `#FBE9E6` | |
| `--success` | `#1D6F43` | Met requirement, success states |
| `--success-tint` | `#E3F3E9` | |
| `--info` | `#1F4F8F` | Informational, planning-stage notices |
| `--info-tint` | `#E6EEF8` | |
| `--focus` | `#1F4F8F` | 2 px focus ring + 2 px offset, always visible on keyboard focus |

Radius: 4 px (inputs, chips), 8 px (cards), 12 px (modals). Borders do the work; shadows are rare: `0 1px 2px rgb(22 26 29 / 0.06)` on
raised cards, `0 12px 32px rgb(22 26 29 / 0.14)` on popovers/modals.
Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64, 96. Content max width 1120 px; reading column 68 ch.

## 4. Typography

- Display / headings: **Source Serif 4** (600 for h1–h2, 500 for h3). Gives an editorial, document-like authority.
- UI and body: **Inter** (400/500/600), with `font-feature-settings: "tnum" 1, "cv11" 1` for tabular figures in data.
- Mono (references, CPV codes, citations' page refs): **IBM Plex Mono** 400/500.
- Scale (px / line-height): 12/16, 13/18, 14/20 (dense UI), 16/24 (body), 18/28 (lead), 22/28 (h3), 28/34 (h2), 40/44 (h1 marketing),
  56/58 (hero, ≥1024 px only). Never below 12 px. Sentence case everywhere; no all-caps except 11–12 px eyebrow labels with 0.06em tracking.

## 5. Core components

- **DeadlineChip** — `Closes in 9 days · 22 Nov 2026, 12:00`. Colours: >14 days neutral (ink-2 on sunken), 4–14 days amber, ≤3 days
  danger, closed = struck neutral. Always includes the absolute date for screen readers and print.
- **Money** — `£102k`, `£1.2m`, exact figure on hover/focus; "value not published" instead of zero or £1 placeholders.
- **NoticeBadge** — notice type in the buyer's language: `Tender`, `Early notice`, `Award`, `Below-threshold`, `Framework`.
- **TenderCard / TenderRow** — title (2 lines max), buyer, value, region, DeadlineChip, match reason (one sentence, prefixed by a small
  "Why it matches" label), actions (Save, Dismiss, Start a bid). Entire card is not a link; the title is.
- **CitationMark + CitationPopover** — a small superscript reference `[Spec p.14]`; opens the verbatim quote on a sunken block with file
  name, page, and "Open source page". Unverified citations show a hollow marker and the label "Verify in documents".
- **RequirementRow** — category icon, requirement text, pass/fail tag, status pill (`Met` success / `Gap` danger / `Unknown` neutral /
  `Verify` amber), citation, note field.
- **QuestionCard** — ref, weighting bar (percentage), word limit, status stepper (Not started → Draft → Reviewed → Final).
- **AnswerEditor** — split view: left, the question, guidance and scoring descriptors; right, the draft with live word count against the
  limit (turns amber at 90%, danger over limit), evidence markers, `Evidence needed` highlights; below, the Evaluator panel with score
  band and a numbered list of improvements, each with "Apply".
- **StatBlock** — big tabular number + label + small context line, used on supplier pages ("14 contracts · £3.2m · 6 buyers").
- **EmptyState** — one sentence of what belongs here, one action, optional example. No illustrations.
- **ProcessingState** — step list with real stages (Reading files → Finding requirements → Listing questions → Checking against your
  company) and elapsed time; survives refresh; shows partial results as they land.
- **UpgradeNotice** — inline, never a modal trap: what is locked, what the plan includes, price, one button.
- **DataAttribution** — footer line on any page with public data: OGL attribution + independence statement + correction link.
- Tables: sticky header, zebra off, row hover `--brand-tint`, numeric columns right-aligned with tabular figures.
- Forms: labels above fields, helper text below, errors in `--danger` with an icon and text (never colour alone), inline validation on blur.

## 6. Key screens and their states

| Screen | Must show | States to design |
|---|---|---|
| Supplier page (public) | Company name, StatBlocks, "Open tenders like the ones you've won", "Contracts ending soon", "Buyers awarding in your trade", awards table, Claim CTA, free-brief CTA, attribution | Unclaimed (3 items per block, blurred count of the rest); claimed by viewer; no matches right now (explain + offer alert); company with one award; very long names; mobile |
| Find your company | Search box (name or company number), results with award counts | Empty, typing, no result ("We only list suppliers with published awards — set up a radar manually"), many results |
| Landing | Hero with a real supplier page preview, how it works (3 steps), brief/citation demo, pricing teaser, FAQ, independence note | Desktop, mobile; logged-in visitor sees "Open your radar" |
| Radar | Tabs, filters, TenderCards, saved list, upcoming deadlines strip | First run (just claimed), no company linked (onboarding choices), filtered-to-empty, free-plan cap (item 11+ locked), loading skeleton, error with retry |
| New bid | Drop zone, file list with per-file status, optional link to a notice | Empty, uploading, unsupported file, too large, quota reached (UpgradeNotice), free brief available |
| Bid workspace → Brief | Verdict banner, key dates, requirements grouped by category, evaluation model, red flags | Processing (ProcessingState), partial, ready, failed (what failed, retry, contact), no questions found, scanned/low-quality files warning |
| Bid workspace → Questions | QuestionCards with status and progress summary | None found (add manually), locked on Free, long lists (20+) |
| Answer editor | AnswerEditor | No library yet (prompt to add facts/documents first), drafting, over word limit, evaluator running, evaluator unavailable, read-only for members without permission |
| Library | Company facts form with expiry dates, documents table | Empty, auto-filled awaiting confirmation, expired accreditation warning, upload errors |
| Billing | Current plan, usage vs limits, plans, invoices link | Free, trialing, active, past due (grace countdown), cancelled (access until date), billing not configured (dev) |
| Auth | Sign up / in, verify, reset | Errors per field, rate-limited, already claimed company |

## 7. Accessibility and quality bar

WCAG 2.2 AA: contrast ≥4.5:1 for text and ≥3:1 for UI boundaries; visible focus on every interactive element; full keyboard paths for
the core scenario; semantic headings and landmarks; `aria-live="polite"` for processing updates; no information by colour alone;
respects `prefers-reduced-motion`; hit targets ≥40 px on touch. Motion: 120–180 ms ease-out for state changes only.
Every screen is checked in a real browser at 360, 768 and 1280 px before it is called done.
