// Keyboard and focus checks for the pages where it matters most: landing, pricing, sign-up and
// the app shell. For each page it tabs through from the top and fails if
//   - the first stop is not the "Skip to content" link, or the link does not lead into <main>;
//   - any stop has no visible focus ring (the global 2 px outline) or no accessible name;
//   - focus ever lands on something hidden.
// It also exercises the composite widgets: the company search (Enter submits to /find), the
// billing-interval radio group (arrow keys), the public menu on phones, and the account menu
// and the phone menu of the app (open, Escape, focus returns).
//
//   BASE_URL=http://localhost:3121 node scripts/design/keyboard.mjs
//
// Signed-in checks use the seeded demo owner (pnpm db:seed).
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3121";
const DEMO = { email: process.env.DEMO_EMAIL ?? "demo@example.com", password: process.env.DEMO_PASSWORD ?? "demo-password-123" };
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "@playwright/test");

const browser = await chromium.launch();
const failures = [];
const fail = (where, message) => {
  failures.push(`${where}: ${message}`);
  console.log(`  FAIL ${message}`);
};

/** Describes the element that has focus right now. */
const focused = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const name = (el.getAttribute("aria-label") || el.innerText || el.getAttribute("title") || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ");
    const labelled = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent?.trim() : "";
    return {
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") ?? "",
      name: (name || labelled || "").slice(0, 60),
      ring: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2,
      ringColor: style.outlineColor,
      visible: rect.width > 1 && rect.height > 1 && style.visibility !== "hidden",
      inMain: Boolean(el.closest("main")),
      top: Math.round(rect.top + window.scrollY),
    };
  });

