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

export const paddleTransactionSchema = z.looseObject({
  id: z.string().startsWith("txn_"),
  status: z.string(),
  customer_id: z.string().nullish(),
  subscription_id: z.string().nullish(),
  custom_data: customDataSchema,
  currency_code: z.string().nullish(),
  details: z
    .looseObject({ totals: z.looseObject({ grand_total: z.string().nullish(), currency_code: z.string().nullish() }).nullish() })
    .nullish(),
  payments: z.array(z.looseObject({ status: z.string().nullish(), error_code: z.string().nullish() })).nullish(),
});
export type PaddleTransaction = z.infer<typeof paddleTransactionSchema>;

export const paddleCustomerSchema = z.looseObject({
  id: z.string().startsWith("ctm_"),
  email: z.string().nullish(),
  name: z.string().nullish(),
  status: z.string().nullish(),
});
export type PaddleCustomer = z.infer<typeof paddleCustomerSchema>;

/** Custom data we attach at checkout: `customData: { organization_id, user_id }`. */
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

export const HANDLED_EVENT_TYPES: readonly string[] = [
  ...SUBSCRIPTION_EVENT_TYPES,
  ...TRANSACTION_EVENT_TYPES,
  ...CUSTOMER_EVENT_TYPES,
];
