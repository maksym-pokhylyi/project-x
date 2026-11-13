// UI "smell" scanner — the ratchet behind the design-system rule in AGENTS.md.
//
//   pnpm ui:audit            full report (per smell, per file, with line numbers)
//   pnpm ui:audit --json     machine-readable totals
//   tests/ui-smells.test.ts  fails when a total grows above tests/ui-smells.baseline.json
//
// Every smell is a way of bypassing the component library: the next person fixes the
// pattern in one place and this copy keeps the old behaviour (a button taller than its
// input, a navigation without a current state, a link that looks like a button but is not
// one …). Fix: use or extend a component in src/components/ui.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Not scanned: the library itself, e-mail templates (inline styles are required there), the styleguide. */
const EXCLUDED = [
  /^components\/ui\//,
  /^emails\//,
  /^features\/notifications\/emails\//,
  /^lib\/email\//,
  /^app\/styleguide\//,
  /^components\/styleguide\//,
  /^app\/global-error\.tsx$/,
  // Generated images (Open Graph, icons) are drawn with inline styles and literal colours by necessity.
  /^app\/(opengraph-image|twitter-image|apple-icon|icon)\.tsx$/,
];

const CONTROL = "(?:Button|ButtonLink|Input|Textarea|SelectTrigger|NativeSelect|CopyField)";

export const SMELLS = {
  buttonAsChildLink: {
    title: "Link dressed as a Button by hand (`<Button asChild>`)",
    fix: "use <ButtonLink href=…> (src/components/ui/button-link.tsx)",
    pattern: /<Button\b[^>]*\basChild\b/g,
  },
  controlHeightOverride: {
    title: "Height set on a library control at the call site",
    fix: "use the control's `size` (44 / 48 / 52) so a field and its button always match",
    pattern: new RegExp(`<${CONTROL}\\b[^>]*className=(?:"[^"]*|\\{[^}]*)\\b(?:[a-z-]+:)*(?:h|min-h|size)-(?:\\d|\\[)`, "g"),
  },
  magicOffset: {
    title: "Arbitrary margin / position value (alignment by eye)",
    fix: "align by structure (FormRow, grid, gap); spacing comes from the scale",
    pattern: /(?<![\w-])-?(?:m[trblxy]?|top|bottom|left|right|inset(?:-[xy])?|translate-[xy])-\[[^\]]+\]/g,
  },
  hardCodedColor: {
    title: "Colour written as a hex value",
    fix: "use a token (ink, ink-2, paper, line, brand, accent, danger, info …)",
    pattern: /#[0-9A-Fa-f]{6}\b/g,
    // The browser's own chrome (the `theme-color` meta of the root layout) is outside CSS: a token cannot reach it.
    exceptLine: /\bthemeColor\s*:/,
  },
  arbitraryFontSize: {
    title: "Font size outside the type scale",
    fix: "use text-13 / text-sm / text-15 / text-base … or a type-* role",
    pattern: /(?<![\w-])text-\[\d+(?:\.\d+)?(?:px|rem)\]/g,
  },
  inlineStyle: {
    title: "Inline style",
    fix: "use utilities / tokens; a truly dynamic value (a width in %) goes through a CSS variable",
    pattern: /style=\{\{/g,
  },
  legacyToken: {
    title: "Pre-design-system token (unstyled leftovers)",
    fix: "restyle with the Bidfolio tokens: text-ink-2, bg-surface, border-line, rounded-card / rounded-control …",
    pattern: /(?<![\w-])(?:text-muted-foreground|text-foreground|bg-background|bg-card|bg-sidebar|bg-muted|border-input|bg-primary|text-primary|text-primary-foreground|bg-secondary|text-accent-foreground|text-destructive|bg-destructive|ring-ring|rounded-(?:md|lg|xl))(?![\w-])/g,
  },
};

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}

/** Comments are blanked (line structure kept) so documentation may mention the patterns. */
function withoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/.*$/gm, (line, lead) => lead + " ".repeat(line.length - lead.length));
}

export function scanUiSmells(root = ROOT) {
  const totals = Object.fromEntries(Object.keys(SMELLS).map((key) => [key, 0]));
  const findings = [];
  for (const path of files(root)) {
    const file = relative(root, path).split("\\").join("/");
    if (EXCLUDED.some((rule) => rule.test(file))) continue;
    const text = withoutComments(readFileSync(path, "utf8"));
    for (const [key, smell] of Object.entries(SMELLS)) {
      for (const match of text.matchAll(smell.pattern)) {
        if (smell.exceptLine) {
          const lineStart = text.lastIndexOf("\n", match.index) + 1;
          const lineEnd = text.indexOf("\n", match.index);
          if (smell.exceptLine.test(text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd))) continue;
        }
        totals[key] += 1;
        findings.push({ smell: key, file, line: text.slice(0, match.index).split("\n").length, sample: match[0].replace(/\s+/g, " ").slice(0, 90) });
      }
    }
  }
  return { totals, findings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { totals, findings } = scanUiSmells();
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(totals, null, 2)}\n`);
  } else {
    for (const [key, smell] of Object.entries(SMELLS)) {
      const own = findings.filter((finding) => finding.smell === key);
      process.stdout.write(`\n${smell.title}: ${own.length}\n  fix: ${smell.fix}\n`);
      const byFile = new Map();
      for (const finding of own) byFile.set(finding.file, [...(byFile.get(finding.file) ?? []), finding]);
      for (const [file, list] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
        process.stdout.write(`  ${String(list.length).padStart(3)}  src/${file}  (lines ${list.slice(0, 8).map((finding) => finding.line).join(", ")}${list.length > 8 ? ", …" : ""})\n`);
      }
    }
    process.stdout.write(`\nTotal: ${findings.length}\n`);
  }
}
