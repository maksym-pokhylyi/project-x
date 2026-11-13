import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RETENTION_DAYS } from "@/config/retention";
import { outreachConfig } from "../config";
import { describeShare, type FunnelReading } from "../domain/funnel";
import { EXCLUSION_LABELS, EXCLUSION_ORDER, reasonLabel, type ExclusionKey } from "../domain/select";
import type { OutreachResults } from "../server/results";

const docLink = (path: string) => `${outreachConfig.docs.base}${path}`;

/**
 * "How to use this lawfully": the rules of docs/gtm/07-compliance-pack.md and P2 §8 that the
 * founder must keep to and that the tool cannot enforce for him.
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
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          <li>Write only to incorporated companies (Ltd, PLC, LLP) with a Companies House number, at an address on their own domain. Never to sole traders, partnerships or webmail addresses.</li>
          <li>Generic mailboxes (info@, tenders@) by default. A named address is personal data: the first letter must go within one month of the day we stored it — its “contact by” date.</li>
          <li>Before sending, check each company is still active at Companies House and that the letter matches its page. The builder reads notices, not the live register.</li>
          <li>You send every letter yourself, from your own mailbox on a sending domain. Plain text, no tracking pixels, no link shorteners. This app never sends them.</li>
          <li>One letter and at most two reminders per company, ever. Any reply ends it.</li>
          <li>
            Volume: start at {start} letters per mailbox per day and never go above {max}.
          </li>
          <li>Never phone, text or message a prospect. Our payment provider bans telemarketing outright.</li>
          <li>Honour every opt-out within 24 hours: add “stop” replies, complaints and bounces to Suppressions before the next send, then export again.</li>
          <li>Mark each batch as sent on the day you send it. That date is the legal record of first contact.</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Procedures and wording:{" "}
          <a className="underline underline-offset-4" href={docLink(outreachConfig.docs.compliance)}>
            compliance pack
          </a>
          {" · "}
          <a className="underline underline-offset-4" href={docLink(outreachConfig.docs.kit)}>
            outreach kit
          </a>
          {" · "}
          <a className="underline underline-offset-4" href={docLink(outreachConfig.docs.legal)}>
            legal research (P2)
          </a>
          . Named addresses are erased {RETENTION_DAYS.outreachNamedAddresses} days after sending; every address {RETENTION_DAYS.outreachProspects} days after the campaign.
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

/** Everyone who was left out, by reason. Counts are addresses, and they add up to the number considered. */
export function ExclusionSummary({ summary }: { summary: SummaryLike }) {
  const reasons = Object.entries(summary.notEligibleByReason).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-3" data-testid="exclusion-summary">
      <p className="text-sm text-muted-foreground">
        {summary.companiesMatched.toLocaleString("en-GB")} companies have a matching award; {summary.companiesWithoutAddress.toLocaleString("en-GB")} of them have no published contact address.
        The other notices give {summary.addressesConsidered.toLocaleString("en-GB")} addresses. Each address is counted once below, under the first rule that removed it.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Outcome</TableHead>
            <TableHead className="text-right">Addresses</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow data-testid="summary-listed">
            <TableCell className="font-medium whitespace-normal">
              On this list ({summary.listedGeneric.toLocaleString("en-GB")} generic, {summary.listedNamed.toLocaleString("en-GB")} named)
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">{summary.listed.toLocaleString("en-GB")}</TableCell>
          </TableRow>
          {EXCLUSION_ORDER.map((key: ExclusionKey) => (
            <TableRow key={key} data-testid={`excluded-${key}`}>
              <TableCell className="whitespace-normal">
                {EXCLUSION_LABELS[key]}
                {key === "not_eligible" && reasons.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {reasons.map(([reason, value]) => (
                      <li key={reason} data-testid={`reason-${reason}`}>
                        {value.toLocaleString("en-GB")} · {reasonLabel(reason)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </TableCell>
              <TableCell className="text-right align-top tabular-nums">{(summary.excluded[key] ?? 0).toLocaleString("en-GB")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const VERDICT_LABELS: Record<FunnelReading["verdict"], string> = { too_early: "Too early", pass: "Pass", kill: "Kill", between: "Between", stopped: "Stop" };
const LINE_LABELS = { pass: "met", below: "not met", kill: "kill level", unknown: "not measurable yet" } as const;

/** The funnel against the pass/kill thresholds of the 400-e-mail test, in counts (percentages only from 100 e-mails). */
export function FunnelPanel({ results, title = "Results" }: { results: OutreachResults; title?: string }) {
  const { counts, reading, byKind } = results;
  const { experiment } = outreachConfig;
  return (
    <Card data-testid="funnel-panel">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Test: of {experiment.emails} e-mails, {experiment.judgeAfterDays} days after the last one — pass at {experiment.pass.visits} page visits, {experiment.pass.claims} claims and ({experiment.pass.packs}{" "}
          bid checks or {experiment.pass.cardPayments} card payments); kill below {experiment.kill.visitsBelow} visits or at 0 claims.
          {reading.scaled && counts.sent >= outreachConfig.percentagesFrom ? ` Scaled in proportion to the ${counts.sent.toLocaleString("en-GB")} sent here.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3" data-testid="funnel-verdict" data-verdict={reading.verdict}>
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <Badge variant={reading.verdict === "pass" ? "default" : reading.verdict === "kill" || reading.verdict === "stopped" ? "destructive" : "secondary"}>{VERDICT_LABELS[reading.verdict]}</Badge>
            {reading.headline}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{reading.detail}</p>
        </div>
        <Table>
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
              <TableCell className="font-medium">Sent</TableCell>
              <TableCell className="tabular-nums">{counts.sent.toLocaleString("en-GB")}</TableCell>
              <TableCell className="text-muted-foreground">the test is {experiment.emails}</TableCell>
              <TableCell />
            </TableRow>
            {reading.lines.map((line) => (
              <TableRow key={line.key} data-testid={`funnel-${line.key}`} data-state={line.state}>
                <TableCell className="font-medium">{line.label}</TableCell>
                <TableCell className="tabular-nums">{line.value}</TableCell>
                <TableCell className="text-muted-foreground">{line.target}</TableCell>
                <TableCell>{LINE_LABELS[line.state]}</TableCell>
              </TableRow>
            ))}
            <TableRow data-testid="funnel-optouts">
              <TableCell className="font-medium">Opted out</TableCell>
              <TableCell className="tabular-nums">{describeShare(counts.optedOut, counts.sent)}</TableCell>
              <TableCell className="text-muted-foreground">review the segment above 5%</TableCell>
              <TableCell />
            </TableRow>
            <TableRow data-testid="funnel-bounces">
              <TableCell className="font-medium">Bounced</TableCell>
              <TableCell className="tabular-nums">{describeShare(counts.bounced, counts.sent)}</TableCell>
              <TableCell className="text-muted-foreground">stop above 3% in a day</TableCell>
              <TableCell />
            </TableRow>
            <TableRow data-testid="funnel-complaints">
              <TableCell className="font-medium">Complaints</TableCell>
              <TableCell className="tabular-nums">{counts.complaints.toLocaleString("en-GB")}</TableCell>
              <TableCell className="text-muted-foreground">more than {experiment.maxComplaints} ends the test</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
        {byKind.named.sent > 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="funnel-by-kind">
            Generic mailboxes: {describeShare(byKind.generic.visited, byKind.generic.sent)} opened, {describeShare(byKind.generic.claimed, byKind.generic.sent)} claimed. Named addresses:{" "}
            {describeShare(byKind.named.visited, byKind.named.sent)} opened, {describeShare(byKind.named.claimed, byKind.named.sent)} claimed. Keep named addresses only if they clearly do better.
          </p>
        ) : null}
        {results.visitedNotMarkedSent > 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="funnel-unmarked">
            {results.visitedNotMarkedSent.toLocaleString("en-GB")} {results.visitedNotMarkedSent === 1 ? "company has" : "companies have"} opened a personal link but {results.visitedNotMarkedSent === 1 ? "is" : "are"} not
            marked as sent. Visits count from the day of sending: mark the batch as sent.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          A visit is a page request carrying the company’s link code, on or after the day of sending. There is no pixel and no cookie, so mail-security scanners that follow links can add visits: read
          claims as the firmer signal. Below {outreachConfig.percentagesFrom} e-mails only counts are shown.
        </p>
      </CardContent>
    </Card>
  );
}
