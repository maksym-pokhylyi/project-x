import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { members, notificationPrefs, users } from "@/db/schema";
import { track } from "@/lib/analytics";
import { getNotificationPrefs, PREF_OF_KIND, wantsKind } from "./prefs";
import { tokenNamesAddress, type UnsubscribeSubject, type VerifiedUnsubscribe } from "./tokens";

/**
 * What an unsubscribe link does (the page /unsubscribe and the RFC 8058 one-click endpoint).
 *
 * Scope "kind" switches off the kind of e-mail the link came with, for that workspace.
 * Scope "all" is "stop e-mails to this address": besides that, it marks every workspace the
 * person belongs to as unsubscribed, so no optional e-mail reaches the address from any of
 * them. (A workspace joined later starts with the defaults; its first e-mail carries its
 * own link.) Billing notices keep their own switch, see wantsKind().
 *
 * Everything here is idempotent, and a person who is no longer a member of the workspace —
 * or no longer exists — is a silent no-op: nothing is sent to them anyway, no row is left
 * behind, and the caller answers the same way whatever exists.
 */
export type UnsubscribeScope = "kind" | "all";
export type UnsubscribeVia = "one_click" | "page" | "settings";

/** A deleted user or workspace between our check and the write (foreign-key violation). */
function isMissingParent(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code ?? (error as { cause?: { code?: unknown } } | null)?.cause?.code;
  return code === "23503";
}

async function membershipsOf(userId: string): Promise<string[]> {
  const rows = await db.select({ organizationId: members.organizationId }).from(members).where(eq(members.userId, userId));
  return rows.map((row) => row.organizationId);
}

/** Records `notification_unsubscribed` only when something actually changed. */
export async function unsubscribe(subject: UnsubscribeSubject, scope: UnsubscribeScope, via: UnsubscribeVia): Promise<{ changed: boolean }> {
  const workspaces = await membershipsOf(subject.userId);
  if (!workspaces.includes(subject.organizationId)) return { changed: false };

  const key = PREF_OF_KIND[subject.kind];
  const now = new Date();
  let changed = false;
  try {
    const off = await db
      .insert(notificationPrefs)
      .values({ userId: subject.userId, organizationId: subject.organizationId, [key]: false })
      .onConflictDoUpdate({
        target: [notificationPrefs.userId, notificationPrefs.organizationId],
        set: { [key]: false, updatedAt: now },
        setWhere: eq(notificationPrefs[key], true),
      })
      .returning({ organizationId: notificationPrefs.organizationId });
    changed = off.length > 0;
    if (scope === "all") {
      // One timestamp for every workspace marked by this request: "Subscribe again" lifts exactly these.
      const marked = await db
        .insert(notificationPrefs)
        .values(workspaces.map((organizationId) => ({ userId: subject.userId, organizationId, unsubscribedAllAt: now })))
        .onConflictDoUpdate({
          target: [notificationPrefs.userId, notificationPrefs.organizationId],
          set: { unsubscribedAllAt: now, updatedAt: now },
          setWhere: isNull(notificationPrefs.unsubscribedAllAt),
        })
        .returning({ organizationId: notificationPrefs.organizationId });
      changed = changed || marked.length > 0;
    }
  } catch (error) {
    if (isMissingParent(error)) return { changed: false };
    throw error;
  }
  if (changed) {
    await track("notification_unsubscribed", { organizationId: subject.organizationId, userId: subject.userId }, { kind: subject.kind, scope, via });
  }
  return { changed };
}

/** What the page /unsubscribe shows for a valid link. */
export type UnsubscribeView =
  /** No longer a member of the workspace, or no longer a user: nothing is sent, nothing to change. */
  | { member: false }
  | {
      member: true;
      /** The address, only when the link was sent to the address the account has now. */
      email: string | null;
      /** Whether the kind of e-mail the link came with is currently sent. */
      subscribed: boolean;
      /** "Stop e-mails to this address" is in force for the workspace. */
      all: boolean;
    };

async function currentAddress(subject: UnsubscribeSubject): Promise<{ email: string } | null> {
  const [row] = await db
    .select({ email: users.email })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(eq(members.userId, subject.userId), eq(members.organizationId, subject.organizationId)))
    .limit(1);
  return row ?? null;
}

export async function unsubscribeView(verified: VerifiedUnsubscribe): Promise<UnsubscribeView> {
  const account = await currentAddress(verified);
  if (!account) return { member: false };
  const prefs = await getNotificationPrefs(verified.userId, verified.organizationId);
  return {
    member: true,
    email: tokenNamesAddress(verified, account.email) ? account.email : null,
    subscribed: wantsKind(prefs, verified.kind),
    all: prefs.unsubscribedAllAt !== null,
  };
}

/**
 * "Unsubscribed by mistake? Subscribe again": puts back what the link took away — the kind
 * it came with, and a "stop e-mails to this address" together with the other workspaces
 * that request marked. Only for a link sent to the address the account has now (see
 * ./tokens.ts): a link from an old mailbox can stop e-mails but never start them.
 */
export async function resubscribeFromLink(verified: VerifiedUnsubscribe): Promise<{ changed: boolean }> {
  const account = await currentAddress(verified);
  if (!account || !tokenNamesAddress(verified, account.email)) return { changed: false };

  const pair = and(eq(notificationPrefs.userId, verified.userId), eq(notificationPrefs.organizationId, verified.organizationId));
  const key = PREF_OF_KIND[verified.kind];
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ on: notificationPrefs[key], markedAt: notificationPrefs.unsubscribedAllAt }).from(notificationPrefs).where(pair).for("update");
    if (!row || (row.on && !row.markedAt)) return { changed: false };
    const now = new Date();
    await tx.update(notificationPrefs).set({ [key]: true, unsubscribedAllAt: null, updatedAt: now }).where(pair);
    if (row.markedAt) {
      await tx
        .update(notificationPrefs)
        .set({ unsubscribedAllAt: null, updatedAt: now })
        .where(and(eq(notificationPrefs.userId, verified.userId), eq(notificationPrefs.unsubscribedAllAt, row.markedAt)));
    }
    return { changed: true };
  });
}
