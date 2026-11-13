import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { describeTimeUntil, formatDate, pluralise } from "../domain/format";
import { regionLabel } from "../domain/regions";
import type { BuyerInsight } from "../queries/buyers";
import type { ContractRow, EndingSoonItem } from "../queries/contracts";
import { Money, NoticeRef } from "./notice-bits";
import { ListCardFoot } from "./ui/list-card";

/**
 * The three tables of a supplier's record — its contract wins, rival contracts ending soon
 * and the buyers in its trade — as the Supplier and Radar artboards draw them: the library
 * <Table> from 768 px, and the same facts as rows of one card on phones (a table that
 * scrolls sideways hides its last columns from a thumb).
 *
 * Every figure is read from published notices by the query layer. Where a notice does not
 * state something, the cell says so in words; nothing is estimated here.
 * COMPANY-LEVEL DATA ONLY: suppliers are named only when they have a public page
 * (`supplierLabel` says "Supplier named in the notice" otherwise).
 */

/** The frame both forms share: a card from 768 px, unless the caller is already inside one (`framed={false}`). */
function tableFrame(framed: boolean): string {
  return framed ? "overflow-hidden rounded-card border border-line bg-surface" : "";
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-2">{children}</span>;
}

// ---------------------------------------------------------------------------
// Contract wins
// ---------------------------------------------------------------------------

/** "running", "ended", with the furthest extension the notice states. Never a guess about extensions it does not mention. */
function contractState(contract: Pick<ContractRow, "contractEnd" | "maxExtentEnd">, now: Date): string | null {
  if (!contract.contractEnd) return null;
  const running = Date.parse(contract.contractEnd) > now.getTime();
  const extension = contract.maxExtentEnd && Date.parse(contract.maxExtentEnd) > Date.parse(contract.contractEnd) ? formatDate(contract.maxExtentEnd) : null;
  return `${running ? "running" : "ended"}${extension ? ` · can be extended to ${extension}` : ""}`;
}

function winValue(contract: ContractRow): ReactNode {
  if (contract.valueAmount !== null) return <Money amount={contract.valueAmount} exact />;
  return <Muted>{contract.valueShared ? "Shared between suppliers" : contract.isFramework ? "Framework: no value of its own" : "Not published"}</Muted>;
}

