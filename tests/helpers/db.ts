import { sql } from "drizzle-orm";
import { db } from "@/db";

const TABLES = [
  "ai_usage",
  "audit_log",
  "email_outbox",
  "error_log",
  "events",
  "jobs",
  "rate_limits",
  "subscriptions",
  "usage_counters",
  "webhook_events",
  "invitations",
  "members",
  "organizations",
  "sessions",
  "accounts",
  "verifications",
  "users",
];

/** Empties every table. Call in beforeEach for tests that touch the database. */
export async function resetDatabase(): Promise<void> {
  await db.execute(sql.raw(`truncate table ${TABLES.map((t) => `"${t}"`).join(", ")} restart identity cascade`));
}
