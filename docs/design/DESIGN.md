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
3. **Deadlines lead.** Dates are the most important datum on almost every screen. They get a consistent treatment (an amber marker,
   the absolute date in ink, the time left in a small pill) and the same position in every card and table row.
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
panel); 8 px for a card inside a card. Borders do the work; shadows are rare: `0 1px 2px rgb(22 26 29 / 0.06)` raised,
`0 12px 32px rgb(22 26 29 / 0.14)` on popovers/modals, and a long soft shadow under a product figure on a public page.
Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64, 96. Public pages: 1200 px column (20 px gutters on phones, 24 px from 640 px).
App: 1280 px column (20 px, 32 px from 768 px). Reading column about 68 characters.

### 3.1 The designer's five changes (all accepted, 2026-11-13)

Ratios are computed by `scripts/design/contrast.mjs` and listed in `docs/design/CONTRAST.md`.

1. **Amber has a darker partner for small text.** `--accent` is 3.98:1 on paper: it fails as small text and cannot be a filled badge
   (white on it is 4.2:1). Keep it for markers, rules and large numerals; small amber text is `--accent-ink`. In practice small
   deadlines are written in ink beside an amber dot.
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
- Sentence case everywhere, including eyebrows (14 px, 600, brand green). No capitals for emphasis.

### 4.1 How the scale is implemented

The Tailwind size names are remapped onto the scale, so any `text-*` class lands on it:

| Class | px / line-height | Role class | Used for |
|---|---|---|---|
| `text-xs` | 12/16 | `type-ref` (mono 12/18) | Chips, column heads, mono references |
| `text-13` | 13/20 | | Status pills, notes, helper and error text |
| `text-sm` | 14/20 | `type-eyebrow` (600, brand) | Tables, descriptions, labels |
| `text-15` | 15/22 | | Body in the app, buttons, tabs |
| `text-base` | 16/24 | `type-reading` (16/26) | Body on public pages; inputs |
| `text-17` | 17/24 | `type-quote` (serif 17/25) | Row titles, points; a quoted requirement |
| `text-lg` | 18/28 | `type-lead` (16/26 on phones) | Lead paragraph under a heading — ink, not grey |
| `text-xl` | 20/26 | | Card heading (`CardTitle`) |
| `text-2xl` | 24/30 | `type-h3` (22/27 on phones) | Step and plan names, sub-sections |
| `text-3xl` | 28/34 | `type-section` (24/29 on phones) | Section heading inside a page or the app |
| `text-4xl` | 36/42 | `type-title` (26/30 on phones) | Page title in the app |
| `text-5xl` | 40/45 | `type-h2` (28/32, 36/41) | Section heading on a public page |
| `text-6xl` | 50/54 | `type-hero` (34/38, 44/48) | Hero headline from 1024 px |

- `type-h1` (30/34, 40/44, 44/48) is the title of a public page. `type-quote-lg` (20/28, 25/34) is the quote that leads a card.
  `type-figure` sets a large numeral in the serif (stat blocks 34 px, prices 44 px).
- `h1`–`h3` are set in the display serif, 600, by default. A heading that is a UI label — a row title, a point, a utility card —
  sets `font-sans`.
- Headings use `text-wrap: balance`; paragraphs and list items use `text-wrap: pretty`.
- Fonts are self-hosted by `next/font` (no request to Google at run time). The Open Graph image uses static TTF copies in
  `src/assets/og-fonts` (SIL Open Font Licence).

## 5. Core components

Shared components exist for the first five; build screens from them (see `/styleguide#bid`).

- **DeadlineMarker** (`src/components/ui/deadline-marker.tsx`) — an amber dot, the date in ink, a small amber-tint pill with the
  time left: `● Closes 27 Nov 2026  [14 days left]`. Closed: grey dot, muted words, no pill. Always includes the absolute date.
