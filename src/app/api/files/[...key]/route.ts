import { NotFoundError } from "@/lib/errors";
import { isValidStorageKey, organizationIdFromKey, storage, verifyLocalSignedUrl } from "@/lib/storage";
import { route } from "@/server/http";
import { isMemberOf } from "@/server/members";
import { requireUser } from "@/server/session";

/**
 * Serves stored files (private storage is never exposed directly).
 *
 * Access is granted in exactly two ways:
 *  1. a valid, unexpired `?expires=&signature=` pair from storage.signedUrl() (local backend), or
 *  2. a signed-in user who is a member of the workspace that owns the key (org/<id>/…).
 * Anything else answers 404, so the existence of other tenants' files is not revealed.
 */
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);

export const GET = route<{ params: Promise<{ key: string[] }> }>(async (request, context) => {
  const { key: segments } = await context.params;
  const key = segments.map((segment) => decodeURIComponent(segment)).join("/");
  if (!isValidStorageKey(key)) throw new NotFoundError();

  const url = new URL(request.url);
  const signed = verifyLocalSignedUrl(key, url.searchParams.get("expires"), url.searchParams.get("signature"));
  if (!signed) {
    const user = await requireUser();
    const organizationId = organizationIdFromKey(key);
    if (!organizationId || !(await isMemberOf(user.id, organizationId))) throw new NotFoundError();
  }

  const file = await storage.get(key);
  if (!file) throw new NotFoundError();

  const headers = new Headers({
    "content-type": file.contentType,
    "x-content-type-options": "nosniff",
    "cache-control": "private, max-age=300",
    // Never let an uploaded file run as a document in our origin.
    "content-security-policy": "default-src 'none'; sandbox",
    "content-disposition": INLINE_TYPES.has(file.contentType) ? "inline" : "attachment",
  });
  if (file.size !== null) headers.set("content-length", String(file.size));
  return new Response(file.body, { headers });
});
