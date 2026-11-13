import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, unstable_cache: (fn: unknown) => fn }));

import { db } from "@/db";
import { organizations, subscriptions } from "@/db/schema";
import { notificationsConfig } from "@/features/notifications/config";
import { listRenewalsDue, renewalDue, renewalPaidWith, renewalPeriodKey, renewalPrice, type RenewalSubscription } from "@/features/notifications/content/renewal";
import { runFanout } from "@/features/notifications/fanout";
import { updateNotificationPrefs } from "@/features/notifications/prefs";
import { unsubscribe } from "@/features/notifications/unsubscribe";
import { resetDatabase } from "../helpers/db";
import { addWorkspaceMember, createWorkspace, eventsNamed, jobsOfType, logRows, plainText, scheduledEmails, send, setPlan, urlsIn, type PlanOptions, type Workspace } from "./helpers";

/**
 * The annual-renewal reminder: yearly subscriptions about to renew (6 to 8 days ahead),
 * active and not cancelled or paused, once per paid period, to the workspace's owners.
 */
const DAY = 86_400_000;
const at = (iso: string) => new Date(iso);
/** The paid year ends on Friday 27 November 2026 at 10:00. */
const PERIOD_END = at("2026-11-27T10:00:00Z");
const PERIOD = "2026-11-27";
const eight = (day: string) => at(`${day}T08:00:00Z`);
const paddleRaw = (overrides: Record<string, unknown> = {}) => ({
  id: "sub_test",
  status: "active",
  next_billed_at: PERIOD_END.toISOString(),
  scheduled_change: null,
  items: [{ quantity: 1, price: { id: "pri_test_pro_annual", unit_price: { amount: "149000", currency_code: "GBP" } } }],
  ...overrides,
});
const base: RenewalSubscription = {
  organizationId: "org",
  status: "active",
  planKey: "pro",
  priceId: "pri_test_pro_annual",
  billingInterval: "year",
  quantity: 1,
  currentPeriodEnd: PERIOD_END,
  cancelAt: null,
  pauseAt: null,
  canceledAt: null,
  pausedAt: null,
  paymentMethod: { type: "card", cardBrand: "visa", last4: "4242", expiryMonth: 1, expiryYear: 2028 },
  raw: paddleRaw(),
};
const before = (ms: number) => new Date(PERIOD_END.getTime() - ms);

