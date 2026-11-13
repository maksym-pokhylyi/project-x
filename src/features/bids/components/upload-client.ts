/**
 * Browser-side upload of one file to where the server said it should go:
 *  - "blob"   production: straight to Vercel Blob (private store) with a one-file client
 *             token from our token route — the bytes never pass through a function;
 *  - "direct" local development: a streamed PUT to our own route.
 * Client-only module (imported by client components).
 */
export type UploadTargetLike = { pathname: string; contentType: string; mode: "blob" | "direct"; directUrl: string };

export async function uploadFile(options: {
  file: File;
  target: UploadTargetLike;
  tokenUrl: string;
  clientPayload: Record<string, unknown>;
  onProgress: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { file, target } = options;
  if (target.mode === "blob") {
    const { upload } = await import("@vercel/blob/client");
    await upload(target.pathname, file, {
      access: "private",
      handleUploadUrl: options.tokenUrl,
      clientPayload: JSON.stringify(options.clientPayload),
      contentType: target.contentType,
      multipart: file.size > 8 * 1024 * 1024,
      abortSignal: options.signal,
      onUploadProgress: (event) => options.onProgress(Math.round(event.percentage)),
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", target.directUrl);
    request.setRequestHeader("content-type", target.contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) return resolve();
      let message = "The upload failed. Try again.";
      try {
        const body = JSON.parse(request.responseText) as { error?: { message?: string } };
        if (body.error?.message) message = body.error.message;
      } catch {
        // keep the generic message
      }
      reject(new Error(message));
    };
    request.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
    request.onabort = () => reject(new Error("Upload cancelled."));
    options.signal?.addEventListener("abort", () => request.abort());
    request.send(file);
  });
}
