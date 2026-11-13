import { serveSourceFile } from "@/features/bids/server/source-file";
import { getLibraryDoc } from "@/features/library/server/docs";
import { route } from "@/server/http";
import { requireOrg } from "@/server/session";

/** Opens a library document for a member of the workspace that owns it. */
export const dynamic = "force-dynamic";

export const GET = route<{ params: Promise<{ docId: string }> }>(async (request, context) => {
  const ctx = await requireOrg();
  const { docId } = await context.params;
  const doc = await getLibraryDoc(ctx, docId);
  return serveSourceFile({ storageKey: doc.storageKey, fileName: doc.fileName, forceDownload: new URL(request.url).searchParams.has("download") });
});
