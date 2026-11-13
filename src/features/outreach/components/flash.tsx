import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { readFlashError } from "../server/flash";

/**
 * What an action reports back. Outreach forms are plain HTML forms: an action answers by
 * sending the browser back to the page with `?notice=<key>` (and numbers), or with an error
 * sentence and its signature (see server/flash.ts — unsigned text is never shown).
 */
export type SearchParams = Record<string, string | string[] | undefined>;

export const one = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""));

const count = (params: SearchParams, key: string): number => {
  const value = Number(one(params[key]));
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
};

const plural = (value: number, singular: string, pluralForm = `${singular}s`) => `${value.toLocaleString("en-GB")} ${value === 1 ? singular : pluralForm}`;

/** Notices whose `n` says how many rows the action changed. */
const NEEDS_A_COUNT = new Set(["sent", "cleared", "imported"]);

function noticeText(params: SearchParams): string | null {
  const n = count(params, "n");
  switch (one(params.notice)) {
    case "created":
      return `Campaign created with ${plural(n, "company", "companies")}. Nothing has been exported or sent yet.`;
    case "sent": {
      const parts = [`${plural(n, "company", "companies")} marked as sent.`];
      const same = count(params, "same");
      if (same > 0) parts.push(`${plural(same, "selected row")} already had a date or cannot be marked, and ${same === 1 ? "was" : "were"} left as ${same === 1 ? "it was" : "they were"}.`);
      const short = count(params, "short");
      if (short > 0) parts.push(`That is ${short.toLocaleString("en-GB")} fewer than you asked for: no other exported company was without a date.`);
      const late = count(params, "late");
      if (late > 0) parts.push(`${plural(late, "named address", "named addresses")} ${late === 1 ? "was" : "were"} written to after the contact-by date: note why in your records.`);
      return parts.join(" ");
    }
    case "cleared": {
      const parts = [`Sent date cleared for ${plural(n, "company", "companies")}. The correction is in the audit trail.`];
      const same = count(params, "same");
      if (same > 0) parts.push(`${plural(same, "ticked row")} had no sent date.`);
      return parts.join(" ");
    }
    case "discarded":
      return `Campaign discarded. ${plural(n, "company", "companies")} can be listed again.`;
    case "added":
      return n > 0 ? `Added to the list. ${plural(n, "prospect")} taken off a list or marked as opted out.` : "Added to the list.";
    case "already":
      return "That address or domain was already on the list.";
    case "imported": {
      const parts = [`${plural(n, "address", "addresses")} added as bounces.`];
      const same = count(params, "same");
      if (same > 0) parts.push(`${plural(same, "address", "addresses")} ${same === 1 ? "was" : "were"} already listed.`);
      const own = count(params, "own");
      if (own > 0) parts.push(`${plural(own, "address", "addresses")} on our own domains ${own === 1 ? "was" : "were"} ignored.`);
      if (count(params, "cut") > 0) parts.push("The list was longer than 5,000 addresses: import the rest separately.");
      return parts.join(" ");
    }
    case "removed":
      return "Entry removed. The removal is in the audit trail.";
    case "page_hidden":
      return "The company page is hidden and the request is closed.";
    case "erased":
      return "The contact details were erased and the request is closed. The address stays on the do-not-contact list.";
    case "request_closed":
      return "Request closed.";
    default:
      return null;
  }
}

/** Notice or error from the last action, if the address carries one. Server component. */
export function Flash({ params }: { params: SearchParams }) {
  const error = readFlashError(params);
  if (error) {
    return (
      <Alert variant="destructive" data-testid="flash-error">
        <AlertTitle>That did not work</AlertTitle>
        <AlertDescription>
          <p>{error}</p>
        </AlertDescription>
      </Alert>
    );
  }
  const notice = noticeText(params);
  if (notice) {
    // An action that found nothing to change says so; it does not report a success.
    const nothingChanged = NEEDS_A_COUNT.has(one(params.notice)) ? count(params, "n") === 0 : one(params.notice) === "already";
    return (
      <Alert variant={nothingChanged ? "default" : "success"} role="status" data-testid="flash-notice">
        <AlertTitle>{nothingChanged ? "Nothing changed" : "Done"}</AlertTitle>
        <AlertDescription>
          <p>{notice}</p>
        </AlertDescription>
      </Alert>
    );
  }
  return null;
}
