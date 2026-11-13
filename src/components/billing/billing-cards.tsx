import type { ReactNode } from "react";
import { BillingStepButton, type BillingStep } from "@/components/billing/billing-actions";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { CardIcon } from "@/components/ui/icons";
import { UsageBar } from "@/components/ui/usage-bar";
import { billingCopy } from "@/config/billing-copy";
import { BID_PASS_DISPLAY } from "@/config/plan-display";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";
import type { BidAllowance } from "@/server/bid-allowance";

/*
 * The cards of the Billing page, drawn to docs/design/handoff/Billing-1440 and Billing-390.
 *
 * They are presentational: each takes typed props and, where it has something to do, the
 * server action for that step (a `BillingStep`). The page decides what it can pass today.
 * A card that gets no action for a step falls back to the Paddle customer portal, which
 * exists now; a card that gets no data says so in a sentence. Nothing here invents a figure.
 */

/** "1 Dec 2026" — dates on Billing, in UTC like the subscription record. */
export const formatBillingDate = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const card = "flex min-w-0 flex-col rounded-card border border-line bg-surface p-4 md:px-6 md:pt-[1.375rem] md:pb-6";
const label = "font-sans text-base leading-[1.5] font-semibold text-ink md:text-15";
const actions = "mt-auto flex flex-col gap-2.5 pt-4 sm:flex-row sm:flex-wrap md:pt-[1.125rem]";
/** A further block inside a card, under a hairline: 16 px above and below the rule on phones, 18 px from 768 px. */
const divided = "mt-4 border-t border-line pt-4 md:mt-4.5 md:pt-4.5";
const serifTitle = "font-display text-xl leading-[1.25] font-semibold tracking-normal text-ink md:text-[1.375rem]";

/** Two cards side by side from 1200 px of page; one under the other below that. */
export function BillingRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:gap-6 xl:grid-cols-2">{children}</div>;
}

/* ---------------------------------------------------------------------------------------- */

export type CurrentPlanCardProps = {
  /** "Bid Desk", "Free". */
  planName: string;
  /** "£149" and "a month". Null on Free: the card shows £0. */
  price: { amount: string; period: string } | null;
  /** The plan in one line: "3 full bids a month · 3 seats · unused bids roll over one month". */
  summary: string;
  /** A state that needs saying beside the name: "Trial", "Payment failed", "Paused", "Cancels 1 Dec 2026". */
  status?: { label: string; tone: "info" | "warning" | "danger" | "neutral" } | null;
  /** One sentence about that state. */
  note?: string | null;
  /** "Next payment" · "1 Dec 2026" (or "First payment", "Access until"). */
  dateLine?: { label: string; value: string } | null;
  /** "Change plan" (or "See plans" on Free) goes to the one place that compares plans. */
  changePlan: { label: string; href: string };
  /** "Switch to annual:" · "£1,490 a year, two months free" → the confirm step. */
  switchInterval?: { lead: string; detail: string; href: string } | null;
};

const statusVariant = { info: "info", warning: "warning", danger: "destructive", neutral: "secondary" } as const;

