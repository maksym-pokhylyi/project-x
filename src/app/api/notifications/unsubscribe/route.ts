import { z } from "zod";
import { verifyUnsubscribeToken } from "@/features/notifications/tokens";
import { resubscribeFromLink, unsubscribe } from "@/features/notifications/unsubscribe";
import { ValidationError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseInput } from "@/lib/validation";
import { json, route } from "@/server/http";

/**
 * Unsubscribe endpoint for scheduled e-mails.
 *
 * POST is two things with one rule — the signed token in `t` is the whole credential:
 *
 *  1. RFC 8058 one-click. Every scheduled e-mail carries
 *       List-Unsubscribe: <https://…/api/notifications/unsubscribe?t=…>
 *       List-Unsubscribe-Post: List-Unsubscribe=One-Click
 *     and the mail client (Gmail, Apple Mail, Outlook) POSTs here with the body
 *     `List-Unsubscribe=One-Click`. That turns off the kind of e-mail the token names.
 *
 *  2. The form on /unsubscribe: the same POST with `scope` ("all" — stop e-mails to this
 *     address — or "kind") or, for "Subscribe again", `action=resubscribe`. Answers with a
 *     redirect back to the page, which shows the state now stored.
 *
 * No session and no CSRF check BY DESIGN (`csrf: false`, like a webhook): the request comes
 * from a mail provider's servers or from a signed-out browser and carries no ambient
 * authority — without a valid token nothing happens, with one the only effect is the
 * preference of the member it names. Idempotent. The answer never depends on whether the
 * account or the workspace still exists.
 *
 * GET changes nothing: link scanners, and people who open the header's address, land on the
 * confirmation page.
 */
export const dynamic = "force-dynamic";

const formSchema = z.object({
  scope: z.enum(["kind", "all"]).optional(),
  action: z.enum(["unsubscribe", "resubscribe"]).optional(),
});

/** A relative redirect: stays on whatever host the request came to. */
function toPage(token: string, done?: string): Response {
  const query = new URLSearchParams();
  if (token) query.set("t", token);
  if (done) query.set("done", done);
  const search = query.toString();
  return new Response(null, { status: 303, headers: { location: `/unsubscribe${search ? `?${search}` : ""}`, "cache-control": "no-store" } });
}

async function readForm(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/x-www-form-urlencoded") && !type.includes("multipart/form-data")) return {};
  try {
    const form = await request.formData();
    return Object.fromEntries([...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

export const GET = route(async (request) => toPage((new URL(request.url).searchParams.get("t") ?? "").slice(0, 600)));

export const POST = route(
  async (request, _context, { requestId }) => {
    const form = await readForm(request);
    const token = (new URL(request.url).searchParams.get("t") ?? form.t ?? "").slice(0, 600);
    const input = parseInput(formSchema, { scope: form.scope, action: form.action });
    // The page's form always says what it wants; a mail client's one-click POST never does.
    const fromPage = input.scope !== undefined || input.action !== undefined;

    const verified = verifyUnsubscribeToken(token);
    if (!verified) {
      if (fromPage) return toPage("");
      throw new ValidationError("This unsubscribe link is not valid.");
    }

    if (input.action === "resubscribe") {
      // The one request here that switches e-mails ON: no flapping.
      await enforceRateLimit(`notifications:resubscribe:${verified.userId}:${verified.organizationId}`, { limit: 10, windowSeconds: 3600 });
      await resubscribeFromLink(verified);
      return toPage(token, "back");
    }

    const scope = input.scope ?? "kind";
    await unsubscribe(verified, scope, fromPage ? "page" : "one_click");
    return fromPage ? toPage(token, scope) : json({ ok: true }, { requestId });
  },
  { csrf: false },
);
