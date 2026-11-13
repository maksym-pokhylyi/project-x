# Design verification record — 2026-11-13 (second design batch)

What was checked on the design-system branch after the second and third batches of artboards
(`docs/design/handoff/`), how to repeat it, and the result. All browser checks ran against a
production build (`next build && next start`) with the seeded demo workspace.

## How to repeat

```
pnpm build && pnpm exec next start -p 3121        # production server
pnpm db:migrate && pnpm db:seed                   # demo owner and member (local database only)
pnpm ui:audit                                     # bypasses of the component library, per file
node scripts/design/contrast.mjs --write          # colour contrast → docs/design/CONTRAST.md
node scripts/design/controls.mjs                  # control sizes, pointer cursor, "where you are", where a scroll stops
node scripts/design/keyboard.mjs                  # focus order, focus ring, composite widgets
node scripts/design/screenshots.mjs               # every owned page at 360 / 768 / 1280 → docs/design/screens/
node scripts/design/emails.mjs                    # the e-mails at 640 / 390, light and dark → docs/design/screens/
python3 scripts/design/optimise-screens.py        # shrink the captures before committing them
```

On this machine Playwright is preinstalled: set
`PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.mjs` for the browser scripts.
The browser scripts sign in as the demo owner once per run and reuse the session (sign-in is
limited to about ten attempts per address in ten minutes: if a run stops at the sign-in page,
wait, or clear `rate_limits` in the LOCAL database).

## The control guard (`scripts/design/controls.mjs`)

It opens each page at 390 and 1280 px and fails, naming the page, the width and the element, when
one of the first three rules is broken; the fourth is checked as journeys.

1. **Control sizes.** A field or a button is not 44, 48 or 52 px tall; a field and a button on
   its line differ in height; a form's submit button is not as tall as the form's fields.
   Allowed exceptions are listed in the script with their reasons: a text link that is a
   button (`variant="link"`), tick boxes / switches / radios, tabs and navigation links,
   controls set inside a line of text (`SourceMark`, a linked `ReferenceChip`, `TooltipText`),
   disclosure headings, multi-line fields, the toast library's buttons, and a button whose
   label wraps (taller than the scale, never shorter).
2. **Pointer.** A visible, enabled link, button, summary, select, label of a control, or
   element with the role of a button, tab, menu item, option, switch, tick box or radio does
   not show `cursor: pointer`. The account menu, the workspace menu, the phone menu, selects
   and menus in the page are opened in turn so that their items are checked too.
3. **Where you are.** A navigation that contains the page you are on (not counting links to a
   section of the same page) does not mark exactly one item with `aria-current="page"`, or
   that item has the colour and the weight of a sibling. A tab list does not have exactly one
   selected tab that is semibold, darker than the others and has its 2 px rule.

4. **Where a scroll stops.** Journeys through the public site at 390 × 720 and 1280 × 720,
   with smooth scrolling on (the faults do not show with reduced motion): from the top of the
   landing page and from its questions, "Pricing", "Sign in" and "Find your company" open
   their pages at scroll position 0, and so does the logo from `/pricing`; "How it works"
   from `/pricing` stops with the section 0 to 24 px under the header and its heading on
   screen; Back returns to where `/pricing` was left and Forward to the section; from a
   section, the logo goes to the very top; "Questions" and the Bid Pass link on `/pricing`
   glide to their sections (through the menu sheet on phones); focus on a control in the
   sticky header does not move the page; a control that takes focus above the screen comes
   out from behind the header; and from the bottom of one Settings page another opens at its
   top and stays there when its content replaces the skeleton.

Point it at more pages: `node scripts/design/controls.mjs /find auth:/app/bids` (a path with
`auth:` is opened as the demo owner); `--only` checks just those (and leaves the journeys
out); `WIDTHS=390` and `RULES=sizes,pointer,nav` narrow it down; `RULES=scroll` runs the
journeys alone.

Key pages: `/`, `/pricing`, `/free-bid-check`, `/contact`, `/legal/terms`, `/sign-in`,
`/sign-up`, `/forgot-password`, a 404, `/styleguide`, Settings (profile, workspace, members),
Billing, Billing with the confirm panel open, Usage.

## Results

