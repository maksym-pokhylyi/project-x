import Link from "next/link";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";
import { claimSupplierAction } from "../actions";
import { formatMoneyShort } from "../domain/money";
import type { SupplierRecord } from "../queries/suppliers";
import { TickRow } from "@/components/ui/choice";
import { controlSize } from "./ui/control-size";
import { StatRow } from "./ui/stat-row";
import { TickList } from "@/components/ui/tick-list";

/**
 * The parts of the Claim page, as the Claim and ClaimSignedIn artboards draw it: the
 * company being claimed, the confirmation of somebody who is signed in, and what claiming
 * gives. (The signed-out account form is claim-sign-up.tsx: it needs the browser.)
 *
 * The workspace is linked to the company ONLY by the Server Action behind "Confirm and open
 * my radar", and only with the tick: following a link to this page changes nothing.
 * COMPANY-LEVEL DATA ONLY in the card.
 */

/** The company: its name, where it is, its Companies House number, three figures and the way to its page. */
export function ClaimCompanyCard({ supplier }: { supplier: SupplierRecord }) {
  const awarded = formatMoneyShort(supplier.totalValue);
  return (
    <div
      className={cn("flex flex-col gap-x-10 rounded-card border border-line bg-surface px-4 pt-4 md:px-7 md:pt-5.5 lg:flex-row lg:items-center lg:pb-5.5", supplier.isPublic ? "pb-1 md:pb-3" : "pb-4 md:pb-5.5")}
      data-testid="claim-company"
    >
      <div className="flex min-w-0 flex-col gap-1 lg:flex-[1_1_25rem]">
        <h2 className="type-h3 text-ink [overflow-wrap:anywhere]">{supplier.name}</h2>
        <p className="text-13 text-ink-2 md:text-sm">
          {[supplier.locality, supplier.companyNumber ? "Companies House" : null].filter(Boolean).join(" · ")}
          {supplier.companyNumber ? (
            <>
              {" "}
              <span className="font-mono text-xs md:text-13">{supplier.companyNumber}</span>
            </>
          ) : null}
        </p>
      </div>
      <StatRow
        label="Published record"
        variant="plain"
        leadingDivider
        className="mt-3.5 lg:mt-0 lg:shrink-0"
        stats={[
          { value: supplier.awardsCount.toLocaleString("en-GB"), label: supplier.awardsCount === 1 ? "contract" : "contracts" },
          { value: supplier.totalValue > 0 && awarded ? awarded : "—", label: "awarded" },
          { value: supplier.buyersCount.toLocaleString("en-GB"), label: supplier.buyersCount === 1 ? "public buyer" : "public buyers" },
        ]}
      />
      {supplier.isPublic ? (
        <Link href={`/suppliers/${supplier.slug}`} className="link inline-flex min-h-11 shrink-0 items-center self-start rounded-sm text-sm lg:self-center">
          View the page
        </Link>
      ) : null}
    </div>
  );
}

/** "What claiming gives you, free" — the side panel. */
export function ClaimBenefits({ className }: { className?: string }) {
  return (
    <section aria-labelledby="claim-free-h" className={cn("flex flex-col gap-4 rounded-card bg-brand-tint p-5 md:p-7", className)}>
      <h2 id="claim-free-h" className="type-h3 text-ink">
        What claiming gives you, free
      </h2>
      <TickList className="text-sm" items={["Ask us to correct or hide details on your page", "Your radar, with your top 10 matches", "A weekly digest by email", "1 cited bid check"]} />
    </section>
  );
}

/** A white card of the claim page with its serif heading. */
export function ClaimCard({ title, headingId, children, className, ...props }: { title: ReactNode; headingId: string; children: ReactNode; className?: string; "data-testid"?: string }) {
  return (
    <section aria-labelledby={headingId} className={cn("flex min-w-0 flex-col gap-5 rounded-card border border-line bg-surface p-5 md:p-7", className)} {...props}>
      <h2 id={headingId} className="type-h3 text-ink [overflow-wrap:anywhere]">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Signed in: one tick and one button. `ticked` restores the tick of somebody who made it
 * on the account form before confirming their e-mail; `missing` says the form came back
 * without it.
 */
export function ClaimConfirmForm({
  supplierId,
  userName,
  userEmail,
  ticked = false,
  missing = false,
  problem,
}: {
  supplierId: string;
  userName: string;
  userEmail: string;
  ticked?: boolean;
  missing?: boolean;
  /** What went wrong on the last try, in words. */
  problem?: string | null;
}) {
  const height = controlSize.form;
  return (
    <ClaimCard title={`Signed in as ${userName}`} headingId="claim-confirm-h" className="max-md:pb-2" data-testid="claim-form">
      <p className="-mt-3 text-13 text-ink-2 [overflow-wrap:anywhere]">{userEmail}</p>
      {problem ? (
        <Alert variant="destructive" data-testid="claim-problem">
          <p>{problem}</p>
        </Alert>
      ) : null}
      <form action={claimSupplierAction} className="flex flex-col gap-4">
        <input type="hidden" name="supplierId" value={supplierId} />
        <div className="flex flex-col">
          <TickRow name="authorised" defaultChecked={ticked} aria-invalid={missing || undefined} aria-describedby={missing ? "claim-authorised-error" : undefined} className="self-start" data-testid="claim-authorised">
            I am authorised to act for this company
          </TickRow>
          {missing ? (
            <p id="claim-authorised-error" role="alert" className="text-13 font-medium text-danger">
              Tick the box to confirm that you are authorised to act for this company.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-x-6 gap-y-1 md:flex-row md:flex-wrap md:items-center">
          <Button type="submit" className={cn(height, "px-[1.375rem] text-base")} data-testid="claim-confirm">
            Confirm and open my radar
          </Button>
          <Link href="/app/radar/find" className="link inline-flex min-h-11 items-center rounded-sm text-sm max-md:self-center">
            This is not my company
          </Link>
        </div>
      </form>
    </ClaimCard>
  );
}

/** Under the account form: the way in for somebody who already has an account, and what creating one agrees to. */
export function ClaimAccountLinks({ signInHref }: { signInHref: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm text-ink-2 max-md:items-center max-md:text-center">
      <p>
        Already have an account?{" "}
        <Link href={signInHref} className="link font-semibold">
          Sign in
        </Link>
      </p>
      <p className="text-13">
        By creating an account you agree to our{" "}
        <Link href="/legal/terms" className="link">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="link">
          Privacy notice
        </Link>
        .
      </p>
    </div>
  );
}

/** A state of the claim page that ends it: already claimed, the plan's limit, nothing to claim. */
export function ClaimNotice({
  title,
  children,
  primary,
  secondary,
  ...props
}: {
  title: string;
  children: ReactNode;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
  "data-testid"?: string;
}) {
  return (
    <ClaimCard title={title} headingId="claim-notice-h" className={secondary ? "max-md:pb-2" : undefined} {...props}>
      <div className="-mt-2 flex max-w-[35rem] flex-col gap-2 text-15 text-ink">{children}</div>
      <div className="flex flex-col gap-x-6 gap-y-1 md:flex-row md:flex-wrap md:items-center">
        <ButtonLink href={primary.href} className={cn(controlSize.form, "px-[1.375rem] text-base")}>
          {primary.label}
        </ButtonLink>
        {secondary ? (
          <Link href={secondary.href} className="link inline-flex min-h-11 items-center rounded-sm text-sm max-md:self-center">
            {secondary.label}
          </Link>
        ) : null}
      </div>
    </ClaimCard>
  );
}
