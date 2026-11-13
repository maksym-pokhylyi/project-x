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

### 3.1 Additions made while implementing (2026-11-13)

Five tokens were added because the contrast bar in §7 could not be met with the original set. Ratios are computed by
`scripts/design/contrast.mjs` and listed in `docs/design/CONTRAST.md`.

| Token | Value | Why it exists |
|---|---|---|
| `--line-control` | `#8A8373` | Boundary of inputs, checkboxes, radios and switches. `--line-strong` is 1.8:1 on white; §7 asks for ≥3:1 on control boundaries. This is 3.8:1 on surface and 3.5:1 on paper. `--line-strong` stays for dividers and the secondary-button outline (a button is identified by its label, not its edge). shadcn's `--input` maps to this token. |
| `--accent-ink` | `#8F5206` | Amber for **text**. `--accent` is 3.7:1 on its tint and 4.0:1 on paper, below 4.5:1. Use `--accent` for icons, bars, dots and borders; `--accent-ink` for words ("Closes in 9 days", "Verify", "Evidence needed"). 5.5:1 on accent-tint. |
| `--brand-on-dark` | `#C9DED5` | Secondary text on a brand-coloured panel (auth panel, closing call to action). 5.8:1 on brand. |
| `--danger-hover` | `#861F15` | Hover and pressed state of the destructive button. |
| `--focus-on-dark` | `#FFFFFF` | The focus ring inside a brand-coloured panel (wrap the panel in `.on-brand`). |

Rules that follow from the numbers:

- `--ink-3` is for paper and surface only (4.5:1 and 4.8:1). On `--surface-sunken` it is 4.2:1: use `--ink-2` there.
- Never set white text on solid amber (4.2:1). Amber appears as a tint with `--accent-ink` text.
- A hairline (`--line`, 1.3:1) is decoration: never the only cue that something is a control or a state.

## 4. Typography

