/**
 * Erasure from the command line, for requests you handle on someone's behalf
 * (README "Erasure and export"). Runs the SAME code as the buttons in Settings, with the
 * same refusals (live subscription, workspace left without an owner).
 *
 *   pnpm erase account <user id | e-mail>            # shows what would be removed
 *   pnpm erase account <user id | e-mail> --yes      # removes it
 *   pnpm erase workspace <organization id> [--yes]
 *
 * Uses DATABASE_URL (and BLOB_READ_WRITE_TOKEN for the workspace's files) from the
 * environment / .env.local. Point it at production deliberately, e.g.
 *   DATABASE_URL=… BLOB_READ_WRITE_TOKEN=… pnpm erase account someone@example.com --yes
 */
import { loadEnv } from "./load-env.mjs";

loadEnv();

async function main() {
  const [kind, target, ...flags] = process.argv.slice(2);
  const confirmed = flags.includes("--yes");
  if ((kind !== "account" && kind !== "workspace") || !target) {
    throw new Error("Usage: pnpm erase account <user id | email> [--yes]  |  pnpm erase workspace <organization id> [--yes]");
  }

  const { eq, or } = await import("drizzle-orm");
  const { db, pg } = await import("../src/db");
  const { organizations, users } = await import("../src/db/schema");
  const { storageBackend } = await import("../src/lib/storage");
  const { deleteAccount, deleteWorkspace, planAccountDeletion } = await import("../src/server/tenant-data");
  const database = new URL(process.env.DATABASE_URL ?? "postgres://unknown/unknown");
  console.log(`Database: ${database.hostname}${database.pathname} · file storage: ${storageBackend}`);

  try {
    if (kind === "workspace") {
      const [organization] = await db.select().from(organizations).where(eq(organizations.id, target));
      if (!organization) throw new Error(`No workspace with id ${target}`);
      console.log(`Workspace "${organization.name}" (${organization.id}) with all of its data and files.`);
      if (!confirmed) return console.log("Nothing was changed. Add --yes to delete it.");
      console.log("Deleted:", await deleteWorkspace(organization.id));
      return;
    }

    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(or(eq(users.id, target), eq(users.email, target.toLowerCase())));
    if (!user) throw new Error(`No account with id or email ${target}`);
    const plan = await planAccountDeletion(user.id);
    console.log(`Account ${user.email} (${user.id})`);
    console.log("  workspaces deleted with it:", plan.deleteWorkspaces.map((workspace) => workspace.name).join(", ") || "none");
    console.log("  workspaces it leaves:      ", plan.leaveWorkspaces.map((workspace) => workspace.name).join(", ") || "none");
    if (plan.blockers.length > 0) {
      console.log("  CANNOT be deleted yet:");
      for (const blocker of plan.blockers) console.log(`   - ${blocker}`);
      process.exitCode = 1;
      return;
    }
    if (!confirmed) return console.log("Nothing was changed. Add --yes to delete it.");
    console.log("Deleted:", await deleteAccount(user.id));
  } finally {
    await pg.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
