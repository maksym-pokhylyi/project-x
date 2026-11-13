# Bidfolio — design system and UX direction

Audience: UK small-business owners, bid coordinators and freelance bid writers. Time-poor, practical, wary of hype.
They arrive from an email on a phone, and do the real work (reading a brief, drafting answers) at a desk.

**Visual source of truth:** the designer's artboards in `docs/design/handoff/` (received 2026-11-13). Where this document and an
artboard disagree on how something looks, the artboard wins, subject to the corrections listed in `handoff/README.md`.
The living reference built from both is the page `/styleguide`.

## 1. Principles

1. **Evidence on the page.** Every claim the product makes is one click from its source: the notice, the quoted clause, the file and
   page. Citations are a first-class UI element, never a tooltip afterthought.
2. **Calm density.** Tender work is detail work. Show a lot, quietly: strong typographic hierarchy, hairline rules, generous line height,
   almost no decoration. No gradients-for-their-own-sake, no stock illustrations, no emoji.
3. **Deadlines lead.** Dates are the most important datum on almost every screen. They get a consistent treatment (an amber dot,
   the absolute date in amber ink, the time left in a small amber-tint chip) and the same position in every card and table row.
4. **Honest machine.** AI output is labelled, editable and checkable. Gaps are shown as gaps, uncertainty as "For you to confirm".
   A mark is a reading of the buyer's scoring scheme, never a forecast. The interface never implies a win is likely.
5. **Not the government.** Independent look: warm paper, ink and deep green — deliberately unlike GOV.UK black/blue/white (links are
   ink with a green underline, never blue) — plus an explicit independence line wherever public data is shown.
6. **Works one-handed.** Public pages and the radar are mobile-first. The bid workspace is desktop-first but must remain readable and
   navigable at 360 px.

## 2. Brand

- Name: **Bidfolio**. The mark is the designer's, used exactly as delivered (`src/components/logo-paths.ts`): the top-left corner of
  a 3 : 4 sheet folded down along a line 22.5° off the top edge, its two edges landing at 45° and leaving a tick. Nothing is drawn on;
  the tick is the gap the fold leaves. One colour always: green or ink on light, white or paper on dark. No outlines, tilts, shadows
  or second colour for the tick. Smallest mark 16 px high; the favicon is a separate cut with a heavier tick, pale green `#BFE0D3` in
  dark browser themes.
- Lockup: mark + "Bidfolio" in Source Serif 4 Semibold, letter-spacing −0.015em, optical size 32, aligned on the baseline; the mark is
  0.91 of the type size and the gap about 0.31 of it. Smallest lockup 20 px high. Keep one mark-width clear on every side.
- Voice: plain British English, second person, short sentences, numbers before adjectives. "Closes 27 Nov 2026 · 14 days left", not
  "Hurry!". Say "tender", "bid", "buyer", "contract", "award" — the buyer's words. Never "leads", "opportunit-ies you'll love",
  "guaranteed", a win rate, "100% compliant" or a predicted score.
- Tagline: "The bid desk for small suppliers."
- The first deliverable is called a **cited bid check** in marketing copy (the in-app tab may stay "Brief").

## 3. Tokens (CSS variables; light theme only in v1)

The designer's nine colours, kept as given, with the shades derived from them (tints and greys of the same hues, no new ones).

| Token | Value | Use |
|---|---|---|
| `--paper` | `#FAF8F3` | Page background (warm off-white) |
| `--paper-deep` | `#F2EEE4` | Bands, wells, quiet chips, the footer |
| `--surface` | `#FFFFFF` | Cards, panels, inputs, the app bar |
| `--ink` | `#161A1D` | Text. Body copy is ink, not grey |
| `--ink-2` | `#5A6165` | Muted text: captions, meta lines, descriptions under a heading (5.9:1 on paper) |
| `--line` | `#E3DED2` | Dividers and card edges only (1.3:1) |
| `--line-strong` | `#857F70` | The edge of a control: inputs, tick boxes, outline buttons (4.0:1 on white) |
| `--brand` | `#0F5A47` | Primary actions, the underline of links, "met" with a tick, the focus ring |
| `--brand-hover` | `#0B4636` | Hover and pressed |
| `--brand-tint` | `#E6EFEB` | Selected rows, the verdict panel, source markers |
| `--brand-mark` | `#D5E6DE` | Highlighter on a quoted sentence in a source document |
| `--brand-on-dark` | `#BFE0D3` | Secondary text on brand green; the favicon in dark themes |
| `--accent` | `#B4690E` | Amber: **markers, rules and large numerals only** — never small text, never a filled badge |
| `--accent-ink` | `#925207` | Amber for small text (5.8:1 on paper) |
| `--accent-tint` | `#F7EBD7` | The "14 days left" pill, warning panels |
| `--danger` | `#A3271C` | Errors, gaps |
| `--danger-tint` | `#F6E3E0` | Gap and error panels |
| `--success-tint` | `#E4EFE7` | Background of a "Met" pill. **There is no success colour**: the text and tick are brand green |
| `--info` | `#1F4F8F` | Neutral labels only: notice types, "For you to confirm". **Never links** |
| `--info-tint` | `#E3EAF4` | Info background |
| `--focus` | `#0F5A47` | 2 px focus ring + 2 px offset, always visible on keyboard focus; white on brand green or ink |

