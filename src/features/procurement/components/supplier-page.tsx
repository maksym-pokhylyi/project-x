import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button-link";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { procurementConfig } from "../config";
import { formatDate, pluralise } from "../domain/format";
import { bidCheckHrefFor, flagMistakeHref, FREE_BID_CHECK_HREF, SAMPLE_CHECK_HREF } from "../domain/links";
import { formatMoneyShort } from "../domain/money";
import { regionLabel } from "../domain/regions";
import { PUBLIC_BUYERS_MONTHS, PUBLIC_ENDING_MONTHS, type Block, type SupplierPageData } from "../public-data";
import type { ContractRow } from "../queries/contracts";
import type { SupplierRecord } from "../queries/suppliers";
import { MatchRow, tenderListClasses, tenderListFrameClasses, tenderListItemClasses } from "./match-row";
import { SourceLink } from "./notice-bits";
import { BuyersInTrade, ContractWins, EndingContracts } from "./supplier-lists";
import { ActionBand } from "@/components/ui/action-band";
import { AnchorNav } from "@/components/ui/anchor-nav";
import { CategoryChip, CategoryChipList } from "@/components/ui/category-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { MetaLine } from "@/components/ui/meta-line";
import { SectionHead } from "@/components/ui/section-head";
import { StatRow } from "./ui/stat-row";

/**
 * The public supplier page, as the Supplier artboards draw it. It is the first thing the
 * recipient of a cold e-mail sees, on a phone, so it speaks to the company itself ("Your
 * contract wins") and puts its record first: who it is, what it has won, the open tenders
 * like that work, and where every figure comes from.
 *
 * COMPANY-LEVEL DATA ONLY: nothing on this page comes from supplier_contacts, and no
 * contact name, e-mail address or telephone number is rendered. Every figure is read from
 * published notices; what a notice does not state is said to be missing, in words.
 *
 * An unclaimed page shows three rows per list; the rest is counted, not rendered.
 */
const SCALE: Record<string, string> = { sme: "Small or medium-sized business", large: "Large business" };

/** Codes that say what the company is awarded: a real share of its record, not the long tail of one framework. */
function tradeChips(supplier: SupplierRecord): Array<{ code: string; label: string }> {
  return (supplier.profile?.topCpv ?? [])
    .filter((entry) => entry.weight >= 0.08 && entry.label)
    .slice(0, 3)
    .map((entry) => ({ code: entry.code, label: entry.label! }));
}

export function SupplierHead({ supplier, updatedAt, claim }: { supplier: SupplierRecord; updatedAt: string | null; claim: ReactNode }) {
  const updated = formatDate(updatedAt);
  const region = supplier.region ? regionLabel(supplier.region) : null;
  const town = supplier.locality && supplier.locality !== region ? supplier.locality : null;
  const scale = supplier.scale ? SCALE[supplier.scale] : undefined;
  const chips = tradeChips(supplier);
  return (
    <div className="flex flex-col gap-x-14 gap-y-5 lg:flex-row lg:items-start lg:justify-between lg:gap-y-7">
      <header className="flex min-w-0 flex-col gap-2.5 md:gap-3.5 lg:flex-[1_1_35rem]">
        <MetaLine
          parts={[
            { text: "Supplier page", wide: true },
            <span key="notices">
              <span className="max-md:hidden">built from </span>
              {pluralise(supplier.noticesCount, "published notice")}
            </span>,
            updated ? `updated ${updated}` : null,
          ]}
        />
        <h1 className="type-h1 text-ink [overflow-wrap:anywhere]">{supplier.name}</h1>
        {/* A phone keeps this to one line where it can: the town and the number, as drawn. */}
        <p className="text-sm text-ink-2 md:text-15">
          {town ?? region}
          {town && region ? <span className="max-md:hidden">, {region}</span> : null}
          {town || region ? " · " : null}
          {supplier.companyNumber ? (
            <>
              Companies House <span className="font-mono text-13 md:text-sm">{supplier.companyNumber}</span>
            </>
          ) : (
            "No Companies House number published"
          )}
          {scale ? <span className="max-md:hidden"> · {scale}</span> : null}
        </p>
        {chips.length > 0 ? (
          <CategoryChipList label="Work this company is awarded" className="md:pt-0.5">
            {chips.map((chip) => (
              <li key={chip.code}>
                <CategoryChip code={chip.code} hideCodeOnPhone>
                  {chip.label}
                </CategoryChip>
              </li>
            ))}
          </CategoryChipList>
        ) : null}
      </header>
      {claim}
    </div>
  );
}

