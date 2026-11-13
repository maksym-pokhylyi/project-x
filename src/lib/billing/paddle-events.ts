import { z } from "zod";

/**
 * Zod schemas for the parts of Paddle webhook payloads we rely on (wire format, snake_case).
 * Reference: https://developer.paddle.com/webhooks (event pages under subscriptions/,
 * transactions/, customers/). Schemas are deliberately LOOSE: unknown fields are kept and
 * only what the handlers read is validated, so Paddle adding fields never breaks us.
 */
const timestamp = z.iso.datetime({ offset: true });
const nullableTimestamp = timestamp.nullish();

export const paddleEnvelopeSchema = z.looseObject({
  event_id: z.string().min(1),
  event_type: z.string().min(1),
  occurred_at: timestamp,
  notification_id: z.string().nullish(),
  data: z.looseObject({ id: z.string().min(1) }),
});
export type PaddleEnvelope = z.infer<typeof paddleEnvelopeSchema>;

const customDataSchema = z.record(z.string(), z.unknown()).nullish();

export const SUBSCRIPTION_STATUSES = ["active", "canceled", "past_due", "paused", "trialing"] as const;
export type PaddleSubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const paddleSubscriptionSchema = z.looseObject({
  id: z.string().startsWith("sub_"),
  status: z.enum(SUBSCRIPTION_STATUSES),
  customer_id: z.string().startsWith("ctm_"),
  custom_data: customDataSchema,
  items: z
    .array(
      z.looseObject({
        quantity: z.number().int().nonnegative().default(1),
        price: z.looseObject({ id: z.string().startsWith("pri_"), product_id: z.string().nullish() }),
        trial_dates: z.looseObject({ starts_at: nullableTimestamp, ends_at: nullableTimestamp }).nullish(),
      }),
    )
    .min(1),
  billing_cycle: z.looseObject({ interval: z.string(), frequency: z.number() }).nullish(),
  current_billing_period: z.looseObject({ starts_at: timestamp, ends_at: timestamp }).nullish(),
  scheduled_change: z
    .looseObject({ action: z.enum(["cancel", "pause", "resume"]), effective_at: timestamp, resume_at: nullableTimestamp })
    .nullish(),
  canceled_at: nullableTimestamp,
  paused_at: nullableTimestamp,
  next_billed_at: nullableTimestamp,
});
export type PaddleSubscription = z.infer<typeof paddleSubscriptionSchema>;

/** An amount in the currency's minor units, as Paddle sends it: a string of digits ("14900"). */
const minorUnits = z.string().nullish();

export const paddleTransactionSchema = z.looseObject({
  id: z.string().startsWith("txn_"),
  status: z.string(),
  /** web | api | subscription_recurring | subscription_update | subscription_charge | subscription_payment_method_change */
  origin: z.string().nullish(),
  customer_id: z.string().nullish(),
  subscription_id: z.string().nullish(),
  custom_data: customDataSchema,
  currency_code: z.string().nullish(),
  invoice_number: z.string().nullish(),
  /** Not validated as a timestamp here: a receipt date we cannot read must not fail the event. */
  billed_at: z.string().nullish(),
  /** What was bought. Webhooks carry the full `price`; some API responses only `price_id`. */
  items: z
    .array(
      z.looseObject({
        quantity: z.number().nullish(),
        price_id: z.string().nullish(),
        price: z.looseObject({ id: z.string().nullish(), product_id: z.string().nullish() }).nullish(),
      }),
    )
    .nullish(),
  details: z
    .looseObject({
      /**
       * subtotal: before discount and tax · total: after discount and tax · grand_total: what
       * is due after credits (what the customer is charged) · grand_total_tax: the tax in it.
       */
      totals: z
        .looseObject({
          subtotal: minorUnits,
          discount: minorUnits,
          tax: minorUnits,
          total: minorUnits,
          grand_total: minorUnits,
          grand_total_tax: minorUnits,
          currency_code: z.string().nullish(),
        })
        .nullish(),
      line_items: z
        .array(
          z.looseObject({
            id: z.string().nullish(),
            price_id: z.string().nullish(),
            quantity: z.number().nullish(),
            totals: z.looseObject({ subtotal: minorUnits, tax: minorUnits, total: minorUnits }).nullish(),
          }),
        )
        .nullish(),
    })
    .nullish(),
  /**
   * Payment attempts, newest first. `method_details` holds card/PayPal details INCLUDING the
   * cardholder name: it is deliberately left untyped and only ever read through
   * summarizePaymentMethod() (./payment-method.ts), which keeps five harmless fields.
   */
  payments: z
    .array(
      z.looseObject({
        status: z.string().nullish(),
        error_code: z.string().nullish(),
        created_at: z.string().nullish(),
        captured_at: z.string().nullish(),
        // .optional(): zod 4 treats a bare z.unknown() key as required.
        method_details: z.unknown().optional(),
      }),
    )
    .nullish(),
});
export type PaddleTransaction = z.infer<typeof paddleTransactionSchema>;

