"use client";

import type { Paddle, PaddleEventData } from "@paddle/paddle-js";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export type PayCheckoutProps = {
  /** null when Paddle checkout is not configured for this deployment. */
  paddle: { environment: "sandbox" | "production"; clientToken: string } | null;
  /** The transaction from `?_ptxn=`, already validated on the server; null when there is none. */
  transactionId: string | null;
  testMode: boolean;
};

type State = "nothing" | "unavailable" | "opening" | "open" | "closed" | "completed";

/** If Paddle.js has not opened the checkout by itself after this long, ask for it explicitly. */
const OPEN_EXPLICITLY_AFTER_MS = 4_000;
/** The checkout frame Paddle.js adds to the page (class `paddle-frame`, name `paddle_frame`). */
const PADDLE_FRAME = 'iframe.paddle-frame, iframe[name="paddle_frame"]';
/** An ad blocker stops Paddle.js silently: stop waiting after this long. */
const GIVE_UP_AFTER_MS = 15_000;

/**
 * The page behind Paddle's default payment link. Initialising Paddle.js is all it takes:
 * Paddle.js sees `_ptxn` in the address bar and opens the checkout for that transaction.
 * Nothing here marks anything as paid — the webhook does.
 */
export function PayCheckout({ paddle, transactionId, testMode }: PayCheckoutProps) {
  const [state, setState] = useState<State>(!transactionId ? "nothing" : !paddle ? "unavailable" : "opening");
  const environment = paddle?.environment;
  const clientToken = paddle?.clientToken;

  useEffect(() => {
    if (!environment || !clientToken || !transactionId) return;
    let cancelled = false;
    let instance: Paddle | undefined;
    /** Mirrors the React state for the callbacks below (they must not read a stale render). */
    let latest: State = "opening";
    const move = (next: State) => {
      if (cancelled) return;
      latest = next;
      setState(next);
    };
    const onEvent = (event: PaddleEventData) => {
      if (event.name === "checkout.completed") move("completed");
      else if (latest === "completed") return;
      else if (event.name === "checkout.loaded") move("open");
      else if (event.name === "checkout.closed") move("closed");
      else if (event.name === "checkout.error" && latest === "opening") move("unavailable");
    };

    const openExplicitly = window.setTimeout(() => {
      // Paddle.js opens the checkout by itself when `_ptxn` is in the address bar: its overlay
      // frame is in the page right after initialisation (seen with Paddle.js 2.12). Ask for it
      // explicitly only if it has NOT done so — a checkout that is merely slow to load must
      // not be started over.
      if (cancelled || latest !== "opening" || !instance) return;
      if (document.querySelector(PADDLE_FRAME)) return;
      instance.Checkout.open({ transactionId, settings: { displayMode: "overlay", allowLogout: false } });
    }, OPEN_EXPLICITLY_AFTER_MS);
    const giveUp = window.setTimeout(() => {
      if (latest === "opening") move("unavailable");
    }, GIVE_UP_AFTER_MS);

    void (async () => {
      try {
        const { initializePaddle } = await import("@paddle/paddle-js");
        instance = await initializePaddle({
          environment,
          token: clientToken,
          eventCallback: onEvent,
          checkout: { settings: { displayMode: "overlay", allowLogout: false } },
        });
        if (!instance) move("unavailable");
      } catch {
        move("unavailable");
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(openExplicitly);
      window.clearTimeout(giveUp);
    };
  }, [environment, clientToken, transactionId]);

  const billingLink = (
    <Button asChild variant="outline">
      <Link href="/app/settings/billing">Go to Billing</Link>
    </Button>
  );

  return (
    <Card data-testid="pay-checkout" data-state={state}>
      <CardHeader>
        <CardTitle>
          {state === "nothing"
            ? "Nothing to pay here"
            : state === "unavailable"
              ? "The checkout could not be opened"
              : state === "completed"
                ? "Payment received"
                : state === "closed"
                  ? "Checkout closed"
                  : "Opening secure checkout…"}
        </CardTitle>
        <CardDescription>
          {state === "nothing"
            ? "This page opens a payment from a link Paddle, our payment provider, has sent you. The link you followed does not contain one."
            : state === "unavailable"
              ? paddle
                ? "The secure checkout did not load. An ad or tracking blocker is the usual reason: allow this page, then reload it. Your card has not been charged."
                : "Payments are not available here at the moment. Your card has not been charged."
              : state === "completed"
                ? "Thank you. Paddle is sending the receipt by e-mail; your workspace updates as soon as the payment is confirmed."
                : state === "closed"
                  ? "You closed the checkout before paying. Nothing was charged."
                  : "Payments are handled by Paddle. This takes a moment; please keep this page open."}
        </CardDescription>
      </CardHeader>
      {state === "opening" || state === "open" ? (
        <CardContent>
          <p className="flex items-center gap-2 text-sm text-ink-2" role="status" aria-live="polite">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            {state === "opening" ? "Loading…" : "The checkout is open."}
          </p>
        </CardContent>
      ) : null}
      {state === "completed" ? (
        <CardContent>
          <p className="flex items-center gap-2 text-sm text-ink-2" role="status">
            <CheckCircle2 aria-hidden className="size-4 text-brand" />
            Payment completed.
          </p>
        </CardContent>
      ) : null}
      {testMode && state !== "nothing" ? (
        <CardContent>
          <p className="text-sm text-ink-2" data-testid="pay-test-mode">
            Test mode: no card is charged.
          </p>
        </CardContent>
      ) : null}
      {state === "opening" || state === "open" ? null : (
        <CardFooter>
          {state === "completed" ? (
            <Button asChild>
              <Link href="/app/settings/billing/success">Continue</Link>
            </Button>
          ) : state === "closed" ? (
            <>
              <Button onClick={() => window.location.reload()}>Open the checkout again</Button>
              {billingLink}
            </>
          ) : state === "unavailable" && paddle ? (
            <>
              <Button onClick={() => window.location.reload()}>Reload</Button>
              {billingLink}
            </>
          ) : (
            billingLink
          )}
        </CardFooter>
      )}
    </Card>
  );
}
