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
  // Text
  ["ink", "paper", TEXT, "Text on the page"],
  ["ink", "surface", TEXT, "Text on cards, inputs and the app bar"],
  ["ink", "paper-deep", TEXT, "Text on bands, wells and quiet chips"],
  ["ink-2", "paper", TEXT, "Muted text on the page"],
  ["ink-2", "surface", TEXT, "Muted text and placeholders on cards and inputs"],
  ["ink-2", "paper-deep", TEXT, "Muted text on bands, wells and the footer"],
  ["ink-2", "brand-tint", TEXT, "Muted text on a selected row or the Bid Pass panel"],
  // Brand
  ["brand", "paper", TEXT, "Eyebrows and green text on the page"],
  ["brand", "surface", TEXT, "Green text and ticks on cards; the label of a white button on green"],
  ["brand", "paper-deep", TEXT, "Eyebrows on a paper-deep band"],
  ["brand", "brand-tint", TEXT, "Source markers, avatar initials, eyebrow on the Bid Pass panel"],
  ["brand", "success-tint", TEXT, "The “Met” pill: brand green on success-tint"],
  ["ink", "brand-tint", TEXT, "Text on the verdict panel, a selected row, a reason chip"],
  ["ink", "brand-mark", TEXT, "A highlighted sentence in a source document"],
  ["#FFFFFF", "brand", TEXT, "Primary button label; text on the featured plan card"],
  ["#FFFFFF", "brand-hover", TEXT, "Primary button label, hover and pressed"],
  ["brand-on-dark", "brand", TEXT, "Secondary text on brand green"],
  // Ink surfaces
  ["#FFFFFF", "ink", TEXT, "A pressed filter chip"],
  ["paper", "ink", TEXT, "The independence band; tooltips"],
  // Status roles
  ["accent-ink", "paper", TEXT, "Small amber text on the page"],
  ["accent-ink", "surface", TEXT, "Small amber text on cards"],
  ["accent-ink", "accent-tint", TEXT, "Small amber text on its tint: “14 days left”, the trial strip, a warning title"],
  ["accent-ink", "paper-deep", TEXT, "A deadline on a paper-deep band"],
  ["accent-ink", "brand-tint", TEXT, "A deadline on the verdict panel or an upgrade band"],
  ["ink", "accent-tint", TEXT, "The “14 days left” pill; text in a warning panel"],
  ["accent", "paper", LARGE, "The deadline dot on the page (a marker, not text)"],
  ["accent", "surface", LARGE, "The deadline dot on cards (a marker, not text)"],
  ["accent", "accent-tint", LARGE, "The icon of a warning panel and the dot of the trial strip (not text)"],
  ["accent", "brand-tint", LARGE, "The deadline dot on a brand-tint band (a marker, not text)"],
  ["danger", "danger-tint", TEXT, "The “Gap” pill and the title of a gap panel"],
  ["danger", "surface", TEXT, "Field errors and “waiting on gap” on cards"],
  ["danger", "paper", TEXT, "Field errors on the page"],
  ["danger", "brand-tint", LARGE, "The gap icon on the verdict panel (not text)"],
  ["ink", "danger-tint", TEXT, "Text inside a gap panel"],
  ["#FFFFFF", "danger", TEXT, "Destructive button label"],
  ["#FFFFFF", "danger-hover", TEXT, "Destructive button label, hover and pressed"],
  ["danger", "danger-tint", TEXT, "The quiet destructive button on hover (red label on danger-tint)"],
  ["ink", "success-tint", TEXT, "Text inside a success panel"],
  ["info", "info-tint", TEXT, "The “For you to confirm” pill; notice-type labels"],
  ["info", "surface", TEXT, "“Needs your commitments” on cards"],
  ["info", "brand-tint", LARGE, "The info icon on the verdict panel (not text)"],
  ["ink", "info-tint", TEXT, "Text inside an info panel"],
  ["ink-2", "accent-tint", TEXT, "Muted text in the trial strip or a warning panel"],
  ["ink-2", "info-tint", TEXT, "Muted text in the test-mode band"],
  // E-mail in dark mode (src/emails/layout.tsx; clients that honour prefers-color-scheme)
  ["#F2EEE4", "#1B2023", TEXT, "E-mail, dark: text on the sheet"],
  ["#B4B9BC", "#1B2023", TEXT, "E-mail, dark: muted text on the sheet"],
  ["#E7B36A", "#1B2023", TEXT, "E-mail, dark: a deadline on the sheet"],
  ["#7CC3AD", "#1B2023", LARGE, "E-mail, dark: the mark and the underline of the action (not text)"],
  // Boundaries, fills and focus (non-text, 3:1)
  ["line-strong", "surface", LARGE, "The edge of inputs, tick boxes, radios, switches and outline buttons"],
  ["line-strong", "paper", LARGE, "The edge of a control placed on the page"],
  ["line-strong", "paper-deep", LARGE, "The edge of a control placed on a paper-deep band"],
  ["brand", "surface", LARGE, "Checked tick box, radio, switch; progress and score bars"],
  ["brand", "brand-tint", LARGE, "Score bars on a brand-tint chip"],
  ["ink", "surface", LARGE, "The rule under the current tab; the fill of a pressed filter chip"],
  ["focus", "paper", LARGE, "Focus ring on the page"],
  ["focus", "surface", LARGE, "Focus ring on cards"],
  ["focus", "paper-deep", LARGE, "Focus ring on a paper-deep band"],
  ["focus", "brand-tint", LARGE, "Focus ring on the verdict panel"],
  ["focus-on-dark", "brand", LARGE, "Focus ring on brand green"],
  ["focus-on-dark", "ink", LARGE, "Focus ring on the independence band"],
];

/** Pairs that are deliberately NOT allowed; listed so the reason is on record. */
const avoid = [
  ["accent", "paper", "Amber as small text on the page: write the words in ink beside an amber dot, or use accent-ink"],
  ["accent", "surface", "Amber as small text on cards: the same"],
  ["#FFFFFF", "accent", "White text on solid amber: amber is never a filled badge"],
  ["ink", "accent", "Ink text on solid amber: the same"],
  ["line", "surface", "A hairline as the only edge of a control: controls use line-strong"],
  ["info", "brand", "Info blue against brand green: equally dark, so never told apart by colour alone"],
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
