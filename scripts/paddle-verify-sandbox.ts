/**
 * Checks against the REAL Paddle SANDBOX API what the billing code assumes about Paddle:
 * the calls of src/lib/billing/manage.ts (pause / cancel / undo / resume), the shape of
 * scheduled changes, the event stream used by `pnpm paddle:pull-events`, and error shapes.
 *
 *   PADDLE_API_KEY=… PADDLE_ENV=sandbox pnpm paddle:verify-sandbox                # read-only checks
 *   PADDLE_API_KEY=… PADDLE_ENV=sandbox pnpm paddle:verify-sandbox --write        # + the write scenario
 *   … --write --dump <directory>     also saves the raw entities and events (to build test fixtures from)
 *   … --write --reuse product=pro_…,price=pri_…,trialPrice=pri_…,customer=ctm_…,address=add_…
 *                                    re-activates the (archived) objects of an earlier run instead of creating new ones
 *
 * The write scenario needs no card. It creates, all named "ZZ API verification (automated,
 * safe to ignore)": 1 product, 2 prices of £149.00 EXCLUDING tax (`tax_mode: external`, as
 * the catalogue prices must be; one with a 14-day trial), 1 customer with an
 * @example.com address, and 2 manually-collected (invoice) transactions, which Paddle turns
 * into 2 subscriptions. It then runs the manage steps on them, prints what Paddle answered
 * and which events it emitted, and ALWAYS cleans up: subscriptions cancelled immediately,
 * open invoices cancelled, prices / product / address / customer archived. It never creates
 * notification destinations, tokens or keys and never touches an object it did not create.
 *
 * DEVELOPMENT ONLY: refuses unless PADDLE_ENV=sandbox, refuses on the production deployment,
 * and every write is guarded by a check that the request goes to sandbox-api.paddle.com.
 * The API key needs read/write on products, prices, customers, addresses, transactions and
 * subscriptions, and read on events.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Environment, LogLevel, Paddle } from "@paddle/paddle-node-sdk";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const SANDBOX_API = "https://sandbox-api.paddle.com";
const PREFIX = "ZZ API verification (automated, safe to ignore)";
const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const dumpIndex = args.indexOf("--dump");
const DUMP_DIR = dumpIndex >= 0 ? args[dumpIndex + 1] : undefined;
const reuseIndex = args.indexOf("--reuse");
/** Ids of an earlier run of THIS script (printed in its "Final state" section). */
const REUSE: Record<string, string> = Object.fromEntries(
  (reuseIndex >= 0 ? (args[reuseIndex + 1] ?? "") : "")
    .split(",")
    .map((pair) => pair.split("="))
    .filter((pair): pair is [string, string] => pair.length === 2 && Boolean(pair[0]) && Boolean(pair[1])),
);
/** An invoice needs a complete postal address, region included. */
const ADDRESS = { description: PREFIX, first_line: "1 Example Street", city: "London", region: "Greater London", postal_code: "SW1A 1AA", country_code: "GB" };

type Json = Record<string, unknown>;
type ApiResult = { status: number; data: Json | null; error: { code: string; detail: string } | null };

/** Aborts unless everything says "sandbox". Called at start-up and again before EVERY write. */
function assertSandbox(url: string = SANDBOX_API): void {
  if (process.env.VERCEL_ENV === "production") throw new Error("Refusing to run on the production deployment (VERCEL_ENV=production).");
  if (process.env.PADDLE_ENV !== "sandbox") throw new Error("Refusing to run: PADDLE_ENV must be exactly \"sandbox\".");
  if (new URL(url).origin !== SANDBOX_API) throw new Error(`Refusing to call ${new URL(url).origin}: only ${SANDBOX_API} is allowed.`);
}