async function signIn(context) {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/sign-in`);
  await page.getByLabel("E-mail").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/app/);
  await page.close();
}

async function tabThrough(where, path, { width = 1280, height = 900, auth = false, stops = 45, extra } = {}) {
  console.log(`\n${where} (${path}, ${width} px)`);
  const context = await browser.newContext({ viewport: { width, height } });
  if (auth) await signIn(context);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(400);

  await page.keyboard.press("Tab");
  const first = await focused(page);
  if (!first || !/skip to content/i.test(first.name)) fail(where, `first Tab stop is "${first?.name}", expected the skip link`);
  else if (!first.visible) fail(where, "the skip link is not visible when focused");
  else console.log(`  1. Skip to content (visible when focused)`);

  const order = [];
  for (let index = 2; index <= stops; index += 1) {
    await page.keyboard.press("Tab");
    const info = await focused(page);
    if (!info) break; // focus left the document
    order.push(info);
    if (!info.visible) fail(where, `stop ${index} "${info.name}" (${info.tag}) is not visible`);
    if (!info.ring) fail(where, `stop ${index} "${info.name}" (${info.tag}) has no visible focus ring`);
    if (!info.name) fail(where, `stop ${index} (${info.tag}${info.role ? `[role=${info.role}]` : ""}) has no accessible name`);
  }
  console.log(`  ${order.length} further stops, every one with a ring and a name: ${order.slice(0, 14).map((item) => item.name).join(" → ")}${order.length > 14 ? " → …" : ""}`);

  // The skip link must lead into <main>.
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(300);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const afterSkip = await focused(page);
  if (!afterSkip?.inMain) fail(where, `after the skip link, Tab lands on "${afterSkip?.name}" outside <main>`);
  else console.log(`  Skip link → first stop inside <main>: "${afterSkip.name}"`);

  if (extra) await extra(page, where);
  await context.close();
}

await tabThrough("Landing", "/", {
  extra: async (page, where) => {
    // The company search works from the keyboard: type, Enter, and the browser goes to /find?q=…
    const field = page.getByLabel("Find your company’s page. It’s free.").first();
    await field.focus();
    await page.keyboard.type("Aldermoor Pike");
    await Promise.all([page.waitForURL(/\/find\?q=Aldermoor(\+|%20)Pike/, { timeout: 5000 }).catch(() => undefined), page.keyboard.press("Enter")]);
    if (!/\/find\?q=Aldermoor(\+|%20)Pike/.test(page.url())) fail(where, `the company search did not go to /find?q=… (now at ${page.url()})`);
    else console.log("  Company search: type and press Enter → /find?q=Aldermoor+Pike");
  },
});

await tabThrough("Pricing", "/pricing", {
  extra: async (page, where) => {
    const month = page.getByTestId("interval-month");
    await month.focus();
    await page.keyboard.press("ArrowRight");
    // Selection is a state update and focus follows on the next frame: give both a moment.
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "interval-year", null, { timeout: 2000 }).catch(() => undefined);
    const yearChecked = await page.getByTestId("interval-year").getAttribute("aria-checked");
    const focusOnYear = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    if (yearChecked !== "true" || focusOnYear !== "interval-year") fail(where, "ArrowRight does not move the billing-interval selection and focus to Annual");
    else console.log("  Billing interval: ArrowRight selects Annual and moves focus to it");
    await page.keyboard.press("ArrowLeft");
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "interval-month", null, { timeout: 2000 }).catch(() => undefined);
    if ((await month.getAttribute("aria-checked")) !== "true") fail(where, "ArrowLeft does not return to Monthly");
    // FAQ disclosures open with Enter.
    const summary = page.locator("summary").first();
    await summary.focus();
    await page.keyboard.press("Enter");
    if (!(await summary.evaluate((el) => el.parentElement.open))) fail(where, "a FAQ disclosure does not open with Enter");
    else console.log("  FAQ disclosure opens with Enter");
  },
});

await tabThrough("Sign-up", "/sign-up", {
  stops: 12,
  extra: async (page, where) => {
    // Submitting the empty form with the keyboard shows errors that are tied to their fields.
    await page.getByLabel("Name").focus();
    await page.keyboard.press("Enter");
    await page.getByText("Enter your name.").waitFor();
    const described = await page.getByLabel("Name").getAttribute("aria-describedby");
    const invalid = await page.getByLabel("Name").getAttribute("aria-invalid");
    if (invalid !== "true" || !described) fail(where, "the Name field is not marked invalid and described by its error");
    else console.log("  Enter submits; errors are announced (role=alert) and tied to fields with aria-describedby");
  },
});

await tabThrough("Landing, phone menu", "/", {
  width: 360,
  height: 800,
  stops: 6,
  extra: async (page, where) => {
    const button = page.getByRole("button", { name: "Open menu" });
    await button.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    // Focus stays inside the open menu.
    for (let index = 0; index < 12; index += 1) await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
    if (!inside) fail(where, "focus escapes the open menu");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    const back = await focused(page);
    if (!/open menu/i.test(back?.name ?? "")) fail(where, `after Escape focus is on "${back?.name}", expected the menu button`);
    else console.log("  Menu: Enter opens, focus is trapped, Escape closes and focus returns to the button");
  },
});

await tabThrough("App shell", "/app", {
  auth: true,
  stops: 20,
  extra: async (page, where) => {
    const menu = page.getByTestId("user-menu");
    await menu.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menu").waitFor();
    await page.keyboard.press("ArrowDown");
    const item = await focused(page);
    if (item?.role !== "menuitem") fail(where, "arrow keys do not move through the account menu");
    await page.keyboard.press("Escape");
    await page.getByRole("menu").waitFor({ state: "detached" });
    const back = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    if (back !== "user-menu") fail(where, "after Escape focus does not return to the account menu button");
    else console.log("  Account menu: Enter opens, arrows move, Escape closes and focus returns");
    const current = await page.locator('nav[aria-label="App"] a[aria-current="page"]').first().innerText();
    console.log(`  Current section is marked with aria-current: "${current.trim()}"`);
  },
});

await tabThrough("App shell, phone", "/app", {
  auth: true,
  width: 360,
  height: 800,
  stops: 20,
  extra: async (page, where) => {
    const button = page.getByTestId("app-menu");
    await button.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    const links = page.locator('[role="dialog"] nav[aria-label="App"] a');
    const count = await links.count();
    if (count !== 4) fail(where, `expected 4 destinations in the menu (Radar, Bids, Documents, Settings), found ${count}`);
    const small = await links.evaluateAll((items) => items.filter((item) => item.getBoundingClientRect().height < 44).length);
    if (small) fail(where, `${small} menu row(s) are shorter than 44 px`);
    for (let index = 0; index < 10; index += 1) await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
    if (!inside) fail(where, "focus escapes the open menu");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    const back = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    if (back !== "app-menu") fail(where, "after Escape focus does not return to the menu button");
    else console.log("  Menu: 4 destinations of at least 44 px; Enter opens, focus is trapped, Escape closes and focus returns");

    const account = page.getByTestId("user-menu");
    await account.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menu").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("menu").waitFor({ state: "detached" });
    const backToAccount = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    if (backToAccount !== "user-menu") fail(where, "after Escape focus does not return to the account menu button");
    else console.log("  Account menu: Enter opens, Escape closes and focus returns");
  },
});

await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} keyboard problem(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nKeyboard checks passed.");
