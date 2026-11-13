import { exportCampaignCsv, LETTER_KINDS } from "@/features/outreach/server/campaigns";
import type { LetterKind } from "@/features/outreach/domain/letter";
import { AppError, ConflictError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { route } from "@/server/http";
import { requireAdmin } from "@/server/session";

/**
 * Downloads a campaign's letters as CSV (founder only).
 *
 * POST, not GET: an export changes state (rows become "exported", an audit entry is
 * written) and `route()` refuses POSTs that do not come from this site. The file contains
 * e-mail addresses — it is never cached and is logged without them.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Back to the campaign page with the reason (a relative Location: the browser stays on the host it is on). */
const back = (id: string, message: string) =>
  new Response(null, { status: 303, headers: { location: `/admin/outreach/campaigns/${encodeURIComponent(id)}?error=${encodeURIComponent(message.slice(0, 300))}`, "cache-control": "no-store" } });

export const POST = route<{ params: Promise<{ id: string }> }>(async (request, context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;
  await enforceRateLimit(`outreach-export:${admin.id}`, { limit: 60, windowSeconds: 3600 });
  const form = await request.formData().catch(() => null);
  const requested = String(form?.get("letter") ?? "first");
  const kind: LetterKind = (LETTER_KINDS as readonly string[]).includes(requested) ? (requested as LetterKind) : "first";
  try {
    const exported = await exportCampaignCsv(id, kind);
    if (exported.count === 0) {
      throw new ConflictError("Nothing to export: every company on this list is already sent, suppressed, opted out or past its contact-by date.");
    }
    return new Response(exported.csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${exported.filename}"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    // Something the founder can fix (missing sender details, nothing left to export): back to the page with the reason.
    if (error instanceof AppError && (error.code === "CONFLICT" || error.code === "VALIDATION")) return back(id, error.message);
    throw error;
  }
});
