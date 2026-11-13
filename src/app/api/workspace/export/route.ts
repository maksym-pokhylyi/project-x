import { enforceRateLimit } from "@/lib/rate-limit";
import { route } from "@/server/http";
import { requireOrg } from "@/server/session";
import { exportWorkspaceData } from "@/server/tenant-data";

/**
 * Downloads everything stored for the ACTIVE workspace as one JSON file (owner only):
 * members, invitations, subscription, usage, audit log, analytics events, AI usage, every
 * product table that carries `organization_id`, and the list of stored files.
 * For data-access and portability requests; see README "Erasure and export".
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = route(async () => {
  const ctx = await requireOrg({ role: "owner" });
  await enforceRateLimit(`export:${ctx.organization.id}`, { limit: 10, windowSeconds: 3600 });
  const data = await exportWorkspaceData(ctx);
  const filename = `workspace-${ctx.organization.slug.replace(/[^a-z0-9-]/gi, "") || "export"}-${data.exportedAt.slice(0, 10)}.json`;
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
