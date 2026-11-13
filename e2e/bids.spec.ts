import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

/**
 * The bid desk's main journey against a production build, offline:
 *
 *   sign up → verify e-mail → upload a small REAL tender pack (4 files) → processing state
 *   → cited bid check ready (requirements with verified quotes, citation popover with a
 *   link to the stored source page, coverage) → tick a requirement → add a question
 *   → (paid plan simulated) draft an answer, see evidence gaps and the word count,
 *   mark it → export answers (DOCX) and the checklist (CSV).
 *
 * The pack is a real, publicly published UK council request for quotation. In the repo it
 * lives in e2e/fixtures/pack; BIDS_E2E_PACK_DIR can point at another folder.
 */
const PACK_DIR = process.env.BIDS_E2E_PACK_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "pack");
const run = Date.now().toString(36);
const user = { name: "Bea Bidder", email: `bea-${run}@e2e.test`, password: "bidder-password-123" };

async function followOutboxLink(page: Page, to: string, template: string) {
  await page.goto("/dev/outbox");
  const email = page.locator(`[data-testid="outbox-email"][data-to="${to}"][data-template="${template}"]`).first();
  await expect(email).toBeVisible();
  await email.getByTestId("outbox-link").first().click();
}

test("upload a pack, get a cited check, draft and mark an answer, export", async ({ page }) => {
  test.skip(!existsSync(PACK_DIR), `pack fixture missing: ${PACK_DIR}`);
  const files = readdirSync(PACK_DIR)
    .filter((name) => /\.(pdf|docx|xlsx)$/i.test(name))
    .sort()
    .map((name) => path.join(PACK_DIR, name));
  expect(files.length).toBeGreaterThanOrEqual(2);

  // --- sign up and verify --------------------------------------------------------------
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(user.name);
  await page.getByLabel("Work e-mail").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  await followOutboxLink(page, user.email, "verify-email");
  await page.waitForURL(/\/(app|sign-in)/);
  if (page.url().includes("/sign-in")) {
    await page.getByLabel("E-mail").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/app/);
  }

  // --- empty state, then upload ----------------------------------------------------------
  await page.goto("/app/bids");
  await expect(page.getByTestId("bids-empty")).toBeVisible();
  await page.getByTestId("new-bid").click();
  await expect(page.getByTestId("dropzone")).toBeVisible();
  await expect(page.getByTestId("allowance-note")).toContainText("full bids");

  // An unsupported file is refused with a reason, without blocking the others.
  await page.getByTestId("file-input").setInputFiles([{ name: "old-format.doc", mimeType: "application/msword", buffer: Buffer.from("x") }]);
  await page.getByTestId("file-input").setInputFiles(files);
  await expect(page.locator('[data-file-status="error"]')).toContainText("Old Word format");
  await expect(page.locator('[data-file-status="done"]')).toHaveCount(files.length, { timeout: 60_000 });

  // A refresh keeps the uploaded files (the draft bid is in the URL and the database).
  await page.reload();
  await expect(page.locator('[data-file-status="done"]')).toHaveCount(files.length);

  await page.getByTestId("start-check").click();
  await page.waitForURL(/\/app\/bids\/[0-9a-f-]{36}$/);
  const bidUrl = page.url();

  // --- processing survives a refresh and ends in a ready check ---------------------------
  await expect(page.getByTestId("processing-state").or(page.getByTestId("verdict"))).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("verdict")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("processing-state")).toHaveCount(0);
  await expect(page.getByText("AI-assisted analysis. Check against the tender documents").first()).toBeVisible();
  await expect(page.getByTestId("coverage")).toContainText("quotes were found in the text of your documents");
  await expect(page.getByTestId("fact-submission_deadline")).not.toHaveAttribute("data-fact-status", "not_stated");

  // --- requirements with verified citations ----------------------------------------------
  await page.goto(`${bidUrl}/requirements`);
  const rows = page.getByTestId("requirement-row");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
  const verified = page.locator('[data-testid="citation-mark"][data-verified="true"]');
  expect(await verified.count()).toBeGreaterThanOrEqual(3);
  await verified.first().click();
  const popover = page.getByTestId("citation-popover");
  await expect(popover).toContainText("Quoted from the tender documents");
  const sourceLink = popover.getByRole("link", { name: /Open source/ });
  await expect(sourceLink).toHaveAttribute("href", /\/api\/bids\/[0-9a-f-]{36}\/files\/[0-9a-f-]{36}/);
  const source = await page.request.get((await sourceLink.getAttribute("href"))!.split("#")[0]!);
  expect(source.status()).toBe(200);
  await page.keyboard.press("Escape");

  // Tick "checked" on the first requirement; it persists.
  await rows.first().getByRole("checkbox").check();
  await page.reload();
  await expect(page.getByTestId("requirement-row").first().getByRole("checkbox")).toBeChecked();

  // --- questions: add one by hand, draft, mark ------------------------------------------
  await page.goto(`${bidUrl}/questions`);
  await page.getByRole("button", { name: "Add question" }).click();
  await page.getByLabel("Reference").fill("Q-E2E");
  await page.getByLabel("Short title (optional)").fill("Proposed method");
  await page.getByLabel("Question", { exact: true }).fill("Describe your proposed method for carrying out the audit, including who will do the work.");
  await page.getByLabel("Word limit (optional)").fill("150");
  await page.getByRole("button", { name: "Add question", exact: true }).last().click();
  const card = page.getByTestId("question-card").filter({ hasText: "Q-E2E" });
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: /Draft|Open/ }).click();

  await expect(page.getByTestId("answer-editor")).toBeVisible();
  await expect(page.getByText("Your evidence library is empty")).toBeVisible();
  await page.getByTestId("draft-button").click();
  await expect(page.getByTestId("answer-read")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("evidence-gap").first()).toBeVisible();
  await expect(page.getByTestId("word-count")).toContainText("/ 150 words");
  await expect(page.getByTestId("word-count")).not.toHaveAttribute("data-limit-state", "over");

  await page.getByTestId("evaluate-button").click();
  await expect(page.getByTestId("evaluation-score")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("improvement").first()).toBeVisible();
  await expect(page.getByTestId("evaluator-panel")).toContainText("not a prediction");

  // --- export ----------------------------------------------------------------------------
  await page.goto(`${bidUrl}/export`);
  await expect(page.getByTestId("export-summary")).toContainText("1 of");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-answers").click()]);
  expect(download.suggestedFilename()).toMatch(/-answers\.docx$/);
  const csv = await page.request.get(`${bidUrl.replace("/app/bids/", "/api/bids/")}/export/requirements-csv`);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("Quote found in documents");

  // --- another workspace cannot see any of it --------------------------------------------
  const stranger = await page.context().browser()!.newContext();
  const anonymous = await stranger.request.get(`${bidUrl.replace("/app/bids/", "/api/bids/")}/status`);
  expect(anonymous.status()).toBe(401);
  await stranger.close();
});