Radius: 4 px (chips, pills, tick boxes), 6 px (buttons, inputs, tinted panels), 10 px (cards, tables), 12 px (dialogs, the verdict
panel); 8 px (`rounded-inset`) for a panel inside a card. Borders do the work; shadows are rare: `0 1px 2px rgb(22 26 29 / 0.06)` raised,
`0 12px 32px rgb(22 26 29 / 0.14)` on popovers/modals, and a long soft shadow under a product figure on a public page.
Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64, 96. Public pages: 1200 px column (20 px gutters on phones, 24 px from 640 px).
App: 1280 px column (20 px, 32 px from 768 px). Reading column about 68 characters.

### 3.1 The designer's five changes (all accepted, 2026-11-13)

Ratios are computed by `scripts/design/contrast.mjs` and listed in `docs/design/CONTRAST.md`.

1. **Amber has a darker partner for small text.** `--accent` is 3.98:1 on paper: it fails as small text and cannot be a filled badge
   (white on it is 4.2:1). Keep it for markers, rules and large numerals; small amber text is `--accent-ink`. In practice small
   deadlines are written in amber ink beside an amber dot ("amber marks, amber ink writes").
2. **Success is folded into brand green.** The old success green sat 1.3:1 from brand green: one green printed twice. "Met" and
   "passed" are brand green with a tick; actions and statuses are told apart by form (a filled button against a ticked label).
3. **A stronger line for form controls.** `--line` is right for dividers and card edges and too faint for the edge of an input or a
   tick box. Controls use `--line-strong` (≥3:1). shadcn's `--input` maps to it.
4. **Info blue stays out of links.** Blue links on white are the quickest way to look like a government service. Links are ink with
   a green underline. Info blue is exactly as dark as brand green (1.00:1 between them): never ask the two to be told apart by colour
   alone.
5. **Fonts are self-hosted and figures pinned.** `next/font` serves all three families from our own domain. Tables and `<time>` use
   Inter's tabular figures so pounds and dates line up down a column.

Rules that follow from the numbers:

- `--ink-2` passes on paper, paper-deep, surface and brand-tint. There is no third, lighter text colour.
- Never set text on solid amber. Amber appears as a dot, a rule or a tint.
- A hairline (`--line`) is decoration: never the only cue that something is a control or a state.

## 4. Typography

- Display / headings and the buyer's quoted words: **Source Serif 4** (600 for headings, 400 for quotes).
- UI and body: **Inter** (400/500/600); tabular figures in tables and `<time>`.
- Mono — references only (file names, pages, clauses, notice numbers, CPV codes, the meta line above a title): **IBM Plex Mono** 400/500.
- Scale (px / line-height), read from the artboards: 12/16, 13/20, 14/20, 15/22 (app body, buttons, tabs), 16/24 (16/26 for running
  text), 17/24 (row titles, quotes), 18/28 (lead), 20/26 (card heading), 24/30 (h3), 28/34 (section in a page), 36/42 (app page
  title), 40/45 (section on a public page), 50/54 (hero, ≥1024 px only). Never below 12 px.
- Display steps between them, for serif titles, prices and the wordmark, always with their own line-height: 22 (card titles, the
  wordmark), 26, 30 (phone prices and page titles), 32, 34 (stat numerals), 44 (prices on a desk).
- Sentence case everywhere, including eyebrows (14 px, 600, brand green). No capitals for emphasis.

### 4.1 How the scale is implemented

The Tailwind size names are remapped onto the scale, so any `text-*` class lands on it:

| Class | px / line-height | Role class | Used for |
|---|---|---|---|
| `text-xs` | 12/16 | `type-ref` (mono 12/18) | Chips, column heads, mono references |
| `text-13` | 13/20 | | Status pills, notes, helper and error text |
| `text-sm` | 14/20 | `type-eyebrow` (14/21, 600, brand) | Tables, descriptions, labels |
| `text-15` | 15/22 | | Body in the app, buttons, tabs |
| `text-base` | 16/24 | `type-reading` (16 × 1.6) | Body on public pages; inputs |
| `text-17` | 17/24 | `type-quote` (serif 17/25) | Row titles, points; a quoted requirement |
| `text-lg` | 18/28 | `type-lead` (16 × 1.55, 18 from 640 px) | Lead paragraph under a heading — ink, not grey |
| `text-xl` | 20/26 | | Card heading (`CardTitle`) |
| `text-2xl` | 24/30 | `type-h3` (22 × 1.2, 24 from 640 px) | Step and plan names, sub-sections |
| `text-3xl` | 28/34 | `type-section` (24 × 1.15, 28 × 1.2 from 768 px) | Section heading inside a page or the app |
| `text-4xl` | 36/42 | `type-title` (26/30 on phones) | Page title in the app |
| `text-5xl` | 40/45 | `type-h2` (28/32, 36/41 from 768 px) | Section heading on a public page |
| `text-6xl` | 50/54 | `type-hero` (34 × 1.1, 44 × 1.09 from 640 px, 50 × 1.07 from 1024 px) | Hero headline |

