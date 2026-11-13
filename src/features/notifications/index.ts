import "server-only";

/**
 * Scheduled e-mails — what other modules use. (Server only.)
 *
 *   Sign-up form        setDigestPreference(userId, organizationId, on)
 *   Product e-mails     wantsNotification(userId, organizationId, "product")    before sending (the bid desk's
 *                       unsubscribeLinks({ userId, organizationId, kind: "product", email })   "check is ready" does both)
 *   More deadlines      registerDeadlineSource({ name, organizations, list })   saved tenders and bids are built in
 *   Radar (match tiers) selectDigestMatches(ctx, source, since, options)        the one place e-mails choose matches
 *
 * Everything else in this folder is internal: the scheduler (schedule.ts), the two jobs
 * (jobs.ts), content selection (content/*), templates (emails/*) and delivery (deliver.ts).
 */
export { NOTIFICATION_KINDS, type NotificationKind } from "./config";
export { selectDigestMatches, type DigestMatches } from "./content/matches";
export { registerDeadlineSource, type DeadlineItem, type DeadlineSource } from "./content/reminders";
export { unsubscribeLinks, type UnsubscribeLinks } from "./links";
export { getNotificationPrefs, setDigestPreference, wantsNotification, type NotificationPrefs } from "./prefs";