- **StatusPill** (`ui/status-pill.tsx`) — the state of a requirement, always a sign and a word: `Gap` (danger), `For you to confirm`
  (info), `Met` (brand green with a tick), `Not checked` (muted).
- **ReferenceChip** (`ui/reference-chip.tsx`) — where a quote comes from, in mono on paper with a hairline edge:
  `Vol 2 Specification.pdf · p. 31 · §7.4.2`. A link when it can open the source page.
- **FilterChip** (`ui/filter-chip.tsx`) — toggle buttons above a list, the chosen one filled ink, each with its count.
- **ScoreBars** (`ui/score-bars.tsx`) — one bar per point of the buyer's scale. Label it "Marked 3 of 5 against the buyer's scheme"
  and keep the line "A reading of the scoring scheme, not a forecast of the buyer's decision." Never "likely" or "predicted".
- **Money** — `£4.2m` in a row (one decimal place above a million), the exact figure in a table; "Value not published" instead of
  zero or £1 placeholders.
- **Notice label** — notice type in the buyer's language (`Tender notice`, `Early notice`, `Award`), as plain muted text or an info badge.
- **Tender row** — title (Inter 17/600), buyer and notice number, match-reason chips (only facts we hold: same category, a buyer you
  have won from, region — no distances), estimated value, DeadlineMarker, actions. The entire row is not a link; the title is.
- **Requirement row** — reference (`R-14`, mono), the buyer's sentence in the serif with its ReferenceChip, StatusPill with one line
  of explanation and one action.
- **Source marker** — in a draft, a small mono number on brand-tint that opens the passage it rests on; a labelled gap where the
  documents do not support a point.
- **StatBlock** — a large serif numeral over a 13 px muted label, cells divided by hairlines in one white card.
- **EmptyState** — one sentence of what belongs here, one action, optional example. No illustrations.
- **ProcessingState** — step list with real stages (Reading files → Finding requirements → Listing questions → Checking against your
  company) and elapsed time; survives refresh; shows partial results as they land.
- **UpgradeNotice** — inline, never a modal trap: what is locked, what the plan includes, price, one button.
- **DataAttribution** — footer line on any page with public data: OGL attribution + independence statement + correction link.
- Tables: a white card; small muted column heads (12 px, 600) with no fill; hairline rows, top-aligned; no zebra; row hover
  `--brand-tint`; numeric columns right-aligned with tabular figures.
- Tabs: underline style — ink labels on a hairline, a 2 px ink rule under the current one, counts in mono.
- Forms: labels above fields (14 px, 600), helper text below, errors in `--danger` with an icon and text (never colour alone), inline
  validation on blur. Controls are 44 px tall with a `--line-strong` edge.

## 6. Key screens and their states

| Screen | Must show | States to design |
|---|---|---|
| Supplier page (public) | Company name, StatBlocks, "Open tenders like your past work", "Rival contracts ending soon", "Buyers in your trade", wins table, Claim CTA, sample-check CTA, attribution | Unclaimed (3 items per block, blurred count of the rest); claimed by viewer; no matches right now (explain + offer alert); company with one award; very long names; mobile |
| Find your company | Search box (name or company number), results with award counts | Empty, typing, no result ("We only list suppliers with published awards — set up a radar manually"), many results |
| Landing | As `handoff/Landing-*`: hero with the company search and a supplier-page preview, open-data strip, three steps, "Every requirement, quoted and cited", plans with the Bid Pass, "Straight answers", questions, closing search, independence band | Desktop, tablet, mobile; logged-in visitor sees "Open your radar" |
| Radar | Tabs, filters, tender rows, saved list, upcoming deadlines strip | First run (just claimed), no company linked (onboarding choices), filtered-to-empty, free-plan cap (item 11+ locked), loading skeleton, error with retry |
| New bid | Drop zone, file list with per-file status, optional link to a notice | Empty, uploading, unsupported file, too large, quota reached (UpgradeNotice), free check available |
| Bid workspace → Brief | As `handoff/Brief-*`: verdict panel, key dates, pass-or-fail requirements with filter chips, scored questions, terms to read yourself, pack files | Processing (ProcessingState), partial, ready, failed (what failed, retry, contact), no questions found, scanned/low-quality files warning |
| Bid workspace → Questions | Question list with status and progress summary | None found (add manually), locked on Free, long lists (20+) |
| Answer editor | As `handoff/Editor-*`: question list, the question quoted, the draft with source markers and word count, the evaluator's view | No documents yet (prompt to add them first), drafting, over word limit, evaluator running, evaluator unavailable, read-only for members without permission |
| Documents (library) | Company facts form with expiry dates, documents table | Empty, auto-filled awaiting confirmation, expired accreditation warning, upload errors |
| Billing | Current plan, usage vs limits, plans, invoices link | Free, trialing, active, past due (grace countdown), cancelled (access until date), billing not configured (dev) |
| Auth | Sign up / in, verify, reset | Errors per field, rate-limited, already claimed company |

