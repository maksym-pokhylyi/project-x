import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Design-system guard (owner's rule): UI goes through the component library, so a fix is
 * made once and not in fifty places. Raw form controls outside src/components/ui are how
 * "a button taller than its input" ships: the page styles its own <input> and the two
 * drift apart. Feature and page code must use Button, ButtonLink, Input, Textarea, Select,
 * Checkbox, Switch … from src/components/ui (extend the library when something is missing).
 *
 * KNOWN_DEBT lists the files that still contain raw controls today. The list may only
 * shrink: remove a file when it is converted; never add one — add a component instead.
 */
const ROOT = join(__dirname, "..", "src");
const RAW_CONTROL = /<(input|select|textarea|button)\b(?![^>]*type="hidden")/;

const ALLOWED: Record<string, string> = {
  "app/global-error.tsx": "must render without the app's CSS or components",
};

const KNOWN_DEBT = new Set([
  "components/app/app-nav.tsx",
  "components/app/user-menu.tsx",
  "components/app/workspace-form.tsx",
  "components/app/workspace-switcher.tsx",
  "components/forms/native-select.tsx",
  "components/marketing/mobile-nav.tsx",
  "components/styleguide/demos.tsx",
  // Bids and library modules were written before the rule; they are converted in the consolidation round.
  "features/bids/components/answer-editor.tsx",
  "features/bids/components/bid-actions.tsx",
  "features/bids/components/citation.tsx",
  "features/bids/components/fact-confirm.tsx",
  "features/bids/components/gate-list.tsx",
  "features/bids/components/new-bid-form.tsx",
  "features/bids/components/processing-state.tsx",
  "features/bids/components/requirements-view.tsx",
  "features/library/components/docs-panel.tsx",
  "features/library/components/facts-form.tsx",
  "features/procurement/components/data-request-form.tsx",
  "features/procurement/components/radar-profile-form.tsx",
  "features/procurement/components/radar-screen.tsx",
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}

const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

describe("component-library guard", () => {
  const files = sourceFiles(ROOT)
    .map((path) => relative(ROOT, path).split("\\").join("/"))
    .filter((file) => !file.startsWith("components/ui/"));
  const offenders = files.filter((file) => RAW_CONTROL.test(withoutComments(readFileSync(join(ROOT, file), "utf8"))));

  it("no new raw <input>, <select>, <textarea> or <button> outside src/components/ui", () => {
    const unexpected = offenders.filter((file) => !(file in ALLOWED) && !KNOWN_DEBT.has(file));
    expect(unexpected, "use the components in src/components/ui (or add one there) instead of raw form controls").toEqual([]);
  });

  it("the known-debt list only shrinks: converted files are removed from it", () => {
    const stale = [...KNOWN_DEBT].filter((file) => !offenders.includes(file));
    expect(stale, "these files no longer contain raw controls — delete them from KNOWN_DEBT").toEqual([]);
  });
});