export const paddleCustomerSchema = z.looseObject({
  id: z.string().startsWith("ctm_"),
  email: z.string().nullish(),
  name: z.string().nullish(),
  status: z.string().nullish(),
});
export type PaddleCustomer = z.infer<typeof paddleCustomerSchema>;

/** Refunds, credits and chargebacks against a transaction. */
export const paddleAdjustmentSchema = z.looseObject({
  id: z.string().startsWith("adj_"),
  /** refund | credit | chargeback | chargeback_reverse | chargeback_warning | credit_reverse … */
  action: z.string(),
  /** pending_approval | approved | rejected | reversed */
  status: z.string(),
  /** full (the transaction's grand total is adjusted) | partial (some of its line items are). May be null. */
  type: z.string().nullish(),
  transaction_id: z.string().nullish(),
  subscription_id: z.string().nullish(),
  customer_id: z.string().nullish(),
  currency_code: z.string().nullish(),
  /** total: the adjusted amount including tax. */
  totals: z.looseObject({ subtotal: minorUnits, tax: minorUnits, total: minorUnits, currency_code: z.string().nullish() }).nullish(),
  /** Per transaction line item (`item_id` = txnitm_…): full | partial | tax | proration. */
  items: z
    .array(
      z.looseObject({
        id: z.string().nullish(),
        item_id: z.string().nullish(),
        type: z.string().nullish(),
        amount: minorUnits,
        totals: z.looseObject({ subtotal: minorUnits, tax: minorUnits, total: minorUnits }).nullish(),
      }),
    )
    .nullish(),
});
export type PaddleAdjustment = z.infer<typeof paddleAdjustmentSchema>;

/**
 * Unverified read of checkout custom data. NOT a basis for deciding which workspace an
 * event belongs to — use verifyCheckoutData() (./checkout-signature.ts) for that.
 */
export function readCheckoutCustomData(customData: Record<string, unknown> | null | undefined): {
  organizationId: string | null;
  userId: string | null;
} {
  const organizationId = customData?.organization_id;
  const userId = customData?.user_id;
  return {
    organizationId: typeof organizationId === "string" && organizationId.length > 0 ? organizationId : null,
    userId: typeof userId === "string" && userId.length > 0 ? userId : null,
  };
}

export const SUBSCRIPTION_EVENT_TYPES = [
  "subscription.created",
  "subscription.activated",
  "subscription.updated",
  "subscription.canceled",
  "subscription.paused",
  "subscription.resumed",
  "subscription.past_due",
  "subscription.trialing",
] as const;
export const TRANSACTION_EVENT_TYPES = ["transaction.completed", "transaction.payment_failed"] as const;
export const CUSTOMER_EVENT_TYPES = ["customer.created", "customer.updated"] as const;
export const ADJUSTMENT_EVENT_TYPES = ["adjustment.created", "adjustment.updated"] as const;

export const HANDLED_EVENT_TYPES: readonly string[] = [
  ...SUBSCRIPTION_EVENT_TYPES,
  ...TRANSACTION_EVENT_TYPES,
  ...CUSTOMER_EVENT_TYPES,
  ...ADJUSTMENT_EVENT_TYPES,
];
