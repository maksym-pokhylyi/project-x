/**
 * Browser-side upload of one file to where the server said it should go:
 *  - "blob"   production: straight to Vercel Blob (private store) with a one-file client
 *             token from our token route — the bytes never pass through a function;
 *  - "direct" local development: a PUT to our own route.
 * Client-only module (imported by client components). ONE helper for the bid form and the
 * library panel.
 *
 * Uploads to Blob must not depend on HTTP/2. The Blob client reports progress by streaming
 * the request body, and browsers only allow a streamed upload over HTTP/2 or later: behind a
 * TLS-inspecting proxy, antivirus HTTPS scanning or some VPNs the connection is HTTP/1.1 and
 * the request fails before a byte is sent. So a Blob upload is a chain, each step tried once:
 *
 *   (a) streamed, with progress        — skipped for the rest of the browser session once it failed;
 *   (b) the same upload, plain body    — works over HTTP/1.1; no progress, shown as "Uploading…";
 *   (c) our own route (small files)    — for the case that the storage host cannot be reached at all;
 *                                        once that happened, small files go there directly.
 *
 * A step that makes no progress for a while counts as failed. When the chain is exhausted
 * the caller gets an UploadError and shows the row's error state: an upload never hangs.
 */
export type UploadTargetLike = { pathname: string; contentType: string; mode: "blob" | "direct"; directUrl: string };

export type UploadStep = "streamed" | "plain" | "server";

/** The chain is exhausted, or the server refused the file. `message` is fit to show. */
export class UploadError extends Error {
  /** True when trying again can help (a connection problem), false when the file itself was refused. */
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "UploadError";
    this.retryable = retryable;
  }
}

export const UPLOAD_FAILED_MESSAGE = "Could not upload. Check your connection and try again.";
/** Our own route takes a file only up to this size on Vercel (request bodies are capped there). */
export const SERVER_FALLBACK_MAX_BYTES = 4 * 1024 * 1024;
/** No progress for this long: the step is treated as failed. */
export const STALL_MS = 30_000;
/** A streamed upload that has not sent anything after this long is not going to (it fails at once behind a proxy, then retries quietly). */
export const FIRST_PROGRESS_MS = 8_000;
const NO_STREAM_KEY = "bidfolio:upload:no-stream";
const NO_STORAGE_HOST_KEY = "bidfolio:upload:no-storage-host";
/** The plain step reports nothing until it ends: give it the time a slow line needs, within these bounds. */
const PLAIN_MIN_MS = 30_000;
const PLAIN_MAX_MS = 10 * 60_000;
const SLOW_LINE_BYTES_PER_SECOND = 50_000;

type BlobUpload = (typeof import("@vercel/blob/client"))["upload"];
type Options = {
  file: File;
  target: UploadTargetLike;
  tokenUrl: string;
  clientPayload: Record<string, unknown>;
  /** Percent sent, or null while a step that cannot report progress is running. */
  onProgress: (percent: number | null) => void;
  signal?: AbortSignal;
  /** Which step is running now (for tests and diagnostics). */
  onStep?: (step: UploadStep) => void;
  /** Test seams. */
  deps?: { upload?: BlobUpload; putToServer?: typeof putToServer; storage?: Pick<Storage, "getItem" | "setItem"> | null; stallMs?: number; firstProgressMs?: number };
};

const failedInThisPage = new Set<string>();

function sessionStore(deps: Options["deps"]): Pick<Storage, "getItem" | "setItem"> | null {
  if (deps && "storage" in deps) return deps.storage ?? null;
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null; // storage blocked: the page-level flag still works
  }
}

/** What this browser session has learnt: a step that failed on the connection is not tried again for the next files. */
function knownToFail(key: string, deps: Options["deps"]): boolean {
  if (failedInThisPage.has(key)) return true;
  try {
    return sessionStore(deps)?.getItem(key) === "1";
  } catch {
    return false;
  }
}

function rememberFailed(key: string, deps: Options["deps"]): void {
  failedInThisPage.add(key);
  try {
    sessionStore(deps)?.setItem(key, "1");
  } catch {
    // nothing to remember it in; this page still knows
  }
}

/** Tests only. */
export function resetUploadMemoryForTests(): void {
  failedInThisPage.clear();
}

/**
 * A failure of the connection (as opposed to an answer from the server): the request never
 * completed — "Failed to fetch", a network error, an aborted or stalled step.
 */
export function isNetworkFailure(error: unknown): boolean {
  if (error instanceof StalledError) return true;
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  const text = `${typeof name === "string" ? name : ""} ${typeof message === "string" ? message : ""}`;
  if (error instanceof TypeError) return true;
  return /failed to fetch|networkerror|network error|load failed|network request failed|err_|fetch failed|unknown error, please visit/i.test(text);
}

class StalledError extends Error {
  constructor() {
    super("The upload stopped making progress.");
    this.name = "StalledError";
  }
}

/**
 * Runs one step with its own abort signal and gives up on it — whether or not the step
 * itself ever settles — when `touch` is not called for `stallMs` (first call within
 * `firstMs`), or when the caller cancels.
 */
