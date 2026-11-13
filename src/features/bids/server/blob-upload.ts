import "server-only";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { fileKindFromName, MAX_FILE_BYTES, MAX_LIBRARY_FILE_BYTES } from "@/features/bids/constants";
import { ValidationError } from "@/lib/errors";
import { storageBackend } from "@/lib/storage";
import type { OrgContext } from "@/server/session";
import { getBid } from "./bids";
import { bidSourceKey, librarySourceKey } from "./store";

/**
 * Direct browser -> Vercel Blob uploads (production). Function request bodies are capped
 * at ~4.5 MB, so the bytes never pass through our functions: the browser asks this route
 * for a short-lived client token for ONE exact pathname, uploads straight to the private
 * store, then calls the register action, which reads the object back through the storage
 * helper and trusts nothing the browser said about it.
 *
 * The token is only issued when the pathname is exactly the key our own naming scheme
 * gives for (workspace from the session, bid, file id, type) — a client cannot obtain a
 * token for another workspace's namespace or for an arbitrary path.
 */

const payloadSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("bid"), bidId: z.uuid(), fileId: z.uuid(), name: z.string().min(1).max(255) }),
  z.object({ scope: z.literal("library"), docId: z.uuid(), name: z.string().min(1).max(255) }),
]);

export type UploadClientPayload = z.infer<typeof payloadSchema>;

export async function handleBlobUpload(request: Request, ctx: OrgContext | null, resolveContext: () => Promise<OrgContext>): Promise<Response> {
  if (storageBackend !== "vercel-blob") throw new ValidationError("Direct uploads are not configured in this environment.");
  const body = (await request.json()) as HandleUploadBody;
  const result = await handleUpload({
    request,
    body,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      // Token requests come from the signed-in browser; completion callbacks come from Vercel.
      const context = ctx ?? (await resolveContext());
      let payload: UploadClientPayload;
      try {
        payload = payloadSchema.parse(JSON.parse(clientPayload ?? "{}"));
      } catch {
        throw new ValidationError("Invalid upload request.");
      }
      const kind = fileKindFromName(payload.name);
      if (!kind) throw new ValidationError("This file type is not supported.");
      let expected: string;
      let maximumSizeInBytes: number;
      if (payload.scope === "bid") {
        const bid = await getBid(context, payload.bidId); // 404 for another workspace's bid
        if (bid.status !== "draft") throw new ValidationError("Files can only be added before the pack is analysed.");
        expected = bidSourceKey(context.organization.id, bid.id, payload.fileId, kind);
        maximumSizeInBytes = MAX_FILE_BYTES;
      } else {
        if (kind === "zip") throw new ValidationError("ZIP files cannot be added to the library.");
        expected = librarySourceKey(context.organization.id, payload.docId, kind);
        maximumSizeInBytes = MAX_LIBRARY_FILE_BYTES;
      }
      if (pathname !== expected) throw new ValidationError("Invalid upload path.");
      return {
        maximumSizeInBytes,
        addRandomSuffix: false,
        allowOverwrite: false,
        validUntil: Date.now() + 15 * 60_000,
        tokenPayload: JSON.stringify({ organizationId: context.organization.id }),
      };
    },
    // Nothing to do here: the browser calls the register action when the upload finishes,
    // and that action verifies the stored object itself.
    onUploadCompleted: async () => undefined,
  });
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