export function ContractWins({
  items,
  now,
  foot,
  phoneLimit,
  phoneFoot,
  caption,
}: {
  items: ContractRow[];
  now: Date;
  /** The last row of the card: "Show all 37 contracts", pagination. */
  foot?: ReactNode;
  /** Under 768 px show only this many rows (a preview: a phone row is three lines tall). */
  phoneLimit?: number;
  /** The last row on phones when there is no `foot` (the phone preview hides rows the table shows). */
  phoneFoot?: ReactNode;
  caption: string;
}) {
  const phoneItems = phoneLimit ? items.slice(0, phoneLimit) : items;
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface" data-testid="contracts-table">
      <Table className="max-md:hidden" aria-label={caption}>
        <TableHeader>
          <TableRow>
            <TableHead>Contract</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead numeric>Value</TableHead>
            <TableHead>Awarded</TableHead>
            <TableHead>Ends</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((contract) => {
            const state = contractState(contract, now);
            return (
              <TableRow key={contract.ocid}>
                <TableCell className="min-w-[16rem]">
                  <span className="block font-semibold text-ink [overflow-wrap:anywhere]">{contract.title}</span>
                  <NoticeRef id={contract.releaseId} href={contract.noticeUrl} />
                </TableCell>
                <TableCell className="min-w-[11rem]">
                  {contract.buyerSlug ? (
                    <Link href={`/buyers/${contract.buyerSlug}`} className="link-quiet">
                      {contract.buyerName}
                    </Link>
                  ) : (
                    (contract.buyerName ?? <Muted>Not named</Muted>)
                  )}
                </TableCell>
                <TableCell numeric>{winValue(contract)}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(contract.awardedAt) ?? <Muted>Not published</Muted>}</TableCell>
                <TableCell>
                  {contract.contractEnd ? (
                    <>
                      <span className="block whitespace-nowrap">{formatDate(contract.contractEnd)}</span>
                      {state ? <span className="block text-xs text-ink-2">{state}</span> : null}
                    </>
                  ) : (
                    <Muted>Not stated</Muted>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ul aria-label={caption} className="flex flex-col divide-y divide-line md:hidden">
        {phoneItems.map((contract) => {
          const running = contract.contractEnd ? Date.parse(contract.contractEnd) > now.getTime() : null;
          return (
            <li key={contract.ocid} className="flex flex-col gap-0.5 px-4 py-3.5">
              <span className="text-15 leading-snug font-semibold text-ink [overflow-wrap:anywhere]">{contract.title}</span>
              <span className="text-13 text-ink-2">{contract.buyerName ?? "Buyer not named"}</span>
              <span className="pt-1 text-13 text-ink tabular-nums">
                <span className="font-semibold">{winValue(contract)}</span>
                {contract.awardedAt ? ` · awarded ${formatDate(contract.awardedAt)}` : null}
                {contract.contractEnd ? ` · ${running ? "runs to" : "ended"} ${formatDate(contract.contractEnd)}` : null}
              </span>
            </li>
          );
        })}
      </ul>
      {foot ? <ListCardFoot className="border-t border-line">{foot}</ListCardFoot> : phoneFoot ? <ListCardFoot className="border-t border-line md:hidden">{phoneFoot}</ListCardFoot> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rival contracts ending soon
// ---------------------------------------------------------------------------

/** The furthest date the notice lets the contract run to: as a cell under "Extension option" and as the end of a phone line. Never a guess. */
function extension(item: Pick<ContractRow, "contractEnd" | "maxExtentEnd">): { cell: string; line: string; option: string } {
  if (item.contractEnd && item.maxExtentEnd && Date.parse(item.maxExtentEnd) > Date.parse(item.contractEnd)) {
    const until = formatDate(item.maxExtentEnd);
    return { cell: `Can be extended to ${until}`, line: `can be extended to ${until}`, option: `can be extended to ${until}` };
  }
  return { cell: "None stated", line: "no extension stated", option: "none stated" };
}

export function EndingContracts({
  items,
  now,
  framed = true,
  action,
  foot,
}: {
  items: EndingSoonItem[];
  now: Date;
  framed?: boolean;
  /** A control at the end of each row (Save, in the radar). */
  action?: (item: EndingSoonItem) => ReactNode;
  foot?: ReactNode;
}) {
  return (
    <div className={tableFrame(framed)} data-testid="ending-list">
      <Table className="max-md:hidden" aria-label="Rival contracts ending soon">
        <TableHeader>
          <TableRow>
            <TableHead>Contract</TableHead>
            <TableHead>Held by</TableHead>
            <TableHead numeric>Value</TableHead>
            <TableHead>Ends</TableHead>
            <TableHead>Extension option</TableHead>
            {action ? (
              <TableHead>
                <span className="sr-only">Save</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={`${item.ocid}:${item.supplierId}`} data-testid="ending-row">
              <TableCell className="min-w-[15rem]">
                <span className="block font-semibold text-ink [overflow-wrap:anywhere]">{item.title}</span>
                <span className="block text-13 text-ink-2">{item.buyerName ?? "Buyer not named"}</span>
              </TableCell>
              <TableCell className="min-w-[10rem]">
                {item.supplierSlug ? (
                  <Link href={`/suppliers/${item.supplierSlug}`} className="link-quiet">
                    {item.supplierLabel}
                  </Link>
                ) : (
                  item.supplierLabel
                )}
              </TableCell>
              <TableCell numeric>{item.valueAmount !== null ? <Money amount={item.valueAmount} exact /> : <Muted>Not published</Muted>}</TableCell>
              <TableCell>
                <span className="block font-semibold whitespace-nowrap text-ink">{formatDate(item.contractEnd)}</span>
                <span className="block text-xs text-ink-2">{describeTimeUntil(item.contractEnd, now)}</span>
              </TableCell>
              <TableCell className="min-w-[9rem]">{extension(item).cell}</TableCell>
              {action ? <TableCell className="py-2.5 text-right align-middle">{action(item)}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {/* Phones: the rows of one card. With an action (the radar, RadarEnding-390) the extension has its own line and the button fills the row. */}
      <ul aria-label="Rival contracts ending soon" className={cn("flex flex-col divide-y divide-line md:hidden", !framed && "rounded-card border border-line bg-surface")}>
        {items.map((item) => {
          const extended = extension(item);
          return (
            <li key={`${item.ocid}:${item.supplierId}`} className={cn("flex flex-col gap-0.5 px-4 pt-3.5", action ? "pb-4" : "pb-3.5")}>
              <span className="text-15 leading-snug font-semibold text-ink [overflow-wrap:anywhere]">{item.title}</span>
              <span className="text-13 text-ink">Held by {item.supplierLabel}</span>
              <span className="text-13 text-ink-2">
                {item.buyerName ?? "Buyer not named"}
                {item.valueAmount !== null ? (
                  <>
                    {" · "}
                    <Money amount={item.valueAmount} exact />
                  </>
                ) : null}
              </span>
              <span className="pt-1 text-13 text-ink tabular-nums">
                <span className="font-semibold">Ends {formatDate(item.contractEnd)}</span> · {describeTimeUntil(item.contractEnd, now)}
                {action ? null : ` · ${extended.line}`}
              </span>
              {action ? <span className="text-13 text-ink">Extension option: {extended.option}</span> : null}
              {action ? <span className="flex pt-2.5 [&>*]:flex-1">{action(item)}</span> : null}
            </li>
          );
        })}
      </ul>
      {foot ? <ListCardFoot className={cn(framed && "border-t border-line")}>{foot}</ListCardFoot> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buyers in the trade
// ---------------------------------------------------------------------------

/**
 * "Went to small firms": the share of a buyer's contracts in the trade whose supplier the
 * notice classes as a small or medium-sized business. A percentage needs enough contracts
 * to mean something; with fewer than five sized contracts the count itself is shown, and
 * with none the cell says the notices do not state it.
 */
export function smeShare(buyer: Pick<BuyerInsight, "smeAwards" | "sizedAwards">): string {
  if (buyer.sizedAwards === 0) return "Not stated";
  if (buyer.sizedAwards < 5) return `${Math.round(buyer.smeAwards)} of ${buyer.sizedAwards}`;
  return `${Math.round((buyer.smeAwards / buyer.sizedAwards) * 100)}%`;
}

function ownRecord(buyer: BuyerInsight, personal: boolean): ReactNode {
  if (buyer.ownAwards > 0) return personal ? buyer.ownAwards.toLocaleString("en-GB") : pluralise(buyer.ownAwards, "win");
  return <span className="font-normal text-ink-2">{personal ? "None yet" : "No wins yet"}</span>;
}

/** One figure of a buyer's phone card: the number over its small label. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse justify-end">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="text-15 font-semibold text-ink">{children}</dd>
    </div>
  );
}

function OpenTenders({ buyer }: { buyer: BuyerInsight }) {
  if (buyer.openTenders === 0) return <Muted>0</Muted>;
  return (
    <Link href={`/buyers/${buyer.slug}#open-tenders`} className="link inline-flex min-h-11 min-w-11 items-center justify-end font-semibold" aria-label={`${pluralise(buyer.openTenders, "open tender")} from ${buyer.name}`}>
      {buyer.openTenders.toLocaleString("en-GB")}
    </Link>
  );
}

export function BuyersInTrade({
  items,
  framed = true,
  personal = false,
  foot,
}: {
  items: BuyerInsight[];
  framed?: boolean;
  /** In the radar the reader is the company itself ("Contracts you have won from them", open tenders); on the public page the columns are worded for a visitor. */
  personal?: boolean;
  foot?: ReactNode;
}) {
  const ownHead = personal ? "Contracts you have won from them" : "Your record";
  return (
    <div className={tableFrame(framed)} data-testid="buyers-list">
      <Table className="max-md:hidden" aria-label="Buyers in this trade">
        <TableHeader>
          <TableRow>
            <TableHead>Buyer</TableHead>
            {personal ? <TableHead numeric>{ownHead}</TableHead> : null}
            <TableHead numeric>{personal ? "Awards in your trade" : "Contracts awarded"}</TableHead>
            <TableHead numeric>Median value</TableHead>
            <TableHead numeric>{personal ? "Share won by small firms" : "Went to small firms"}</TableHead>
            {personal ? <TableHead numeric>Open tenders</TableHead> : <TableHead>{ownHead}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((buyer) => (
            <TableRow key={buyer.buyerId} data-testid="buyer-row">
              <TableCell className="min-w-[14rem]">
                <Link href={`/buyers/${buyer.slug}`} className="link-quiet block font-semibold [overflow-wrap:anywhere]">
                  {buyer.name}
                </Link>
                {personal && buyer.region && regionLabel(buyer.region) ? (
                  <Badge variant="secondary" className="mt-1">
                    {regionLabel(buyer.region)}
                  </Badge>
                ) : null}
              </TableCell>
              {personal ? <TableCell numeric>{ownRecord(buyer, true)}</TableCell> : null}
              <TableCell numeric>{buyer.awards.toLocaleString("en-GB")}</TableCell>
              <TableCell numeric>{buyer.medianValue !== null ? <Money amount={buyer.medianValue} exact /> : <Muted>Not published</Muted>}</TableCell>
              <TableCell numeric>{smeShare(buyer)}</TableCell>
              {personal ? (
                <TableCell numeric className="py-0.5">
                  <OpenTenders buyer={buyer} />
                </TableCell>
              ) : (
                <TableCell>{ownRecord(buyer, false)}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {/* Phones. The radar (RadarBuyers-390): a card per buyer, four figures and its open tenders. The public page (Supplier-390): rows of one card, three figures. */}
      <ul aria-label="Buyers in this trade" className={cn("flex flex-col md:hidden", personal ? "gap-3" : "divide-y divide-line", !personal && !framed && "rounded-card border border-line bg-surface")}>
        {items.map((buyer) => {
          const median = buyer.medianValue !== null ? <Money amount={buyer.medianValue} exact /> : <span className="font-normal text-ink-2">Not published</span>;
          if (personal) {
            const region = regionLabel(buyer.region);
            return (
              <li key={buyer.buyerId} className="flex flex-col rounded-card border border-line bg-surface">
                <div className="flex flex-col px-4 py-3.5">
                  <Link href={`/buyers/${buyer.slug}`} className="link-quiet text-base leading-snug font-semibold [overflow-wrap:anywhere]">
                    {buyer.name}
                  </Link>
                  {region ? (
                    <span className="flex pt-1.5">
                      <Badge variant="secondary">{region}</Badge>
                    </span>
                  ) : null}
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-3 tabular-nums">
                    <Fact label="contracts you have won from them">{ownRecord(buyer, true)}</Fact>
                    <Fact label="awards in your trade">{buyer.awards.toLocaleString("en-GB")}</Fact>
                    <Fact label="median value">{median}</Fact>
                    <Fact label="share won by small firms">{smeShare(buyer)}</Fact>
                  </dl>
                </div>
                {buyer.openTenders > 0 ? (
                  <div className="border-t border-line px-4">
                    <Link href={`/buyers/${buyer.slug}#open-tenders`} className="link inline-flex min-h-11 items-center rounded-sm text-sm font-medium">
                      {pluralise(buyer.openTenders, "open tender")}
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          }
          return (
            <li key={buyer.buyerId} className="flex flex-col gap-2 px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <Link href={`/buyers/${buyer.slug}`} className="link-quiet text-15 leading-snug font-semibold [overflow-wrap:anywhere]">
                  {buyer.name}
                </Link>
                <span className="shrink-0 text-13 text-ink">{buyer.ownAwards > 0 ? pluralise(buyer.ownAwards, "win") : <Muted>No wins yet</Muted>}</span>
              </div>
              <dl className="grid grid-cols-3 gap-2 tabular-nums">
                <Fact label="contracts">{buyer.awards.toLocaleString("en-GB")}</Fact>
                <Fact label="median value">{median}</Fact>
                <Fact label="to small firms">{smeShare(buyer)}</Fact>
              </dl>
            </li>
          );
        })}
      </ul>
      {foot ? <ListCardFoot className={cn(framed ? "border-t border-line" : "max-md:px-0")}>{foot}</ListCardFoot> : null}
    </div>
  );
}
