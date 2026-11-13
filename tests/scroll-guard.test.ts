import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Where a scroll stops (owner report: "Pricing" from the top of the landing page opened
 * /pricing at its comparison table). The behaviour is checked in a browser by
 * e2e/app.spec.ts and by scripts/design/controls.mjs (rule "scroll"); this pins the two
 * static halves of the fix, which are easy to undo without noticing:
 *
 *  - smooth scrolling in the stylesheet needs <html data-scroll-behavior="smooth">, or the
 *    router's own scroll to a new page is animated and ends at a later section;
 *  - the sticky bar is allowed for by a scroll-margin on what is scrolled TO, never by
 *    scroll-padding on the page (which makes the bar's own controls count as out of view).
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
/** Comments out, so that a rule named in a comment does not count. */
const css = read("src/app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");
const layout = read("src/app/layout.tsx");

describe("where a scroll stops", () => {
  it("lets the router switch smooth scrolling off while it changes the page", () => {
    const smooth = /scroll-behavior:\s*smooth/.test(css);
    const attribute = /<html[^>]*\sdata-scroll-behavior="smooth"/.test(layout);
    expect(attribute, "smooth scrolling in globals.css and data-scroll-behavior on <html> go together").toBe(smooth);
  });

  it("allows for the sticky bar with a margin of the target, not padding of the page", () => {
    expect(css).not.toMatch(/scroll-padding/);
    expect(css).toMatch(/:where\(main, main :is\(\[id\][^)]*\)\)\s*\{\s*scroll-margin-top:\s*calc\(var\(--header-height\) \+ 1rem\)/);
  });

  it("sends the first block of a page to the very top, and leaves what sticks alone", () => {
    const pageBlocks = css.indexOf(":where(main > *)");
    const targets = css.indexOf(":where(main, main :is([id]");
    const sticky = css.indexOf(":where(.sticky, .sticky *)");
    expect(pageBlocks).toBeGreaterThan(-1);
    // Same specificity, so the order is the rule: page blocks, then targets, then what sticks.
    expect(targets).toBeGreaterThan(pageBlocks);
    expect(sticky).toBeGreaterThan(targets);
  });
});
