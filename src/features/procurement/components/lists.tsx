import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { describeTimeUntil, formatDate, pluralise } from "../domain/format";
import { regionLabel } from "../domain/regions";
import type { BuyerInsight } from "../queries/buyers";
import type { ContractRow, EndingSoonItem } from "../queries/contracts";
import { Money, SourceLink } from "./primitives";

const COMPETITION_LABEL: Record<string, string> = {
  open: "Open competition",
  limited: "Invited suppliers",
  direct: "Direct award",
  framework: "Framework call-off",
  unknown: "Procedure not stated",
};

export function competitionLabel(competition: string): string {
  return COMPETITION_LABEL[competition] ?? COMPETITION_LABEL.unknown!;
}

function SupplierName({ contract }: { contract: ContractRow }) {
  if (contract.supplierSlug) {
    return (
      <Link href={`/suppliers/${contract.supplierSlug}`} className="text-foreground underline-offset-4 hover:underline">
        {contract.supplierLabel}
      </Link>
    );
  }
  return <span>{contract.supplierLabel}</span>;
}

/**
 * A contract whose stated end date is approaching. Wording stays with what the notice
 * says ("End date stated in the notice") — never a judgement about the incumbent.
 */
export function EndingSoonCard({ item, now, actions, className }: { item: EndingSoonItem | ContractRow; now?: Date; actions?: ReactNode; className?: string }) {
  const until = describeTimeUntil(item.contractEnd, now);
  return (
    <article className={cn("rounded-lg border bg-card p-4 shadow-xs", className)} data-testid="ending-soon-card">
      <p className="text-xs font-medium text-muted-foreground">
        End date stated in the notice: <time dateTime={item.contractEnd ?? undefined} className="text-foreground">{formatDate(item.contractEnd)}</time>
        {until ? <span> ({until})</span> : null}
        {item.maxExtentEnd && item.maxExtentEnd !== item.contractEnd ? <span> · can be extended to {formatDate(item.maxExtentEnd)}</span> : null}
      </p>
      <h3 className="mt-1.5 line-clamp-2 text-base font-semibold leading-snug">{item.title}</h3>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
        {item.buyerName ? (
          item.buyerSlug ? (
            <Link href={`/buyers/${item.buyerSlug}`} className="text-foreground underline-offset-4 hover:underline">
              {item.buyerName}
            </Link>
          ) : (
            <span className="text-foreground">{item.buyerName}</span>
          )
        ) : null}
        <span aria-hidden>·</span>
        <Money amount={item.valueAmount} />
        {item.lotsCount > 1 ? (
          <>
            <span aria-hidden>·</span>
            <span>{item.lotsCount} lots</span>
          </>
        ) : null}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Current supplier: <SupplierName contract={item} />
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <SourceLink href={item.noticeUrl} />
        {actions}
      </div>
    </article>
  );
}

/** A buyer and how it awards in the trade. */
export function BuyerCard({ item, className }: { item: BuyerInsight; className?: string }) {
  const share = Math.round(item.shareWithoutOpen * 100);
  return (
    <article className={cn("rounded-lg border bg-card p-4 shadow-xs", className)} data-testid="buyer-card">
      <h3 className="text-base font-semibold leading-snug">
        <Link href={`/buyers/${item.slug}`} className="underline-offset-4 hover:underline">
          {item.name}
        </Link>
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {pluralise(item.awards, "contract")} in your trade in the last 24 months
        {item.totalValue ? (
          <>
            {" "}
            · <Money amount={item.totalValue} />
          </>
        ) : null}
        {item.region && regionLabel(item.region) ? ` · ${regionLabel(item.region)}` : ""}
      </p>
      <p className="mt-2 text-sm">
        {item.withoutOpenCompetition > 0 ? (
          <>
            <span className="font-medium tabular-nums">
              {item.withoutOpenCompetition} of {item.awards}
            </span>{" "}
            awarded without an open tender <span className="text-muted-foreground">({share}%)</span>
          </>
        ) : (
          <span className="text-muted-foreground">All published awards followed an open tender or a framework.</span>
        )}
      </p>
      {item.ownAwards > 0 ? <p className="mt-1 text-xs text-muted-foreground">Includes {pluralise(item.ownAwards, "contract")} awarded to you.</p> : null}
    </article>
  );
}

/** Awards table: sticky header, numeric columns right-aligned, source link on every row. */
export function ContractsTable({ items, showSupplier = false, showBuyer = true, caption }: { items: ContractRow[]; showSupplier?: boolean; showBuyer?: boolean; caption: string }) {
  return (
    // `relative` keeps visually-hidden (absolutely positioned) text inside the scroller, so it cannot widen the page.
    <div className="relative overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[40rem] border-collapse text-sm" data-testid="contracts-table">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-muted text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Contract
            </th>
            {showBuyer ? (
              <th scope="col" className="px-3 py-2 font-medium">
                Buyer
              </th>
            ) : null}
            {showSupplier ? (
              <th scope="col" className="px-3 py-2 font-medium">
                Supplier
              </th>
            ) : null}
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Value
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Awarded
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Ends
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Source
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.ocid}:${item.supplierId}`} className="border-t align-top transition-colors hover:bg-accent/60">
              <td className="max-w-[22rem] px-3 py-2.5">
                <span className="line-clamp-2 font-medium">{item.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {competitionLabel(item.competition)}
                  {item.lotsCount > 1 ? ` · ${item.lotsCount} lots` : ""}
                  {item.isFramework ? " · framework" : ""}
                </span>
              </td>
              {showBuyer ? (
                <td className="px-3 py-2.5">
                  {item.buyerSlug ? (
                    <Link href={`/buyers/${item.buyerSlug}`} className="underline-offset-4 hover:underline">
                      {item.buyerName}
                    </Link>
                  ) : (
                    (item.buyerName ?? "—")
                  )}
                </td>
              ) : null}
              {showSupplier ? (
                <td className="px-3 py-2.5">
                  <SupplierName contract={item} />
                </td>
              ) : null}
              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                <Money amount={item.valueAmount} fallback={item.valueShared || item.isFramework ? "Shared" : "Not published"} />
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{formatDate(item.awardedAt) ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{formatDate(item.contractEnd) ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-2.5">
                <SourceLink href={item.noticeUrl} label="Notice" className="min-h-0" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
