import "server-only";
import { env, features } from "@/env";
import { safeEqual } from "@/lib/crypto";
import { getUser } from "./session";

/**
 * Who may open the development pages (/dev/outbox lists verification, reset and
 * invitation links — whoever reads it can take over accounts).
 *
 *  - Dev tools off (always on a Vercel production deployment): nobody.
 *  - Local development (`next dev`, tests): everybody; it is the developer's own machine.
 *  - A production BUILD with DEV_TOOLS=1 (e2e, a preview, self-hosting): only a founder
 *    session (ADMIN_EMAILS) or a request carrying DEV_TOOLS_SECRET as `?key=`.
 */
export async function canAccessDevTools(key?: string | null): Promise<boolean> {
  if (!features.devTools) return false;
  if (!features.devToolsProtected) return true;
  if (env.DEV_TOOLS_SECRET && typeof key === "string" && key.length > 0 && safeEqual(key, env.DEV_TOOLS_SECRET)) return true;
  const user = await getUser();
  return Boolean(user?.isAdmin);
}