describe("which subscriptions are about to renew (pure)", () => {
  it("is due from 8 days down to 6 days before the paid period ends", () => {
    expect(notificationsConfig.renewal.windowDays).toEqual({ min: 6, max: 8 });
    expect(renewalDue(base, before(7 * DAY))).toBe(true);
    expect(renewalDue(base, before(8 * DAY))).toBe(true);
    expect(renewalDue(base, before(8 * DAY + 1))).toBe(false);
    expect(renewalDue(base, before(6 * DAY))).toBe(true);
    expect(renewalDue(base, before(6 * DAY - 1))).toBe(false);
    expect(renewalDue(base, before(9 * DAY))).toBe(false);
    expect(renewalDue(base, before(5 * DAY))).toBe(false);
    expect(renewalDue(base, before(-DAY))).toBe(false); // already past
  });

  it("only yearly, active subscriptions that will actually renew", () => {
    const now = before(7 * DAY);
    expect(renewalDue({ ...base, billingInterval: "month" }, now)).toBe(false);
    expect(renewalDue({ ...base, billingInterval: null }, now)).toBe(false);
    for (const status of ["trialing", "past_due", "paused", "canceled", "unknown"]) expect(renewalDue({ ...base, status }, now)).toBe(false);
    expect(renewalDue({ ...base, cancelAt: PERIOD_END }, now)).toBe(false); // cancellation scheduled
    expect(renewalDue({ ...base, pauseAt: PERIOD_END }, now)).toBe(false); // pause scheduled
    expect(renewalDue({ ...base, canceledAt: before(30 * DAY) }, now)).toBe(false);
    expect(renewalDue({ ...base, pausedAt: before(30 * DAY) }, now)).toBe(false);
    expect(renewalDue({ ...base, currentPeriodEnd: null }, now)).toBe(false);
    // What only Paddle's last payload knows: a scheduled pause, or no next billing date.
    expect(renewalDue({ ...base, raw: paddleRaw({ scheduled_change: { action: "pause", effective_at: PERIOD_END.toISOString() } }) }, now)).toBe(false);
    expect(renewalDue({ ...base, raw: paddleRaw({ scheduled_change: { action: "cancel" } }) }, now)).toBe(false);
    expect(renewalDue({ ...base, raw: paddleRaw({ next_billed_at: null }) }, now)).toBe(false);
    // The payload is only ever a reason NOT to remind: without it the columns decide.
    expect(renewalDue({ ...base, raw: null }, now)).toBe(true);
    expect(renewalDue({ ...base, raw: "not an object" }, now)).toBe(true);
    expect(renewalDue({ ...base, raw: paddleRaw({ scheduled_change: { action: "resume" } }) }, now)).toBe(true);
  });

  it("keys the reminder on the UK day the period ends, and quotes a price only when it is known", () => {
    expect(renewalPeriodKey(base)).toBe("2026-11-27");
    expect(renewalPeriodKey({ currentPeriodEnd: at("2026-11-26T23:30:00Z") })).toBe("2026-11-26");
    expect(renewalPeriodKey({ currentPeriodEnd: at("2027-06-10T23:30:00Z") })).toBe("2027-06-11"); // 00:30 BST

    expect(renewalPrice(base)).toBe("£1,490");
    expect(renewalPrice({ ...base, raw: paddleRaw({ items: [{ quantity: 2, price: { id: "pri_test_pro_annual", unit_price: { amount: "149000", currency_code: "GBP" } } }] }) })).toBe("£2,980");
    expect(renewalPrice({ ...base, raw: paddleRaw({ items: [{ quantity: 1, price: { id: "pri_test_pro_annual", unit_price: { amount: "29050", currency_code: "GBP" } } }] }) })).toBe("£290.50");
    expect(renewalPrice({ ...base, raw: paddleRaw({ items: [{ quantity: 1, price: { id: "pri_test_pro_annual", unit_price: { amount: "99000", currency_code: "eur" } } }] }) })).toBe("€990");
    // A discount means the charge differs from the list price: say nothing rather than a wrong figure.
    expect(renewalPrice({ ...base, raw: paddleRaw({ discount: { id: "dsc_1" } }) })).toBeNull();
    expect(renewalPrice({ ...base, raw: null })).toBeNull();
    expect(renewalPrice({ ...base, raw: paddleRaw({ items: [] }) })).toBeNull();
    expect(renewalPrice({ ...base, raw: paddleRaw({ items: [{ price: { id: "other", unit_price: { amount: "abc", currency_code: "GBP" } } }] }) })).toBeNull();
    // "Paid with": the non-sensitive summary only, re-validated; nothing when no payment told us.
    expect(renewalPaidWith(base)).toBe("Visa ending 4242");
    expect(renewalPaidWith({ paymentMethod: { type: "paypal", cardBrand: null, last4: null, expiryMonth: null, expiryYear: null } })).toBe("PayPal");
    expect(renewalPaidWith({ paymentMethod: null })).toBeNull();
    expect(renewalPaidWith({ paymentMethod: { type: "card", cardBrand: "visa", last4: "4242 1111 2222 3333", holder: "J PIKE" } })).toBe("Visa");
    expect(renewalPaidWith({ paymentMethod: "Visa ending 4242 <script>" })).toBeNull();
    // Two items: only the one the subscription's price id names counts.
    const twoItems = paddleRaw({ items: [{ quantity: 1, price: { id: "pri_addon", unit_price: { amount: "5000", currency_code: "GBP" } } }, { quantity: 1, price: { id: "pri_test_pro_annual", unit_price: { amount: "149000", currency_code: "GBP" } } }] });
    expect(renewalPrice({ ...base, raw: twoItems })).toBe("£1,490");
    expect(renewalPrice({ ...base, priceId: "pri_unknown", raw: twoItems })).toBeNull();
  });
});

