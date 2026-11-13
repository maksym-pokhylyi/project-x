// Guard for three rules of the design system, checked in a real browser at 390 and 1280 px:
//
//   1. CONTROL SIZES  Fields and buttons share one scale of three heights: 44, 48, 52 px.
//                     A button beside a field has the field's height; a form's submit
//                     button has the height of its fields. (Foundations, "Control sizes".)
//   2. POINTER        Everything clickable shows the pointer cursor; what is disabled does
//                     not; text fields keep the text cursor. Menus and selects are opened
//                     so their items are checked too.
//   3. WHERE YOU ARE  A navigation that contains the page you are on marks exactly one
//                     item as current (aria-current="page"), and that item differs from
//                     its siblings in colour or weight, never by a line alone. Tabs: one
//                     selected tab, heavier and darker than the others, with its rule.
//
//   BASE_URL=http://localhost:3121 node scripts/design/controls.mjs                 the key pages
//   BASE_URL=… node scripts/design/controls.mjs /find auth:/app/bids               … plus these
//   BASE_URL=… node scripts/design/controls.mjs --only /find auth:/app/bids        only these
//   WIDTHS=390 RULES=sizes,pointer node scripts/design/controls.mjs                narrow it down
//
// A path prefixed with `auth:` is opened as the seeded demo owner (pnpm db:seed). The script
// prints every breach with the page, the width and the element, and exits 1 if there is one.
// Playwright is resolved from PLAYWRIGHT_MODULE (preinstalled copy on this machine) or from
// the project's own @playwright/test.
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3121";
const DEMO = { email: process.env.DEMO_EMAIL ?? "demo@example.com", password: process.env.DEMO_PASSWORD ?? "demo-password-123" };
const WIDTHS = (process.env.WIDTHS ?? "390,1280").split(",").map(Number);
const RULES = new Set((process.env.RULES ?? "sizes,pointer,nav").split(","));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "@playwright/test");

/** The key pages. Feature areas add theirs on the command line (or here, when they pass). */
const KEY_PAGES = [
  "/",
  "/pricing",
  "/free-bid-check",
  "/contact",
  "/legal/terms",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/this-page-does-not-exist",
  "/styleguide",
  "auth:/app/settings/profile",
  "auth:/app/settings/workspace",
  "auth:/app/settings/members",
  "auth:/app/settings/billing",
  "auth:/app/settings/billing?plan=pro&interval=month",
  "auth:/app/usage",
];

const args = process.argv.slice(2);
const only = args.includes("--only");
const extra = args.filter((arg) => !arg.startsWith("--"));
const targets = [...(only ? [] : KEY_PAGES), ...extra].map((spec) => ({ auth: spec.startsWith("auth:"), path: spec.replace(/^auth:/, "") }));

/*
 * Allowed exceptions to the height scale, each with its reason. Anything else that is a
 * field or a button must be 44, 48 or 52 px tall.
 */
const SIZE_EXCEPTIONS = [
  ["[data-variant='link']", "a text link that happens to be a button: no height of its own"],
  ["[role='checkbox'], [role='switch'], [role='radio']", "tick boxes, switches and radios: 20–24 px marks with a 40 px hit area"],
  ["[role='tab'], [data-slot='nav-link']", "tabs and navigation links: sized by their bar"],
  ["[data-slot='reference-chip'], [data-slot='citation'], [data-inline-control]", "chips and source markers set inside a line of text"],
  ["[data-slot='disclosure'] summary, summary", "disclosure headings: sized by their text"],
  ["[data-sonner-toast] button", "the toast library's own buttons"],
  ["textarea, [data-slot='textarea']", "multi-line fields grow with their text"],
  ["[data-slot='dialog-close']", "the 44 px close button of a dialog is checked as an icon button"],
];

const browser = await chromium.launch();
const failures = [];
const report = (where, rule, message) => {
  failures.push(`${where} [${rule}] ${message}`);
  console.log(`  FAIL [${rule}] ${message}`);
};

