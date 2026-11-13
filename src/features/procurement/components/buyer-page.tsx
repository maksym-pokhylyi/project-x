import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, pluralise } from "../domain/format";
import { bidCheckHrefFor } from "../domain/links";
import { formatMoneyShort } from "../domain/money";
import { regionLabel } from "../domain/regions";
import type { BuyerPageData } from "../public-data";
import type { ContractRow } from "../queries/contracts";
import type { NoticeCard } from "../queries/shared";
import { MatchRow, plainRow, tenderListClasses, tenderListFrameClasses, tenderListItemClasses } from "./match-row";
import { Money, NoticeRef, SourceLink } from "./notice-bits";
import { ActionBand } from "./ui/action-band";
import { AnchorNav } from "./ui/anchor-nav";
import { EmptyState } from "./ui/empty-state";
import { ListCardFoot } from "./ui/list-card";
import { MetaLine } from "./ui/meta-line";
import { SectionHead } from "./ui/section-head";
import { StatRow } from "./ui/stat-row";

/**
 * The public page of a buyer, in the language of the supplier page: who the body is, how it
 * buys, what it has open now and whom it has awarded to. Read from notices only.
 * COMPANY-LEVEL DATA ONLY: a supplier is named when it has a public page, and never a person.
 */
const BUYER_TYPES: Record<string, string> = {
  publicAuthorityCentralGovernment: "Central government",
  publicAuthoritySubCentralGovernment: "Local or regional public body",
  publicUndertaking: "Public undertaking",
  privateUtility: "Private utility",
  BODY_PUBLIC: "Body governed by public law",
  REGIONAL_AUTHORITY: "Regional or local authority",
  MINISTRY: "Central government",
  NATIONAL_AGENCY: "National agency",
  REGIONAL_AGENCY: "Regional agency",
};

/** Months the "how it awards" figures look back over (getBuyerCompetitionMix). */
const MIX_MONTHS = 24;

export function BuyerHead({ data }: { data: BuyerPageData }) {
  const { buyer } = data;
  const type = buyer.buyerType ? BUYER_TYPES[buyer.buyerType] : null;
  const where = [buyer.locality, buyer.region ? regionLabel(buyer.region) : null].filter((part, index, parts) => part && parts.indexOf(part) === index).join(", ");
  const updated = formatDate(data.updatedAt);
  return (
    <header className="flex min-w-0 flex-col gap-2.5 md:gap-3.5">
      <MetaLine
        parts={[
          { text: "Buyer page", wide: true },
          <span key="notices">
            <span className="max-md:hidden">built from </span>
            {pluralise(buyer.noticesCount, "published notice")}
          </span>,
          updated ? `updated ${updated}` : null,
        ]}
      />
      <h1 className="type-h1 text-ink [overflow-wrap:anywhere]">{buyer.name}</h1>
      <p className="text-sm text-ink-2 md:text-15">{[type, where, buyer.lastNoticeAt ? `last notice ${formatDate(buyer.lastNoticeAt)}` : null].filter(Boolean).join(" · ") || "Public buyer"}</p>
    </header>
  );
}

export function BuyerStats({ data }: { data: BuyerPageData }) {
  const { buyer, mix } = data;
  const withoutOpen = mix.direct + mix.limited;
  const awarded = buyer.awardsValue > 0 ? formatMoneyShort(buyer.awardsValue) : null;
  return (
    <StatRow
      label="Summary"
      stats={[
        { value: data.live.length.toLocaleString("en-GB"), label: data.live.length === 1 ? "open tender" : "open tenders" },
        { value: buyer.awardsCount.toLocaleString("en-GB"), label: `${buyer.awardsCount === 1 ? "contract" : "contracts"} awarded${awarded ? `, ${awarded} published` : ""}`, phoneLabel: "contracts awarded" },
        {
          value: mix.awards > 0 ? `${Math.round((withoutOpen / mix.awards) * 100)}%` : "—",
          label: mix.awards > 0 ? `awarded without an open tender (${withoutOpen} of ${mix.awards}, last ${MIX_MONTHS} months)` : `no awards in the last ${MIX_MONTHS} months`,
          phoneLabel: mix.awards > 0 ? "without an open tender" : "no recent awards",
        },
        { value: data.planning.length.toLocaleString("en-GB"), label: data.planning.length === 1 ? "early notice" : "early notices" },
      ]}
    />
  );
}

export function BuyerAnchors({ data }: { data: BuyerPageData }) {
  return (
    <AnchorNav
      items={[
        { href: "#open-tenders", label: "Open tenders", count: data.live.length },
        ...(data.planning.length > 0 ? [{ href: "#early-notices", label: "Early notices", count: data.planning.length }] : []),
        { href: "#awards", label: "Contracts awarded", count: data.contracts.total },
      ]}
    />
  );
}

