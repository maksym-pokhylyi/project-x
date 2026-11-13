// Computes WCAG 2.x contrast ratios for every text/background and boundary pair the
// design system uses, straight from the tokens in src/app/globals.css.
//
//   node scripts/design/contrast.mjs            prints the table, exits 1 on any failure
//   node scripts/design/contrast.mjs --write    also writes docs/design/CONTRAST.md
//
// Add a pair here whenever a component introduces a new foreground/background combination.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const css = readFileSync(resolve(root, "src/app/globals.css"), "utf8");

/** Reads `--color-<name>: #hex;` declarations from the @theme block. */
const tokens = Object.fromEntries(
  [...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((match) => [match[1], match[2].toUpperCase()]),
);

const channel = (value) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hex = (name) => {
  if (name.startsWith("#")) return name.toUpperCase();
  if (!tokens[name]) throw new Error(`Unknown token "${name}"`);
  return tokens[name];
};

const TEXT = 4.5; // normal text
const LARGE = 3; // ≥ 24 px, or ≥ 18.66 px bold; icons and UI boundaries

/** [foreground, background, minimum, where it is used] */
const pairs = [
  // Body text
  ["ink", "paper", TEXT, "Primary text on the page"],
  ["ink", "surface", TEXT, "Primary text on cards and inputs"],
  ["ink", "surface-sunken", TEXT, "Primary text on wells and table headers"],
  ["ink-2", "paper", TEXT, "Secondary text on the page"],
  ["ink-2", "surface", TEXT, "Secondary text on cards"],
  ["ink-2", "surface-sunken", TEXT, "Secondary text on wells, table headers, neutral chips"],
  ["ink-3", "paper", TEXT, "Tertiary text on the page"],
  ["ink-3", "surface", TEXT, "Tertiary text and placeholders on cards and inputs"],
  // Brand
  ["brand", "paper", TEXT, "Links and brand text on the page"],
  ["brand", "surface", TEXT, "Links on cards"],
  ["brand", "surface-sunken", TEXT, "Links on wells"],
  ["brand", "brand-tint", TEXT, "Brand badge, selected row, active navigation"],
  ["ink", "brand-tint", TEXT, "Text on a selected or hovered row"],
  ["#FFFFFF", "brand", TEXT, "Primary button label"],
  ["#FFFFFF", "brand-hover", TEXT, "Primary button label, hover and pressed"],
  ["paper", "brand", TEXT, "Text on the brand panel (auth, final call to action)"],
  ["brand-on-dark", "brand", TEXT, "Secondary text on the brand panel"],
  // Status roles: text on its tint, on surface and on paper
  ["accent-ink", "accent-tint", TEXT, "Amber chip and callout text (deadline soon, Verify)"],
  ["accent-ink", "surface", TEXT, "Amber text on cards"],
  ["accent-ink", "paper", TEXT, "Amber text on the page"],
  ["ink", "accent-tint", TEXT, "Body text inside an amber callout; Evidence needed highlight"],
  ["accent", "surface", LARGE, "Amber icons, bars and dots on cards (not text)"],
  ["accent", "paper", LARGE, "Amber icons, bars and dots on the page (not text)"],
  ["accent", "accent-tint", LARGE, "Amber icon inside an amber callout (not text)"],
  ["danger", "danger-tint", TEXT, "Danger chip and callout text (closing, Gap)"],
  ["danger", "surface", TEXT, "Field errors on cards"],
  ["danger", "paper", TEXT, "Field errors on the page"],
  ["ink", "danger-tint", TEXT, "Body text inside a danger callout"],
  ["#FFFFFF", "danger", TEXT, "Destructive button label"],
  ["success", "success-tint", TEXT, "Success chip and callout text (Met)"],
  ["success", "surface", TEXT, "Success text and ticks on cards"],
  ["success", "paper", TEXT, "Success text and ticks on the page"],
  ["ink", "success-tint", TEXT, "Body text inside a success callout"],
  ["info", "info-tint", TEXT, "Info chip and callout text (Early notice)"],
  ["info", "surface", TEXT, "Info text on cards"],
  ["info", "paper", TEXT, "Info text on the page"],
  ["ink", "info-tint", TEXT, "Body text inside an info callout"],
  // Inverse
  ["paper", "ink", TEXT, "Tooltip text"],
  // Boundaries and focus (non-text, 3:1)
  ["line-control", "surface", LARGE, "Input, checkbox, radio and switch boundary on cards"],
  ["line-control", "paper", LARGE, "Input boundary on the page"],
  ["focus", "paper", LARGE, "Focus ring on the page"],
  ["focus", "surface", LARGE, "Focus ring on cards"],
  ["focus", "surface-sunken", LARGE, "Focus ring on wells"],
  ["focus", "brand-tint", LARGE, "Focus ring on a selected row"],
  ["focus-on-dark", "brand", LARGE, "Focus ring on the brand panel"],
  ["brand", "surface", LARGE, "Checked checkbox, radio, switch and progress fill"],
];

/** Pairs that are deliberately NOT allowed; listed so the reason is on record. */
const avoid = [
  ["ink-3", "surface-sunken", "Tertiary text on wells: use ink-2 there"],
  ["accent", "accent-tint", "Amber text on its tint: use accent-ink"],
  ["accent", "paper", "Amber text on the page: use accent-ink"],
  ["#FFFFFF", "accent", "White text on solid amber: avoid solid amber fills behind text"],
  ["line-strong", "surface", "Hairline as the only boundary of a control: use line-control"],
  ["line", "paper", "Decorative hairline: never the only cue"],
];

let failures = 0;
const rows = pairs.map(([fg, bg, min, use]) => {
  const value = ratio(hex(fg), hex(bg));
  const ok = value >= min;
  if (!ok) failures += 1;
  return { fg, bg, min, use, value, ok };
});

const fmt = (value) => `${(Math.floor(value * 100) / 100).toFixed(2)}:1`;
const name = (token) => (token.startsWith("#") ? token : `${token} ${hex(token)}`);

for (const row of rows) {
  console.log(`${row.ok ? "pass" : "FAIL"}  ${fmt(row.value).padStart(8)}  (min ${row.min})  ${name(row.fg)} on ${name(row.bg)} — ${row.use}`);
}
console.log("\nPairs to avoid (for the record):");
for (const [fg, bg, why] of avoid) console.log(`      ${fmt(ratio(hex(fg), hex(bg))).padStart(8)}  ${name(fg)} on ${name(bg)} — ${why}`);

if (process.argv.includes("--write")) {
  const lines = [
    "# Colour contrast",
    "",
    "Generated by `node scripts/design/contrast.mjs --write` from the tokens in `src/app/globals.css`.",
    "WCAG 2.2 AA: 4.5:1 for text, 3:1 for large text, icons and control boundaries.",
    "",
    "| Foreground | Background | Ratio | Minimum | Result | Used for |",
    "|---|---|---|---|---|---|",
    ...rows.map((row) => `| \`${name(row.fg)}\` | \`${name(row.bg)}\` | ${fmt(row.value)} | ${row.min}:1 | ${row.ok ? "Pass" : "**Fail**"} | ${row.use} |`),
    "",
    "## Pairs to avoid",
    "",
    "| Foreground | Background | Ratio | Why |",
    "|---|---|---|---|",
    ...avoid.map(([fg, bg, why]) => `| \`${name(fg)}\` | \`${name(bg)}\` | ${fmt(ratio(hex(fg), hex(bg)))} | ${why} |`),
    "",
  ];
  writeFileSync(resolve(root, "docs/design/CONTRAST.md"), lines.join("\n"));
  console.log("\nWrote docs/design/CONTRAST.md");
}

if (failures > 0) {
  console.error(`\n${failures} pair(s) below the minimum.`);
  process.exit(1);
}