- Display / headings: **Source Serif 4** (600 for h1–h2, 500 for h3). Gives an editorial, document-like authority.
- UI and body: **Inter** (400/500/600), with `font-feature-settings: "tnum" 1, "cv11" 1` for tabular figures in data.
- Mono (references, CPV codes, citations' page refs): **IBM Plex Mono** 400/500.
- Scale (px / line-height): 12/16, 13/18, 14/20 (dense UI), 16/24 (body), 18/28 (lead), 22/28 (h3), 28/34 (h2), 40/44 (h1 marketing),
  56/58 (hero, ≥1024 px only). Never below 12 px. Sentence case everywhere; no all-caps except 11–12 px eyebrow labels with 0.06em tracking.

### 4.1 How the scale is implemented

The Tailwind size names are remapped onto the scale, so any `text-*` class lands on it:

| Class | px / line-height | Role class | Used for |
|---|---|---|---|
| `text-xs` | 12/16 | `type-eyebrow`, `type-ref` | Chips, eyebrows (12 px, 600, 0.06em, the only all-caps style), mono references |
| `text-13` | 13/18 | | Helper and error text, table headers, captions |
| `text-sm` | 14/20 | | Dense UI: buttons, table cells, menus |
| `text-base` | 16/24 | `type-reading` (16/28) | Body. Long-form reading text (legal pages, FAQ answers) uses 16/28 in the 68-character column |
| `text-lg` | 18/28 | `type-lead` | Lead paragraph under a heading |
| `text-xl` | 22/28 | `type-h3` | Sub-section heading, weight 500 |
| `text-2xl` | 28/34 | `type-h2` | Section heading; page title inside the app (22/28 on phones) |
| `text-3xl` | 40/44 | `type-h1` | Page title on public pages from 640 px (28/34 on phones); major landing sections from 1024 px |
| `text-4xl` | 56/58 | `type-hero` | Hero headline from 1024 px (40/44 below) |

- `h1`–`h3` are set in the display serif by default (600, 600, 500). A heading that is a UI label — a card title, a plan name, a
  dialog field group — sets `font-sans` at 16/24, weight 600. Dialog titles use `type-h3`.
- Inter carries `"tnum" 1, "cv11" 1` everywhere, so figures align in columns without an extra class.
- Headings use `text-wrap: balance`; paragraphs and list items use `text-wrap: pretty`.
- Fonts are self-hosted by `next/font` (no request to Google at run time). The Open Graph image uses static TTF copies in
  `src/assets/og-fonts` (SIL Open Font Licence).

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
| Landing | Hero led by the cited bid check (verdict, requirements, one quote open), fact strip, cited check close-ups, radar with a supplier page preview, drafts, how it works (3 steps), "Straight answers", pricing teaser with the Bid Pass, FAQ, independence note | Desktop, mobile; logged-in visitor sees "Open your radar" |
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

## 8. Implementation guide (where things are, and what to use)

The living reference is the page **`/styleguide`**: tokens, the type scale and every primitive in all its states, plus recipes for
the domain components. Read it before building a screen.

| What | Where |
|---|---|
| Tokens, type roles, focus ring, links, print rules | `src/app/globals.css` |
| Fonts | `src/app/layout.tsx` (`next/font`: Source Serif 4, Inter, IBM Plex Mono) |
| Logo mark, wordmark, favicon, touch icon, social image | `src/components/logo.tsx`, `src/components/logo-paths.ts`, `src/app/icon.svg`, `src/app/apple-icon.tsx`, `src/app/opengraph-image.tsx`; geometry in `scripts/design/logo-geometry.mjs` |
| Primitives | `src/components/ui/*`, form helpers in `src/components/forms/*` |
| App shell | `src/app/app/layout.tsx`, `src/components/app/{app-nav,breadcrumbs,mobile-account,user-menu,workspace-switcher,page-header}.tsx` |
| Marketing | `src/app/(marketing)/*`, `src/components/marketing/*` (product visuals in `visuals/`), copy in `src/config/landing.ts` |
| Plans as shown to people | `src/config/plan-display.ts` (reads `src/config/plans.ts`; holds the Bid Pass and the comparison table) |
| Contrast check | `node scripts/design/contrast.mjs [--write]` → `docs/design/CONTRAST.md` |
| Screenshots of every owned page at 360 / 768 / 1280 | `node scripts/design/screenshots.mjs` → `docs/design/screens/` |

### 8.1 Utilities

Colours (each works as `bg-*`, `text-*`, `border-*`, `ring-*`, `outline-*`):
`paper`, `surface`, `surface-sunken`, `ink`, `ink-2`, `ink-3`, `line`, `line-strong`, `line-control`, `brand`, `brand-hover`,
`brand-tint`, `brand-on-dark`, `accent`, `accent-ink`, `accent-tint`, `danger`, `danger-hover`, `danger-tint`, `success`,
`success-tint`, `info`, `info-tint`, `focus`.

shadcn names resolve to the same tokens: `background`=paper, `foreground`=ink, `card`/`popover`=surface, `muted`/`secondary`=surface-sunken,
`muted-foreground`=ink-2, `border`=line, `input`=line-control, `primary`=brand, `destructive`=danger, `ring`=focus, `warning`=accent.
**`accent` is the amber role, not shadcn's hover grey**: for hover and selected surfaces use `bg-muted` or `bg-brand-tint`.

Type: `font-display` (serif), `font-sans`, `font-mono`; sizes `text-xs`, `text-13`, `text-sm`, `text-base`, `text-lg`, `text-xl`,
`text-2xl`, `text-3xl`, `text-4xl`; roles `type-hero`, `type-h1`, `type-h2`, `type-h3`, `type-lead`, `type-reading`, `type-eyebrow`,
`type-ref`. (Role classes are named `type-*` so that `tailwind-merge` never mistakes them for a colour; `cn()` in `src/lib/utils.ts`
knows the custom keys.)

Shape and depth: `rounded-control` (4 px), `rounded-card` (8 px), `rounded-modal` (12 px) — the Tailwind names snap to the same
three steps (`sm`/`md` 4, `lg`/`xl` 8, `2xl`+ 12); `shadow-raised`, `shadow-overlay` (Tailwind's `shadow-sm…md` map to raised,
`shadow-lg…2xl` to overlay).

Layout and helpers: `container-content` (1120 px column with gutters), `max-w-content`, `max-w-reading` (68ch), `hit-40` (40 px hit
area for a small control), `link` and `link-quiet`, `select-chevron`, `.on-brand` (white focus ring and selection inside a brand panel).
An anchor **without a class** is styled as a content link automatically.

### 8.2 Primitives

Restyled: Alert, Avatar, Badge, Button, Card, Dialog, DropdownMenu, Input, Label, Progress, Select, Separator, Skeleton, Table,
Textarea, Toaster (sonner), FormField / FieldHint / FieldError / FormError, NativeSelect.
Added: Tabs (+ `tabListClasses` / `tabTriggerClasses` for link tabs), Popover, Tooltip, Checkbox, RadioGroup, Switch, Breadcrumb,
Pagination, Spinner, Disclosure (native `details`).

Extensions to the shadcn APIs:

- `Button`: `loading` (spinner, `aria-busy`, blocks clicks); variants `inverse` and `inverse-outline` for brand panels; sizes are
  40 px by default, `sm` 32 px and `xs` 28 px with a 40 px hit area, `lg` 48 px.
- `Badge`: variants `brand`, `success`, `warning`, `destructive`, `info`, `secondary`, `outline`. Mapping for the domain chips —
  deadline: `secondary` (>14 days), `warning` (4–14), `destructive` (≤3), `secondary` struck (closed); notice type: Tender `brand`,
  Early notice `info`, Award `success`, Below-threshold `secondary`, Framework `outline`; requirement status with an icon:
  Met `success`, Gap `destructive`, Verify `warning`, Unknown `secondary`.
- `Alert`: variants `info`, `success`, `warning`, `destructive`; the icon follows the variant (`icon={false}` to omit, or pass one).
  Default role is `alert`; pass `role="status"` or `role="note"` when it should not interrupt.
- `Card`: no shadow by default; `raised` adds the small shadow. `CardTitle` is a UI heading (Inter 600, 16/24).
- `Progress`: `tone` = `brand` | `success` | `warning` | `danger`.
- `Table`: `framed`, `containerClassName` (give it a max height for the sticky header), `numeric` on `TableHead` / `TableCell`.
- `Separator`: `strong`.

### 8.3 App shell patterns

- Pages render inside `<main id="main">` in a 1120 px container; start with `<PageHeader title … description … actions … meta … />`.
  Group content with `<PageSection>`; use `<EmptyState>` for "nothing here yet" (one sentence, one action, optional example).
- The top bar's breadcrumb is derived from the URL. A page whose URL contains an id names itself:
  `<BreadcrumbTrail items={[{ label: "Bids", href: "/app/bids" }, { label: bid.title }]} />`.
- Navigation lives in `src/components/app/app-nav.tsx` (`sections`): the sidebar from 1024 px, a four-item bottom tab bar below.
  Leave 7 rem of bottom padding free on phones (the shell already does) and do not add fixed elements at the bottom edge.
- Do not add a `loading.tsx` above a page that must answer 403.

### 8.4 Decisions that extend this document

- **Form-control boundary** darker than `--line-strong` (§3.1).
- **Amber text** uses `--accent-ink` (§3.1).
- **Card and dialog titles**: UI headings in Inter; the serif is kept for page, section and sub-section headings.
- **Mobile navigation**: bottom tab bar plus an account sheet that rises from the bottom edge (workspace switcher, plan, sign out).
- **Dialogs on phones** are bottom sheets; menus and select items are 40 px tall on touch screens.
- **Auth pages**: form on the left, a brand panel with a short value statement on the right from 1024 px; one column below.
- **Product visuals on marketing pages** are HTML and CSS with fictional sample data, exposed to assistive technology as one
  described image each (`role="img"`), so nothing inside is focusable.
- **Placeholders** in legal copy (`[[LIKE_THIS]]`) are rendered highlighted; `docs/legal/TODO.md` lists them.
- **Print**: chrome marked `data-print="hide"` (and the shell's own slots) is hidden; legal pages print link targets.
