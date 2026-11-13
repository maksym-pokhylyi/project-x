import type { Metadata } from "next";
import { env, features } from "@/env";
import { PayCheckout } from "./pay-checkout";

/**
 * Paddle's DEFAULT PAYMENT LINK (Paddle → Checkout → Checkout settings → Default payment
 * link: https://<domain>/pay, sandbox and live).
 *
 * Paddle sends customers here with the transaction to pay in `?_ptxn=txn_…` — links in its
 * e-mails, invoices, "update payment method", and the checkouts it generates itself. The
 * page's only job is to load Paddle.js with the client token: Paddle.js then opens the
 * checkout for that transaction. Without this page set as the payment link Paddle refuses to
 * create any transaction or checkout (`transaction_default_checkout_url_not_set`).
 *
 * Public (the payer is not necessarily signed in) and not indexed. It grants nothing: paid
 * access comes only from the webhook. Rendered per request, so it carries the nonce CSP
 * (src/proxy.ts lists /pay) under which Paddle.js is allowed to load.
 */
export const metadata: Metadata = {
  title: "Secure checkout",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TRANSACTION_ID = /^txn_[a-z0-9]{10,40}$/;

export default async function PayPage({ searchParams }: { searchParams: Promise<{ _ptxn?: string | string[] }> }) {
  const { _ptxn: raw } = await searchParams;
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  const transactionId = candidate && TRANSACTION_ID.test(candidate) ? candidate : null;
  // The same source the Billing page uses: off for sandbox credentials on real production without ALLOW_SANDBOX_BILLING=1.
  const paddle =
    features.paddleCheckout && env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ? { environment: env.PADDLE_ENV, clientToken: env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN } : null;

  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-md flex-col justify-center px-4 py-16">
      <PayCheckout paddle={paddle} transactionId={transactionId} testMode={features.billingTestMode} />
    </div>
  );
}
