import { expect, test } from "@playwright/test";

/**
 * /pay — Paddle's default payment link — on a production build WITHOUT Paddle (e2e never
 * talks to Paddle): public, not indexed, served with the per-request nonce policy that
 * allows Paddle.js and its checkout frame, and explaining itself instead of opening anything.
 *
 * What this cannot show is the Paddle overlay itself opening: that needs a client-side token
 * (see "Known limits" in the README).
 */
test("/pay: public, not indexed, under the nonce policy; explains itself when there is nothing to pay or Paddle is off", async ({ page, baseURL }) => {
  const violations: string[] = [];
  await page.exposeFunction("__reportCspViolation", (violation: string) => void violations.push(violation));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as unknown as { __reportCspViolation: (violation: string) => void }).__reportCspViolation(`${location.pathname}: ${event.violatedDirective} blocked ${event.blockedURI}`);
    });
  });
  const leftTheSite: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith(baseURL!) && !request.url().startsWith("data:")) leftTheSite.push(request.url());
  });

  // No transaction in the link.
  const response = await page.goto("/pay");
  expect(response?.status()).toBe(200);
  const policy = response!.headers()["content-security-policy"]!;
  const scriptSrc = policy.split(";").map((directive) => directive.trim()).find((directive) => directive.startsWith("script-src")) ?? "";
  expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]{20,}'/);
  expect(scriptSrc).toContain("'strict-dynamic'");
  expect(scriptSrc).not.toContain("'unsafe-inline'");
  expect(policy).toContain("https://cdn.paddle.com");
  expect(policy).toContain("https://sandbox-buy.paddle.com");
  expect(policy).toContain("frame-ancestors 'none'");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const card = page.getByTestId("pay-checkout");
  await expect(card).toHaveAttribute("data-state", "nothing");
  await expect(card).toContainText("Nothing to pay here");
  await expect(card.getByRole("link", { name: "Go to Billing" })).toHaveAttribute("href", "/app/settings/billing");

  // Something that is not a transaction id is treated the same way (it never reaches Paddle.js).
  await page.goto("/pay?_ptxn=%3Cscript%3Ealert(1)%3C/script%3E");
  await expect(card).toHaveAttribute("data-state", "nothing");

  // A transaction, but Paddle is not configured for this deployment.
  await page.goto("/pay?_ptxn=txn_01hv8wptq8987qeep44cyrewp9");
  await expect(card).toHaveAttribute("data-state", "unavailable");
  await expect(card).toContainText("Payments are not available here at the moment. Your card has not been charged.");
  await expect(card.getByRole("link", { name: "Go to Billing" })).toBeVisible();
  await expect(page.getByTestId("pay-test-mode")).toHaveCount(0);

  // Signed out, "Go to Billing" ends at sign-in and comes back to Billing afterwards.
  await card.getByRole("link", { name: "Go to Billing" }).click();
  await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fapp%2Fsettings%2Fbilling$/);

  expect(violations).toEqual([]);
  expect(leftTheSite).toEqual([]); // Paddle.js is not even requested while checkout is off
});
