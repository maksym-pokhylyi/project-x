import { exportSuppressionsCsv } from "@/features/outreach/server/suppressions";
import { enforceRateLimit } from "@/lib/rate-limit";
import { route } from "@/server/http";
import { requireAdmin } from "@/server/session";

/**
 * Downloads the suppression list as CSV (founder only), for a sending tool's own
 * do-not-contact list. POST: `route()` refuses requests that do not come from this site,
 * and the export is logged (who, when, how many — not the addresses).
 */
export const dynamic = "force-dynamic";

export const POST = route(async () => {
  const admin = await requireAdmin();
  await enforceRateLimit(`outreach-suppressions-export:${admin.id}`, { limit: 30, windowSeconds: 3600 });
  const exported = await exportSuppressionsCsv();
  return new Response(exported.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${exported.filename}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
