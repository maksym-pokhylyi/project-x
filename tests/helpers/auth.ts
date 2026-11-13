import { eq } from "drizzle-orm";
import { db } from "@/db";
import { members, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import type { Role } from "@/server/workspaces";
import { requestState } from "./request-state";

/**
 * Request headers that `next/headers` returns in tests. Test files that exercise
 * requireOrg()/Server Actions/Route Handlers must mock the module like this:
 *
 *   vi.mock("next/headers", () => import("./helpers/next-headers"));
 */
export { requestState };

export type TestUser = {
  id: string;
  email: string;
  name: string;
  /** Session cookie header value for this user. */
  cookie: string;
  /** Personal workspace created at sign-up. */
  organizationId: string;
};

let counter = 0;

/** Signs up a real user through Better Auth, verifies the e-mail and signs in. */
export async function createTestUser(overrides: { email?: string; name?: string } = {}): Promise<TestUser> {
  counter += 1;
  const email = overrides.email ?? `user${counter}-${Date.now()}@example.com`;
  const name = overrides.name ?? `User ${counter}`;
  const password = "correct-horse-battery";
  await auth.api.signUpEmail({ body: { email, name, password } });
  await db.update(users).set({ emailVerified: true }).where(eq(users.email, email));
  const { headers, response } = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const [membership] = await db.select().from(members).where(eq(members.userId, response.user.id));
  if (!membership) throw new Error("personal workspace was not created");
  return { id: response.user.id, email, name, cookie, organizationId: membership.organizationId };
}

/** Makes `next/headers` return this user's session cookie (or no cookie for `null`). */
export function actAs(user: TestUser | null): void {
  requestState.headers = new Headers(user ? { cookie: user.cookie, origin: "http://localhost:3000", host: "localhost:3000" } : {});
}

/** Headers for calling auth.api.* / route handlers directly as a user. */
export function headersFor(user: TestUser): Headers {
  return new Headers({ cookie: user.cookie, origin: "http://localhost:3000", host: "localhost:3000" });
}

/** Adds `user` to `organizationId` with a role, bypassing the invitation flow. */
export async function addMember(organizationId: string, user: TestUser, role: Role): Promise<string> {
  const id = `mem_${Math.random().toString(36).slice(2)}`;
  await db.insert(members).values({ id, organizationId, userId: user.id, role, createdAt: new Date() });
  return id;
}
