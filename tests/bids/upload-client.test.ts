import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isNetworkFailure,
  resetUploadMemoryForTests,
  SERVER_FALLBACK_MAX_BYTES,
  UPLOAD_FAILED_MESSAGE,
  UploadError,
  uploadFile,
  type UploadStep,
} from "@/features/bids/components/upload-client";

/**
 * The browser's upload chain. Behind a TLS-inspecting proxy the connection to the storage
 * host is HTTP/1.1 and a streamed upload fails before a byte is sent ("Failed to fetch"):
 * the upload must fall back, remember that for the session, and never hang.
 */
const target = { pathname: "org/o1/bids/b1/src/f1.pdf", contentType: "application/pdf", mode: "blob" as const, directUrl: "/api/bids/b1/upload?fileId=f1" };
const fileOf = (bytes: number) => new File([new Uint8Array(bytes)], "pack.pdf", { type: "application/pdf" });
const failedToFetch = () => new TypeError("Failed to fetch");

function memory() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), values };
}

/** A fake of @vercel/blob/client `upload`: `streamed` and `plain` say what each kind of call does. */
function fakeBlob(behaviour: { streamed: () => Promise<unknown>; plain: () => Promise<unknown> }) {
  const calls: Array<"streamed" | "plain"> = [];
  const upload = vi.fn(async (_pathname: string, _body: unknown, options: { onUploadProgress?: (event: { percentage: number }) => void; abortSignal?: AbortSignal }) => {
    const kind = options.onUploadProgress ? "streamed" : "plain";
    calls.push(kind);
    if (kind === "streamed") options.onUploadProgress?.({ percentage: 0 });
    return (await behaviour[kind]()) as never;
  });
  return { upload: upload as never, calls };
}

async function run(options: { file?: File; blob: ReturnType<typeof fakeBlob>; putToServer?: () => Promise<void>; storage?: ReturnType<typeof memory> | null; stallMs?: number; firstProgressMs?: number }) {
  const steps: UploadStep[] = [];
  const progress: Array<number | null> = [];
  const putToServer = vi.fn(options.putToServer ?? (async () => undefined));
  const result = await uploadFile({
    file: options.file ?? fileOf(1000),
    target,
    tokenUrl: "/api/bids/upload-token",
    clientPayload: { scope: "bid" },
    onProgress: (percent) => progress.push(percent),
    onStep: (step) => steps.push(step),
    deps: { upload: options.blob.upload, putToServer: putToServer as never, storage: options.storage === undefined ? memory() : options.storage, stallMs: options.stallMs ?? 200, firstProgressMs: options.firstProgressMs ?? 200 },
  }).then(
    () => "done" as const,
    (error: unknown) => error,
  );
  return { result, steps, progress, putToServer };
}

