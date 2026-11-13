/**
 * Seeds the LOCAL development database with a demo owner, a teammate and a workspace
 * on the Pro plan, so every screen has data.
 *
 *   pnpm db:seed
 *
 * Refuses to run against anything that is not localhost. Safe to re-run.
 * Sign in with  demo@example.com / demo-password-123  (also the /admin founder if
 * ADMIN_EMAILS contains it).
 */
import { loadEnv } from "./load-env.mjs";

loadEnv();

const DEMO_PASSWORD = "demo-password-123";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error(`Refusing to seed ${url.hostname}: db:seed is for local development only.`);
  }

  // Imported lazily: these modules validate env at import time.
  const { eq } = await import("drizzle-orm");
  const { db, pg } = await import("../src/db");
  const { members, subscriptions, usageCounters, users } = await import("../src/db/schema");
  const { auth } = await import("../src/lib/auth");
  const { quotaPeriodStart } = await import("../src/lib/billing/quota");

  async function ensureUser(email: string, name: string) {
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (!existing) await auth.api.signUpEmail({ body: { email, name, password: DEMO_PASSWORD } });
    await db.update(users).set({ emailVerified: true }).where(eq(users.email, email));
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) throw new Error(`could not create ${email}`);
    return user;
  }

  const owner = await ensureUser("demo@example.com", "Demo Owner");
  const teammate = await ensureUser("teammate@example.com", "Demo Teammate");

  const [ownerMembership] = await db.select().from(members).where(eq(members.userId, owner.id));
  if (!ownerMembership) throw new Error("demo owner has no workspace");
  const organizationId = ownerMembership.organizationId;

  const teammateMemberships = await db.select().from(members).where(eq(members.userId, teammate.id));
  if (!teammateMemberships.some((row) => row.organizationId === organizationId)) {
    await db.insert(members).values({ id: `seed_${teammate.id}`, organizationId, userId: teammate.id, role: "member", createdAt: new Date() });
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
  await db
    .insert(subscriptions)
    .values({
      organizationId,
      paddleCustomerId: "ctm_seed_demo",
      paddleSubscriptionId: "sub_seed_demo",
      status: "active",
      planKey: "pro",
      priceId: process.env.PADDLE_PRICE_PRO_MONTHLY ?? "pri_seed_pro_monthly",
      billingInterval: "month",
      quantity: 1,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      customerEmail: owner.email,
      lastEventAt: now,
    })
    .onConflictDoUpdate({ target: subscriptions.organizationId, set: { status: "active", planKey: "pro", currentPeriodEnd: periodEnd, updatedAt: now } });

  await db
    .insert(usageCounters)
    .values({ organizationId, metric: "units", periodStart: quotaPeriodStart("units", now), quantity: 1234 })
    .onConflictDoNothing();

  console.log("Seeded:");
  console.log(`  owner     demo@example.com / ${DEMO_PASSWORD}  (workspace on the Pro plan)`);
  console.log(`  member    teammate@example.com / ${DEMO_PASSWORD}`);
  await pg.end({ timeout: 5 });
}

main().catch((error) => {
  console.error("db:seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