- `type-h1` (30/33, 40/44, 44/48) is the title of a public page; `type-page` (30 × 1.12, 40 × 1.15 from 768 px) the title of a
  section page of the app (Radar, Bids, Documents, Billing, Settings). `type-question` (serif 19 × 1.3, 21 from 640 px) is a
  question in a list of questions. `type-quote-lg` (21 × 1.36, 25 from 640 px) is the quote that leads a card. `type-figure` sets
  a numeral in the serif (stat rows 24–34 px, prices 30–44 px).
- The display steps are sizes named like `text-13`: `text-22`, `text-26`, `text-30`, `text-32`, `text-34`, `text-44`. There is no
  arbitrary font size (`text-[…]`) in feature code: `pnpm ui:audit` counts them.
- `h1`–`h3` are set in the display serif, 600, by default. A heading that is a UI label — a row title, a point, a utility card —
  sets `font-sans`.
- Headings use `text-wrap: balance`. Running text wraps as the browser does (the artboards' line breaks are kept); the type roles
  that are read as prose (`type-lead`, `type-reading`, quotes) ask for `text-wrap: pretty`.
- Fonts are self-hosted by `next/font` (no request to Google at run time). The Open Graph image uses static TTF copies in
  `src/assets/og-fonts` (SIL Open Font Licence).

## 5. Core components

**Owner's rule: UI goes through the design system.** Every reusable pattern is a component in `src/components/ui/` (shown on
`/styleguide`, described here), and feature code composes those components. A fix is then made once, not in fifty places.
`pnpm ui:audit` and the tests behind it (`tests/ui-guard.test.ts`, `tests/ui-smells.test.ts`) count the bypasses: raw form
controls, a link dressed as a button by hand, heights set at the call site, alignment by a magic offset, a hex colour, a font
size off the scale, an inline style, a pre-system token. The counts may only go down.

### 5.1 Control sizes

Inputs and buttons share one scale of three heights: **44 px** in app toolbars, tables and filters, **48 px** in forms, **52 px**
for search rows and forms on a phone. Never mix two heights in one row. A button beside an input takes the input's height, and a
form's submit button takes the height of its fields. Text inside is 15 px at 44 and 16 px at 48 and 52.

- The scale is three tokens (`--control-sm` 2.75rem, `--control-md` 3rem, `--control-lg` 3.25rem) and one variable, `--control-h`,
  that every field and button is as tall as. A **group** sets it once for everything inside: `<ControlGroup size="sm|md|lg|form">`,
  the utilities `controls-sm|md|lg|form`, or `<Form>` (48 px, 52 px on phones). You do not size the field and the button.
- The same size words on `Button`, `ButtonLink`, `IconButton`, `Input`, `NativeSelect`, the `Select` trigger, `FilterChip` and
  `SegmentedToggle`. A control with no size takes its group's; outside any group it is 44 px.
- `sm` keeps the compact 14 px label for row and toolbar actions and is 44 px tall (it used to be 36 px); `xs` remains as an alias.
  Nothing in the product is shorter than 44 px, except controls set inside a line of text (`SourceMark`, a linked `ReferenceChip`,
  `TooltipText`), tick boxes, radios and switches (20–24 px marks with a 40 px hit area), and a button whose label wraps on a phone.
- A row of labelled fields with its button is `<FormRow>` with the button in `<FormRowAction>`: the action mirrors a field (label
  line, 6 px, control), so it lines up by construction, also when a field shows an error. Never a margin offset or `items-end`.
  `Field` labels any control that is not an `Input`; `FieldGroup` labels something that is not one field.
- `node scripts/design/controls.mjs` checks all of it in a browser at 390 and 1280 px (see `VERIFICATION.md`).

### 5.2 Buttons, links and menus

- **A control that navigates is a `ButtonLink`; a control that does something on the page is a `Button`.** Never button classes on
  an `<a>` by hand, never `<Button asChild>` around a link (ESLint warns). `ButtonLink` takes the Button's variants and sizes,
  `newTab`, `download` (a plain anchor, nothing prefetched) and `disabled`.
- One green button per view (`default`); every secondary action is `outline`. `inverse` / `inverse-outline` on green panels.
  The way into a step that cannot be undone is `destructive-outline` (white, red label); the filled `destructive` button appears
  once, in the dialog that says what is lost. `ghost` is for icon buttons and quiet row actions, `menu` for the trigger of a
  menu in a bar, `link` for a text link that has to be a button.
- An icon alone is an `IconButton` (a required `label`, 44 px square, `shape="round"` for the avatar). The quiet trigger of a
  menu in a bar is a `MenuButton` (muted 14 px text and a chevron). A button that opens the file picker is a `FileButton`.
- The one call to action inside a menu is `<DropdownMenuItem variant="cta">` ("Upgrade"), never a Button dropped into the list.
- **Pointer rule:** every clickable element shows the pointer cursor — links, buttons, options, menu items, tabs, tick boxes,
  summaries, labels of controls — and what is disabled does not; text fields keep the text cursor. It is one base rule in
  `globals.css`, so components do not have to remember it; a clickable element with none of those roles (a table row that opens
  its record) adds `cursor-pointer`.

### 5.3 Where you are

In every navigation — top bars, link tabs, the public header, phone menus — the current item is obvious at a glance: it differs
from its siblings **in colour and in weight** and carries a rule or a dot. Never a line alone. **`NavLink` is the only thing
that marks "where you are"**: it works it out from the address, sets `aria-current="page"` and applies the shared look.

