import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

import { db } from "@/db";
import { emailOutbox, events, members, organizations, sessions } from "@/db/schema";
import { requireOrg } from "@/server/session";
import { actAs, createTestUser } from "./helpers/auth";
import { resetDatabase } from "./helpers/db";

describe("auth smoke", () => {
  beforeEach(async () => {
    await resetDatabase();
    actAs(null);
  });

  it("creates a personal workspace and an active session at sign-up", async () => {
    const user = await createTestUser({ name: "Ada Lovelace" });
    const [org] = await db.select().from(organizations).where(eq(organizations.id, user.organizationId));
    expect(org?.name).toBe("Ada's workspace");
    const [membership] = await db.select().from(members).where(eq(members.userId, user.id));
    expect(membership?.role).toBe("owner");
    const [session] = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(session?.activeOrganizationId).toBe(user.organizationId);

    const outbox = await db.select().from(emailOutbox);
    expect(outbox.map((row) => row.template)).toContain("verify-email");
    const names = (await db.select().from(events)).map((row) => row.name);
    expect(names).toEqual(expect.arrayContaining(["user.signed_up", "workspace.created"]));

    actAs(user);
    const ctx = await requireOrg();
    expect(ctx.organization.id).toBe(user.organizationId);
    expect(ctx.role).toBe("owner");
    expect(ctx.entitlements.planKey).toBe("free");
    expect(ctx.organization.isPersonal).toBe(true);
  });
});
