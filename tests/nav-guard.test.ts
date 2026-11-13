import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Design-system guard: "where you are" is marked in ONE place — <NavLink>
 * (src/components/ui/nav-link.tsx). A component that sets aria-current itself, or compares
 * usePathname() with an href, will sooner or later ship a navigation without a visible
 * current state (it has happened: settings tabs, the admin bar). Breadcrumb and pagination
 * are the two other primitives that legitimately own a "current" item.
 */
const ROOT = join(__dirname, "..", "src");
const ALLOWED = new Set([
  "components/ui/nav-link.tsx",
  "components/ui/breadcrumb.tsx",
  "components/ui/pagination.tsx",
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}

describe("navigation guard", () => {
  it("only NavLink, Breadcrumb and Pagination set aria-current", () => {
    const offenders = sourceFiles(ROOT)
      .map((path) => relative(ROOT, path).split("\\").join("/"))
      .filter((file) => !ALLOWED.has(file))
      // aria-current="step" belongs to progress trackers, which are not navigation.
      .filter((file) => /aria-current\s*=(?!\s*"step")(?!\s*\{[^}]*"step")/.test(readFileSync(join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")));
    expect(offenders, "use <NavLink> (src/components/ui/nav-link.tsx) instead of setting aria-current by hand").toEqual([]);
  });

  it("every <nav> with route links uses NavLink or is a list of plain links without a current state", () => {
    // Navigations that are allowed to have no "current" item: footers, legal links, on-page contents.
    const noCurrentState = /aria-label="(Footer|Legal|On this page|Styleguide sections|Breadcrumb|Pagination)"/;
    const offenders = sourceFiles(ROOT)
      .map((path) => relative(ROOT, path).split("\\").join("/"))
      .filter((file) => !ALLOWED.has(file))
      .filter((file) => {
        const text = readFileSync(join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
        const navs = text.match(/<nav\b[^>]*>/g) ?? [];
        return navs.some((nav) => !noCurrentState.test(nav)) && !/\bNavLink\b/.test(text);
      });
    expect(offenders, "a navigation that can contain the current page must render its links with <NavLink>").toEqual([]);
  });
});
