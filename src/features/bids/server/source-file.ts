import "server-only";
import { NotFoundError } from "@/lib/errors";
import { storage } from "@/lib/storage";

/**
 * Serves a stored source document to a person who was already authorised by the caller.
 *
 * PDFs are shown inline so a citation can open the document at its page (`#page=12`).
 * The type is decided from the file's magic bytes, never from what the uploader claimed:
 * anything that is not really a PDF is sent as a download, so an uploaded file can never
 * render as a page in our origin.
 */
export async function serveSourceFile(options: { storageKey: string; fileName: string; forceDownload?: boolean }): Promise<Response> {
  const stored = await storage.get(options.storageKey);
  if (!stored) throw new NotFoundError("The stored file is missing.");
  const bytes = new Uint8Array(await new Response(stored.body).arrayBuffer());
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
  const isPdf = head.includes("%PDF-");
  const baseName = (options.fileName.split("/").pop() ?? "document").replace(/[^\w .()\-]+/g, "_").slice(0, 150) || "document";
  const inline = isPdf && !options.forceDownload;
  return new Response(bytes, {
    headers: {
      "content-type": isPdf ? "application/pdf" : "application/octet-stream",
      "content-length": String(bytes.byteLength),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${baseName}"; filename*=UTF-8''${encodeURIComponent(baseName)}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=300",
      // No scripts, no embedding elsewhere, no referrer leaking the bid id.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex",
    },
  });
}
