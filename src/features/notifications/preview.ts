import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { members, organizations } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import { composeRadarEmail, composeReminderEmail, composeRenewalEmail, type ComposedEmail } from "./compose";
import type { ScheduledKind } from "./config";
import { buildAlert, buildDigest } from "./content/digest";
import { buildReminder } from "./content/reminders";
import { buildRenewal } from "./content/renewal";
import { loadMemberContext } from "./recipients";

/**
 * Previews for the founder (the /admin button and `pnpm notifications:preview`): the e-mail
 * a workspace would get, rendered without sending it to anyone in the workspace and
 * without touching notification_log.
 *
 * The content is read as the workspace's first owner would see it. `mode`:
 *   "live"    exactly what is new for that member now (may be nothing);
 *   "sample"  everything on the radar treated as new — to look at the layout with real data.
 * A preview carries no unsubscribe token and no tracking id.
 */
export type PreviewMode = "live" | "sample";

export type PreviewResult = { status: "ready"; mode: PreviewMode; email: ComposedEmail; workspace: string } | { status: "empty"; workspace: string; reason: string };

const NOTHING: Record<ScheduledKind, string> = {
  digest: "Nothing on this workspace's radar to put in a digest (no radar, or no matches and no contracts ending).",
  alert: "No matching tenders on this workspace's radar.",
  reminder: "This workspace has no saved tender with a closing date ahead.",
  renewal: "This workspace has no subscription with a paid period to renew.",
};

export async function buildPreview(
  organizationId: string,
  kind: ScheduledKind,
  options: { mode?: PreviewMode | "auto"; recipientName?: string | null; now?: Date } = {},
): Promise<PreviewResult> {
  const now = options.now ?? new Date();
  const [organization] = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.id, organizationId));
  if (!organization) throw new NotFoundError("No workspace with that id.");
  const memberRows = await db.select({ userId: members.userId, role: members.role }).from(members).where(eq(members.organizationId, organizationId)).orderBy(asc(members.createdAt));
  const viewer = memberRows.find((row) => row.role === "owner") ?? memberRows[0];
  const ctx = viewer ? await loadMemberContext(organizationId, viewer.userId, now) : null;
  if (!ctx) return { status: "empty", workspace: organization.name, reason: "This workspace has no members." };

  const requested = options.mode ?? "auto";
  const context = { recipient: { userId: ctx.user.id, organizationId, name: options.recipientName === undefined ? ctx.user.name : options.recipientName }, notificationId: null, preview: true, now };
  const attempt = async (everything: boolean): Promise<ComposedEmail | null> => {
    if (kind === "digest" || kind === "alert") {
      const content = kind === "digest" ? await buildDigest(ctx, now, { everything }) : await buildAlert(ctx, now, { everything });
      return content ? composeRadarEmail(content, context) : null;
    }
    if (kind === "reminder") {
      const content = await buildReminder(ctx, now, { everything });
      return content ? composeReminderEmail(content, context) : null;
    }
    const content = await buildRenewal(ctx, now, { everything });
    return content ? composeRenewalEmail(content, context) : null;
  };

  if (requested !== "sample") {
    const live = await attempt(false);
    if (live) return { status: "ready", mode: "live", email: live, workspace: organization.name };
    if (requested === "live") return { status: "empty", workspace: organization.name, reason: "Nothing is new for this workspace right now: a real run would send nothing and log skipped_empty." };
  }
  const sample = await attempt(true);
  if (sample) return { status: "ready", mode: "sample", email: sample, workspace: organization.name };
  return { status: "empty", workspace: organization.name, reason: NOTHING[kind] };
}
