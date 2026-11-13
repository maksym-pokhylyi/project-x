import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("./helpers/next-headers"));

/**
 * /pay — Paddle's default payment link. The page only decides WHAT to hand to Paddle.js
 * (configuration + the transaction from `_ptxn`); these tests cover that decision and the
 * policy the page is served under. Opening the real overlay needs a Paddle client token
 * and a browser, and is not covered here.
 */
type PayProps = { paddle: { environment: string; clientToken: string } | null; transactionId: string | null; testMode: boolean };

async function render(searchParams: Record<string, string | string[]>, env: Record<string, string> = {}) {
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  vi.resetModules();
  const page = await import("@/app/(marketing)/pay/page");
  const element = (await page.default({ searchParams: Promise.resolve(searchParams) })) as { props: { children: { props: PayProps } } };
  return { props: element.props.children.props, metadata: page.metadata, dynamic: page.dynamic };
}

describe("/pay (Paddle's default payment link)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("hands Paddle.js the client token and the transaction from `_ptxn`", async () => {
    const { props, metadata, dynamic } = await render({ _ptxn: "txn_01hv8wptq8987qeep44cyrewp9" }, { NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_client_token" });
    expect(props).toEqual({ paddle: { environment: "sandbox", clientToken: "test_client_token" }, transactionId: "txn_01hv8wptq8987qeep44cyrewp9", testMode: true });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(dynamic).toBe("force-dynamic");
  });

  it("without `_ptxn` — or with something that is not a transaction id — there is nothing to pay", async () => {
    const env = { NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_client_token" };
    expect((await render({}, env)).props.transactionId).toBeNull();
    for (const value of ["", "sub_01hv8x29kz0t586xy6zn1a62ny", "txn_", "txn_01HV8WPTQ8987QEEP44CYREWP9", "txn_01hv8wptq8987qeep44cyrewp9<script>", "javascript:alert(1)"]) {
      expect((await render({ _ptxn: value }, env)).props.transactionId, value).toBeNull();
    }
    expect((await render({ _ptxn: ["txn_01hv8wptq8987qeep44cyrewp9", "txn_other"] }, env)).props.transactionId).toBe("txn_01hv8wptq8987qeep44cyrewp9");
  });

  it("is switched off with the rest of billing: no client token, or sandbox credentials on real production", async () => {
    expect((await render({ _ptxn: "txn_01hv8wptq8987qeep44cyrewp9" })).props).toMatchObject({ paddle: null, transactionId: "txn_01hv8wptq8987qeep44cyrewp9" });
    const production = { NODE_ENV: "production", VERCEL_ENV: "production", NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_client_token", RESEND_API_KEY: "re_key", EMAIL_FROM: "no-reply@bidfolio.co.uk" };
    expect((await render({ _ptxn: "txn_01hv8wptq8987qeep44cyrewp9" }, production)).props).toMatchObject({ paddle: null, testMode: false });
    // The owner's pre-launch test: sandbox explicitly allowed on production — the page works and says "test mode".
    expect((await render({ _ptxn: "txn_01hv8wptq8987qeep44cyrewp9" }, { ...production, ALLOW_SANDBOX_BILLING: "1" })).props).toMatchObject({ paddle: { environment: "sandbox" }, testMode: true });
    expect((await render({ _ptxn: "txn_01hv8wptq8987qeep44cyrewp9" }, { ...production, PADDLE_ENV: "production" })).props).toMatchObject({ paddle: { environment: "production" }, testMode: false });
  });

  it("is served under the per-request nonce policy that lets Paddle.js and its checkout frame load", async () => {
    const { proxy, config } = await import("@/proxy");
    expect(config.matcher).toContain("/pay");
    const response = proxy(new NextRequest("http://localhost:3000/pay?_ptxn=txn_01hv8wptq8987qeep44cyrewp9"));
    expect(response.status).toBe(200); // public: no redirect to /sign-in
    const policy = response.headers.get("content-security-policy")!;
    const directive = (name: string) => policy.split("; ").find((part) => part.startsWith(`${name} `))!;
    expect(directive("script-src")).toMatch(/'nonce-[A-Za-z0-9+/=]{20,}' 'strict-dynamic'/);
    expect(directive("script-src")).not.toContain("'unsafe-inline'");
    expect(directive("script-src")).toContain("https://cdn.paddle.com");
    expect(directive("frame-src")).toBe("frame-src https://buy.paddle.com https://sandbox-buy.paddle.com");
    expect(directive("connect-src")).toContain("https://*.paddle.com");
  });
});