| Variant | Where | Current item |
|---|---|---|
| `bar` | app and admin top bars | ink, semibold, 2 px ink rule on the bar's edge; the others muted |
| `tab` | sections that are separate pages, under a title | the look of the `Tabs` primitive: ink, semibold, 2 px ink rule; counts in mono |
| `header` | the public site header | semibold with a 2 px ink underline; every link stays ink |
| `menu` | stacked lists, the phone menu | semibold with an ink dot at the end of the 52 px row |
| `plain` | rows with their own layout | `aria-current` only; the caller styles `aria-[current=page]:…` |

Pass `match` when a section spans several paths and `current` when "current" lives outside the path (a `?tab=` parameter).
`tests/nav-guard.test.ts` forbids `aria-current` anywhere else; `scripts/design/controls.mjs` checks in a browser that each
navigation has exactly one current item and that it differs from the others. The phone menu of the site and of the app is one
component, `MenuSheet`.

### 5.4 Components

Shared bid and data components (`/styleguide#bid`, `#sources`, `#figures`, `#plans`, `#jobs`):

- **DeadlineMarker** (`ui/deadline-marker.tsx`) — an amber dot, the date in amber ink semibold, a small amber-tint chip with the
  time left: `● Closes 27 Nov 2026  [14 days left]`. Closed: grey dot, muted words, no chip. Always the absolute date. **Dot**
  (`ui/dot.tsx`) is the dot on its own, before a few words that carry a date (the trial strip, bids to use by a date).
- **StatusPill** (`ui/status-pill.tsx`) — the state of a requirement, always a sign and a word: `Gap` (danger), `For you to confirm`
  (info), `Met` (brand green with a tick), `Not checked` (muted).
- **ReferenceChip** (`ui/reference-chip.tsx`) — where a quote comes from, in mono with a hairline edge:
  `Vol 2 Specification.pdf · p. 31 · §7.4.2`. Every reference to the buyer's pack carries one of three **states**: `verified`
  (green tick: the quote matches the file word for word), `check` (amber dot: found on the page, not an exact match), `unverified`
  (muted ring: could not be matched). Paper fill on a white card; `surface="white"` on paper or a tint. A link when it opens the page.
- **SourceMark** (`ui/source-mark.tsx`) — in a draft, the small mono number on brand-tint that opens the passage it rests on.
  A labelled gap says what the documents do not support.
- **FilterChip** (`ui/filter-chip.tsx`) — toggle buttons above a list, the chosen one filled ink, each with its count.
  **SegmentedToggle** switches a view between a few named states (Monthly | Annual).
- **ScoreBars** (`ui/score-bars.tsx`) — one bar per point of the buyer's scale. Label it "Marked 3 of 5 against the buyer's scheme"
  and keep the line "A reading of the scoring scheme, not a forecast of the buyer's decision." Never "likely" or "predicted".
- **StatRow / Stat** (`ui/stat.tsx`) — figures side by side, a serif numeral over a muted label, divided by hairlines. Frames:
  `card` (the supplier summary), `rules` (inside a card), `aside` (beside a title from 768 px). Every tile keeps 16 px or more on
  both sides of a divider and labels wrap; the spacing belongs to the component, never to the call site.
- **DetailList** — facts as "term — value" lines divided by hairlines (the checkout confirmation, a subscription).
- **UsageBar** — what is counted, "2 of 3 used", an 8 px ink bar, a note under it. Without a count: words only.
- **UpgradeBand** — the one offer of the next plan on a screen: a brand-tint band with the fact as a serif line, one sentence,
  the price and one green `ButtonLink`. **LockedList / LockedRow** list under it what the plan would show: a neutral title, what
  is fair to give away, the plan's name. Nothing is blurred and nothing blocks the work.
- **DropZone** — a paper panel with a dashed line-strong edge, "Drop the files here", one outline button, what is accepted.
  **StepTracker** — the stages of a long job: done (green ring with a tick), current (heavy ink ring, semibold), waiting (thin
  muted ring). **SkeletonRows** — a list that is still loading, in its own shape.
- **ActionRow / ActionList** — a setting said in a sentence with the one thing to do about it (export, deletion).
- **CopyField** — a read-only value with its Copy button, one row on the form scale.
- **NoticeBand** — one line across the page under the top bar for a condition of the whole page (test mode, trial, a payment
  problem). **Alert** is for a message inside the page.
- **Money** — `£4.2m` in a row (one decimal place above a million), the exact figure in a table; "Value not published" instead of
  zero or £1 placeholders.
- **Notice label** — notice type in the buyer's language (`Tender notice`, `Early notice`, `Award`), as an info badge.
- **Tender row** — title (Inter 17/600), buyer and notice number, match-reason chips (only facts we hold: same category, a buyer you
  have won from, region — no distances), estimated value, DeadlineMarker, actions. The entire row is not a link; the title is.
- **Requirement row** — reference (`R-14`, mono), the buyer's sentence in the serif with its ReferenceChip, StatusPill with one line
  of explanation and one action.
- **EmptyState** — one sentence of what belongs here, one action, optional example. No illustrations.
- **IdentityLine** (`components/marketing/identity-line.tsx`) — who operates the service, under every public page; e-mails print
  the same words. All of it from `src/config/site.ts`.