function NoticeRows({ items, now, signedIn, label, signal = false }: { items: NoticeCard[]; now: Date; signedIn: boolean; label: string; signal?: boolean }) {
  return (
    <div className={tenderListFrameClasses}>
      <ul aria-label={label} className={tenderListClasses}>
        {items.map((card) => (
          <li key={card.ocid} className={tenderListItemClasses}>
            <MatchRow
              item={plainRow(card)}
              now={now}
              href={`/tenders/${card.ocid}`}
              typeAs="text"
              chips="wrap"
              compactActions
              refAsLink={false}
              signal={signal}
              actions={
                <>
                  {signal ? null : (
                    <ButtonLink variant="outline" href={bidCheckHrefFor(card.ocid, signedIn)} className="flex-1 text-15 @2xl:flex-none @2xl:text-sm">
                      Start a bid check
                    </ButtonLink>
                  )}
                  <SourceLink href={card.noticeUrl} className="@2xl:min-h-9 @2xl:justify-center @2xl:text-13" />
                </>
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BuyerOpenTenders({ data, now, signedIn }: { data: BuyerPageData; now: Date; signedIn: boolean }) {
  return (
    <section aria-labelledby="open-tenders" className="flex flex-col gap-4 md:gap-[1.125rem]">
      <SectionHead id="open-tenders" title="Open tenders" note={data.live.length > 0 ? "Tender notices from this buyer with a deadline still ahead. Soonest first." : undefined} />
      {data.live.length > 0 ? (
        <NoticeRows items={data.live} now={now} signedIn={signedIn} label="Open tenders" />
      ) : (
        <EmptyState headingLevel="h3" title="This buyer has no open tenders right now">
          Its contract awards below show what it buys, and how.
        </EmptyState>
      )}
    </section>
  );
}

export function BuyerEarlyNotices({ data, now, signedIn }: { data: BuyerPageData; now: Date; signedIn: boolean }) {
  if (data.planning.length === 0) return null;
  return (
    <section aria-labelledby="early-notices" className="flex flex-col gap-4 md:gap-[1.125rem]">
      <SectionHead id="early-notices" title="Early notices" note="Announced but not yet opened. Dates are the buyer’s own estimates and can move." />
      <NoticeRows items={data.planning} now={now} signedIn={signedIn} label="Early notices" signal />
    </section>
  );
}

function howAwarded(data: BuyerPageData): string {
  const { mix } = data;
  if (mix.awards === 0) return "As published on Find a Tender. Most recent first.";
  const parts = [
    mix.open ? `${mix.open} after an open tender` : null,
    mix.limited ? `${mix.limited} after inviting selected suppliers` : null,
    mix.direct ? `${mix.direct} awarded directly` : null,
    mix.framework ? `${mix.framework} called off a framework` : null,
    mix.unknown ? `${mix.unknown} not stated` : null,
  ].filter(Boolean);
  return `In the last ${MIX_MONTHS} months: ${parts.join(", ")}.`;
}

function supplierCell(contract: ContractRow) {
  return contract.supplierSlug ? (
    <Link href={`/suppliers/${contract.supplierSlug}`} className="link-quiet font-semibold [overflow-wrap:anywhere]">
      {contract.supplierLabel}
    </Link>
  ) : (
    <span className="text-ink-2">{contract.supplierLabel}</span>
  );
}

export function BuyerAwards({ data }: { data: BuyerPageData }) {
  const { contracts, buyer } = data;
  return (
    <section aria-labelledby="awards" className="flex flex-col gap-4 md:gap-[1.125rem]">
      <SectionHead id="awards" title="Contracts awarded" note={howAwarded(data)} />
      {contracts.items.length > 0 ? (
        <div className="overflow-hidden rounded-card border border-line bg-surface" data-testid="contracts-table">
          <Table className="max-md:hidden" aria-label={`Contracts awarded by ${buyer.name}`}>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead numeric>Value</TableHead>
                <TableHead>Awarded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.items.map((contract) => (
                <TableRow key={`${contract.ocid}:${contract.supplierId}`}>
                  <TableCell className="min-w-[13rem]">{supplierCell(contract)}</TableCell>
                  <TableCell className="min-w-[14rem]">
                    <span className="block [overflow-wrap:anywhere]">{contract.title}</span>
                    <NoticeRef id={contract.releaseId} href={contract.noticeUrl} />
                  </TableCell>
                  <TableCell numeric>{contract.valueAmount !== null ? <Money amount={contract.valueAmount} exact /> : <span className="text-ink-2">Not published</span>}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(contract.awardedAt) ?? <span className="text-ink-2">Not published</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ul aria-label={`Contracts awarded by ${buyer.name}`} className="flex flex-col divide-y divide-line md:hidden">
            {contracts.items.map((contract) => (
              <li key={`${contract.ocid}:${contract.supplierId}`} className="flex flex-col gap-0.5 px-4 py-3.5">
                <span className="text-15 leading-snug">{supplierCell(contract)}</span>
                <span className="text-13 text-ink-2 [overflow-wrap:anywhere]">{contract.title}</span>
                <span className="pt-0.5 text-13 text-ink tabular-nums">
                  {contract.valueAmount !== null ? <Money amount={contract.valueAmount} exact className="font-semibold" /> : "Value not published"}
                  {contract.awardedAt ? ` · awarded ${formatDate(contract.awardedAt)}` : null}
                </span>
              </li>
            ))}
          </ul>
          {contracts.total > contracts.items.length ? (
            <ListCardFoot className="border-t border-line py-3">
              The {contracts.items.length} most recent of {pluralise(contracts.total, "contract")}.
            </ListCardFoot>
          ) : null}
        </div>
      ) : (
        <EmptyState headingLevel="h3" title="No contract awards are published for this buyer yet" />
      )}
    </section>
  );
}

export function BuyerBand() {
  return (
    <ActionBand
      title="Supply this buyer, or want to?"
      actions={
        <ButtonLink variant="outline" href="/find" className="max-md:w-full">
          Find your company
        </ButtonLink>
      }
    >
      Find your company to see the open tenders that match what you have already won, and the rival contracts that end soon.
    </ActionBand>
  );
}
