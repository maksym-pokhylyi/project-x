import { ANNUAL_SAVING, inWords } from "./plan-display";
import { BID_PASS, BID_ROLLOVER_MONTHS, PAID_PLAN_KEYS, PLANS, PLAN_KEYS, formatPrice } from "./plans";
import { site } from "./site";

/**
 * Sentences about money that appear in more than one place: /pricing, the questions on the
 * landing page, Billing in the app, the legal summaries. Written once so the wording cannot
 * drift, and every figure comes from the plan catalogue (src/config/plans.ts) or site.ts.
 *
 * Pure data: safe to import from client components.
 */
export const billingCopy = {
  vat: "Prices exclude VAT. VAT is added at checkout where it applies.",
  annual: `Annual billing gives ${ANNUAL_SAVING}.`,
  pauseOrCancel: "Pause or cancel in two clicks from Billing.",
  keepAccess: "You keep access until the end of the period you have paid for.",
  renewalReminder: `We email a reminder ${inWords(site.facts.renewalReminderDays)} days before an annual plan renews.`,
  refund: `Your first subscription payment, or an unused ${BID_PASS.name}, is refunded on request within ${site.legal.refundWindowDays} days.`,
  paddle: "Payments are processed by Paddle.",
  bidPassExpiry: `A ${BID_PASS.name} does not expire while your account is open.`,
  /** The same after a sentence that has just named the pass. */
  bidPassExpiryIt: "It does not expire while your account is open.",
  /** What a change of plan costs or returns, as Billing says it next to the choice. */
  upgrade: "You pay the difference for the rest of your current billing period.",
} as const;

/**
 * A payment that will be taken on a date, as opposed to a price in a list: "£149 + VAT".
 * A price stands next to the VAT note (billingCopy.vat); a payment line stands alone (the
 * trial strip is on every page of the app), so it carries the VAT with it.
 */
export const plusVat = (amount: string) => `${amount} + VAT`;

const plural = (count: number, noun: string) => `${inWords(count)} ${noun}${count === 1 ? "" : "s"}`;

/** The plan that starts with a trial (Bid Desk), if the catalogue has one. */
const trialPlan = PLAN_KEYS.map((key) => PLANS[key]).find((plan) => plan.trialDays);

/** "The trial includes one full bid." — empty when the trial carries no bids. */
export const trialIncludes = trialPlan?.trialFullBids ? `The trial includes ${plural(trialPlan.trialFullBids, "full bid")}.` : "";

/** "Radar Pro is £290 a year instead of £348, Bid Desk £1,490 instead of £1,788, and Bid Desk Plus £3,490 instead of £4,188." */
function annualSavings(): string {
  const parts = PAID_PLAN_KEYS.map((key, index) => {
    const { name, prices } = PLANS[key];
    const year = formatPrice(prices?.year ?? 0);
    const twelveMonths = formatPrice((prices?.month ?? 0) * 12);
    return index === 0 ? `${name} is ${year} a year instead of ${twelveMonths}` : `${name} ${year} instead of ${twelveMonths}`;
  });
  const last = parts.pop();
  return `${parts.join(", ")}, and ${last}.`;
}

/** "Bid Desk includes 3 full bids a month and Bid Desk Plus 10." */
function fullBidAllowances(): string {
  const plans = PLAN_KEYS.map((key) => PLANS[key]).filter((plan) => plan.limits["bids.monthly"]);
  const [first, ...others] = plans;
  if (!first) return "";
  const rest = others.map((plan) => `${plan.name} ${plan.limits["bids.monthly"]}`);
  return `${first.name} includes ${first.limits["bids.monthly"]} full bids a month${rest.length ? ` and ${rest.join(" and ")}` : ""}.`;
}

const bidPassPrice = formatPrice(BID_PASS.price);

/** The plan that starts with a trial, as a question of its own (decided after the artboard was drawn). */
function trialQuestion(): { question: string; answer: string }[] {
  const plan = trialPlan;
  if (!plan?.trialDays) return [];
  const bids = plan.trialFullBids ?? 0;
  const included = bids ? ` that includes ${plural(bids, "full bid")}` : "";
  return [
    {
      question: `How does the ${plan.trialDays}-day trial work?`,
      answer: `${plan.name} starts with a ${plan.trialDays}-day trial${included}. A card is needed to start it, and nothing is charged until the trial ends. Cancel from Billing before then and you pay nothing.`,
    },
  ];
}

/** "Billing questions" on /pricing, in the order of the artboard. Plain text: also sent as FAQPage structured data. */
export const billingQuestions: { question: string; answer: string }[] = [
  { question: "Do prices include VAT?", answer: `No. ${billingCopy.vat}` },
  { question: "What does annual billing save?", answer: `${billingCopy.annual} ${annualSavings()} ${billingCopy.renewalReminder}` },
  { question: "How do I pause or cancel?", answer: `${billingCopy.pauseOrCancel} ${billingCopy.keepAccess}` },
  {
    question: "Can I get a refund?",
    answer: `${billingCopy.refund} After that, cancel from Billing and you keep access until the end of the period you have paid for.`,
  },
  {
    question: "What counts as a full bid?",
    answer: `One tender taken from the buyer’s pack to a marked first draft: the cited check, the scored-question matrix, first drafts from your documents, marking against the buyer’s scheme and Word export. ${fullBidAllowances()} Unused bids roll over ${plural(BID_ROLLOVER_MONTHS, "month")}.`,
  },
  ...trialQuestion(),
  {
    question: `What is a ${BID_PASS.name}?`,
    answer: `One full bid for ${bidPassPrice}, paid once, with no subscription. It adds one full bid to any plan, including ${PLANS.free.name}, so it suits firms that bid a few times a year. It does not expire while your account is open, and an unused ${BID_PASS.name} is refunded on request within ${site.legal.refundWindowDays} days.`,
  },
  {
    question: "How are payments taken?",
    answer: `${billingCopy.paddle} Subscriptions are billed monthly or annually, and a ${BID_PASS.name} is a single one-off payment. VAT is added at checkout where it applies.`,
  },
];
