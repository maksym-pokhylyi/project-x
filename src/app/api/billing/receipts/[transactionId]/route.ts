import { getReceiptInvoiceUrl } from "@/lib/billing/receipts";
import { enforceRateLimit } from "@/lib/rate-limit";
import { route } from "@/server/http";
import { requireOrg } from "@/server/session";

/**
 * Redirects (302) to Paddle's invoice PDF of ONE payment of the active workspace.
 *
 *  - Session required; owners and admins only (403 otherwise).
 *  - The transaction must be recorded for THIS workspace in `billing_payments`: an id that
 *    is unknown, malformed or belongs to another workspace answers 404, without asking Paddle.
 *  - Paddle is asked for the PDF link only (`transactions.getInvoicePDF`); the link is valid
 *    for about an hour and is never stored. No customer-portal session is involved.
 *  - 409 with a readable message while Paddle has not issued the invoice yet, or when
 *    nothing was charged (no invoice exists); 503 when Paddle cannot be reached.
 *
 * Link to it with a plain `<a href={receipt.invoicePath}>` (a navigation, not fetch()).
 */
export const dynamic = "force-dynamic";

export const GET = route<{ params: Promise<{ transactionId: string }> }>(async (_request, context) => {
  const ctx = await requireOrg({ role: "admin" });
  const { transactionId } = await context.params;
  await enforceRateLimit(`receipt:${ctx.organization.id}`, { limit: 60, windowSeconds: 3600 });
  const url = await getReceiptInvoiceUrl(ctx.organization.id, transactionId);
  return new Response(null, {
    status: 302,
    headers: { location: url, "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
});
