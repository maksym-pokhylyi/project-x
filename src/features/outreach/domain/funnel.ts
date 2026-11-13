import { outreachConfig } from "../config";

/**
 * Reading the outreach funnel against the falsification test (PURE).
 *
 * docs/research/DECISION.md §6: of 400 e-mails, seven days after the last one —
 *   PASS  >= 30 page visits AND >= 10 claims AND (>= 3 uploaded packs OR >= 2 card payments)
 *   KILL  < 12 page visits OR 0 claims
 * and more than 2 complaints stops the test whatever else happened.
 *
 * Honest small numbers: below 100 e-mails only counts are shown ("7 of 40"), never a
 * percentage, and no verdict is given. For a number of e-mails other than 400 the
 * thresholds are scaled in proportion and labelled as such.
 */

export type FunnelCounts = {
  /** Prospects marked as sent. */
  sent: number;
  /** Of those: prospects with at least one non-bot visit carrying their code, on or after the day of sending. */
  visited: number;
  /** Of those: prospects whose company was claimed by a workspace after the visit. */
  claimed: number;
  /** Of those: prospects whose claiming workspace started a bid check. Null while the bids module is not installed. */
  bidChecks: number | null;
  /** Of those: prospects whose claiming workspace pays (subscription or Bid Pass). Null when it cannot be measured. */
  cardPayments: number | null;
  optedOut: number;
  /** Sent prospects whose address later bounced. */
  bounced: number;
  complaints: number;
  /** When the most recent letter was sent. */
  lastSentAt: Date | null;
};

export type Verdict = "too_early" | "pass" | "kill" | "between" | "stopped";
/** `not_judged`: too few e-mails for the figure to mean anything. `unknown`: it cannot be measured yet. */
export type LineState = "pass" | "below" | "kill" | "unknown" | "not_judged";

export type ThresholdLine = {
  key: "visits" | "claims" | "packs" | "cardPayments";
  label: string;
  /** "7 of 40" or "31 of 400 (8%)" */
  value: string;
  /** "pass at 30" / "pass at 30, kill below 12" */
  target: string;
  state: LineState;
};

export type FunnelReading = {
  verdict: Verdict;
  headline: string;
  detail: string;
  lines: ThresholdLine[];
  /** False below `percentagesFrom` e-mails: the lines then carry counts beside the test's thresholds as written, and no state. */
  judged: boolean;
  /** True when the thresholds were scaled from the 400-e-mail test. */
  scaled: boolean;
};

/** "7 of 40" below `percentagesFrom`, "31 of 400 (8%)" from it. Never a percentage of a handful. */
export function describeShare(count: number, of: number, percentagesFrom: number = outreachConfig.percentagesFrom): string {
  const text = `${count.toLocaleString("en-GB")} of ${of.toLocaleString("en-GB")}`;
  if (of < percentagesFrom || of === 0) return text;
  const percent = (count / of) * 100;
  const rounded = percent > 0 && percent < 1 ? "under 1" : String(Math.round(percent));
  return `${text} (${rounded}%)`;
}

export type ScaledThresholds = { passVisits: number; passClaims: number; passPacks: number; passCardPayments: number; killVisitsBelow: number; scaled: boolean };

/** The test's thresholds for `sent` e-mails: as written for 400, in proportion otherwise (never below 1). */
export function thresholdsFor(sent: number, experiment: typeof outreachConfig.experiment = outreachConfig.experiment): ScaledThresholds {
  const factor = sent > 0 ? sent / experiment.emails : 1;
  const scale = (value: number) => Math.max(1, Math.ceil(value * factor - 1e-9));
  return {
    passVisits: scale(experiment.pass.visits),
    passClaims: scale(experiment.pass.claims),
    passPacks: scale(experiment.pass.packs),
    passCardPayments: scale(experiment.pass.cardPayments),
    killVisitsBelow: scale(experiment.kill.visitsBelow),
    scaled: sent !== experiment.emails,
  };
}

const DAY_MS = 86_400_000;