describe("the reminder", () => {
  let a: Workspace;
  const of = (workspace: Workspace, user = workspace.owner) => ({ organizationId: workspace.organizationId, userId: user.id });
  const yearly = (overrides: Parameters<typeof setPlan>[1] = {}) => ({ planKey: "pro" as const, interval: "year" as const, periodEnd: PERIOD_END, raw: paddleRaw(), paymentMethod: base.paymentMethod as PlanOptions["paymentMethod"], ...overrides });

  beforeEach(async () => {
    await resetDatabase();
    a = await createWorkspace({ name: "Joanne Pike", plan: yearly() });
  });

  it("is queued by the daily run on the first day the renewal is at most 8 days away, and only once", async () => {
    const monthly = await createWorkspace({ name: "Monthly Workspace", plan: yearly({ interval: "month" }) });
    const cancelling = await createWorkspace({ name: "Cancelling Workspace", plan: yearly({ cancelAt: PERIOD_END }) });
    const farOff = await createWorkspace({ name: "Far Off Workspace", plan: yearly({ periodEnd: at("2027-05-01T10:00:00Z") }) });

    const queuedOn: Record<string, number> = {};
    for (let day = 15; day <= 27; day += 1) {
      const now = eight(`2026-11-${day}`);
      const result = await runFanout({ kind: "renewal", period: `2026-11-${day}` }, { now });
      if (result.enqueued > 0) queuedOn[`2026-11-${day}`] = result.enqueued;
    }
    // Friday 20 November 08:00 is 7 days and 2 hours before the renewal: at least 7 days' notice.
    expect(queuedOn).toEqual({ "2026-11-20": 1 });
    const sends = await jobsOfType("notifications.send");
    expect(sends).toHaveLength(1);
    expect(sends[0]).toMatchObject({ dedupeKey: `renewal:${a.organizationId}:${a.owner.id}:${PERIOD}`, payload: { kind: "renewal", period: PERIOD, ...of(a) } });
    expect((await listRenewalsDue(eight("2026-11-20"))).map((row) => row.organizationId)).toEqual([a.organizationId]);
    expect(await listRenewalsDue(eight("2026-11-19"))).toEqual([]);
    for (const other of [monthly, cancelling, farOff]) expect(sends.some((job) => job.payload.organizationId === other.organizationId)).toBe(false);
  });

  it("says when and for how much, how to pause or cancel, and nothing about refunds", async () => {
    const friday = eight("2026-11-20");
    expect(await send("renewal", PERIOD, of(a), friday)).toBe("sent");
    const [email] = await scheduledEmails(a.owner.email);
    expect(email).toMatchObject({ template: "renewal-reminder", subject: "Your Bid Desk annual plan renews in 7 days" });
    const body = plainText(email!.html);
    for (const text of [body, email!.text.replace(/\s+/g, " ")]) {
      expect(text.includes("Joanne,"), "greeting").toBe(true);
      expect(text.includes("Your Bid Desk annual plan renews on 27 Nov 2026 for £1,490 (plus VAT where it applies)."), "headline").toBe(true);
      expect(text.includes("Bid Desk, annual"), "plan").toBe(true);
      expect(text.includes("£1,490 a year, excluding VAT. VAT is added where it applies."), "price").toBe(true);
      expect(text.includes("Nothing to do if you want to carry on. Pause or cancel in two clicks from Billing. You keep access until the end of the period you have paid for."), "body").toBe(true);
      expect(text.includes("Open Billing"), "billing link").toBe(true);
      expect(text.includes("We email this reminder seven days before an annual plan renews. Reply to this email if anything looks wrong."), "reason and sign-off").toBe(true);
      expect(text.includes("Bidfolio is operated by [[COMPANY_LEGAL_NAME]]"), "identity").toBe(true);
      // The 14-day refund covers a first payment only: it has no place in a renewal notice.
      expect(/refund|14[- ]day|money back/i.test(text), "refund wording").toBe(false);
    }
    // The facts, as on the artboard. (The automatic "Joanne's workspace" is not worth a row.)
    expect(email!.text.includes("Plan: Bid Desk, annual\nPrice: £1,490 a year, excluding VAT. VAT is added where it applies.\nRenews on: 27 Nov 2026\nPaid with: Visa ending 4242\n\n"), "facts in the text version").toBe(true);
    expect(/Workspace/.test(body), "a row for the automatic workspace name").toBe(false);
    // One link, to Billing. A billing notice has no unsubscribe link in its footer, but mail clients get the header.
    expect(urlsIn(email!.html).filter((url) => !url.includes("/email/mark"))).toEqual(["http://localhost:3000/app/settings/billing"]);
    expect(email!.headers).toMatchObject({ "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
    expect(await eventsNamed("reminder_sent")).toEqual([expect.objectContaining({ organizationId: a.organizationId, userId: a.owner.id, properties: { type: "renewal", items: 1 } })]);
    expect(await logRows({ kind: "renewal" })).toEqual([expect.objectContaining({ status: "sent", periodKey: PERIOD, itemCount: 1 })]);
  });

  it("leaves out what it does not know, and names the workspace when that says something", async () => {
    await setPlan(a.organizationId, yearly({ raw: null, paymentMethod: null }));
    // A workspace somebody named (not the automatic "Joanne's workspace").
    await db.update(organizations).set({ name: "Aldermoor & Pike", metadata: null }).where(eq(organizations.id, a.organizationId));
    expect(await send("renewal", PERIOD, of(a), eight("2026-11-20"))).toBe("sent");
    const [email] = await scheduledEmails(a.owner.email);
    const body = plainText(email!.html);
    expect(body.includes("Your Bid Desk annual plan renews on 27 Nov 2026."), "headline without a price").toBe(true);
    expect(/£|Price|Paid with/.test(body), "an invented amount or payment method").toBe(false);
    expect(email!.text.includes("Plan: Bid Desk, annual\nRenews on: 27 Nov 2026\nWorkspace: Aldermoor & Pike\n"), "facts").toBe(true);
  });

  it("goes once per paid period, even if the daily run comes round again or was missed", async () => {
    expect(await send("renewal", PERIOD, of(a), eight("2026-11-20"))).toBe("sent");
    expect(await send("renewal", PERIOD, of(a), eight("2026-11-21"))).toBe("already_done");
    expect(await runFanout({ kind: "renewal", period: "2026-11-21" }, { now: eight("2026-11-21") })).toEqual({ status: "done", enqueued: 1 });
    expect(await send("renewal", PERIOD, of(a), eight("2026-11-21"))).toBe("already_done");
    expect(await scheduledEmails(a.owner.email)).toHaveLength(1);

    // Friday's run was missed for another workspace: Saturday still reminds it (6 days and 2 hours ahead).
    const missed = await createWorkspace({ name: "Missed Friday", plan: yearly() });
    expect(await runFanout({ kind: "renewal", period: "2026-11-21" }, { now: eight("2026-11-21") })).toEqual({ status: "done", enqueued: 1 });
    // A job made for a period the subscription is not in sends nothing.
    expect(await send("renewal", "2026-11-28", of(missed), eight("2026-11-21"))).toBe("not_eligible");
    expect(await send("renewal", PERIOD, of(missed), eight("2026-11-21"))).toBe("sent");
    // Too late is too late: on Sunday the window has closed.
    const late = await createWorkspace({ name: "Too Late", plan: yearly() });
    expect(await send("renewal", PERIOD, of(late), eight("2026-11-22"))).toBe("not_eligible");

    // A year on, the next period gets its own reminder.
    await setPlan(a.organizationId, yearly({ periodEnd: at("2027-11-27T10:00:00Z"), periodStart: PERIOD_END }));
    expect(await send("renewal", PERIOD, of(a), eight("2027-11-20"))).toBe("already_done"); // last year's job
    expect(await send("renewal", "2027-11-27", of(a), eight("2027-11-20"))).toBe("sent");
    expect((await logRows(of(a))).map((row) => [row.periodKey, row.status])).toEqual([
      ["2026-11-27", "sent"],
      ["2027-11-27", "sent"],
    ]);
  });

  it("is for owners only, and for each of them", async () => {
    const member = await addWorkspaceMember(a, { name: "Mia Member" });
    const admin = await addWorkspaceMember(a, { name: "Adam Admin", role: "admin" });
    const coOwner = await addWorkspaceMember(a, { name: "Olga Owner", role: "owner" });
    const friday = eight("2026-11-20");
    expect(await runFanout({ kind: "renewal", period: "2026-11-20" }, { now: friday })).toEqual({ status: "done", enqueued: 2 });
    expect((await jobsOfType("notifications.send")).map((job) => job.payload.userId).sort()).toEqual([a.owner.id, coOwner.id].sort());
    expect(await send("renewal", PERIOD, of(a, member), friday)).toBe("not_eligible");
    expect(await send("renewal", PERIOD, of(a, admin), friday)).toBe("not_eligible");
    expect(await send("renewal", PERIOD, of(a, coOwner), friday)).toBe("sent");
    expect(await send("renewal", PERIOD, of(a), friday)).toBe("sent");
    expect((await scheduledEmails()).map((email) => email.to).sort()).toEqual([a.owner.email, coOwner.email].map((email) => email.toLowerCase()).sort());
  });

  it("is not sent when the subscription stopped renewing after it was queued", async () => {
    const friday = eight("2026-11-20");
    await runFanout({ kind: "renewal", period: "2026-11-20" }, { now: friday });
    await db.update(subscriptions).set({ cancelAt: PERIOD_END }).where(eq(subscriptions.organizationId, a.organizationId));
    expect(await send("renewal", PERIOD, of(a), friday)).toBe("not_eligible");
    await db.update(subscriptions).set({ cancelAt: null, pauseAt: PERIOD_END }).where(eq(subscriptions.organizationId, a.organizationId));
    expect(await send("renewal", PERIOD, of(a), friday)).toBe("not_eligible"); // a pause scheduled for the end of the period
    await db.update(subscriptions).set({ pauseAt: null, status: "paused", pausedAt: friday }).where(eq(subscriptions.organizationId, a.organizationId));
    expect(await send("renewal", PERIOD, of(a), friday)).toBe("not_eligible");
    expect(await scheduledEmails()).toEqual([]);
    expect(await logRows()).toEqual([]);
  });

  it("has its own switch: stopping the other e-mails does not make a plan renew unannounced", async () => {
    const friday = eight("2026-11-20");
    await unsubscribe({ ...of(a), kind: "digest" }, "all", "page");
    expect(await runFanout({ kind: "renewal", period: "2026-11-20" }, { now: friday })).toEqual({ status: "done", enqueued: 1 });
    expect(await send("renewal", PERIOD, of(a), friday)).toBe("sent");

    const other = await createWorkspace({ name: "Renewal Off", plan: yearly() });
    await updateNotificationPrefs(other.owner.id, other.organizationId, { renewalReminders: false });
    expect(await runFanout({ kind: "renewal", period: "2026-11-21" }, { now: eight("2026-11-21") })).toEqual({ status: "done", enqueued: 0 });
    expect(await send("renewal", PERIOD, of(other), friday)).toBe("skipped_pref");
    expect(await scheduledEmails(other.owner.email)).toEqual([]);
  });
});
