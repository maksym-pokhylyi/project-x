import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { DeadlineMarker } from "@/components/ui/deadline-marker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { describeClosing, formatDate, formatMonth, formatTerm, pluralise } from "../domain/format";
import { bidCheckHrefFor } from "../domain/links";
import { reasonChips } from "../domain/reasons";
import { areaLabel, regionLabel } from "../domain/regions";
import type { ContractRow } from "../queries/contracts";
import type { MatchItem } from "../queries/matches";
import type { TenderDetail } from "../queries/notices";
import { placeOf } from "./match-row";
import { Closes, Money, NoticeRef, NoticeTypeChip, SourceLink } from "./notice-bits";
import { SaveButton } from "./save-button";
import { CategoryChip, CategoryChipList } from "@/components/ui/category-chip";
import { KeyFacts, type KeyFact } from "@/components/ui/key-facts";
import { ListCard } from "@/components/ui/list-card";
import { QuoteCard } from "@/components/ui/quote-card";
import { BookmarkIcon } from "@/components/ui/save-toggle";
import { SectionHead } from "@/components/ui/section-head";

/**
 * One procurement, as the Tender and TenderSignedIn artboards draw it — the same view on
 * the public page and inside the app:
 *
 *   head     kind of notice · reference · title · buyer
 *   side     the dates (closing date first), the key facts and the actions, in one card
 *            (two cards on phones, where it sits right under the title)
 *   body     categories and regions · the buyer's own description, quoted · and, for a
 *            signed-in workspace with a radar: why this matches it and who won similar
 *            work from this buyer
 *
 * "Open the official notice on Find a Tender" is always there: never behind sign-up, a plan
 * or the state of the tender. Everything shown is read from notices; a fact the notice does
 * not give is said to be missing, in words.
 */
export type TenderViewer =
  | { kind: "visitor" }
  | {
      kind: "member";
      saved: boolean;
      /** How the workspace's radar matches this procurement; null when it has no radar or the tender is not a match. */
      match: MatchItem | null;
      /** Contracts the same buyer awarded for similar work; empty leaves the section out. */
      similar: ContractRow[];
      /** Suppliers the workspace has claimed: their rows are marked "You". */
      ownSupplierIds: string[];
    };

