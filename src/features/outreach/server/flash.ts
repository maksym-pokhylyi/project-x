import "server-only";
import { sign, verifySignature } from "@/lib/crypto";

/**
 * How an outreach action answers a plain HTML form: it sends the browser back to the page
 * with the outcome in the address.
 *
 * A NOTICE is a key from a fixed list (see components/flash.tsx). An ERROR is a sentence, so
 * it is signed: the page shows only words this server wrote. A crafted link cannot put a
 * message of someone else's choosing on the founder's admin screen.
 */
const PURPOSE = "outreach-flash";
const MAX_LENGTH = 300;

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

/** Query parameters that carry `message` back to a page. */
export function flashError(message: string): { error: string; es: string } {
  const text = message.replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH);
  return { error: text, es: sign(PURPOSE, text) };
}

/** The error an action sent back, or null when there is none or it was not written by this server. */
export function readFlashError(params: Params): string | null {
  const text = one(params.error);
  const signature = one(params.es);
  if (!text || !signature || text.length > MAX_LENGTH) return null;
  return verifySignature(PURPOSE, text, signature) ? text : null;
}
