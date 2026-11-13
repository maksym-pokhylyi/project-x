import { expect, type Page } from "@playwright/test";

/**
 * Control sizes (design system): a row never mixes two heights — a button beside a text
 * field has the field's height. Returns a description of every row that breaks the rule.
 */
export async function misalignedControls(page: Page): Promise<{ problems: string[]; rows: number }> {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const fields = [...document.querySelectorAll<HTMLElement>("main input, main select, [data-testid='sample-check'] input")].filter(
      (element) => !["checkbox", "radio", "file", "hidden", "range"].includes(element.getAttribute("type") ?? "") && visible(element),
    );
    const problems: string[] = [];
    let rows = 0;
    for (const field of fields) {
      const a = field.getBoundingClientRect();
      const middle = a.top + a.height / 2;
      // The row: the nearest ancestor that also holds a button on the field's line.
      let row: HTMLElement | null = field.parentElement;
      for (let depth = 0; row && depth < 3; depth += 1, row = row.parentElement) {
        const buttons = [...row.querySelectorAll<HTMLElement>("button, a.bid-btn, a[data-slot='button']")].filter((button) => {
          if (!visible(button) || button.contains(field) || !(button.textContent ?? "").trim()) return false;
          const b = button.getBoundingClientRect();
          return b.top < middle && b.bottom > middle && b.height >= 32; // on the same line; icon-sized controls are not rows
        });
        if (buttons.length === 0) continue;
        rows += 1;
        for (const button of buttons) {
          const b = button.getBoundingClientRect();
          if (Math.abs(b.height - a.height) > 1) problems.push(`${field.id || field.getAttribute("name") || field.getAttribute("placeholder") || field.tagName} ${Math.round(a.height)}px beside "${(button.textContent ?? "").trim().slice(0, 30)}" ${Math.round(b.height)}px`);
        }
        break;
      }
    }
    return { problems, rows };
  });
}

/**
 * Asserts the rule on the current page at phone and desktop widths, then restores the
 * viewport. Returns how many field-and-button rows were found at the wider width, so a
 * caller can make sure the check looked at something.
 */
export async function expectAlignedControls(page: Page, label: string): Promise<number> {
  const before = page.viewportSize();
  let rows = 0;
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const found = await misalignedControls(page);
    expect(found.problems, `${label} at ${width}px`).toEqual([]);
    rows = found.rows;
  }
  if (before) await page.setViewportSize(before);
  return rows;
}
