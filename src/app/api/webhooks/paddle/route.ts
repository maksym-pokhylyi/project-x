import { receivePaddleWebhook } from "@/lib/billing/webhooks";

/**
 * Paddle Billing notification destination. Configure in Paddle > Developer tools >
 * Notifications with URL https://<domain>/api/webhooks/paddle and put the destination's
 * secret key in PADDLE_WEBHOOK_SECRET. See README "How billing works".
 *
 * The body is read as raw text: the signature covers the exact bytes Paddle sent.
 */
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const result = await receivePaddleWebhook(rawBody, request.headers.get("paddle-signature"));
  return Response.json(result.body, { status: result.status, headers: { "cache-control": "no-store" } });
}