- **DataAttribution** — on any page with public data: OGL attribution + independence statement + correction link.
- Tables: a white card; small muted column heads (12 px, 600) with no fill; hairline rows, top-aligned; no zebra; row hover
  `--brand-tint`; numeric columns right-aligned with tabular figures.
- Tabs: underline style — the current tab ink and semibold with a 2 px ink rule, the others muted; counts in mono (`TabsCount`).
- Forms: labels above fields (14 px, 600, 6 px above the field), helper text below, errors in `--danger` with an icon and text
  (never colour alone), inline validation on blur.

### 5.5 Composing a screen

1. **Frame.** Public pages in the site header and footer; app pages in the top bar, in a 1280 px container. A condition of the
   whole page goes directly under the bar as a `NoticeBand`.
2. **Title.** One h1: `type-page` in the app (`PageHeader`), `type-h1` on public pages; the page's one green button at its right.
3. **Where you are.** `NavLink`, `Tabs` or `StepTracker`. Never a hand-made current state.
4. **Content in cards.** White cards with a hairline edge, 24 px apart; inside, a serif card title, then lists divided by
   hairlines, a `Table`, a `StatRow` or a `DetailList`. No card inside a card except an 8 px inset panel.
5. **Controls.** Say the size once on the group. Navigate with `ButtonLink`, act with `Button`, icon alone `IconButton`.
6. **States.** Empty (`EmptyState`), loading (`SkeletonRows`), error (`Alert`), limits (`UsageBar`), the next plan once
   (`UpgradeBand`).
7. **Words.** British English, sentence case, no exclamation marks; "email" without a hyphen; dates as 27 Nov 2026; a deadline
   through `DeadlineMarker`; a quote with its `ReferenceChip`.
8. **Check.** `pnpm ui:audit`, `node scripts/design/controls.mjs <your URLs>`, the keyboard once, then 390, 768 and 1280 px.

## 6. Key screens and their states

