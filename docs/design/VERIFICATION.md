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