describe("upload fallback chain", () => {
  beforeEach(resetUploadMemoryForTests);

  it("uploads streamed with progress when the connection allows it", async () => {
    const blob = fakeBlob({ streamed: async () => undefined, plain: async () => undefined });
    const { result, steps, putToServer } = await run({ blob });
    expect(result).toBe("done");
    expect(steps).toEqual(["streamed"]);
    expect(blob.calls).toEqual(["streamed"]);
    expect(putToServer).not.toHaveBeenCalled();
  });

  it("falls back a → b when the streamed request fails on the network, after ONE failure, and shows no number", async () => {
    const blob = fakeBlob({ streamed: () => Promise.reject(failedToFetch()), plain: async () => undefined });
    const { result, steps, progress } = await run({ blob });
    expect(result).toBe("done");
    expect(steps).toEqual(["streamed", "plain"]);
    expect(blob.calls).toEqual(["streamed", "plain"]); // one streamed attempt, not five
    expect(progress.at(-1)).toBeNull(); // "Uploading…", not a percentage
  });

  it("falls back a → b → c for a small file when the storage host cannot be reached at all", async () => {
    const blob = fakeBlob({ streamed: () => Promise.reject(failedToFetch()), plain: () => Promise.reject(failedToFetch()) });
    const { result, steps, putToServer } = await run({ blob, file: fileOf(SERVER_FALLBACK_MAX_BYTES) });
    expect(result).toBe("done");
    expect(steps).toEqual(["streamed", "plain", "server"]);
    expect(putToServer).toHaveBeenCalledTimes(1);
    expect((putToServer.mock.calls[0] as unknown[])[0]).toMatchObject({ url: target.directUrl, contentType: "application/pdf" });
  });

  it("ends in the error state — never a hang — when every step fails or the file is too large for our own route", async () => {
    const blob = fakeBlob({ streamed: () => Promise.reject(failedToFetch()), plain: () => Promise.reject(failedToFetch()) });
    const large = await run({ blob, file: fileOf(SERVER_FALLBACK_MAX_BYTES + 1) });
    expect(large.steps).toEqual(["streamed", "plain"]);
    expect(large.putToServer).not.toHaveBeenCalled();
    expect(large.result).toBeInstanceOf(UploadError);
    expect(large.result).toMatchObject({ message: UPLOAD_FAILED_MESSAGE, retryable: true });

    resetUploadMemoryForTests();
    const small = await run({ blob: fakeBlob({ streamed: () => Promise.reject(failedToFetch()), plain: () => Promise.reject(failedToFetch()) }), putToServer: () => Promise.reject(failedToFetch()) });
    expect(small.steps).toEqual(["streamed", "plain", "server"]);
    expect(small.result).toMatchObject({ message: "Could not upload. Check your connection and try again.", retryable: true });
  });

  it("remembers for the browser session that streaming failed and skips it for the next files", async () => {
    const storage = memory();
    const first = fakeBlob({ streamed: () => Promise.reject(failedToFetch()), plain: async () => undefined });
    await run({ blob: first, storage });
    expect(storage.values.get("bidfolio:upload:no-stream")).toBe("1");

    // The same page, the next file.
    const second = fakeBlob({ streamed: async () => undefined, plain: async () => undefined });
    expect((await run({ blob: second, storage })).steps).toEqual(["plain"]);
    expect(second.calls).toEqual(["plain"]);

    // A new page in the same browser session: the page forgot, the session did not.
    resetUploadMemoryForTests();
    const third = fakeBlob({ streamed: async () => undefined, plain: async () => undefined });
    expect((await run({ blob: third, storage })).steps).toEqual(["plain"]);
    // A new session starts with streaming again.
    resetUploadMemoryForTests();
    expect((await run({ blob: fakeBlob({ streamed: async () => undefined, plain: async () => undefined }), storage: memory() })).steps).toEqual(["streamed"]);
    // The storage host could not be reached at all: the next SMALL file goes straight to our own route,
    // a large one still has to try the plain upload.
    resetUploadMemoryForTests();
    const unreachable = memory();
    await run({ blob: fakeBlob({ streamed: () => Promise.reject(failedToFetch()), plain: () => Promise.reject(failedToFetch()) }), storage: unreachable });
    const next = fakeBlob({ streamed: async () => undefined, plain: async () => undefined });
    expect((await run({ blob: next, storage: unreachable })).steps).toEqual(["server"]);
    expect(next.calls).toEqual([]);
    expect((await run({ blob: fakeBlob({ streamed: async () => undefined, plain: async () => undefined }), storage: unreachable, file: fileOf(SERVER_FALLBACK_MAX_BYTES + 1) })).steps).toEqual(["plain"]);
    // Session storage blocked: the page-level memory still works.
    resetUploadMemoryForTests();
    await run({ blob: fakeBlob({ streamed: () => Promise.reject(failedToFetch()), plain: async () => undefined }), storage: null });
    expect((await run({ blob: fakeBlob({ streamed: async () => undefined, plain: async () => undefined }), storage: null })).steps).toEqual(["plain"]);
  });

  it("treats a streamed upload that sends nothing as failed instead of waiting for it", async () => {
    // The request never settles and reports no progress (what retries behind a proxy look like).
    const blob = fakeBlob({ streamed: () => new Promise(() => undefined), plain: async () => undefined });
    const started = Date.now();
    const { result, steps } = await run({ blob, firstProgressMs: 60 });
    expect(result).toBe("done");
    expect(steps).toEqual(["streamed", "plain"]);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("does not fall back when the server answered: a refused file is shown as refused", async () => {
    const refused = Object.assign(new Error("Vercel Blob: Access denied, please provide a valid token for this resource."), { name: "BlobAccessError" });
    const blob = fakeBlob({ streamed: () => Promise.reject(refused), plain: async () => undefined });
    const { result, steps } = await run({ blob });
    expect(steps).toEqual(["streamed"]);
    expect(result).toBeInstanceOf(UploadError);
    expect(result).toMatchObject({ retryable: false });
    expect(blob.calls).toEqual(["streamed"]);
  });

  it("without Blob (local development) goes to our own route and fails loudly", async () => {
    const blob = fakeBlob({ streamed: async () => undefined, plain: async () => undefined });
    const steps: UploadStep[] = [];
    const attempt = (putToServer: () => Promise<void>) =>
      uploadFile({ file: fileOf(10), target: { ...target, mode: "direct" }, tokenUrl: "/t", clientPayload: {}, onProgress: () => undefined, onStep: (step) => steps.push(step), deps: { upload: blob.upload, putToServer: putToServer as never, storage: null, stallMs: 200 } });
    await expect(attempt(async () => undefined)).resolves.toBeUndefined();
    await expect(attempt(() => Promise.reject(failedToFetch()))).rejects.toMatchObject({ message: UPLOAD_FAILED_MESSAGE, retryable: true });
    await expect(attempt(() => Promise.reject(new UploadError("This file is too large.", false)))).rejects.toMatchObject({ message: "This file is too large.", retryable: false });
    expect(steps).toEqual(["server", "server", "server"]);
    expect(blob.calls).toEqual([]);
  });

  it("tells a connection failure from an answer", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFailure(new Error("NetworkError when attempting to fetch resource."))).toBe(true);
    expect(isNetworkFailure(new Error("net::ERR_ALPN_NEGOTIATION_FAILED"))).toBe(true);
    expect(isNetworkFailure(Object.assign(new Error("Vercel Blob: Access denied"), { name: "BlobAccessError" }))).toBe(false);
    expect(isNetworkFailure(new UploadError("This file is too large.", false))).toBe(false);
    expect(isNetworkFailure(null)).toBe(false);
  });
});
