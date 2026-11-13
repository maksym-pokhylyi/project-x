import { handleBlobUpload } from "@/features/bids/server/blob-upload";
import { route } from "@/server/http";
import { requireOrg } from "@/server/session";

/**
 * Token route for direct browser -> Vercel Blob uploads of tender pack files
 * (`upload()` from @vercel/blob/client posts here). See blob-upload.ts for the checks.
 */
export const dynamic = "force-dynamic";

export const POST = route(async (request) => handleBlobUpload(request, null, () => requireOrg()));
