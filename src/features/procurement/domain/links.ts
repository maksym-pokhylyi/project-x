/**
 * Addresses the procurement screens link to (PURE, client-safe). Kept in one place because
 * some of them belong to other modules and their shape is a contract:
 *
 *   /app/bids/new?tender=<ocid>   the bid desk's "new check" page. `tender` takes the
 *                                 procurement's public id (the ocid, as in /tenders/<ocid>);
 *                                 the bid desk resolves it through getTender(), which also
 *                                 accepts a Find a Tender notice number.
 *   /free-bid-check               the public page about the free cited bid check
 *   /sample-check                 a public sample check
 */
export const FREE_BID_CHECK_HREF = "/free-bid-check";
export const SAMPLE_CHECK_HREF = "/sample-check";
export const NEW_BID_CHECK_HREF = "/app/bids/new";

/** "Start a bid check" for one tender, for a signed-in user. */
export function bidCheckHref(ocid: string): string {
  return `${NEW_BID_CHECK_HREF}?tender=${encodeURIComponent(ocid)}`;
}

/**
 * The same destination for a visitor who may not have an account: sign-up first, carrying
 * the tender along (`next` is read by the sign-up and sign-in pages). Signed-in viewers
 * should be sent straight to bidCheckHref().
 */
export function bidCheckHrefFor(ocid: string, signedIn: boolean): string {
  return signedIn ? bidCheckHref(ocid) : `/sign-up?next=${encodeURIComponent(bidCheckHref(ocid))}`;
}

export const FLAG_MISTAKE_HREF = "/flag-a-mistake";
export const DATA_SOURCES_HREF = "/about-the-data";
export const PRIVACY_HREF = "/legal/privacy";

/** The "Flag a mistake" form, with the page it is about filled in (a path on this site, e.g. "/suppliers/acme-ltd-01234567"). */
export function flagMistakeHref(pagePath?: string | null): string {
  return pagePath ? `${FLAG_MISTAKE_HREF}?page=${encodeURIComponent(pagePath)}` : FLAG_MISTAKE_HREF;
}
