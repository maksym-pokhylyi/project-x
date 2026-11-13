# Bidfolio — B2B SaaS foundation

A product-agnostic base for a paid B2B SaaS, built to be operated by one person:
authentication, workspaces with roles and invitations, Paddle billing with plan
entitlements and metered quotas, transactional e-mail, background jobs, analytics,
an AI wrapper with budgets, a founder admin, legal pages, and tests for every critical
path. Product features go on top (suggested location: `src/features/*`).

- [Architecture](#architecture) · [Directory map](#directory-map) · [Local setup](#local-setup-from-zero)
- [Environment variables](#environment-variables) · [Server API you build on](#server-api-you-build-on)
- [How billing works](#how-billing-works-end-to-end) · [How to add things](#how-to-add-things)
- [Deployment](#deployment-vercel--neon) · [Backups](#backup-and-restore-neon) · [Runbook](#operations-runbook)
- [Decisions and deviations](#decisions-and-deviations)

## Stack

| Area | Choice | Version |
| --- | --- | --- |
| Framework | Next.js App Router (Node.js runtime), React, TypeScript strict | next 16.4.6, react 19.3.1, typescript 6.0.3 |
| UI | Tailwind CSS v4, shadcn/ui components (in `src/components/ui`), lucide-react | tailwindcss 4.3.5 |
| Database | PostgreSQL 16 (Neon in production), Drizzle ORM, postgres.js | drizzle-orm 0.45.4, drizzle-kit 0.31.11, postgres 4.1.1 |
| Auth | Better Auth + organization plugin | better-auth 1.7.22 |
| Billing | Paddle Billing | @paddle/paddle-node-sdk 3.12.0, @paddle/paddle-js 1.6.6 |
| E-mail | Resend + React Email | resend 6.38.0, @react-email/components 1.0.12 |
| AI | Vercel AI SDK via AI Gateway | ai 7.0.172 |
| Storage | Vercel Blob (private) or local disk | @vercel/blob 2.9.0 |
| Analytics | internal `events` table, optional PostHog | posthog-js 1.448.0, posthog-node 5.73.0 |
| Validation | zod | 4.6.7 |
| Tests | Vitest (real Postgres), Playwright | vitest 5.1.0, @playwright/test 1.63.0 |

## Architecture

```
                         Browser
                            │
             ┌──────────────┴───────────────┐
             │   Vercel (Next.js, Node.js)  │
             │                              │
  proxy.ts ──┤  optimistic "has cookie?"    │        redirect to /sign-in
             │                              │
  Pages ─────┤  Server Components           │
  Actions ───┤  src/server/actions/*        │──┐
  Routes ────┤  src/app/api/*               │  │   every entry point starts with
             │                              │  ├── requireUser() / requireOrg()   (src/server/session.ts)
             │  src/server/*  data access   │◄─┘   -> OrgContext { user, organization, role,
             │  (takes OrgContext, filters  │                       subscription, entitlements }
             │   by ctx.organization.id)    │
             │                              │
             │  src/lib/*  building blocks  │
             │   auth · billing · quota ·   │
             │   email · jobs · rate-limit ·│
             │   storage · ai · analytics   │
             └───┬───────────┬──────────┬───┘
                 │           │          │
          PostgreSQL      Paddle     Resend · Vercel Blob · AI Gateway · PostHog · Sentry
       (single source   (checkout,     (all optional: the app runs without any of them)
          of truth)      webhooks)
                 ▲
                 │  Vercel Cron -> GET /api/cron/jobs (Bearer CRON_SECRET) -> job worker
```

Principles

- **Postgres is the only stateful dependency.** Sessions, jobs, rate limits, analytics,
  the e-mail outbox and the webhook log all live there. No Redis, no queue service.
- **Tenancy comes from the session, never from input.** `requireOrg()` returns the
  active workspace; data-access functions in `src/server` take that context and filter on
  `organization_id`. Every tenant-owned table carries `organization_id`.
- **Paid access is granted only by signed webhooks.** The browser's "payment succeeded"
  is never trusted; the success page polls our database. WHICH workspace a payment belongs
  to is decided by checkout data signed by this server, never by what the browser sent.
- **Expected failures are typed** (`AppError` in `src/lib/errors.ts`) and returned to the
  UI; unexpected ones go to `error_log` (+ Sentry) with a request id.
- **Everything optional degrades gracefully**: no Resend → dev outbox; no Paddle →
  "billing not configured"; no Blob token → local disk; no PostHog/Sentry → no-ops.
- **Degrading never means less secure.** A deployment that cannot deliver e-mail does not
  skip verification — it disables sign-up and password reset. Sandbox billing does not sell
  plans on production. The two explicit opt-outs (`ALLOW_UNVERIFIED_SIGNUP`,
  `ALLOW_SANDBOX_BILLING`) are logged loudly at start-up and shown on `/admin`.
- **Errors are sanitised before they are written anywhere** (`describeError`): SQL text and
  SQLSTATE, never bound values, model output or tokens.

Rendering model: marketing and legal pages are static; everything under `/app` and
`/admin` is rendered per request.

## Directory map

```
drizzle/                 SQL migrations (generated by drizzle-kit, committed)
e2e/                     Playwright journey against a production build
scripts/                 migrate.mjs (+ migrate-policy.mjs), seed.ts, paddle-setup.ts, simulate-webhook.ts, erase.ts,
                         paddle-pull-events.ts, paddle-verify-sandbox.ts, billing-purge-sandbox.ts
tests/                   Vitest suites (real Postgres) + Paddle payload fixtures
src/
  env.ts                 server env validation (zod) + `features` flags
  env.public.ts          the few NEXT_PUBLIC_* values the browser may read
  proxy.ts               optimistic signed-out redirect for /app and /admin; CSP nonce for dynamic pages
  instrumentation.ts     onRequestError -> error_log (+ Sentry)
  instrumentation-client.ts   optional PostHog page views
  config/
    site.ts              product name, domain, support e-mail, company/legal details  <- rename here
    retention.ts         how long each operational table keeps its rows
    ai.ts                model aliases, price table, AI budget policy
    plans.ts             plan catalogue: prices, limits, feature flags, quota metrics
    landing.ts           all copy of the placeholder landing page
    onboarding.ts        onboarding checklist steps
    events.ts            analytics event catalogue (typed)
  db/
    schema/auth.ts       Better Auth tables (GENERATED: pnpm auth:schema)
    schema/app.ts        subscriptions, webhook_events, billing_checkout_nonces, billing_payments,
                         billing_purchases, usage_counters,
                         events, error_log, email_outbox, jobs, rate_limits, ai_usage, audit_log
    index.ts             postgres.js pool + Drizzle instance
  lib/
    auth.ts / auth-client.ts        Better Auth server config / browser client
    billing/                        entitlements, quota, prices, paddle client, checkout signature,
                                    webhook signature + processing, reconcile, paddle-catalogue,
                                    manage (pause/resume/cancel), one-off + fulfilment (Bid Pass),
                                    receipts, overview, trial, pull-events, environment
    email/                          render (React Email), send (outbox + job), deliver (Resend)
    jobs/                           queue, handlers, worker
    analytics.ts  audit.ts  ai.ts  storage.ts  rate-limit.ts  maintenance.ts
    logger.ts  errors.ts  describe-error.ts  report-error.ts  sentry.ts  background.ts
    validation.ts  redirects.ts  crypto.ts  config-warnings.ts
    signup-binding.ts  auth-guard.ts          sign-up binding cookie; rate limits in front of /api/auth
  server/
    session.ts           requireUser / requireOrg / role checks (+ page variants)
    http.ts              route() and runAction() wrappers (uniform error handling)
    members.ts usage.ts onboarding.ts audit.ts admin.ts workspaces.ts   data access
    tenant-data.ts       workspace export, workspace deletion, account deletion
    actions/             Server Actions: workspace, members, profile, billing, billing-manage, admin, auth, account
  app/
    (marketing)/         /, /pricing, /contact, /legal/{terms,privacy,refunds,dpa}, /pay (Paddle's default payment link)
    (auth)/              /sign-in, /sign-up, /verify-email (+ /confirm), /forgot-password, /reset-password
    accept-invitation/[id]/
    app/                 authenticated shell: Home, Usage, Settings (Profile, Workspace, Members, Billing)
    admin/               founder dashboard + per-organisation drill-down
    dev/outbox/          development mailbox (404 unless dev tools are enabled)
    api/                 auth, webhooks/paddle, cron/jobs, health, files, workspace/logo,
                         workspace/export, billing/status, billing/receipts/[transactionId]
  components/            ui/ (shadcn), marketing/, auth/, app/, billing/, admin/, forms/
  emails/                React Email templates
```

## Local setup from zero

Prerequisites: Node.js ≥ 22.15, pnpm 10, PostgreSQL 16 (local install or Docker).

```bash
# 1. Dependencies
pnpm install

# 2. PostgreSQL — pick ONE
#    a) Docker (creates role app/app and databases app_dev, app_test, app_e2e)
docker compose up -d
#    b) Local PostgreSQL 16 on Debian/Ubuntu (what this repo was built against)
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE ROLE app LOGIN PASSWORD 'app' CREATEDB" \
  -c "CREATE DATABASE app_dev OWNER app" \
  -c "CREATE DATABASE app_test OWNER app" \
  -c "CREATE DATABASE app_e2e OWNER app"
#       (as root without sudo:  su postgres -c "psql -c \"...\"")

# 3. Environment
cp .env.example .env.local
#    then set BETTER_AUTH_SECRET:   openssl rand -base64 32
#    optionally ADMIN_EMAILS=demo@example.com to open /admin with the seeded user

# 4. Schema + demo data
pnpm db:migrate
pnpm db:seed          # demo@example.com / demo-password-123 (workspace on the Pro plan)

# 5. Run
pnpm dev              # http://localhost:3000
```

Without `RESEND_API_KEY`, e-mails are stored instead of sent: open
<http://localhost:3000/dev/outbox> to click verification, reset and invitation links.
(Under `pnpm dev` that page is open. A production build — `pnpm build && pnpm start` —
has no dev outbox unless `DEV_TOOLS=1`, and then it needs a founder session or
`/dev/outbox?key=<DEV_TOOLS_SECRET>`; without either, sign-up is disabled because nobody
could receive the verification link.)

### Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js dev server / production build / production server |
| `pnpm typecheck` | `next typegen` + `tsc --noEmit` |
| `pnpm lint` | ESLint (Next.js + TypeScript rules, `no-console` outside the logger) |
| `pnpm test` | Vitest against database `app_test` (rebuilt from migrations each run; override with `TEST_DATABASE_URL`) |
| `pnpm e2e` | Builds, starts `next start` on :3210 with database `app_e2e`, runs Playwright (`E2E_SKIP_BUILD=1` reuses `.next`) |
| `pnpm db:generate` | Create a SQL migration from schema changes (`drizzle-kit generate`) |
| `pnpm db:migrate` | Apply committed migrations (non-interactive, idempotent). On Vercel it runs for production deployments only |
| `pnpm db:seed` | Demo data for local development (refuses non-localhost databases) |
| `pnpm paddle:setup [--dry-run]` | Create/update Paddle products and prices from `src/config/plans.ts`, print env lines |
| `pnpm ui:audit` | Lists every place that bypasses the component library (the totals are pinned by `tests/ui-smells.test.ts` and may only go down) |
| `pnpm paddle:simulate <orgId> [plan] [interval] [status]` | Send a signed fake subscription webhook to the local app |
| `pnpm paddle:pull-events [--since 2h \| --after evt_…] [--watch]` | Local billing without webhooks: feed the sandbox's recent events through the webhook pipeline (refuses on production) |
| `pnpm paddle:verify-sandbox [--write]` | Check against the real sandbox API what the billing code assumes about Paddle (read-only without `--write`) |
| `pnpm billing:purge-sandbox [--yes]` | Remove every billing row that came from the Paddle sandbox (dry run without `--yes`); the step before going live |
| `pnpm auth:schema` | Regenerate `src/db/schema/auth.ts` after changing Better Auth plugins |
| `pnpm erase account <id\|e-mail> [--yes]` · `pnpm erase workspace <id> [--yes]` | Erasure on someone's behalf (dry run without `--yes`); see the runbook |
| `pnpm notifications:preview <workspace-id> [--kind …]` | Render a scheduled e-mail for a workspace to HTML and text files; see *Scheduled e-mails* |

Playwright uses the Chromium in `PLAYWRIGHT_BROWSERS_PATH` (defaults to `/opt/pw-browsers`
on the build machine). Elsewhere run `pnpm exec playwright install chromium` once.

## Environment variables

Validated by `src/env.ts`; documented in detail in `.env.example`. "Prod" = needed for a
real production deployment.

| Name | Required | Where to get it | Used for |
| --- | --- | --- | --- |
| `DATABASE_URL` | **yes** | Neon → Connection string (**pooled**) | All database access |
| `DATABASE_URL_UNPOOLED` | no | Neon → direct connection string | `pnpm db:migrate` (preferred for DDL) |
| `BETTER_AUTH_SECRET` | **yes** | `openssl rand -base64 32` | Signing session cookies, file URLs, the sign-up binding and known-device cookies, and (unless `BILLING_SIGNING_SECRET` is set) checkout data |
| `NEXT_PUBLIC_APP_URL` | prod | Your canonical URL, e.g. `https://bidfolio.co.uk` | Auth callbacks, e-mail links, metadata, CSRF origin check |
| `ADMIN_EMAILS` | prod | Your own e-mail(s), comma-separated | Access to `/admin` (address must be verified) |
| `ADMIN_USER_IDS` | prod (after first sign-in) | `select id from users where email = '<you>';` | Pins `/admin` to these user ids in addition to the verified `ADMIN_EMAILS` address |
| `CRON_SECRET` | prod | `openssl rand -hex 24` | Authenticates Vercel Cron on `/api/cron/jobs`. Without it no jobs, retention or reconciliation run (reported on `/admin`) |
| `RESEND_API_KEY` | prod | resend.com → API keys | Sending e-mail. **Without it (and `EMAIL_FROM`) a production build disables sign-up, password reset and invitations** |
| `EMAIL_FROM` | prod | Address on a domain verified in Resend | Sender of all e-mails. Required together with the key on production (no fallback sender there) |
| `ALLOW_UNVERIFIED_SIGNUP` | **never in production with real users** | — | `1` = where e-mail cannot be delivered, accept sign-ups with NO verification (pre-launch testing). Loud warning at start-up and on `/admin`; ignored once e-mail works |
| `PADDLE_ENV` | prod | `sandbox` or `production` | Which Paddle environment the SDK and Paddle.js talk to. **`sandbox` on the production deployment switches billing off** unless `ALLOW_SANDBOX_BILLING=1` |
| `ALLOW_SANDBOX_BILLING` | **never in production with real users** | — | `1` = allow Paddle sandbox on the production deployment (test cards buy real plans). Shows "Test mode — no real payments" on billing screens; warning on `/admin` |
| `BILLING_SIGNING_SECRET` | no | `openssl rand -base64 32` | Signs checkout custom data. Default: a key derived from `BETTER_AUTH_SECRET` (set this to rotate the two independently) |
| `PADDLE_API_KEY` | prod | Paddle → Developer tools → Authentication | Customer portal, plan changes, `paddle:setup` |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | prod | Paddle → Authentication → Client-side tokens | Overlay checkout |
| `PADDLE_WEBHOOK_SECRET` | prod | Paddle → Notifications → destination secret | Verifying webhooks |
| `PADDLE_PRICE_{STARTER,PRO,BUSINESS}_{MONTHLY,ANNUAL}` | prod | Printed by `pnpm paddle:setup` | Mapping plans ↔ Paddle prices |
| `PADDLE_PRICE_PRO_{MONTHLY,ANNUAL}_NOTRIAL` | no | The same Bid Desk prices created WITHOUT a trial period | Checkout price for a workspace that has had a subscription before (a trial is offered once). Unset = the normal price |
| `PADDLE_PRICE_BID_PASS` | prod if the Bid Pass is sold | A one-time price (no billing cycle) in Paddle | The one-off Bid Pass. Without it the pass cannot be bought |
| `BILLING_PAST_DUE_GRACE_DAYS` | no (7) | — | Days of paid access after a failed renewal |
| `BILLING_PERIOD_END_GRACE_DAYS` | no (3) | — | Fail-safe: days after the paid period's end before an `active` subscription stops granting its plan when no renewal reached us |
| `PADDLE_WEBHOOK_TOLERANCE_SECONDS` | no (300) | — | Max age of a webhook signature |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Google Cloud console → OAuth client | "Continue with Google" (shown only when both are set) |
| `BLOB_READ_WRITE_TOKEN` | prod if uploads are used | Vercel → Storage → Blob (private store) | File storage (logos, product files) |
| `AI_GATEWAY_API_KEY` | no | Vercel → AI Gateway (not needed on Vercel: OIDC) | AI calls from local machines |
| `AI_DAILY_BUDGET_USD` | no (10) | — | Global daily ceiling for estimated AI spend (hard limit; `0` disables AI) |
| `AI_FREE_DAILY_BUDGET_USD` | no (25 % of the above) | — | Daily pool shared by ALL free-plan workspaces, so they cannot use up the global budget |
| `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | no | PostHog project settings | Page views + forwarding of server events |
| `SENTRY_DSN` | no | Sentry project → Client keys | Forwarding server errors |
| `LOG_LEVEL` | no (info) | — | Log verbosity |
| `DEV_TOOLS` | no | — | `1` enables `/dev/outbox` on a production build (e2e). Ignored on Vercel production. The page then needs a founder session or the key below |
| `DEV_TOOLS_SECRET` | no | `openssl rand -hex 16` | Opens `/dev/outbox?key=<secret>` on a production build with `DEV_TOOLS=1` |
| `TRUST_PROXY_HEADERS` | no | — | `1` = trust `X-Forwarded-For` when NOT on Vercel (self-hosting behind a proxy that overwrites it). On Vercel the platform's headers are always used; otherwise all clients share one rate-limit bucket |
| `SKIP_DB_MIGRATE` | no | — | `1` makes `pnpm db:migrate` a no-op |
| `NOTIFICATIONS_PAUSED` | no | — | `1` = no scheduled e-mail leaves (digests, alerts, reminders); transactional e-mail is unaffected. See *Scheduled e-mails* |
| `MIGRATE_PREVIEW_DATABASE` | no | — | `1` lets a Vercel **Preview** build run migrations — only for a Preview environment with its own database (Neon branch). Without it, only production builds migrate |

`src/env.ts` also exports `features` (which integrations are live, incl. `signUpEnabled`,
`passwordResetEnabled`, `billingTestMode`, `mailDelivery`) and `appUrl`.

**Production values to set** (Vercel → Production scope): `DATABASE_URL`,
`DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAILS`,
`ADMIN_USER_IDS` (after your first sign-in), `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`,
`PADDLE_ENV=production` with the live `PADDLE_API_KEY`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`,
`PADDLE_WEBHOOK_SECRET` and `PADDLE_PRICE_*`, `BLOB_READ_WRITE_TOKEN`. Leave
`ALLOW_UNVERIFIED_SIGNUP`, `ALLOW_SANDBOX_BILLING`, `DEV_TOOLS` and
`MIGRATE_PREVIEW_DATABASE` **unset** in Production. `/admin` lists anything that is missing
or unsafe.

## Server API you build on

Import paths are stable; build product features against these.

```ts
// Session, tenancy, roles ------------------------------------------- src/server/session.ts
requireUser(): Promise<CurrentUser>                       // throws UnauthorizedError (401)
requireOrg(opts?: { role?: Role; write?: boolean }): Promise<OrgContext>   // 401 / ForbiddenError (403)
                                                          // write: true -> 402 while the workspace is over its seat limit
assertWorkspaceWritable(ctx): void                        // same check for an existing ctx
requireAdmin(): Promise<CurrentUser>                      // founder (ADMIN_EMAILS)
assertRole(ctx, minimum: Role): void
getUser(): Promise<CurrentUser | null>
requireUserForPage(returnTo?) / requireOrgForPage({ role?, returnTo? }) / requireAdminForPage()
                                                          // pages: redirect to /sign-in, or render 403
type OrgContext = { user, sessionId, organization, role, subscription, entitlements, plan,
                    seats: { used, limit, overLimit } }
hasRole(role, minimum), type Role = "owner" | "admin" | "member"   // src/server/workspaces.ts

// Route handlers and Server Actions ---------------------------------- src/server/http.ts
route(handler, opts?: { csrf?: boolean })                 // AppError -> status + JSON, else 500 + error_log;
                                                          // non-GET requests must come from our own origin (403)
runAction(name, body): Promise<ActionResult<T>>           // { ok: true, data } | { ok: false, error }
json(body, init?)

// Entitlements and quotas ------------------------------------------- src/lib/billing/*
getOrgEntitlements(organizationId): Promise<Entitlements>             // subscription.ts
resolveEntitlements(subscription, { graceDays, now? }): Entitlements  // entitlements.ts (pure)
consumeQuota(organizationId, metric, n?): Promise<QuotaResult>        // quota.ts (atomic)
refundQuota(organizationId, metric, n?) · getUsage(organizationId, metric)

// Billing: what the Billing page and product modules call ------------ src/lib/billing/*
getBillingOverview(ctx): Promise<BillingOverview>                     // overview.ts — everything the Billing page shows; no Paddle call
listReceipts(organizationId, limit = 24): Promise<Receipt[]>          // receipts.ts — completed payments, newest first
pauseSubscription(organizationId) · resumeSubscription(…) · cancelSubscription(…) · undoScheduledChange(…): Promise<ManageResult>
                                                                      // manage.ts — throw BillingManageError (details.reason)
decideManageAction(action, subscription): ManageDecision              // manage.ts (pure): what an action would do, or why not
planChangeBlocker(subscription): string | null                        // paddle.ts (pure): why the plan cannot be changed now
isTrialEligible(organizationId) · selectCheckoutPrice(plan, interval, { trialEligible })   // trial.ts
ONE_OFF_PRODUCTS · getOneOffPriceId(kind) · oneOffFromPriceId(priceId)                      // one-off.ts
fulfilPurchase(tx, purchase) · revokePurchase(tx, purchase)           // fulfilment.ts — the seam to product modules (Bid Pass)
// Server Actions (src/server/actions/billing-manage.ts): pauseSubscriptionAction() · resumeSubscriptionAction() ·
//   cancelSubscriptionAction() · undoScheduledChangeAction() · startOneOffCheckoutAction({ kind: "bid_pass" })
// GET /api/billing/receipts/<transaction id>  -> 302 to Paddle's invoice PDF (owner/admin of that workspace)

// Background jobs ---------------------------------------------------- src/lib/jobs/*
enqueueJob(type, payload, { runAfter?, dedupeKey?, maxAttempts? }, tx?): Promise<string | null>   // queue.ts
kickWorker(): void · runWorker({ maxJobs?, timeBudgetMs? })                                      // worker.ts
jobHandlers                                                                                      // handlers.ts

// Everything else ----------------------------------------------------
track(name, { organizationId?, userId? }, properties)     // src/lib/analytics.ts  (typed by config/events.ts)
recordAudit({ organizationId, actor, action, target?, metadata? }, tx?)   // src/lib/audit.ts
sendEmail(to, { name, props }): Promise<string>           // src/lib/email/send.ts
storage.put / get / delete / signedUrl / list / deletePrefix, orgFileKey(orgId, ...parts)   // src/lib/storage.ts
generateAiText({ organizationId, userId?, feature, model?, instructions?, prompt, maxOutputTokens? })
AiBudgetExceededError, AiInputTooLargeError, assertAiBudget(organizationId)   // src/lib/ai.ts
                                                          // budgets are HARD limits: every call reserves its worst case first
rateLimit(key, { limit, windowSeconds }) · enforceRateLimit(key, rule) · peekRateLimit(key, rule) · clientIp(headers)   // src/lib/rate-limit.ts
reportError(error, context?)                              // src/lib/report-error.ts
describeError(error) · errorReason(error) · scrubText(s)  // src/lib/describe-error.ts — the ONLY way to turn an error into text
registerTenantDataHandler({ name, onExport?, onDelete? }) // src/server/tenant-data.ts — data outside the database
log.info / warn / error / child                           // src/lib/logger.ts
AppError, ValidationError, ForbiddenError, NotFoundError, QuotaExceededError, …   // src/lib/errors.ts
parseInput(schema, input)                                 // src/lib/validation.ts
db, pg, type Tx, type DbOrTx                              // src/db/index.ts
```

A typical tenant-scoped feature:

```ts
// src/features/widgets/data.ts
export async function listWidgets(ctx: OrgContext) {
  return db.select().from(widgets).where(eq(widgets.organizationId, ctx.organization.id));
}

// src/features/widgets/actions.ts
"use server";
export async function createWidgetAction(input: unknown) {
  return runAction("widget.create", async () => {
    const ctx = await requireOrg({ role: "admin", write: true }); // who + which workspace (+ not over its seat limit)
    const data = parseInput(widgetSchema, input);                // never trust input
    const quota = await consumeQuota(ctx.organization.id, "units");
    if (!quota.ok) throw new QuotaExceededError("units", quota.limit, quota.used);
    const [row] = await db.insert(widgets).values({ ...data, organizationId: ctx.organization.id }).returning();
    await recordAudit({ organizationId: ctx.organization.id, actor: { type: "user", id: ctx.user.id }, action: "widget.created", target: `widget:${row.id}` });
    await track("widget.created", { organizationId: ctx.organization.id, userId: ctx.user.id }, {});
    return row;
  });
}
```

Roles: **owner** — everything incl. billing; **admin** — members, invitations, workspace
settings; **member** — use the product, read members and usage.

Rules for feature code that follow from the security review:

- **Never log or store `error.message`.** Use `reportError(error)` for unexpected errors and
  `errorReason(error)` / `describeError(error)` when you need text (a `last_error` column, a
  log field). Raw driver errors contain every bound value; AI SDK errors contain model output.
- **Pass `write: true` to `requireOrg`** in actions that create or change product data, so a
  workspace that is over its seat limit after a downgrade is read-only.
- **Tenant tables carry `organization_id`** with `references organizations(id) on delete
  cascade`. Export and deletion find them through the database catalogue; nothing to register.
- **AI calls only through `generateAiText`**, with a realistic `maxOutputTokens`: the worst
  case of every call is reserved against the budgets before the provider is contacted.

## How billing works end-to-end

Paddle is the merchant of record. Our database mirrors only what is needed to decide
access (`subscriptions` table, one row per workspace).

```
1. Owner clicks "Upgrade to Pro" (Settings → Billing)
2. startCheckoutAction()            requireOrg({role:"owner"}) → returns priceId, customer e-mail and
                                    customData { organization_id, user_id, issued_at, nonce, sig }
                                    — SIGNED by the server (HMAC) for the session's workspace and user
3. Paddle.js overlay checkout       payment happens on Paddle (the browser opens it, so everything it
                                    passes along is untrusted until the signature is verified)
4. Paddle → POST /api/webhooks/paddle   (subscription.created, .activated, transaction.completed, …)
     a. verify Paddle-Signature against the RAW body (HMAC-SHA256, PADDLE_WEBHOOK_SECRET)   → else 401
     b. INSERT into webhook_events (unique event_id)      → duplicate of a processed event: 200, no work
     c. one transaction: lock the event row, resolve the workspace (see below), ignore events older
        than subscriptions.last_event_at, upsert `subscriptions`, write audit_log (once per event)
     d. mark processed (outcome) · on failure: store the sanitised error, error_log, answer 500 → Paddle retries
5. Browser lands on /app/settings/billing/success, which POLLS /api/billing/status
   until our database says the plan is active (the redirect itself proves nothing)
6. Every request: requireOrg() → resolveEntitlements(subscription) → limits + feature flags
7. Once a day: billing.reconcile compares every open subscription with the Paddle API
   (no-op without PADDLE_API_KEY) and applies what a lost webhook would have told us
```

**Which workspace does an event belong to?** (`src/lib/billing/webhooks.ts`)

1. A subscription we already track belongs to the workspace it is bound to. Custom data
   cannot move it and its Paddle customer cannot be swapped (`ignored_conflict`).
2. A subscription we have never seen is attached **only** through checkout data carrying this
   server's signature for that workspace — and only if the signature is fresh (24 h, measured
   against the event's own timestamp), its signer is still an owner, and its nonce has not
   already attached a different subscription. Unsigned, forged, cross-workspace, expired or
   replayed data → `ignored_unverified`; no custom data at all → `ignored_unmapped`.
3. A workspace's live subscription is never replaced by another one; a subscription is never
   attached from an event when a newer event for it has already been received.
4. Never by e-mail address and never by customer id.

Entitlement rules (`src/lib/billing/entitlements.ts`):

| Subscription status | Effective plan |
| --- | --- |
| none | Free |
| `active`, `trialing` | subscribed plan (a *scheduled* cancellation or pause keeps this status until the period ends: the plan stays until then) |
| `active`, `trialing`, but `current_period_end` is more than `BILLING_PERIOD_END_GRACE_DAYS` in the past | Free (`period_lapsed`): no renewal reached us — a webhook was lost. Restored by the next event or the reconciliation job; flagged on `/admin` |
| `past_due` | subscribed plan for `BILLING_PAST_DUE_GRACE_DAYS`, then Free |
| `paused`, `canceled` | Free |
| unknown price id / status | Free (fail closed), flagged in logs and `/admin` |

Handled events: `subscription.created|activated|updated|canceled|paused|resumed|past_due|trialing`
(a scheduled pause or cancellation is mirrored in `pause_at` / `cancel_at`),
`transaction.completed|payment_failed` (audit, analytics, a receipt in `billing_payments` and the
card on file; a payment alone never grants a PLAN — a completed transaction without a
subscription is a one-off purchase, see below), `customer.created|updated` (billing contact),
`adjustment.created|updated` (refunds and chargebacks: the receipt is marked, a one-off purchase is
revoked when fully refunded; approved ones are surfaced under "Recent errors" — for a
subscription Paddle leaves the status unchanged, so cancel it in Paddle if access should end).
Everything else is stored and acknowledged as `ignored_unhandled`.

Outcomes worth knowing (visible in `/admin` → "Webhooks needing attention"):
`ignored_unverified` (custom data named a workspace but was not validly signed for it —
someone tampered with a checkout, or a subscription was created by hand), `ignored_unmapped`
(no workspace could be determined at all) and `ignored_conflict` (a second live subscription
for a workspace that already has one — the customer may be paying twice — or an event that
contradicts the stored binding).

Self-service: "Manage billing" (`openBillingPortalAction`) works only for a subscription
bound through a verified event. It opens Paddle's customer portal **only when the Paddle
customer's e-mail is the caller's own verified address** (Paddle would let the owner of that
mailbox in anyway); otherwise it offers the subscription's own update-payment/cancel links,
which reveal nothing about the customer. Plan changes for existing subscribers go through
the Paddle API (`changePlanAction`, prorated immediately); the local row changes only when
the `subscription.updated` webhook arrives.

### Pause, resume, cancel

"Pause or cancel in two clicks. You keep access until the end of the period you have paid for."
Owner-only Server Actions in `src/server/actions/billing-manage.ts`, rules in
`src/lib/billing/manage.ts` (`decideManageAction`, one pure function that the actions enforce and
`getBillingOverview().manage` shows):

| Action | Subscription is… | What happens in Paddle |
| --- | --- | --- |
| `pauseSubscriptionAction` | `active` or `trialing` | pause scheduled for the END of the paid period (of the trial). Refused while past due, already paused, or while a change is already scheduled |
| `cancelSubscriptionAction` | `active` or `trialing` | cancellation scheduled for the END of the paid period (of the trial); it replaces a scheduled pause |
| | `past_due` or `paused` | cancelled IMMEDIATELY (a past-due period was not paid for; Paddle cancels a paused subscription only immediately) |
| `resumeSubscriptionAction` | a pause is scheduled | the scheduled pause is removed |
| | `paused` | resumed immediately: Paddle charges the card now and starts a new period — unless paid time is left, then that period simply continues |
| `undoScheduledChangeAction` | a pause or cancellation is scheduled | the scheduled change is removed |

- The actions do NOT write our database. Paddle answers with `subscription.updated` (and
  `.paused` / `.resumed` / `.canceled` when a change takes effect); the webhook writes
  `pause_at`, `cancel_at`, `paused_at` and the status. The plan stays until the status changes.
- Pausing a trial means: the trial runs to its end, then the subscription is paused instead of
  taking the first payment; resuming later takes it.
- Refusals are `BillingManageError`s (409; 503 when Paddle did not answer) with a sentence for the user and `details.reason`
  (`no_subscription`, `not_manageable`, `ended`, `already_paused`, `past_due`, `cancel_scheduled`,
  `pause_scheduled`, `nothing_to_resume`, `nothing_scheduled`, `paddle_refused`,
  `paddle_not_found`, `paddle_unavailable`). What Paddle itself refuses is shown with its own
  reason, sanitised.
- They do not pass `write: true`: a workspace that is read-only because it is over its seat
  limit can still pause, resume and cancel (pausing is often what put it there).

What Paddle does, verified against the real sandbox API on 2026-11-13
(`pnpm paddle:verify-sandbox --write`; the events it emitted are replayed in
`tests/billing-manage.test.ts` from `tests/fixtures/paddle/sandbox-*-lifecycle.json`):

- A scheduled pause or cancellation leaves the status as it is (`active` / `trialing`), sets
  `scheduled_change = { action, effective_at = end of the billing period }` and `next_billed_at`
  to null; `subscription.updated` is sent. `scheduled_change: null` removes it again.
- A cancellation REPLACES a scheduled pause (one call). A pause while a cancellation — or
  another pause — is scheduled is refused: `subscription_locked_pending_changes`.
- A subscription in TRIAL accepts both, scheduled for the end of the trial. It starts with
  `subscription.trialing`, and `subscription.created` is NOT guaranteed beside it: one run
  recorded only `subscription.trialing` (nothing more appeared in the event stream later),
  the next run both, with the same timestamp. So the webhook attaches a new subscription from
  ANY `subscription.*` event that carries valid signed checkout data and never waits for
  `subscription.created`.
- A paused subscription refuses a cancellation at period end (`bad_request`) and another
  pause (`subscription_not_active`); resuming a subscription that is not paused is refused
  (`subscription_must_be_paused`). An unknown subscription id answers 404 `invalid_url`.
- Every change of status arrives twice with the same timestamp and the same payload
  (`subscription.paused` + `subscription.updated`, `subscription.canceled` +
  `subscription.updated`, `subscription.activated` + `subscription.created` — only `created`
  carries a `transaction_id` on top), in an order that differed between runs. The handler
  applies both, in either order or at once, and tracks the change once.
- A plan change (`items` + `prorated_immediately`) is REFUSED during a trial:
  `subscription_trialing_items_update_invalid_options`.

**Changing plan** (`changePlanAction`) is prorated immediately by Paddle in both directions.
It is not possible during a trial (Paddle refuses it, see above) or while a pause or
cancellation is scheduled: `planChangeBlocker()` in `src/lib/billing/paddle.ts` gives the
sentence, `getBillingOverview().planChange` shows it.
Upgrade: "You pay the difference for the rest of your current billing period." Downgrade (and
any change that leaves a balance in the customer's favour): "Your plan changes straight away.
The unused part of what you have already paid is kept as credit and taken off your next
payments." The credit sits on the customer's balance in Paddle and is applied automatically; it
is not paid back to the card. (Paddle applies a change of items at once in every proration
mode — "at the next period" would need scheduling of our own — and `prorated_immediately` is the
only prorated mode it allows when the billing interval changes.) After a downgrade the
workspace may be over its seat limit and read-only until members are removed.

### One-off purchases (Bid Pass)

A one-off product is a Paddle price without a billing cycle (`ONE_OFF_PRODUCTS` in
`src/lib/billing/one-off.ts`, price id in `PADDLE_PRICE_BID_PASS`). It can be bought on any
plan, including Free.

```
1. startOneOffCheckoutAction({ kind: "bid_pass" })   owners and admins; returns priceId, customerEmail,
                                                     paddle { environment, clientToken } and customData
                                                     SIGNED for the workspace and the buyer
2. Paddle.js overlay checkout                        opened exactly like a plan checkout
3. Paddle → transaction.completed (no subscription)  recorded ONLY with valid signed checkout data: workspace
                                                     exists, signature valid, signed within 24 h of the event's
                                                     own timestamp, signer still a member of the workspace
     billing_purchases  (unique on the transaction id: a duplicate, a replay or a second event never grants twice)
     billing_payments   (the receipt)
     fulfilPurchase(tx, purchase)   in the SAME transaction — src/lib/billing/fulfilment.ts
```

- Fulfilment is a small switch on the product kind. For the Bid Pass it grants one pass per unit
  through the bids module (`grantBidPass`, external reference `paddle:<transaction id>:<n>`,
  source `paddle`, no expiry) and sets `fulfilled_at`.
- A FULL refund or chargeback (`adjustment.*`, approved) sets the purchase to `refunded` /
  `disputed` and takes back every unit that is still unused (`revokePurchase` → `revokeBidPass`);
  a unit that was already used stays with the customer. A PARTIAL refund never revokes. Either
  way the event is written to the audit log and shown under "Recent errors".
- A purchase is never fulfilled once its full refund has been received, whichever event is
  processed first.
- Money is never taken silently: a completed one-off transaction that cannot be recorded — no
  or invalid signed checkout data (`ignored_unverified` / `ignored_unmapped`), a price outside
  the catalogue (`ignored_unmapped`), a one-off product inside a subscription's transaction — is
  reported under "Recent errors" as well as under "Webhooks needing attention".
- A workspace that is read-only (over its seat limit) is not sold a pass it could not use.

### Receipts and the card on file

- Every completed transaction is recorded once in `billing_payments`. `listReceipts(organizationId)`
  returns them newest first — description ("Bid Desk, monthly" / "Bid Pass"), amount excluding
  tax, total, currency, status (`completed` / `refunded` / `partially_refunded` / `disputed`).
  Payments of zero (the start of a trial, a change of payment method) are recorded but are not
  receipts. Payments made before this table existed are not listed (nothing is backfilled).
- `GET /api/billing/receipts/<transaction id>` (owners and admins) redirects to Paddle's invoice
  PDF. The link is valid for about an hour and is requested on demand; a transaction that is not
  recorded for the caller's workspace answers 404 without Paddle being asked. Paddle has no
  invoice for a zero-value transaction (409).
- `subscriptions.payment_method` holds a non-sensitive summary of the newest payment's method:
  `{ type, cardBrand, last4, expiryMonth, expiryYear }` — never the cardholder name or a PayPal
  address (`src/lib/billing/payment-method.ts`). An older transaction never overwrites it.
  "Update" goes through `openBillingPortalAction` (Paddle's own page).
- `getBillingOverview(ctx)` (`src/lib/billing/overview.ts`) is everything the Billing page shows,
  from our database only: the page loads when Paddle is down.

### Trial

The 14-day trial belongs to the Bid Desk prices in Paddle (card up front, status `trialing`). It
is offered once per workspace: `isTrialEligible(organizationId)` is true only while the workspace
has never had a subscription row, and `selectCheckoutPrice(plan, interval, { trialEligible })`
returns the twin price without a trial (`PADDLE_PRICE_PRO_{MONTHLY,ANNUAL}_NOTRIAL`) for a
returning workspace — or the normal price while no twin is configured. The webhook maps both
prices of a pair to the same plan. A subscription that starts in trial arrives as
`subscription.trialing` — with or without a `subscription.created` beside it; both were seen in
the sandbox — and its first transaction is zero-value. `getBillingOverview().trial` has the days
left and the first payment. The plan cannot be changed during the trial (see "Changing plan").

"Once per workspace" is enforced by the price the server OFFERS. The checkout itself is opened
by the browser, which can ask Paddle for the price with the trial anyway, and a trial that
Paddle has started cannot be taken back from here. So the webhook reports it: when a workspace
that has had a subscription before starts one in trial although the no-trial twin is
configured, "Recent errors" shows "Workspace … started another trial …" — cancel that
subscription in Paddle, or let it run. (Without the twins nothing is reported: everybody is
offered the trial price.)

**Test mode.** Outside the production deployment billing runs against the Paddle sandbox and
every billing screen shows "Test mode — no real payments" (`features.billingTestMode`, also
`testMode` in `GET /api/billing/status`). On the production deployment sandbox credentials
switch billing OFF (checkout disabled, webhook answers 503) unless `ALLOW_SANDBOX_BILLING=1`.

Test mode never mixes with live data: every stored event, subscription, payment and purchase
records the Paddle environment it came from (`webhook_events.environment`,
`subscriptions.paddle_environment`, `billing_payments.paddle_environment`,
`billing_purchases.paddle_environment`). An event is processed or replayed only while the
deployment runs that environment, receipts list only the current environment's payments, and
`/admin` shows an error (`BILLING_ENVIRONMENT_MIX`) while rows of the other environment exist.
See "Before switching PADDLE_ENV to production" in the runbook.

### Setting up Paddle

1. Create a sandbox account; create an API key and a client-side token.
2. `PADDLE_API_KEY=… PADDLE_ENV=sandbox pnpm paddle:setup` → paste the printed
   `PADDLE_PRICE_*` lines into your env. It creates one product per paid plan with a
   monthly and an annual price, and the one-off Bid Pass, all in the catalogue currency
   (`PLAN_CURRENCY`, GBP) and **net of tax** (tax mode "external": the site says "Prices
   exclude VAT", and Paddle's default would include it); a plan with `trialDays` gets that
   trial on its prices. Run it with `--dry-run` first: prices left in another currency,
   without the trial or with another tax mode are shown as replaced (a new price is created
   and the old one archived).
3. Notifications → new destination → URL `https://<domain>/api/webhooks/paddle`, select the
   events listed above → copy its secret into `PADDLE_WEBHOOK_SECRET`.
4. Checkout → Checkout settings: set the **default payment link** to `https://<domain>/pay`
   (sandbox and live) and add the domain under "Website approval" (required for live
   checkouts). Without a default payment link Paddle refuses every transaction and checkout
   (`transaction_default_checkout_url_not_set`). Paddle sends customers to that page with
   `?_ptxn=<transaction>` — invoices, payment-method updates, its own e-mails — and the page
   (`src/app/(marketing)/pay`) loads Paddle.js, which opens the checkout for that transaction.
5. Going live: repeat with the production account, set `PADDLE_ENV=production`.
6. Before launch, confirm in the sandbox that a checkout opened with a different
   `customer.email` than the signed-in user's cannot reach another customer's portal: the
   "Manage billing" button must then show only "Update payment method" / "Cancel subscription".

Local testing without Paddle: `pnpm paddle:simulate <organizationId> pro month active`
(set `PADDLE_WEBHOOK_SECRET` and placeholder `PADDLE_PRICE_*` values in `.env.local`). The
script signs its event for the workspace's first owner, like a real checkout.

**Local end-to-end with the real sandbox, without webhooks.** Paddle cannot reach a developer
machine, but it keeps every event of the last 90 days in its event stream. With the sandbox
`PADDLE_API_KEY`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` and the sandbox `PADDLE_PRICE_*` in
`.env.local`:

```bash
pnpm dev                              # check out in the browser with a Paddle test card
pnpm paddle:pull-events --watch       # in a second terminal: pulls new events every 5 s
pnpm paddle:pull-events --since 2h    # or once: 30m, 2h, 3d, an ISO time, or --after evt_…
```

Each event goes through the same pipeline as a webhook (`ingestPaddleEvent`): stored in
`webhook_events`, de-duplicated on its id, signed checkout data verified — so the checkout
becomes a local subscription or purchase and the success page stops polling. One line per
event (type, id, outcome), never a payload; a second run reports `duplicate`. It refuses to
run when `VERCEL_ENV=production` or `PADDLE_ENV=production`.

`pnpm paddle:verify-sandbox` checks what the code assumes about Paddle against the real sandbox
API: authentication, the event stream's parameters and error shapes (read-only), and with
`--write` the pause / cancel / undo / resume calls of `manage.ts` on two throwaway invoice
subscriptions (no card needed; everything it creates is named "ZZ API verification…", and is
cancelled and archived at the end; `--reuse …` re-activates the objects of an earlier run).
It also checks that a price created with `tax_mode: external` is charged as £149.00 + VAT
(seen: £149.00 + £29.80 = £178.80 for a UK address): catalogue prices EXCLUDE VAT, so every
price must be created with that tax mode. Created without one, the same price came back as
`tax_mode: location` and the UK invoice was £124.17 + £24.83 VAT = £149.00.

## Scheduled e-mails

Module `src/features/notifications`. Everything starts from the five-minute tick of
`/api/cron/jobs`. Times are UK time (Europe/London): 07:30 stays 07:30 across the clock
changes.

| E-mail | When | To | What it says |
| --- | --- | --- | --- |
| Weekly digest | Mondays 07:30 | Members of a workspace with a radar | Strong matches that are new since the member's last e-mail (5 shown, the rest counted), rivals' contracts new to the 12-month "ending soon" window (3 shown), saved tenders closing within 14 days. On a capped plan only what the radar shows, plus one line about the rest |
| Daily alert | Working days 07:30 | The same, on plans with daily alerts (`notificationAccess()`: every paid plan until the catalogue has `radar.alerts`) | New strong matches since the last digest or alert (8 shown). On Mondays the digest stands in for it |
| Deadline reminder | Daily 08:00 | Members of the workspace | Saved tenders and bids in progress (`listBidDeadlines()`) closing in exactly 7 or 2 calendar days: one e-mail a day for all of them, each (member, tender, offset) once |
| Annual-renewal reminder | Daily 08:00 | Workspace owners | A yearly subscription renews in 6 to 8 days (active, no cancellation or pause, done or scheduled): date, price and payment method when Paddle told us, how to pause or cancel. Once per paid period |

Nothing new means no e-mail: the week is logged as `skipped_empty` and the next e-mail
starts from there. Every e-mail goes to verified addresses of current members only.

**How it runs.** Tick → `scheduleFromCron()` → one `notifications.fanout` job per kind and
period (dedupe key `notifications.fanout:<kind>:<period>`) → one `notifications.send` job
per member (dedupe key `<kind>:<workspace>:<user>:<period>`, e.g.
`digest:<org>:<user>:2026-W47`) → the `notification_log` row and the outbox row are written
in ONE transaction → `email.send`. So a tick that fires twice, a retried job or two workers
racing send one e-mail. Membership, the preference, the plan and the volume guards (200
e-mails per tick, two per member and workspace per day) are checked at send time, whatever
the fan-out believed. A slot missed for longer than its catch-up window (digest 36 h, alert
10 h, reminder 12 h) is skipped, not sent late.

**Preferences and unsubscribe.** Settings → Notifications (`/app/settings/notifications`):
per member and workspace; a missing row means everything is on. Every e-mail carries
`List-Unsubscribe` and `List-Unsubscribe-Post` (RFC 8058, `POST /api/notifications/unsubscribe`);
digests and alerts also link to `/unsubscribe?t=…`, which asks before changing anything and
works signed out and without JavaScript. The token is signed with a key derived from
`BETTER_AUTH_SECRET` and does not expire: **rotating that secret invalidates the links in
e-mails already sent** (the page then points people to Settings).

**What is measured.** `digest_sent`, `alert_sent`, `reminder_sent`,
`notification_unsubscribed`, and `digest_clicked`, which the server records when a tender
page is requested with `?d=<notification_log id>` from an e-mail. No pixel, no redirect
links; whether an e-mail was opened is never known.

**Preview.**

- `/admin/notifications` → *Send me a preview*: the e-mail a workspace would get, sent to
  your own address (to `/dev/outbox` when no mail provider is configured). The same page
  shows the last fan-out per kind and seven days of sent / nothing new / failed counts.
- `pnpm notifications:preview <workspace-id> [--kind digest|alert|reminder|renewal] [--mode auto|live|sample] [--out <dir>]`
  writes `<kind>.html` and `<kind>.txt` (default: a new temp directory). `live` is exactly
  what is new now; `sample` treats everything on the radar as new.
- Try a moment out (dev tools only: `next dev`, tests, e2e — ignored on a production
  deployment): `curl -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/jobs?now=2026-11-16T07:30:00Z"`
  runs the tick as if it were that Monday morning; the result is in `/dev/outbox`.

**Pause.** Set `NOTIFICATIONS_PAUSED=1` and redeploy: nothing is scheduled, and fan-outs
and sends already queued do nothing. `/admin` and `/admin/notifications` say so. Sign-in
links, receipts and other transactional e-mail are not affected. Remove the variable to
resume; the next e-mail covers everything since the last one that went out.

**For other modules** (`src/features/notifications/index.ts`):
`setDigestPreference(userId, organizationId, on)` for the sign-up form's tick box;
`registerDeadlineSource()` to add another source of deadlines to the reminders (saved
tenders and bids in progress are built in); `wantsNotification(userId, organizationId,
"product")` and `unsubscribeLinks()` for e-mails another module sends about something the
member asked for (the bid desk's "your bid check is ready" already uses both);
`selectDigestMatches()` is the one place e-mails choose matches (strong ones only).

**Tests.** `tests/notifications/*` run with `pnpm test`; the journey (claim → Monday tick →
digest in the outbox → click → unsubscribe → next Monday) with
`pnpm exec playwright test -c playwright.notifications.config.ts --trace off`.

## How to add things

**A plan** — `src/config/plans.ts`: add the key to `PLAN_KEYS` and an entry to `PLANS`
(TypeScript forces every limit and feature). Add the two `PADDLE_PRICE_<PLAN>_*`
variables to `src/env.ts` and `.env.example`, run `pnpm paddle:setup`, set the env vars.
Pricing page, billing page and entitlements pick it up automatically.

**A quota metric** — add it to `QUOTA_METRICS` in `src/config/plans.ts` (label, period
`month` or `lifetime`) and give every plan a limit (`null` = unlimited). Enforce it where
the metered work happens: `const r = await consumeQuota(ctx.organization.id, "metric", n)`;
on `!r.ok` throw `QuotaExceededError`. It appears in the Usage panel automatically.

**A feature flag** — add it to `PlanFeatures`/`FEATURE_LABELS` and to each plan, then gate
with `ctx.entitlements.features.<flag>` on the server.

**An AI feature** — call `generateAiText({ organizationId: ctx.organization.id, feature, … })`
with the smallest `maxOutputTokens` that works. The call reserves its worst-case cost
(input estimate + all allowed output tokens) against four ceilings before contacting the
provider — workspace month (plan), workspace day (derived from the plan), global day
(`AI_DAILY_BUDGET_USD`), and for free workspaces a shared pool — and settles to the real
cost afterwards. Handle `AiBudgetExceededError` (402/503) and `AiInputTooLargeError` (413,
split the input). Policy constants: `AI_BUDGET_POLICY` in `src/config/ai.ts`.

**A background job** — add the payload type to `JobPayloads` (`src/lib/jobs/queue.ts`)
and a handler to `jobHandlers` (`src/lib/jobs/handlers.ts`). Enqueue with
`enqueueJob("type", payload, { dedupeKey })` (pass a transaction to enqueue atomically),
then `kickWorker()` to start right after the response. Handlers must be idempotent: jobs
are delivered at least once and retried with exponential backoff (30 s, 1 m, 2 m, … max
6 h) up to `maxAttempts`, then marked `failed` and shown in `/admin`.

**An analytics event** — add one line to `EventMap` in `src/config/events.ts`, then call
`track("name", { organizationId, userId }, props)` on the server. To make it complete an
onboarding step, reference it in `src/config/onboarding.ts`.

**An e-mail** — add a component in `src/emails` built inside `<EmailLayout>` from its parts
(`EmailText`, `EmailAction`, `EmailHeading`, `EmailList` … in `src/emails/layout.tsx`) and a
plain-text function built on `emailText()` (`src/emails/text.ts`: the action link is the
first address in it), a variant in `src/lib/email/templates.tsx`, and send with
`sendEmail(to, { name, props })`. No images and no web fonts: nothing may be fetched when a
message is opened. Preview all of them with `pnpm exec tsx scripts/design/render-emails.ts`.

**A screen or a UI pattern** — compose it from `src/components/ui` as `/styleguide`
("Composing a screen") and `docs/design/DESIGN.md` §5 describe; a pattern that is missing
becomes a component there first. A control that navigates is a `ButtonLink`, one that acts a
`Button`; sizes come from the group (`<Form>`, `<ControlGroup>`), never from the call site;
"where you are" is marked only by `NavLink`. Check with `pnpm ui:audit` and
`node scripts/design/controls.mjs <your paths>` (sizes, pointer cursor, current item) against
a running production build; `docs/design/VERIFICATION.md` has the full list.

**An upgrade prompt** — link to `/pricing`, or straight to the confirm step with
`billingHandoff({ plan, interval })` / `billingHandoff({ buy: "bid_pass" })` from
`src/lib/billing/handoff.ts` (for a signed-out visitor `signUpThenBilling(…)`). Billing has
no plan grid; do not build another one.

**A table** — add it to `src/db/schema/app.ts` (tenant data: `organization_id` with a
foreign key `references organizations(id) on delete cascade`), `pnpm db:generate`, review
the SQL in `drizzle/`, `pnpm db:migrate`. Workspace export and deletion pick the table up
automatically (they read the database catalogue). If the table grows without bound, give it
a retention period in `src/config/retention.ts` and a line in `src/lib/maintenance.ts`.

**A page that must answer 403** — call `requireOrgForPage({ role })` /
`requireAdminForPage()` in the page itself and do **not** put a `loading.tsx` above it (a
streamed page has already sent `200`). Layouts and pages render in parallel, so a check
in the layout alone does not protect the page.

## Outreach tooling (founder only)

The first customers come from a small, manual e-mail test to companies that recently won a
public contract. **The app never sends these letters.** It builds the list, renders each
letter and hands over a CSV; the founder sends them from his own mailbox. Code:
`src/features/outreach` (`domain/` pure rules, `server/` data access, `components/`), pages
in `src/app/admin/outreach` and `src/app/optout`, tables in `src/db/schema/outreach.ts`.

| Where | What it does |
|---|---|
| `/admin/outreach` | Segment builder (trade by CPV, region, award age, value band, mailbox kind, batch of at most 400); a preview with a count of everyone left out, per reason; "Create campaign"; results against the 400-e-mail test; the audit trail. A preview stores nothing |
| `/admin/outreach/campaigns/<id>` | Letter preview; CSV export (a POST; suppressions and contact-by dates are checked again every time); mark as sent by count or by ticked rows, and clear a wrong mark; results |
| `/admin/suppressions` | The do-not-contact list: search, add an address or a domain, import a bounce list, export, remove (typed confirmation, logged). Also the queue of correction and removal requests |
| `/optout?c=<code>` | Public. Opening it shows a confirmation that names the company and changes nothing; the one button (a Server Action) suppresses the address. Without a code: a form that answers every address alike, rate-limited. Works without JavaScript; `noindex` |
| `/admin` | Founder's key numbers: sign-ups, verified accounts, workspaces, claimed companies, activated workspaces (first bid check built), paying workspaces by plan, MRR, Bid Pass sales (purchases still paid for), AI spend against the daily budget, job queue, ingestion freshness, outreach |

**What the code enforces**

- Who may be listed is decided by `outreachEligibility` (`src/features/procurement/domain/outreach.ts`):
  Ltd, PLC and LLP companies with a Companies House number, never a webmail address, a named
  address only within 30 days of the day it was first stored. The builder adds its own
  caution: the address must be on the company's website domain when the notice gives a
  website, SMEs by default, award decisions and contract details notices only.
- Always left out, with a visible count: suppressed (the address, its domain, or a company
  that opted out), already a user, listed or written to in the last 180 days
  (`outreachConfig.coolOffDays`), removed or merged companies, a second address of a company.
- No named addresses until a UK representative (UK GDPR Art. 27) is in
  `site.company.ukRepresentative`: the builder shows a blocking notice and the server refuses.
- Suppression is by address. `suppressions` is the source of truth, read when a list is built
  and again at every export, so an address that re-appears in a later notice stays suppressed
  (`supplier_contacts.suppressed_at` is a copy, re-stamped by the daily maintenance job).
- Letters are plain text from typed templates (`domain/letter.ts`; the wording is that of
  `docs/gtm/02-outreach-kit.md` and changes only together with it): one personal link
  `/suppliers/<slug>?r=<code>`, the opt-out link, the privacy notice. No tracking pixel, no
  link shortener. CSV cells are guarded against formula injection.
- Prospect lists are personal data. Every function, action, download and page starts with
  `requireAdmin()`. Addresses never go to logs, analytics events, audit entries or error
  messages, and no page shows a prospect's address: it exists in the exported file and on the
  suppression list only.

**What stays with the founder** (the panel on the builder page says so): check each company
at Companies House before sending; one letter and at most two reminders; 10 rising to 30
letters per mailbox per day; never phone; add every "stop" reply, complaint and bounce to
Suppressions within 24 hours; mark each batch as sent on the day, because that date is the
legal record of first contact. Procedures: `docs/gtm/07-compliance-pack.md`.

**Where the data lives and for how long** (`src/config/retention.ts`; enforced by
`runOutreachRetention`, part of the daily `maintenance.cleanup` job)

| Table | Holds | Kept |
|---|---|---|
| `outreach_campaigns` | segment, letter template, build summary (counts only) | kept |
| `outreach_prospects` | company, address, link code, status, dates, the letter's merge fields | A named address: erased 90 days after its letter, or when its one-month window ends if it was never written to. Every address, its fingerprint and the merge fields: erased 12 months after the campaign. The rows, statuses, dates and codes stay, so the counts do |
| `suppressions` | address or domain, reason, source | never purged: it is what keeps the promise |
| `outreach_audit` | who, when, what, how many (never whom) | 2 years |

**For other code**: `getOutreachResults(campaignId \| null)` and `getFounderKpis()` (admin
only); `findSuppression(email)` / `loadSuppressionIndex()` to ask whether an address is on the
do-not-contact list; `addSuppressionEntry(target, input, tx)` to put one there;
`queryOptionalTable(table, run)` in `src/lib/optional-table.ts` to read a table another
module owns and that may not be installed yet (`null` instead of an error).

**Try it**: `pnpm exec tsx --import ./scripts/register-server-only.mjs scripts/outreach-preview.ts --days 30`
prints the counts for a segment (no addresses, nothing stored). Tests: `tests/outreach/*`.
Browser journey: `pnpm exec playwright test -c playwright.outreach.config.ts --trace off`.

## Deployment (Vercel + Neon)

1. **Neon**: create a project (region close to the Vercel functions region). Copy the
   **pooled** connection string → `DATABASE_URL`, and the direct one →
   `DATABASE_URL_UNPOOLED`.
2. **Vercel**: create the project from this repo (Node.js 22, Fluid compute on). Set the
   environment variables from the table above for the Production environment.
3. **Build**: `vercel.json` sets `buildCommand` to `pnpm db:migrate && pnpm build`.
   `pnpm db:migrate` applies the committed migrations **only when `VERCEL_ENV=production`**
   (and always on a local machine or CI); every other Vercel build logs
   `[db:migrate] SKIPPED — …` and touches no database (`scripts/migrate-policy.mjs`).
   Keep migrations backward compatible with the code that is still serving traffic (add
   columns/tables first; remove them in a later deploy).
4. **Preview deployments must not share production's database.** In Vercel → Settings →
   Environment Variables, scope the production `DATABASE_URL` / `DATABASE_URL_UNPOOLED`
   to **Production only**. For Preview either
   - set **no** `DATABASE_URL` (the build fails fast — previews are then not used), or
   - give Preview its **own** database — a Neon branch — by setting `DATABASE_URL` (and
     `DATABASE_URL_UNPOOLED`) for the Preview scope to the branch's connection strings, plus
     `MIGRATE_PREVIEW_DATABASE=1` so preview builds migrate that branch.

   Never set `MIGRATE_PREVIEW_DATABASE=1` while Preview still points at production: a
   preview build of an unreviewed branch would then alter production's schema, and preview
   code would read and write production data either way.
5. **Cron**: `vercel.json` schedules `GET /api/cron/jobs` every 5 minutes (production
   deployment only). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically once
   the variable exists. Every-5-minutes requires a paid Vercel plan (Hobby allows daily
   only; change the schedule to `0 3 * * *` there). Vercel documents Cron Jobs as a legacy
   feature that will migrate to "Schedules"; the route needs no change for that.
6. **Function duration**: `vercel.json` (`functions`) and the route files set
   `maxDuration` to 300 s for the cron worker and 30 s for the webhook.
7. **After the first deploy**: check `/api/health`, sign up with an `ADMIN_EMAILS`
   address **in the browser you will open the verification e-mail in**, open `/admin`, and
   resolve everything under "Configuration warnings". Then pin the account: copy your user
   id (`select id from users where email = '<you>';`) into `ADMIN_USER_IDS` and redeploy.
   Send a test webhook from the Paddle dashboard.
8. **Storage**: create a private Vercel Blob store and set `BLOB_READ_WRITE_TOKEN` before
   relying on uploads (the local-disk fallback does not persist on Vercel).

Production behaviour to be aware of:

- Without `RESEND_API_KEY` **and** `EMAIL_FROM`, sign-up, password reset, verification
  e-mails and invitations are **disabled** (HTTP 503 with a readable message; existing users
  can still sign in). Verification is never skipped. `ALLOW_UNVERIFIED_SIGNUP=1` is the only
  opt-out and is for pre-launch testing: with it anyone can register any address.
- With `PADDLE_ENV=sandbox`, billing is **off** unless `ALLOW_SANDBOX_BILLING=1`.
- `/dev/outbox` is always 404 on a Vercel production deployment.
- Every such condition is logged at start-up (`[config] …`, errors prefixed `!!!`) and listed
  on `/admin` under "Configuration warnings".

## Backup and restore (Neon)

- **Point-in-time restore**: Neon keeps a history of changes and can restore a branch to
  any moment inside your plan's history-retention window (check the window under the
  project's storage/restore settings — it is short on the Free plan). Use this for
  "something destructive just happened".
- **Branching for safe restores**: instead of restoring over production, create a branch
  *from a past timestamp*, inspect it or copy rows back with SQL, and only then decide.
  Branch before risky migrations too.
- **Logical backups (independent of Neon)**: run nightly from any machine/CI with the
  *direct* connection string:
  `pg_dump --format=custom --no-owner --dbname="$DATABASE_URL_UNPOOLED" --file="backup-$(date +%F).dump"`
  and store the file off-platform. Restore into a new database/branch with
  `pg_restore --no-owner --dbname="$TARGET_URL" backup.dump`, check it, then repoint
  `DATABASE_URL`.
- **Rehearse** a restore once before launch. Files in Vercel Blob are not covered by
  database backups.

## Operations runbook

**Start here** — `/admin`. "Configuration warnings" lists everything unsafe or missing in
this deployment's configuration and any subscription we have stopped hearing about;
"Webhooks needing attention", "Background jobs" and "Recent errors" list what needs a look.

**See errors** — `/admin` → "Recent errors", or
`select created_at, route, request_id, message from error_log order by created_at desc limit 50;`.
Users see a request id / digest on error screens; search `error_log.request_id` or
`digest`. Runtime logs (one JSON object per line) are in Vercel → Logs; with `SENTRY_DSN`
set, server errors are also in Sentry. Messages are sanitised (`describeError`): a failed
query shows its SQL text, SQLSTATE and constraint — never the values — so reproduce with the
request id rather than expecting the data in the log.

**Scheduled e-mails went wrong, or must stop now** — `/admin/notifications` shows the last
fan-out per kind and seven days of sent / nothing new / failed counts. Set
`NOTIFICATIONS_PAUSED=1` and redeploy to stop every digest, alert and reminder (queued ones
included); see *Scheduled e-mails*. By SQL:
`select kind, period_key, status, detail, count(*) from notification_log where created_at > now() - interval '7 days' group by 1, 2, 3, 4 order by 2 desc;`

**Replay a webhook** — `/admin` → "Webhooks needing attention" → *Replay* (idempotent:
stale events are ignored and an event's audit entry and analytics are written once). For
an event that never reached us: Paddle → Developer tools → Notifications → the destination
→ logs → *Replay*. Events older than 90 days only keep a stub here and must be replayed
from Paddle. By SQL:
`select event_id, event_type, outcome, error, attempts from webhook_events where processed_at is null;`.

**A customer paid but has no plan** — look up their workspace in `/admin/organizations` and
find their events: `select event_id, event_type, outcome, error from webhook_events where outcome like 'ignored_%' order by received_at desc limit 20;`

- `ignored_unverified` / `ignored_unmapped`: the subscription did not come with checkout
  data signed for a workspace (created by hand in Paddle, a checkout left open for more than
  24 hours, the owner who started it is no longer an owner, or someone tampered with it —
  read the `error` column). Custom data edited in Paddle is NOT trusted. If, after checking
  in Paddle who paid, the subscription really belongs to that workspace, bind it yourself and
  replay:
  `insert into subscriptions (organization_id, status, plan_key, paddle_subscription_id, paddle_customer_id, verified_at)
   values ('<org id>', 'canceled', 'unknown', '<sub_…>', '<ctm_…>', now())
   on conflict (organization_id) do update set paddle_subscription_id = excluded.paddle_subscription_id, paddle_customer_id = excluded.paddle_customer_id, verified_at = now(), last_event_at = null;`
  then *Replay* the newest `subscription.*` event (a tracked subscription is updated from
  its own events). Set `verified_at` only when you have verified the payer: it is what
  enables "Manage billing".
- `ignored_conflict`: a second subscription for a workspace that already has a live one —
  cancel and refund the duplicate in Paddle — or an event that contradicts the stored
  binding (different customer or workspace): compare with Paddle before changing anything.

**A subscription shows "active" but the workspace is on Free** — `period_lapsed`: its paid
period ended and no renewal reached us. Check the subscription in Paddle. With
`PADDLE_API_KEY` set, the daily `billing.reconcile` job corrects it; trigger it now by
running the cron URL (below) after `delete from jobs where type = 'billing.reconcile';`.
Without the key, replay the missing event from Paddle.

**Refund or chargeback arrived** — it appears under "Recent errors" and in the workspace's
audit log, and the receipt is marked. For a SUBSCRIPTION payment ("refund approved …") Paddle
does not change the subscription's status: cancel it in Paddle if the customer should lose
access. For a BID PASS a full refund or chargeback takes the unused passes back by itself
("… was refunded in full; 1 unused unit(s) were taken back"); a pass that was already used
stays ("… had already been used and stay with the customer") and a partial refund revokes
nothing — decide in Paddle whether that stands. A reversed chargeback ("the payment stands
again") does not restore a revoked pass: grant it by hand.

**A customer paid for a Bid Pass but has none** — look for the transaction under "Webhooks
needing attention" / "Recent errors": `ignored_unverified` (the checkout was left open for more
than 24 hours, the buyer is no longer a member, or the checkout data was tampered with),
`ignored_unmapped` (no signed checkout data, or `PADDLE_PRICE_BID_PASS` does not match the price
that was sold — fix the variable, redeploy, *Replay*). Otherwise refund the transaction in
Paddle, or grant the pass by hand. `select kind, quantity, status, fulfilled_at, revoked_at from
billing_purchases where organization_id = '<id>';` shows what was recorded.

**Before switching `PADDLE_ENV` to production** (after testing with `ALLOW_SANDBOX_BILLING=1`)

1. In the LIVE Paddle account: products and prices (`PADDLE_ENV=production pnpm paddle:setup`),
   incl. the Bid Pass and the no-trial twins — every price with tax mode `external` ("Prices
   exclude VAT". A price created without a tax mode follows the account's default: in the
   sandbox account it came back as `location`, and a UK invoice for £149.00 was £124.17 +
   £24.83 VAT instead of £149.00 + £29.80 VAT. Open one price in Paddle and check); a
   notification destination for
   `https://<domain>/api/webhooks/paddle` with the events listed above; the **default payment
   link `https://<domain>/pay`**; the domain approved for checkout; a client-side token.
2. See what the test period left behind: `pnpm billing:purge-sandbox` (dry run) from a machine
   with the production `DATABASE_URL`, or
   `select organization_id, status, plan_key, paddle_subscription_id from subscriptions where paddle_subscription_id is not null and coalesce(paddle_environment, 'sandbox') = 'sandbox';`
   `select organization_id, kind, quantity, fulfilled_at from billing_purchases where paddle_environment = 'sandbox';`
3. Remove it: `pnpm billing:purge-sandbox --yes`. Sandbox subscriptions (their workspaces
   return to Free and can start a trial again), purchases (unused Bid Passes are taken back),
   payments, checkout nonces and stored sandbox events go; live rows and plans granted by
   hand are never touched. Until this is done a workspace with a sandbox subscription keeps
   its plan for free AND cannot start a real checkout ("already has a subscription").
   Optional: `delete from audit_log where actor_type = 'paddle';` and the `billing.*` rows of
   `events` from the test period, if they should not show in the workspace's history.
4. Set `PADDLE_ENV=production` with the live `PADDLE_API_KEY`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`,
   `PADDLE_WEBHOOK_SECRET` and `PADDLE_PRICE_*`; REMOVE `ALLOW_SANDBOX_BILLING`; redeploy.
5. `/admin` → "Configuration warnings" must not list `BILLING_ENVIRONMENT_MIX`,
   `SANDBOX_BILLING_ALLOWED` or `SANDBOX_BILLING_BLOCKED`. Then make one real purchase and
   refund it.

A sandbox event can never be replayed into live state ("This event was received from the
Paddle sandbox environment…"), and sandbox payments are not listed among live receipts, even if
step 3 is forgotten — but the plans and passes of sandbox rows stay until they are purged.

**Refund / cancel** — in the Paddle dashboard: Transactions → the transaction → *Refund*;
Subscriptions → the subscription → *Cancel* (immediately or at period end). The
resulting webhooks update the workspace automatically. Customers pause, resume and cancel
themselves under Settings → Billing; update the card through "Manage billing".

**Jobs stuck or failed** — `/admin` → "Background jobs" → *Retry*, or
`select type, status, attempts, last_error, run_after from jobs where status <> 'succeeded';`.
Trigger the worker by hand:
`curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/jobs`.

**E-mail not received** — `select to_email, template, status, error, created_at from email_outbox order by created_at desc limit 20;`
(`queued` = waiting for the worker, `failed` = provider error, will retry; `failed` with
"no e-mail provider configured" = `RESEND_API_KEY`/`EMAIL_FROM` missing). Per address at most
5 verification/reset/sign-up e-mails are sent per hour.

**Someone cannot sign in** — "Too many attempts": the limit is per e-mail + IP pair
(10 / 15 min), so it only affects the network they are on; a browser that signed in before is
never blocked by other people's failed attempts. Clear it with
`delete from rate_limits where key like 'auth:sign-in:%';`. "Check your inbox" after opening the
verification link in a different browser than the one used to sign up is expected: they are
asked to choose their password there (see Security notes).

**AI spend** — `/admin` shows today/this month. Emergency stop: set
`AI_DAILY_BUDGET_USD=0` and redeploy. Budgets are hard limits (calls reserve their worst
case first); a workspace hitting its daily ceiling sees "used its AI allowance for today".
Rows with `status = 'reserved'` are calls in flight; ones older than 15 minutes are
finalised at their worst-case cost by the maintenance job. Per workspace:
`select organization_id, sum(cost_usd) from ai_usage where created_at >= date_trunc('month', now()) group by 1 order by 2 desc;`.

**Data retention** — enforced daily by the `maintenance.cleanup` job (needs `CRON_SECRET`);
periods live in `src/config/retention.ts`:

| Data | Kept for |
| --- | --- |
| Rate-limit windows (contain IP addresses) | until the window expires |
| Jobs | succeeded 14 days · failed 90 days |
| E-mail outbox | bodies (one-time links) 7 days · rows 90 days |
| Sessions / verification and reset tokens | 7 days / 1 day after expiry |
| Invitations that are closed or expired | 90 days |
| `error_log` | 90 days |
| Paddle webhook events | full payload 90 days, then a stub (ids, type, time) until 400 days |
| Analytics `events`, `ai_usage` | 395 days (13 months) |
| Workspace `audit_log` | 730 days |
| One-off purchases | the row (and the receipts in `billing_payments`): as long as the workspace exists · the stored Paddle transaction (`raw`): 90 days |

**Rotate secrets**

| Secret | How | Effect |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | new value in Vercel → redeploy | all users are signed out; signed file URLs and pending verification links stop working; checkouts in progress are rejected unless `BILLING_SIGNING_SECRET` is set separately |
| `BILLING_SIGNING_SECRET` | new value → redeploy | checkouts opened before the deploy are stored as `ignored_unverified` (rare: bind by hand, see above) |
| `PADDLE_WEBHOOK_SECRET` | create a new notification destination (same URL/events), deploy its secret, then delete the old destination | none if done in that order |
| `PADDLE_API_KEY` | create a new key, deploy, revoke the old one | none |
| `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `AI_GATEWAY_API_KEY`, `GOOGLE_CLIENT_SECRET` | create new, deploy, revoke old | none |
| `CRON_SECRET` | new value → redeploy | the next cron tick uses it |
| Database password | reset the role's password in Neon, update `DATABASE_URL*`, redeploy | brief errors until the deploy finishes |

**Erasure and export (GDPR Art. 15, 17, 20)** — self-service first, runbook for the rest.

*What the app does itself*

| Request | Where | What happens |
| --- | --- | --- |
| Export a workspace | Settings → Workspace → *Export data* (owner) — `GET /api/workspace/export` | One JSON file: members, invitations, subscription, usage, audit log, analytics events, AI usage, **every table that has an `organization_id` column** (feature tables included automatically) and the list of stored files |
| Delete a workspace | Settings → Workspace → *Delete workspace* (owner, types the name) — `deleteWorkspaceAction` | Refused while a subscription is `active`/`trialing`/`past_due`/`paused`. Otherwise: all files under `org/<id>/`, every row of every tenant table, the Paddle events stored about its subscription/customer, its invitation e-mails, and the organization |
| Delete an account | Settings → Profile → *Delete account* (types the e-mail + password) — `deleteAccountAction` | Refused while the user is the only owner of a workspace that has other members or a live subscription. Otherwise: workspaces only they belong to (as above), their memberships, sessions, credentials, pending invitations to their address, their address in `email_outbox`, `audit_log.metadata`, stored Paddle customer events and rate-limit keys; their id is cleared from `ai_usage`, `error_log`, `subscriptions.checkout_user_id` |

Feature modules are covered when their tables carry `organization_id` (ideally
`references organizations(id) on delete cascade`). Anything else — an external service, files
outside `org/<id>/` — registers `registerTenantDataHandler({ name, onExport, onDelete })`
(`src/server/tenant-data.ts`).

*Runbook for a request you handle by hand* (the person cannot sign in, or asks by e-mail)

1. **Identify** the account: `select id, email, email_verified from users where email = '<address>';`
   Verify the requester controls that mailbox (reply to it) before acting.
2. **Subscription**: if one of their workspaces is still billing, cancel it in Paddle →
   Subscriptions → *Cancel immediately* and wait for the webhook (status `canceled`).
3. **Export** if requested: sign in as an owner is not possible for you, so run
   `select * from <table> where organization_id = '<id>'` for the tables listed by
   `select table_name from information_schema.columns where column_name = 'organization_id' and table_schema = 'public';`
   and download the files under `org/<id>/` from Vercel Blob.
4. **Erase**: ask them to use the buttons above if they can. Otherwise, from a machine with
   the production `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` in its environment:
   `pnpm erase account <user id or e-mail>` (or `pnpm erase workspace <organization id>`)
   prints what would be removed and anything that blocks it; add `--yes` to do it. It runs
   the same code as the buttons and refuses the same unsafe cases.
5. **Outside this database** — erase or anonymise by hand:
   - **Paddle** (merchant of record; keeps invoices as its own legal obligation): Customers → the
     customer → anonymise/archive where permitted.
   - **PostHog** (if enabled): Persons → search the user id → *Delete person and events*.
   - **Resend**: delivery logs expire on Resend's own schedule; delete the contact if you created one.
   - **Sentry** (if enabled): issues contain ids only (messages are sanitised), no action normally needed.
   - **Backups**: `pg_dump` files and Neon history keep the data until they expire; note the date
     in your erasure record and do not restore them without re-applying the erasure.
6. **Record** the request and the date you completed it (outside the app).

What is retained on purpose after an erasure: aggregate analytics rows with the user link removed
(`events.user_id` set null), `audit_log` entries of *other* workspaces naming the opaque user id as
actor, and whatever Paddle must keep as merchant of record. Routine retention periods:
`src/config/retention.ts`.

**Give someone a plan manually** (e.g. a design partner) —
`insert into subscriptions (organization_id, status, plan_key) values ('<id>', 'active', 'pro')
 on conflict (organization_id) do update set status = 'active', plan_key = 'pro';`
(no Paddle ids, so no webhook will overwrite it).

## Security notes

**Accounts**

- Session cookies: HttpOnly, SameSite=Lax, Secure on https. Better Auth rejects
  state-changing requests whose `Origin` is not `NEXT_PUBLIC_APP_URL`; Server Actions have
  Next.js' own origin check; our own Route Handlers (`route()`) refuse non-GET requests from
  other origins. Use one canonical host.
- **E-mail verification is always required** and proves control of the mailbox — nothing
  else. A password chosen by whoever registered an address first never survives
  verification by someone else:
  - sign-up sets a signed, HttpOnly *sign-up binding* cookie naming the created account and
    committing to its password hash;
  - the verification link completes directly only in a browser presenting that binding.
    Opened anywhere else it changes nothing (safe for link scanners) and leads to
    `/verify-email/confirm`, where the visitor chooses the password — replacing the stored
    one and revoking every session — and only then is the address verified;
  - a repeated sign-up never changes an account; the mailbox gets a fresh link (unverified
    account) or a "you already have an account" notice (verified), at most 3 per hour;
  - completing a password reset also verifies the address.
- `/admin` requires a **verified** address listed in `ADMIN_EMAILS` and, once
  `ADMIN_USER_IDS` is set, one of the pinned user ids.
- Rate limits (Postgres): per IP — sign-in 10/min, sign-up 20/h, password reset and
  verification e-mails 5/15 min; sign-in per e-mail + IP pair 10/15 min (nobody can lock
  someone else out); a ceiling of 100 failed sign-ins per e-mail per hour that never applies
  to a browser which signed in to that account before (*known device* cookie); 5 e-mails
  per target address per hour; per-workspace limits on invitations, checkout, uploads,
  exports and AI calls. The client IP comes only from headers the client cannot set (Vercel's
  on Vercel; elsewhere `TRUST_PROXY_HEADERS=1` or one shared bucket). Use
  `enforceRateLimit()` for anything expensive you add.
- Password-reset and sign-up responses take a minimum time, and sign-up always answers the
  same way, so neither reveals whether an address is registered.
- Names of people and workspaces (shown to others and placed in invitation e-mails) are
  validated on the server, including on the raw `/api/auth/*` endpoints: length, no control
  characters, no links. Workspace `metadata` is not client-writable; a logo can only be the
  workspace's own upload; roles are restricted to the known ones.

**Tenants and data**

- The workspace always comes from the session (`requireOrg`); members beyond the plan's
  seats after a downgrade keep read access while the workspace is read-only
  (`requireOrg({ write: true })`) and nobody can be added.
- Uploads: type is detected from magic bytes, the body is read with a hard size limit,
  files are private and served through `/api/files` (membership check or signed URL) with
  `nosniff` and a sandboxing CSP.
- Errors are sanitised before they are logged, stored (`error_log`, `jobs.last_error`,
  `webhook_events.error`) or forwarded to Sentry: SQL text and SQLSTATE but never bound
  values; AI SDK error names but never prompts or model output; no tokens, e-mail addresses
  or URL query strings; no NUL bytes.
- Browser analytics (PostHog, when enabled) never receives the query string or token path
  segments of authentication routes.
- Owners can export and delete their workspace, users can delete their account; operational
  tables have retention periods (runbook above).
- Secrets never reach the browser: `src/env.ts` is `server-only`; the client only sees
  `NEXT_PUBLIC_*` values and Paddle price ids (public by nature).

**Money**

- Billing identity is server-signed (see "How billing works"): a subscription is attached to
  a workspace only through checkout data carrying this server's HMAC for that workspace;
  the customer portal is opened only for the caller's own verified e-mail.
- Paid access lapses without a webhook: a fail-safe on the paid period plus a daily
  reconciliation against the Paddle API.
- Paddle sandbox cannot grant plans on the production deployment unless explicitly allowed,
  and is then labelled "Test mode" in the UI.
- AI budgets are hard limits enforced by reservation; failed calls are not free; free
  workspaces draw from their own daily pool.

**Platform**

- Headers (`next.config.ts`): CSP (allows only this site, Paddle and — when configured —
  PostHog; `frame-ancestors 'none'`), HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`.
- CSP for scripts (`src/lib/csp.ts`): every **dynamic** page — everything under `/app` and
  `/admin`, and the auth pages — gets a per-request **nonce** with `'strict-dynamic'` from
  `src/proxy.ts`: no `'unsafe-inline'`, so injected inline script does not run (verified in
  Chromium, including the Paddle overlay checkout). **Static** pages (marketing, legal,
  `/forgot-password`) are prerendered and cannot carry a nonce; they keep
  `'unsafe-inline'` with script origins restricted to this site and Paddle. A document that
  was loaded as a static page keeps that policy while the visitor navigates client-side, so
  the nonce is defence in depth, not a licence to render untrusted HTML. When you add a
  dynamic page outside `/app` and `/admin`, add it to the proxy's `matcher`.
- `pnpm db:migrate` runs only for production deployments on Vercel; Preview must have its
  own database or none.
- `/dev/outbox` (verification, reset and invitation links) is open only under `pnpm dev`;
  on a production build with `DEV_TOOLS=1` it needs a founder session or `DEV_TOOLS_SECRET`,
  and it never exists on the Vercel production deployment.

## Decisions and deviations

| Decision | Reason |
| --- | --- |
| TypeScript **6.0.3**, not 7.0.2 | `typescript-eslint` 8.72 (used by `eslint-config-next`) supports `<6.1.0` |
| ESLint **9.39.5**, not 10 | `eslint-plugin-react`, `-import` and `-jsx-a11y` (inside `eslint-config-next` 16.4.6) do not support ESLint 10 yet |
| `@playwright/test` **1.63.0**, `@types/node` **22** | Match the preinstalled Chromium build / the Node 22 runtime |
| Tailwind through `@tailwindcss/postcss` | The integration documented in Next.js' own docs; `create-next-app` now scaffolds the newer `@tailwindcss/turbopack` loader |
| Cache Components (`cacheComponents`) **not** enabled | Authenticated B2B screens are per-request anyway; the classic model gives real HTTP redirects/403s and no Suspense/validation rules for the next engineer to trip over. Next.js announces it as the default for the next major — plan that migration then |
| `experimental.authInterrupts` enabled | Needed for `forbidden()` → real 403 responses on `/admin` and owner-only pages |
| Webhook signature verified by our own implementation of Paddle's documented algorithm | The SDK helper hard-codes a 5 s timestamp tolerance; ours is configurable (300 s) and supports multiple `h1` signatures. The SDK is used for all API calls |
| Sentry: ~60 lines posting to the envelope endpoint, no `@sentry/nextjs` | Keeps the build free of bundler plugins; server errors only. `error_log` is the source of truth. **Not verified against a live Sentry project** |
| Better Auth's built-in rate limiter disabled | It is in-memory by default (useless on serverless); the Postgres limiter wraps `/api/auth/*` instead |
| Verification in a browser without the sign-up binding asks for a password instead of signing in | The only way to guarantee that a password chosen by someone else never survives verification; costs one extra step for people who open the e-mail on another device |
| Checkout custom data is HMAC-signed rather than replaced by server-created Paddle transactions/customers | Verifiable here without Paddle credentials and independent of Paddle's customer matching; the portal is additionally bound to the caller's verified e-mail |
| Reconciliation calls the Paddle REST API with `fetch` | The webhook pipeline consumes Paddle's wire format; the SDK returns camel-cased entities |
| Export and deletion read the database catalogue (`organization_id` columns) | Feature tables are covered without a registry that someone forgets to update |
| Nonce-based CSP on dynamic pages only; static policy elsewhere | Marketing and legal pages stay prerendered and cacheable; everything behind a session gets the strict policy |
| Column is `organization_id` everywhere (the brief also says `org_id`) | One name for the tenant key across all tables |
| `/contact` is a static page, forms use shared zod schemas without react-hook-form | Less surface (no spam endpoint), fewer dependencies |
| Workspace and account deletion go through our own Server Actions; Better Auth's `organization/delete` and `delete-user` endpoints stay disabled | One code path that also removes files, non-cascading rows and stored Paddle events, and refuses while a subscription is live |

Known limits (not built or not verifiable here): nothing was run against real Resend, Vercel
Blob, the AI Gateway, PostHog, Sentry or Google OAuth (no credentials on the build machine) —
those paths are covered by typed SDK calls and, where possible, mocked tests. Against the real
Paddle SANDBOX API (`pnpm paddle:verify-sandbox`, 2026-11-13): authentication, the event
stream, error shapes, scheduled pause / cancel / undo, resume of a paused subscription whose
period is still running, the same for a trialing subscription, a `tax_mode: external` price
charged as £149.00 + VAT, and (as previews only) that a plan change is accepted for an active
subscription and refused during a trial — on invoice subscriptions, without a card. In a
browser (Chromium, production build, the real Paddle.js 2.12 but a made-up client token and
nothing else allowed out): on `/pay?_ptxn=…` Paddle.js loads and initialises under the nonce
policy, opens its overlay frame for the transaction by itself, and no Content-Security-Policy
violation is reported; when the frame cannot load, the page says so after 15 s.
NOT verified against real Paddle (there is no client-side token or test card on the build
machine): the checkout INSIDE that frame — on `/pay` and on the Billing page — and what follows
it (`checkout.completed`); `transaction.completed` of a card payment (payment-method details, a
one-off purchase); refunds and chargebacks (`adjustment.*`); a resume that starts a new period;
cancelling a paused subscription; anything on a past-due subscription; the invoice PDF of a
real payment; an actual plan change; the reconciliation job's HTTP call and the customer-portal
rules. Those are tested against fakes shaped after Paddle's documented payloads and its OpenAPI
specification. Dark mode, i18n, 2FA and SSO are not included. Still open from the security
review: a unique index on `members (organization_id, user_id)` and adapter-level
transactions for sign-up (F-21, both need the generated auth schema to change), a nonce for
the static pages (would make them dynamic), alerting, and scheduled off-platform backups
(see `docs/quality/foundation-review.md`, "Operational gaps").
