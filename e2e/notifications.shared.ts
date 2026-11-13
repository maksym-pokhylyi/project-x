/**
 * What the Playwright config, the global setup and the spec of the scheduled e-mail journey
 * share (no app imports, no side effects on other configs).
 *
 * The two moments the journey runs at:
 * The digest goes out on Mondays at 07:30 UK time, and a test must not have to wait for one.
 * Where dev tools are on, the cron tick takes `?now=<instant>` and acts as if it were that
 * moment (src/features/notifications/schedule.ts). The journey uses the most recent Monday
 * and the one after it; 08:00 UTC is after 07:30 in the UK in winter and in summer.
 */
export const CRON_SECRET = "e2e-cron-secret-0123456789";
/** On a production build the dev outbox needs a founder session or this key (`/dev/outbox?key=…`). */
export const DEV_TOOLS_SECRET = "e2e-dev-tools-secret-0123456789";

const DAY = 86_400_000;

function mostRecentMonday(now: Date): Date {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  if (monday.getTime() > now.getTime()) monday.setUTCDate(monday.getUTCDate() - 7);
  return monday;
}

/** Fixed for the whole run: the setup and the spec are separate processes started minutes apart. */
const anchor = process.env.NOTIFICATIONS_E2E_MONDAY ? new Date(process.env.NOTIFICATIONS_E2E_MONDAY) : mostRecentMonday(new Date());
process.env.NOTIFICATIONS_E2E_MONDAY = anchor.toISOString();

export const FIRST_MONDAY = anchor;
export const SECOND_MONDAY = new Date(anchor.getTime() + 7 * DAY);
/** A tender that reaches us between the two Mondays. */
export const LATER_TENDER = { ocid: "ocds-h6vhtk-e90001", title: "Grounds Maintenance Contract 99" };
export const daysFrom = (date: Date, days: number) => new Date(date.getTime() + days * DAY);
