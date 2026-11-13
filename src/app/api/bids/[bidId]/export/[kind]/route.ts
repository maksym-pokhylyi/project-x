import { exportAnswersDocx, exportBriefDocx, exportRequirementsCsv, exportRequirementsDocx, type ExportFile } from "@/features/bids/server/export";
import { NotFoundError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { route } from "@/server/http";
import { requireOrg } from "@/server/session";

/**
 * Downloads generated on the server:
 *   /export/answers            all answers (Word)        — needs a full bid
 *   /export/brief              the cited bid check (Word)
 *   /export/requirements-docx  the requirements checklist (Word)
 *   /export/requirements-csv   the requirements checklist (CSV)
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = route<{ params: Promise<{ bidId: string; kind: string }> }>(async (_request, context) => {
  const ctx = await requireOrg();
  const { bidId, kind } = await context.params;
  await enforceRateLimit(`bids-export:${ctx.organization.id}`, { limit: 120, windowSeconds: 3600 });
  let file: ExportFile;
  switch (kind) {
    case "answers":
      file = await exportAnswersDocx(ctx, bidId);
      break;
    case "brief":
      file = await exportBriefDocx(ctx, bidId);
      break;
    case "requirements-docx":
      file = await exportRequirementsDocx(ctx, bidId);
      break;
    case "requirements-csv":
      file = await exportRequirementsCsv(ctx, bidId);
      break;
    default:
      throw new NotFoundError();
  }
  return new Response(file.body as BodyInit, {
    headers: {
      "content-type": file.contentType,
      "content-length": String(file.body.byteLength),
      "content-disposition": `attachment; filename="${file.fileName}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