/** The buyer's description as paragraphs; a very long one is cut at twelve (the official notice has the rest). */
function paragraphsOf(text: string): string[] {
  return text
    .split(/\n{2,}|\n(?=[•\-–\d])/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function You() {
  return (
    <Badge variant="secondary" className="ml-1 align-middle">
      You
    </Badge>
  );
}

function places(tender: TenderDetail): string[] {
  const areas = [...new Set(tender.regionCodes.map((code) => areaLabel(code)).filter((label): label is string => Boolean(label)))];
  if (areas.length > 0 && areas.length <= 6 && tender.regionCodes.every((code) => areaLabel(code))) return areas;
  return [...new Set(tender.regions.map((code) => regionLabel(code)).filter((label): label is string => Boolean(label)))];
}

function facts(tender: TenderDetail): KeyFact[] {
  const term = formatTerm(tender.contractStart, tender.contractEnd);
  const period =
    tender.contractStart && tender.contractEnd ? `${formatDate(tender.contractStart)} to ${formatDate(tender.contractEnd)}${term ? ` (${term})` : ""}` : tender.contractStart ? `From ${formatDate(tender.contractStart)}` : null;
  const lotTitles = tender.lots.map((lot) => lot.title).filter((title): title is string => Boolean(title));
  const winners = tender.winners.map((winner) => winner.name);
  return [
    {
      label: "Estimated value",
      value:
        tender.valueAmount !== null ? (
          <>
            <Money amount={tender.valueAmount} currency={tender.currency} className="font-semibold" />, {tender.valueBasis === "gross" ? "including VAT" : "excluding VAT"}
          </>
        ) : (
          <span className="text-ink-2">Value not published</span>
        ),
    },
    { label: "Contract term", value: period ?? <span className="text-ink-2">Not stated in the notice</span> },
    {
      label: "Lots",
      value:
        tender.lotsCount <= 1 ? (
          "Not divided into lots"
        ) : (
          <>
            {pluralise(tender.lotsCount, "lot")}
            {/* The first three by name, one to a line; a tender with many lots says how many more the notice has. */}
            {lotTitles.length > 0 ? (
              <span className="flex flex-col gap-0.5 pt-0.5 text-sm text-ink-2">
                {lotTitles.slice(0, 3).map((title, index) => (
                  <span key={index}>{title}</span>
                ))}
                {tender.lotsCount > Math.min(3, lotTitles.length) ? <span>and {tender.lotsCount - Math.min(3, lotTitles.length)} more in the official notice</span> : null}
              </span>
            ) : null}
          </>
        ),
    },
    { label: "Procedure", value: tender.procedure },
    { label: "Awarded to", value: winners.length > 0 ? `${winners.slice(0, 3).join(", ")}${winners.length > 3 ? ` and ${winners.length - 3} more` : ""}` : null },
  ];
}

function Dates({ tender, now }: { tender: TenderDetail; now: Date }) {
  const questions = tender.enquiryDeadlineAt ? describeClosing(tender.enquiryDeadlineAt, now) : null;
  const engagement = tender.stage === "planning" && tender.engagementDeadlineAt ? describeClosing(tender.engagementDeadlineAt, now) : null;
  const items: Array<{ label: string; value: ReactNode }> = [];
  if (questions && questions.dateTime) {
    items.push({
      label: "Questions to the buyer by",
      value: (
        <DeadlineMarker size="lg" closed={questions.state === "closed"} left={questions.left ?? undefined} className="max-lg:text-sm">
          <time dateTime={questions.iso ?? undefined}>{questions.dateTime}</time>
        </DeadlineMarker>
      ),
    });
  }
  if (engagement && engagement.dateTime) {
    items.push({
      label: "Market engagement closes",
      value: (
        <DeadlineMarker size="lg" closed={engagement.state === "closed"} left={engagement.left ?? undefined} className="max-lg:text-sm">
          <time dateTime={engagement.iso ?? undefined}>{engagement.dateTime}</time>
        </DeadlineMarker>
      ),
    });
  }
  items.push({ label: "Published", value: <span className="text-sm text-ink tabular-nums lg:text-15">{formatDate(tender.publishedAt)}</span> });
  return (
    <ul aria-label="Other dates" className="flex flex-col divide-y divide-line border-t border-line lg:order-2 lg:mx-5.5">
      {items.map((item) => (
        <li key={item.label} className="flex flex-col gap-0.5 px-4 py-3 lg:px-0">
          <span className="text-13 text-ink-2">{item.label}</span>
          {item.value}
        </li>
      ))}
    </ul>
  );
}

function Actions({ tender, viewer }: { tender: TenderDetail; viewer: TenderViewer }) {
  const member = viewer.kind === "member";
  return (
    <div className="flex flex-col gap-1 px-4 pb-2.5 lg:order-4 lg:border-t lg:border-line lg:px-5.5 lg:pt-5 lg:pb-3" data-testid="tender-actions">
      <div className="flex items-center gap-2">
        {tender.isLive ? (
          <ButtonLink href={bidCheckHrefFor(tender.ocid, member)} className="flex-1" data-testid="start-bid-check">
            Start a bid check
          </ButtonLink>
        ) : null}
        {member ? (
          <SaveButton ocid={tender.ocid} saved={viewer.saved} className={tender.isLive ? "px-4" : "flex-1 px-4"} />
        ) : (
          <ButtonLink variant="outline" href={`/sign-up?next=${encodeURIComponent(`/app/tenders/${tender.ocid}`)}`} className={cn("gap-1.5 px-4 text-sm", !tender.isLive && "flex-1")}>
            <BookmarkIcon pressed={false} />
            Save
          </ButtonLink>
        )}
      </div>
      <p className="flex flex-wrap items-center gap-x-2.5">
        <SourceLink href={tender.noticeUrl} label="Open the official notice on Find a Tender" icon />
        <span className="text-13 text-ink-2">Always free.</span>
      </p>
    </div>
  );
}

function Side({ tender, now, viewer }: { tender: TenderDetail; now: Date; viewer: TenderViewer }) {
  const expected = formatMonth(tender.futureNoticeAt);
  return (
    <section aria-label="Dates, key facts and actions" className="flex flex-col gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:gap-0 lg:self-start lg:rounded-card lg:border lg:border-line lg:bg-surface" data-testid="tender-side">
      <div className="flex flex-col rounded-card border border-line bg-surface lg:contents">
        <div className="px-4 pt-4 pb-3.5 lg:order-1 lg:px-5.5 lg:pt-5">
          {tender.stage === "planning" ? (
            <div className="flex flex-col gap-0.5" data-testid="deadline" data-state="planned">
              <span className="text-13 text-ink-2">Expected to be published</span>
              <span className={cn(expected ? "type-figure text-3xl text-ink" : "text-sm text-ink-2")}>{expected ?? "No date given in the notice"}</span>
              <span className="text-sm text-ink-2">The buyer’s own estimate; it can move.</span>
            </div>
          ) : tender.stage === "tender" ? (
            <Closes deadline={tender.deadlineAt} now={now} form="figure" />
          ) : (
            <div className="flex flex-col gap-0.5" data-testid="deadline" data-state="awarded">
              <span className="text-13 text-ink-2">Status</span>
              <span className="text-17 font-semibold text-ink">{tender.stage === "award" ? "Awarded" : "Not open for bids"}</span>
            </div>
          )}
        </div>
        <Actions tender={tender} viewer={viewer} />
        <Dates tender={tender} now={now} />
      </div>
      <div className="rounded-card border border-line bg-surface p-4 lg:order-3 lg:rounded-none lg:border-0 lg:border-t lg:p-5.5">
        <KeyFacts items={facts(tender)} />
      </div>
    </section>
  );
}

function Why({ match }: { match: MatchItem }) {
  const chips = reasonChips(match.facts);
  const place = placeOf(match);
  const rows: Array<{ key: string; chip: ReactNode; text: ReactNode }> = [];
  for (const chip of chips) {
    if (chip.kind === "buyer") {
      rows.push({
        key: chip.kind,
        chip: <Badge variant="brand">{chip.label}</Badge>,
        text: match.facts.buyerContracts.map((contract, index) => (
          <span key={index}>
            {index > 0 ? " · " : null}
            {contract.title}
            {contract.valueAmount !== null ? (
              <>
                , <Money amount={contract.valueAmount} exact />
              </>
            ) : null}
            , {contract.year}
          </span>
        )),
      });
    } else if (chip.kind === "work") {
      const labels = match.facts.sameWorkLabels;
      rows.push({ key: chip.kind, chip: <Badge variant="secondary">{chip.label}</Badge>, text: labels.length > 0 ? labels.join(", ").replace(/^./, (first) => first.toUpperCase()) : "The same category as contracts you have won" });
    } else if (chip.kind === "new_buyer") {
      rows.push({ key: chip.kind, chip: <Badge variant="secondary">{chip.label}</Badge>, text: "None of your published contracts came from this buyer" });
    } else if (chip.kind === "trade") {
      rows.push({ key: chip.kind, chip: <Badge variant="secondary">{chip.label}</Badge>, text: "One of the trades on your radar" });
    } else {
      rows.push({ key: chip.kind, chip: <Badge variant="secondary">{chip.label}</Badge>, text: "A keyword on your radar, found in the title" });
    }
  }
  if (place.label) {
    const where =
      match.breakdown.regionMatch === "local"
        ? "One of your regions"
        : match.breakdown.regionMatch === "nationwide"
          ? "Open to suppliers across the UK"
          : match.breakdown.regionMatch === "elsewhere"
            ? "Outside the regions on your radar"
            : "The notice does not say where the work is";
    rows.push({ key: "place", chip: <Badge variant="secondary">{place.label}</Badge>, text: place.note ? `${where} (${place.note})` : where });
  }
  if (match.tier === "wider") {
    rows.push({ key: "wider", chip: <Badge variant="outline">Wider match</Badge>, text: "Not your own line of work or regions: a neighbouring category, a broader code or a keyword. It is not counted among your matches." });
  }
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="why-h" className="flex flex-col gap-4" data-testid="why-matches">
      <SectionHead id="why-h" title="Why this matches you" />
      <ListCard aria-label="Why this matches you">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-x-6 gap-y-1.5 px-4 py-3.5 md:flex-row md:items-baseline md:px-6 md:py-4">
            <div className="flex md:w-[18.125rem] md:shrink-0">{row.chip}</div>
            <p className="min-w-0 flex-1 text-sm text-ink tabular-nums">{row.text}</p>
          </li>
        ))}
      </ListCard>
    </section>
  );
}