| Check | Result |
|---|---|
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass (0 errors; 29 warnings, all "a link inside `<Button asChild>`" in feature areas that are converted in the consolidation round) |
| `pnpm test` (unit, real Postgres) | 1078 pass, 1 skipped (1079 in 82 files) |
| `pnpm build` | Pass |
| `pnpm e2e` (production build) | 23 of 23 pass (the 27 tests of the other configs are skipped under this one) |
| Procurement e2e (`playwright.procurement.config.ts`) | 6 of 6 pass |
| Bid desk e2e (`playwright.bids.config.ts`) | 2 of 2 pass |
| Scheduled e-mails e2e (`playwright.notifications.config.ts`) | 5 of 5 pass |
| Outreach e2e (`playwright.outreach.config.ts`) | 14 of 14 pass |
| `pnpm ui:audit` | No bypass left in the design system's own files (public site, auth, settings, billing, shell, admin overview, e-mail). Totals pinned in `tests/ui-smells.baseline.json`: 29 `Button asChild` links, 5 call-site heights, 0 magic offsets, 1 off-scale font size, 10 inline styles, 187 pre-system tokens — all in the radar, bids, library, notifications and outreach areas — and one hex colour, the browser theme colour in `app/layout.tsx`, which must be a literal |
| Control guard | Pass on the 16 key pages at 390 and 1280 px, and on the scroll journeys at both widths. Also run on `/app`, `/app/bids`, `/app/bids/new`, `/app/library`, `/find`, `/about-the-data`, `/admin`, `/admin/organizations` (pass) and on `/sample-check` (fails: its source chips are local buttons of 16–40 px; they become `ReferenceChip` in the consolidation round) |
| Colour contrast | 60 of 60 text, marker and boundary pairs meet WCAG 2.2 AA (4.5:1 text, 3:1 non-text), including the dark palette of the e-mails. Six pairs that must not be used are listed with their ratios in `CONTRAST.md` |
| Horizontal scroll | None on any of the 119 page captures, including every page at 360 px; none in the e-mails at 390 px |
| Keyboard | Landing, pricing, sign-up and the app shell (1280 and 360 px): the first Tab stop is the skip link and it leads into `<main>`; every stop has the 2 px focus ring and an accessible name; the company search submits to `/find?q=…` with Enter; Monthly / Annual are two buttons in a labelled group that say whether they are pressed, and the prices follow; a question toggles with Enter; the public menu and the app's phone menu trap focus and return it on Escape; the account menu opens with Enter, moves with the arrows and closes with Escape; the Billing confirm panel takes focus, keeps it, and Escape returns to the plain Billing address |
| E-mail | The four transactional messages and the bid-check message render the artboards' frame at 640 and 390 px in light and dark; no element under 13 px; nothing is fetched on opening (no images, no web fonts); the plain-text part is written by hand and its first address is the action link (`tests/email-templates.test.ts`) |
| Print | Legal pages print as documents: header, footer navigation and the contents rail are hidden |

## Compared with the artboards

Method: each artboard's own static HTML and the build are rendered at the artboard's width with
the SAME font files, and every text run is compared for position, size, weight, line-height and
colour (a "DOM diff"); then both are laid side by side slice by slice. "Matches" below means no
difference in the matched runs beyond the listed, deliberate ones.

