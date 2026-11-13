import "server-only";
import { ValidationError } from "@/lib/errors";
import { storage, storageBackend } from "@/lib/storage";

/**
 * Streaming upload fallback for environments WITHOUT Vercel Blob (local development, e2e):
 * the browser PUTs the file to one of our routes and we write it to the storage helper.
 * On Vercel this path is refused — request bodies are capped at ~4.5 MB there, which is
 * exactly why production uploads go straight from the browser to Blob.
 */
export async function receiveDirectUpload(request: Request, options: { storageKey: string; contentType: string; maxBytes: number }): Promise<number> {
  if (storageBackend === "vercel-blob") throw new ValidationError("Upload files directly to storage in this environment.");
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > options.maxBytes) throw new ValidationError("This file is too large.");
  if (!request.body) throw new ValidationError("This file is empty.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > options.maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ValidationError("This file is too large.");
    }
    chunks.push(value);
  }
  if (size === 0) throw new ValidationError("This file is empty.");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  await storage.put(options.storageKey, bytes, { contentType: options.contentType });
  return size;
}
