"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp, enforceRateLimit } from "@/lib/rate-limit";
import { runAction } from "@/server/http";
import { OPTOUT_RATE_LIMITS } from "./config";
import { confirmOptOut, optOutByAddress, OPTOUT_CODE } from "./server/optout";

/**
 * Server Actions of the public opt-out page. No session, so each one is rate-limited per
 * client address and does only what its form says. They answer by sending the browser back
 * to /optout — the page then shows what the database says, so a reload or a second press
 * changes nothing, and everything works without JavaScript.
 *
 * Next.js refuses a Server Action whose Origin is not this site, which is the CSRF check
 * for these forms (the same one the foundation's other public form relies on).
 */

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function limited(kind: keyof typeof OPTOUT_RATE_LIMITS): Promise<void> {
  await enforceRateLimit(`optout:${kind}:${clientIp(await headers())}`, OPTOUT_RATE_LIMITS[kind]);
}

/** The one button of a personal link: "Stop e-mails to this address". */
export async function confirmOptOutAction(formData: FormData): Promise<void> {
  const code = text(formData, "c");
  if (!OPTOUT_CODE.test(code)) redirect("/optout");
  const result = await runAction("optout.confirm", async () => {
    await limited("link");
    return confirmOptOut(code);
  });
  if (!result.ok) redirect(`/optout?c=${code}&error=${result.error.code === "RATE_LIMITED" ? "rate" : "failed"}`);
  // An unknown code: nothing was stopped, so do not say so. Offer the form instead.
  redirect(result.data.found ? `/optout?c=${code}` : "/optout?error=link");
}

/**
 * The form without a link. The answer is the same for every valid address. No honeypot
 * field here on purpose: a browser that auto-fills one would turn a real opt-out into a
 * silent no-op that still says "done". The rate limit is the protection.
 */
export async function optOutByAddressAction(formData: FormData): Promise<void> {
  const result = await runAction("optout.address", async () => {
    await limited("form");
    return optOutByAddress(text(formData, "email"));
  });
  if (!result.ok) redirect(`/optout?error=${result.error.code === "RATE_LIMITED" ? "rate" : "failed"}`);
  redirect(result.data.valid ? "/optout?done=1" : "/optout?error=email");
}