| Screen | 1440 | 390 | Differences that remain, and why |
|---|---|---|---|
| Pricing (`/pricing`) | Matches | Matches | The Bid Desk card has one more line, "14-day trial, one full bid included", and the questions one more, about the trial (decisions); so everything below sits 20–30 px lower. Footer: our real link set and the identity line with the real operator. Phone buttons are 48 px with 16 px labels (Foundations) where the board drew 46 px / 15 px. The current page in the header is semibold with its rule (NavLink rule). Signed in, the buttons change (current plan, hand-off) |
| Landing (`/`) | Matches | Matches | The same plan-card and footer differences. The sample supplier page's stat row has 16 px on both sides of each divider (the owner's defect report; the board had none on the first tile's right), its first label is shortened to stay on one line, and numeral and label are 2 px apart as on the Supplier and Claim boards |
| Sign in (`/sign-in`) | Matches | Matches | None in position. Two 14 px links have a 20 px line where the board has 21 px (centred in 44 px boxes: not visible) |
| Sign up (`/sign-up`) | Matches | Matches | No "Email me the weekly digest" tick box: nothing stores that choice yet, and a control that does nothing is not shown. In its place the password field has its hint ("At least 8 characters."). The Free list says "Weekly digest", as on the Pricing board, where this board says "A weekly digest". Coming from a paid plan the column shows that plan and its price |
| Billing (`/app/settings/billing`) | Matches | Matches | Heading "Your allowance · renews {date}" (decision) where the board says "This month · November 2026". The Bid Pass sentence adds "It does not expire while your account is open." Pause / cancel buttons, the card on file and the receipts table appear when the billing backend passes them in; until then each card says in a sentence where that thing is. The test-mode band shows only in a sandbox environment |
| Billing confirm panel | — | — | Not on a board: built from the coordinator's wording with the dialog, toggle and button primitives |
| After checkout, plan (`/app/settings/billing/success`) | Matches | Matches | The trial strip sits above it while the workspace is in trial. "First payment" reads "£149 + VAT on 27 Nov 2026" and "Included" adds "The trial includes 1 full bid." (decisions). The receipts row names the billing address only when Paddle has reported one |
| After checkout, Bid Pass (`…/success?bought=bid_pass`) | Matches | Matches | No "Paid" row: the date of the purchase is not reported to this page yet. The confirmed state appears when the workspace holds an unused pass; the waiting and "taking longer than usual" states are built from the same parts |
| 404 (`not-found`) | Matches | Matches | The identity line carries the real operator |
| App shell on Free (Radar boards) | Matches | Matches | The workspace name has a chevron (it is the switcher). Current section: ink, semibold and its rule; the others muted (NavLink rule) |
| Trial strip (TrialStrip boards) | Matches | Matches | The words are the decided ones ("Trial · 14 days left · 1 full bid included · First payment £149 + VAT on 27 Nov 2026 · Manage": the amount is ex-VAT and says so); on phones they take one line more than the board's shorter sentence, broken between the two facts and never inside the date |
| E-mail: confirm your email (EmailConfirm) | Matches at 640 | Matches | Our sentence does not name a company (the sign-up does not always come from a claim). "This link works for 24 hours." The serif falls back to the reader's own where Source Serif is not installed: e-mail loads no fonts |
| E-mail: bid check ready (EmailCheckReady) | Matches at 640 | Matches | One more muted line: the AI-assistance notice of the bid desk |

