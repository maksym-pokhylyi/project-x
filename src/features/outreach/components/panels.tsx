import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NAMED_ADDRESSES_BLOCKED, outreachConfig } from "../config";
import { describeShare, type FunnelReading, type LineState } from "../domain/funnel";
import { EXCLUSION_LABELS, EXCLUSION_ORDER, reasonLabel, type ExclusionKey } from "../domain/select";
import type { AuditRow } from "../server/campaigns";
import type { OutreachResults } from "../server/results";

const docLink = (path: string) => `${outreachConfig.docs.base}${path}`;
const number = (value: number) => value.toLocaleString("en-GB");

/** Where a page under the outreach section sits: "Outreach / Week one". */
export function OutreachCrumbs({ current }: { current: string }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/admin/outreach">Outreach</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * Shown on the builder while no UK representative is configured (UK GDPR Art. 27): named
 * addresses are switched off in the form and refused by the server (buildSelection).
 */
export function NamedAddressesNotice() {
  return (
    <Alert variant="destructive" role="note" data-testid="named-addresses-blocked">
      <AlertTitle>{NAMED_ADDRESSES_BLOCKED}</AlertTitle>
      <AlertDescription>
        <p>
          A named address is personal data, and an operator outside the UK needs a UK representative before writing to one (UK GDPR Art. 27). Until one is set in{" "}
          <code>site.operator.ukRepresentative</code>, a list can hold generic mailboxes only, and the letters name no representative.
        </p>
      </AlertDescription>
    </Alert>
  );
}

/**
 * "How to use this lawfully": the rules of docs/gtm/07-compliance-pack.md and P2 §8 that the
 * founder must keep to and that the tool cannot enforce for him. Ten lines at most.
 */
export function LawfulUsePanel() {
  const { start, max } = outreachConfig.dailyVolumePerMailbox;
  return (
    <Card data-testid="lawful-use">
      <CardHeader>
        <CardTitle>How to use this lawfully</CardTitle>
        <CardDescription>The builder applies the first two rules. The rest are yours.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink marker:text-ink-2">
          <li>Only Ltd, PLC and LLP companies with a Companies House number, at an address on their own domain. Never sole traders, partnerships or webmail.</li>
          <li>Generic mailboxes (info@, tenders@) by default. A named address is personal data: write within one month of the day we stored it, its “contact by” date.</li>
          <li>Check that each company is still active at Companies House before you send.</li>
          <li>Send every letter yourself, from your own mailbox: plain text, no tracking pixels, no link shorteners.</li>
          <li>One letter and at most two reminders per company. Any reply ends it.</li>
          <li>
            Start at {start} letters per mailbox per day; never more than {max}.
          </li>
          <li>Never phone, text or message a prospect.</li>
          <li>Honour opt-outs within 24 hours: add “stop” replies, complaints and bounces to Suppressions before the next send.</li>
          <li>Mark each batch as sent the day you send it: that date is the legal record of first contact.</li>
        </ol>
        <p className="mt-4 text-13 text-ink-2">
          Procedures and wording: <a href={docLink(outreachConfig.docs.compliance)}>compliance pack</a>, <a href={docLink(outreachConfig.docs.kit)}>outreach kit</a>,{" "}
          <a href={docLink(outreachConfig.docs.legal)}>legal research</a>.
        </p>
      </CardContent>
    </Card>
  );
}

export type SummaryLike = {
  companiesMatched: number;
  companiesWithoutAddress: number;
  addressesConsidered: number;
  excluded: Record<string, number>;
  notEligibleByReason: Record<string, number>;
  eligibleCompanies: number;
  listed: number;
  listedGeneric: number;
  listedNamed: number;
};

/**
 * Everyone who was left out, by reason. Counts are addresses, and they add up to the number
 * considered. Sits directly inside a <Card> (the table brings its own side padding).
 */
export function ExclusionSummary({ summary }: { summary: SummaryLike }) {
  const reasons = Object.entries(summary.notEligibleByReason).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-col gap-4" data-testid="exclusion-summary">
      <p className="px-6 text-sm text-ink-2">
        {number(summary.companiesMatched)} {summary.companiesMatched === 1 ? "company has" : "companies have"} a matching award; {number(summary.companiesWithoutAddress)} of them{" "}
        {summary.companiesWithoutAddress === 1 ? "has" : "have"} no published contact address. The other notices give {number(summary.addressesConsidered)}{" "}
        {summary.addressesConsidered === 1 ? "address" : "addresses"}. Each address is counted once, under the first rule that removed it.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Outcome</TableHead>
            <TableHead numeric>Addresses</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow data-testid="summary-listed">
            <TableCell className="font-semibold">
              On this list ({number(summary.listedGeneric)} generic, {number(summary.listedNamed)} named)
            </TableCell>
            <TableCell numeric className="font-semibold">
              {number(summary.listed)}
            </TableCell>
          </TableRow>
          {EXCLUSION_ORDER.map((key: ExclusionKey) => (
            <TableRow key={key} data-testid={`excluded-${key}`}>
              <TableCell>
                {EXCLUSION_LABELS[key]}
                {key === "not_eligible" && reasons.length > 0 ? (
                  <ul className="mt-1.5 flex flex-col gap-0.5 text-13 text-ink-2">
                    {reasons.map(([reason, value]) => (
                      <li key={reason} data-testid={`reason-${reason}`}>
                        {number(value)} · {reasonLabel(reason)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </TableCell>
              <TableCell numeric>{number(summary.excluded[key] ?? 0)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const AUDIT_LABELS: Record<string, string> = {
  "campaign.created": "Campaign created",
  "campaign.exported": "Letters exported",
  "campaign.marked_sent": "Marked as sent",
  "campaign.sent_cleared": "Sent date cleared",
  "campaign.discarded": "Campaign discarded",
  "suppression.added": "Added to the do-not-contact list",
  "suppression.imported": "Bounce list imported",
  "suppression.removed": "Removed from the do-not-contact list",
  "suppression.exported": "Do-not-contact list exported",
  "data_request.resolved": "Request closed",
  "retention.erased": "Addresses erased by retention",
};
const AUDIT_LETTERS: Record<string, string> = { first: "first letter", reminder_1: "reminder 1", reminder_2: "reminder 2" };
const AUDIT_TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

/** The non-personal details an entry carries, as a short phrase. Unknown keys are not shown. */
function auditDetail(row: AuditRow): string {
  const data = row.metadata;
  const text = (key: string) => (typeof data[key] === "string" || typeof data[key] === "number" ? String(data[key]) : "");
  const parts: string[] = [];
  if (row.action === "campaign.exported") {
    parts.push(AUDIT_LETTERS[text("letter")] ?? text("letter"));
    if (Number(data.leftOut) > 0) parts.push(`${number(Number(data.leftOut))} left out`);
  } else if (row.action === "campaign.marked_sent") {
    if (text("sentOn")) parts.push(`sent on ${text("sentOn")}`);
    if (Number(data.afterContactBy) > 0) parts.push(`${number(Number(data.afterContactBy))} after the contact-by date`);
  } else if (row.action === "suppression.added" || row.action === "suppression.removed") {
    if (text("domain")) parts.push(data.kind === "domain" ? `the domain ${text("domain")}` : `an address at ${text("domain")}`);
    if (text("reason")) parts.push(text("reason").replace(/_/g, " "));
  } else if (row.action === "data_request.resolved") {
    if (text("action")) parts.push(text("action").replace(/_/g, " "));
  }
  return parts.filter(Boolean).join(" · ");
}

/** The audit trail of the outreach tool: who, when, what and how many — never whom. */
export function AuditTrail({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-ink-2">Nothing has been recorded yet.</p>;
  return (
    <div data-testid="audit-trail">
      <Table framed className="min-w-[44rem]" containerClassName="max-h-[28rem]">
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Who</TableHead>
            <TableHead>What</TableHead>
            <TableHead numeric>Rows</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const detail = auditDetail(row);
            return (
              <TableRow key={row.id} data-testid="audit-row" data-action={row.action}>
                <TableCell className="whitespace-nowrap">
                  <time dateTime={row.at}>{AUDIT_TIME.format(new Date(row.at))}</time>
                </TableCell>
                <TableCell>{row.actor ?? "System"}</TableCell>
                <TableCell>
                  {AUDIT_LABELS[row.action] ?? row.action}
                  {row.campaignId && row.campaignName ? (
                    <>
                      {": "}
                      <Link href={`/admin/outreach/campaigns/${row.campaignId}`} className="link">
                        {row.campaignName}
                      </Link>
                    </>
                  ) : null}
                  {detail ? <p className="mt-0.5 text-13 text-ink-2">{detail}</p> : null}
                </TableCell>
                <TableCell numeric>{number(row.count)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

const VERDICT_LABELS: Record<FunnelReading["verdict"], string> = { too_early: "Too early", pass: "Pass", kill: "Kill", between: "Between", stopped: "Stop" };
const VERDICT_VARIANTS: Record<FunnelReading["verdict"], "info" | "success" | "warning" | "destructive"> = {
  too_early: "info",
  pass: "success",
  between: "warning",
  kill: "destructive",
  stopped: "destructive",
};

/** Where a line of the test stands. A sign and a word, never colour alone; nothing at all when the numbers are too small to judge. */
function LineStateMark({ state }: { state: LineState }) {
  switch (state) {
    case "pass":
      return <StatusPill status="met">Met</StatusPill>;
    case "kill":
      return <StatusPill status="gap">Kill level</StatusPill>;
    case "below":
      return <Badge variant="secondary">Not met</Badge>;
    case "unknown":
      return <StatusPill status="unknown">Not measurable yet</StatusPill>;
    default:
      return (
        <span className="text-ink-2">
          <span aria-hidden>—</span>
          <span className="sr-only">not judged</span>
        </span>
      );
  }
}

/** The funnel against the pass/kill thresholds of the 400-e-mail test, in counts (percentages only from 100 e-mails). */
export function FunnelPanel({ results, title = "Results" }: { results: OutreachResults; title?: string }) {
  const { counts, reading, byKind } = results;
  const { experiment } = outreachConfig;
  return (
    <Card data-testid="funnel-panel">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          The test: of {experiment.emails} e-mails, read {experiment.judgeAfterDays} days after the last one. Pass at {experiment.pass.visits} page visits, {experiment.pass.claims} claims and (
          {experiment.pass.packs} bid checks or {experiment.pass.cardPayments} card payments). Kill below {experiment.kill.visitsBelow} visits or at 0 claims.
          {reading.scaled ? ` Thresholds below are scaled in proportion to the ${number(counts.sent)} sent here.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert variant={VERDICT_VARIANTS[reading.verdict]} role="status" data-testid="funnel-verdict" data-verdict={reading.verdict}>
          <AlertTitle>
            {VERDICT_LABELS[reading.verdict]}: {reading.headline}
          </AlertTitle>
          <AlertDescription>
            <p>{reading.detail}</p>
          </AlertDescription>
        </Alert>
      </CardContent>
      <Table className="min-w-[38rem]">
        <TableHeader>
          <TableRow>
            <TableHead>Step</TableHead>
            <TableHead>Companies</TableHead>
            <TableHead>Threshold</TableHead>
            <TableHead>Now</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow data-testid="funnel-sent">
            <TableCell className="font-semibold">Sent</TableCell>
            <TableCell>{number(counts.sent)}</TableCell>
            <TableCell className="text-ink-2">the test is {experiment.emails}</TableCell>
            <TableCell />
          </TableRow>
          {reading.lines.map((line) => (
            <TableRow key={line.key} data-testid={`funnel-${line.key}`} data-state={line.state}>
              <TableCell className="font-semibold">{line.label}</TableCell>
              <TableCell>{line.value}</TableCell>
              <TableCell className="text-ink-2">{line.target}</TableCell>
              <TableCell>
                <LineStateMark state={line.state} />
              </TableCell>
            </TableRow>
          ))}
          <TableRow data-testid="funnel-optouts">
            <TableCell className="font-semibold">Opted out</TableCell>
            <TableCell>{describeShare(counts.optedOut, counts.sent)}</TableCell>
            <TableCell className="text-ink-2">review the segment above 5%</TableCell>
            <TableCell />
          </TableRow>
          <TableRow data-testid="funnel-bounces">
            <TableCell className="font-semibold">Bounced</TableCell>
            <TableCell>{describeShare(counts.bounced, counts.sent)}</TableCell>
            <TableCell className="text-ink-2">stop above 3% in a day</TableCell>
            <TableCell />
          </TableRow>
          <TableRow data-testid="funnel-complaints">
            <TableCell className="font-semibold">Complaints</TableCell>
            <TableCell>{number(counts.complaints)}</TableCell>
            <TableCell className="text-ink-2">more than {experiment.maxComplaints} ends the test</TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
      <CardContent className="flex flex-col gap-2 text-13 text-ink-2">
        {byKind.named.sent > 0 ? (
          <p data-testid="funnel-by-kind">
            Generic mailboxes: {describeShare(byKind.generic.visited, byKind.generic.sent)} opened, {describeShare(byKind.generic.claimed, byKind.generic.sent)} claimed. Named addresses:{" "}
            {describeShare(byKind.named.visited, byKind.named.sent)} opened, {describeShare(byKind.named.claimed, byKind.named.sent)} claimed. Keep named addresses only if they clearly do better.
          </p>
        ) : null}
        {results.visitedNotMarkedSent > 0 ? (
          <p data-testid="funnel-unmarked">
            {number(results.visitedNotMarkedSent)} {results.visitedNotMarkedSent === 1 ? "company has" : "companies have"} opened a personal link but {results.visitedNotMarkedSent === 1 ? "is" : "are"} not
            marked as sent. Visits count from the day of sending: mark the batch as sent.
          </p>
        ) : null}
        <p>
          A visit is a page request carrying the company’s link code, on or after the day of sending. There is no pixel and no cookie, so mail-security scanners that follow links can add visits:
          read claims as the firmer signal. Below {outreachConfig.percentagesFrom} e-mails only counts are shown.
        </p>
      </CardContent>
    </Card>
  );
}