export function readFunnel(counts: FunnelCounts, now: Date = new Date(), config: typeof outreachConfig = outreachConfig): FunnelReading {
  const { experiment } = config;
  // A handful of e-mails is not judged: a threshold scaled down to "2 visits" would be noise.
  // The lines then show the counts beside the test's thresholds as they are written.
  const judged = counts.sent >= config.percentagesFrom;
  const thresholds = thresholdsFor(judged ? counts.sent : experiment.emails, experiment);
  const share = (count: number) => describeShare(count, counts.sent, config.percentagesFrom);
  const state = (value: LineState): LineState => (judged || value === "unknown" ? value : "not_judged");
  const ofTest = judged ? "" : ` of ${experiment.emails}`;

  const visitsState = state(counts.visited >= thresholds.passVisits ? "pass" : counts.visited < thresholds.killVisitsBelow ? "kill" : "below");
  const claimsState = state(counts.claimed >= thresholds.passClaims ? "pass" : counts.claimed <= experiment.kill.claimsAtMost ? "kill" : "below");
  const packsState = state(counts.bidChecks === null ? "unknown" : counts.bidChecks >= thresholds.passPacks ? "pass" : "below");
  const cardsState = state(counts.cardPayments === null ? "unknown" : counts.cardPayments >= thresholds.passCardPayments ? "pass" : "below");

  const lines: ThresholdLine[] = [
    { key: "visits", label: "Opened their page", value: share(counts.visited), target: `pass at ${thresholds.passVisits}${ofTest}, kill below ${thresholds.killVisitsBelow}`, state: visitsState },
    { key: "claims", label: "Claimed their page", value: share(counts.claimed), target: `pass at ${thresholds.passClaims}${ofTest}, kill at 0`, state: claimsState },
    { key: "packs", label: "Started a bid check", value: counts.bidChecks === null ? "—" : share(counts.bidChecks), target: `pass at ${thresholds.passPacks}${ofTest} (or the next line)`, state: packsState },
    { key: "cardPayments", label: "Paying", value: counts.cardPayments === null ? "—" : share(counts.cardPayments), target: `pass at ${thresholds.passCardPayments}${ofTest} (or the line above)`, state: cardsState },
  ];

  const daysSinceLast = counts.lastSentAt ? Math.floor((now.getTime() - counts.lastSentAt.getTime()) / DAY_MS) : null;
  const passed = visitsState === "pass" && claimsState === "pass" && (packsState === "pass" || cardsState === "pass");
  const killed = visitsState === "kill" || claimsState === "kill";
  const base = { lines, judged, scaled: judged && thresholds.scaled };

  if (counts.complaints > experiment.maxComplaints) {
    return {
      ...base,
      verdict: "stopped",
      headline: `Stop: ${counts.complaints} complaints`,
      detail: `More than ${experiment.maxComplaints} complaints ends the test whatever the other figures say. Do not send more until each complaint has been reviewed.`,
    };
  }
  if (counts.sent === 0) {
    return { ...base, verdict: "too_early", headline: "Nothing sent yet", detail: "Results appear once a batch has been marked as sent." };
  }
  if (counts.sent < config.percentagesFrom) {
    return {
      ...base,
      verdict: "too_early",
      headline: `Too few e-mails to judge: ${counts.sent} sent`,
      detail: `The test is ${experiment.emails} e-mails. With fewer than ${config.percentagesFrom} the counts below say little either way, so no percentages and no verdict are shown.`,
    };
  }
  if (passed) {
    return {
      ...base,
      verdict: "pass",
      headline: "Pass thresholds met",
      detail: thresholds.scaled ? `Thresholds scaled from the ${experiment.emails}-e-mail test to ${counts.sent} sent.` : "Every pass threshold of the test is met.",
    };
  }
  if (daysSinceLast !== null && daysSinceLast < experiment.judgeAfterDays) {
    const wait = experiment.judgeAfterDays - daysSinceLast;
    return {
      ...base,
      verdict: "too_early",
      headline: `Too early to judge: ${wait} more ${wait === 1 ? "day" : "days"}`,
      detail: `The test is read ${experiment.judgeAfterDays} days after the last e-mail. People open and claim for days after a letter arrives.`,
    };
  }
  if (killed) {
    return {
      ...base,
      verdict: "kill",
      headline: "Kill threshold reached",
      detail:
        visitsState === "kill"
          ? `Fewer than ${thresholds.killVisitsBelow} of ${counts.sent} companies opened their page. First rule out delivery: seed tests in the inbox, bounces under 3%, any replies at all.`
          : "Nobody claimed a page. If letters were delivered and pages were opened, the channel is not working for this segment.",
    };
  }
  const unknown = packsState === "unknown" && cardsState === "unknown";
  return {
    ...base,
    verdict: "between",
    headline: "Between the thresholds",
    detail: unknown
      ? "Visits and claims are measured; bid checks and payments cannot be measured yet, so a pass cannot be confirmed here."
      : "Neither pass nor kill. Do not raise volume; change one thing (subject, segment or the page) and send a fresh batch.",
  };
}