Not compared here because they belong to the feature areas: Radar content, Bids, Brief, Editor,
Documents, Supplier, Tender, Find, Claim (the claim page uses the new `StatRow`; its layout is
the procurement area's).

## Captures

`docs/design/screens/<page>-<width>.png`, full page, at 360, 768 and 1280 px:

landing, pricing, pricing-annual, pricing-signed-in, free-bid-check, contact, legal-terms,
legal-privacy, legal-refunds, legal-dpa, legal-acceptable-use, sign-up, sign-up-plan,
sign-up-errors, sign-in, verify-email, forgot-password, reset-password, reset-password-invalid,
accept-invitation-invalid, not-found, maintenance, styleguide, app-home,
app-settings-profile, app-settings-workspace, app-settings-members, app-settings-billing,
app-billing-confirm-plan, app-billing-confirm-pass, app-checkout-plan,
app-checkout-pass-waiting, app-usage, app-not-found, app-forbidden, app-account-menu,
admin-overview, admin-organizations, admin-ingestion; plus the open phone menus at 360 px:
landing-mobile-menu, app-mobile-menu.

`docs/design/screens/email-<message>-<width>[-dark].png` at 640 and 390 px: verify-email,
reset-password, invitation, account-exists, brief-ready.

## What this round's review changed

## Not covered

- Screen-reader testing with real assistive technology (only roles, names and focus were checked).
- Safari and Firefox (captures and keyboard checks are Chromium).
- The routes owned by other modules: `/find`, `/sample-check`, `/optout`, `/about-the-data`,
  `/app/bids`, `/app/library`, the supplier page, the bid brief, the answer editor and the Radar
  content of `/app` are linked to but not built here. Their shared pieces (status pill,
  reference chip, deadline marker, filter chips, score bars, tabs, table) are on `/styleguide`.

---

# Public data pages and Radar — 2026-11-13

What was checked after the supplier page, Find, Claim, the tender and buyer pages, "Flag a
mistake", "About the data" and the signed-in Radar were rebuilt to the artboards in
`docs/design/handoff/`, on real data. The pictures were taken on a local database of notices
ingested from Find a Tender (real companies, buyers and tenders); the journeys run on a seeded
database of fictional ones.

## How to repeat

```
# Journeys, states, keyboard and widths on the seeded database (production build):
E2E_PORT=3162 E2E_DATABASE_URL=postgres://app:app@localhost:5432/<e2e database> \
  pnpm exec playwright test -c playwright.procurement.config.ts --trace off
#   PROCUREMENT_SHOTS_DIR=/tmp/shots …      also saves a picture of each main screen

# Every screen and state on a database of ingested notices, at 390 / 768 / 1440:
BASE_URL=http://localhost:3161 ACCOUNT_RADAR=… ACCOUNT_CAP=… ACCOUNT_EMPTY=… ACCOUNT_NEW=… \
  node scripts/design/data-screens.mjs      # → docs/design/screens/data/, reports overflow and console errors
WIDTHS=360 OUT_DIR=/tmp/shots node scripts/design/data-screens.mjs     # the narrowest phone
python3 scripts/design/optimise-screens.py docs/design/screens/data
```

`scripts/design/data-screens.mjs` lists every state with its address; the records it opens
(which supplier, tender, buyer) and the four local accounts are named at its top.

## Results

| Check | Result |
|---|---|
| `pnpm typecheck`, `pnpm lint` | Pass |
| `pnpm test` (unit and integration, real Postgres) | 1,084 pass in 81 files; one outreach test skips itself |
| `pnpm build` | Pass |
| Procurement journeys (`playwright.procurement.config.ts`, production build) | 6 of 6 pass |
| `pnpm e2e` (foundation journeys; the sign-up form and the Radar start are shared with them) | 22 of 22 pass (the other configurations' tests skip themselves) |
| Scheduled e-mails and outreach journeys (`playwright.notifications.config.ts`, `playwright.outreach.config.ts`) | 5 of 5 and 14 of 14 pass: they claim a company through the rebuilt claim page, open the tender page from a digest (`digest_clicked`), count visits by `?r=` and reach "Flag a mistake" from the opt-out page without JavaScript |
| axe-core 4.14, WCAG 2.2 A and AA | No violation on 23 screens at 390 and 1440 px (46 loads). One finding outside this module on every signed-in page: the app bar's account button has an accessible name that does not contain its visible initials |
| UI guards (`tests/ui-guard`, `tests/nav-guard`) and the smell ratchet | Pass. No procurement file is left in the guards' exception lists; `pnpm ui:audit` finds nothing in `src/features/procurement`, `src/app/(data)` or the Radar routes |
| Horizontal scroll | None in any of the 40 states listed under "Captures", at 360, 390, 768 and 1440 px; no console error and no failed response in any of them |
| Field-and-button rows | One height in every row at 390 and 1280 px (`expectAlignedControls` on Find, manual set-up, Claim, Radar, the edit page and Flag a mistake) |
| Keyboard | Find → Claim → Radar walked with the keyboard in the journey test: the search field has focus on arrival and Enter submits it; Tab reaches "This is my company" and Enter opens the claim page; Space ticks "I am authorised…", Tab and Enter confirm; on the Radar the first Tab stop is the skip link, Save toggles with Space; after Dismiss the focus is on Undo, after Undo on the row's title; Escape closes the edit panel and returns the focus to "Edit". The focus ring is checked at each of these stops |
| Without JavaScript | The supplier page and the no-result page are pixel-identical with script off (the captures are byte-for-byte the same). Find is a GET form; tender, buyer, claim and "Show all N contracts" are plain links. Tick boxes and radio buttons need script (see "Not covered") |

## Compared with the artboards, screen by screen

Each screen was captured at the artboards' widths (390 and 1440 px) and laid beside
`handoff/render/<Board>-390.png` and `<Board>-1440.png`, slice by slice; 768 px was read on
its own. Layout, type, colour and spacing follow the boards; the differences below are
deliberate.

**On every screen**

| Where | Artboard | Build | Why |
|---|---|---|---|
| Deadline text | Amber (`#925207`) beside the amber dot | Ink beside the amber dot | The shared `DeadlineMarker` (DESIGN.md, colour rule 1: small deadlines are written in ink). If the owner prefers the boards, it is one class in that component — `accent-ink` passes AA at this size |
| Headings | Literal sizes (Radar and tender titles 40 px) | The type scale's roles: `type-title` 36 px for those two, `type-h3` for card and band headings | One scale for the product |
| Tabs | Every tab in ink, a rule under the current one | Current tab ink, semibold, 2 px rule; the others muted | REPLY-3 and the shared tab rule |
| Form controls | 48 px (44 px buttons in the edit panel) | 48 px on desks, 52 px on phones; a button always has its field's height | The control-size rule |
| Header of Find, Claim, About the data | The site's header | The site's header as the foundation builds it (its own links and button) | Shared, not part of this module |
| App bar | Company name, "Free plan", "See plans" | The app shell's bar (workspace menu); breadcrumbs "Radar / Tender" on desks and "‹ Radar" on phones | The shell belongs to the foundation |

**A. Supplier page** (`Supplier-390`, `Supplier-1440`) — matches both boards.

| Where | Artboard | Build | Why |
|---|---|---|---|
| Row of anchors | "Open tenders" drawn as current | No current state | They jump within one page; "where you are" belongs to navigation between pages (`NavLink`) |
| Under three open tenders | "Show 1 more, closing 18 Dec 2026" | "11 more open tenders like these. Claim this page to see them all" | A visitor sees three items a block; the rest is what claiming opens |
| Rival contract, last fact | "no extension left", "one extension available" | "no extension stated" or "can be extended to 31 Mar 2028" | Notices give an end date and, sometimes, the latest date with extensions — not how many options remain |
| Buyers in your trade | "the last three years" | "the last two years" | The window the query uses |
| "to small firms" | A percentage | A percentage from five sized contracts up; "3 of 3" below that; "Not stated" with none | Computed from the size each winning supplier declares in the award notice — never shown without them |
| Money in the four tiles | — | Shortened below £1m as well ("£76k") | One line at 390 px |
| Under the name, phones | Town, number | Town and Companies House number; region and size join from 768 px | As the 390 px board |
| Contract wins | "Show all 14 contracts" | Six rows (four on a phone), then "Show all N contracts": fifty a page, as plain links | Suppliers with 100+ contracts |

Left out because the data does not support it: nothing drawn was dropped; the two facts above
(extension options, small-firm share for thin data) are worded to what the notices say.

**B. Find your company, no result, manual set-up** (`Find-*`, `FindNoResult-*`) — matches.

| Where | Artboard | Build | Why |
|---|---|---|---|
| Under the count | — | "Closest name first, then most public contracts." | Says how the list is ordered |
| Trades | A short list | 14 broad trades, then "More trades": a search over CPV names | Brief |
| Regions | Counties, "Show all UK regions" | The 12 UK regions | What notices and the matcher use |
| "Work email" | — | A line under the field: the confirmation link goes there | The radar opens only once the address is confirmed |

Signed out, "Set up my radar" stores nothing: the choices travel in the address
(`/sign-up?redirect=/app/radar/setup?…`), come back after the e-mail is confirmed, and the page
opens filled in with one button. A GET never creates a radar.

**C. Claim** (`Claim-*`, `ClaimSignedIn-*`) — matches.

| Where | Artboard | Build | Why |
|---|---|---|---|
| Account form | Three fields and the tick | The product's own sign-up form with other labels, plus its password hint, "Already have an account?" and the Terms line | One sign-up, with its validation, errors and "check your inbox" |
| Field errors | "email" | "e-mail" in the validation messages | Shared validators |
| Not drawn | — | "This company is already on your radar", "Your plan includes 1 radar", a merged company (redirect to the surviving page) | States of the same card |

The link between workspace and company is created only by the Server Action behind "Confirm
and open my radar", with the tick checked on the server.

**D. Radar** (`Radar-*`, `RadarEnding-*`, `RadarBuyers-*`, `RadarSignals-*`, `RadarEmpty-*`, `RadarEdit-*`) — matches.

| Where | Artboard | Build | Why |
|---|---|---|---|
| Tabs | Four | A fifth, "Saved", once something is saved; the strip's "N saved tenders" leads to it | Saved tenders need a list of their own |
| Filters | Category, Region, Value, Closing within | "Category" only when the matches span more than one | A menu with one choice is noise |
| Edit trades and regions | A panel docked beside the list | A side sheet over the list from 768 px (focus trapped, Escape returns to "Edit"); a page of its own on a phone, as drawn | A docked panel leaves the list too narrow below 1440 px |
| Regions in the form | Counties | The 12 UK regions | As in Find |
| Ending soon, "Extension option" | Counts of options | "None stated" or "Can be extended to …" | As on the supplier page |
| Buyers | "three years" | Two years; "share won by small firms" as on the supplier page | The query's window; honest for thin data |
| Free plan | 10 rows, band, two locked rows, "Matches 13 and 14 are waiting too." | The same; a locked row gives its rank, place and closing date and nothing else — no title, buyer, value or link | As drawn |
| Wider matches | — | "Show wider matches (n)" on paid plans, each marked "Wider match"; on Free they are counted in the band | Match tiers |

**E. First run** (`RadarFirstRun-*`) — matches.

| Where | Artboard | Build | Why |
|---|---|---|---|
| Next to "Three things to do first" | — | "Hide this guide" | The guide stays until it is hidden (stored for the workspace) |
| Address of the page | `bidfolio.co.uk/s/aldermoor-pike` | `bidfolio.co.uk/suppliers/<slug>` | The address that exists |
| The three cards | — | A card says "Done" once its step is: trades and regions saved, a document in the library, a bid check started | Real state |

**F. Tender page** (`Tender-*`, `TenderSignedIn-*`) **and buyer page** — match.

| Where | Artboard | Build | Why |
|---|---|---|---|
| "Start a bid check" | Always | Only while the tender is open: not when it is closed, cancelled or gives no deadline | Nothing to bid for; the official notice link is always there |
| Lots | A count | The count, the first lots by name, "and N more in the official notice" | 63 lots do not fit a card |
| "Who won similar work from this buyer" | A table | The table when award notices from this buyer in these categories exist; nothing otherwise | Never invented |
| "Why this matches you" | A reason and its facts a row | The same, from the notices: the contracts won from this buyer, the shared categories, the region. A wider match says so in its own row | — |
| Buyer page | Not drawn | Built from the same parts as the supplier page | — |

**G. Flag a mistake** (`FlagMistake-*`) **and About the data** — match.

| Where | Artboard | Build | Why |
|---|---|---|---|
| "Page" | A field | The address as text when the visitor came from a page; a field otherwise | A long address is cut off in a field |
| "Which contract or detail?" on phones | Two lines | One line | The shared `Textarea` starts at 96 px (asked of the designer in REPLY-3) |
| After sending | — | "Thanks — we have your request", what happens next, "Back to the page" | The state the form ends in |

## States

| State | Where it is covered |
|---|---|
| Loading | Skeletons of the Radar and of the tender page at their final sizes (`radar-loading`, `tender-loading`) |
| Empty | Radar with no match, each tab with nothing, no company yet ("Start with your company"), filters that leave nothing, a supplier with no open tender / no rival / no buyer |
| Error | Form errors beside their fields with the answers kept (sign-up, claim, manual set-up, edit, flag a mistake). A page that fails to load falls to the app's shared error page with "Try again" (`src/app/error.tsx`): there is no Radar-specific error screen |
| Long names | Company names in capitals over two lines, tender titles over four lines on a phone, a buyer's name wrapping in a card, nine regions in one chip ("North East, North West and 7 more") |
| Value | "Value not published" in rows, cards and the tender page; "—, value not published" as a tile |
| Deadline | Today ("Today"), passed ("Closed", grey), unknown ("No deadline published") |
| Lots | None ("Not divided into lots"), two, 63 |
| Contracts | One ("Your contract win"), 48 on real data, 120 in the journey test (three pages of fifty) |
| Plan | Free: ten matches, the band, two locked rows. Paid: every match and "Show wider matches" — checked in tests with a paid plan's entitlements, because the plan catalogue does not define `radar.full` yet |
| More than one radar | The row of sources above "Matching on" (`radar-two-sources`) |
| Visitor or member | Supplier page ("Is this your company?" / "This page is on your radar"), tender page (sign-up links / Save and bid check), claim (account form / one tick and one button) |

## Captures

`docs/design/screens/data/<state>-<width>.png`, full page, at 390, 768 and 1440 px:

supplier, supplier-one-contract, supplier-many-contracts, supplier-all-contracts,
supplier-claimed, find-start, find, find-no-result, find-in-app, claim, claim-signed-in,
claim-already-claimed, claim-plan-limit, tender, tender-signed-in,
tender-no-value-closes-today, tender-closed, tender-no-deadline, tender-63-lots,
tender-loading, buyer, flag-a-mistake, flag-a-mistake-errors, flag-a-mistake-sent,
about-the-data, radar-start, radar-first-run, radar, radar-dismissed-undo, radar-filtered,
radar-filtered-empty, radar-ending, radar-buyers, radar-signals, radar-saved, radar-edit (the
panel over the screen from 768 px), radar-free-cap, radar-two-sources, radar-empty,
radar-loading.

The companies, buyers and tenders in them are real published notices; the people and addresses
("Gill Baker", `…@example.test`) are local test accounts.

## What the review rounds changed

1. A visually hidden label inside a scrolling row of chips widened the supplier page by 6 px
   on phones: the row is now the label's containing block.
2. Rows lost their hairlines on desks (a child's `border-0` beat the list's `divide-y`): the
   line belongs to the row.
3. The first-run row of buttons was 10 px wider than a 360 px card: the main button may shrink.
4. "Edit" did not get the focus back when the panel closed with Escape: the sheet remembers
   what opened it.
5. "1 Sept 2026" → "1 Sep 2026"; a town stored as "Cambridge," lost its comma.
6. A long place name ran into the date in a locked row: the chip is cut with an ellipsis and
   keeps the full text as its title.
7. Undo after dismissing a saved tender brought it back unsaved: the saved state is noted when
   the row is dismissed.
8. A page number past the end of "Show all N contracts" showed an empty table: it shows the
   last page.
9. "Flag a mistake" counted forms that came back with errors against its five requests an
   hour: only requests that pass validation count.
10. The "More trades" placeholder was cut off at 390 px: shorter words.
11. A line of reason chips that runs off a phone card could not be scrolled with the keyboard
    (axe: scrollable-region-focusable): the row is a Tab stop while it overflows, and only then.
12. Links other modules wrote to the old request form (`/about-the-data?page=…#request`) go on
    to "Flag a mistake" with the page filled in.

## Not covered

- Safari and Firefox; screen readers (roles, names, focus order and focus return were checked,
  not speech).
- The paid Radar in a browser: until the plan catalogue defines `radar.full` and
  `radar.profiles`, every workspace gets the Free radar. The paid view is covered by tests that
  give a workspace those entitlements.
- Tick boxes and radio buttons without JavaScript: the component library's are script-driven
  (and the UI guard forbids raw inputs outside it), so manual set-up, the claim tick and "Flag
  a mistake" need script. Everything a visitor reads, the search and every link work without.
- A supplier with more than 100 contracts on real data: the largest in the local data set has
  48; the journey test seeds 120.
1. The sample supplier page on the landing page: the first stat's label ran into the divider
   at laptop widths. Stat rows are one component now and every tile keeps 16 px on both sides.
2. A Search button was taller than its field: fields and buttons take their height from one
   variable set by the group around them, and the guard checks every page.
3. The current tab was told apart by a line alone: `NavLink` and `Tabs` give it colour, weight
   and rule, and the guard checks that the current item differs from its siblings.
4. Options, labels and menu items showed the text cursor: one base rule gives every clickable
   element the pointer, and the guard checks it with menus open.
5. The action link of the bid-check e-mail had lost its underline inside the mail library's
   button: actions are the frame's own link now.
6. The 8-figure admin summary wrapped 5 + 3 with a broken rule: stat tiles are boxed at their
   right and bottom, and the summary is 4 + 4.
7. On Free, "upgrade" links led to Billing, which no longer has a plan grid: they lead to
   Pricing, the one place where plans are compared.
8. Bid Desk plans gave an unlimited number of stand-alone checks in the catalogue (`null`):
   the check comes with each full bid, so the allowance is 0, which is what the bids module
   and its tests expect.
9. "Pricing" from the top of the landing page opened `/pricing` at "Compare the plans" (owner
   report). Smooth scrolling was also applied to the router's own scroll to a new page, whose
   steps then overtook one another; and the page's scroll padding made every page top count
   as hidden. Now: `<html data-scroll-behavior="smooth">` (route changes jump, in-page links
   still glide); the sticky bar is allowed for by a scroll margin on what is scrolled to, not
   by padding of the page; `<ScrollToTop />` takes a new page to its very top where the
   router leaves it a few pixels down (sign-in on a laptop, a Settings page behind its
   skeleton). Found on the way and fixed with it: on phones a section link chosen in the menu
   slid back to where the menu had been opened (focus returning to the menu button scrolled
   the page); Tab into the sticky header moved the page half a screen; Back from a section
   link did not return to the place that was left.
10. Amounts that will be taken say so with their VAT ("First payment £149 + VAT on …"): the
    trial strip, Billing and the checkout confirmation.
