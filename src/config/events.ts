/**
 * Analytics event catalogue — the only place event names and their properties are defined.
 *
 * `track(name, context, properties)` (src/lib/analytics.ts) is typed against this map, so an
 * unknown event name or a wrong property is a compile error. To add an event: add a line here,
 * then call `track()` from server code. Names use `object.verb_past` and never contain PII.
 */
export type EventMap = {
  // Acquisition / activation
  "user.signed_up": { method: "email" | "google" };
  "user.email_verified": Record<string, never>;
  "user.signed_in": { method: string };
  "workspace.created": { personal: boolean };
  "workspace.updated": { fields: string[] };
  "workspace.logo_uploaded": { bytes: number };
  "onboarding.step_completed": { step: string };

  // Team
  "member.invited": { role: string };
  "member.invitation_accepted": { role: string };
  "member.invitation_canceled": Record<string, never>;
  "member.removed": Record<string, never>;
  "member.role_changed": { to: string };

  // Billing
  "billing.checkout_started": { plan: string; interval: string };
  "billing.portal_opened": Record<string, never>;
  "billing.subscription_started": { plan: string; interval: string | null; status: string };
  "billing.subscription_changed": { from: string; to: string; status: string };
  "billing.subscription_canceled": { plan: string };
  "billing.subscription_paused": { plan: string };
  "billing.subscription_resumed": { plan: string };
  "billing.subscription_past_due": { plan: string };
  "billing.payment_succeeded": { amount: string | null; currency: string | null };
  "billing.payment_failed": { reason: string | null };

  // Usage / AI
  "quota.limit_reached": { metric: string; limit: number };
  "ai.request_completed": { feature: string; model: string };
  "ai.budget_exceeded": { scope: "organization" | "global"; feature: string };
};

export type EventName = keyof EventMap;

/** Events that mark a workspace as "activated" on the admin dashboard. Adjust to your product. */
export const ACTIVATION_EVENTS: EventName[] = ["workspace.updated", "member.invited", "billing.checkout_started"];
