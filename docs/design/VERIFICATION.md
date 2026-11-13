# Design verification record — 2026-11-13

What was checked on the design-system branch, how to repeat it, and the result. All checks ran
against a production build (`next build && next start`) with the seeded demo workspace.

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
| `pnpm e2e` (production build) | 17 of 17 pass (16 from the foundation + 1 added for the single-seat Free plan) |
| `pnpm build` | Pass; every marketing and legal page, `/styleguide` and `/maintenance` are statically prerendered |
| Colour contrast | 46 of 46 text, icon and boundary pairs meet WCAG 2.2 AA (4.5:1 text, 3:1 non-text). Six pairs that must not be used are listed with their ratios in `CONTRAST.md` |
| Horizontal scroll | None on any of the 88 captures, including every page at 360 px |
| Keyboard | Landing, pricing, sign-up and the app shell (1280 and 360 px): the first Tab stop is the skip link and it leads into `<main>`; every stop has the 2 px focus ring and an accessible name; the billing-interval group follows the arrow keys; the marketing menu traps focus and returns it on Escape; the account menu and the phone account sheet open with Enter and close with Escape, returning focus |
| Line length | Median characters per line, measured in the browser at 1280 px: legal pages 65–68, landing leads 57, pricing leads and FAQ answers 66 |
| Print | Legal pages print as documents: site header, footer navigation and the contents rail are hidden |

## Captures

`docs/design/screens/<page>-<width>.png`, full page, at 360, 768 and 1280 px:

landing, pricing, pricing-annual, free-bid-check, contact, legal-terms, legal-privacy,
legal-refunds, legal-dpa, legal-acceptable-use, sign-up, sign-up-errors, sign-in, verify-email,
forgot-password, reset-password, reset-password-invalid, accept-invitation-invalid, not-found,
maintenance, styleguide, app-home, app-settings-profile, app-settings-workspace,
app-settings-members, app-settings-billing, app-usage, app-forbidden; plus the open phone
menus at 360 and 768 px: landing-mobile-menu, app-mobile-account.

Below 1024 px the app's bottom tab bar is fixed, so those captures are taken with the viewport
stretched to the page height (the bar then sits at the bottom, as it does on a phone).

## What the review rounds changed

1. Key dates and scored-question cards wrapped badly at narrow widths: dates and flags now sit on
   their own line, counts never wrap.
2. The three radar close-ups had unequal heights, so their headings started on different lines:
   they now share rows (subgrid) from 1024 px, become visual-and-text rows on tablets and stack
   on phones.
3. The answer-editor visual left dead space beside the evaluator panel: the draft now fills the
   column, and the third paragraph is dropped on phones.
4. The comparison table scrolled sideways on phones: replaced there by a plan picker and a list.
5. Screen-reader-only text inside the comparison table widened the page by 321 px at 360 px;
   long `[[PLACEHOLDER]]` tokens overflowed on the legal pages; the radar grid overflowed by
   11 px at 768 px. All fixed.
6. The reading column was `68ch`, which is about 85 characters of Inter: now 35rem (65–68).
7. `read-only:` styling matched every select and file input (they are `:read-only` in CSS):
   limited to inputs with the `readonly` attribute.
8. The footer link columns were one long list on phones: now two columns.
9. Hand-built radio groups (billing interval, plan picker) gained arrow keys and a roving tab index.

## Not covered

- Screen-reader testing with real assistive technology (only roles, names and focus were checked).
- Safari and Firefox (captures and keyboard checks are Chromium).
- The routes owned by other modules: `/find`, `/sample-check`, `/optout`, `/about-the-data`,
  `/app/bids`, `/app/library` and the Radar content of `/app` are linked to but not built here.
