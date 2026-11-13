import { getBidFile } from "@/features/bids/server/bids";
import { serveSourceFile } from "@/features/bids/server/source-file";
import { NotFoundError } from "@/lib/errors";
import { route } from "@/server/http";
import { requireOrg } from "@/server/session";

/**
 * Opens a source file of a bid for a member of the workspace that owns it. Citation
 * popovers link here with `#page=N`, which browsers' PDF viewers honour.
 */
export const dynamic = "force-dynamic";

export const GET = route<{ params: Promise<{ bidId: string; fileId: string }> }>(async (request, context) => {
  const ctx = await requireOrg();
  const { bidId, fileId } = await context.params;
  const file = await getBidFile(ctx, bidId, fileId); // 404 unless the bid AND the file belong to this workspace
  if (file.extractionStatus === "skipped") throw new NotFoundError("This file was not stored.");
  return serveSourceFile({ storageKey: file.storageKey, fileName: file.name, forceDownload: new URL(request.url).searchParams.has("download") });
});
