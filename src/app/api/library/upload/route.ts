import { z } from "zod";
import { FILE_KIND_MIME, fileKindFromName, MAX_LIBRARY_FILE_BYTES, unsupportedFileReason } from "@/features/bids/constants";
import { receiveDirectUpload } from "@/features/bids/server/direct-upload";
import { librarySourceKey } from "@/features/bids/server/store";
import { ValidationError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { json, route } from "@/server/http";
import { requireOrg } from "@/server/session";

/** Local-development upload of one library document (production: direct browser -> Blob). */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const PUT = route(async (request, _context, { requestId }) => {
  const ctx = await requireOrg({ write: true });
  const url = new URL(request.url);
  const docId = z.uuid().safeParse(url.searchParams.get("docId"));
  const name = (url.searchParams.get("name") ?? "").trim();
  if (!docId.success || !name) throw new ValidationError("Invalid upload request.");
  const reason = unsupportedFileReason(name);
  const kind = fileKindFromName(name);
  if (reason || !kind || kind === "zip") throw new ValidationError(reason ?? "ZIP files cannot be added to the library.");
  await enforceRateLimit(`library-upload:${ctx.organization.id}`, { limit: 200, windowSeconds: 3600 });
  const size = await receiveDirectUpload(request, {
    storageKey: librarySourceKey(ctx.organization.id, docId.data, kind),
    contentType: FILE_KIND_MIME[kind],
    maxBytes: MAX_LIBRARY_FILE_BYTES,
  });
  return json({ ok: true, size }, { requestId });
});
