import { and, eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("../helpers/next-headers"));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, unstable_cache: (fn: unknown) => fn }));
// The header's "Sign in / Open your radar" island is browser code; the page is tested without it.
vi.mock("@/components/marketing/header-session-link", () => ({ HeaderSessionLink: () => null }));
// The header's links are NavLinks, which ask the router where we are.
vi.mock("next/navigation", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/navigation")>()), usePathname: () => "/unsubscribe" }));

import { GET, POST } from "@/app/api/notifications/unsubscribe/route";
import UnsubscribePage from "@/app/unsubscribe/page";
import { db } from "@/db";
import { emailOutbox, notificationLog, notificationPrefs, users } from "@/db/schema";
import { resubscribeAction, sendNotificationPreviewAction, updateNotificationPrefsAction } from "@/features/notifications/actions";
import { unsubscribeLinks } from "@/features/notifications/links";
import { DEFAULT_PREFS, getNotificationPrefs, kindsTurnedOff, setDigestPreference, updateNotificationPrefs, wantsKind, wantsNotification } from "@/features/notifications/prefs";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "@/features/notifications/tokens";
import { resubscribeFromLink, unsubscribe, unsubscribeView } from "@/features/notifications/unsubscribe";
import { sanitizeAnalyticsUrl } from "@/lib/analytics-url";
import { deleteAccount } from "@/server/tenant-data";
import { route } from "@/server/http";
import { actAs, addMember, createTestUser, type TestUser } from "../helpers/auth";
import { resetDatabase } from "../helpers/db";
import { addWorkspaceMember, createWorkspace, eventsNamed, removeMember, type Workspace } from "./helpers";

/**
 * Unsubscribe and preferences: the signed link works signed-out and without JavaScript,
 * opening it changes nothing, the POST is idempotent, a forged token does nothing, and
 * nobody can use it to find out who has an account.
 */
const ENDPOINT = "http://localhost:3000/api/notifications/unsubscribe";
let a: Workspace;
let user: TestUser;
const subject = (kind: "digest" | "alert" | "reminder" | "renewal" | "product" = "digest") => ({ userId: user.id, organizationId: a.organizationId, kind });
const tokenFor = (kind: Parameters<typeof subject>[0] = "digest", email: string | null = user.email) => signUnsubscribeToken({ ...subject(kind), email });
const prefs = () => getNotificationPrefs(user.id, a.organizationId);
const rows = () => db.select().from(notificationPrefs);

/** What a mail client sends for RFC 8058 one-click: a bare POST, no cookies, no Origin. */
const oneClick = (token: string, init: { body?: BodyInit | null; headers?: Record<string, string> } = {}) =>
  POST(
    new Request(`${ENDPOINT}?t=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", ...init.headers },
      body: init.body === undefined ? "List-Unsubscribe=One-Click" : init.body,
    }),
    {},
  );
/** What the page's form sends: the token in a hidden field, and which button was pressed. */
const pageForm = (fields: Record<string, string>) =>
  POST(new Request(ENDPOINT, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: "http://localhost:3000" }, body: new URLSearchParams(fields).toString() }), {});

beforeEach(async () => {
  await resetDatabase();
  a = await createWorkspace({ name: "Joanne Pike", email: "joanne@aldermoor-pike.example" });
  user = a.owner;
  actAs(null);
});

describe("preferences", () => {
  it("a missing row means the defaults: everything on", async () => {
    expect(await rows()).toEqual([]);
    expect(await prefs()).toEqual({ weeklyDigest: true, dailyAlerts: true, deadlineReminders: true, productEmails: true, renewalReminders: true, unsubscribedAllAt: null });
    expect(DEFAULT_PREFS).toEqual(await prefs());
    for (const kind of ["digest", "alert", "reminder", "renewal", "product"] as const) expect(await wantsNotification(user.id, a.organizationId, kind)).toBe(true);
  });

  it("setDigestPreference stores the sign-up form's choice", async () => {
    await setDigestPreference(user.id, a.organizationId, false);
    expect(await prefs()).toMatchObject({ weeklyDigest: false, dailyAlerts: true, deadlineReminders: true, productEmails: true });
    expect(await wantsNotification(user.id, a.organizationId, "digest")).toBe(false);
    await setDigestPreference(user.id, a.organizationId, false);
    await setDigestPreference(user.id, a.organizationId, true);
    expect((await prefs()).weeklyDigest).toBe(true);
    expect(await rows()).toHaveLength(1);
    // The tick box left ticked stores the default, which is harmless.
    const other = await createWorkspace({});
    await setDigestPreference(other.owner.id, other.organizationId, true);
    expect(await getNotificationPrefs(other.owner.id, other.organizationId)).toMatchObject({ weeklyDigest: true });
  });

  it("switches are per member and per workspace", async () => {
    const colleague = await addWorkspaceMember(a);
    const { before, after } = await updateNotificationPrefs(user.id, a.organizationId, { weeklyDigest: false, deadlineReminders: false });
    expect(kindsTurnedOff(before, after).sort()).toEqual(["digest", "reminder"]);
    expect(await getNotificationPrefs(colleague.id, a.organizationId)).toEqual(DEFAULT_PREFS);
    expect(await getNotificationPrefs(user.id, colleague.organizationId)).toEqual(DEFAULT_PREFS);
    // "Unsubscribe from all" covers the optional e-mails; the renewal notice keeps its own switch.
    const stopped = { ...DEFAULT_PREFS, unsubscribedAllAt: new Date() };
    expect((["digest", "alert", "reminder", "product"] as const).map((kind) => wantsKind(stopped, kind))).toEqual([false, false, false, false]);
    expect(wantsKind(stopped, "renewal")).toBe(true);
    expect(wantsKind({ ...stopped, renewalReminders: false }, "renewal")).toBe(false);
  });
});

describe("one-click unsubscribe (RFC 8058)", () => {
  it("GET changes nothing: it leads to the confirmation page", async () => {
    const token = tokenFor();
    const response = await GET(new Request(`${ENDPOINT}?t=${token}`), {});
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`/unsubscribe?t=${token}`);
    expect(await rows()).toEqual([]);
    expect(await eventsNamed("notification_unsubscribed")).toEqual([]);
    // Whatever a scanner sends, a GET never writes.
    for (const query of ["", "?t=garbage", `?t=${token}&scope=all&action=unsubscribe`]) expect((await GET(new Request(`${ENDPOINT}${query}`), {})).status).toBe(303);
    expect(await rows()).toEqual([]);
  });

  it("the mail client's POST switches off the kind the link came with, once", async () => {
    const response = await oneClick(tokenFor());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(await prefs()).toMatchObject({ weeklyDigest: false, dailyAlerts: true, deadlineReminders: true, productEmails: true, renewalReminders: true, unsubscribedAllAt: null });
    expect(await eventsNamed("notification_unsubscribed")).toEqual([expect.objectContaining({ organizationId: a.organizationId, userId: user.id, properties: { kind: "digest", scope: "kind", via: "one_click" } })]);

    // Idempotent: providers retry, people click twice.
    for (let attempt = 0; attempt < 3; attempt += 1) expect((await oneClick(tokenFor())).status).toBe(200);
    expect(await rows()).toHaveLength(1);
    expect(await eventsNamed("notification_unsubscribed")).toHaveLength(1);

    // Each kind has its own link.
    expect((await oneClick(tokenFor("reminder"))).status).toBe(200);
    expect(await prefs()).toMatchObject({ weeklyDigest: false, deadlineReminders: false, dailyAlerts: true });
  });

  it("accepts the request as mail providers send it: any body encoding, no cookies, any origin", async () => {
    expect((await oneClick(tokenFor("alert"), { body: null })).status).toBe(200);
    const multipart = new FormData();
    multipart.set("List-Unsubscribe", "One-Click");
    expect((await POST(new Request(`${ENDPOINT}?t=${tokenFor("reminder")}`, { method: "POST", body: multipart }), {})).status).toBe(200);
    // No session, and deliberately no CSRF check: the signed token is the credential.
    expect((await oneClick(tokenFor("product"), { headers: { origin: "https://mail.google.com", "sec-fetch-site": "cross-site" } })).status).toBe(200);
    expect(await prefs()).toMatchObject({ dailyAlerts: false, deadlineReminders: false, productEmails: false, weeklyDigest: true });
    // …which an ordinary cookie-authenticated handler would refuse.
    const ordinary = route(async () => Response.json({ ok: true }));
    expect((await ordinary(new Request(ENDPOINT, { method: "POST", headers: { origin: "https://mail.google.com" } }), {})).status).toBe(403);
  });

  it("a forged or damaged token changes nothing", async () => {
    const token = tokenFor();
    const [payload, signature] = token.split(".") as [string, string];
    const victim = await createWorkspace({ name: "Victor Victim" });
    const forged = `${Buffer.from(`${victim.owner.id}\n${victim.organizationId}\ndigest`).toString("base64url")}.${signature}`;
    for (const bad of [forged, `${payload}.${"A".repeat(43)}`, `${token}x`, token.slice(0, -2), "garbage", ""]) {
      const response = await oneClick(bad);
      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatchObject({ code: "VALIDATION", message: "This unsubscribe link is not valid." });
    }
    // From the page's form the answer is the page again, with no token and nothing done.
    const fromPage = await pageForm({ t: forged, scope: "all" });
    expect(fromPage.status).toBe(303);
    expect(fromPage.headers.get("location")).toBe("/unsubscribe");
    expect(await rows()).toEqual([]);
    expect(await eventsNamed("notification_unsubscribed")).toEqual([]);
    expect(await getNotificationPrefs(victim.owner.id, victim.organizationId)).toEqual(DEFAULT_PREFS);
    // Only the documented form fields are accepted.
    expect((await pageForm({ t: token, scope: "everything" })).status).toBe(400);
    expect((await pageForm({ t: token, action: "delete" })).status).toBe(400);
    expect(await rows()).toEqual([]);
  });

  it("answers the same whether or not the account still exists, and leaves no row for one that does not", async () => {
    const leaver = await addWorkspaceMember(a, { name: "Leo Leaver" });
    const leaverToken = signUnsubscribeToken({ userId: leaver.id, organizationId: a.organizationId, kind: "digest", email: leaver.email });
    await removeMember(a.organizationId, leaver.id);
    const gone = await createTestUser({ name: "Gone Person" });
    const goneToken = signUnsubscribeToken({ userId: gone.id, organizationId: gone.organizationId, kind: "digest", email: gone.email });
    await deleteAccount(gone.id);

    const existing = await oneClick(tokenFor());
    for (const token of [leaverToken, goneToken]) {
      const response = await oneClick(token);
      expect(response.status).toBe(existing.status);
      expect(await response.json()).toEqual({ ok: true });
      const form = await pageForm({ t: token, scope: "all" });
      expect([form.status, form.headers.get("location")]).toEqual([303, `/unsubscribe?t=${token}&done=all`]);
      expect(await unsubscribeView(verifyUnsubscribeToken(token)!)).toEqual({ member: false });
    }
    // Only the real member has a row; nothing was stored (or tracked) for the other two.
    expect((await rows()).map((row) => row.userId)).toEqual([user.id]);
    expect(await eventsNamed("notification_unsubscribed")).toHaveLength(1);
  });
});

describe("the confirmation page's form", () => {
  it("'Unsubscribe' stops e-mails to the address: every workspace the person is in", async () => {
    const second = await createWorkspace({ name: "Second Workspace" });
    await addMember(second.organizationId, user, "member");
    const response = await pageForm({ t: tokenFor(), scope: "all" });
    expect([response.status, response.headers.get("location")]).toEqual([303, `/unsubscribe?t=${tokenFor()}&done=all`]);

    const here = await prefs();
    const there = await getNotificationPrefs(user.id, second.organizationId);
    expect(here.unsubscribedAllAt).toBeInstanceOf(Date);
    expect(there.unsubscribedAllAt).toEqual(here.unsubscribedAllAt);
    // The kind the link came with is switched off where it came from; the other workspace's switches are untouched.
    expect(here.weeklyDigest).toBe(false);
    expect(there).toMatchObject({ weeklyDigest: true, dailyAlerts: true, deadlineReminders: true });
    for (const organizationId of [a.organizationId, second.organizationId]) {
      for (const kind of ["digest", "alert", "reminder", "product"] as const) expect(await wantsNotification(user.id, organizationId, kind)).toBe(false);
      expect(await wantsNotification(user.id, organizationId, "renewal")).toBe(true);
    }
    // Nobody else is affected.
    expect(await getNotificationPrefs(second.owner.id, second.organizationId)).toEqual(DEFAULT_PREFS);
    expect(await eventsNamed("notification_unsubscribed")).toEqual([expect.objectContaining({ properties: { kind: "digest", scope: "all", via: "page" } })]);
    // Pressing it again changes nothing more.
    await pageForm({ t: tokenFor(), scope: "all" });
    expect((await prefs()).unsubscribedAllAt).toEqual(here.unsubscribedAllAt);
    expect(await eventsNamed("notification_unsubscribed")).toHaveLength(1);
  });

  it("'Only stop this kind' leaves everything else on", async () => {
    const response = await pageForm({ t: tokenFor("reminder"), scope: "kind" });
    expect(response.headers.get("location")).toBe(`/unsubscribe?t=${tokenFor("reminder")}&done=kind`);
    expect(await prefs()).toMatchObject({ deadlineReminders: false, weeklyDigest: true, dailyAlerts: true, productEmails: true, unsubscribedAllAt: null });
    expect(await unsubscribeView(verifyUnsubscribeToken(tokenFor("reminder"))!)).toEqual({ member: true, email: user.email, subscribed: false, all: false });
    expect(await unsubscribeView(verifyUnsubscribeToken(tokenFor("digest"))!)).toEqual({ member: true, email: user.email, subscribed: true, all: false });
  });

  it("from a renewal notice, 'Unsubscribe' stops the renewal notice too", async () => {
    await pageForm({ t: tokenFor("renewal"), scope: "all" });
    expect(await prefs()).toMatchObject({ renewalReminders: false, weeklyDigest: true });
    expect((await prefs()).unsubscribedAllAt).toBeInstanceOf(Date);
    expect(await wantsNotification(user.id, a.organizationId, "renewal")).toBe(false);
  });

  it("'Subscribe again' puts back exactly what the link took away", async () => {
    const second = await createWorkspace({ name: "Second Workspace" });
    const third = await createWorkspace({ name: "Third Workspace" });
    await addMember(second.organizationId, user, "member");
    await addMember(third.organizationId, user, "member");
    // The third workspace was unsubscribed earlier, on its own.
    await unsubscribe({ userId: user.id, organizationId: third.organizationId, kind: "alert" }, "kind", "page");
    await db
      .update(notificationPrefs)
      .set({ unsubscribedAllAt: new Date("2026-01-01T00:00:00Z") })
      .where(and(eq(notificationPrefs.userId, user.id), eq(notificationPrefs.organizationId, third.organizationId)));

    await pageForm({ t: tokenFor(), scope: "all" });
    const back = await pageForm({ t: tokenFor(), action: "resubscribe" });
    expect([back.status, back.headers.get("location")]).toEqual([303, `/unsubscribe?t=${tokenFor()}&done=back`]);
    expect(await prefs()).toMatchObject({ weeklyDigest: true, unsubscribedAllAt: null });
    expect((await getNotificationPrefs(user.id, second.organizationId)).unsubscribedAllAt).toBeNull();
    // What an earlier, separate request stopped stays stopped.
    expect(await getNotificationPrefs(user.id, third.organizationId)).toMatchObject({ dailyAlerts: false, unsubscribedAllAt: new Date("2026-01-01T00:00:00Z") });
    expect(await unsubscribeView(verifyUnsubscribeToken(tokenFor())!)).toMatchObject({ subscribed: true, all: false });
    // Again: nothing to put back, nothing changes.
    expect(await resubscribeFromLink(verifyUnsubscribeToken(tokenFor())!)).toEqual({ changed: false });
  });

  it("a link from an old mailbox can stop e-mails but never shows the new address or switches anything on", async () => {
    const oldToken = tokenFor("digest", "joanne@previous-employer.example");
    const untagged = tokenFor("digest", null);
    for (const token of [oldToken, untagged]) {
      expect(await unsubscribeView(verifyUnsubscribeToken(token)!)).toEqual({ member: true, email: null, subscribed: true, all: false });
      // Unsubscribing is honoured for whoever holds the link.
      expect((await pageForm({ t: token, scope: "kind" })).status).toBe(303);
      expect((await prefs()).weeklyDigest).toBe(false);
      // Switching back on is not.
      expect((await pageForm({ t: token, action: "resubscribe" })).status).toBe(303);
      expect((await prefs()).weeklyDigest).toBe(false);
      expect(await resubscribeFromLink(verifyUnsubscribeToken(token)!)).toEqual({ changed: false });
      // The link sent to the address the account has now can.
      expect(await resubscribeFromLink(verifyUnsubscribeToken(tokenFor())!)).toEqual({ changed: true });
      expect((await prefs()).weeklyDigest).toBe(true);
    }
    // After the address on the account changes, yesterday's link is an old-mailbox link.
    await db.update(users).set({ email: "joanne@new-employer.example" }).where(eq(users.id, user.id));
    expect(await unsubscribeView(verifyUnsubscribeToken(tokenFor("digest", "joanne@aldermoor-pike.example"))!)).toMatchObject({ member: true, email: null });
    expect(unsubscribeLinks({ ...subject(), email: "joanne@new-employer.example" }).pageUrl).not.toContain("new-employer");
  });

  it("switching back on cannot be made to flap", async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) statuses.push((await pageForm({ t: tokenFor(), action: "resubscribe" })).status);
    expect(statuses.slice(0, 10).every((status) => status === 303)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
    // Unsubscribing is never rate-limited.
    expect((await oneClick(tokenFor())).status).toBe(200);
  });
});

describe("the page", () => {
  const render = async (query: { t?: string; done?: string }) => renderToStaticMarkup(await UnsubscribePage({ searchParams: Promise.resolve(query) }));
  const tags = (html: string, tag: string) => html.match(new RegExp(`<${tag}\\b[^>]*>(?:[^<]*</${tag}>)?`, "g")) ?? [];
  /** A submit button with these attributes and this label (attribute order is React's business). */
  const hasButton = (html: string, attributes: Record<string, string>, label: string) =>
    tags(html, "button").some((button) => button.includes('type="submit"') && Object.entries(attributes).every(([name, value]) => button.includes(`${name}="${value}"`)) && button.endsWith(`>${label}</button>`));
  const postsToEndpoint = (html: string) => tags(html, "form").filter((form) => form.includes('method="post"') && form.includes('action="/api/notifications/unsubscribe"')).length;

  it("asks before doing anything: one button, a second choice, a plain form", async () => {
    const token = tokenFor();
    const html = await render({ t: token });
    expect(await rows()).toEqual([]); // opening the page changed nothing
    expect(html.includes("Stop emails to this address?"), "heading").toBe(true);
    expect(html.includes("joanne@aldermoor-pike.example"), "address").toBe(true);
    // Works without JavaScript: a form posted to the endpoint, the token in a hidden field, two submit buttons.
    expect(postsToEndpoint(html), "one form, posted to the endpoint").toBe(1);
    expect(html.includes(`<input type="hidden" name="t" value="${token}"/>`), "token field").toBe(true);
    expect((html.match(/<button[^>]*type="submit"/g) ?? []).length).toBe(2);
    expect(hasButton(html, { name: "scope", value: "all" }, "Unsubscribe"), "the button").toBe(true);
    expect(hasButton(html, { name: "scope", value: "kind" }, "Only stop the weekly digest"), "second choice").toBe(true);
    expect(html.includes("Sign-in links") || html.includes("sign-in links"), "what is not affected").toBe(true);
    expect(/<script/i.test(html), "scripts in the page body").toBe(false);
    // Each kind is named in its own words.
    expect((await render({ t: tokenFor("reminder") })).includes("Only stop deadline reminders")).toBe(true);
    expect((await render({ t: tokenFor("alert") })).includes("Only stop daily alerts")).toBe(true);
  });

  it("then says what is stored: unsubscribed, with a way back", async () => {
    await pageForm({ t: tokenFor(), scope: "kind" });
    const kind = await render({ t: tokenFor(), done: "kind" });
    expect(kind.includes("You are unsubscribed"), "heading").toBe(true);
    expect(kind.includes("We will not send the weekly digest to"), "lead").toBe(true);
    expect(hasButton(kind, { name: "action", value: "resubscribe" }, "Subscribe again"), "subscribe again").toBe(true);
    expect(hasButton(kind, { name: "scope", value: "all" }, "Stop all emails"), "stop the rest").toBe(true);
    expect(postsToEndpoint(kind), "both are plain forms").toBe(2);
    expect(kind.includes("What we hold") && kind.includes("Have it removed"), "cards").toBe(true);
    expect(kind.includes("It is deleted after 13 months."), "retention stated").toBe(true);

    await pageForm({ t: tokenFor(), scope: "all" });
    const all = await render({ t: tokenFor(), done: "all" });
    expect(all.includes("We will not email") && all.includes("again, unless you ask us to."), "lead").toBe(true);
    expect(all.includes("Stop all emails"), "nothing further to stop").toBe(false);

    await pageForm({ t: tokenFor(), action: "resubscribe" });
    const back = await render({ t: tokenFor(), done: "back" });
    expect(back.includes("You are subscribed again"), "back").toBe(true);
    // The address bar does not decide what is shown: without a stored change the page still asks.
    expect((await render({ t: tokenFor(), done: "all" })).includes("Stop emails to this address?")).toBe(true);
  });

  it("gives one answer to every link that is not ours, and reveals nothing about accounts", async () => {
    const token = tokenFor();
    const [payload] = token.split(".");
    const invalid = await Promise.all([render({}), render({ t: "garbage" }), render({ t: `${payload}.${"A".repeat(43)}` }), render({ t: `${token}x` })]);
    expect(new Set(invalid).size).toBe(1);
    expect(invalid[0]!.includes("This link does not work"), "heading").toBe(true);
    expect(invalid[0]!.includes("joanne@"), "no address").toBe(false);
    expect(/<form/.test(invalid[0]!), "no form").toBe(false);

    // A valid link for someone who has left, or whose account is gone: "unsubscribed", no address, no switches.
    const gone = await createTestUser({ name: "Gone Person", email: "gone.person@example.com" });
    const goneToken = signUnsubscribeToken({ userId: gone.id, organizationId: gone.organizationId, kind: "digest", email: gone.email });
    await deleteAccount(gone.id);
    const html = await render({ t: goneToken });
    expect(html.includes("You are unsubscribed") && html.includes("We will not email this address again"), "generic confirmation").toBe(true);
    expect(html.includes("gone.person"), "address of a deleted account").toBe(false);
    expect(/<form/.test(html), "no form").toBe(false);
    expect(await rows()).toEqual([]);
  });
});

describe("Settings → Notifications (Server Actions)", () => {
  it("a member changes their own switches for the workspace of their session, nothing else", async () => {
    const colleague = await addWorkspaceMember(a);
    actAs(user);
    const result = await updateNotificationPrefsAction({ weeklyDigest: false });
    expect(result).toEqual({ ok: true, data: { weeklyDigest: false, dailyAlerts: true, deadlineReminders: true, productEmails: true, renewalReminders: true, unsubscribedAll: false } });
    expect(await getNotificationPrefs(colleague.id, a.organizationId)).toEqual(DEFAULT_PREFS);
    expect(await eventsNamed("notification_unsubscribed")).toEqual([expect.objectContaining({ organizationId: a.organizationId, userId: user.id, properties: { kind: "digest", scope: "kind", via: "settings" } })]);
    // Switching something on is not an unsubscribe.
    expect((await updateNotificationPrefsAction({ weeklyDigest: true })).ok).toBe(true);
    expect(await eventsNamed("notification_unsubscribed")).toHaveLength(1);

    // The workspace is never taken from the request.
    const smuggled = await updateNotificationPrefsAction({ weeklyDigest: false, organizationId: colleague.organizationId, userId: colleague.id });
    expect(smuggled).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    for (const bad of [{}, { weeklyDigest: "no" }, { unsubscribedAllAt: null }, null, "weeklyDigest"]) {
      expect(await updateNotificationPrefsAction(bad)).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    }
    expect((await rows()).map((row) => `${row.userId}:${row.organizationId}`)).toEqual([`${user.id}:${a.organizationId}`]);
  });

  it("needs a session; the renewal switch is the owner's", async () => {
    actAs(null);
    expect(await updateNotificationPrefsAction({ weeklyDigest: false })).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
    expect(await resubscribeAction()).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
    const member = await addWorkspaceMember(a);
    actAs(member);
    expect(await updateNotificationPrefsAction({ renewalReminders: false })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await updateNotificationPrefsAction({ deadlineReminders: false })).toMatchObject({ ok: true });
    actAs(user);
    expect(await updateNotificationPrefsAction({ renewalReminders: false })).toMatchObject({ ok: true, data: { renewalReminders: false } });
    expect(await rows()).toHaveLength(2);
  });

  it("'Turn emails back on' lifts an unsubscribe-from-all for this workspace", async () => {
    const second = await createWorkspace({ name: "Second Workspace" });
    await addMember(second.organizationId, user, "member");
    await pageForm({ t: tokenFor(), scope: "all" });
    actAs(user);
    expect(await resubscribeAction()).toMatchObject({ ok: true, data: { unsubscribedAll: false, weeklyDigest: false } });
    expect((await prefs()).unsubscribedAllAt).toBeNull();
    // The session's workspace only; the switch that was turned off stays as the member left it.
    expect((await getNotificationPrefs(user.id, second.organizationId)).unsubscribedAllAt).toBeInstanceOf(Date);
  });

  it("'Send me a preview' is for the founder, goes to the founder, and logs nothing", async () => {
    actAs(user);
    expect(await sendNotificationPreviewAction({ organizationId: a.organizationId, kind: "digest" })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    const founder = await createTestUser({ email: "founder@example.com", name: "Fiona Founder" });
    actAs(founder);
    await db.delete(emailOutbox);
    // A workspace with nothing to show.
    expect(await sendNotificationPreviewAction({ organizationId: a.organizationId, kind: "digest" })).toMatchObject({ ok: true, data: { status: "empty", workspace: "Joanne's workspace" } });
    expect(await sendNotificationPreviewAction({ organizationId: "no-such-workspace", kind: "digest" })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await sendNotificationPreviewAction({ organizationId: a.organizationId, kind: "newsletter" })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    // A renewal preview needs only a subscription.
    const { setPlan } = await import("./helpers");
    await setPlan(a.organizationId, { planKey: "pro", interval: "year", periodEnd: new Date(Date.now() + 100 * 86_400_000) });
    const sent = await sendNotificationPreviewAction({ organizationId: a.organizationId, kind: "renewal" });
    expect(sent).toMatchObject({ ok: true, data: { status: "sent", to: "founder@example.com", delivery: "outbox", mode: "sample", workspace: "Joanne's workspace" } });
    const outbox = await db.select().from(emailOutbox);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ toEmail: "founder@example.com", template: "renewal-reminder", headers: null });
    expect(outbox[0]!.subject.startsWith("[Preview] Your Bid Desk annual plan renews")).toBe(true);
    // Nobody in the workspace was written to; nothing was logged; no unsubscribe token was minted.
    expect(outbox.some((row) => row.toEmail === user.email.toLowerCase())).toBe(false);
    expect(await db.select().from(notificationLog)).toEqual([]);
    expect(outbox[0]!.html!.includes("/unsubscribe?t="), "token in a preview").toBe(false);
  });
});

describe("analytics never sees the token or the e-mail marker", () => {
  it("drops the query on /unsubscribe and the d parameter on tender pages", () => {
    expect(sanitizeAnalyticsUrl(`https://bidfolio.co.uk/unsubscribe?t=${tokenFor()}&done=all`)).toBe("https://bidfolio.co.uk/unsubscribe");
    expect(sanitizeAnalyticsUrl("/unsubscribe?t=abc.def")).toBe("/unsubscribe");
    expect(sanitizeAnalyticsUrl("https://bidfolio.co.uk/tenders/ocds-h6vhtk-0123ab?d=69c5f7d7-146a-4a66-9068-a273a384c7ba")).toBe("https://bidfolio.co.uk/tenders/ocds-h6vhtk-0123ab");
    expect(sanitizeAnalyticsUrl("/tenders/ocds-h6vhtk-0123ab?r=abc123&d=69c5f7d7-146a-4a66-9068-a273a384c7ba")).toBe("/tenders/ocds-h6vhtk-0123ab");
    // Elsewhere a parameter called d is nobody's business.
    expect(sanitizeAnalyticsUrl("/find?d=1")).toBe("/find?d=1");
  });
});
