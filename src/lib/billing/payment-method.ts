import type { PaymentMethodSummary } from "@/db/schema";

/**
 * The NON-sensitive summary of a payment method ("Visa ending 4242, expires 01/27").
 *
 * Paddle's transaction payloads describe the method used in `payments[].method_details`,
 * together with things we must not keep: the cardholder's name, a PayPal e-mail address,
 * references. This module is the only reader of that structure, and it copies out exactly
 * five fields, each validated against a strict pattern — so nothing else can end up in
 * `subscriptions.payment_method`, `billing_payments.payment_method` or the browser.
 *
 * PURE module: no env, no I/O.
 */
export type { PaymentMethodSummary };

export type PaymentAttempt = {
  status?: string | null;
  created_at?: string | null;
  captured_at?: string | null;
  method_details?: unknown;
};

/** A snake_case word as Paddle uses for payment types and card brands ("card", "apple_pay", "american_express"). */
const WORD = /^[a-z][a-z0-9_]{0,39}$/;
const LAST4 = /^\d{4}$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const word = (value: unknown): string | null => (typeof value === "string" && WORD.test(value) ? value : null);
const last4 = (value: unknown): string | null => (typeof value === "string" && LAST4.test(value) ? value : null);

function integerBetween(value: unknown, minimum: number, maximum: number): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" && /^\d{1,4}$/.test(value) ? Number(value) : Number.NaN;
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null;
}

const timeOf = (attempt: PaymentAttempt): number => {
  const parsed = Date.parse(attempt.captured_at ?? attempt.created_at ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
};

/** The attempt that actually paid: the newest captured one (zero-value transactions are only authorized). */
function successfulAttempt(payments: readonly PaymentAttempt[]): PaymentAttempt | null {
  for (const status of ["captured", "authorized"]) {
    const matching = payments.filter((attempt) => attempt.status === status && isRecord(attempt.method_details));
    if (matching.length > 0) return matching.reduce((newest, attempt) => (timeOf(attempt) > timeOf(newest) ? attempt : newest));
  }
  return null;
}

/**
 * Summary of the method a completed transaction was paid with, or null when the payload
 * does not describe one (no successful attempt, or no method details).
 */
export function summarizePaymentMethod(payments: readonly PaymentAttempt[] | null | undefined): PaymentMethodSummary | null {
  if (!payments || payments.length === 0) return null;
  const attempt = successfulAttempt(payments);
  if (!attempt || !isRecord(attempt.method_details)) return null;
  const details = attempt.method_details;
  const type = word(details.type) ?? "unknown";
  const card = isRecord(details.card) ? details.card : isRecord(details.south_korea_local_card) ? details.south_korea_local_card : null;
  return {
    type,
    cardBrand: card ? word(card.type) : null,
    last4: card ? last4(card.last4) : null,
    expiryMonth: card ? integerBetween(card.expiry_month, 1, 12) : null,
    expiryYear: card ? integerBetween(card.expiry_year, 2000, 2100) : null,
  };
}

/**
 * Re-validates a stored summary before it is shown: whatever is in the column (a row edited
 * by hand, a future shape), only the five known fields in their known formats come out.
 */
export function normalizePaymentMethod(value: unknown): PaymentMethodSummary | null {
  if (!isRecord(value)) return null;
  const type = word(value.type);
  if (!type) return null;
  return {
    type,
    cardBrand: word(value.cardBrand),
    last4: last4(value.last4),
    expiryMonth: integerBetween(value.expiryMonth, 1, 12),
    expiryYear: integerBetween(value.expiryYear, 2000, 2100),
  };
}

const BRAND_NAMES: Record<string, string> = {
  american_express: "American Express",
  diners_club: "Diners Club",
  discover: "Discover",
  jcb: "JCB",
  mada: "Mada",
  maestro: "Maestro",
  mastercard: "Mastercard",
  union_pay: "UnionPay",
  visa: "Visa",
};

const TYPE_NAMES: Record<string, string> = {
  alipay: "Alipay",
  apple_pay: "Apple Pay",
  bancontact: "Bancontact",
  blik: "BLIK",
  google_pay: "Google Pay",
  ideal: "iDEAL",
  paypal: "PayPal",
  wire_transfer: "Bank transfer",
};

/** "Visa ending 4242" · "Card ending 4242" · "PayPal" · "Apple Pay ending 4242" — for the Billing page. */
export function describePaymentMethod(method: PaymentMethodSummary): string {
  const name = method.type === "card" ? (method.cardBrand ? (BRAND_NAMES[method.cardBrand] ?? "Card") : "Card") : (TYPE_NAMES[method.type] ?? "Payment method");
  return method.last4 ? `${name} ending ${method.last4}` : name;
}
