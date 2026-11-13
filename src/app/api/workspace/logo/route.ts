import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { track } from "@/lib/analytics";
import { recordAudit } from "@/lib/audit";
import { ValidationError } from "@/lib/errors";
import { shortToken } from "@/lib/ids";
import { enforceRateLimit } from "@/lib/rate-limit";
import { orgFileKey, organizationIdFromKey, storage } from "@/lib/storage";
import { json, route } from "@/server/http";
import { requireOrg } from "@/server/session";

/**
 * Uploads the active workspace's logo (multipart field "file"). Admins and owners.
 * The file type is decided from its magic bytes, not from the client-supplied MIME type.
 */
const MAX_BYTES = 1024 * 1024;

function detectImageType(bytes: Uint8Array): { contentType: string; extension: string } | null {
  const startsWith = (signature: number[], offset = 0) => signature.every((byte, index) => bytes[offset + index] === byte);
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { contentType: "image/png", extension: "png" };
  if (startsWith([0xff, 0xd8, 0xff])) return { contentType: "image/jpeg", extension: "jpg" };
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return { contentType: "image/webp", extension: "webp" };
  return null;
}

function logoKeyFromUrl(logo: string | null): string | null {
  const prefix = "/api/files/";
  return logo?.startsWith(prefix) ? logo.slice(prefix.length) : null;
}

export const POST = route(async (request, _context, { requestId }) => {
  const ctx = await requireOrg({ role: "admin" });
  await enforceRateLimit(`logo:${ctx.organization.id}`, { limit: 20, windowSeconds: 3600 });

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BYTES + 16 * 1024) throw new ValidationError("The logo must be 1 MB or smaller.");

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ValidationError("Choose an image to upload.");
  if (file.size === 0 || file.size > MAX_BYTES) throw new ValidationError("The logo must be 1 MB or smaller.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) throw new ValidationError("Upload a PNG, JPEG or WebP image.");

  const key = orgFileKey(ctx.organization.id, "logo", `${shortToken(8)}.${type.extension}`);
  await storage.put(key, bytes, { contentType: type.contentType });
  const logoUrl = `/api/files/${key}`;
  await db.update(organizations).set({ logo: logoUrl }).where(eq(organizations.id, ctx.organization.id));

  // Best-effort removal of the previous logo (only if it lives in this workspace's namespace).
  const previousKey = logoKeyFromUrl(ctx.organization.logo);
  if (previousKey && organizationIdFromKey(previousKey) === ctx.organization.id) {
    await storage.delete(previousKey).catch(() => undefined);
  }

  await recordAudit({
    organizationId: ctx.organization.id,
    actor: { type: "user", id: ctx.user.id },
    action: "workspace.logo_updated",
    target: `organization:${ctx.organization.id}`,
  });
  await track("workspace.logo_uploaded", { organizationId: ctx.organization.id, userId: ctx.user.id }, { bytes: bytes.byteLength });
  return json({ logo: logoUrl }, { requestId });
});
