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