## 7. Accessibility and quality bar

WCAG 2.2 AA: contrast ≥4.5:1 for text and ≥3:1 for UI boundaries; visible focus on every interactive element; full keyboard paths for
the core scenario; semantic headings and landmarks; `aria-live="polite"` for processing updates; no information by colour alone;
respects `prefers-reduced-motion`; hit targets ≥44 px on touch. Motion: 120–180 ms ease-out for state changes only.
Every screen is checked in a real browser at 360, 768 and 1280 px before it is called done.

## 8. Implementation guide (where things are, and what to use)

The living reference is the page **`/styleguide`**: tokens, the type scale and every primitive in all its states, plus the shared bid
components and recipes for the domain components. Read it before building a screen.

| What | Where |
|---|---|
| Tokens, type roles, focus ring, links, print rules | `src/app/globals.css` |
| Fonts | `src/app/layout.tsx` (`next/font`: Source Serif 4, Inter, IBM Plex Mono) |
| Logo mark, lockup, favicon, touch icon, social image | `src/components/logo.tsx`, `src/components/logo-paths.ts` (the designer's paths), `src/app/icon.svg`, `src/app/apple-icon.tsx`, `src/app/opengraph-image.tsx` |
| Primitives | `src/components/ui/*`, form helpers in `src/components/forms/*` |
| Shared bid components | `src/components/ui/{status-pill,reference-chip,deadline-marker,filter-chip,score-bars}.tsx` |
| App shell | `src/app/app/layout.tsx`, `src/components/app/{app-nav,breadcrumbs,user-menu,workspace-switcher,page-header,settings-nav}.tsx` |
| Public site | `src/app/(marketing)/*`, `src/components/marketing/*` (product pictures in `visuals/`), copy in `src/config/landing.ts` |
| Plans as shown to people | `src/config/plan-display.ts` (reads `src/config/plans.ts`; holds the Bid Pass and the comparison table); cards in `src/components/billing/pricing-table.tsx` |
| Contrast check | `node scripts/design/contrast.mjs [--write]` → `docs/design/CONTRAST.md` |
| Screenshots of every owned page at 360 / 768 / 1280 | `node scripts/design/screenshots.mjs` → `docs/design/screens/` |
| Keyboard and focus checks | `node scripts/design/keyboard.mjs` |

### 8.1 Utilities

Colours (each works as `bg-*`, `text-*`, `border-*`, `ring-*`, `outline-*`):
`paper`, `paper-deep`, `surface`, `ink`, `ink-2`, `line`, `line-strong`, `brand`, `brand-hover`, `brand-tint`, `brand-mark`,
`brand-on-dark`, `accent`, `accent-ink`, `accent-tint`, `danger`, `danger-hover`, `danger-tint`, `success-tint`, `info`, `info-tint`,
`focus`.

shadcn names resolve to the same tokens: `background`=paper, `foreground`=ink, `card`/`popover`=surface, `muted`/`secondary`=paper-deep,
`muted-foreground`=ink-2, `border`=line, `input`=line-strong, `primary`=brand, `destructive`=danger, `ring`=focus, `warning`=accent.
**`accent` is the amber role, not shadcn's hover grey**: for hover and selected surfaces use `bg-paper-deep` or `bg-brand-tint`.

Type: `font-display` (serif), `font-sans`, `font-mono`; sizes `text-xs`, `text-13`, `text-sm`, `text-15`, `text-base`, `text-17`,
`text-lg`, `text-xl` … `text-6xl`; roles `type-hero`, `type-h1`, `type-h2`, `type-title`, `type-section`, `type-h3`, `type-lead`,
`type-reading`, `type-eyebrow`, `type-ref`, `type-quote`, `type-quote-lg`, `type-figure`. (Role classes are named `type-*` so that
`tailwind-merge` never mistakes them for a colour; `cn()` in `src/lib/utils.ts` knows the custom keys.)

Shape and depth: `rounded-chip` (4 px), `rounded-control` (6 px), `rounded-card` (10 px), `rounded-modal` (12 px) — the Tailwind
names snap to the same steps (`sm` 4, `md` 6, `lg` 8, `xl` 10, `2xl`+ 12); `shadow-raised`, `shadow-overlay`, `shadow-float`.

Layout and helpers: `container-content` (1200 px column, public pages), `container-app` (1280 px column, the app), `max-w-reading`
(about 68 characters), `hit-40` (a 44 px hit area for a small control), `link`, `link-quiet` and `link-ref`, `select-chevron`,
`.on-brand` / `.on-ink` (white focus ring, selection and links inside a green or ink panel).
An anchor **without a class** is styled as a content link automatically: ink with a green underline.

### 8.2 Primitives

Restyled to the artboards: Alert, Avatar, Badge, Breadcrumb, Button, Card, Checkbox, Dialog, Disclosure, DropdownMenu, Input, Label,
Pagination, Popover, Progress, RadioGroup, Select, Separator, Skeleton, Spinner, Switch, Table, Tabs (+ `tabListClasses` /
`tabTriggerClasses` for link tabs, `TabsCount`), Textarea, Toaster (sonner), Tooltip, FormField / FieldHint / FieldError / FormError,
NativeSelect. Added for the bid screens: StatusPill, ReferenceChip, DeadlineMarker (+ `timeLeft`), FilterChip / FilterChipGroup
(+ `filterChipClasses`), ScoreBars, ToggleButton.

Extensions to the shadcn APIs:

- `Button`: 44 px tall, 15 px semibold. `loading` (spinner, `aria-busy`, blocks clicks); variants `default` (green), `outline`
  (every secondary action), `inverse` and `inverse-outline` for green panels; sizes `lg` 52 px (beside the company search), `sm`
  36 px and `xs` 28 px with a 44 px hit area.
- `Badge`: variants `default` (solid green: "Verdict"), `strong` (ink edge: "Mandatory"), `outline` (line-strong edge:
  "Pass / fail"), `secondary` (paper-deep), `brand` (brand-tint), `warning` ("14 days left"), `success` (brand green on
  success-tint), `destructive`, `info`.
- `Alert`: a tinted panel, 6 px radius, no outline; variants `info`, `success`, `warning`, `destructive`; the title takes the hue of
  the state. Default role is `alert`; pass `role="status"` or `role="note"` when it should not interrupt.
- `Card`: no shadow by default. `CardTitle` is serif 20/26; a utility card adds `font-sans text-base`.
- `Table`: `framed`, `containerClassName` (give it a max height for the sticky header), `numeric` on `TableHead` / `TableCell`.
- `Disclosure`: `variant="inline"` for a secondary step inside a card or a table row — a link-styled summary with the chevron
  (the default stays the serif question of the FAQ).
- `Progress`: `tone` = `brand` | `warning` | `danger`.
- `ReferenceChip`: `state` = `verified` | `check` | `unverified` puts what our own check found for the quote in front of the
  reference, as a mark whose shape differs as well as its colour (tick, amber dot, hollow dot) with the word for screen readers;
  `quiet` drops the box (an underlined reference for fact cards and side lists). `ReferenceChipButton` is the chip as a button
  (the trigger of the citation popover; it is named by the text it shows, so give it no `aria-label`); `ReferenceStateMark` is
  the mark on its own, for a legend.
- `ToggleButton`: a button that is on or off, always with `aria-pressed`. `variant="check"` is a small labelled tick ("I have
  checked this" / "Confirmed by you"); `variant="marker"` is a numbered source marker in or beside running text, with
  `tone="danger"` for a marker that matches no source. For a row of exclusive choices use FilterChip; for an action, Button.

### 8.3 App shell patterns

- The shell is a white **top bar**, not a sidebar: logo, then Radar, Bids, Documents (`/app/library`); on the right the workspace
  name (it is the workspace switcher) and the avatar menu, which holds the plan badge, Upgrade or Manage plan, Settings, help and
  sign-out. Below 768 px the links move into a menu opened by the three-line button; the avatar menu stays in the bar.
- Pages render inside `<main id="main">` in a 1280 px container; start with `<PageHeader title … description … actions … />`
  (`eyebrow` is the mono meta line above the title, `meta` a row under the description). Group content with `<PageSection>`; use
  `<EmptyState>` for "nothing here yet".
- The breadcrumb sits above the title, as in the bid brief: the full trail from 768 px, one link back to the parent on phones.
  Top-level pages and Settings have none. A page whose URL contains an id names itself:
  `<BreadcrumbTrail items={[{ label: "Bids", href: "/app/bids" }, { label: bid.buyerShort, href: … }, { label: "Bid brief" }]} />`.
- Settings pages share a title and tabs (`SettingsFrame`); each page starts with `<PageHeader level={2} …>`.
- Navigation lives in `src/components/app/app-nav.tsx` (`sections`).
- Do not add a `loading.tsx` above a page that must answer 403.

### 8.4 Decisions that extend the artboards

- **Plans on the landing page** are the real ones (`handoff/README.md`): four cards with the designer's layout, Bid Desk filled
  green, and the **Bid Pass** as a brand-tint panel across the full width directly under them.
- **"Straight answers"** (who runs it, where files are stored, AI training, what it will not do, renewals, payments) is a band
  between the plans and the questions, built from the artboards' "point under a 2 px ink rule".
- **Hero below 1280 px**: the two columns narrow rather than wrap until 1024 px; below that the supplier preview follows the text.
- **Steps on tablets** (768–1023 px) are rows — picture left, words right — instead of an orphaned third column.
- **Workspace name in the top bar** carries a small chevron and, when the workspace has a logo, the logo: it is the switcher.
- **Reading column** is 35rem, not `68ch`: the CSS `ch` unit is the width of "0", so `68ch` of Inter holds about 85 characters.
- **Mobile navigation in the app** is a sheet that drops from the top bar; dialogs on phones are bottom sheets; menu and select
  items are 40 px tall on touch screens.
- **Auth pages**: form on the left, a brand-green panel with the tagline on the right from 1024 px (the split of the social image);
  one column below.
- **Product pictures on public pages** are HTML and CSS with fictional sample data, exposed to assistive technology as one described
  image each (`role="img"`), so nothing inside is focusable.
- **Placeholders** in legal copy (`[[LIKE_THIS]]`) are rendered highlighted; `docs/legal/TODO.md` lists them.
- **Print**: chrome marked `data-print="hide"` (and the shell's own slots) is hidden; legal pages print link targets.
