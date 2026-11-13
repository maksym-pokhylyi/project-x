import { z } from "zod";
import { FILE_KIND_MIME, fileKindFromName, MAX_FILE_BYTES, unsupportedFileReason } from "@/features/bids/constants";
import { getBid } from "@/features/bids/server/bids";
import { receiveDirectUpload } from "@/features/bids/server/direct-upload";
import { bidSourceKey } from "@/features/bids/server/store";
import { ConflictError, ValidationError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { json, route } from "@/server/http";
import { requireOrg } from "@/server/session";

/**
 * Local-development upload of one pack file (streamed request body). Production uses
 * direct browser -> Blob uploads instead (see /api/bids/upload-token).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const PUT = route<{ params: Promise<{ bidId: string }> }>(async (request, context, { requestId }) => {
  const ctx = await requireOrg();
  const { bidId } = await context.params;
  const url = new URL(request.url);
  const fileId = z.uuid().safeParse(url.searchParams.get("fileId"));
  const name = (url.searchParams.get("name") ?? "").trim();
  if (!fileId.success || !name) throw new ValidationError("Invalid upload request.");
  const reason = unsupportedFileReason(name);
  if (reason) throw new ValidationError(reason);
  const bid = await getBid(ctx, bidId); // 404 for a bid of another workspace
  if (bid.status !== "draft") throw new ConflictError("Files can only be added before the pack is analysed.");
  await enforceRateLimit(`bids-upload:${ctx.organization.id}`, { limit: 300, windowSeconds: 3600 });
  const kind = fileKindFromName(name)!;
  const size = await receiveDirectUpload(request, {
    storageKey: bidSourceKey(ctx.organization.id, bid.id, fileId.data, kind),
    contentType: FILE_KIND_MIME[kind],
    maxBytes: MAX_FILE_BYTES,
  });
  return json({ ok: true, size }, { requestId });
});
