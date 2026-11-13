import Link from "next/link";
import type { ReactNode } from "react";
import { formatDate, formatDateTime } from "../domain/format";
import { NOTICE_TYPES } from "../domain/notice-types";
import { regionsLabel } from "../domain/regions";
import type { TenderDetail } from "../queries/notices";
import { competitionLabel } from "./lists";
import { DeadlineChip, Money, NoticeBadge, SourceLink } from "./primitives";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t py-3 sm:grid sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm sm:mt-0">{children}</dd>
    </div>
  );
}

function noticeName(noticeType: string | null, stage: string): string {
  if (noticeType && NOTICE_TYPES[noticeType]) return NOTICE_TYPES[noticeType].officialName;
  return stage === "award" ? "Contract award notice" : stage === "planning" ? "Prior information notice" : "Contract notice";
}

/**
 * Body of a tender page, shared by the public page and the in-app detail. `actions` holds
 * the calls to action of the surrounding page; the Find a Tender link is part of this
 * component and therefore always present.
 */
export function TenderDetailView({ tender, now, actions }: { tender: TenderDetail; now: Date; actions?: ReactNode }) {
  const criteria = tender.awardCriteria?.criteria ?? [];
  const paragraphs = (tender.description ?? "").split(/\n{2,}|\n(?=[•\-–\d])/).map((text) => text.trim()).filter(Boolean).slice(0, 40);
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <NoticeBadge notice={tender} />
          {tender.stage === "tender" ? <DeadlineChip deadline={tender.deadlineAt} now={now} /> : null}
        </div>
        <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{tender.title}</h1>
        <p className="text-sm text-muted-foreground">
          {tender.buyerSlug ? (
            <Link href={`/buyers/${tender.buyerSlug}`} className="font-medium text-foreground underline-offset-4 hover:underline">
              {tender.buyerName}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{tender.buyerName ?? "Buyer not stated"}</span>
          )}{" "}
          · published {formatDate(tender.publishedAt)}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {actions}
          <SourceLink href={tender.noticeUrl} label="View the full notice on Find a Tender" />
        </div>
      </header>

      <dl aria-label="Key facts" className="border-b">
        {tender.stage === "tender" ? (
          <Fact label="Deadline">{tender.deadlineAt ? formatDateTime(tender.deadlineAt) : "Not published"}{tender.enquiryDeadlineAt ? ` · questions by ${formatDateTime(tender.enquiryDeadlineAt)}` : ""}</Fact>
        ) : null}
        {tender.stage === "planning" && tender.futureNoticeAt ? <Fact label="Tender expected">{formatDate(tender.futureNoticeAt)}</Fact> : null}
        {tender.stage === "planning" && tender.engagementDeadlineAt ? <Fact label="Market engagement until">{formatDate(tender.engagementDeadlineAt)}</Fact> : null}
        <Fact label={tender.stage === "award" ? "Contract value" : "Estimated value"}>
          <Money amount={tender.valueAmount} currency={tender.currency} />
          {tender.valueAmount ? <span className="text-muted-foreground"> excluding VAT where stated</span> : null}
        </Fact>
        <Fact label="Procedure">
          {tender.procedure ?? competitionLabel(tender.competition)}
          {tender.aboveThreshold === false ? " · below threshold" : tender.aboveThreshold === true ? " · above threshold" : ""}
          {tender.isFramework ? " · sets up a framework" : ""}
        </Fact>
        {tender.contractStart || tender.contractEnd ? (
          <Fact label="Contract dates">
            {formatDate(tender.contractStart) ?? "Start not stated"} to {formatDate(tender.contractEnd) ?? "end not stated"}
          </Fact>
        ) : null}
        {regionsLabel(tender.regions) ? <Fact label="Where">{regionsLabel(tender.regions)}{tender.regionSource === "buyer" ? " (buyer's location)" : ""}</Fact> : null}
        {tender.cpv.length > 0 ? (
          <Fact label="Categories (CPV)">
            <ul className="space-y-0.5">
              {tender.cpv.slice(0, 8).map((entry) => (
                <li key={entry.code}>
                  <span className="font-mono text-xs text-muted-foreground">{entry.code}</span> {entry.label ?? ""}
                </li>
              ))}
              {tender.cpv.length > 8 ? <li className="text-muted-foreground">and {tender.cpv.length - 8} more</li> : null}
            </ul>
          </Fact>
        ) : null}
        {tender.lotsCount > 1 ? (
          <Fact label="Lots">
            {tender.lotsCount} lots
            {tender.lots.some((lot) => lot.title) ? (
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {tender.lots.filter((lot) => lot.title).slice(0, 10).map((lot) => (
                  <li key={lot.id}>
                    {lot.title}
                    {lot.value ? (
                      <>
                        {" "}
                        — <Money amount={lot.value} />
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </Fact>
        ) : null}
        {tender.smeSuitable ? <Fact label="Small businesses">The buyer marks this as suitable for SMEs.</Fact> : null}
        {criteria.length > 0 || tender.awardCriteria?.description ? (
          <Fact label="Award criteria">
            {criteria.length > 0 ? (
              <ul className="space-y-0.5">
                {criteria.map((criterion, index) => (
                  <li key={`${criterion.name}-${index}`} className="flex justify-between gap-4">
                    <span>
                      {criterion.name ?? "Criterion"} {criterion.type ? <span className="text-muted-foreground">({criterion.type})</span> : null}
                    </span>
                    {criterion.weight !== null ? <span className="tabular-nums">{criterion.weight}%</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {tender.awardCriteria?.description ? <p className="mt-1 whitespace-pre-line text-muted-foreground">{tender.awardCriteria.description}</p> : null}
          </Fact>
        ) : null}
        {tender.winners.length > 0 ? (
          <Fact label={tender.winners.length === 1 ? "Awarded to" : "Suppliers"}>
            <ul className="space-y-0.5">
              {tender.winners.slice(0, 12).map((winner, index) => (
                <li key={`${winner.name}-${index}`}>
                  {winner.slug ? (
                    <Link href={`/suppliers/${winner.slug}`} className="underline-offset-4 hover:underline">
                      {winner.name}
                    </Link>
                  ) : (
                    winner.name
                  )}
                </li>
              ))}
              {tender.winners.length > 12 ? <li className="text-muted-foreground">and {tender.winners.length - 12} more</li> : null}
            </ul>
          </Fact>
        ) : null}
      </dl>

      {paragraphs.length > 0 ? (
        <section aria-labelledby="description" className="space-y-3">
          <h2 id="description" className="text-lg font-semibold tracking-tight">
            Description
          </h2>
          <div className="max-w-[68ch] space-y-3 text-sm leading-6">
            {paragraphs.map((text, index) => (
              <p key={index} className="whitespace-pre-line break-words">
                {text}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {tender.history.length > 1 ? (
        <section aria-labelledby="history" className="space-y-3">
          <h2 id="history" className="text-lg font-semibold tracking-tight">
            Notices for this procurement
          </h2>
          <ol className="divide-y rounded-lg border text-sm">
            {tender.history.map((entry) => (
              <li key={entry.releaseId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2">
                <span>
                  <span className="tabular-nums text-muted-foreground">{formatDate(entry.publishedAt)}</span> · {noticeName(entry.noticeType, entry.stage)}
                  {entry.isUpdate ? " (update)" : ""}
                </span>
                <SourceLink href={entry.noticeUrl} label={entry.releaseId} className="min-h-0 font-mono text-xs" />
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
