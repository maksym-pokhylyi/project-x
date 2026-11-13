# Foundation review — security, isolation, billing, operations

Date: 2026-11-13 · Scope: main checkout of `/home/user/project-x` (the `.claude/worktrees` feature branches were not reviewed).
Stack as installed: next 16.4.6, better-auth 1.7.22, drizzle-orm 0.45.4, postgres 4.1.1, @paddle/paddle-node-sdk 3.12.0, ai 7.0.172.

## How this was reviewed

- Read every file under `src/server`, `src/lib`, `src/app/api`, `src/db`, `src/env.ts`, `src/proxy.ts`, `next.config.ts`,
  `vercel.json`, `scripts/migrate.mjs`, the auth/billing UI components, and the relevant parts of the libraries in
  `node_modules` (better-auth routes and organization plugin, its Drizzle adapter, drizzle-orm errors, Next.js redirect
  handling, AI SDK error classes).
- Ran the existing suite once: `pnpm test` → 13 files, 170 tests, all passing.
- Confirmed suspicions with throwaway Vitest files and scripts kept outside the repo
  (`/tmp/claude-0/-home-user-project-x/eabf6102-fcda-54a3-b181-656848cbea75/scratchpad/review/`), against a separate
  scratch database (`app_review_test_eabf`, created and dropped again), and with a copy of the existing production
  build served on port 4477 from the scratch directory (curl + headless Chromium). `app_dev`, `app_test` (other than
  through `pnpm test`) and ports 3000–3130 were not touched.
- "Confirmed" below means a test, script or HTTP request reproduced the behaviour. "Code path read" means it follows
  from the code but was not executed. "Not confirmed" means it depends on a third party I could not reach.
- One deviation from the brief: a single read-only `git status` was run by mistake (output discarded). No other git
  command was run and no repository file other than this one was created or changed.

## Summary

| # | Severity | Finding |
|---|---|---|
| F-01 | Critical | Pre-registration account takeover: an attacker who signs up with someone's address keeps a working password after the real owner verifies it — including the founder's `/admin` account |
| F-02 | High | Error reporting writes SQL bind parameters and library error text (customer content, session tokens, reset links) to `error_log`, Vercel logs, Sentry, `jobs.last_error`, `webhook_events.error` |
| F-03 | High | AI budgets are not enforced under concurrency (40 of 40 parallel calls passed a $0.50 limit), failed calls cost $0, and free workspaces can exhaust the global budget for paying customers |
| F-04 | High | A production deployment without `RESEND_API_KEY` (the current deployment, per `PROJECT_STATE.md`) drops e-mail verification: any address can be registered, invitations can be accepted without the mailbox, password reset is impossible |
| F-05 | High | Every Vercel build runs migrations against its `DATABASE_URL`; Preview currently shares production's database |
| F-06 | High | Billing identity comes from browser-supplied checkout data: any subscription can be attached to any workspace, and "Manage billing" opens a Paddle portal session for whatever customer id arrived |
| F-07 | Medium | Open redirect on `/sign-in` and `/sign-up` for signed-in users (`?redirect=/%09/evil.example`) |
| F-08 | Medium | The per-e-mail sign-in limiter lets an outsider lock any user out of signing in |
| F-09 | Medium | Paid access never lapses on its own: a lost cancellation webhook (or a refund/chargeback) leaves the plan active indefinitely |
| F-10 | Medium | Out-of-order delivery for a re-subscribing workspace leaves a cancelled subscription active |
| F-11 | Medium | Paddle sandbox on the production deployment (`PADDLE_ENV` defaults to `sandbox`) sells real entitlements for test cards |
| F-12 | Medium | No account or workspace deletion, no export; the manual erasure runbook leaves personal data behind and can orphan a billing workspace |
| F-13 | Medium | Raw Better Auth endpoints bypass the app's validation and per-workspace limits: invitation e-mails carry attacker-written text, `logo`/`slug`/`metadata` accept anything |
| F-14 | Medium | Tables grow without bound and keep personal data indefinitely; the only cleanup depends on the cron secret being set |
| F-15 | Medium | Seat limits are checked only when a member is added: a workspace keeps all members after downgrading or cancelling |
| F-16 – F-27 | Low | Listed in "Low-severity findings" |

---

## Critical

### F-01 — Pre-registration account takeover (customers and the founder admin)

- **Where:** `src/lib/auth.ts:68-92` (`emailAndPassword`, `emailVerification`, `autoSignInAfterVerification: true` at line 84,
  no `onExistingUserSignUp`), `src/server/session.ts:69` (`isAdmin` = verified e-mail in `ADMIN_EMAILS`),
  `src/components/auth/resend-verification.tsx:18`.
