# Design verification record — 2026-11-13

What was checked on the design-system branch after the designer's artboards
(`docs/design/handoff/`) became the visual source of truth, how to repeat it, and the result.
All checks ran against a production build (`next build && next start`) with the seeded demo
workspace.

## How to repeat

```
pnpm build && pnpm exec next start -p 3121        # production server
pnpm db:seed                                      # demo owner and member (local database only)
node scripts/design/contrast.mjs --write          # colour contrast → docs/design/CONTRAST.md
node scripts/design/screenshots.mjs               # every owned page at 360 / 768 / 1280 → docs/design/screens/
python3 scripts/design/optimise-screens.py        # shrink the captures before committing them
node scripts/design/keyboard.mjs                  # focus order, focus ring, composite widgets
```

On this machine Playwright is preinstalled: set
`PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright/index.mjs` for the two browser scripts.

## Results

| Check | Result |
|---|---|
| `pnpm typecheck` | Pass |
| `pnpm lint` | Pass |
| `pnpm test` (unit, real Postgres) | 170 of 170 pass |
| `pnpm e2e` (production build) | 17 of 17 pass |
| `pnpm build` | Pass; every public and legal page, `/styleguide` and `/maintenance` are statically prerendered |
| Colour contrast | 49 of 49 text, marker and boundary pairs meet WCAG 2.2 AA (4.5:1 text, 3:1 non-text). Six pairs that must not be used are listed with their ratios in `CONTRAST.md` |
| Horizontal scroll | None on any of the 89 captures, including every page at 360 px |
| Keyboard | Landing, pricing, sign-up and the app shell (1280 and 360 px): the first Tab stop is the skip link and it leads into `<main>`; every stop has the 2 px focus ring and an accessible name; the company search submits to `/find?q=…` with Enter; the billing-interval group follows the arrow keys; the public menu and the app's phone menu trap focus and return it on Escape; the account menu opens with Enter, moves with the arrows and closes with Escape, returning focus |
| Print | Legal pages print as documents: header, footer navigation and the contents rail are hidden |

## Compared with the artboards

The landing page was captured at the artboards' own widths (1440 and 390 px) and laid side by
side with `handoff/render/Landing-1440.png` and `Landing-390.png`, slice by slice. Layout, type
sizes, colours and spacing match to within a few pixels. The differences are deliberate:

| Where | Artboard | Build | Why |
|---|---|---|---|
| Data source | "Find a Tender and Contracts Finder" | Find a Tender only | Handoff correction |
| Plans | Radar Pro £49, `[n]` placeholders | Free, Radar Pro £29, Bid Desk £149, Bid Desk Plus £349 from the catalogue; Bid Pass £99 as a full-width panel under the cards | Handoff correction (SPEC §5) |
| First deliverable | "bid brief" | "cited bid check" | Handoff correction |
| Step 3 picture | "Likely score: 3 of 5" | "Marked 3 of 5 against the buyer's scheme" | Handoff correction: not a forecast |
| After the plans | — | "Straight answers" band | Required trust block; built from the artboards' point-under-a-rule |
| Questions | 6, two with placeholders | 8, with real answers | Placeholders resolved from `site.ts`; two questions kept from the earlier page |
| Footer | 3 links a column, placeholder line | Our real pages; attribution, independence and Paddle lines; the registered-company placeholder | The site has more legal pages than the artboard |
| Hero, 1024–1279 px | Columns wrap | Columns narrow | A 976 px wide preview card is too large |
| Steps, 768–1023 px | 2 + 1 columns | Rows: picture left, words right | No orphaned third card |

The app shell was compared with `Brief-1440`, `Editor-1440`, `Brief-390` and `Editor-390`: a white
60 px bar with the 22 px lockup, Radar / Bids / Documents (2 px ink rule under the current one),
the workspace name and a 34 px initials disc; 56 px on phones with the disc and the three-line
button. The requirement row, status pills, reference chip, deadline marker, filter chips, tabs
and table on `/styleguide#bid` were built from the same artboards' inline styles.

## Captures

`docs/design/screens/<page>-<width>.png`, full page, at 360, 768 and 1280 px:

landing, pricing, pricing-annual, free-bid-check, contact, legal-terms, legal-privacy,
legal-refunds, legal-dpa, legal-acceptable-use, sign-up, sign-up-errors, sign-in, verify-email,
forgot-password, reset-password, reset-password-invalid, accept-invitation-invalid, not-found,
maintenance, styleguide, app-home, app-settings-profile, app-settings-workspace,
app-settings-members, app-settings-billing, app-usage, app-forbidden, app-account-menu (the
account menu open); plus the open phone menus at 360 px: landing-mobile-menu, app-mobile-menu.

## What the review rounds changed

1. The company search field was 16rem tall on phones (a flex basis meant for the row layout
   applied to the column): the basis now applies from 640 px only.
2. The three step pictures had unequal heights, so the step numbers did not line up: one
   minimum height for all three.
3. The open-data strip wrapped to three lines on desks: the two statements now share a row.
4. A long placeholder was cut off in the search field on phones: 14 px placeholder below 640 px.
5. The page header's actions could not wrap and widened the page by 65 px at 360 px.
6. Plan cards kept desk-only minimum heights inside the app's two-column layout; a usage value
   wrapped mid-phrase ("0% / used"); the role select sat 2 px above its neighbour.
7. The phone hero used the long lead: it now uses the shorter one of the 390 px artboard, and
   the supplier preview and plan cards take the artboard's tighter phone rhythm.
8. Sign-up with errors left the title against the header rule on desks: the column keeps 48 px.

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
