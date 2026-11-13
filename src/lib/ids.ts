import { randomBytes, randomInt } from "node:crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Random base62 id in the same format Better Auth uses for its own rows. */
export function newId(length = 32): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += BASE62[randomInt(BASE62.length)];
  return out;
}

/** Short lowercase token for slugs and file names. */
export function shortToken(bytes = 4): string {
  return randomBytes(bytes).toString("hex");
}

/** URL-safe slug: lowercase letters, digits and single dashes. */
export function slugify(input: string, maxLength = 40): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || "workspace";
}
