import "server-only";
import { ValidationError } from "@/lib/errors";
import { storage, storageBackend } from "@/lib/storage";

/**
 * Upload through one of our own routes: the browser PUTs the file and we write it to the
 * storage helper.
 *  - Without Vercel Blob (local development, e2e) this is how every file arrives.
 *  - With Vercel Blob it is the LAST fallback of the browser's upload chain
 *    (components/upload-client.ts), for a browser that cannot reach the storage host at all.
 *    Request bodies are capped at about 4.5 MB on Vercel, so only small files are taken here;
 *    larger ones must go straight to storage.
 */
export const DIRECT_UPLOAD_MAX_BYTES_ON_BLOB = 4 * 1024 * 1024;

/**
 * Where the browser sends a file first: to Vercel Blob when the store is configured, else to
 * our own route. In an offline test run (BIDS_OFFLINE_AI=1, never on a production
 * deployment) the cookie `bids-e2e-upload=blob` asks for the Blob client anyway, so the
 * browser test can exercise its fallback chain without a store.
 */
export async function browserUploadMode(): Promise<"blob" | "direct"> {
  if (storageBackend === "vercel-blob") return "blob";
  if (process.env.BIDS_OFFLINE_AI === "1" && process.env.VERCEL_ENV !== "production") {
    const { cookies } = await import("next/headers");
    if ((await cookies()).get("bids-e2e-upload")?.value === "blob") return "blob";
  }
  return "direct";
}

export async function receiveDirectUpload(request: Request, options: { storageKey: string; contentType: string; maxBytes: number }): Promise<number> {
  const maxBytes = storageBackend === "vercel-blob" ? Math.min(options.maxBytes, DIRECT_UPLOAD_MAX_BYTES_ON_BLOB) : options.maxBytes;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new ValidationError("This file is too large.");
  if (!request.body) throw new ValidationError("This file is empty.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
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
