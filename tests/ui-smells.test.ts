import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain ESM script shared with `pnpm ui:audit`
import { SMELLS, scanUiSmells } from "../scripts/ui-smells.mjs";

/**
 * Ratchet for the design-system rule (AGENTS.md): UI goes through the component library.
 * `pnpm ui:audit` lists every place that bypasses it; the totals are pinned in
 * tests/ui-smells.baseline.json and may only go DOWN.
 *
 *  - A total above the baseline fails: do not add a new bypass — use or extend a component.
 *  - A total below the baseline also fails, asking you to lower the baseline in the same
 *    commit (`pnpm ui:audit --json > tests/ui-smells.baseline.json`), so the gain is kept.
 *  - Merging a branch that was written before the rule may raise the baseline once; say so
 *    in the commit message.
 */
type Totals = Record<string, number>;
const baseline = JSON.parse(readFileSync(join(__dirname, "ui-smells.baseline.json"), "utf8")) as Totals;
const { totals, findings } = scanUiSmells() as { totals: Totals; findings: Array<{ smell: string; file: string; line: number; sample: string }> };

describe("UI smells ratchet", () => {
  for (const key of Object.keys(SMELLS as Record<string, { title: string; fix: string }>)) {
    const smell = (SMELLS as Record<string, { title: string; fix: string }>)[key]!;
    it(`${smell.title}: not more than the baseline`, () => {
      const worst = findings.filter((finding) => finding.smell === key).slice(0, 12).map((finding) => `src/${finding.file}:${finding.line}  ${finding.sample}`);
      expect(totals[key], `${smell.title} — ${smell.fix}. Run \`pnpm ui:audit\` for the full list. First findings:\n${worst.join("\n")}`).toBeLessThanOrEqual(baseline[key] ?? 0);
    });
  }

  it("the baseline is lowered when smells are removed", () => {
    const improved = Object.keys(baseline).filter((key) => (totals[key] ?? 0) < baseline[key]!);
    expect(improved, `fewer smells than the baseline for: ${improved.join(", ")} — run \`pnpm ui:audit --json > tests/ui-smells.baseline.json\` and commit it`).toEqual([]);
  });
});