/**
 * "Is this your company?" — a card beside the title on a desk, one compact row on a phone.
 * For a viewer whose workspace has already claimed the page it says so and leads to the radar.
 */
export function SupplierClaimCard({ supplier, claimed }: { supplier: SupplierRecord; claimed: boolean }) {
  const flag = (
    <Link href={flagMistakeHref(`/suppliers/${supplier.slug}`)} className="link inline-flex min-h-11 items-center rounded-sm text-sm">
      Flag a mistake
    </Link>
  );
  if (claimed) {
    return (
      <section id="claim" aria-labelledby="claim-h" className="flex scroll-mt-6 flex-col gap-2.5 rounded-card border border-line bg-surface p-4 md:px-5.5 md:py-5 lg:w-[23.75rem] lg:shrink-0" data-testid="claimed-card">
        <h2 id="claim-h" className="font-display text-xl font-semibold text-ink">
          This page is on your radar
        </h2>
        <p className="text-sm text-ink">Your workspace has claimed it. Open tenders, rival contracts and buyers are in your radar, in full.</p>
        <div className="flex flex-wrap items-center gap-x-[1.125rem] gap-y-1.5 pt-1">
          <ButtonLink href="/app" data-testid="open-radar">
            Open your radar
          </ButtonLink>
          {flag}
        </div>
      </section>
    );
  }
  return (
    <section
      id="claim"
      aria-labelledby="claim-h"
      className="flex scroll-mt-6 items-center justify-between gap-3 rounded-card border border-line bg-surface py-3 pr-3 pl-4 md:flex-col md:items-stretch md:justify-start md:gap-2.5 md:px-5.5 md:py-5 lg:w-[23.75rem] lg:shrink-0"
      data-testid="claim-card"
    >
      <div className="flex min-w-0 flex-col md:gap-2.5">
        <h2 id="claim-h" className="font-sans text-15 leading-snug font-semibold text-ink md:font-display md:text-xl">
          Is this your company?
        </h2>
        <p className="text-13 text-ink-2 md:text-sm md:text-ink">
          <span className="md:hidden">Claim it to open your radar. Free.</span>
          <span className="max-md:hidden">Claim it to open your radar, and to ask us to correct or hide details on this page. It is free.</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-[1.125rem] gap-y-1.5 md:pt-1">
        <ButtonLink href={`/claim/${supplier.slug}`} className="max-md:px-4" data-testid="claim-cta">
          <span className="md:hidden">Claim page</span>
          <span className="max-md:hidden">Claim this page</span>
        </ButtonLink>
        <span className="max-md:hidden">{flag}</span>
      </div>
    </section>
  );
}

export function SupplierStats({ supplier, openTenders }: { supplier: SupplierRecord; openTenders: number }) {
  const since = supplier.firstAwardAt ? new Date(supplier.firstAwardAt).getUTCFullYear() : null;
  const awarded = supplier.totalValue > 0 ? formatMoneyShort(supplier.totalValue) : null;
  const single = supplier.awardsCount === 1;
  return (
    <StatRow
      label="Summary"
      stats={[
        {
          value: supplier.awardsCount.toLocaleString("en-GB"),
          label: `public ${single ? "contract" : "contracts"} won${since ? ` since ${since}` : ""}`,
          phoneLabel: single ? "contract won" : "contracts won",
        },
        { value: awarded ?? "—", label: awarded ? "total awarded value" : "no award value published for this company alone", phoneLabel: awarded ? "awarded in total" : "value not published" },
        { value: supplier.buyersCount.toLocaleString("en-GB"), label: supplier.buyersCount === 1 ? "public buyer" : "public buyers" },
        { value: openTenders.toLocaleString("en-GB"), label: `open ${openTenders === 1 ? "tender" : "tenders"} like your past work`, phoneLabel: `open ${openTenders === 1 ? "tender" : "tenders"} like yours` },
      ]}
    />
  );
}

export function SupplierAnchors({ data }: { data: SupplierPageData }) {
  return (
    <AnchorNav
      items={[
        { href: "#open-tenders", label: "Open tenders", count: data.matches.total },
        { href: "#wins", label: "Your wins", count: data.supplier.awardsCount },
        {
          href: "#rivals",
          label: (
            <span>
              <span className="md:hidden">Rivals</span>
              <span className="max-md:hidden">Rival contracts ending</span>
            </span>
          ),
          count: data.endingSoon.total,
        },
        {
          href: "#buyers",
          label: (
            <span>
              Buyers<span className="max-md:hidden"> in your trade</span>
            </span>
          ),
          count: data.buyers.total,
        },
      ]}
    />
  );
}

