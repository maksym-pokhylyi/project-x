// Guard for four rules of the design system, checked in a real browser at 390 and 1280 px:
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
//   4. WHERE A SCROLL STOPS  A move to another page starts at its very top, wherever you
//                     came from. A link to a section stops with the section just under
//                     the sticky header; Back returns to where you were. Focus on a
//                     control in the header does not move the page, and a control that
//                     takes focus is never left behind the header. Checked as journeys
//                     through the public site, with smooth scrolling ON: the faults
//                     this guards do not show without it.
//
//   BASE_URL=http://localhost:3121 node scripts/design/controls.mjs                 the key pages
//   BASE_URL=… node scripts/design/controls.mjs /find auth:/app/bids               … plus these
//   BASE_URL=… node scripts/design/controls.mjs --only /find auth:/app/bids        only these
//   WIDTHS=390 RULES=sizes,pointer node scripts/design/controls.mjs                narrow it down
//   RULES=scroll node scripts/design/controls.mjs                                  the scroll journeys alone
//
// A path prefixed with `auth:` is opened as the seeded demo owner (pnpm db:seed). The script
// prints every breach with the page, the width and the element, and exits 1 if there is one.
// Playwright is resolved from PLAYWRIGHT_MODULE (preinstalled copy on this machine) or from
// the project's own @playwright/test.
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3121";
const DEMO = { email: process.env.DEMO_EMAIL ?? "demo@example.com", password: process.env.DEMO_PASSWORD ?? "demo-password-123" };
const WIDTHS = (process.env.WIDTHS ?? "390,1280").split(",").map(Number);
const RULES = new Set((process.env.RULES ?? "sizes,pointer,nav,scroll").split(","));
const PAGE_RULES = ["sizes", "pointer", "nav"].filter((rule) => RULES.has(rule));
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

for (const width of PAGE_RULES.length > 0 ? WIDTHS : []) {
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
      const options = { rules: PAGE_RULES, sizeExceptions: SIZE_EXCEPTIONS };
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

/** The scroll position once the page has stopped moving (a glide takes up to a second). */
async function settledScroll(page) {
  await page.waitForTimeout(350);
  let last = -1;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const y = await page.evaluate(() => Math.round(window.scrollY));
    if (y === last) return y;
    last = y;
    await page.waitForTimeout(150);
  }
  return last;
}

/** Where a section sits once it has been scrolled to: its distance from the bottom edge of the sticky header. */
const sectionPlace = (page, id) =>
  page.evaluate((id) => {
    const bar = document.querySelector("[data-slot='site-header']").getBoundingClientRect().bottom;
    const section = document.getElementById(id);
    const heading = document.getElementById(`${id}-title`) ?? section?.querySelector("h1, h2, h3");
    if (!section) return null;
    const box = heading?.getBoundingClientRect();
    return { gap: Math.round(section.getBoundingClientRect().top - bar), headingInView: box ? box.top >= bar && box.bottom <= window.innerHeight : true };
  }, id);

/*
 * Rule 4 as journeys. No `reducedMotion` here: with reduced motion the stylesheet switches
 * smooth scrolling off, and every fault below disappears with it.
 */