- **Scenario:**
  1. The attacker signs up as `bids@supplier.example` with a password only they know. The account is unverified.
  2. Later the real person signs up through the normal form. Better Auth answers with its generic duplicate response and
     sends nothing; their chosen password is discarded. The UI shows "Check your inbox".
  3. Nothing arrives, so they press "Resend verification e-mail". The link that arrives verifies the attacker-created
     account, and `autoSignInAfterVerification` signs them in, so they never notice their own password was not kept.
  4. The attacker signs in with their password at any time and reads everything in the workspace. Sessions last 30 days
     and slide, so the victim may never be asked for a password again.
  The same sequence with the founder's address yields `/admin` (cross-tenant organisation list, member e-mails, audit
  log, error log, webhook replay). README deployment step 7 tells the founder to "sign up with an `ADMIN_EMAILS`
  address", and the product's own outreach means recipients expect e-mail from Bidfolio.
- **Confirmed:** two scratch tests. Output of the UI-path test: `sign-up: 200 token: null | resend: 200 | verify: 302 ->
  victim signed in: true | name on the account: Bid Manager`, then `attacker password -> 200 | victim's own password -> 401`.
  The admin variant ended with `requireAdmin() -> { email: 'founder@example.com', isAdmin: true }` for the attacker's session.
- **Fix (minimal):** a password chosen before the mailbox was proven must not survive verification by someone else.
  1. On successful `/sign-up/email` set a signed, HttpOnly cookie carrying the created user id (in the existing
     `hooks.after`). In `emailVerification.beforeEmailVerification(user, request)` reject the verification unless that
     cookie matches `user.id`, and send the visitor to "set your password" (the password-reset flow) instead.
  2. Add `emailAndPassword.onPasswordReset` that sets `emailVerified = true`, so a reset — which only the mailbox owner
     can complete and which already revokes sessions — is the alternative proof.
  3. Add `emailAndPassword.onExistingUserSignUp` to e-mail the address ("someone tried to register; reset your password
     if this was you") so step 2 above is never a dead end.
  4. For `/admin`, do not rely on the e-mail alone: pin `ADMIN_USER_IDS`, or require the admin's account to have been
     created through Google sign-in.

---

## High

### F-02 — Error reporting leaks bind parameters and library error text

- **Where:** `src/lib/report-error.ts:31-49` (logs `error.message` in full, stores the first 2,000 characters and the
  stack), `src/lib/sentry.ts:39-40`, `src/lib/auth.ts:61` (Better Auth error details → `detail.message`),
  `src/lib/jobs/worker.ts:28-33` and `src/lib/jobs/queue.ts:121,128` (`last_error`), `src/lib/billing/webhooks.ts:144-150`,
  `src/lib/analytics.ts:50`, `src/lib/audit.ts:39`.
- **Scenario:** drizzle-orm 0.45 wraps every failed query in `DrizzleQueryError` whose message is
  `Failed query: <sql>\nparams: <all bound values>` (`node_modules/drizzle-orm/errors.js:10-14`). Any failure — a dropped
  Neon connection, a unique violation, a timeout — therefore copies the statement's values into `error_log`, the Vercel
  log line and Sentry. That includes `sessions.token`, the password hash in `accounts`, the rendered reset/verification
  e-mail in `email_outbox`, Paddle payloads, and later any tender text or model output a feature inserts. The AI SDK does
  the same for model output: `JSONParseError` embeds `Text: <response>` and `TypeValidationError` embeds
  `Value: <json>` in the message (`@ai-sdk/provider/dist/index.js:260,406`), and `generateAiText` rethrows them into
  `route()`/`runAction()` → `reportError`. The logger only redacts by key name, not by content.
- **Confirmed:** scratch test — a failed insert followed by `reportError` produced
  `error_log.message = "Failed query: insert into \"organizations\" … params: dup,CONFIDENTIAL TENDER TEXT: our price is GBP 1,234,567,s2,…"`.
  AI SDK messages: code path read.
- **Fix:** one `describeError(error)` used by `reportError`, the auth logger, `markJobFailed`, the webhook catch block
  and the `reason:` fields. For `DrizzleQueryError` keep the SQL text, `cause.code`, `cause.constraint_name`,
  `cause.table_name` and drop `params` and `cause.detail`; for `AISDKError` keep name and status code only. Build the
  stored stack from frames (`stack.split("\n").slice(1)`), because the first line repeats the message. Send the same
  sanitised message to Sentry.

### F-03 — AI budgets can be bypassed and can be used to deny service

- **Where:** `src/lib/ai.ts:76-93` (`assertAiBudget`, check-then-act), `:130-137` (check before the call),
  `:155-162` (failures recorded with `costUsd: 0`), `:78-80` (one global daily pool shared by all workspaces).
- **Scenario:**
  - *Concurrency:* N parallel requests all read the same spend and all pass. The module comment says overshoot is
    limited to "the calls in flight", but nothing limits how many are in flight or how large the prompt is
    (`maxOutputTokens` defaults to 1,024; input is unbounded).
  - *Failures are free:* a call that errors or is aborted after the provider has generated tokens is recorded at $0, so
    a caller who aborts just before completion never accumulates spend.
  - *Global pool:* Free workspaces get $0.50/month each and a user may create 10 workspaces; 20 free workspaces spend
    the default $10 global daily budget and every paying customer gets "AI features are temporarily unavailable"
    until midnight UTC — without any concurrency trick.
- **Confirmed:** scratch test with a mock model at $0.30 per call: `40/40 calls succeeded, recorded spend $12 (org limit
  $0.50, global daily limit $1)`; `25 failed calls recorded, total cost $0; provider was called 25 times`. Global-pool
  exhaustion: code path read.
- **Fix:** reserve before spending. In one transaction take `pg_advisory_xact_lock` for the workspace (and one for the
  global pool), sum spend plus open reservations, and insert a `reserved` `ai_usage` row priced at the worst case
  (input-token cap × input price + `maxOutputTokens` × output price); settle it to the real cost afterwards and keep a
  conservative charge on failure. Add a hard input cap per call and `enforceRateLimit("ai:" + organizationId, …)`.
  Split the global budget so free-plan usage draws from its own pool.

### F-04 — Production without `RESEND_API_KEY` fails open

- **Where:** `src/env.ts:155` (`requireEmailVerification: emailConfigured || devTools`), `src/lib/auth.ts:46-48` (warning
  only), `:70`, `:82-83`, `:171`.
- **Scenario:** with `VERCEL_ENV=production` and no Resend key, sign-up returns a session immediately for any address,
  sign-up reveals which addresses are registered (422 `USER_ALREADY_EXISTS`), an invitation link can be accepted by
  anyone who registers the invited address, and password reset silently delivers nothing (`/dev/outbox` is 404).
  `PROJECT_STATE.md` lists the variables set on the live deployment and Resend is not among them; `docs/OWNER_ACTIONS.md`
  item 6 (Resend account) is still open. A rotated or mistyped key later re-opens the same state without any error.
- **Confirmed:** scratch tests with `VERCEL_ENV=production`: `features: { isRealProduction: true, emailConfigured: false,
  devTools: false, requireEmailVerification: false }`; `sign-up as someone else's address -> 200 { token: true,
  emailVerified: false }`; `accept-invitation with an UNVERIFIED account -> 200 { role: 'admin' }`. The actual Vercel
  environment was not inspected.
- **Fix:** never derive the security posture from mail configuration. In `src/env.ts`, when `VERCEL_ENV=production`,
  require `RESEND_API_KEY` and `EMAIL_FROM` (throw at start-up) and set `requireEmailVerification` and
  `requireEmailVerificationOnInvitation` to `true` unconditionally outside development.

### F-05 — Preview builds migrate the production database

- **Where:** `vercel.json:4` (`pnpm db:migrate && pnpm build` for every build), `scripts/migrate.mjs:21-26` (only
  `SKIP_DB_MIGRATE` opts out), `PROJECT_STATE.md:42` ("`DATABASE_URL` … заданы в Vercel (production+preview)").
- **Scenario:** `vercel deploy` (without `--prod`) of a work-in-progress branch applies that branch's migrations to the
  production database before anyone has reviewed them; a destructive or half-finished migration takes production down
  or loses data, and the Neon Free plan keeps six hours of history. Preview code also reads and writes production data.
  README documents "never point previews at production", but the default behaviour is the unsafe one.
- **Confirmed:** code path read; the shared variable is taken from `PROJECT_STATE.md`, not from Vercel itself.
- **Fix:** in `scripts/migrate.mjs` exit 0 unless `VERCEL_ENV` is `production` or unset (local), with an explicit
  `MIGRATE_NON_PRODUCTION=1` override; give the Preview environment its own Neon branch URL and remove production's
  `DATABASE_URL` from it.

### F-06 — Billing identity is taken from browser-supplied checkout data

- **Where:** `src/components/billing/billing-plans.tsx:70-80` (the browser passes `customer.email` and `customData` to
  Paddle.js), `src/lib/billing/webhooks.ts:195-196` (`custom_data.organization_id` wins over every other mapping),
  `:296` (`paddleCustomerId` taken from the event), `src/lib/billing/paddle.ts:35-49` (`customerPortalSessions.create`
  for the stored customer id).
- **Scenario:**
  - *(a) Attach to any workspace.* The client token and price ids are public. From the browser console on the site,
    anyone can call `Paddle.Checkout.open` with `customData: { organization_id: <any workspace id> }`. If that workspace
    has no live subscription it becomes linked to the outsider's subscription: its owner can no longer buy a plan
    ("already has a subscription"), `changePlanAction` charges the outsider's card, the outsider can cancel at will, and
    a non-owner member can upgrade a workspace without the owner. Workspace ids are visible to members in logo URLs.
  - *(b) Portal access to another customer.* The same call with `customer: { email: "billing@victim.example" }` and the
    attacker's own workspace id creates a subscription under the victim's existing Paddle customer if Paddle matches
    customers by e-mail. The webhook then stores the victim's `ctm_…` id on the attacker's workspace, and "Manage
    billing" returns an authenticated portal session for that customer: invoices, addresses, payment methods, and the
    ability to cancel the victim's subscriptions.
- **Confirmed:** (a) and the storage step of (b) by scratch test — a signed event with a foreign `organization_id` and
  an arbitrary `customer_id` is `processed` and both are stored. **Not confirmed:** that Paddle reuses an existing
  customer for a matching checkout e-mail (no Paddle credentials here); Paddle's unique-e-mail rule for customers
  implies it. Confirm in sandbox before launch.
- **Fix:** bind the workspace on the server. `startCheckoutAction` adds `sig = HMAC(secret, organization_id:user_id:expiry)`
  to `customData`, and `resolveOrganizationId` accepts `custom_data.organization_id` only with a valid signature.
  Create (or look up by the owner's verified e-mail) the Paddle customer on the server, store it for the workspace,
  open the checkout with a server-created transaction for that customer, and treat a subscription event whose
  `customer_id` differs as `ignored_conflict`. Until then, have `createBillingLinks` return only the workspace's own
  subscription `management_urls`, not the customer-wide portal.

---

## Medium

### F-07 — Open redirect for signed-in users

- **Where:** `src/lib/redirects.ts:5-10`; used by `src/app/(auth)/sign-in/page.tsx:14-15` and `sign-up/page.tsx:25-26`.
- **Scenario:** `safeRedirect` rejects `//` and `/\` and CR/LF but not a tab. `https://bidfolio.co.uk/sign-in?redirect=/%09/evil.example/phish`
  opened by a signed-in user answers `307` with `Location: /<TAB>/evil.example/phish`; browsers strip the tab and
  follow `//evil.example/phish`.
- **Confirmed:** curl against the production build showed `location: /^I/evil.example/phish`; headless Chromium then
  requested `http://evil.example/phish`. Signed-out visitors are not affected (Better Auth rejects the callback URL).
- **Fix:** reject any character in `[\u0000-\u001f\u007f\\]`, then parse with `new URL(target, "http://n")`, require
  `origin === "http://n"`, and return `pathname + search + hash` of the parsed URL.

### F-08 — Targeted sign-in lockout

- **Where:** `src/app/api/auth/[...all]/route.ts:23,49-55` (10 attempts per 15 minutes per target e-mail, counted
  before authentication, successful or not).
- **Scenario:** ten requests with a wrong password every 15 minutes, from any addresses, keep a chosen user (a customer
  on a tender deadline, or the founder) unable to sign in for as long as the attacker continues.
- **Confirmed:** scratch test — after 10 hostile attempts from other IPs the correct password from a new IP returned `429`
  with `retry-after: 239`.
- **Fix:** apply the strict limit to the e-mail + IP pair and keep only a much higher ceiling per e-mail (for example
  200/hour), or exempt requests carrying a signed "known device" cookie set at the last successful sign-in.

### F-09 — Paid access never lapses without a webhook

- **Where:** `src/lib/billing/entitlements.ts:77-80` (`active`/`trialing` grant the plan with no look at
  `currentPeriodEnd`); no reconciliation job (README "Known limits"); `adjustment.*` events are `ignored_unhandled`.
- **Scenario:** Paddle retries a failed delivery for about three days. If `subscription.canceled` or `.past_due` is
  lost (an outage, a rotated secret, a poisoned payload), the workspace keeps its plan and AI budget forever. A refund or
  chargeback does not change the subscription status at all.
- **Confirmed:** code path read.
- **Fix:** a daily `billing.reconcile` job that fetches each live subscription from the Paddle API and applies it through
  `handleSubscriptionEvent`; a fail-safe in `resolveEntitlements` (for example `active` with `currentPeriodEnd` more than
  3 days in the past → treat as past due and flag in `/admin`); record `adjustment.created` in the audit log and flag it.

### F-10 — Out-of-order events for a re-subscriber leave a cancelled subscription active

- **Where:** `src/lib/billing/webhooks.ts:262-278`.
- **Scenario:** a workspace with an old, ended subscription buys again and the new subscription is cancelled shortly
  after (refund, card dispute). If `subscription.created` failed once and is retried after `subscription.canceled`
  arrived: the cancel is `ignored_conflict` (the stored subscription is dead, the incoming one is not live) and marked
  processed; the retried `created` then replaces the row and grants the plan. The stale check does not apply because it
  only compares events of the subscription already stored.
- **Confirmed:** scratch test — `out-of-order: ignored_conflict processed -> sub_new active entitlement: pro`.
- **Fix:** before replacing a dead subscription with an incoming live one, look for a newer stored event of the incoming
  subscription (`webhook_events` where `payload->'data'->>'id'` equals it and `occurred_at` is later) and answer
  `ignored_stale` if one exists; add an expression index on that JSON path (see F-20).

### F-11 — Sandbox Paddle on the production deployment

- **Where:** `src/env.ts:49` (`PADDLE_ENV` defaults to `sandbox`); no check against `VERCEL_ENV`.
- **Scenario:** `PROJECT_STATE.md` records `PADDLE_ENV=sandbox` on the production deployment and plans to add sandbox
  prices and tokens there for a test payment. From that moment anyone can sign up, pay with a Paddle test card and hold
  the Business plan ($100/month AI budget, 50 seats) for free, and that stays true if launch happens before the switch.
- **Confirmed:** code path read; Vercel configuration not inspected.
- **Fix:** in `src/env.ts`, when `VERCEL_ENV=production` and `PADDLE_ENV !== "production"`, restrict checkout to
  `ADMIN_EMAILS` users (or require an explicit `ALLOW_SANDBOX_IN_PRODUCTION=1`) and log an error at start-up.

### F-12 — No deletion or export; the erasure runbook is incomplete

- **Where:** `src/lib/auth.ts:168` (`disableOrganizationDeletion`), Better Auth `delete-user` and `change-email` are
  disabled (confirmed: `404` and `CHANGE_EMAIL_DISABLED`), README "Delete a workspace / user (GDPR)".
- **Scenario:** the documented `delete from users …` leaves the address in `email_outbox.to_email` and subjects, in
  `audit_log.metadata.email` of other workspaces, in `webhook_events.payload` (Paddle customer events),
  `subscriptions.customer_email`/`raw`, `error_log` (see F-02), PostHog and Paddle. Deleting a user who is the only owner
  leaves a workspace with no owner whose Paddle subscription keeps billing. There is no export for an access request.
- **Confirmed:** code path read; endpoints checked by scratch test.
- **Fix:** an owner-only workspace deletion that refuses while a subscription is live, removes the `org/<id>/` storage
  prefix and cascades; an account deletion that refuses while the user is the sole owner of a workspace with other
  members or a live subscription; a JSON export; and a runbook that lists the tables above.

### F-13 — Raw Better Auth endpoints bypass app validation and limits

- **Where:** `src/lib/auth.ts:163-190` (no `organizationHooks`), `src/app/api/auth/[...all]/route.ts:20` (invitations
  limited per IP only), `src/emails/invitation.tsx:7-9,15-16`, `src/app/api/workspace/logo/route.ts:54-57`.
- **Scenario:** the server actions validate names (60 characters) and limit invitations per workspace, but
  `/api/auth/organization/create|update|invite-member` and `/api/auth/update-user` are reachable directly.
  A workspace or user name such as "URGENT: your Bidfolio account is suspended – verify at https://evil.example" lands in
  the subject and body of an invitation e-mail sent from the product's own domain; invite → cancel → invite repeats it
  within a Free plan's seat limit. `organization/update` also accepts any `logo`, `slug` and `metadata`; because the logo
  route deletes whatever own-workspace key the stored logo names, an admin can delete any file under `org/<id>/`.
- **Confirmed:** HTTP request created a workspace with the 140-character name above; scratch test set `logo` to an
  external URL, changed `slug` and replaced `metadata`. E-mail delivery itself was not exercised.
- **Fix:** add `organizationHooks.beforeCreateOrganization`/`beforeUpdateOrganization` that apply `workspaceNameSchema`,
  drop `metadata`, and accept `logo` only when it starts with `/api/files/org/<id>/logo/`; validate user names in
  `databaseHooks.user.create.before`/`update.before`; move the per-workspace invitation limiter into
  `organizationHooks.beforeCreateInvitation`.

### F-14 — Unbounded growth and indefinite retention

- **Where:** `src/lib/jobs/handlers.ts:24-34` (cleanup covers only `rate_limits`, succeeded jobs and old e-mail bodies),
  `src/app/api/cron/jobs/route.ts:24` (503 when `CRON_SECRET` is unset — no start-up warning).
- **Scenario:** `events` (a row per sign-in, AI call, tracked action), `error_log`, `webhook_events` (full payloads),
  `audit_log`, `ai_usage`, `email_outbox` rows, failed jobs and expired `sessions` (with IP address and user agent) are
  never deleted. Neon Free allows 0.5 GB. `rate_limits` keys contain client IP addresses and are purged only by the
  daily job, which never runs if the cron secret is missing.
- **Confirmed:** code path read.
- **Fix:** extend `maintenance.cleanup` with retention per table (for example `error_log` 90 days, `events` 13 months,
  `webhook_events.payload` nulled after 90 days, `email_outbox` rows 90 days, failed jobs 90 days, sessions expired for
  more than 7 days); log an error at start-up when `VERCEL_ENV=production` and `CRON_SECRET` is unset.

### F-15 — Seat limits are not enforced after a downgrade

- **Where:** `src/lib/auth.ts:173-178` (limits consulted only on invite and accept).
- **Scenario:** subscribe to Business for one month, add 50 members, cancel: the workspace stays at 50 members on Free.
  Quotas are per workspace, so the loss is seats revenue rather than usage. Separately, two invitations accepted at the
  same moment can exceed the limit by one (check-then-insert in Better Auth).
- **Confirmed:** code path read (the existing test covers only adding beyond the limit).
- **Fix:** in `loadOrgContext`, when members exceed `entitlements.limits.seats`, let owners in (to remove members or
  upgrade) and return 403 with a clear message to members beyond the limit in join order.

---

## Low-severity findings

| # | Where | Problem and scenario | Confirmed | Fix |
|---|---|---|---|---|
| F-16 | `src/app/dev/outbox/page.tsx:23`, `src/env.ts:139` | `/dev/outbox` has no authentication whenever `DEV_TOOLS=1` on a production build (Preview, self-hosting). It lists the last 50 e-mails with reset, verification and invitation links; on a Preview that shares production's database (F-05) that is account takeover. | Code path read; 404 without the flag confirmed over HTTP | Require `requireAdminForPage()` whenever `NODE_ENV=production` |
| F-17 | `next.config.ts:37` | `script-src` contains `'unsafe-inline'`, so the CSP does not stop an injected inline script. No injection sink exists today (no `dangerouslySetInnerHTML`, no user HTML/Markdown). | Header confirmed over HTTP | Nonce-based CSP for `/app` and `/admin`, which are dynamic anyway |
| F-18 | `src/instrumentation-client.ts:13-19` | With PostHog enabled, page-view URLs include `/reset-password?token=…` and `/accept-invitation/<id>`. | Code path read | Strip `token` and invitation ids in `before_send`, or skip capture on those routes |
| F-19 | `src/lib/email/deliver.ts:12`, `src/env.ts` | `EMAIL_FROM` falls back to `onboarding@resend.dev`, which Resend delivers only to the account owner: every customer e-mail fails and sign-up is impossible, with no start-up error. | Code path read | Require `EMAIL_FROM` when `RESEND_API_KEY` is set in production |
| F-20 | `src/lib/billing/webhooks.ts:217-231`, `src/lib/billing/subscription.ts:10-13` | `lookupCustomerEmail` filters `webhook_events` by a JSON path inside the webhook transaction and the schema has no index that can serve it, so it scans the whole, ever-growing table; `getSubscription` loads the `raw` Paddle payload on every authenticated request. | Schema read; `EXPLAIN` on the scratch database showed a Seq Scan | Expression index on `(payload->'data'->>'id')`; select explicit columns in `getSubscription` |
| F-21 | `src/lib/auth.ts:55`, `src/db/schema/auth.ts:86-103` | The Drizzle adapter runs with `transaction` off (its default), so a sign-up that fails between the user and credential inserts leaves an address that can neither sign up nor sign in until a password reset. Two parallel first requests can each create a personal workspace. `members` has no unique `(organization_id, user_id)`. | Adapter source read | Add the unique index. Enabling `transaction: true` on `drizzleAdapter` is only safe after the `session.create.before` hook (`src/lib/auth.ts:130-133`) stops querying through the global pool, otherwise five concurrent sign-ins can exhaust the 5-connection pool from inside their own transactions |
| F-22 | `src/app/api/workspace/logo/route.ts:32-57` | The route trusts SameSite=Lax alone (a request with `Origin: https://evil.example` and the cookie was accepted), and reads the whole multipart body before checking size when `content-length` is absent. | Confirmed over HTTP (origin) | Compare `Origin` with `trustedOrigins` in `route()` for non-GET methods |
| F-23 | `src/lib/report-error.ts:38-54` | An error message containing a NUL byte makes the `error_log` insert fail, so the error is only in the console log. | Observed in a scratch test | Strip `\u0000` before inserting |
| F-24 | `src/lib/rate-limit.ts:69-76`, `src/lib/auth.ts:109` | The first `X-Forwarded-For` value is trusted. Vercel overwrites it; behind any other proxy the per-IP limits are bypassed (12 sign-in attempts with rotating header values, no 429), and behind a CDN all users share one bucket. | Confirmed over HTTP on a non-Vercel server | Prefer `x-vercel-forwarded-for`/`x-real-ip` on Vercel; document that the limiter assumes Vercel |
| F-25 | `src/server/actions/admin.ts:19-43`, `src/server/actions/billing.ts:36` | Replaying a `transaction.*` event inserts a second audit row and a second `billing.payment_succeeded` event; `retryJobAction` resets a job that is currently running; a paused subscription does not block a new checkout, so a later resume double-bills (flagged only as `ignored_conflict`). | Code path read | Skip side effects on forced replay of an already processed event; add `status <> 'running'` to the retry; include `paused` in the checkout guard |
| F-26 | `src/lib/analytics.ts:56`, `src/lib/sentry.ts:61` | PostHog and Sentry calls are awaited inline, including after webhook commit; a slow PostHog pushes the webhook response past Paddle's timeout and causes retries (harmless duplicates). | Code path read | `runInBackground` for forwarding |
| F-27 | `src/lib/auth.ts:76-78` | Password-reset requests for existing addresses render and store an e-mail; unknown addresses return immediately — a timing signal for which addresses are registered (5 requests per 15 minutes per IP). | Not confirmed | Enqueue the send in the background for both cases |

---

## Checked and found sound

**Authentication and sessions**
- Session cookies: `HttpOnly; SameSite=Lax; Path=/` (confirmed), `Secure` when the app URL is https; no cookie cache, so
  every request validates the session in the database and revocation is immediate.
- Better Auth origin check on cookie-bearing POSTs; `callbackURL`/`redirectTo` validated against `trustedOrigins`
  (control characters rejected). `trustedOrigins` contains only this deployment's own hosts.
- Sign-up (with verification on), password reset and sign-in responses do not reveal whether an address exists (F-27
  notes a possible timing signal); reset tokens last one hour and a reset revokes all sessions.
- Google linking: implicit linking to an existing unverified local account is refused (`requireLocalEmailVerified`
  default), so OAuth does not add a second takeover path.
- Rate limiter: one atomic upsert per call; path variants (`/sign-in/email/`, upper case, percent-encoded, double slash)
  do not reach the sign-in handler (404, and Next.js answers a trailing slash with 308), so they do not bypass it.
- Invitations: accepted only by the invited address; `list-user-invitations` requires a verified e-mail; an admin
  cannot invite or promote to owner; the last owner cannot leave; `add-member` has no HTTP path.
- `/dev/outbox` is 404 on a production build without `DEV_TOOLS=1` and can never be enabled when `VERCEL_ENV=production`.

**Authorisation and tenant isolation**
- Every server action and route handler starts with `requireUser`/`requireOrg`/`requireAdmin`; the workspace always
  comes from the session; member and invitation ids are checked against it before delegating to Better Auth.
- Membership is re-read on every request, so a removed member loses access at once and the session falls back to
  another workspace.
- `/api/files`: key pattern plus `..` check plus resolved-path check; other tenants' keys and traversal attempts return
  404 (confirmed over HTTP); signed URLs are HMAC over key and expiry with constant-time comparison; responses carry
  `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` and `attachment` for non-image types.
- Logo upload: type from magic bytes (PNG/JPEG/WebP only, no SVG), 1 MB limit, key built from the session's workspace.
- `/admin` pages and data functions each check the admin flag themselves; cron uses a constant-time comparison and
  answers 503 when the secret is unset, 401 otherwise (confirmed).

**Billing**
- Webhook: raw body via `request.text()`, HMAC-SHA256 over `ts:body`, constant-time comparison, ±300 s tolerance,
  multiple `h1` values; nothing is stored for an invalid signature; duplicates are de-duplicated on `event_id` under a
  row lock; changes for one workspace are serialised with a transaction-scoped advisory lock (works through PgBouncer);
  a handler failure rolls back, records the error and answers 500.
- Stale events of the stored subscription are ignored with microsecond precision; unknown price ids and statuses fall
  back to Free; a payment alone never grants access; the price id comes from the server and entitlements from the
  price actually subscribed.
- `consumeQuota`: single conditional `UPDATE` inside a transaction — exact under concurrency (existing tests); periods
  are UTC months.
- Entitlement rules for `trialing`, `past_due` grace (fails closed without a start time), `paused`, `canceled`, and
  scheduled cancellation match the README table.

**Jobs and cron**
- Claiming uses `FOR UPDATE SKIP LOCKED` in a single statement; a job killed mid-run is reclaimed after 15 minutes and
  counted as an attempt; attempts are capped and failures reported; e-mail delivery is idempotent (status check plus
  provider idempotency key); the daily maintenance job is de-duplicated per day.

**Data and platform**
- postgres.js: `prepare: false`, 5 connections per instance, 20 s idle timeout, 10 s connect timeout — appropriate for
  Neon's pooler. No transaction spans a network call; every transaction body uses the transaction handle, so the pool
  cannot deadlock on itself. Hot paths are indexed (`sessions.token`, `members` by user and organisation,
  `subscriptions.organization_id`, `events` by organisation and time, `webhook_events.event_id`, `rate_limits` key).
- Destructive helpers refuse the wrong database (test and e2e setup check the name; seed refuses non-localhost).

**HTTP**
- HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `form-action 'self'`,
  `Referrer-Policy`, `Permissions-Policy` present on all responses; `/app` is `private, no-store`; no CORS headers; error
  responses are generic JSON with a request id and no stack; no server-side fetch of user-supplied URLs; no raw HTML
  rendering.

## Not assessed

- **Live third parties:** Paddle (overlay checkout under this CSP, customer matching by e-mail in F-06, portal
  behaviour, real payload shapes), Resend, Vercel Blob, AI Gateway, PostHog, Sentry, Google OAuth — no credentials and
  no outbound calls were made.
- **Actual Vercel and Neon settings:** environment-variable scopes, deployment protection, domain redirects (apex/www
  must redirect to the canonical host or sign-in from the other host is refused), firewall rules that could challenge
  Paddle's webhook. F-04, F-05 and F-11 rest on `PROJECT_STATE.md`.
- **Feature branches** in `.claude/worktrees` (document upload, AI checks, public pages). Most confidential-data risk
  will live there; F-02 and F-03 apply to them directly.
- **Load behaviour:** pool exhaustion and cold starts were reasoned about, not load-tested. postgres.js queues without
  an acquire timeout and no `statement_timeout` is set, so a stuck query holds a connection until the function is killed.
- `pnpm e2e` was not run.

## Operational gaps for a solo operator

1. **No alerting.** Errors, failed jobs and unprocessed webhooks are visible only when someone opens `/admin`; the Sentry
   forwarder is unverified. A daily digest e-mail (or an alert when `error_log` grows) is the minimum.
2. **Backups.** Neon Free keeps six hours of history; no scheduled `pg_dump` exists and the build container cannot
   reach the database. Blob files are not backed up at all.
3. **Uploads.** `storage.put` only accepts a buffer inside a function, and Vercel limits request bodies to 4.5 MB.
   Tender packs will need direct-to-Blob client uploads, whose token endpoint must pin the path to `org/<id>/`.
4. **File access is workspace-wide.** `/api/files` authorises any member for any key under `org/<id>/`; per-bid or
   per-user restrictions need a lookup table before confidential documents arrive.
5. **AI credit.** The gateway balance is $5. When it runs out every call fails, is recorded at $0 and writes an
   `error_log` row; there is no circuit breaker.
6. **Start-up assertions.** Production should refuse to start without `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`,
   `ADMIN_EMAILS`, `PADDLE_WEBHOOK_SECRET` and with `PADDLE_ENV=sandbox` (F-04, F-11, F-14, F-19).
7. **Support actions need SQL.** Changing a user's e-mail, deleting an account and moving a subscription between
   workspaces have no tooling. Re-pointing a subscription's `custom_data.organization_id` in Paddle would, from the
   code, hit the unique index on `paddle_subscription_id` and answer 500 on every retry (not executed).
8. **Secret rotation.** `BETTER_AUTH_SECRET` signs sessions, verification tokens and file URLs; rotating it signs
   everyone out and invalidates pending links.
9. **Legal placeholders** (`[[…]]` in `src/config/site.ts`) are still present.
