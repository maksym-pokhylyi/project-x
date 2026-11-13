import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { TenantDataHandler } from "@/server/tenant-data";

/**
 * Workspace deletion (src/server/tenant-data.ts).
 *
 * notification_prefs and notification_log carry `organization_id` and `user_id` with
 * cascading foreign keys, so the catalogue-driven export and erasure cover them. What the
 * database cannot cascade to is the mail queue: outbox rows of scheduled e-mails made for
 * this workspace. They are removed here — BEFORE the log rows that point at them go — so
 * that a message still waiting to be delivered is not sent about a workspace that no
 * longer exists, and no subject line naming it stays behind for the outbox's 90 days.
 * (Account deletion already removes every outbox row addressed to the person.)
 */
export const notificationsTenantData: TenantDataHandler = {
  name: "notifications",
  async onDelete(organizationId) {
    await db.execute(sql`
      delete from email_outbox
      where id in (select outbox_id from notification_log where organization_id = ${organizationId} and outbox_id is not null)
    `);
  },
};