export function CurrentPlanCard({ planName, price, summary, status, note, dateLine, changePlan, switchInterval }: CurrentPlanCardProps) {
  return (
    <section aria-labelledby="billing-plan" data-testid="current-plan" className={card}>
      <h2 id="billing-plan" className={label}>
        Current plan
      </h2>
      <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 md:mt-3 md:gap-x-6 md:gap-y-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-display text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.015em] text-ink md:text-[2rem]" data-testid="current-plan-name">
            {planName}
          </span>
          {status ? <Badge variant={statusVariant[status.tone]}>{status.label}</Badge> : null}
        </p>
        <p className="flex items-baseline gap-1.5">
          <span className="font-display text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.02em] text-ink md:text-[2rem]">{price?.amount ?? "£0"}</span>
          {price ? <span className="text-sm leading-[1.5] text-ink-2">{price.period}</span> : null}
        </p>
      </div>
      <p className="mt-2 text-sm leading-[1.5] text-ink md:mt-1.5">{summary}</p>
      <p className="mt-1.5 text-13 leading-[1.5] text-ink-2 md:mt-0.5">{billingCopy.vat}</p>
      {note ? (
        <p role="status" className="mt-3 text-sm leading-[1.5] text-ink">
          {note}
        </p>
      ) : null}
      {dateLine ? (
        <p className="mt-3.5 flex items-baseline justify-between gap-3 border-t border-line pt-3 text-15 leading-[1.5] tabular-nums md:mt-4 md:justify-start md:gap-1.5 md:pt-3.5">
          <span className="text-ink-2">{dateLine.label}</span> <span className="font-semibold text-ink">{dateLine.value}</span>
        </p>
      ) : null}
      <div className={cn(actions, "max-md:controls-md")}>
        <ButtonLink href={changePlan.href}>{changePlan.label}</ButtonLink>
        {switchInterval ? (
          <ButtonLink href={switchInterval.href} variant="outline" className="h-auto min-h-(--control-h) px-[0.8125rem] py-2.5 whitespace-normal max-md:flex-col max-md:gap-0 max-md:text-15 max-md:leading-[1.4]">
            <span>{switchInterval.lead}</span>
            <span className="max-md:text-sm max-md:font-medium">{switchInterval.detail}</span>
          </ButtonLink>
        ) : null}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------------------- */

export type AllowancePerson = { id: string; name: string; email: string; isOwner: boolean; isYou: boolean };

export type AllowanceCardProps = {
  /** From the bids module through src/server/bid-allowance.ts. Null when it cannot be read: no count is shown. */
  allowance: BidAllowance | null;
  /** Full bids the plan gives each billing period, from the catalogue (0 on Free and Radar Pro). */
  planFullBids: number;
  /** Name of the plan, for the sentences that mention it. */
  planName: string;
  /** When the allowance renews: the billing date. Null without a live subscription. */
  renewsAt: Date | null;
  seats: { used: number; limit: number | null };
  people: AllowancePerson[];
  /** Where "Invite someone" goes. Null when no seat is free (the button gives way to a sentence). */
  inviteHref: string | null;
};

function initials(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return email.trim().slice(0, 1).toUpperCase();
  return (words[0]!.charAt(0) + (words.length > 1 ? words[words.length - 1]!.charAt(0) : "")).toUpperCase();
}

export function AllowanceCard({ allowance, planFullBids, planName, renewsAt, seats, people, inviteHref }: AllowanceCardProps) {
  const bids = allowance?.fullBids ?? null;
  const checks = allowance?.checks ?? null;
  const hasBids = bids !== null && bids.limit !== 0;
  const hasChecks = checks !== null && checks.limit !== 0;
  // What renews is the bids, or the checks on a plan without bids; the subscription's date when neither is known.
  const renews = allowance ? (bids?.renewsAt ?? checks?.renewsAt ?? null) : renewsAt;
  const passes = allowance?.bidPasses ?? 0;
  return (
    <section aria-labelledby="billing-allowance" data-testid="usage-panel" className={card}>
      <h2 id="billing-allowance" className={label}>
        Your allowance{renews ? <span className="font-normal text-ink-2"> · renews {formatBillingDate(renews)}</span> : null}
      </h2>

      <div className="mt-3.5">
        {bids && hasBids ? (
          <UsageBar label="Full bids" used={bids.used} limit={bids.limit}>
            {bids.trial ? (
              <p className="text-13 leading-[1.5] text-ink-2" data-testid="allowance-note">
                {bids.limit === 1 ? "One full bid is" : `${bids.limit} full bids are`} included in your trial.{planFullBids > 0 ? ` ${planFullBids} a month start with your first payment.` : ""}
              </p>
            ) : null}
            {bids.rolledOver ? (
              <p className="flex items-baseline gap-2 text-13 leading-[1.5] text-ink tabular-nums">
                <span aria-hidden className="size-[0.5625rem] shrink-0 rounded-full bg-accent" />
                <span>
                  {bids.rolledOver.count} unused {bids.rolledOver.count === 1 ? "bid" : "bids"} rolled over from {bids.rolledOver.fromLabel}:{" "}
                  <span className="font-semibold text-accent-ink">
                    use {bids.rolledOver.count === 1 ? "it" : "them"} by {formatBillingDate(bids.rolledOver.useBy)}
                  </span>
                </span>
              </p>
            ) : null}
            {passes > 0 ? (
              <p className="text-13 leading-[1.5] text-ink">
                Plus {passes} {BID_PASS_DISPLAY.name}
                {passes === 1 ? "" : "es"}: one full bid each, with no expiry.
              </p>
            ) : null}
          </UsageBar>
        ) : (
          /* No count to show: either the plan has no full bids, or the count could not be read. */
          <UsageBar label="Full bids" value={bids ? (passes > 0 ? `${passes} from ${BID_PASS_DISPLAY.name}${passes === 1 ? "" : "es"}` : "None") : planFullBids > 0 ? `${planFullBids} a month` : "None"}>
            <p className="text-13 leading-[1.5] text-ink-2" data-testid="allowance-note">
              {planFullBids > 0
                ? "The bids you start are counted here."
                : `${planName} has no full bids. ${BID_PASS_DISPLAY.shortLine}`}
            </p>
          </UsageBar>
        )}
      </div>

      {checks && hasChecks ? (
        <div className={divided}>
          <UsageBar label="Cited bid checks" used={checks.used} limit={checks.limit} />
        </div>
      ) : allowance?.freeCheckAvailable && !hasBids ? (
        <p className="mt-3 text-13 leading-[1.5] text-ink" data-testid="free-check-note">
          Your one free cited bid check is still unused.
        </p>
      ) : null}

      <div className={divided}>
        <UsageBar label="Seats" used={seats.used} limit={seats.limit} data-testid="billing-seats">
          <div className="flex flex-col gap-x-4 gap-y-2 pt-0.5 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-y-2.5 max-md:controls-md">
            <ul aria-label="People using a seat" className="flex min-w-0 flex-col md:flex-[1_1_16.25rem]">
              {people.map((person) => (
                <li key={person.id} className="flex min-h-11 items-center gap-2.5 md:min-h-10">
                  <span
                    aria-hidden
                    className={cn("grid size-[1.875rem] shrink-0 place-items-center rounded-full text-xs font-semibold", person.isYou ? "bg-brand-tint text-brand" : "bg-paper-deep text-ink")}
                  >
                    {initials(person.name, person.email)}
                  </span>
                  <span className="min-w-0 truncate text-15 leading-[1.5] font-medium text-ink md:text-sm">{person.name || person.email}</span>
                  {person.isOwner ? <Badge variant="secondary">Owner</Badge> : null}
                </li>
              ))}
            </ul>
            {inviteHref ? (
              <ButtonLink href={inviteHref} variant="outline" className="px-[0.9375rem]">
                Invite someone
              </ButtonLink>
            ) : (
              <p className="text-13 leading-[1.5] text-ink-2">Every seat is taken. A higher plan adds seats.</p>
            )}
          </div>
        </UsageBar>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------------------- */

export type PauseCancelCardProps = {
  /**
   * active      a subscription that renews: pause and cancel are offered
   * cancelling  a cancellation is scheduled: access runs until `endsOn`
   * paused      paused: it can be resumed
   * none        no subscription: nothing to pause or cancel
   */
  state: "active" | "cancelling" | "paused" | "none";
  /** "1 Dec 2026": when access ends after a scheduled cancellation. */
  endsOn?: string | null;
  /** Server actions for each step, from the billing backend. A missing one falls back to the Paddle portal (cancel) or is not offered (pause, resume). */
  onPause?: BillingStep;
  onCancel?: BillingStep;
  onResume?: BillingStep;
  /** The Paddle customer portal can be opened for this workspace. */
  portalAvailable: boolean;
};

export function PauseCancelCard({ state, endsOn, onPause, onCancel, onResume, portalAvailable }: PauseCancelCardProps) {
  const title = state === "none" ? "No subscription to pause or cancel" : state === "paused" ? "Your subscription is paused" : state === "cancelling" ? "Your subscription is set to end" : "Pause or cancel in two clicks";
  return (
    <section aria-labelledby="billing-pause" className={card}>
      <h2 id="billing-pause" className={serifTitle}>
        {title}
      </h2>
      <p className="mt-2 max-w-[30rem] text-sm leading-[1.5] text-ink">
        {state === "none"
          ? `You are not paying for anything. When you subscribe, you can pause or cancel here in two clicks. ${billingCopy.refund}`
          : state === "paused"
            ? "Nothing is charged while it is paused, and this workspace is on Free until it resumes. Your documents and saved tenders stay where they are."
            : state === "cancelling"
              ? `You keep access until ${endsOn ?? "the end of the period you have paid for"}. After that this workspace is on Free; nothing more is charged.`
              : `${billingCopy.keepAccess} ${billingCopy.refund}`}
      </p>
      {state === "none" ? null : (
        <div className={cn(actions, "max-md:controls-md")}>
          {state === "active" && onPause ? (
            <BillingStepButton
              action={onPause}
              confirm={{
                title: "Pause your subscription?",
                description: "Nothing is charged while it is paused. This workspace is on Free until you resume; your documents and saved tenders stay.",
                confirmLabel: "Pause subscription",
              }}
              done="Subscription paused."
            >
              Pause subscription
            </BillingStepButton>
          ) : null}
          {state === "active" ? (
            <BillingStepButton
              action={onCancel}
              portal={onCancel ? undefined : portalAvailable ? "cancel" : undefined}
              confirm={
                onCancel
                  ? {
                      title: "Cancel your subscription?",
                      description: `${billingCopy.keepAccess} After that this workspace is on Free and nothing more is charged.`,
                      confirmLabel: "Cancel subscription",
                    }
                  : undefined
              }
              done="Subscription cancelled."
            >
              Cancel subscription
            </BillingStepButton>
          ) : null}
          {state !== "active" && onResume ? (
            <BillingStepButton action={onResume} done="Subscription resumed.">
              {state === "paused" ? "Resume subscription" : "Keep my subscription"}
            </BillingStepButton>
          ) : null}
          {state !== "active" && !onResume && portalAvailable ? <BillingStepButton portal="overview">Manage in Paddle</BillingStepButton> : null}
        </div>
      )}
      {state === "active" && !onCancel && !portalAvailable ? (
        <p className="mt-3 text-13 leading-[1.5] text-ink-2" data-testid="portal-not-configured">
          To cancel, use the link in your Paddle receipt or write to <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.
        </p>
      ) : null}
    </section>
  );
}

/* ---------------------------------------------------------------------------------------- */

export type BidPassCardProps = {
  /** Unused Bid Passes; null when not known (the bids module is not connected). */
  passes: number | null;
  /** The confirm step: /app/settings/billing?buy=bid_pass. */
  buyHref: string;
  /** Whether the workspace has full bids from its plan: the headline talks about "one more". */
  hasMonthlyBids: boolean;
};

export function BidPassCard({ passes, buyHref, hasMonthlyBids }: BidPassCardProps) {
  return (
    <section aria-labelledby="billing-pass" className="flex min-w-0 flex-col rounded-card bg-brand-tint p-[1.125rem] md:px-[1.5625rem] md:pt-[1.4375rem] md:pb-[1.5625rem]">
      <p className="type-eyebrow">{BID_PASS_DISPLAY.name}</p>
      <h2 id="billing-pass" className={cn(serifTitle, "mt-1")}>
        {hasMonthlyBids ? "Need one more bid this month?" : "One tender on your table?"}
      </h2>
      <p className="mt-1.5 text-15 leading-[1.5] text-ink">
        {BID_PASS_DISPLAY.shortLine} {passes ? `You have ${passes} unused. ` : ""}
        {billingCopy.bidPassExpiryIt}
      </p>
      <div className={cn(actions, "max-md:controls-md")}>
        <ButtonLink href={buyHref} variant="outline" className="px-[0.9375rem]">
          {BID_PASS_DISPLAY.cta}
        </ButtonLink>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------------------- */

export type PaymentMethodCardProps = {
  /** The card on file, from the billing backend. Null when it is not known here: Paddle holds it. */
  method: { brand: string | null; last4: string; expires: string | null } | null;
  /** A subscription exists, so there is a payment method somewhere to update. */
  hasSubscription: boolean;
  /** Server action that returns a place to update the card (`{ url }`). Without it the Paddle portal opens. */
  onUpdate?: BillingStep;
  portalAvailable: boolean;
};

export function PaymentMethodCard({ method, hasSubscription, onUpdate, portalAvailable }: PaymentMethodCardProps) {
  const canUpdate = hasSubscription && (Boolean(onUpdate) || portalAvailable);
  return (
    <section aria-labelledby="billing-payment" className={cn(card, "md:pb-[1.375rem]")}>
      <h2 id="billing-payment" className={label}>
        Payment method
      </h2>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className={cn("flex min-w-0 items-center gap-2.5 text-15 leading-[1.5] tabular-nums", method ? "font-semibold text-ink" : "text-ink")}>
          <CardIcon className={method ? "text-ink" : "text-ink-2"} />
          {method ? (
            <span>
              {method.brand ? `${method.brand} ending ${method.last4}` : `Card ending ${method.last4}`}
              {method.expires ? <span className="font-normal text-ink-2"> · expires {method.expires}</span> : null}
            </span>
          ) : hasSubscription ? (
            <span>Your card is kept by Paddle, not by us.</span>
          ) : (
            <span>No card on file. You add one when you pay.</span>
          )}
        </p>
        {canUpdate ? (
          <BillingStepButton action={onUpdate} portal={onUpdate ? undefined : "payment_method"} aria-label="Update payment method" className="shrink-0 px-[0.9375rem]">
            Update
          </BillingStepButton>
        ) : null}
      </div>
      <div className="mt-auto pt-3 md:pt-4">
        <p className="border-t border-line pt-3 text-13 leading-[1.5] text-ink-2 md:pt-3.5">{billingCopy.paddle}</p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------------------- */

export type Receipt = {
  id: string;
  date: Date;
  /** "Bid Desk, monthly", "Bid Pass". */
  description: string;
  /** "£149.00": the amount excluding VAT, formatted. */
  amount: string;
  /** Where the receipt opens; null when there is no link for it. */
  url: string | null;
};

export type ReceiptsCardProps = {
  /** From the billing backend, newest first. Null when it is not known here: Paddle sends and keeps them. */
  receipts: Receipt[] | null;
  /** Where Paddle sends receipts, if we know. */
  email: string | null;
  portalAvailable: boolean;
};

export function ReceiptsCard({ receipts, email, portalAvailable }: ReceiptsCardProps) {
  const receiptLink = "link inline-flex min-h-11 items-center rounded-sm text-sm font-medium";
  return (
    <section aria-labelledby="billing-receipts" className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface">
      <h2 id="billing-receipts" className={cn(label, "px-4 pt-4 pb-2.5 md:px-6 md:pt-5 md:pb-3")}>
        Receipts
      </h2>
      {receipts && receipts.length > 0 ? (
        <>
          {/* Phones: a stacked list. */}
          <ul className="flex flex-col md:hidden">
            {receipts.map((receipt) => (
              <li key={receipt.id} className="flex flex-col border-t border-line px-4 pt-3 pb-1">
                <div className="flex items-baseline justify-between gap-3 text-15 leading-[1.5] font-semibold text-ink">
                  <span>{receipt.description}</span>
                  <span className="tabular-nums">{receipt.amount}</span>
                </div>
                <div className="flex min-h-11 items-center justify-between gap-3">
                  <span className="text-13 leading-[1.5] text-ink-2 tabular-nums">{formatBillingDate(receipt.date)} · excluding VAT</span>
                  {receipt.url ? (
                    <a href={receipt.url} target="_blank" rel="noopener noreferrer" aria-label={`Receipt for ${formatBillingDate(receipt.date)}`} className={receiptLink}>
                      Receipt
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {/* From 768 px: a table. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[32.5rem] border-separate border-spacing-0 text-sm leading-[1.5] text-ink">
              <thead>
                <tr className="text-xs leading-[1.5] font-semibold text-ink-2">
                  <th scope="col" className="border-b border-line py-3 pr-3 pl-6 text-left font-semibold">
                    Date
                  </th>
                  <th scope="col" className="border-b border-line p-3 text-left font-semibold">
                    Description
                  </th>
                  <th scope="col" className="border-b border-line p-3 text-right font-semibold">
                    Amount (excluding VAT)
                  </th>
                  <th scope="col" aria-label="Receipt" className="border-b border-line py-3 pr-6 pl-3" />
                </tr>
              </thead>
              <tbody className="[&_tr:last-child>td]:border-b-0">
                {receipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td className="border-b border-line py-1.5 pr-3 pl-6 whitespace-nowrap">{formatBillingDate(receipt.date)}</td>
                    <td className="border-b border-line px-3 py-1.5 font-semibold">{receipt.description}</td>
                    <td className="border-b border-line px-3 py-1.5 text-right whitespace-nowrap">{receipt.amount}</td>
                    <td className="border-b border-line py-1.5 pr-6 pl-3 text-right">
                      {receipt.url ? (
                        <a href={receipt.url} target="_blank" rel="noopener noreferrer" aria-label={`Receipt for ${formatBillingDate(receipt.date)}`} className={receiptLink}>
                          Receipt
                        </a>
                      ) : (
                        <span className="inline-flex min-h-11 items-center text-ink-2">Sent by email</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col border-t border-line px-4 pt-3.5 pb-4 md:px-6 md:pb-[1.375rem]">
          <p className="max-w-[30rem] text-sm leading-[1.5] text-ink" data-testid="receipts-empty">
            {receipts
              ? "No payments yet. Paddle emails a receipt after each one, and it will be listed here."
              : email
                ? `Paddle emails a receipt after each payment to ${email}. They are also kept in your Paddle account.`
                : "No payments yet. Paddle emails a receipt after each one."}
          </p>
          {!receipts && email && portalAvailable ? (
            <div className="mt-auto flex pt-3.5">
              <BillingStepButton portal="overview" className="px-[0.9375rem]">
                Open receipts in Paddle
              </BillingStepButton>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
