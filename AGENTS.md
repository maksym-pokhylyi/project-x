<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules (SaaS foundation)

Read `README.md` first ("Server API you build on", "How to add things"). Non-negotiables:

- **Tenancy**: get the workspace from `requireOrg()` / `requireOrgForPage()` in `src/server/session.ts`; never accept an organization id from the client. Tenant tables carry `organization_id`; data-access functions take the `OrgContext`.
- **Mutations** go through Server Actions wrapped in `runAction()` or Route Handlers wrapped in `route()` (`src/server/http.ts`), validate input with zod (`parseInput`) and check the role on the server.
- **Limits**: enforce plan limits with `consumeQuota()`; gate features with `ctx.entitlements.features`. Plans live only in `src/config/plans.ts`.
- **Side effects**: e-mail via `sendEmail()`, background work via `enqueueJob()`, analytics via `track()` (events declared in `src/config/events.ts`), AI only via `generateAiText()`.
- **Errors**: throw `AppError` subclasses for expected failures; never `console.*` (use `log`).
- **Schema changes**: edit `src/db/schema/app.ts`, run `pnpm db:generate`, commit the SQL. Do not hand-edit `src/db/schema/auth.ts`.
- **UI goes through the design system** (owner's rule): every reusable pattern is a component in `src/components/ui/` (shown in `/styleguide`, described in `docs/design/DESIGN.md`), and feature code composes those components — it does not restyle controls, navigation or states locally. If a screen needs something the library lacks, add or extend the component first, then use it; a fix to a pattern is made once, in the component. In particular: a control that navigates is a `ButtonLink`, one that acts is a `Button`; "where you are" is marked only by `NavLink`; a value with a copy button is a `CopyField`; a field and the button beside it share one height (44 / 48 / 52 px); everything clickable shows the pointer cursor. Class recipes that server components need live in modules without `"use client"` (`tab-classes.ts`, `nav-link-variants.ts`). Guards: `tests/nav-guard.test.ts` and the design checks in `docs/design/VERIFICATION.md`.
- Before finishing: `pnpm typecheck && pnpm lint && pnpm test`, **and `pnpm build`** (type-checking does not catch server/client boundary mistakes), and `pnpm e2e` for flow changes.
