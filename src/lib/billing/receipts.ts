import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { PLANS, isBillingInterval, isPlanKey } from "@/config/plans";
import { db } from "@/db";
import { billingPayments } from "@/db/schema";
import { env } from "@/env";
import { AppError, NotFoundError } from "@/lib/errors";
import { reportError } from "@/lib/report-error";
import { formatMinorUnits } from "./money";
import { ONE_OFF_PRODUCTS, isOneOffKind } from "./one-off";
import { getPaddle } from "./paddle";
import { describePaddleFailure } from "./paddle-errors";

/**
 * Receipts: the completed payments of a workspace, from OUR records (`billing_payments`,
 * written by the webhook pipeline) — the page that lists them never waits for Paddle.
 * Only the PDF itself is fetched from Paddle, on demand (getReceiptInvoiceUrl).
 */
export type ReceiptStatus = "completed" | "refunded" | "partially_refunded" | "disputed";

export type Receipt = {
  /** Paddle transaction id (txn_…); also the id in `invoicePath`. */
  transactionId: string;
  /** When the payment was taken. */
  paidAt: Date;
  /** "Bid Desk, monthly" · "Bid Pass" · "Bid Pass × 2" */
  description: string;
  kind: "subscription" | "one_off";
  /** Amounts in minor units of `currency` (pence for GBP). */
  amountExcludingTaxMinor: number;
  taxMinor: number;
  totalMinor: number;
  /** ISO 4217. */
  currency: string;
  /** The same amounts formatted for display: "£149.00". */
  amountExcludingTax: string;
  total: string;
  /** Paddle's invoice number, when it has assigned one. */
  invoiceNumber: string | null;
  status: ReceiptStatus;
  /** GET this path to be redirected to Paddle's invoice PDF (owner or admin of the workspace). */
  invoicePath: string;
};

type PaymentRow = typeof billingPayments.$inferSelect;

const RECEIPT_STATUSES: readonly string[] = ["completed", "refunded", "partially_refunded", "disputed"];
const MAX_RECEIPTS = 100;

export function receiptInvoicePath(transactionId: string): string {
  return `/api/billing/receipts/${encodeURIComponent(transactionId)}`;
}

/** What a payment was for, in the words of the plan catalogue as it is today. */
export function describePayment(payment: Pick<PaymentRow, "kind" | "planKey" | "billingInterval" | "product" | "quantity">): string {
  if (payment.kind === "one_off") {
    const label = isOneOffKind(payment.product) ? ONE_OFF_PRODUCTS[payment.product].label : "One-off purchase";
    return payment.quantity > 1 ? `${label} × ${payment.quantity}` : label;
  }
  if (isPlanKey(payment.planKey) && payment.planKey !== "free") {
    const name = PLANS[payment.planKey].name;
    return isBillingInterval(payment.billingInterval) ? `${name}, ${payment.billingInterval === "year" ? "annual" : "monthly"}` : name;
  }
  return "Subscription payment";
}

function toReceipt(payment: PaymentRow): Receipt {
  return {
    transactionId: payment.paddleTransactionId,
    paidAt: payment.paidAt,
    description: describePayment(payment),
    kind: payment.kind === "one_off" ? "one_off" : "subscription",
    amountExcludingTaxMinor: payment.subtotalMinor,
    taxMinor: payment.taxMinor,
    totalMinor: payment.totalMinor,
    currency: payment.currency,
    amountExcludingTax: formatMinorUnits(payment.subtotalMinor, payment.currency),
    total: formatMinorUnits(payment.totalMinor, payment.currency),
    invoiceNumber: payment.invoiceNumber,
    status: RECEIPT_STATUSES.includes(payment.status) ? (payment.status as ReceiptStatus) : "completed",
    invoicePath: receiptInvoicePath(payment.paddleTransactionId),
  };
}