| Screen | Must show | States to design |
|---|---|---|
| Supplier page (public) | Company name, StatBlocks, "Open tenders like your past work", "Rival contracts ending soon", "Buyers in your trade", wins table, Claim CTA, sample-check CTA, attribution | Unclaimed (3 items per block, blurred count of the rest); claimed by viewer; no matches right now (explain + offer alert); company with one award; very long names; mobile |
| Find your company | Search box (name or company number), results with award counts | Empty, typing, no result ("We only list suppliers with published awards — set up a radar manually"), many results |
| Landing | As `handoff/Landing-*`: hero with the company search and a supplier-page preview, open-data strip, three steps, "Every requirement, quoted and cited", plans (monthly) with the Bid Pass, six questions, closing search, independence band | Desktop, tablet, mobile; logged-in visitor sees "Open your radar" |
| Pricing | As `handoff/Pricing-*`: Monthly / Annual toggle, four plan cards, the Bid Pass band, the VAT line, one comparison table, billing questions. **The one place where plans are compared and chosen** | Signed out (buttons lead to sign-up, then the Billing hand-off); signed in (the workspace's plan is "Current plan", the others lead to the hand-off); a member who cannot pay reads who can |
| Radar | Tabs, filters, tender rows, saved list, upcoming deadlines strip | First run (just claimed), no company linked (onboarding choices), filtered-to-empty, free-plan cap (item 11+ locked), loading skeleton, error with retry |
| New bid | Drop zone, file list with per-file status, optional link to a notice | Empty, uploading, unsupported file, too large, quota reached (UpgradeNotice), free check available |
| Bid workspace → Brief | As `handoff/Brief-*`: verdict panel, key dates, pass-or-fail requirements with filter chips, scored questions, terms to read yourself, pack files | Processing (ProcessingState), partial, ready, failed (what failed, retry, contact), no questions found, scanned/low-quality files warning |
| Bid workspace → Questions | Question list with status and progress summary | None found (add manually), locked on Free, long lists (20+) |
| Answer editor | As `handoff/Editor-*`: question list, the question quoted, the draft with source markers and word count, the evaluator's view | No documents yet (prompt to add them first), drafting, over word limit, evaluator running, evaluator unavailable, read-only for members without permission |
| Documents (library) | Company facts form with expiry dates, documents table | Empty, auto-filled awaiting confirmation, expired accreditation warning, upload errors |
| Billing | As `handoff/Billing-*`: current plan, your allowance (full bids with carry-over, seats and who holds them), pause or cancel, Bid Pass, payment method, receipts. **No plan grid**: "Change plan" goes to Pricing. With `?plan=…&interval=…` or `?buy=bid_pass` it opens the confirm panel (what will happen, one primary button) | Free, trialing, active, cancelling, past due (grace and expired), paused, period lapsed; payments not open yet; each card without its data says so in a sentence, never an invented figure |
| After checkout | As `handoff/CheckoutPlan-*` / `CheckoutPass-*`: the page says "You are on Bid Desk" / "Bid Pass added" only once our records say so | Waiting ("Confirming your payment"), confirmed, taking longer than usual |
| 404 | As `handoff/NotFound-*`: what happened, the company search, three ways on | Public area; inside the app shell |
| Auth | As `handoff/SignIn-*` / `SignUp-*`: the form in a white card; on sign-up, what the account (or the chosen plan) gives beside it | Errors per field, rate-limited, coming from a paid plan or a Bid Pass, invitation, verification link opened in another browser |

## 7. Accessibility and quality bar

WCAG 2.2 AA: contrast ≥4.5:1 for text and ≥3:1 for UI boundaries; visible focus on every interactive element; full keyboard paths for
the core scenario; semantic headings and landmarks; `aria-live="polite"` for processing updates; no information by colour alone;
respects `prefers-reduced-motion`; hit targets ≥44 px on touch. Motion: 120–180 ms ease-out for state changes only.
Every screen is checked in a real browser at 360, 768 and 1280 px before it is called done.

## 8. Implementation guide (where things are, and what to use)

The living reference is the page **`/styleguide`**: tokens, the type scale and every primitive in all its states, the control
scale, links and menus, "where you are", figures, sources, plans and limits, uploads and long jobs, and how to compose a screen.
Read it before building a screen.

| What | Where |
|---|---|
| Tokens, type roles, control sizes, focus ring, links, the pointer rule, print rules | `src/app/globals.css` |
| Fonts | `src/app/layout.tsx` (`next/font`: Source Serif 4, Inter, IBM Plex Mono) |
| Logo mark, lockup, favicon, touch icon, social image | `src/components/logo.tsx`, `src/components/logo-paths.ts` (the designer's paths), `src/app/icon.svg`, `src/app/apple-icon.tsx`, `src/app/opengraph-image.tsx` |
| Primitives | `src/components/ui/*`, form helpers in `src/components/forms/*` (`Form`, `FormField`, `Field`, `FieldGroup`, `FormRow`, `FormRowAction`) |
| App shell | `src/app/app/layout.tsx`, `src/components/app/{app-nav,breadcrumbs,user-menu,workspace-switcher,page-header,settings-nav,plan-strips}.tsx` |
| Public site | `src/app/(marketing)/*`, `src/components/marketing/*` (product pictures in `visuals/`), copy in `src/config/landing.ts`, navigation in `site-nav.ts` |
| Seller identity | `src/config/site.ts` (`operator`, `identity`, `identityText`): footer, Contact, legal pages and e-mails all read it |
| Plans as shown to people | `src/config/plan-display.ts` (reads `src/config/plans.ts`: plans, the Bid Pass, the comparison table); copy about billing in `src/config/billing-copy.ts`; cards in `src/components/billing/pricing-table.tsx`, session-aware buttons in `src/components/marketing/marketing-pricing.tsx` |
| Billing | `src/app/app/settings/billing/page.tsx`, cards in `src/components/billing/billing-cards.tsx` (typed props, actions passed in), `confirm-panel.tsx`, `checkout-status.tsx`; the hand-off URLs in `src/lib/billing/handoff.ts`; bid numbers through `src/server/bid-allowance.ts` |
| E-mails | `src/emails/layout.tsx` (the frame and its parts), `src/emails/text.ts` (the plain-text part), one file per message; preview with `pnpm exec tsx scripts/design/render-emails.ts` |
| Contrast check | `node scripts/design/contrast.mjs [--write]` → `docs/design/CONTRAST.md` |
| Control sizes, pointer, where you are | `node scripts/design/controls.mjs [paths…]` |
| Screenshots of every owned page at 360 / 768 / 1280 | `node scripts/design/screenshots.mjs` → `docs/design/screens/`; e-mails with `node scripts/design/emails.mjs` |
| Keyboard and focus checks | `node scripts/design/keyboard.mjs` |
| Bypasses of the library | `pnpm ui:audit` (ratchet in `tests/ui-smells.test.ts`, raw controls in `tests/ui-guard.test.ts`) |

### 8.1 Utilities

Colours (each works as `bg-*`, `text-*`, `border-*`, `ring-*`, `outline-*`):
`paper`, `paper-deep`, `surface`, `ink`, `ink-2`, `line`, `line-strong`, `brand`, `brand-hover`, `brand-tint`, `brand-mark`,
`brand-on-dark`, `accent`, `accent-ink`, `accent-tint`, `danger`, `danger-hover`, `danger-tint`, `success-tint`, `info`, `info-tint`,
`focus`.

shadcn names resolve to the same tokens (`background`=paper, `foreground`=ink, `card`=surface, `muted-foreground`=ink-2 …) so that
generated components render, but **do not write them**: `pnpm ui:audit` counts them as pre-system leftovers. `accent` is the
amber role, not shadcn's hover grey: for hover and selected surfaces use `bg-paper-deep` or `bg-brand-tint`; the amber dot is
`<Dot />`, not `bg-accent` at the call site.

Type: `font-display` (serif), `font-sans`, `font-mono`; sizes `text-xs`, `text-13`, `text-sm`, `text-15`, `text-base`, `text-17`,
`text-lg`, `text-xl`, `text-22`, `text-2xl`, `text-26`, `text-3xl`, `text-30`, `text-32`, `text-34`, `text-4xl`, `text-5xl`,
`text-44`, `text-6xl`; roles `type-hero`, `type-h1`, `type-page`, `type-h2`, `type-title`, `type-section`, `type-h3`,
`type-question`, `type-lead`, `type-reading`, `type-eyebrow`, `type-ref`, `type-quote`, `type-quote-lg`, `type-figure`. (Role
classes are named `type-*` so that `tailwind-merge` never mistakes them for a colour; `cn()` in `src/lib/utils.ts` knows the
custom keys. In a `cn()` call write `leading-*` after the font size: a later size class removes an earlier leading.)

Control sizes: `controls-sm` (44 px), `controls-md` (48), `controls-lg` (52), `controls-form` (52 on phones, 48 from 640 px) set
the size for an element and everything inside it; a control reads it as `h-(--control-h)`.

Shape and depth: `rounded-chip` (4 px), `rounded-control` (6 px), `rounded-inset` (8 px, a panel inside a card), `rounded-card`
(10 px), `rounded-modal` (12 px); `shadow-raised`, `shadow-overlay`, `shadow-float`.

Layout and helpers: `container-content` (1200 px column, public pages), `container-app` (1280 px column, the app), `max-w-reading`
(about 68 characters), `hit-40` (a 40 px hit area for a small control), `link`, `link-quiet` and `link-ref`, `select-chevron`,
`.on-brand` / `.on-ink` (white focus ring, selection and links inside a green or ink panel).
An anchor **without a class** is styled as a content link automatically: ink with a green underline.

Class recipes that server components need (`buttonVariants`, `controlClasses`, `navLinkVariants`, `tabListClasses`,
`filterChipClasses`) live in modules **without** `"use client"`: a non-component export of a client module cannot be called on
the server, and only `pnpm build` catches it.

### 8.2 Primitives

In `src/components/ui/`: ActionList / ActionRow, Alert, Avatar, Badge, Breadcrumb, Button, ButtonLink, Card, Checkbox,
ControlGroup, CopyField, DeadlineMarker (+ `timeLeft`), DetailList, Dialog, Disclosure (+ `size="sm"`), Dot, DropdownMenu
(+ `variant="cta"`), DropZone, FileButton, FilterChip / FilterChipGroup, IconButton, icons, Input, Label, LockedList / LockedRow,
MenuButton, MenuSheet, NativeSelect, NavLink, NoticeBand, Pagination, Popover, Progress, RadioGroup, ReferenceChip, ScoreBars,
SegmentedToggle, Select, Separator, Skeleton / SkeletonRows, SourceMark, Spinner, Stat / StatRow, StatusPill, StepTracker,
Switch, Table, Tabs (+ `TabsCount`), Textarea, Toaster (sonner), Tooltip (+ `TooltipText`), UpgradeBand, UsageBar.
In `src/components/forms/`: Form, FormField, Field, FieldGroup, FieldHint, FieldError, FormError, FormRow, FormRowAction.

Notes on the ones that differ from the shadcn originals:

- `Button`: height from the control scale (§5.1); `loading` (spinner, `aria-busy`, blocks clicks; keep the label); variants in §5.2.
- `Badge`: `default` (solid green: "Verdict"), `strong` (ink edge: "Mandatory"), `outline` (line-strong edge: "Pass or fail"),
  `secondary` (paper-deep: plan names, roles, regions), `brand` (brand-tint), `warning` (amber tint: "14 days left"), `success`
  (brand green on success-tint), `destructive`, `info` ("Tender notice").
- `Alert`: a tinted panel, 6 px radius, no outline; variants `info`, `success`, `warning`, `destructive`; the title takes the hue of
  the state. Default role is `alert`; pass `role="status"` or `role="note"` when it should not interrupt.
- `Card`: no shadow by default. `CardTitle` is serif 20/26; a utility card adds `font-sans text-base`.
- `Dialog`: a form inside wraps fields AND footer in `<Form>`, so the footer buttons take the fields' height; on phones the
  footer buttons are full width at 48 px. The close button is 44 px.
- `Table`: `framed`, `containerClassName` (give it a max height for the sticky header), `numeric` on `TableHead` / `TableCell`.
- `Disclosure`: `variant="inline"` for a secondary step inside a card or a table row — a link-styled summary with the chevron
  (the default stays the serif question of the FAQ).
- `Progress`: `tone` = `brand` | `warning` | `danger`.

### 8.3 App shell patterns

- The shell is a white **top bar**, not a sidebar: logo, then Radar, Bids, Documents (`/app/library`); on the right the workspace
  name (a `MenuButton`: it is the workspace switcher) and the avatar menu, which holds the plan, Upgrade (owners on Free, to
  `/pricing`), Billing (owners), Settings, help and sign-out. On Free the bar also carries the "Free plan" chip and "See plans";
  below 768 px those sit with the workspace name in a 44 px bar of their own, and the sections move into the `MenuSheet`.
- Under the bar, in this order and only when they apply: the trial strip ("Trial · 9 days left · 1 full bid included · First
  payment £149 + VAT on 27 Nov 2026", with "Manage" for owners; a payment that will be taken is written with its VAT, `plusVat()` in `src/config/billing-copy.ts`), the test-mode band (Billing pages), a payment problem, a seat problem.
- Pages render inside `<main id="main">` in a 1280 px container; start with `<PageHeader title … description … actions … />`
  (`eyebrow` is the mono meta line above the title, `meta` a row under the description). Group content with `<PageSection>`; use
  `<EmptyState>` for "nothing here yet".
- The breadcrumb sits above the title, as in the bid brief: the full trail from 768 px, one link back to the parent on phones.
  Top-level pages and Settings have none. A page whose URL contains an id names itself:
  `<BreadcrumbTrail items={[{ label: "Bids", href: "/app/bids" }, { label: bid.buyerShort, href: … }, { label: "Bid brief" }]} />`.
- Settings pages (Profile, Workspace, Members, Usage) share a title and link tabs (`SettingsFrame`); each page starts with
  `<PageHeader level={2} …>`. Billing is a page of its own, outside the tabs, reached from the account menu.
- Navigation lives in `src/components/app/app-nav.tsx` (`sections`).
- Do not add a `loading.tsx` above a page that must answer 403.

**Where a scroll stops** (`globals.css`, base layer; `src/components/scroll-to-top.tsx`;
guard: rule "scroll" of `scripts/design/controls.mjs`).

- Another page always opens at its very top; Back and Forward return to where a page was
  left; an address with a `#section` stops with the section 16 px under the sticky bar.
- In-page links glide (`scroll-behavior: smooth`, off with reduced motion). A change of page
  never does: `<html data-scroll-behavior="smooth">` lets the router switch it off. Do not
  remove one without the other.
- The sticky bar is allowed for by a **scroll margin on the target** (anchor targets and
  controls inside `<main>`: bar + 16 px), never by `scroll-padding` on the page: padding
  makes the bar's own controls count as out of view, and the page jumps when one takes
  focus. A target that needs another distance uses `scroll-mt-*`; anything inside an
  element with the class `sticky` asks for none.
- A menu or sheet whose trigger sits in a sticky bar returns focus with
  `focus({ preventScroll: true })` (`MenuSheet` does).

### 8.4 Plans, pricing and the hand-off into Billing

- Plans live only in `src/config/plans.ts`; what people read comes from `plan-display.ts` and `billing-copy.ts`. No price, limit or
  plan name is written in a component.
- There is one place to compare and choose plans: `/pricing`. Everything that says "upgrade" links there or straight to the
  hand-off: `/app/settings/billing?plan=<starter|pro|business>&interval=<month|year>` or `/app/settings/billing?buy=bid_pass`
  (`billingHandoff()`); for a visitor who is not signed in, `/sign-up?redirect=<that address>` (`signUpThenBilling()`).
- With such a parameter Billing opens the confirm panel: what was chosen, what happens next in one sentence, and one primary
  button ("Continue to payment", or "Confirm change" for an existing subscriber). Closing it returns to the plain Billing page.
  Where payments are not configured the panel says "Payments are not open yet." — never a dead button on a plan card.
- After checkout Paddle returns to `/app/settings/billing/success` (`?bought=bid_pass` for a pass), which waits for our own
  records before it confirms anything.

### 8.5 E-mail

- Every message sits in `EmailLayout` (the sheet of the e-mail artboards: 600 px on paper-deep, wordmark on a hairline, 16 px text,
  the action as a semibold link with a green underline, then why-you-got-this and the identity line). Parts: `EmailText`,
  `EmailAction`, `EmailHeading`, `EmailSummary`, `EmailDeadline`, `EmailList`, `EmailLink`.
- No images, no web fonts, nothing fetched on opening: the privacy notice promises no tracking pixels. Tables and inline styles;
  the phone and dark-mode rules are an extra for clients that read them.
- Every message has a hand-written plain-text part (`emailText()`): the action link is the first address in it (the dev outbox
  and the end-to-end tests follow "the first link").
- Say how long a link works with the true figure (verification 24 hours, reset 1 hour, invitation 7 days), and why the person got
  the message. Greet with a plain first name only (`greeting()`): the name was typed into a form by whoever signed up.

### 8.6 Decisions that extend the artboards

- **Trial bullet and question.** The Bid Desk card says "14-day trial, one full bid included" and the billing questions explain
  the trial: the trial is card-up-front and includes one full bid.
- **"Your allowance · renews {date}"** heads the allowance card on Billing (the artboard says "This month"): bids renew on the
  billing date, not on the 1st.
- **Phone buttons are 48 px with 16 px labels** wherever the artboards drew 46 px (Foundations, "Control sizes").
- **Footer**: our real pages (Refunds, Acceptable use, Data processing, Free bid check, Stop emails from us) and the identity
  line with the real operator; the hairline above it runs the full container width.
- **Plan comparison** is one table at every width: under 904 px it scrolls sideways with the first column pinned and says so.
- **Hero below 1280 px**: the two columns narrow rather than wrap until 1024 px; below that the supplier preview follows the text.
- **Steps on tablets** (768–1023 px) are rows — picture left, words right — instead of an orphaned third column.
- **Workspace name in the top bar** carries a small chevron and, when the workspace has a logo, the logo: it is the switcher.
- **Reading column** is 35rem, not `68ch`: the CSS `ch` unit is the width of "0", so `68ch` of Inter holds about 85 characters.
- **Mobile navigation** is a sheet that drops from the top bar (`MenuSheet`); dialogs on phones are bottom sheets; menu and select
  items are 40 px tall on touch screens.
- **Product pictures on public pages** are HTML and CSS with fictional sample data, exposed to assistive technology as one described
  image each (`role="img"`), so nothing inside is focusable.
- **Placeholders** in legal copy (`[[LIKE_THIS]]`) are rendered highlighted, and a page that still has one says "Draft for
  review"; `docs/legal/TODO.md` lists them. Pending operator details (UK representative, ICO number) render a plain sentence.
- **Print**: chrome marked `data-print="hide"` (and the shell's own slots) is hidden; legal pages print link targets.