type MoreProps = { hidden: number; noun: [string, string]; claimed: boolean; slug: string };

/** The same line as the foot of a list card, or nothing when the list is complete. */
function more(props: MoreProps): ReactNode {
  return props.hidden > 0 ? <More {...props} className="py-2.5" /> : null;
}

/** "4 more open tenders like these. Claim this page to see them all": what an unclaimed page counts instead of showing. `noun` is [singular, plural]. */
function More({ hidden, noun, claimed, slug, className }: MoreProps & { className?: string }) {
  if (hidden <= 0) return null;
  return (
    <p className={cn("text-sm text-ink-2", className)} data-testid="more-count">
      {hidden.toLocaleString("en-GB")} more {hidden === 1 ? noun[0] : noun[1]}.{" "}
      {claimed ? (
        <Link href="/app" className="link font-medium">
          See them all in your radar
        </Link>
      ) : (
        <Link href={`/claim/${slug}`} className="link font-medium">
          Claim this page to see them all
        </Link>
      )}
    </p>
  );
}

export function OpenTendersSection({ data, now, signedIn, claimed }: { data: SupplierPageData; now: Date; signedIn: boolean; claimed: boolean }) {
  const { matches, supplier } = data;
  return (
    <section aria-labelledby="open-tenders" className="flex flex-col gap-4 md:gap-[1.125rem]">
      <SectionHead id="open-tenders" title="Open tenders like your past work" note={matches.items.length > 0 ? "Matched on category, buyer and region. Soonest deadline first." : undefined} />
      {matches.items.length > 0 ? (
        <>
          <div className={tenderListFrameClasses}>
            <ul aria-label="Open tenders like your past work" className={tenderListClasses}>
              {matches.items.map((item) => (
                <li key={item.ocid} className={tenderListItemClasses}>
                  <MatchRow
                    item={item}
                    now={now}
                    href={`/tenders/${item.ocid}`}
                    typeAs="text"
                    chips="wrap"
                    compactActions
                    refAsLink={false}
                    actions={
                      <>
                        <ButtonLink variant="outline" href={bidCheckHrefFor(item.ocid, signedIn)} className="flex-1 text-15 @2xl:flex-none @2xl:text-sm">
                          Start a bid check
                        </ButtonLink>
                        <SourceLink href={item.noticeUrl} className="@2xl:min-h-9 @2xl:justify-center @2xl:text-13" />
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
          <More hidden={matches.total - matches.items.length} noun={["open tender like these", "open tenders like these"]} claimed={claimed} slug={supplier.slug} />
          <ActionBand
            title="Decided to bid on one of these?"
            actions={
              <>
                <ButtonLink href={FREE_BID_CHECK_HREF} className="max-md:w-full" data-testid="free-check-cta">
                  Get a free cited bid check
                </ButtonLink>
                <Link href={SAMPLE_CHECK_HREF} className="link inline-flex min-h-11 items-center justify-center rounded-sm text-sm font-medium">
                  See a sample check
                </Link>
              </>
            }
          >
            Upload the tender pack for a cited bid check: every requirement quoted and cited, checked against your company, with a plain verdict<span className="max-md:hidden"> on whether you can comply</span>. Your first check is free.
          </ActionBand>
        </>
      ) : (
        <EmptyState
          headingLevel="h3"
          title="No open tenders match your past work right now"
          actions={
            <>
              <ButtonLink href={claimed ? "/app" : `/claim/${supplier.slug}`} className="max-md:w-full">
                {claimed ? "Open your radar" : "Claim this page"}
              </ButtonLink>
              <Link href={SAMPLE_CHECK_HREF} className="link inline-flex min-h-11 items-center rounded-sm text-15 font-medium">
                See a sample check
              </Link>
            </>
          }
        >
          {supplier.awardsCount === 1
            ? "One published contract says little about the work a company does, so only a tender in the very same category counts as a match. Claim the page and tick your trades to widen it; new notices are checked every day."
            : "New tender notices are published every working day and checked against this record. Claim the page and a weekly digest tells you when one appears."}
        </EmptyState>
      )}
    </section>
  );
}

export function WinsSection({
  supplier,
  wins,
  now,
  showingAll,
  page,
}: {
  supplier: SupplierRecord;
  wins: Block<ContractRow>;
  now: Date;
  /** "Show all" has been opened: `wins` is a page of fifty. */
  showingAll: boolean;
  page: number;
}) {
  const pages = Math.max(1, Math.ceil(wins.total / procurementConfig.publicWinsPageSize));
  const base = `/suppliers/${supplier.slug}`;
  const pageHref = (target: number) => `${base}?wins=${target <= 1 ? "all" : target}#wins`;
  const phonePreview = procurementConfig.publicWinsPhonePreview;
  const showAll = (
    <Link href={`${base}?wins=all#wins`} scroll={false} className="link inline-flex min-h-11 items-center rounded-sm text-sm font-medium" data-testid="wins-show-all">
      Show all {pluralise(wins.total, "contract")}
    </Link>
  );
  const recentOnly = (
    <Link href={`${base}#wins`} scroll={false} className="link inline-flex min-h-11 items-center rounded-sm text-sm font-medium">
      Show the most recent only
    </Link>
  );
  let foot: ReactNode = null;
  /* A phone previews fewer rows than the table, so it may need the link where a desk does not. */
  let phoneFoot: ReactNode = null;
  if (!showingAll && wins.total > wins.items.length) {
    foot = showAll;
  } else if (!showingAll && wins.total > phonePreview) {
    phoneFoot = showAll;
  } else if (showingAll && pages > 1) {
    foot = (
      <div className="flex w-full flex-wrap items-center justify-between gap-x-4">
        <span className="tabular-nums">
          Page {page} of {pages}
        </span>
        <Pagination className="w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href={pageHref(page - 1)} disabled={page <= 1} />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href={pageHref(page + 1)} disabled={page >= pages} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  } else if (showingAll && wins.total > procurementConfig.publicWinsPreview) {
    foot = recentOnly;
  } else if (showingAll && wins.total > phonePreview) {
    phoneFoot = recentOnly;
  }
  return (
    <section aria-labelledby="wins" className="flex flex-col gap-4 md:gap-[1.125rem]">
      <SectionHead id="wins" title={supplier.awardsCount === 1 ? "Your contract win" : "Your contract wins"} note="From contract award notices that name your company. Most recent first." />
      {wins.items.length > 0 ? (
        <ContractWins items={wins.items} now={now} foot={foot} phoneLimit={showingAll ? undefined : phonePreview} phoneFoot={phoneFoot} caption={`Contract awards published for ${supplier.name}`} />
      ) : (
        <EmptyState headingLevel="h3" title="No contract award is currently published for this company">
          An award notice may have been withdrawn or corrected by the buyer since this page was built.
        </EmptyState>
      )}
    </section>
  );
}

export function RivalsSection({ data, now, claimed }: { data: SupplierPageData; now: Date; claimed: boolean }) {
  const { endingSoon, supplier } = data;
  return (
    <section aria-labelledby="rivals" className="flex flex-col gap-4 md:gap-[1.125rem]">
      <SectionHead
        id="rivals"
        title="Rival contracts ending soon"
        note={`Work like yours, held by someone else, with a stated end date within ${PUBLIC_ENDING_MONTHS} months. Expect a new tender before each one.`}
      />
      {endingSoon.items.length > 0 ? (
        <>
          <EndingContracts
            items={endingSoon.items}
            now={now}
            foot={more({ hidden: endingSoon.total - endingSoon.items.length, noun: ["contract ending soon", "contracts ending soon"], claimed, slug: supplier.slug })}
          />
        </>
      ) : (
        <EmptyState headingLevel="h3" title={`No rival contract in this trade has a stated end date in the next ${PUBLIC_ENDING_MONTHS} months`}>
          End dates come from contract award notices; many notices state none.
        </EmptyState>
      )}
    </section>
  );
}

export function BuyersSection({ data, claimed }: { data: SupplierPageData; claimed: boolean }) {
  const { buyers, supplier } = data;
  const years = PUBLIC_BUYERS_MONTHS / 12;
  const span = years === 1 ? "year" : `${["", "", "two", "three", "four", "five"][years] ?? years} years`;
  return (
    <section aria-labelledby="buyers" className="flex flex-col gap-4 md:gap-[1.125rem]">
      <SectionHead id="buyers" title="Buyers in your trade" note={`Public bodies that awarded work like yours in the last ${span}, your regions first.`} />
      {buyers.items.length > 0 ? (
        <>
          <BuyersInTrade items={buyers.items} foot={more({ hidden: buyers.total - buyers.items.length, noun: ["buyer in this trade", "buyers in this trade"], claimed, slug: supplier.slug })} />
        </>
      ) : (
        <EmptyState headingLevel="h3" title="No other awards in this trade have been published yet">
          Counts come from contract award notices on Find a Tender.
        </EmptyState>
      )}
    </section>
  );
}

/** The sections of the page, in order, with the artboards' rhythm between them. */
export function SupplierSections({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-10 md:gap-14", className)}>{children}</div>;
}
