/**
 * Data retention — how long operational tables keep their rows.
 *
 * Enforced once a day by the `maintenance.cleanup` job (src/lib/maintenance.ts), which the
 * cron route schedules. Change a number here to change the policy; keep the privacy policy
 * (src/app/(marketing)/legal/privacy) in line with it. All values are in days.
 *
 * Why these tables: they grow with every request, job, e-mail or webhook, and several hold
 * personal data (IP addresses in sessions and rate-limit keys, e-mail addresses in the
 * outbox and invitations, Paddle customer data in webhook payloads).
 */
export const RETENTION_DAYS = {
  /** Succeeded jobs are only useful for a short look back. */
  jobsSucceeded: 14,
  /** Failed jobs are kept longer for inspection, then removed. */
  jobsFailed: 90,
  /** Product analytics events: 13 months allows year-over-year comparison. */
  events: 395,
  /** Unexpected server errors. */
  errorLog: 90,
  /**
   * Paddle webhook payloads (customer and payment details). After this the payload is
   * replaced by a stub (ids, type, time); the row stays so a redelivery is still recognised.
   */
  webhookPayload: 90,
  /** The stub rows themselves. Paddle does not redeliver events this old. */
  webhookEvents: 400,
  /** Rendered e-mail bodies contain one-time links: dropped quickly even when unsent. */
  emailBodies: 7,
  /** Outbox rows (recipient, subject, status). */
  emailOutbox: 90,
  /** Sessions that expired this long ago (they carry IP address and user agent). */
  sessionsExpired: 7,
  /** Verification / password-reset tokens that expired this long ago. */
  verificationsExpired: 1,
  /** Invitations that are no longer pending (accepted, canceled, rejected) or have expired. */
  invitationsClosed: 90,
  /** AI usage rows: budgets only need the current month; 13 months for cost analysis. */
  aiUsage: 395,
  /** Workspace audit log (security-relevant actions): two years. */
  auditLog: 730,
  /** Consumed checkout nonces; only meaningful while their signature could be replayed (24 h). */
  checkoutNonces: 90,
  /**
   * Working files of a finished bid check: the models' intermediate readings of the pack,
   * kept so that a retry does not pay for a reading twice. Removed this long after the
   * check is ready. The check itself, the uploaded documents and the answers are customer
   * content and are NOT touched: they stay until the customer deletes them or the workspace.
   */
  bidWorkFiles: 14,
  /**
   * The Paddle transaction kept on a one-off purchase (`billing_purchases.raw`, for debugging).
   * The purchase itself and the receipts (`billing_payments`) are business records: they stay
   * as long as the workspace exists and go with it.
   */
  purchasePayload: 90,
} as const;

export type RetentionKey = keyof typeof RETENTION_DAYS;