let dumpSequence = 0;
function dump(name: string, value: unknown): void {
  if (!DUMP_DIR) return;
  mkdirSync(DUMP_DIR, { recursive: true });
  dumpSequence += 1;
  writeFileSync(join(DUMP_DIR, `${String(dumpSequence).padStart(2, "0")}-${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
}

async function api(method: "GET" | "POST" | "PATCH", path: string, body?: Json): Promise<ApiResult> {
  const url = `${SANDBOX_API}${path}`;
  assertSandbox(url);
  if (method !== "GET" && !WRITE) throw new Error("A write was attempted without --write");
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${process.env.PADDLE_API_KEY}`, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const parsed = (await response.json().catch(() => ({}))) as { data?: Json; error?: { code: string; detail: string } };
  return { status: response.status, data: parsed.data ?? null, error: parsed.error ?? null };
}

async function must(method: "GET" | "POST" | "PATCH", path: string, body?: Json): Promise<Json> {
  const result = await api(method, path, body);
  if (!result.data) throw new Error(`${method} ${path.split("?")[0]} -> HTTP ${result.status} ${result.error?.code ?? ""}: ${result.error?.detail ?? "no data"}`);
  return result.data;
}

const line = (text: string) => console.log(text);
const heading = (text: string) => console.log(`\n== ${text}`);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The fields of a subscription the billing code reads. */
function subscriptionState(subscription: Json): string {
  const scheduled = subscription.scheduled_change as { action?: string; effective_at?: string; resume_at?: string | null } | null;
  const period = subscription.current_billing_period as { starts_at?: string; ends_at?: string } | null;
  return [
    `status=${String(subscription.status)}`,
    `scheduled_change=${scheduled ? `${scheduled.action}@${scheduled.effective_at}${scheduled.resume_at ? ` resume_at=${scheduled.resume_at}` : ""}` : "null"}`,
    `period_end=${period?.ends_at ?? "null"}`,
    `next_billed_at=${String(subscription.next_billed_at ?? null)}`,
    `paused_at=${String(subscription.paused_at ?? null)}`,
    `canceled_at=${String(subscription.canceled_at ?? null)}`,
  ].join("  ");
}

// ---------------------------------------------------------------------------
// Read-only checks
// ---------------------------------------------------------------------------

async function readOnlyChecks(): Promise<void> {
  heading("Authentication and list calls");
  for (const path of ["/products?per_page=1", "/subscriptions?per_page=1", "/transactions?per_page=1"]) {
    const response = await fetch(`${SANDBOX_API}${path}`, { headers: { authorization: `Bearer ${process.env.PADDLE_API_KEY}`, accept: "application/json" } });
    line(`GET ${path} -> HTTP ${response.status}`);
    if (response.status === 401 || response.status === 403) throw new Error("The API key was not accepted by the sandbox API.");
  }

  heading("Event stream (what pnpm paddle:pull-events relies on)");
  const stream = async (query: string) => {
    const response = await fetch(`${SANDBOX_API}/events?${query}`, { headers: { authorization: `Bearer ${process.env.PADDLE_API_KEY}`, accept: "application/json" } });
    const body = (await response.json()) as { data?: Array<{ event_id: string }>; error?: { code: string } };
    return { status: response.status, ids: (body.data ?? []).map((event) => event.event_id), keys: body.data?.[0] ? Object.keys(body.data[0]).sort().join(",") : "", error: body.error?.code };
  };
  const ascending = await stream("order_by=id%5BASC%5D&per_page=5");
  line(`order_by=id[ASC] -> HTTP ${ascending.status}, ${ascending.ids.length} event(s), ascending=${String([...ascending.ids].sort().join() === ascending.ids.join())}, keys: ${ascending.keys || "(no events)"}`);
  if (ascending.ids[0]) {
    const after = await stream(`order_by=id%5BASC%5D&per_page=5&after=${ascending.ids[0]}`);
    line(`after=<first id> -> HTTP ${after.status}, excludes it: ${String(!after.ids.includes(ascending.ids[0]))}`);
  }
  const from = await stream(`order_by=id%5BASC%5D&from=${encodeURIComponent(new Date(Date.now() - 3_600_000).toISOString())}&event_type=subscription.updated,transaction.completed`);
  line(`from=<1h ago>&event_type=a,b -> HTTP ${from.status}`);
  const bogus = await stream("after=evt_doesnotexist");
  line(`after=<not an id> -> HTTP ${bogus.status} ${bogus.error ?? ""}`);

  heading("Error shapes for ids Paddle does not know (the SDK's ApiError)");
  const paddle = new Paddle(process.env.PADDLE_API_KEY ?? "", { environment: Environment.sandbox, logLevel: LogLevel.none });
  const { requestManageStep } = await import("../src/lib/billing/manage");
  const { describePaddleFailure } = await import("../src/lib/billing/paddle-errors");
  const unknownSubscription = "sub_01hv8x29kz0t586xy6zn1a62ny";
  for (const step of [
    { kind: "pause_at_period_end" },
    { kind: "cancel_at_period_end" },
    { kind: "resume_now", billing: "continue_period" },
    { kind: "remove_scheduled_change", change: "pause" },
  ] as const) {
    if (!WRITE) {
      // These are POST/PATCH requests to an id that does not exist: they change nothing, but they are writes by method.
      line(`${step.kind}: skipped without --write`);
      continue;
    }
    assertSandbox();
    const failure = await requestManageStep(paddle, unknownSubscription, step).then(
      () => null,
      (error: unknown) => describePaddleFailure(error),
    );
    line(`${step.kind} on an unknown subscription -> ${failure ? `${failure.kind} (HTTP ${failure.status}, code ${failure.code}): ${failure.reason}` : "UNEXPECTED SUCCESS"}`);
  }
  const invoice = await paddle.transactions.getInvoicePDF("txn_01hv8wptq8987qeep44cyrewp9").then(
    () => null,
    (error: unknown) => describePaddleFailure(error),
  );
  line(`invoice of an unknown transaction -> ${invoice ? `${invoice.kind} (HTTP ${invoice.status}, code ${invoice.code}): ${invoice.reason}` : "UNEXPECTED SUCCESS"}`);
}

// ---------------------------------------------------------------------------
// Write scenario
// ---------------------------------------------------------------------------

type Created = { product?: string; prices: string[]; customer?: string; address?: string; transactions: string[]; subscriptions: string[] };

async function subscriptionOf(transactionId: string, customerId: string, known: string[]): Promise<Json | null> {
  // Paddle creates the subscription when the manually-collected transaction is billed; give it a moment.
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const transaction = await must("GET", `/transactions/${transactionId}`);
    const subscriptionId = typeof transaction.subscription_id === "string" ? transaction.subscription_id : null;
    if (subscriptionId && !known.includes(subscriptionId)) return must("GET", `/subscriptions/${subscriptionId}`);
    await wait(2_000);
  }
  line(`   no subscription appeared for ${transactionId} (customer ${customerId})`);
  return null;
}

async function writeScenario(created: Created, startedAt: Date): Promise<void> {
  const run = startedAt.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const custom = { purpose: "zz_api_verification", run };
  const paddle = new Paddle(process.env.PADDLE_API_KEY ?? "", { environment: Environment.sandbox, logLevel: LogLevel.none });
  const { requestManageStep } = await import("../src/lib/billing/manage");
  const { describePaddleFailure } = await import("../src/lib/billing/paddle-errors");
  type Step = Parameters<typeof requestManageStep>[2];

  /** One manage step through the same code path as the app, then the state Paddle reports. */
  const step = async (label: string, subscriptionId: string, manageStep: Step): Promise<Json | null> => {
    assertSandbox();
    const failure = await requestManageStep(paddle, subscriptionId, manageStep).then(
      () => null,
      (error: unknown) => describePaddleFailure(error),
    );
    if (failure) {
      line(`   ${label}: REFUSED — ${failure.kind} (HTTP ${failure.status}, code ${failure.code}): ${failure.reason}`);
      return null;
    }
    const subscription = await must("GET", `/subscriptions/${subscriptionId}`);
    dump(`subscription-after-${label.replace(/[^a-z0-9]+/gi, "-")}`, subscription);
    line(`   ${label}: ${subscriptionState(subscription)}`);
    return subscription;
  };

  /** Re-activates an object an earlier run of this script created and archived — after checking it really is one of ours. */
  const reactivate = async (path: string, extra: Json = {}): Promise<string> => {
    const existing = await must("GET", path);
    const label = String(existing.name ?? existing.description ?? "");
    if (!label.startsWith(PREFIX)) throw new Error(`${path} was not created by this script (its name does not start with "${PREFIX}"): refusing to touch it.`);
    const updated = await must("PATCH", path, { status: "active", ...extra });
    line(`re-activated ${String(updated.id)}`);
    return String(updated.id);
  };

  heading(REUSE.product ? "Re-activating the test catalogue and customer of an earlier run" : "Creating the test catalogue and customer");
  if (REUSE.product) {
    created.product = await reactivate(`/products/${REUSE.product}`);
  } else {
    const product = await must("POST", "/products", { name: PREFIX, description: `${PREFIX} — run ${run}`, tax_category: "standard", custom_data: custom });
    created.product = String(product.id);
    line(`product ${created.product}`);
  }
  const price = async (name: string, trial: boolean) => {
    const reused = REUSE[trial ? "trialPrice" : "price"];
    if (reused) {
      // An earlier run may have created it with the account's default tax mode: make it ex-VAT like a catalogue price.
      created.prices.push(await reactivate(`/prices/${reused}`, { tax_mode: "external" }));
      return reused;
    }
    const result = await must("POST", "/prices", {
      product_id: created.product,
      name: `${PREFIX} — ${name}`,
      description: `${PREFIX} — ${name}`,
      unit_price: { amount: "14900", currency_code: "GBP" },
      // Catalogue prices exclude VAT: tax is added on top at checkout.
      tax_mode: "external",
      billing_cycle: { interval: "month", frequency: 1 },
      quantity: { minimum: 1, maximum: 1 },
      ...(trial ? { trial_period: { interval: "day", frequency: 14 } } : {}),
      custom_data: custom,
    });
    created.prices.push(String(result.id));
    dump(`price-${name}`, result);
    line(`price ${String(result.id)} (${name})`);
    return String(result.id);
  };
  const plainPrice = await price("monthly", false);
  const trialPrice = await price("monthly with trial", true);
  if (REUSE.customer && REUSE.address) {
    created.customer = await reactivate(`/customers/${REUSE.customer}`);
    created.address = await reactivate(`/customers/${created.customer}/addresses/${REUSE.address}`, ADDRESS);
  } else {
    const customer = await must("POST", "/customers", { email: `zz-api-verification-${run}@example.com`, name: PREFIX, custom_data: custom });
    created.customer = String(customer.id);
    const address = await must("POST", `/customers/${created.customer}/addresses`, ADDRESS);
    created.address = String(address.id);
    line(`customer ${created.customer}, address ${created.address}`);
  }

  const invoice = async (label: string, priceId: string): Promise<Json | null> => {
    const result = await api("POST", "/transactions", {
      items: [{ price_id: priceId, quantity: 1 }],
      customer_id: created.customer,
      address_id: created.address,
      collection_mode: "manual",
      currency_code: "GBP",
      billing_details: { enable_checkout: false, purchase_order_number: "ZZ-VERIFY", additional_information: PREFIX, payment_terms: { interval: "day", frequency: 14 } },
      status: "billed",
      custom_data: custom,
    });
    if (!result.data) {
      line(`   ${label}: transaction REFUSED — HTTP ${result.status} ${result.error?.code ?? ""}: ${result.error?.detail ?? ""}`);
      return null;
    }
    created.transactions.push(String(result.data.id));
    dump(`transaction-${label}`, result.data);
    line(`   ${label}: transaction ${String(result.data.id)} status=${String(result.data.status)} origin=${String(result.data.origin)}`);
    if (label === "active") {
      // "Prices exclude VAT": £149.00 must be the amount BEFORE tax, with VAT added on top for a UK address.
      const totals = (result.data.details as { totals?: Record<string, string> } | null)?.totals ?? {};
      const [subtotal, tax, total] = [Number(totals.subtotal), Number(totals.tax), Number(totals.total)];
      const exclusive = subtotal === 14900 && tax > 0 && total === subtotal + tax;
      line(`   ${label}: totals subtotal=${totals.subtotal} tax=${totals.tax} total=${totals.total} ${totals.currency_code} -> ${exclusive ? "OK: £149.00 + VAT" : "UNEXPECTED: the price is not treated as excluding tax"}`);
      if (!exclusive) process.exitCode = 1;
    }
    const subscription = await subscriptionOf(String(result.data.id), created.customer!, created.subscriptions);
    if (subscription) {
      created.subscriptions.push(String(subscription.id));
      dump(`subscription-${label}-created`, subscription);
      line(`   ${label}: subscription ${String(subscription.id)} ${subscriptionState(subscription)}`);
    }
    return subscription;
  };

  /**
   * What changeSubscriptionPlan() would do, WITHOUT doing it: Paddle's preview endpoint
   * calculates a plan change and changes nothing.
   */
  const previewPlanChange = async (label: string, subscriptionId: string, priceId: string, mode: string) => {
    const result = await api("PATCH", `/subscriptions/${subscriptionId}/preview`, { items: [{ price_id: priceId, quantity: 1 }], proration_billing_mode: mode });
    const immediate = (result.data?.immediate_transaction as { details?: { totals?: { grand_total?: string; credit_to_balance?: string } } } | null | undefined)?.details?.totals;
    line(
      `   ${label} (${mode}): ${result.data ? `accepted — charged now: ${immediate?.grand_total ?? "nothing"}, credited to balance: ${immediate?.credit_to_balance ?? "0"}` : `REFUSED — HTTP ${result.status} ${result.error?.code ?? ""}: ${result.error?.detail ?? ""}`}`,
    );
  };

  heading("Active subscription: pause / undo / cancel / undo at the end of the paid period");
  const active = await invoice("active", plainPrice);
  if (active) {
    const id = String(active.id);
    await previewPlanChange("preview: change the price of an active subscription", id, trialPrice, "prorated_immediately");
    await step("pause at period end", id, { kind: "pause_at_period_end" });
    await step("pause again while a pause is scheduled", id, { kind: "pause_at_period_end" });
    await step("cancel while a pause is scheduled", id, { kind: "cancel_at_period_end" });
    await step("undo (scheduled_change: null)", id, { kind: "remove_scheduled_change", change: "pause" });
    await step("undo when nothing is scheduled", id, { kind: "remove_scheduled_change", change: "pause" });
    await step("cancel at period end", id, { kind: "cancel_at_period_end" });
    await step("pause while a cancellation is scheduled", id, { kind: "pause_at_period_end" });
    await step("undo the cancellation", id, { kind: "remove_scheduled_change", change: "cancel" });
    await step("resume an active subscription", id, { kind: "resume_now", billing: "continue_period" });

    heading("Paused subscription: resume, cancel");
    // Test-only: the app never pauses immediately, but a paused subscription is needed and the scheduled pause is a month away.
    const paused = await api("POST", `/subscriptions/${id}/pause`, { effective_from: "immediately" });
    line(`   (test-only) pause immediately -> HTTP ${paused.status} ${paused.data ? subscriptionState(paused.data) : `${paused.error?.code}: ${paused.error?.detail}`}`);
    if (paused.data) {
      dump("subscription-paused", paused.data);
      await step("pause a paused subscription", id, { kind: "pause_at_period_end" });
      await step("cancel a paused subscription at period end", id, { kind: "cancel_at_period_end" });
      // The paid period is still running, so the app resumes with `continue_period` (no charge, no further invoice).
      // The other branch, `new_period` (charge now, new period), is deliberately not exercised: it would issue another invoice.
      await step("resume a paused subscription whose period is still running", id, { kind: "resume_now", billing: "continue_period" });
    }
  }

  heading("Trialing subscription: cancel / pause at the end of the trial");
  const trialing = await invoice("trialing", trialPrice);
  if (trialing) {
    const id = String(trialing.id);
    // Does Paddle accept the plan change changeSubscriptionPlan() sends (prorated_immediately) during a trial?
    await previewPlanChange("preview: change the price of a TRIALING subscription", id, plainPrice, "prorated_immediately");
    await previewPlanChange("preview: change the price of a TRIALING subscription", id, plainPrice, "do_not_bill");
    await step("cancel at period end (trial)", id, { kind: "cancel_at_period_end" });
    await step("undo the cancellation (trial)", id, { kind: "remove_scheduled_change", change: "cancel" });
    await step("pause at period end (trial)", id, { kind: "pause_at_period_end" });
    await step("undo the pause (trial)", id, { kind: "remove_scheduled_change", change: "pause" });
  }

  heading("Events Paddle emitted for these objects");
  await wait(3_000);
  const ids = new Set([...created.subscriptions, ...created.transactions]);
  const response = await fetch(`${SANDBOX_API}/events?order_by=id%5BASC%5D&per_page=200&from=${encodeURIComponent(startedAt.toISOString())}`, {
    headers: { authorization: `Bearer ${process.env.PADDLE_API_KEY}`, accept: "application/json" },
  });
  const events = ((await response.json()) as { data?: Array<{ event_id: string; event_type: string; occurred_at: string; data: Json }> }).data ?? [];
  const mine = events.filter((event) => ids.has(String(event.data.id)) || ids.has(String(event.data.subscription_id)) || ids.has(String(event.data.transaction_id)));
  dump("events", mine);
  for (const event of mine) {
    const scheduled = event.data.scheduled_change as { action?: string } | null | undefined;
    const detail = event.event_type.startsWith("subscription.") ? `status=${String(event.data.status)} scheduled=${scheduled?.action ?? "null"}` : `status=${String(event.data.status)}`;
    line(`   ${event.occurred_at}  ${event.event_type.padEnd(28)} ${String(event.data.id)}  ${detail}`);
  }
}

async function cleanUp(created: Created): Promise<void> {
  heading("Cleaning up");
  const attempt = async (label: string, method: "POST" | "PATCH", path: string, body: Json) => {
    const result = await api(method, path, body).catch((error: unknown) => ({ status: 0, data: null, error: { code: "exception", detail: error instanceof Error ? error.message : String(error) } }));
    line(`   ${label}: ${result.data ? `ok (status=${String(result.data.status)})` : `HTTP ${result.status} ${result.error?.code ?? ""}: ${result.error?.detail ?? ""}`}`);
  };
  for (const id of created.subscriptions) {
    const current = await api("GET", `/subscriptions/${id}`);
    if (current.data?.status === "canceled") line(`   subscription ${id}: already canceled`);
    else await attempt(`subscription ${id} cancel immediately`, "POST", `/subscriptions/${id}/cancel`, { effective_from: "immediately" });
  }
  for (const id of created.transactions) {
    const current = await api("GET", `/transactions/${id}`);
    const status = String(current.data?.status);
    if (["billed", "past_due", "ready", "draft"].includes(status)) await attempt(`transaction ${id} cancel (was ${status})`, "PATCH", `/transactions/${id}`, { status: "canceled" });
    else line(`   transaction ${id}: left as ${status}`);
  }
  for (const id of created.prices) await attempt(`price ${id} archive`, "PATCH", `/prices/${id}`, { status: "archived" });
  if (created.product) await attempt(`product ${created.product} archive`, "PATCH", `/products/${created.product}`, { status: "archived" });
  if (created.customer && created.address) await attempt(`address ${created.address} archive`, "PATCH", `/customers/${created.customer}/addresses/${created.address}`, { status: "archived" });
  if (created.customer) await attempt(`customer ${created.customer} archive`, "PATCH", `/customers/${created.customer}`, { status: "archived" });

  heading("Final state of everything this run created");
  const final = async (label: string, path: string) => {
    const result = await api("GET", path);
    line(`   ${label}: ${result.data ? String(result.data.status) : `HTTP ${result.status}`}`);
  };
  if (created.product) await final(`product ${created.product}`, `/products/${created.product}`);
  for (const id of created.prices) await final(`price ${id}`, `/prices/${id}`);
  if (created.customer) await final(`customer ${created.customer}`, `/customers/${created.customer}`);
  if (created.customer && created.address) await final(`address ${created.address}`, `/customers/${created.customer}/addresses/${created.address}`);
  for (const id of created.transactions) await final(`transaction ${id}`, `/transactions/${id}`);
  for (const id of created.subscriptions) await final(`subscription ${id}`, `/subscriptions/${id}`);
}

async function main(): Promise<void> {
  assertSandbox();
  if (!process.env.PADDLE_API_KEY) throw new Error("PADDLE_API_KEY is not set.");
  line(`Paddle sandbox verification${WRITE ? " — WRITE scenario enabled" : " — read-only (add --write for the write scenario)"}`);
  await readOnlyChecks();
  if (!WRITE) return;

  const created: Created = { prices: [], transactions: [], subscriptions: [] };
  const startedAt = new Date(Date.now() - 5_000);
  try {
    await writeScenario(created, startedAt);
  } finally {
    await cleanUp(created);
  }
}

main()
  .catch((error: unknown) => {
    console.error(`paddle:verify-sandbox failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    // The billing modules open a database pool when they are imported.
    const { pg } = await import("../src/db");
    await pg.end({ timeout: 5 });
  });