async function withStallGuard<T>(outer: AbortSignal | undefined, stallMs: number, firstMs: number, run: (signal: AbortSignal, touch: () => void) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let giveUp: (error: Error) => void = () => undefined;
  const gaveUp = new Promise<never>((_, reject) => {
    giveUp = reject;
  });
  gaveUp.catch(() => undefined);
  const arm = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      controller.abort();
      giveUp(new StalledError());
    }, ms);
  };
  const onOuterAbort = () => {
    controller.abort();
    giveUp(new TypeError("Failed to fetch"));
  };
  outer?.addEventListener("abort", onOuterAbort);
  arm(firstMs);
  const work = run(controller.signal, () => arm(stallMs));
  // An abandoned step may still reject later: that is expected, not an unhandled error.
  work.catch(() => undefined);
  try {
    return await Promise.race([work, gaveUp]);
  } finally {
    if (timer) clearTimeout(timer);
    outer?.removeEventListener("abort", onOuterAbort);
  }
}

/** PUT to our own route with XHR: progress works over any HTTP version. */
function putToServer(options: { url: string; file: File; contentType: string; onProgress: (percent: number) => void; signal?: AbortSignal }): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", options.url);
    request.setRequestHeader("content-type", options.contentType);
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
      // The server answered: this is its verdict on the file, not a connection problem.
      reject(new UploadError(message, request.status >= 500));
    };
    request.onerror = () => reject(new TypeError("Failed to fetch"));
    request.onabort = () => reject(new TypeError("Failed to fetch"));
    options.signal?.addEventListener("abort", () => request.abort());
    request.send(options.file);
  });
}

export async function uploadFile(options: Options): Promise<void> {
  const { file, target, deps } = options;
  const stallMs = deps?.stallMs ?? STALL_MS;
  const firstMs = deps?.firstProgressMs ?? FIRST_PROGRESS_MS;
  const toServer = deps?.putToServer ?? putToServer;
  const cancelled = () => options.signal?.aborted === true;
  const viaServer = () =>
    withStallGuard(options.signal, stallMs, stallMs, (signal, touch) =>
      toServer({
        url: target.directUrl,
        file,
        contentType: target.contentType,
        signal,
        onProgress: (percent) => {
          touch();
          options.onProgress(percent);
        },
      }),
    );

  if (target.mode !== "blob") {
    options.onStep?.("server");
    try {
      await viaServer();
    } catch (error) {
      if (error instanceof UploadError) throw error;
      throw new UploadError(cancelled() ? "Upload cancelled." : UPLOAD_FAILED_MESSAGE, true);
    }
    return;
  }

  const upload = deps?.upload ?? (await import("@vercel/blob/client")).upload;
  const toBlob = (signal: AbortSignal, onUploadProgress?: (event: { percentage: number }) => void) =>
    upload(target.pathname, file, {
      access: "private",
      handleUploadUrl: options.tokenUrl,
      clientPayload: JSON.stringify(options.clientPayload),
      contentType: target.contentType,
      multipart: file.size > 8 * 1024 * 1024,
      abortSignal: signal,
      ...(onUploadProgress ? { onUploadProgress } : {}),
    });
  /** Anything that is not a connection failure is the server's answer about this file: stop and show it. */
  const refuse = (error: unknown): never => {
    if (error instanceof UploadError) throw error;
    throw new UploadError(error instanceof Error && error.message ? error.message : "The upload failed. Try again.", false);
  };

  const fitsOurRoute = file.size <= SERVER_FALLBACK_MAX_BYTES;
  // The storage host could not be reached at all earlier in this session: a small file goes straight to (c).
  const skipStorageHost = fitsOurRoute && knownToFail(NO_STORAGE_HOST_KEY, deps);

  // (a) streamed, with progress
  if (!skipStorageHost && !knownToFail(NO_STREAM_KEY, deps)) {
    options.onStep?.("streamed");
    try {
      await withStallGuard(options.signal, stallMs, firstMs, (signal, touch) =>
        toBlob(signal, (event) => {
          // An event that reports nothing sent is not progress.
          if (event.percentage > 0) touch();
          options.onProgress(Math.round(event.percentage));
        }),
      );
      return;
    } catch (error) {
      if (cancelled()) throw new UploadError("Upload cancelled.", true);
      if (!isNetworkFailure(error)) refuse(error);
      rememberFailed(NO_STREAM_KEY, deps);
    }
  }

  // (b) the same upload with a plain body: no progress to report
  if (!skipStorageHost) {
    options.onStep?.("plain");
    options.onProgress(null);
    try {
      // Without progress events the only sign of life is the end: allow what a slow line needs before giving up.
      const allowance = deps?.stallMs ?? Math.min(PLAIN_MAX_MS, Math.max(PLAIN_MIN_MS, (file.size / SLOW_LINE_BYTES_PER_SECOND) * 1000));
      await withStallGuard(options.signal, allowance, allowance, (signal) => toBlob(signal));
      return;
    } catch (error) {
      if (cancelled()) throw new UploadError("Upload cancelled.", true);
      if (!isNetworkFailure(error)) refuse(error);
      rememberFailed(NO_STORAGE_HOST_KEY, deps);
    }
  }

  // (c) our own route, for a file small enough to pass through a function
  if (fitsOurRoute) {
    options.onStep?.("server");
    try {
      await viaServer();
      return;
    } catch (error) {
      if (error instanceof UploadError && !error.retryable) throw error;
    }
  }
  throw new UploadError(cancelled() ? "Upload cancelled." : UPLOAD_FAILED_MESSAGE, true);
}
