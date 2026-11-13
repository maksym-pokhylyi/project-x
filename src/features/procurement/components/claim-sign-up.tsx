"use client";

import Link from "next/link";
import { useState } from "react";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { TickRow } from "./ui/choice";
import { controlSize } from "./ui/control-size";

/**
 * Signed out on the Claim page: the account form in place, as the Claim artboard draws it —
 * "Your name", "Work email", "Password", the tick, "Create account and claim".
 *
 * It IS the product's sign-up form (src/components/auth/sign-up-form.tsx) with other words
 * and the tick: validation, errors, "check your inbox" and the way back are the shared
 * ones. Creating the account claims nothing. After the e-mail is confirmed the visitor
 * lands on this page again, signed in, with the tick remembered (`?authorised=1`), and one
 * button — a Server Action — links the company.
 */
export function ClaimSignUp({
  claimPath,
  requireEmailVerification,
  googleEnabled,
  notMineHref,
}: {
  /** "/claim/<slug>": where sign-up returns to. */
  claimPath: string;
  requireEmailVerification: boolean;
  googleEnabled: boolean;
  notMineHref: string;
}) {
  const [authorised, setAuthorised] = useState(false);
  return (
    <SignUpForm
      redirectTo={authorised ? `${claimPath}?authorised=1` : claimPath}
      requireEmailVerification={requireEmailVerification}
      googleEnabled={googleEnabled}
      labels={{ name: "Your name", email: "Work email", submit: "Create account and claim", pending: "Creating your account…" }}
      emailHint="We send a confirmation link to this address. Your radar opens once you confirm it."
      controlClassName={controlSize.form}
      submitClassName="px-[1.375rem] text-base"
      guard={() => (authorised ? null : "Tick the box to confirm that you are authorised to act for this company.")}
      aside={
        <Link href={notMineHref} className="link inline-flex min-h-11 items-center rounded-sm text-sm max-md:self-center">
          This is not my company
        </Link>
      }
    >
      <TickRow checked={authorised} onCheckedChange={(value) => setAuthorised(value === true)} className="self-start" data-testid="claim-authorised">
        I am authorised to act for this company
      </TickRow>
    </SignUpForm>
  );
}