/**
 * Completed payments of a workspace — subscription payments and one-off purchases — newest
 * first. Payments of zero (the start of a trial, a change of payment method) are not
 * receipts: nothing was charged and Paddle issues no invoice for them. Only payments of the
 * Paddle environment the deployment runs are listed.
 *
 * `organizationId` must come from the authenticated session (requireOrg), never from input.
 */
export async function listReceipts(organizationId: string, limit = 24): Promise<Receipt[]> {
  const rows = await db
    .select()
    .from(billingPayments)
    .where(
      and(
        eq(billingPayments.organizationId, organizationId),
        gt(billingPayments.totalMinor, 0),
        // Test-mode payments are never listed next to real ones (and vice versa).
        eq(billingPayments.paddleEnvironment, env.PADDLE_ENV),
      ),
    )
    .orderBy(desc(billingPayments.paidAt), desc(billingPayments.createdAt))
    .limit(Math.min(Math.max(1, Math.trunc(limit)), MAX_RECEIPTS));
  return rows.map(toReceipt);
}

/** Why an invoice link could not be produced. Reaches the client as `error.details.reason`. */
export class ReceiptUnavailableError extends AppError {
  constructor(reason: "no_invoice" | "not_ready" | "paddle_unavailable", message: string, status = 409) {
    super("CONFLICT", message, status, { reason });
  }
}

/** The part of the Paddle SDK used here (injectable in tests). */
export type PaddleInvoiceClient = {
  transactions: { getInvoicePDF(transactionId: string, query?: { disposition?: "attachment" | "inline" }): Promise<{ url: string }> };
};

const TRANSACTION_ID = /^txn_[a-z0-9]{1,64}$/;

/**
 * A short-lived link (Paddle: one hour) to the invoice PDF of a payment recorded for THIS
 * workspace. A transaction id that is unknown, malformed or recorded for another workspace
 * is a 404 — and Paddle is not asked about it.
 */
export async function getReceiptInvoiceUrl(organizationId: string, transactionId: string, paddle?: PaddleInvoiceClient): Promise<string> {
  if (!TRANSACTION_ID.test(transactionId)) throw new NotFoundError("Receipt not found.");
  const [payment] = await db
    .select({ totalMinor: billingPayments.totalMinor })
    .from(billingPayments)
    .where(
      and(
        eq(billingPayments.paddleTransactionId, transactionId),
        eq(billingPayments.organizationId, organizationId),
        // A payment of the other Paddle environment does not exist as far as this deployment's API key is concerned.
        eq(billingPayments.paddleEnvironment, env.PADDLE_ENV),
      ),
    );
  if (!payment) throw new NotFoundError("Receipt not found.");
  if (payment.totalMinor <= 0) throw new ReceiptUnavailableError("no_invoice", "There is no invoice for this payment: nothing was charged.");

  const api: PaddleInvoiceClient = paddle ?? getPaddle();
  let url: string;
  try {
    ({ url } = await api.transactions.getInvoicePDF(transactionId, { disposition: "attachment" }));
  } catch (error) {
    const failure = describePaddleFailure(error);
    if (failure.kind === "not_found") {
      throw new ReceiptUnavailableError("not_ready", "Paddle has not issued the invoice for this payment yet. Please try again in a few minutes.");
    }
    await reportError(error, { route: "billing:receipt", organizationId, extra: { paddleCode: failure.code, paddleStatus: failure.status } });
    throw new ReceiptUnavailableError("paddle_unavailable", "The invoice could not be fetched from Paddle right now. Please try again in a few minutes.", 503);
  }
  // Only ever redirect to an https link.
  if (!/^https:\/\/[^\s]+$/.test(url)) {
    await reportError(new Error("Paddle returned an invoice link that is not an https URL"), { route: "billing:receipt", organizationId });
    throw new ReceiptUnavailableError("paddle_unavailable", "The invoice could not be fetched from Paddle right now. Please try again in a few minutes.", 503);
  }
  return url;
}