async function scrollJourneys(width) {
  const where = `scroll journeys @${width}`;
  console.log(`\n${where}`);
  const count = failures.length;
  const phone = width < 768;
  const context = await browser.newContext({ viewport: { width, height: 800 } });
  const page = await context.newPage();
  const header = page.locator("[data-slot='site-header']");
  /** Follows a link of the public header; on phones the links are in the menu sheet. */
  const follow = async (name) => {
    if (phone && name !== "Bidfolio") {
      await header.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("dialog").getByRole("link", { name, exact: true }).click();
    } else {
      await header.getByRole("link", { name, exact: true }).click();
    }
  };
  /** Opens a page, optionally scrolled to one of its sections, and returns where it stands. */
  const open = async (path, at) => {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "load" });
    if (at) await page.evaluate((id) => document.getElementById(id).scrollIntoView({ behavior: "instant" }), at);
    return settledScroll(page);
  };
  const expectSection = async (id, what) => {
    const place = await sectionPlace(page, id);
    if (!place) report(where, "scroll", `${what}: there is no #${id} on ${new URL(page.url()).pathname}`);
    else if (place.gap < 0 || place.gap > 24) report(where, "scroll", `${what}: #${id} is ${place.gap}px from the header (expected 0 to 24px under it)`);
    else if (!place.headingInView) report(where, "scroll", `${what}: the heading of #${id} is not in view`);
  };

  try {
    // 1. Another page always opens at its top: from the top of the landing page and from far down it.
    for (const start of [null, "questions"]) {
      for (const [name, path] of [["Pricing", "/pricing"], ["Sign in", "/sign-in"], ["Find your company", "/find"]]) {
        const from = await open("/", start);
        if (start && from < 500) report(where, "scroll", `could not scroll the landing page to #${start} (y=${from})`);
        await follow(name);
        await page.waitForURL((url) => url.pathname === path, { timeout: 15000 });
        const y = await settledScroll(page);
        if (y !== 0) report(where, "scroll", `"${name}" from the landing page (${start ? `at #${start}` : "at the top"}) opens ${path} at y=${y}, not at its top`);
      }
    }
    // 2. The logo, from the top of /pricing and from its comparison table.
    for (const start of [null, "compare"]) {
      await open("/pricing", start);
      await follow("Bidfolio");
      await page.waitForURL((url) => url.pathname === "/", { timeout: 15000 });
      const y = await settledScroll(page);
      if (y !== 0) report(where, "scroll", `the logo from /pricing (${start ? `at #${start}` : "at the top"}) opens the landing page at y=${y}, not at its top`);
    }
    // 3. A link to a section of ANOTHER page stops with the section under the header; Back and Forward return.
    const left = await open("/pricing", "compare");
    await follow("How it works");
    await page.waitForURL((url) => url.pathname === "/" && url.hash === "#how", { timeout: 15000 });
    await settledScroll(page);
    await expectSection("how", `"How it works" from /pricing`);
    await page.goBack();
    await page.waitForURL((url) => url.pathname === "/pricing");
    const back = await settledScroll(page);
    if (Math.abs(back - left) > 2) report(where, "scroll", `Back to /pricing returns to y=${back}, not to where it was left (y=${left})`);
    await page.goForward();
    await page.waitForURL((url) => url.hash === "#how");
    await settledScroll(page);
    await expectSection("how", "Forward to /#how");
    // 4. From a section of the landing page, the logo (the same page, without the #) goes to the very top.
    await follow("Bidfolio");
    await page.waitForURL((url) => url.pathname === "/" && url.hash === "");
    const top = await settledScroll(page);
    if (top !== 0) report(where, "scroll", `the logo on the landing page (from #how) stops at y=${top}, not at the top`);
    // 5. A link to a section of THIS page glides there and stops under the header.
    await open("/pricing", null);
    await follow("Questions");
    await settledScroll(page);
    await expectSection("questions", `"Questions" on /pricing`);
    await page.getByRole("link", { name: "Bid Pass", exact: true }).first().click();
    await settledScroll(page);
    await expectSection("bid-pass", `the Bid Pass link under the comparison table`);
    // 6. Focus on a control in the sticky header does not move the page.
    const held = await open("/", "questions");
    await page.evaluate(() => document.querySelector("[data-slot='site-header'] a").focus());
    const afterFocus = await settledScroll(page);
    if (afterFocus !== held) report(where, "scroll", `focus on the logo in the sticky header moved the page from y=${held} to y=${afterFocus}`);
    await page.keyboard.press("Tab");
    const afterTab = await settledScroll(page);
    const stillInBar = await page.evaluate(() => Boolean(document.activeElement?.closest("[data-slot='site-header']")));
    if (stillInBar && afterTab !== held) report(where, "scroll", `Tab to the next control in the sticky header moved the page from y=${held} to y=${afterTab}`);
    // 7. A control that takes focus while it is above the screen comes out from behind the header.
    await open("/pricing", null);
    const hidden = await page.evaluate(() => {
      const control = document.querySelector("main button, main a[href]");
      window.scrollTo({ top: control.getBoundingClientRect().top + window.scrollY + 600, behavior: "instant" });
      control.focus();
      return true;
    });
    await settledScroll(page);
    const shown = await page.evaluate(() => {
      const bar = document.querySelector("[data-slot='site-header']").getBoundingClientRect().bottom;
      const box = document.activeElement.getBoundingClientRect();
      return { top: Math.round(box.top - bar), inView: box.top >= bar && box.bottom <= window.innerHeight };
    });
    if (hidden && !shown.inView) report(where, "scroll", `a control that took focus above the screen is not fully in view (${shown.top}px from the header's edge)`);
  } catch (error) {
    report(where, "scroll", `a journey could not be finished: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
  }
  await context.close();

  if (failures.length === count) console.log("  ok");
}

// The journeys belong to the key pages: a run limited to other pages (--only) leaves them out.
if (RULES.has("scroll") && !only) {
  for (const width of WIDTHS) await scrollJourneys(width);
}

await browser.close();
console.log(`\n${failures.length === 0 ? "All control, pointer, navigation and scroll checks passed." : `${failures.length} breach(es):`}`);
for (const failure of failures) console.log(`  ${failure}`);
process.exit(failures.length === 0 ? 0 : 1);
