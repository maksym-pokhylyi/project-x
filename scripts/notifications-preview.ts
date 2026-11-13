/**
 * Renders a scheduled e-mail for one workspace to files, for a visual check.
 *
 *   pnpm notifications:preview <workspace-id> [--kind digest|alert|reminder|renewal]
 *                                             [--mode auto|live|sample] [--out <dir>]
 *
 *   --kind   which e-mail (default digest)
 *   --mode   live   = exactly what is new for the workspace's first owner right now
 *            sample = everything on the radar treated as new (to look at the layout)
 *            auto   = live, falling back to sample when nothing is new (default)
 *   --out    directory for <kind>.html and <kind>.txt (default: a new folder in the system
 *            temp directory)
 *
 * Nothing is sent and nothing is written to the database. The two images of the mark are
 * inlined so the HTML opens offline. Uses DATABASE_URL from the environment / .env.local.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const KINDS = ["digest", "alert", "reminder", "renewal"] as const;
type Kind = (typeof KINDS)[number];
const MODES = ["auto", "live", "sample"] as const;
type Mode = (typeof MODES)[number];

function parseArgs(argv: string[]): { workspaceId: string; kind: Kind; mode: Mode; out: string | null } {
  const args = { workspaceId: "", kind: "digest" as Kind, mode: "auto" as Mode, out: null as string | null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]!;
    if (value === "--kind") {
      const kind = argv[++index];
      if (!KINDS.includes(kind as Kind)) throw new Error(`--kind must be one of: ${KINDS.join(", ")}`);
      args.kind = kind as Kind;
    } else if (value === "--mode") {
      const mode = argv[++index];
      if (!MODES.includes(mode as Mode)) throw new Error(`--mode must be one of: ${MODES.join(", ")}`);
      args.mode = mode as Mode;
    } else if (value === "--out") args.out = argv[++index] ?? null;
    else if (!value.startsWith("--") && !args.workspaceId) args.workspaceId = value;
  }
  if (!args.workspaceId) throw new Error("Usage: pnpm notifications:preview <workspace-id> [--kind digest|alert|reminder|renewal] [--mode auto|live|sample] [--out <dir>]");
  return args;
}

/** Replaces the hosted mark with data URIs so the file needs no server. */
function inlineImages(html: string): string {
  return html.replace(/src="[^"]*\/email\/(mark(?:-dark)?\.png)"/g, (_match, file: string) => {
    const data = readFileSync(resolve("public/email", file)).toString("base64");
    return `src="data:image/png;base64,${data}"`;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { pg } = await import("../src/db");
  const { buildPreview } = await import("../src/features/notifications/preview");
  const { renderEmail } = await import("../src/lib/email/templates");
  try {
    const preview = await buildPreview(args.workspaceId, args.kind, { mode: args.mode });
    if (preview.status === "empty") {
      console.log(`Workspace "${preview.workspace}": ${preview.reason}`);
      process.exitCode = 2;
      return;
    }
    const rendered = await renderEmail(preview.email.template);
    const out = args.out ? resolve(args.out) : mkdtempSync(join(tmpdir(), "bidfolio-notifications-"));
    mkdirSync(out, { recursive: true });
    const htmlPath = join(out, `${args.kind}.html`);
    const textPath = join(out, `${args.kind}.txt`);
    writeFileSync(htmlPath, inlineImages(rendered.html));
    writeFileSync(textPath, rendered.text);
    console.log(`Workspace: ${preview.workspace}`);
    console.log(`Mode:      ${preview.mode}${preview.mode === "sample" ? " (everything on the radar treated as new)" : ""}`);
    console.log(`Subject:   ${rendered.subject}`);
    console.log(`HTML:      ${htmlPath}`);
    console.log(`Text:      ${textPath}`);
  } finally {
    await pg.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
