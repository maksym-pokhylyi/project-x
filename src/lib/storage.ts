import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, issueSignedToken, presignUrl, put } from "@vercel/blob";
import { appUrl, env, features } from "@/env";

/**
 * File storage abstraction: `storage.put / get / delete / signedUrl`.
 *
 * Backend is chosen once from env:
 *  - BLOB_READ_WRITE_TOKEN set -> Vercel Blob, PRIVATE access (nothing is publicly readable)
 *  - otherwise                 -> local filesystem under ./.data/storage (dev, tests, e2e)
 *
 * Keys are slash-separated paths. Tenant files MUST live under `org/<organizationId>/…`
 * (use `orgFileKey`), which is what /api/files authorises against.
 */
export type StoredFile = {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  size: number | null;
};

export type PutOptions = { contentType: string };

export interface Storage {
  put(key: string, data: Uint8Array, options: PutOptions): Promise<void>;
  /** Returns null when the key does not exist. */
  get(key: string): Promise<StoredFile | null>;
  delete(key: string): Promise<void>;
  /** Time-limited URL that grants read access to exactly this key without a session. */
  signedUrl(key: string, options?: { expiresInSeconds?: number }): Promise<string>;
}

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

export function isValidStorageKey(key: string): boolean {
  return key.length > 0 && key.length <= 512 && KEY_PATTERN.test(key) && !key.split("/").includes("..");
}

function assertKey(key: string): void {
  if (!isValidStorageKey(key)) throw new Error(`Invalid storage key: ${JSON.stringify(key)}`);
}

/** Builds a key inside a workspace's namespace: org/<organizationId>/<...parts>. */
export function orgFileKey(organizationId: string, ...parts: string[]): string {
  const key = ["org", organizationId, ...parts].join("/");
  assertKey(key);
  return key;
}

/** The workspace a key belongs to, or null for keys outside any tenant namespace. */
export function organizationIdFromKey(key: string): string | null {
  const [prefix, organizationId, ...rest] = key.split("/");
  return prefix === "org" && organizationId && rest.length > 0 ? organizationId : null;
}

// --- Signed URLs for the local backend (HMAC over key + expiry) -----------------------

function signingKey(): Buffer {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update("storage-signed-url:v1").digest();
}

function signatureFor(key: string, expires: number): string {
  return createHmac("sha256", signingKey()).update(`${key}\n${expires}`).digest("hex");
}

/** Verifies `?expires=&signature=` produced by the local backend's signedUrl(). */
export function verifyLocalSignedUrl(key: string, expires: string | null, signature: string | null, now = new Date()): boolean {
  if (!expires || !signature || !/^\d{1,12}$/.test(expires) || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const expiresAt = Number(expires);
  if (expiresAt * 1000 < now.getTime()) return false;
  const expected = Buffer.from(signatureFor(key, expiresAt), "hex");
  const given = Buffer.from(signature, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// --- Local filesystem backend ----------------------------------------------------------

const LOCAL_ROOT = path.resolve(process.cwd(), ".data", "storage");

function localPath(key: string): string {
  assertKey(key);
  const resolved = path.resolve(LOCAL_ROOT, key);
  if (!resolved.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Storage key escapes the storage root");
  return resolved;
}

const localStorage: Storage = {
  async put(key, data, options) {
    const file = localPath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
    await writeFile(`${file}.meta.json`, JSON.stringify({ contentType: options.contentType }));
  },
  async get(key) {
    const file = localPath(key);
    try {
      const [data, info, meta] = await Promise.all([readFile(file), stat(file), readFile(`${file}.meta.json`, "utf8")]);
      const contentType = (JSON.parse(meta) as { contentType?: string }).contentType ?? "application/octet-stream";
      return { body: new Blob([new Uint8Array(data)]).stream(), contentType, size: info.size };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },
  async delete(key) {
    const file = localPath(key);
    await Promise.all([rm(file, { force: true }), rm(`${file}.meta.json`, { force: true })]);
  },
  async signedUrl(key, options) {
    assertKey(key);
    const expires = Math.floor(Date.now() / 1000) + (options?.expiresInSeconds ?? 300);
    return `${appUrl}/api/files/${key}?expires=${expires}&signature=${signatureFor(key, expires)}`;
  },
};

// --- Vercel Blob backend (private store) -----------------------------------------------

const blobStorage: Storage = {
  async put(key, data, options) {
    assertKey(key);
    await put(key, Buffer.from(data), {
      access: "private",
      contentType: options.contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  },
  async get(key) {
    assertKey(key);
    const result = await get(key, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return { body: result.stream, contentType: result.blob.contentType, size: result.blob.size };
  },
  async delete(key) {
    assertKey(key);
    await del(key);
  },
  async signedUrl(key, options) {
    assertKey(key);
    const validUntil = Date.now() + (options?.expiresInSeconds ?? 300) * 1000;
    const token = await issueSignedToken({ pathname: key, operations: ["get"], validUntil });
    const { presignedUrl } = await presignUrl(token, { access: "private", operation: "get", pathname: key, validUntil });
    return presignedUrl;
  },
};

export const storage: Storage = features.blobStorage ? blobStorage : localStorage;
export const storageBackend: "vercel-blob" | "local" = features.blobStorage ? "vercel-blob" : "local";
