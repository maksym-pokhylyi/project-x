"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Status = { isPaid: boolean; planKey: string };

const POLL_MS = 2000;
const MAX_ATTEMPTS = 45; // ~90 seconds

/** A row of the confirmation: "Plan" · "Bid Desk". */
export type ConfirmationRow = { term: string; value: ReactNode };

/** What the page says once the purchase is confirmed, prepared on the server from the subscription record. */
export type Confirmation = {
  title: string;
  lead: string;
  rows: ConfirmationRow[];
  /** The one green action, then quieter ones. */
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  link?: { label: string; href: string };
  /** A small line under the actions. */
  note?: string;
};

/** The 40 px circle with a tick of the CheckoutPlan / CheckoutPass artboards. */
function DoneMark() {
  return (
    <svg viewBox="1 1 18 18" aria-hidden className="size-10 fill-none stroke-brand stroke-[1.1] [stroke-linecap:round] [stroke-linejoin:round]">
      <circle cx="10" cy="10" r="8" />
      <path d="M6.3 10.3l2.6 2.6 4.8-5" />
    </svg>
  );
}

const title = "mt-4 font-display text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.015em] text-ink md:mt-[1.125rem] md:text-4xl md:leading-[1.15]";
const lead = "mt-2 text-15 leading-[1.5] text-ink tabular-nums md:mt-2.5 md:text-base";

function Rows({ rows, pending = false }: { rows: ConfirmationRow[]; pending?: boolean }) {
  return (
    <dl className="mt-6 flex flex-col rounded-card border border-line bg-surface px-4 py-1 tabular-nums md:mt-7 md:px-6 md:py-1.5">
      {rows.map((row, index) => (
        <div key={row.term} className={cn("flex flex-col gap-0.5 py-3 md:flex-row md:flex-wrap md:items-baseline md:gap-x-6 md:py-[0.8125rem]", index > 0 && "border-t border-line")}>
          <dt className="text-xs leading-[1.5] text-ink-2 md:flex-[0_0_7.5rem] md:text-sm">{row.term}</dt>
          <dd className={cn("min-w-0 text-15 leading-[1.5] [overflow-wrap:anywhere] text-ink md:flex-[1_1_20rem]", pending && "text-ink-2")}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Shown after Paddle redirects back from checkout, as in the CheckoutPlan and CheckoutPass
 * artboards. It does NOT trust that redirect: it polls /api/billing/status until the webhook
 * has activated the plan in our database, and only then says "You are on Bid Desk".
 *
 *   waiting  "Confirming your payment" — the rows show what is being waited for
 *   active   the confirmation, with the facts of the subscription (`confirmation`)
 *   timeout  "This is taking longer than usual" — nothing to pay again, where to go next
 *
 * `confirmation` comes from the server and is null until the subscription record exists;
 * when the poll sees the plan, the page is refreshed and it arrives.
 * `kind="pass"` is the Bid Pass purchase: `confirmed` then says whether the pass has been
 * added (from the billing backend; until that exists the page can only wait and time out).
 */
export function CheckoutStatus({ kind = "plan", confirmation, confirmed = false }: { kind?: "plan" | "pass"; confirmation: Confirmation | null; confirmed?: boolean }) {
  const router = useRouter();
  /* The server says it is done: nothing to wait for. (A boolean, so a refresh that brings new props does not restart the poll.) */
  const ready = confirmed && confirmation !== null;
  const [state, setState] = useState<"waiting" | "active" | "timeout">(ready ? "active" : "waiting");
  const attempts = useRef(0);

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      attempts.current += 1;
      try {
        if (kind === "plan") {
          const response = await fetch("/api/billing/status", { cache: "no-store" });
          if (response.ok) {
            const status = (await response.json()) as Status;
            if (!cancelled && status.isPaid) {
              setState("active");
              router.refresh();
              return;
            }
          }
        } else {
          // A Bid Pass does not change the plan: ask the server again whether it has been added.
          router.refresh();
        }
      } catch {
        // transient network error: keep polling
      }
      if (cancelled) return;
      if (attempts.current >= MAX_ATTEMPTS) setState("timeout");
      else timer = window.setTimeout(poll, POLL_MS);
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [router, kind, ready]);

  const done = (state === "active" || ready) && confirmation;

  if (done) {
    return (
      <div className="mx-auto flex w-full max-w-[40rem] flex-col" role="status" data-testid="checkout-confirmed">
        <DoneMark />
        <h1 className={title}>{confirmation.title}</h1>
        <p className={lead}>{confirmation.lead}</p>
        <Rows rows={confirmation.rows} />
        <div className="mt-6 flex flex-col gap-x-3 gap-y-2.5 md:mt-7 md:flex-row md:flex-wrap md:items-center max-md:controls-md">
          <ButtonLink href={confirmation.primary.href}>{confirmation.primary.label}</ButtonLink>
          {confirmation.secondary ? (
            <ButtonLink href={confirmation.secondary.href} variant="outline" className="px-[0.9375rem]">
              {confirmation.secondary.label}
            </ButtonLink>
          ) : null}
          {confirmation.link ? (
            <Link href={confirmation.link.href} className="link inline-flex min-h-11 items-center self-center rounded-sm text-15 font-medium md:ml-2">
              {confirmation.link.label}
            </Link>
          ) : null}
        </div>
        {confirmation.note ? <p className="mt-1 text-center text-13 leading-[1.5] text-ink-2 md:mt-3.5 md:text-left">{confirmation.note}</p> : null}
      </div>
    );
  }

  const waitingFor = kind === "pass" ? "Bid Pass" : "Plan";

  if (state === "timeout") {
    return (
      <div className="mx-auto flex w-full max-w-[40rem] flex-col" role="status" data-testid="checkout-timeout">
        <span aria-hidden className="grid size-10 place-items-center rounded-full bg-accent-tint">
          <span className="size-[0.5625rem] rounded-full bg-accent" />
        </span>
        <h1 className={title}>This is taking longer than usual</h1>
        <p className={lead}>
          You do not need to pay again. {kind === "pass" ? "Your Bid Pass is added" : "Your plan changes"} as soon as Paddle confirms the payment, which can take a few minutes.
        </p>
        <Rows
          pending
          rows={[
            { term: waitingFor, value: "Waiting for Paddle to confirm the payment" },
            { term: "Receipt", value: "Paddle emails it once the payment has gone through" },
          ]}
        />
        <div className="mt-6 flex flex-col gap-x-3 gap-y-2.5 md:mt-7 md:flex-row md:flex-wrap md:items-center max-md:controls-md">
          <ButtonLink href="/app/settings/billing" variant="outline" className="px-[0.9375rem]">
            Back to Billing
          </ButtonLink>
          <Link href="/contact" className="link inline-flex min-h-11 items-center self-center rounded-sm text-15 font-medium md:ml-2">
            Contact us
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[40rem] flex-col" role="status" aria-live="polite" data-testid="checkout-waiting">
      <span className="grid size-10 place-items-center">
        <Spinner className="size-7 text-ink-2" />
      </span>
      <h1 className={title}>Confirming your payment</h1>
      <p className={lead}>This usually takes a few seconds. Keep this page open.</p>
      <Rows
        pending
        rows={[
          { term: waitingFor, value: "Waiting for Paddle to confirm the payment" },
          { term: "Receipt", value: "Paddle emails it once the payment has gone through" },
        ]}
      />
    </div>
  );
}
