// Loads .env.local then .env into process.env for scripts that run outside Next.js
// (migrations, seed, paddle:setup, tests). Variables that are already set win, and
// .env.local wins over .env — the same precedence Next.js uses. No-op on Vercel.
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnv(cwd = process.cwd()) {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(cwd, file);
    if (existsSync(path)) process.loadEnvFile(path);
  }
}