function Similar({ items, ownSupplierIds }: { items: ContractRow[]; ownSupplierIds: string[] }) {
  if (items.length === 0) return null;
  const own = new Set(ownSupplierIds);
  return (
    <section aria-labelledby="similar-h" className="flex flex-col gap-4" data-testid="similar-awards">
      <SectionHead id="similar-h" title="Who won similar work from this buyer" />
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <Table className="max-md:hidden" aria-label="Similar contracts awarded by this buyer">
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Contract</TableHead>
              <TableHead numeric>Value</TableHead>
              <TableHead>Awarded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((contract) => (
              <TableRow key={`${contract.ocid}:${contract.supplierId}`}>
                <TableCell className="min-w-[13rem] font-semibold text-ink">
                  {contract.supplierLabel}
                  {own.has(contract.supplierId) ? <You /> : null}
                </TableCell>
                <TableCell className="min-w-[12rem]">{contract.title}</TableCell>
                <TableCell numeric>{contract.valueAmount !== null ? <Money amount={contract.valueAmount} exact /> : <span className="text-ink-2">Not published</span>}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(contract.awardedAt) ?? <span className="text-ink-2">Not published</span>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ul aria-label="Similar contracts awarded by this buyer" className="flex flex-col divide-y divide-line md:hidden">
          {items.map((contract) => (
            <li key={`${contract.ocid}:${contract.supplierId}`} className="flex flex-col gap-0.5 px-4 py-3.5">
              <span className="flex items-start justify-between gap-3 text-15 leading-snug font-semibold text-ink">
                <span className="min-w-0 [overflow-wrap:anywhere]">{contract.supplierLabel}</span>
                {own.has(contract.supplierId) ? <You /> : null}
              </span>
              <span className="text-13 text-ink-2">{contract.title}</span>
              <span className="pt-0.5 text-13 text-ink tabular-nums">
                {contract.valueAmount !== null ? <Money amount={contract.valueAmount} exact className="font-semibold" /> : "Value not published"}
                {contract.awardedAt ? ` · awarded ${formatDate(contract.awardedAt)}` : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-13 text-ink-2">From contract award notices on Find a Tender, last five years.</p>
    </section>
  );
}

export function TenderView({ tender, now, viewer, before, after }: { tender: TenderDetail; now: Date; viewer: TenderViewer; /** Above the head: the way back. */ before?: ReactNode; /** Under the body: the page's own band. */ after?: ReactNode }) {
  const where = places(tender);
  return (
    <div className="flex flex-col" data-testid="tender-detail">
      {before}
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,28.75rem)] lg:grid-rows-[auto_1fr] lg:gap-y-2.5">
        <header className="flex min-w-0 flex-col gap-2.5 lg:col-start-1 lg:row-start-1 lg:gap-3">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <NoticeTypeChip notice={tender} />
            <NoticeRef id={tender.releaseId} className="lg:text-13" />
          </p>
          <h1 className="type-title text-ink [overflow-wrap:anywhere]">{tender.title}</h1>
          <p className="text-15 text-ink lg:text-17">
            <span className="block text-13 text-ink-2 lg:mr-1.5 lg:inline lg:text-sm">Buyer</span>
            {tender.buyerSlug ? (
              <Link href={`/buyers/${tender.buyerSlug}`} className="link-quiet font-semibold">
                {tender.buyerName}
              </Link>
            ) : (
              <span className="font-semibold">{tender.buyerName ?? "Not named in the notice"}</span>
            )}
          </p>
        </header>

        <Side tender={tender} now={now} viewer={viewer} />

        <div className="flex min-w-0 flex-col gap-10 lg:col-start-1 lg:row-start-2 lg:gap-12">
          <dl className="flex flex-col gap-2.5 max-lg:pt-1">
            {tender.cpv.length > 0 ? (
              <div className="flex flex-col gap-x-3 gap-y-1.5 lg:flex-row">
                <dt className="text-13 text-ink-2 lg:w-[5.25rem] lg:shrink-0 lg:pt-1">Categories</dt>
                <dd className="min-w-0 flex-1">
                  <CategoryChipList label="Categories">
                    {tender.cpv.slice(0, 8).map((entry) => (
                      <li key={entry.code}>
                        <CategoryChip code={entry.code}>{entry.label ?? "Category"}</CategoryChip>
                      </li>
                    ))}
                    {tender.cpv.length > 8 ? (
                      <li>
                        <CategoryChip>and {tender.cpv.length - 8} more</CategoryChip>
                      </li>
                    ) : null}
                  </CategoryChipList>
                </dd>
              </div>
            ) : null}
            <div className="flex flex-col gap-x-3 gap-y-1.5 lg:flex-row">
              <dt className="text-13 text-ink-2 lg:w-[5.25rem] lg:shrink-0 lg:pt-1">Regions</dt>
              <dd className="min-w-0 flex-1">
                {where.length > 0 ? (
                  <CategoryChipList label="Regions">
                    {where.map((label) => (
                      <li key={label}>
                        <CategoryChip>{label}</CategoryChip>
                      </li>
                    ))}
                  </CategoryChipList>
                ) : (
                  <span className="text-sm text-ink-2">No place of delivery given in the notice</span>
                )}
              </dd>
            </div>
          </dl>

          <section aria-labelledby="desc-h" className="flex flex-col gap-4">
            <SectionHead id="desc-h" title="The buyer’s description" />
            {tender.description ? (
              <QuoteCard paragraphs={paragraphsOf(tender.description)} caption="From the notice on Find a Tender. Read the full documents before you rely on it." />
            ) : (
              <p className="rounded-card border border-line bg-surface p-5 text-15 text-ink-2 md:px-7 md:py-6">The notice gives no description. Open the official notice for the documents.</p>
            )}
          </section>

          {viewer.kind === "member" && viewer.match ? <Why match={viewer.match} /> : null}
          {viewer.kind === "member" ? <Similar items={viewer.similar} ownSupplierIds={viewer.ownSupplierIds} /> : null}
        </div>
      </div>
      {after}
    </div>
  );
}