/** Signs in once for the whole run and hands the session to each width's context (sign-in is rate-limited). */
let session = null;
async function demoSession() {
  if (!session) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/sign-in`);
    await page.getByLabel(/email/i).first().fill(DEMO.email);
    await page.getByLabel("Password").fill(DEMO.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/app/);
    session = await context.storageState();
    await context.close();
  }
  return session;
}

/** Runs in the page: the three checks on what is visible right now. */
function inspect({ rules, sizeExceptions }) {
  const out = [];
  const visible = (element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (box.width < 1 || box.height < 1 || style.visibility === "hidden" || style.display === "none") return false;
    // Hidden by an ancestor (a closed sheet, an sr-only wrapper)?
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      const s = getComputedStyle(node);
      if (s.display === "none" || s.visibility === "hidden" || (s.position === "absolute" && s.clip === "rect(0px, 0px, 0px, 0px)")) return false;
      if (node.closest("[aria-hidden='true']") && node.matches("[aria-hidden='true']")) return false;
    }
    return true;
  };
  const describe = (element) => {
    const text = (element.getAttribute("aria-label") || element.getAttribute("placeholder") || element.textContent || element.getAttribute("name") || element.id || "").trim().replace(/\s+/g, " ").slice(0, 44);
    const slot = element.getAttribute("data-slot");
    return `<${element.tagName.toLowerCase()}${slot ? ` ${slot}` : ""}> "${text}"`;
  };
  const disabled = (element) => element.matches(":disabled, [aria-disabled='true'], [data-disabled]:not([data-disabled='false'])") || Boolean(element.closest("fieldset:disabled"));
  const textField = (element) =>
    (element.tagName === "INPUT" && !["checkbox", "radio", "file", "hidden", "range", "submit", "button", "reset", "color"].includes(element.getAttribute("type") ?? "text")) ||
    element.tagName === "SELECT" ||
    element.matches("[data-slot='select-trigger']");
  const buttonLike = (element) => element.matches("button, [data-slot='button'], [data-slot='button-link'], input[type='submit'], input[type='button']") && !element.matches("[data-slot='select-trigger']");
  const excepted = (element) => sizeExceptions.some(([selector]) => element.matches(selector));

  if (rules.includes("sizes")) {
    const controls = [...document.querySelectorAll("input, select, button, [data-slot='button'], [data-slot='button-link'], [data-slot='select-trigger']")].filter(
      (element) => visible(element) && (textField(element) || buttonLike(element)) && !excepted(element),
    );
    for (const control of controls) {
      const height = control.getBoundingClientRect().height;
      const onScale = [44, 48, 52].some((step) => Math.abs(height - step) <= 0.6);
      // A label that wraps makes a button taller than the scale: allowed, as long as it starts on it.
      const wraps = buttonLike(control) && getComputedStyle(control).whiteSpace !== "nowrap" && height > 52.6;
      if (!onScale && !wraps) out.push(["sizes", `${describe(control)} is ${Math.round(height * 10) / 10} px tall (scale: 44 / 48 / 52)`]);
    }
    // A field and the buttons on its line share one height.
    for (const field of controls.filter(textField)) {
      const a = field.getBoundingClientRect();
      const middle = a.top + a.height / 2;
      let row = field.parentElement;
      for (let depth = 0; row && depth < 3; depth += 1, row = row.parentElement) {
        const beside = [...row.querySelectorAll("button, [data-slot='button'], [data-slot='button-link']")].filter((button) => {
          if (!visible(button) || button.contains(field) || field.contains(button) || excepted(button) || !buttonLike(button)) return false;
          const b = button.getBoundingClientRect();
          return b.top < middle && b.bottom > middle;
        });
        if (beside.length === 0) continue;
        for (const button of beside) {
          const b = button.getBoundingClientRect();
          if (Math.abs(b.height - a.height) > 1) out.push(["sizes", `${describe(field)} is ${Math.round(a.height)} px beside ${describe(button)} at ${Math.round(b.height)} px`]);
        }
        break;
      }
    }
    // A form's submit button has the height of the form's fields.
    for (const form of document.querySelectorAll("form")) {
      const fields = [...form.querySelectorAll("input, select, [data-slot='select-trigger']")].filter((element) => visible(element) && textField(element) && !excepted(element));
      const submits = [...form.querySelectorAll("button[type='submit'], button:not([type]), input[type='submit']")].filter((element) => visible(element) && !excepted(element));
      if (fields.length === 0 || submits.length === 0) continue;
      const fieldHeight = fields[0].getBoundingClientRect().height;
      for (const submit of submits) {
        const height = submit.getBoundingClientRect().height;
        if (Math.abs(height - fieldHeight) > 1 && height <= 52.6) out.push(["sizes", `submit ${describe(submit)} is ${Math.round(height)} px in a form whose fields are ${Math.round(fieldHeight)} px`]);
      }
    }
  }

  if (rules.includes("pointer")) {
    const clickable = "a[href], button, summary, select, label[for], [role='button'], [role='tab'], [role='menuitem'], [role='menuitemcheckbox'], [role='menuitemradio'], [role='option'], [role='switch'], [role='checkbox'], [role='radio']";
    for (const element of document.querySelectorAll(clickable)) {
      if (!visible(element) || disabled(element)) continue;
      // A label of a disabled control is not clickable either.
      if (element.tagName === "LABEL") {
        const target = document.getElementById(element.getAttribute("for") ?? "");
        if (!target || disabled(target)) continue;
      }
      const cursor = getComputedStyle(element).cursor;
      if (cursor !== "pointer") out.push(["pointer", `${describe(element)} shows cursor "${cursor}"`]);
    }
  }

  if (rules.includes("nav")) {
    const here = location.pathname.replace(/\/$/, "") || "/";
    const exempt = /^(Footer|Legal|On this page|Styleguide sections|Breadcrumb|Pagination)$/i;
    for (const nav of document.querySelectorAll("nav")) {
      if (!visible(nav) || exempt.test(nav.getAttribute("aria-label") ?? "")) continue;
      const links = [...nav.querySelectorAll("a[href]")].filter(visible);
      const current = links.filter((link) => link.getAttribute("aria-current") === "page");
      // A link to a section of this page (/#questions on the landing page) is not "the page you are on".
      const containsHere = links.some((link) => {
        const url = new URL(link.href, location.href);
        return !url.hash && (url.pathname.replace(/\/$/, "") || "/") === here;
      });
      const name = nav.getAttribute("aria-label") ?? "unnamed";
      if (!containsHere && current.length === 0) continue;
      if (current.length !== 1) {
        out.push(["nav", `<nav "${name}"> has ${current.length} items marked as the current page (expected exactly 1)`]);
        continue;
      }
      const style = getComputedStyle(current[0]);
      for (const sibling of links.filter((link) => link !== current[0])) {
        const other = getComputedStyle(sibling);
        if (other.color === style.color && other.fontWeight === style.fontWeight) {
          out.push(["nav", `<nav "${name}">: the current item "${current[0].textContent.trim()}" has the colour and weight of "${sibling.textContent.trim()}"`]);
          break;
        }
      }
    }
    for (const list of document.querySelectorAll("[role='tablist']")) {
      if (!visible(list)) continue;
      const tabs = [...list.querySelectorAll("[role='tab']")].filter(visible);
      const selected = tabs.filter((tab) => tab.getAttribute("aria-selected") === "true");
      if (tabs.length === 0) continue;
      if (selected.length !== 1) {
        out.push(["nav", `tab list has ${selected.length} selected tabs (expected exactly 1)`]);
        continue;
      }
      const style = getComputedStyle(selected[0]);
      if (Number(style.fontWeight) < 600) out.push(["nav", `the selected tab "${selected[0].textContent.trim()}" is not semibold`]);
      if (parseFloat(style.borderBottomWidth) < 2 || style.borderBottomColor === "rgba(0, 0, 0, 0)") out.push(["nav", `the selected tab "${selected[0].textContent.trim()}" has no rule under it`]);
      for (const tab of tabs.filter((tab) => tab !== selected[0])) {
        if (getComputedStyle(tab).color === style.color) {
          out.push(["nav", `tab "${tab.textContent.trim()}" has the colour of the selected tab`]);
          break;
        }
      }
    }
  }
  return out;
}

/** Things that open: each is opened, inspected and closed, so menu items and options are covered. */
async function openers(page, width) {
  const found = [];
  const candidates = [
    { name: "account menu", locator: page.getByTestId("user-menu") },
    { name: "workspace menu", locator: page.getByTestId("workspace-switcher") },
    { name: "phone menu", locator: page.getByRole("button", { name: "Open menu" }) },
    { name: "select", locator: page.locator("[data-slot='select-trigger']:not([disabled])") },
    { name: "menu", locator: page.locator("main [aria-haspopup='menu']:not([disabled])") },
  ];
  for (const candidate of candidates) {
    const count = await candidate.locator.count();
    for (let index = 0; index < Math.min(count, 3); index += 1) {
      const element = candidate.locator.nth(index);
      if (await element.isVisible().catch(() => false)) found.push({ name: `${candidate.name}${count > 1 ? ` ${index + 1}` : ""}`, element });
    }
  }
  void width;
  return found;
}

for (const width of WIDTHS) {
  const anonymous = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  let signedIn = null;
  for (const target of targets) {
    const where = `${target.auth ? "auth:" : ""}${target.path} @${width}`;
    console.log(`\n${where}`);
    if (target.auth && !signedIn) signedIn = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", storageState: await demoSession() });
    const page = await (target.auth ? signedIn : anonymous).newPage();
    try {
      await page.goto(`${BASE_URL}${target.path}`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(250);
      const options = { rules: [...RULES], sizeExceptions: SIZE_EXCEPTIONS };
      const seen = new Set();
      const record = (found, state) => {
        for (const [rule, message] of found) {
          const key = `${rule}|${message}`;
          if (seen.has(key)) continue;
          seen.add(key);
          report(where, rule, state ? `${message} (with the ${state} open)` : message);
        }
      };
      record(await page.evaluate(inspect, options));
      if (RULES.has("pointer") || RULES.has("sizes")) {
        for (const opener of await openers(page, width)) {
          try {
            await opener.element.click({ timeout: 2000 });
            await page.waitForTimeout(200);
            record(await page.evaluate(inspect, { ...options, rules: options.rules.filter((rule) => rule !== "nav") }), opener.name);
            await page.keyboard.press("Escape");
            await page.waitForTimeout(150);
          } catch {
            // Covered by something else or gone after a state change: nothing to check.
          }
        }
      }
      if (seen.size === 0) console.log("  ok");
    } catch (error) {
      report(where, "page", `could not be checked: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
    }
    await page.close();
  }
  await anonymous.close();
  await signedIn?.close();
}

await browser.close();
console.log(`\n${failures.length === 0 ? "All control, pointer and navigation checks passed." : `${failures.length} breach(es):`}`);
for (const failure of failures) console.log(`  ${failure}`);
process.exit(failures.length === 0 ? 0 : 1);
